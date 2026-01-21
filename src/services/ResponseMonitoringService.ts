/**
 * Response Monitoring Service
 *
 * Monitors Reddit for responses to our agent's comments and DMs.
 * When a lead responds, it:
 * 1. Updates the lead status to 'responded'
 * 2. Creates a notification for the user
 * 3. Adds the response to the conversation
 *
 * This service runs periodically to check for new responses.
 */

import RedditAPIService, { RedditMessage } from './RedditAPIService';
import BackendService from './BackendService';
import AuthenticationService from './AuthenticationService';
import useLeadStore from '../state/leadStore';
import useConversationStore from '../state/conversationStore';
import useInboxStore from '../state/inboxStore';
import useWorkspaceStore from '../state/workspaceStore';
import { Conversation, ConversationMessage, Lead } from '../types/lead';

class ResponseMonitoringService {
  private isRunning = false;
  private checkIntervalMs = 60000; // Check every minute
  private intervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * Start monitoring for responses
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ [ResponseMonitor] Already running');
      return;
    }

    console.log('🚀 [ResponseMonitor] Starting response monitoring...');
    this.isRunning = true;

    // Run immediately
    this.checkForResponses();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.checkForResponses();
    }, this.checkIntervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 [ResponseMonitor] Stopped');
  }

  /**
   * Check for new responses
   */
  async checkForResponses(): Promise<void> {
    const user = AuthenticationService.getCurrentUser();
    if (!user) {
      console.log('⚠️ [ResponseMonitor] No authenticated user');
      return;
    }

    try {
      console.log('🔍 [ResponseMonitor] Checking for responses...');

      // Fetch unread messages from Reddit
      const result = await RedditAPIService.fetchUnreadMessages();

      if (!result.success || !result.data) {
        console.log('⚠️ [ResponseMonitor] No unread messages or error');
        return;
      }

      // Get contacted leads to match responses
      const { leads } = useLeadStore.getState();
      const contactedLeads = leads.filter(
        l => l.status === 'contacted' || l.status === 'dm_sent',
      );

      // Get existing conversations
      const { conversations } = useConversationStore.getState();

      // Process each message
      for (const message of result.data) {
        await this.processMessage(message, leads, conversations, user.uid);
      }

      console.log(`✅ [ResponseMonitor] Processed ${result.data.length} messages`);
    } catch (error) {
      console.error('🔴 [ResponseMonitor] Error checking responses:', error);
    }
  }

  /**
   * Process a single message and match it to leads/conversations
   */
  private async processMessage(
    message: RedditMessage,
    leads: Lead[],
    conversations: Conversation[],
    userId: string,
  ): Promise<void> {
    // Check if this is a DM response from a lead we contacted
    if (message.type === 'private_message') {
      const matchingLead = leads.find(
        lead => lead.post.author.toLowerCase() === message.author.toLowerCase(),
      );

      if (matchingLead) {
        console.log(`📬 [ResponseMonitor] Found DM response from lead: ${message.author}`);
        await this.handleLeadDMResponse(matchingLead, message, conversations, userId);
        return;
      }
    }

    // Check if this is a comment reply to our agent comment
    if (message.type === 'comment_reply') {
      // Find lead by matching the parent comment ID
      const matchingLead = leads.find(lead => {
        if (!lead.commentId) return false;
        // Reddit parent_id format: t1_commentId
        const parentId = message.parentId?.replace('t1_', '');
        return parentId === lead.commentId;
      });

      if (matchingLead) {
        console.log(`💬 [ResponseMonitor] Found comment reply from lead: ${message.author}`);
        await this.handleLeadCommentReply(matchingLead, message, userId);
        return;
      }
    }

    // Check if this is a DM we should track (even if not from a lead)
    if (message.type === 'private_message') {
      await this.handleGenericDM(message, userId);
    }
  }

  /**
   * Handle a DM response from a contacted lead
   */
  private async handleLeadDMResponse(
    lead: Lead,
    message: RedditMessage,
    conversations: Conversation[],
    userId: string,
  ): Promise<void> {
    // Update lead status to 'responded'
    useLeadStore.getState().updateLead(lead.id, {
      status: 'responded',
    });

    // Update in Firestore
    await BackendService.updateDocument('reddit_leads', lead.id, {
      status: 'responded',
      respondedAt: new Date(),
      lastResponseAt: new Date(),
      updatedAt: new Date(),
    });

    // Find or create conversation
    let conversation = conversations.find(c => c.leadId === lead.id);

    if (!conversation) {
      // Create new conversation
      conversation = {
        id: `conv_${Date.now()}`,
        leadId: lead.id,
        userId,
        recipientUsername: lead.post.author,
        platform: 'reddit',
        messages: [],
        hasUnread: true,
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      useConversationStore.getState().addConversation(conversation);
    }

    // Add the new message to conversation
    const newMessage: ConversationMessage = {
      id: `msg_${message.id}`,
      conversationId: conversation.id,
      content: message.body,
      isFromUser: false,
      createdAt: new Date(message.created * 1000),
    };

    useConversationStore.getState().addMessage(conversation.id, newMessage);

    // Create inbox notification
    await this.createResponseNotification(lead, message, userId, 'dm');

    // Mark message as read on Reddit
    await RedditAPIService.markMessageAsRead(message.id);
  }

  /**
   * Handle a comment reply from a lead
   */
  private async handleLeadCommentReply(
    lead: Lead,
    message: RedditMessage,
    userId: string,
  ): Promise<void> {
    // Update lead status to 'responded'
    useLeadStore.getState().updateLead(lead.id, {
      status: 'responded',
    });

    // Update in Firestore
    await BackendService.updateDocument('reddit_leads', lead.id, {
      status: 'responded',
      respondedAt: new Date(),
      lastResponseAt: new Date(),
      hasCommentReply: true,
      updatedAt: new Date(),
    });

    // Create inbox notification
    await this.createResponseNotification(lead, message, userId, 'comment');

    // Mark message as read on Reddit
    await RedditAPIService.markMessageAsRead(message.id);
  }

  /**
   * Handle a generic DM (not from a known lead)
   */
  private async handleGenericDM(message: RedditMessage, userId: string): Promise<void> {
    const workspaceId = useWorkspaceStore.getState().currentWorkspace?.id;
    if (!workspaceId) return;

    // Add to inbox as a Reddit message
    try {
      await useInboxStore.getState().addInboxItem({
        type: 'reddit_message',
        userId,
        title: `DM from u/${message.author}`,
        content: message.body,
        agentName: 'Reddit',
        status: 'pending',
        priority: 'medium',
        workspaceId,
        tags: ['reddit', 'dm', message.author],
        completed: false,
      });

      // Mark as read on Reddit
      await RedditAPIService.markMessageAsRead(message.id);
    } catch (error) {
      console.error('🔴 [ResponseMonitor] Error adding DM to inbox:', error);
    }
  }

  /**
   * Create a notification in the inbox when a lead responds
   */
  private async createResponseNotification(
    lead: Lead,
    message: RedditMessage,
    userId: string,
    responseType: 'dm' | 'comment',
  ): Promise<void> {
    const workspaceId = useWorkspaceStore.getState().currentWorkspace?.id;
    if (!workspaceId) return;

    try {
      await useInboxStore.getState().addInboxItem({
        type: 'reddit_message',
        userId,
        title: responseType === 'dm'
          ? `u/${lead.post.author} replied to your DM!`
          : `u/${lead.post.author} replied to your comment!`,
        content: message.body.slice(0, 200) + (message.body.length > 200 ? '...' : ''),
        agentName: 'Lead Response',
        status: 'pending',
        priority: 'urgent',
        workspaceId,
        tags: ['lead', 'response', responseType, lead.post.subreddit],
        completed: false,
        relatedLeadId: lead.id,
        post: {
          title: lead.post.title,
          content: lead.post.content,
          subreddit: lead.post.subreddit,
          postId: lead.post.id,
          url: lead.post.url,
        },
      });

      console.log(`✅ [ResponseMonitor] Created notification for lead response: ${lead.id}`);
    } catch (error) {
      console.error('🔴 [ResponseMonitor] Error creating notification:', error);
    }
  }

  /**
   * Force an immediate check (useful after sending a DM)
   */
  async forceCheck(): Promise<void> {
    await this.checkForResponses();
  }

  /**
   * Get monitoring status
   */
  isMonitoring(): boolean {
    return this.isRunning;
  }
}

export default new ResponseMonitoringService();
