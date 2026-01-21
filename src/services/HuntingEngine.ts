/**
 * Hunting Engine
 *
 * Orchestrates the full lead hunting flow:
 * 1. Searches Reddit for leads based on user config
 * 2. Scores leads using Gemini AI
 * 3. Posts comments to engage with high-quality leads
 * 4. Monitors for replies and handles DM conversations
 * 5. Collects emails when HubSpot is connected
 * 6. Syncs lead data to HubSpot CRM
 *
 * This engine replaces HuntingEngine workflows with direct in-app functionality.
 */

import LeadHuntingService, { ScoredLead, HuntingConfig, SavedLead } from './LeadHuntingService';
import ConversationAgentService, { LeadConversation, ConversationStage } from './ConversationAgentService';
import GeminiService from './GeminiService';
import RedditAPIService from './RedditAPIService';
import BackendService from './BackendService';
import HubSpotAuthService from './integrations/HubSpotAuthService';
import { auth } from '../config/firebase';
import { hasEntitlement } from '../lib/revenuecatClient';
import {
  SUBSCRIPTION_TIERS,
  ENTITLEMENTS,
  DEFAULT_TIER,
  type SubscriptionTier,
  type TierLimits,
} from '../config/subscriptionTiers';

export type HuntingStatus = 'idle' | 'searching' | 'scoring' | 'engaging' | 'monitoring' | 'paused' | 'waiting_approval' | 'error';

// Re-export SubscriptionTier for backwards compatibility
export { SubscriptionTier };

// Legacy SUBSCRIPTION_LIMITS for backwards compatibility - maps to new tier system
export const SUBSCRIPTION_LIMITS = {
  free: { subreddits: 1, leadsPerHour: 1 },
  basic: { subreddits: 3, leadsPerHour: 5 },
  plus: { subreddits: 9, leadsPerHour: 25 },
  pro: { subreddits: 15, leadsPerHour: -1 }, // -1 = unlimited
} as const;

export interface HuntingSession {
  id?: string;
  userId: string;
  status: HuntingStatus;
  config: HuntingConfig;
  subscriptionTier: SubscriptionTier;
  stats: {
    postsScanned: number;
    leadsFound: number;
    leadsFoundThisHour: number;
    lastLeadFoundAt: Date | null;
    commentsPosted: number;
    dmsStarted: number;
    emailsCollected: number;
    lastRunAt: Date | null;
  };
  hubspotConnected: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface HuntingProgress {
  status: HuntingStatus;
  message: string;
  progress: number;
  currentSubreddit?: string;
  leadsFound: number;
}

class HuntingEngine {
  private currentSession: HuntingSession | null = null;
  private isRunning: boolean = false;
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;
  private progressCallback: ((progress: HuntingProgress) => void) | null = null;

  /**
   * Determine user's subscription tier
   */
  private async getSubscriptionTier(): Promise<SubscriptionTier> {
    const proResult = await hasEntitlement(ENTITLEMENTS.pro);
    if (proResult.ok && proResult.data) return 'pro';

    const plusResult = await hasEntitlement(ENTITLEMENTS.plus);
    if (plusResult.ok && plusResult.data) return 'plus';

    const basicResult = await hasEntitlement(ENTITLEMENTS.basic);
    if (basicResult.ok && basicResult.data) return 'basic';

    return DEFAULT_TIER;
  }

  /**
   * Get tier limits for the current subscription
   */
  private getTierLimits(tier: SubscriptionTier): TierLimits {
    return SUBSCRIPTION_TIERS[tier].limits;
  }

  /**
   * Check if there are pending leads awaiting user approval
   * Returns the count of pending approval_request items in the inbox
   */
  async getPendingLeadsCount(): Promise<number> {
    if (!this.currentSession) return 0;

    try {
      const pendingItems = await BackendService.queryCollection<{ id: string; status: string; type: string }>(
        'inbox',
        {
          where: [
            { field: 'userId', operator: '==', value: this.currentSession.userId },
            { field: 'type', operator: '==', value: 'approval_request' },
            { field: 'status', operator: '==', value: 'pending' },
          ],
          limit: 100,
        },
      );

      return pendingItems.length;
    } catch (error) {
      console.error('🔴 [HuntingEngine] Error checking pending leads:', error);
      return 0;
    }
  }

  /**
   * Check if hunting should be paused due to pending leads
   * Returns true if there are pending leads that need user action
   */
  async shouldPauseForPendingLeads(): Promise<boolean> {
    const pendingCount = await this.getPendingLeadsCount();
    if (pendingCount > 0) {
      console.log(`⏸️ [HuntingEngine] ${pendingCount} pending leads awaiting approval - pausing hunt`);
      return true;
    }
    return false;
  }

  /**
   * Initialize or resume a hunting session
   */
  async initSession(userId: string, config: HuntingConfig): Promise<HuntingSession> {
    try {
      // Check if HubSpot is connected
      const hubspotIntegration = await HubSpotAuthService.getCurrentIntegration();
      const hubspotConnected = !!hubspotIntegration;

      // Get subscription tier
      const subscriptionTier = await this.getSubscriptionTier();

      // Check for existing session
      const existingSessions = await BackendService.queryCollection<HuntingSession>(
        'hunting_sessions',
        {
          where: [{ field: 'userId', operator: '==', value: userId }],
          orderBy: { field: 'createdAt', direction: 'desc' },
          limit: 1,
        },
      );

      if (existingSessions.length > 0) {
        // Update existing session with new config
        const session = existingSessions[0];
        const updatedSession: HuntingSession = {
          ...session,
          config,
          subscriptionTier,
          hubspotConnected,
          updatedAt: new Date(),
        };

        await BackendService.updateDocument('hunting_sessions', session.id!, {
          config,
          subscriptionTier,
          hubspotConnected,
          updatedAt: new Date(),
        });

        this.currentSession = updatedSession;
        console.log('✅ [HuntingEngine] Resumed existing session:', session.id);
        return updatedSession;
      }

      // Create new session
      const newSession: Omit<HuntingSession, 'id'> = {
        userId,
        status: 'idle',
        config,
        subscriptionTier,
        stats: {
          postsScanned: 0,
          leadsFound: 0,
          leadsFoundThisHour: 0,
          lastLeadFoundAt: null,
          commentsPosted: 0,
          dmsStarted: 0,
          emailsCollected: 0,
          lastRunAt: null,
        },
        hubspotConnected,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await BackendService.createDocument<HuntingSession>('hunting_sessions', newSession);

      this.currentSession = { ...newSession, id: result.id };
      console.log('✅ [HuntingEngine] Created new session:', result.id);

      return this.currentSession;
    } catch (error) {
      console.error('🔴 [HuntingEngine] Error initializing session:', error);
      throw error;
    }
  }

  /**
   * Start the hunting process
   */
  async startHunting(
    knowledgeContext: string,
    onProgress?: (progress: HuntingProgress) => void,
  ): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No session initialized. Call initSession first.');
    }

    if (this.isRunning) {
      console.log('⚠️ [HuntingEngine] Hunting already in progress');
      return;
    }

    this.progressCallback = onProgress || null;

    // Check for pending leads before starting hunt
    const pendingCount = await this.getPendingLeadsCount();
    if (pendingCount > 0) {
      console.log(`⏸️ [HuntingEngine] ${pendingCount} pending leads need approval - waiting`);
      await this.updateStatus('waiting_approval');
      this.emitProgress('waiting_approval', `Review ${pendingCount} lead${pendingCount > 1 ? 's' : ''} in your inbox to continue hunting`, 0);

      // Start monitoring for replies but skip hunting for new leads
      this.startMonitoring(knowledgeContext, this.currentSession.hubspotConnected);
      return;
    }

    this.isRunning = true;

    try {
      const { config, hubspotConnected } = this.currentSession;

      // Update status
      await this.updateStatus('searching');
      this.emitProgress('searching', 'Starting lead hunt...', 0);

      // Phase 1: Search and score leads
      const scoredLeads = await LeadHuntingService.huntLeads(
        config,
        knowledgeContext,
        (message, progress) => {
          this.emitProgress('searching', message, progress * 0.5);
        },
      );

      await this.updateStats({ postsScanned: scoredLeads.length });
      this.emitProgress('scoring', `Found ${scoredLeads.length} potential leads`, 50);

      // Phase 2: Save qualified leads
      const qualifiedLeads = scoredLeads.filter(lead => lead.shouldEngage);
      await this.updateStats({ leadsFound: qualifiedLeads.length });

      console.log(`✅ [HuntingEngine] ${qualifiedLeads.length} qualified leads found out of ${scoredLeads.length} total`);

      // Save each lead to Firestore and create inbox items
      for (const lead of qualifiedLeads) {
        console.log(`📥 [HuntingEngine] Processing lead: ${lead.post.title.substring(0, 50)}... (score: ${lead.score})`);
        await LeadHuntingService.saveLead(lead, this.currentSession.userId);
      }

      console.log(`✅ [HuntingEngine] All ${qualifiedLeads.length} leads saved`);

      // Phase 3: Engage with high-scoring leads (if auto-engage is enabled)
      if (!config.requireApproval && qualifiedLeads.length > 0) {
        await this.updateStatus('engaging');
        this.emitProgress('engaging', 'Engaging with leads...', 60);

        await this.engageWithLeads(qualifiedLeads, knowledgeContext, config, hubspotConnected);
      }

      // Phase 4: Start monitoring for replies
      await this.updateStatus('monitoring');
      this.emitProgress('monitoring', 'Monitoring for replies...', 90);

      // Start background monitoring
      this.startMonitoring(knowledgeContext, hubspotConnected);

      await this.updateStats({ lastRunAt: new Date() });
      this.emitProgress('monitoring', 'Hunt complete! Now monitoring for replies.', 100);

      console.log('✅ [HuntingEngine] Hunting complete, monitoring active');
    } catch (error) {
      console.error('🔴 [HuntingEngine] Error during hunting:', error);
      await this.updateStatus('error');
      this.emitProgress('error', 'Error during hunt', 0);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Engage with qualified leads by posting comments
   */
  private async engageWithLeads(
    leads: ScoredLead[],
    knowledgeContext: string,
    config: HuntingConfig,
    hubspotConnected: boolean,
  ): Promise<void> {
    let commentsPosted = 0;
    let dmsStarted = 0;

    // Sort by score and take top leads
    const topLeads = leads
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Limit to prevent spam

    for (const lead of topLeads) {
      try {
        // Generate and post comment
        const commentResult = await GeminiService.generateComment(
          {
            title: lead.post.title,
            content: lead.post.selftext,
            subreddit: lead.post.subreddit,
          },
          knowledgeContext,
          config.commentStyle,
        );

        if (commentResult.confidence >= 0.7 && commentResult.comment) {
          const postResult = await LeadHuntingService.postComment(
            lead.post.id,
            commentResult.comment,
          );

          if (postResult.success) {
            commentsPosted++;

            // Update lead status
            await this.updateLeadStatus(lead.post.id, 'commented');

            // For high-intent leads, start DM conversation
            if (lead.buyingIntent === 'high' && hubspotConnected) {
              const initialMessage = await ConversationAgentService.generateInitialMessage(
                {
                  title: lead.post.title,
                  content: lead.post.selftext,
                  subreddit: lead.post.subreddit,
                },
                knowledgeContext,
              );

              if (initialMessage) {
                const conversationId = await ConversationAgentService.startConversation(
                  this.currentSession!.userId,
                  lead.post.author,
                  initialMessage,
                  {
                    leadId: lead.post.id,
                    originalPost: {
                      title: lead.post.title,
                      subreddit: lead.post.subreddit,
                      url: lead.post.permalink,
                    },
                  },
                );

                if (conversationId) {
                  dmsStarted++;
                  await this.updateLeadStatus(lead.post.id, 'engaged');
                }
              }
            }
          }
        }

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`🔴 [HuntingEngine] Error engaging with lead ${lead.post.id}:`, error);
      }
    }

    await this.updateStats({ commentsPosted, dmsStarted });
  }

  /**
   * Start background monitoring and periodic lead hunting
   */
  private startMonitoring(knowledgeContext: string, hubspotConnected: boolean): void {
    // Clear existing interval if any
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Store knowledge context for periodic hunts
    this.storedKnowledgeContext = knowledgeContext;

    // Run monitoring cycle every 5 minutes
    const MONITORING_INTERVAL = 5 * 60 * 1000;

    // Track hunt cycle - hunt for new leads every 30 minutes (6 cycles)
    let cycleCount = 0;
    const HUNT_EVERY_N_CYCLES = 6; // Hunt every 30 minutes (6 x 5 min)

    this.monitoringInterval = setInterval(async () => {
      if (!this.currentSession) {
        this.stopMonitoring();
        return;
      }

      cycleCount++;

      try {
        // Every cycle: Check for new messages/replies
        console.log('🔍 [HuntingEngine] Checking for new messages...');

        const processedCount = await ConversationAgentService.checkAndProcessNewMessages(
          this.currentSession.userId,
          knowledgeContext,
          { collectEmail: hubspotConnected },
        );

        if (processedCount > 0) {
          console.log(`✅ [HuntingEngine] Processed ${processedCount} new messages`);

          // Check if any emails were collected
          const emailsCollected = await this.checkForNewEmails();
          if (emailsCollected > 0) {
            await this.updateStats({
              emailsCollected: (this.currentSession.stats.emailsCollected || 0) + emailsCollected,
            });

            // Sync to HubSpot if connected
            if (hubspotConnected) {
              await this.syncEmailsToHubSpot();
            }
          }
        }

        // Every 30 minutes: Hunt for new leads
        if (cycleCount >= HUNT_EVERY_N_CYCLES) {
          cycleCount = 0;
          await this.runPeriodicHunt(knowledgeContext);
        }
      } catch (error) {
        console.error('🔴 [HuntingEngine] Error during monitoring:', error);
      }
    }, MONITORING_INTERVAL);

    console.log('✅ [HuntingEngine] Monitoring started (hunting every 30 minutes)');
  }

  /**
   * Stored knowledge context for periodic hunts
   */
  private storedKnowledgeContext: string = '';

  /**
   * Run a periodic hunt for new leads (called every 30 minutes)
   */
  private async runPeriodicHunt(knowledgeContext: string): Promise<void> {
    if (!this.currentSession || this.isRunning) {
      return;
    }

    // Check for pending leads before starting periodic hunt
    const pendingCount = await this.getPendingLeadsCount();
    if (pendingCount > 0) {
      console.log(`⏸️ [HuntingEngine] Skipping periodic hunt - ${pendingCount} leads awaiting approval`);
      await this.updateStatus('waiting_approval');
      this.emitProgress('waiting_approval', `Review ${pendingCount} lead${pendingCount > 1 ? 's' : ''} in your inbox to continue hunting`, 0);
      return;
    }

    console.log('🔄 [HuntingEngine] Starting periodic hunt...');

    try {
      this.isRunning = true;
      const { config, hubspotConnected } = this.currentSession;

      // Hunt for leads
      const scoredLeads = await LeadHuntingService.huntLeads(
        config,
        knowledgeContext,
        async (message, _progress) => {
          // Log progress messages
          console.log(`📊 [HuntingEngine] ${message}`);
        },
      );

      // Save qualified leads
      const qualifiedLeads = scoredLeads.filter(lead => lead.shouldEngage);

      for (const lead of qualifiedLeads) {
        await LeadHuntingService.saveLead(lead, this.currentSession.userId);
      }

      // Update stats
      await this.updateStats({
        postsScanned: (this.currentSession.stats.postsScanned || 0) + scoredLeads.length,
        leadsFound: (this.currentSession.stats.leadsFound || 0) + qualifiedLeads.length,
        lastRunAt: new Date(),
      });

      // Auto-engage if enabled
      if (!config.requireApproval && qualifiedLeads.length > 0) {
        await this.engageWithLeads(qualifiedLeads, knowledgeContext, config, hubspotConnected);
      }

      console.log(`✅ [HuntingEngine] Periodic hunt complete: ${qualifiedLeads.length} leads found`);
    } catch (error) {
      console.error('🔴 [HuntingEngine] Error during periodic hunt:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Stop background monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('🛑 [HuntingEngine] Monitoring stopped');
    }
  }

  /**
   * Pause hunting
   */
  async pause(): Promise<void> {
    this.stopMonitoring();
    this.isRunning = false;

    if (this.currentSession) {
      await this.updateStatus('paused');
    }

    console.log('⏸️ [HuntingEngine] Hunting paused');
  }

  /**
   * Resume hunting
   */
  async resume(knowledgeContext: string): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No session to resume');
    }

    await this.updateStatus('monitoring');
    this.startMonitoring(knowledgeContext, this.currentSession.hubspotConnected);

    console.log('▶️ [HuntingEngine] Hunting resumed');
  }

  /**
   * Check for newly collected emails
   */
  private async checkForNewEmails(): Promise<number> {
    if (!this.currentSession) return 0;

    try {
      const conversations = await BackendService.queryCollection<LeadConversation>(
        'lead_conversations',
        {
          where: [
            { field: 'userId', operator: '==', value: this.currentSession.userId },
            { field: 'stage', operator: '==', value: 'collected' },
          ],
          limit: 50,
        },
      );

      // Count conversations with collected emails that haven't been synced
      const newEmails = conversations.filter(
        c => c.collectedEmail && !c.hubspotContactId,
      );

      return newEmails.length;
    } catch (error) {
      console.error('🔴 [HuntingEngine] Error checking for new emails:', error);
      return 0;
    }
  }

  /**
   * Sync collected emails to HubSpot
   */
  private async syncEmailsToHubSpot(): Promise<void> {
    if (!this.currentSession) return;

    try {
      const hubspot = await HubSpotAuthService.getCurrentIntegration();
      if (!hubspot) return;

      // Get conversations with emails that need syncing
      const conversations = await BackendService.queryCollection<LeadConversation>(
        'lead_conversations',
        {
          where: [
            { field: 'userId', operator: '==', value: this.currentSession.userId },
            { field: 'stage', operator: '==', value: 'collected' },
          ],
          limit: 50,
        },
      );

      for (const conversation of conversations) {
        if (conversation.collectedEmail && !conversation.hubspotContactId) {
          try {
            // Create HubSpot contact
            const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${hubspot.accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                properties: {
                  email: conversation.collectedEmail,
                  firstname: conversation.leadUsername,
                  hs_lead_status: 'NEW',
                  leadsource: 'Reddit',
                  message: `Lead from r/${conversation.originalPost?.subreddit || 'unknown'}. Original post: ${conversation.originalPost?.title || 'N/A'}`,
                },
              }),
            });

            if (response.ok) {
              const contact = await response.json();

              // Update conversation with HubSpot contact ID
              await ConversationAgentService.updateConversation(conversation.id!, {
                hubspotContactId: contact.id,
              });

              console.log(`✅ [HuntingEngine] Synced ${conversation.collectedEmail} to HubSpot`);
            } else {
              const errorText = await response.text();
              console.error('🔴 [HuntingEngine] Failed to create HubSpot contact:', errorText);
            }
          } catch (error) {
            console.error('🔴 [HuntingEngine] Error syncing to HubSpot:', error);
          }
        }
      }
    } catch (error) {
      console.error('🔴 [HuntingEngine] Error syncing emails to HubSpot:', error);
    }
  }

  /**
   * Update lead status in Firestore
   */
  private async updateLeadStatus(
    postId: string,
    status: SavedLead['status'],
  ): Promise<void> {
    if (!this.currentSession) return;

    try {
      const leads = await BackendService.queryCollection<SavedLead>(
        'reddit_leads',
        {
          where: [
            { field: 'userId', operator: '==', value: this.currentSession.userId },
            { field: 'postId', operator: '==', value: postId },
          ],
          limit: 1,
        },
      );

      if (leads.length > 0) {
        await BackendService.updateDocument('reddit_leads', leads[0].id!, {
          status,
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      console.error('🔴 [HuntingEngine] Error updating lead status:', error);
    }
  }

  /**
   * Update session status
   */
  private async updateStatus(status: HuntingStatus): Promise<void> {
    if (!this.currentSession?.id) return;

    try {
      this.currentSession.status = status;

      await BackendService.updateDocument('hunting_sessions', this.currentSession.id, {
        status,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('🔴 [HuntingEngine] Error updating status:', error);
    }
  }

  /**
   * Update session stats
   */
  private async updateStats(stats: Partial<HuntingSession['stats']>): Promise<void> {
    if (!this.currentSession?.id) return;

    try {
      this.currentSession.stats = {
        ...this.currentSession.stats,
        ...stats,
      };

      await BackendService.updateDocument('hunting_sessions', this.currentSession.id, {
        stats: this.currentSession.stats,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('🔴 [HuntingEngine] Error updating stats:', error);
    }
  }

  /**
   * Emit progress update
   */
  private emitProgress(status: HuntingStatus, message: string, progress: number): void {
    if (this.progressCallback) {
      this.progressCallback({
        status,
        message,
        progress,
        leadsFound: this.currentSession?.stats.leadsFound || 0,
      });
    }
  }

  /**
   * Get current session
   */
  getSession(): HuntingSession | null {
    return this.currentSession;
  }

  /**
   * Get hunting status
   */
  getStatus(): HuntingStatus {
    return this.currentSession?.status || 'idle';
  }

  /**
   * Get session stats
   */
  getStats(): HuntingSession['stats'] | null {
    return this.currentSession?.stats || null;
  }

  /**
   * Check if hunting is active
   */
  isHuntingActive(): boolean {
    return this.isRunning || this.monitoringInterval !== null;
  }

  /**
   * Get leads for current user
   */
  async getLeads(filter?: {
    status?: SavedLead['status'];
    buyingIntent?: 'high' | 'medium' | 'low';
    limit?: number;
  }): Promise<SavedLead[]> {
    if (!this.currentSession) return [];

    try {
      const whereConditions: Array<{
        field: string;
        operator: '==' | '<' | '>' | '<=' | '>=';
        value: string;
      }> = [
        { field: 'userId', operator: '==', value: this.currentSession.userId },
      ];

      if (filter?.status) {
        whereConditions.push({ field: 'status', operator: '==', value: filter.status });
      }

      if (filter?.buyingIntent) {
        whereConditions.push({ field: 'buyingIntent', operator: '==', value: filter.buyingIntent });
      }

      const leads = await BackendService.queryCollection<SavedLead>(
        'reddit_leads',
        {
          where: whereConditions,
          orderBy: { field: 'score', direction: 'desc' },
          limit: filter?.limit || 50,
        },
      );

      return leads;
    } catch (error) {
      console.error('🔴 [HuntingEngine] Error getting leads:', error);
      return [];
    }
  }

  /**
   * Manually engage with a specific lead
   */
  async engageWithLead(
    leadId: string,
    knowledgeContext: string,
    options?: { sendDM?: boolean },
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.currentSession) {
      return { success: false, error: 'No session initialized' };
    }

    try {
      // Get the lead
      const lead = await BackendService.getDocument<SavedLead>('reddit_leads', leadId);

      if (!lead) {
        return { success: false, error: 'Lead not found' };
      }

      // Generate comment
      const commentResult = await GeminiService.generateComment(
        {
          title: lead.postTitle,
          content: lead.postContent,
          subreddit: lead.subreddit,
        },
        knowledgeContext,
        this.currentSession.config.commentStyle,
      );

      if (!commentResult.comment) {
        return { success: false, error: 'Failed to generate comment' };
      }

      // Post comment
      const postResult = await LeadHuntingService.postComment(lead.postId, commentResult.comment);

      if (!postResult.success) {
        return { success: false, error: postResult.error || 'Failed to post comment' };
      }

      await this.updateLeadStatus(lead.postId, 'commented');

      // Optionally send DM
      if (options?.sendDM) {
        const initialMessage = await ConversationAgentService.generateInitialMessage(
          {
            title: lead.postTitle,
            content: lead.postContent,
            subreddit: lead.subreddit,
          },
          knowledgeContext,
        );

        if (initialMessage) {
          await ConversationAgentService.startConversation(
            this.currentSession.userId,
            lead.author,
            initialMessage,
            {
              leadId: lead.postId,
              originalPost: {
                title: lead.postTitle,
                subreddit: lead.subreddit,
                url: lead.postUrl,
              },
            },
          );

          await this.updateLeadStatus(lead.postId, 'engaged');
        }
      }

      return { success: true };
    } catch (error: any) {
      console.error('🔴 [HuntingEngine] Error engaging with lead:', error);
      return { success: false, error: error.message || 'Failed to engage with lead' };
    }
  }

  /**
   * Get active conversations
   */
  async getConversations(): Promise<LeadConversation[]> {
    if (!this.currentSession) return [];

    return ConversationAgentService.getActiveConversations(this.currentSession.userId);
  }
}

export default new HuntingEngine();
