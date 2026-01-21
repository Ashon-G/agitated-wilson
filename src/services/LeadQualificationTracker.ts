/**
 * Lead Qualification Tracker
 * Automatically tracks qualified leads for billing across the entire sales flow
 */

import QualifiedLeadTrackingService from './QualifiedLeadTrackingService';
import BackendService from './BackendService';
import { COLLECTIONS } from '../config/firebase';
import { Lead, Conversation } from '../types/agent';

class LeadQualificationTracker {
  /**
   * Track lead when it reaches high qualification score (60+)
   */
  async trackLeadQualification(lead: Lead): Promise<void> {
    try {
      // Check if lead meets target audience criteria (score >= 60)
      if (lead.qualification.score >= 60) {
        await QualifiedLeadTrackingService.markLeadAsTargetMatch(
          lead.userId,
          lead.id,
          lead.agentId,
          lead.qualification.score,
          {
            postTitle: lead.source.context,
            subreddit: this.extractSubreddit(lead.source.referenceUrl),
            platform: lead.source.platform,
          },
        );

        console.log(`✅ Tracked lead ${lead.id} as target match (score: ${lead.qualification.score})`);
      }
    } catch (error) {
      console.error('Failed to track lead qualification:', error);
      // Don't throw - tracking failure should not break lead processing
    }
  }

  /**
   * Track when lead responds in conversation
   */
  async trackLeadResponse(
    userId: string,
    leadId: string,
    agentId: string,
    conversationId: string,
  ): Promise<void> {
    try {
      await QualifiedLeadTrackingService.markLeadAsExpressedInterest(
        userId,
        leadId,
        agentId,
        conversationId,
      );

      console.log(`✅ Tracked lead ${leadId} as expressed interest`);
    } catch (error) {
      console.error('Failed to track lead response:', error);
      // Don't throw - tracking failure should not break conversation
    }
  }

  /**
   * Track link click from lead
   * This should be called from a link tracking endpoint/webhook
   */
  async trackLinkClick(
    leadId: string,
    url: string,
    trackingUrl: string,
    metadata: {
      ipAddress?: string;
      userAgent?: string;
      referrer?: string;
    },
  ): Promise<void> {
    try {
      await QualifiedLeadTrackingService.trackLinkClick(
        leadId,
        url,
        trackingUrl,
        metadata,
      );

      console.log(`✅ Tracked link click for lead ${leadId}`);
    } catch (error) {
      console.error('Failed to track link click:', error);
      // Don't throw - tracking failure should not break link redirect
    }
  }

  /**
   * Check and track conversation for lead response
   */
  async checkConversationForResponse(conversation: Conversation): Promise<void> {
    try {
      // Get messages from conversation
      const messages = await BackendService.queryCollection<any>(
        COLLECTIONS.CONVERSATION_MESSAGES,
        {
          where: [
            { field: 'conversationId', operator: '==', value: conversation.id },
            { field: 'sender', operator: '==', value: 'lead' },
          ],
          limit: 1,
        },
      );

      // If lead has responded, track it
      if (messages.length > 0) {
        const lead = await BackendService.getDocument<Lead>(
          COLLECTIONS.LEADS,
          conversation.leadId,
        );

        if (lead) {
          await this.trackLeadResponse(
            lead.userId,
            lead.id,
            lead.agentId,
            conversation.id,
          );
        }
      }
    } catch (error) {
      console.error('Failed to check conversation for response:', error);
      // Don't throw
    }
  }

  /**
   * Auto-track qualified leads in batch
   * Used for retroactive tracking or scheduled checks
   */
  async autoTrackQualifiedLeads(userId: string): Promise<{
    tracked: number;
    skipped: number;
  }> {
    try {
      console.log(`🔄 Auto-tracking qualified leads for user ${userId}...`);

      // Get all leads with high scores that haven't been tracked
      const leads = await BackendService.queryCollection<Lead>(
        COLLECTIONS.LEADS,
        {
          where: [
            { field: 'userId', operator: '==', value: userId },
            { field: 'qualification.score', operator: '>=', value: 60 },
          ],
        },
      );

      let tracked = 0;
      let skipped = 0;

      for (const lead of leads) {
        try {
          // Check if already tracked
          const existing = await QualifiedLeadTrackingService.getQualifiedLeadsForCycle(
            userId,
            '', // Will check all cycles
          );

          const alreadyTracked = existing.some(e => e.leadId === lead.id);

          if (!alreadyTracked) {
            await this.trackLeadQualification(lead);
            tracked++;
          } else {
            skipped++;
          }
        } catch (error) {
          console.error(`Failed to auto-track lead ${lead.id}:`, error);
          skipped++;
        }
      }

      console.log(`✅ Auto-tracking complete: ${tracked} tracked, ${skipped} skipped`);

      return { tracked, skipped };
    } catch (error) {
      console.error('Failed to auto-track qualified leads:', error);
      return { tracked: 0, skipped: 0 };
    }
  }

  // Helper methods

  private extractSubreddit(referenceUrl?: string): string | undefined {
    if (!referenceUrl) return undefined;

    const match = referenceUrl.match(/r\/([a-zA-Z0-9_]+)/);
    return match ? match[1] : undefined;
  }
}

export default new LeadQualificationTracker();
