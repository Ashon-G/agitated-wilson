import { create } from 'zustand';
import { Lead, LeadStatus, HuntingConfig } from '../types/lead';
import LeadHuntingService from '../services/LeadHuntingService';
import BackendService from '../services/BackendService';
import AuthenticationService from '../services/AuthenticationService';

interface LeadState {
  // Leads
  leads: Lead[];
  isLoading: boolean;
  error: string | null;

  // Hunting config
  huntingConfig: HuntingConfig | null;
  isHunting: boolean;

  // Actions - Leads
  setLeads: (leads: Lead[]) => void;
  addLead: (lead: Lead) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  loadLeads: () => Promise<void>;

  // New flow actions
  approveLead: (id: string) => void;
  rejectLead: (id: string) => void;
  setDMMessage: (id: string, dmMessage: string) => void;
  sendDMAndComment: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Actions - Hunting
  setHuntingConfig: (config: HuntingConfig) => void;
  updateHuntingConfig: (updates: Partial<HuntingConfig>) => void;
  startHunting: () => void;
  stopHunting: () => void;

  // Actions - Loading
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Selectors
  getPendingLeads: () => Lead[];
  getApprovedLeads: () => Lead[];
  getContactedLeads: () => Lead[];
  getLeadsWithResponses: () => Lead[];
}

const useLeadStore = create<LeadState>((set, get) => ({
  // Initial state
  leads: [],
  isLoading: false,
  error: null,
  huntingConfig: null,
  isHunting: false,

  // Leads actions
  setLeads: leads => set({ leads }),

  addLead: lead =>
    set(state => ({
      leads: [lead, ...state.leads],
    })),

  updateLead: (id, updates) =>
    set(state => ({
      leads: state.leads.map(lead =>
        lead.id === id ? { ...lead, ...updates, updatedAt: new Date() } : lead,
      ),
    })),

  loadLeads: async () => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) return;

    set({ isLoading: true, error: null });

    try {
      // Load leads from Firestore
      const savedLeads = await BackendService.queryCollection<any>(
        'reddit_leads',
        {
          where: [{ field: 'userId', operator: '==', value: user.uid }],
          orderBy: { field: 'createdAt', direction: 'desc' },
          limit: 100,
        },
      );

      // Convert SavedLead format to Lead format
      const leads: Lead[] = savedLeads.map(saved => ({
        id: saved.id,
        userId: saved.userId,
        platform: 'reddit' as const,
        post: {
          id: saved.postId,
          title: saved.postTitle,
          content: saved.postContent,
          subreddit: saved.subreddit,
          author: saved.author,
          url: saved.postUrl,
          createdAt: saved.createdAt,
          score: 0,
          numComments: 0,
        },
        matchedKeywords: [],
        relevanceScore: Math.round(saved.score / 10), // Convert 0-100 to 1-10
        aiReason: saved.reasoning,
        status: saved.status === 'found' ? 'pending' : saved.status,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
        dmMessage: saved.dmMessage,
        commentMessage: saved.commentMessage,
        commentId: saved.commentId,
        approvedAt: saved.approvedAt,
        dmSentAt: saved.dmSentAt,
        commentPostedAt: saved.commentPostedAt,
      }));

      set({ leads, isLoading: false });
    } catch (error: any) {
      console.error('[LeadStore] Error loading leads:', error);
      set({ isLoading: false, error: error.message || 'Failed to load leads' });
    }
  },

  // New flow: User approves a lead (ready to write DM)
  approveLead: id =>
    set(state => ({
      leads: state.leads.map(lead =>
        lead.id === id
          ? { ...lead, status: 'approved' as LeadStatus, approvedAt: new Date(), updatedAt: new Date() }
          : lead,
      ),
    })),

  // User rejects a lead
  rejectLead: id =>
    set(state => ({
      leads: state.leads.map(lead =>
        lead.id === id
          ? { ...lead, status: 'rejected' as LeadStatus, rejectedAt: new Date(), updatedAt: new Date() }
          : lead,
      ),
    })),

  // User writes their DM message
  setDMMessage: (id, dmMessage) =>
    set(state => ({
      leads: state.leads.map(lead =>
        lead.id === id
          ? { ...lead, dmMessage, status: 'dm_ready' as LeadStatus, updatedAt: new Date() }
          : lead,
      ),
    })),

  // Send DM, then post "check your DMs" comment
  sendDMAndComment: async (id) => {
    const lead = get().leads.find(l => l.id === id);
    if (!lead || !lead.dmMessage) {
      return { success: false, error: 'Lead not found or no DM message' };
    }

    try {
      // Step 1: Send the DM
      const dmResult = await LeadHuntingService.sendDM(
        lead.post.author,
        `Re: Your post in r/${lead.post.subreddit}`,
        lead.dmMessage,
      );

      if (!dmResult.success) {
        return { success: false, error: dmResult.error || 'Failed to send DM' };
      }

      // Update lead status to dm_sent
      set(state => ({
        leads: state.leads.map(l =>
          l.id === id
            ? { ...l, status: 'dm_sent' as LeadStatus, dmSentAt: new Date(), updatedAt: new Date() }
            : l,
        ),
      }));

      // Step 2: Post "check your DMs" comment on their post
      const commentMessage = 'Hey! Just sent you a DM - check your inbox when you get a chance!';
      const commentResult = await LeadHuntingService.postComment(lead.post.id, commentMessage);

      if (!commentResult.success) {
        // DM was sent but comment failed - still mark as dm_sent
        console.warn('[LeadStore] DM sent but comment failed:', commentResult.error);
        return { success: true, error: `DM sent but comment failed: ${commentResult.error}` };
      }

      // Both DM and comment successful - mark as contacted
      set(state => ({
        leads: state.leads.map(l =>
          l.id === id
            ? {
              ...l,
              status: 'contacted' as LeadStatus,
              commentMessage,
              commentId: commentResult.commentId,
              commentPostedAt: new Date(),
              updatedAt: new Date(),
            }
            : l,
        ),
      }));

      // Update in Firestore
      await BackendService.updateDocument('reddit_leads', id, {
        status: 'contacted',
        dmMessage: lead.dmMessage,
        dmSentAt: new Date(),
        commentMessage,
        commentId: commentResult.commentId,
        commentPostedAt: new Date(),
        updatedAt: new Date(),
      });

      return { success: true };
    } catch (error: any) {
      console.error('[LeadStore] Error in sendDMAndComment:', error);
      return { success: false, error: error.message || 'Failed to send DM and comment' };
    }
  },

  // Hunting config actions
  setHuntingConfig: config => set({ huntingConfig: config }),

  updateHuntingConfig: updates =>
    set(state => ({
      huntingConfig: state.huntingConfig
        ? { ...state.huntingConfig, ...updates, updatedAt: new Date() }
        : null,
    })),

  startHunting: () => set({ isHunting: true }),

  stopHunting: () => set({ isHunting: false }),

  // Loading actions
  setLoading: loading => set({ isLoading: loading }),

  setError: error => set({ error }),

  // Selectors
  getPendingLeads: () => get().leads.filter(lead => lead.status === 'pending'),

  getApprovedLeads: () => get().leads.filter(lead =>
    lead.status === 'approved' || lead.status === 'dm_ready',
  ),

  getContactedLeads: () =>
    get().leads.filter(lead =>
      lead.status === 'contacted' || lead.status === 'dm_sent' || lead.status === 'responded',
    ),

  getLeadsWithResponses: () =>
    get().leads.filter(lead => lead.status === 'responded'),
}));

export default useLeadStore;
