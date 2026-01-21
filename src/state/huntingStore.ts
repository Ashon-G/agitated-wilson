/**
 * Hunting Store
 *
 * Zustand store for managing Reddit lead hunting state.
 * Updated to use the new HuntingEngine for direct in-app functionality
 * (replaces HuntingEngine workflow approach).
 */

import { create } from 'zustand';
import BackendService from '../services/BackendService';
import AuthenticationService from '../services/AuthenticationService';
import HuntingEngine, {
  HuntingSession as EngineHuntingSession,
  HuntingStatus,
  HuntingProgress,
} from '../services/HuntingEngine';
import { HuntingConfig, SavedLead } from '../services/LeadHuntingService';
import { LeadConversation } from '../services/ConversationAgentService';

// Legacy HuntingSession interface for backwards compatibility with AgentControlModal
export interface HuntingSession {
  id: string;
  userId: string;
  agentId: string;
  criteria: Record<string, unknown>;
  platforms: string[];
  status: 'active' | 'paused' | 'completed';
  startedAt: Date;
  endedAt?: Date;
  totalProspectsScanned: number;
  leadsIdentified: number;
  qualifiedLeads: number;
  contactsInitiated: number;
  conversionRate: number;
  averageLeadScore: number;
  costPerLead: number;
  searchDepth: 'shallow' | 'medium' | 'deep';
  qualificationThreshold: number;
  maxProspectsPerDay: number;
  autoEngagement: boolean;
}

interface ActivityFeedItem {
  id: string;
  type: 'lead_found' | 'lead_qualified' | 'engagement_sent' | 'lead_responded' | 'session_started' | 'session_paused' | 'email_collected';
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface HuntingStats {
  prospectsScanned: number;
  leadsQualified: number;
  conversationsActive: number;
  emailsCollected: number;
}

interface HuntingStore {
  // Session state
  activeSession: HuntingSession | null;
  engineSession: EngineHuntingSession | null;
  status: HuntingStatus;
  progress: HuntingProgress | null;
  isHunting: boolean;
  selectedSubreddits: string[];
  recentActivity: ActivityFeedItem[];
  stats: HuntingStats;
  isLoading: boolean;
  pendingLeadsCount: number;

  // Data from new engine
  leads: SavedLead[];
  conversations: LeadConversation[];

  // Error state
  error: string | null;

  // Actions - startHunting now supports both old and new signatures
  initSession: (config: HuntingConfig) => Promise<void>;
  startHunting: (subredditsOrKnowledge: string[] | string, autonomyLevel?: 'conservative' | 'balanced' | 'aggressive', workspaceId?: string, keywords?: string[]) => Promise<void>;
  pauseHunting: () => Promise<void>;
  resumeHunting: (knowledgeContext?: string) => Promise<void>;
  stopHunting: () => Promise<void>;
  loadActiveSession: () => Promise<void>;
  updateStats: (stats: Partial<HuntingStats>) => void;
  refreshPendingLeadsCount: () => Promise<void>;
  addActivity: (activity: ActivityFeedItem) => void;
  setSelectedSubreddits: (subreddits: string[]) => void;
  clearSession: () => void;
  refreshLeads: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  engageWithLead: (leadId: string, knowledgeContext: string, sendDM?: boolean) => Promise<boolean>;
  clearError: () => void;
}

// Store for cleanup functions
let cleanupFunctions: Array<() => void> = [];

/**
 * Convert engine session to legacy session format for backwards compatibility
 */
function toLegacySession(session: EngineHuntingSession): HuntingSession {
  const statusMap: Record<HuntingStatus, 'active' | 'paused' | 'completed'> = {
    idle: 'completed',
    searching: 'active',
    scoring: 'active',
    engaging: 'active',
    monitoring: 'active',
    paused: 'paused',
    waiting_approval: 'paused',
    error: 'completed',
  };

  return {
    id: session.id || `session_${Date.now()}`,
    userId: session.userId,
    agentId: `agent_${session.userId}_default`,
    criteria: {
      subreddits: session.config.subreddits,
      keywords: session.config.keywords,
      minLeadScore: session.config.minLeadScore,
    },
    platforms: ['reddit'],
    status: statusMap[session.status] || 'active',
    startedAt: session.createdAt,
    totalProspectsScanned: session.stats.postsScanned,
    leadsIdentified: session.stats.leadsFound,
    qualifiedLeads: session.stats.leadsFound,
    contactsInitiated: session.stats.dmsStarted,
    conversionRate: session.stats.leadsFound > 0
      ? (session.stats.emailsCollected / session.stats.leadsFound) * 100
      : 0,
    averageLeadScore: session.config.minLeadScore,
    costPerLead: 0,
    searchDepth: 'medium',
    qualificationThreshold: session.config.minLeadScore,
    maxProspectsPerDay: 50,
    autoEngagement: !session.config.requireApproval,
  };
}

const useHuntingStore = create<HuntingStore>((set, get) => ({
  // Initial state
  activeSession: null,
  engineSession: null,
  status: 'idle',
  progress: null,
  isHunting: false,
  selectedSubreddits: [],
  recentActivity: [],
  stats: {
    prospectsScanned: 0,
    leadsQualified: 0,
    conversationsActive: 0,
    emailsCollected: 0,
  },
  isLoading: false,
  leads: [],
  conversations: [],
  error: null,
  pendingLeadsCount: 0,

  refreshPendingLeadsCount: async () => {
    try {
      const count = await HuntingEngine.getPendingLeadsCount();
      set({ pendingLeadsCount: count });

      // Update status if we have pending leads
      if (count > 0 && get().status !== 'waiting_approval') {
        set({ status: 'waiting_approval' });
      } else if (count === 0 && get().status === 'waiting_approval') {
        set({ status: 'monitoring' });
      }
    } catch (error) {
      console.error('[HuntingStore] Error refreshing pending leads count:', error);
    }
  },

  initSession: async (config: HuntingConfig) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    set({ isLoading: true, error: null });

    try {
      const session = await HuntingEngine.initSession(user.uid, config);

      set({
        engineSession: session,
        activeSession: toLegacySession(session),
        status: session.status,
        selectedSubreddits: config.subreddits,
        stats: {
          prospectsScanned: session.stats.postsScanned,
          leadsQualified: session.stats.leadsFound,
          conversationsActive: session.stats.dmsStarted,
          emailsCollected: session.stats.emailsCollected,
        },
        isLoading: false,
      });

      // Load existing leads and conversations
      await get().refreshLeads();
      await get().refreshConversations();

      console.log('✅ [HuntingStore] Session initialized');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to initialize session';
      console.error('[HuntingStore] Error initializing session:', error);
      set({
        isLoading: false,
        error: errorMsg,
      });
      throw error;
    }
  },

  // Supports both old signature: (subreddits[], autonomyLevel?, workspaceId?, keywords?)
  // and new signature: (knowledgeContext)
  // NEW FLOW: Agent settings are now read from agentSettingsStore (configured in 3-step wizard)
  startHunting: async (
    subredditsOrKnowledge: string[] | string,
    autonomyLevel?: 'conservative' | 'balanced' | 'aggressive',
    _workspaceId?: string,
    keywords?: string[],
  ) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    let knowledgeContext: string;
    let subreddits: string[];

    // Detect which signature is being used
    if (Array.isArray(subredditsOrKnowledge)) {
      // Old signature: startHunting(subreddits[], autonomyLevel?, workspaceId?, keywords?)
      subreddits = subredditsOrKnowledge;
      knowledgeContext = ''; // Will be fetched from knowledge base

      // NEW FLOW: Read agent settings from agentSettingsStore (configured in 3-step wizard)
      const useAgentSettingsStore = (await import('./agentSettingsStore')).default;
      const agentSettings = useAgentSettingsStore.getState().settings;

      // Use agent settings if available, otherwise fall back to autonomy level defaults
      let minLeadScore: number;
      let maxPostAge: number;
      let commentStyle: 'friendly' | 'professional' | 'expert';
      let requireApproval: boolean;

      if (agentSettings) {
        // New flow: Use settings from agentSettingsStore (set by 3-step wizard)
        minLeadScore = agentSettings.scoreThreshold * 10; // Convert 1-10 scale to 10-100
        maxPostAge = agentSettings.postAgeLimitDays * 24; // Convert days to hours
        ({ commentStyle, requireApproval } = agentSettings);
        console.log('🎯 [HuntingStore] Using agent settings from wizard:', {
          scoreThreshold: agentSettings.scoreThreshold,
          postAgeLimitDays: agentSettings.postAgeLimitDays,
          commentStyle,
          requireApproval,
        });
      } else {
        // Fallback: Configure based on autonomy level
        minLeadScore = {
          conservative: 80,
          balanced: 70,
          aggressive: 60,
        }[autonomyLevel || 'balanced'];
        maxPostAge = 168; // 1 week in hours
        commentStyle = 'friendly';
        requireApproval = autonomyLevel === 'conservative';
        console.log('⚠️ [HuntingStore] No agent settings found, using autonomy level defaults');
      }

      const config: HuntingConfig = {
        subreddits,
        keywords: keywords || [],
        minLeadScore,
        maxPostAge,
        commentStyle,
        requireApproval,
      };

      await get().initSession(config);
    } else {
      // New signature: startHunting(knowledgeContext)
      knowledgeContext = subredditsOrKnowledge;
      subreddits = get().selectedSubreddits;

      // If no session, create one with defaults
      if (!get().engineSession) {
        const defaultConfig: HuntingConfig = {
          subreddits: subreddits.length > 0 ? subreddits : ['entrepreneur', 'smallbusiness', 'startups'],
          keywords: [],
          minLeadScore: 70,
          maxPostAge: 168, // 1 week
          commentStyle: 'friendly',
          requireApproval: false,
        };
        await get().initSession(defaultConfig);
      }
    }

    set({ isHunting: true, error: null, progress: null });

    get().addActivity({
      id: `activity_${Date.now()}`,
      type: 'session_started',
      message: `Started hunting in ${get().selectedSubreddits.length} subreddits`,
      timestamp: new Date(),
      metadata: { subreddits: get().selectedSubreddits },
    });

    try {
      await HuntingEngine.startHunting(
        knowledgeContext,
        (progress) => {
          set({
            progress,
            status: progress.status,
          });

          // Add activities based on progress
          if (progress.leadsFound > get().stats.leadsQualified) {
            get().addActivity({
              id: `lead_${Date.now()}`,
              type: 'lead_found',
              message: `Found ${progress.leadsFound} qualified leads`,
              timestamp: new Date(),
            });
          }
        },
      );

      // Update state after hunting completes
      const session = HuntingEngine.getSession();
      set({
        engineSession: session,
        activeSession: session ? toLegacySession(session) : null,
        status: session?.status || 'monitoring',
        isHunting: HuntingEngine.isHuntingActive(),
        stats: session ? {
          prospectsScanned: session.stats.postsScanned,
          leadsQualified: session.stats.leadsFound,
          conversationsActive: session.stats.dmsStarted,
          emailsCollected: session.stats.emailsCollected,
        } : get().stats,
      });

      // Refresh data
      await get().refreshLeads();
      await get().refreshConversations();

      console.log('✅ [HuntingStore] Hunting complete');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Hunting failed';
      console.error('[HuntingStore] Error during hunting:', error);
      set({
        isHunting: false,
        status: 'error',
        error: errorMsg,
      });
      throw error;
    }
  },

  pauseHunting: async () => {
    try {
      await HuntingEngine.pause();

      const session = get().engineSession;
      set({
        isHunting: false,
        status: 'paused',
        activeSession: session ? { ...toLegacySession(session), status: 'paused' } : null,
      });

      get().addActivity({
        id: `activity_${Date.now()}`,
        type: 'session_paused',
        message: 'Hunting paused',
        timestamp: new Date(),
      });

      console.log('⏸️ [HuntingStore] Hunting paused');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to pause hunting';
      console.error('[HuntingStore] Error pausing hunting:', error);
      set({ error: errorMsg });
      throw error;
    }
  },

  resumeHunting: async (knowledgeContext?: string) => {
    try {
      await HuntingEngine.resume(knowledgeContext || '');

      const session = get().engineSession;
      set({
        isHunting: true,
        status: 'monitoring',
        activeSession: session ? { ...toLegacySession(session), status: 'active' } : null,
      });

      get().addActivity({
        id: `activity_${Date.now()}`,
        type: 'session_started',
        message: 'Hunting resumed',
        timestamp: new Date(),
      });

      console.log('▶️ [HuntingStore] Hunting resumed');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to resume hunting';
      console.error('[HuntingStore] Error resuming hunting:', error);
      set({ error: errorMsg });
      throw error;
    }
  },

  stopHunting: async () => {
    try {
      HuntingEngine.stopMonitoring();

      set({
        activeSession: null,
        engineSession: null,
        isHunting: false,
        status: 'idle',
        progress: null,
        selectedSubreddits: [],
        stats: {
          prospectsScanned: 0,
          leadsQualified: 0,
          conversationsActive: 0,
          emailsCollected: 0,
        },
      });

      // Clean up any listeners
      cleanupFunctions.forEach(cleanup => cleanup());
      cleanupFunctions = [];

      console.log('🛑 [HuntingStore] Hunting stopped');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to stop hunting';
      console.error('[HuntingStore] Error stopping hunting:', error);
      set({ error: errorMsg });
      throw error;
    }
  },

  loadActiveSession: async () => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) return;

    try {
      set({ isLoading: true });

      // Try to get session from HuntingEngine
      const existingSession = HuntingEngine.getSession();

      if (existingSession) {
        set({
          engineSession: existingSession,
          activeSession: toLegacySession(existingSession),
          status: existingSession.status,
          isHunting: HuntingEngine.isHuntingActive(),
          selectedSubreddits: existingSession.config.subreddits,
          stats: {
            prospectsScanned: existingSession.stats.postsScanned,
            leadsQualified: existingSession.stats.leadsFound,
            conversationsActive: existingSession.stats.dmsStarted,
            emailsCollected: existingSession.stats.emailsCollected,
          },
          isLoading: false,
        });

        await get().refreshLeads();
        await get().refreshConversations();
        return;
      }

      // Query for existing sessions in Firestore
      // Note: This query requires a composite index on (userId, updatedAt)
      // If the index doesn't exist, fall back to querying without orderBy
      let sessions: EngineHuntingSession[] = [];
      try {
        sessions = await BackendService.queryCollection<EngineHuntingSession>(
          'hunting_sessions',
          {
            where: [
              { field: 'userId', operator: '==', value: user.uid },
            ],
            orderBy: { field: 'updatedAt', direction: 'desc' },
            limit: 1,
          },
        );
      } catch (indexError) {
        // Fallback: query without orderBy if composite index is missing
        console.warn('[HuntingStore] Composite index missing, using fallback query');
        const allSessions = await BackendService.queryCollection<EngineHuntingSession>(
          'hunting_sessions',
          {
            where: [
              { field: 'userId', operator: '==', value: user.uid },
            ],
            limit: 10,
          },
        );
        // Sort client-side and take most recent
        if (allSessions.length > 0) {
          sessions = allSessions.sort((a, b) => {
            const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : new Date(a.updatedAt).getTime();
            const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : new Date(b.updatedAt).getTime();
            return bTime - aTime;
          }).slice(0, 1);
        }
      }

      if (sessions.length > 0) {
        const session = sessions[0];
        set({
          engineSession: session,
          activeSession: toLegacySession(session),
          status: session.status,
          isHunting: session.status === 'monitoring',
          selectedSubreddits: session.config.subreddits,
          stats: {
            prospectsScanned: session.stats.postsScanned,
            leadsQualified: session.stats.leadsFound,
            conversationsActive: session.stats.dmsStarted,
            emailsCollected: session.stats.emailsCollected,
          },
        });

        await get().refreshLeads();
        await get().refreshConversations();
      }

      set({ isLoading: false });
    } catch (error) {
      console.error('[HuntingStore] Failed to load active session:', error);
      set({ isLoading: false });
    }
  },

  refreshLeads: async () => {
    try {
      const leads = await HuntingEngine.getLeads();
      set({ leads });
    } catch (error) {
      console.error('[HuntingStore] Error refreshing leads:', error);
    }
  },

  refreshConversations: async () => {
    try {
      const conversations = await HuntingEngine.getConversations();
      set({ conversations });
    } catch (error) {
      console.error('[HuntingStore] Error refreshing conversations:', error);
    }
  },

  engageWithLead: async (leadId: string, knowledgeContext: string, sendDM = false) => {
    try {
      const result = await HuntingEngine.engageWithLead(leadId, knowledgeContext, { sendDM });

      if (result.success) {
        get().addActivity({
          id: `engage_${Date.now()}`,
          type: 'engagement_sent',
          message: `Engaged with lead${sendDM ? ' and sent DM' : ''}`,
          timestamp: new Date(),
          metadata: { leadId },
        });

        await get().refreshLeads();
        return true;
      } else {
        set({ error: result.error || 'Failed to engage with lead' });
        return false;
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to engage with lead';
      console.error('[HuntingStore] Error engaging with lead:', error);
      set({ error: errorMsg });
      return false;
    }
  },

  updateStats: (stats) => {
    set(state => ({
      stats: { ...state.stats, ...stats },
    }));
  },

  addActivity: (activity) => {
    set(state => ({
      recentActivity: [activity, ...state.recentActivity].slice(0, 20),
    }));
  },

  setSelectedSubreddits: (subreddits) => {
    set({ selectedSubreddits: subreddits });
  },

  clearSession: () => {
    HuntingEngine.stopMonitoring();
    cleanupFunctions.forEach(cleanup => cleanup());
    cleanupFunctions = [];

    set({
      activeSession: null,
      engineSession: null,
      status: 'idle',
      progress: null,
      isHunting: false,
      selectedSubreddits: [],
      recentActivity: [],
      stats: {
        prospectsScanned: 0,
        leadsQualified: 0,
        conversationsActive: 0,
        emailsCollected: 0,
      },
      leads: [],
      conversations: [],
      error: null,
      pendingLeadsCount: 0,
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));

export default useHuntingStore;
