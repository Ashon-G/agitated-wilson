/**
 * Qualified Lead Tracking Service
 * Detects and records when leads meet billing criteria
 */

import BackendService from './BackendService';
import { COLLECTIONS } from '../config/firebase';
import {
  QualifiedLeadEvent,
  QualificationType,
  BillingCycle,
  LinkClickEvent,
  BillingEvent,
} from '../types/billing';
import { Lead } from '../types/agent';

class QualifiedLeadTrackingService {
  private cache = new Map<string, boolean>(); // leadId -> already tracked
  private readonly PRICE_PER_LEAD = 500; // $5.00 in cents

  /**
   * Track a lead qualification event for billing
   */
  async trackLeadQualification(
    userId: string,
    leadId: string,
    agentId: string,
    qualificationType: QualificationType,
    metadata?: {
      postTitle?: string;
      subreddit?: string;
      qualificationScore?: number;
      conversationId?: string;
      linkUrl?: string;
      leadName?: string;
      platform?: string;
    },
  ): Promise<QualifiedLeadEvent | null> {
    try {
      // Check cache first to prevent double-billing
      const cacheKey = `${userId}_${leadId}`;
      if (this.cache.has(cacheKey)) {
        console.log(`Lead ${leadId} already tracked for billing`);
        return null;
      }

      // Check if already tracked in database
      const existing = await this.getExistingQualification(userId, leadId);
      if (existing) {
        console.log(`Lead ${leadId} already has qualification event: ${existing.id}`);
        this.cache.set(cacheKey, true);
        return existing;
      }

      // Get or create active billing cycle
      const billingCycle = await this.getOrCreateActiveCycle(userId);

      // Create qualified lead event
      const qualifiedEvent: Omit<QualifiedLeadEvent, 'id'> & { userId: string } = {
        userId,
        leadId,
        agentId,
        qualifiedAt: new Date(),
        qualificationType,
        billingStatus: 'unbilled',
        billingCycleId: billingCycle.id,
        platform: metadata?.platform || 'reddit',
        leadName: metadata?.leadName,
        leadContext: metadata?.postTitle,
        metadata: {
          postTitle: metadata?.postTitle,
          subreddit: metadata?.subreddit,
          qualificationScore: metadata?.qualificationScore,
          conversationId: metadata?.conversationId,
          linkUrl: metadata?.linkUrl,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const created = await BackendService.createDocument<QualifiedLeadEvent>(
        COLLECTIONS.QUALIFIED_LEAD_EVENTS,
        qualifiedEvent,
      );

      // Update billing cycle counters
      await this.incrementCycleCounters(billingCycle.id, qualificationType);

      // Create billing event for audit log
      await this.createBillingEvent(userId, 'lead_qualified', {
        leadId,
        qualificationType,
        billingCycleId: billingCycle.id,
      });

      // Update cache
      this.cache.set(cacheKey, true);

      console.log(`✅ Lead ${leadId} qualified for billing: ${qualificationType}`);
      return created;
    } catch (error) {
      console.error('Failed to track lead qualification:', error);
      throw error;
    }
  }

  /**
   * Mark lead as having expressed interest (replied to agent)
   */
  async markLeadAsExpressedInterest(
    userId: string,
    leadId: string,
    agentId: string,
    conversationId?: string,
  ): Promise<QualifiedLeadEvent | null> {
    try {
      // Get lead to check conversation history
      const lead = await this.getLead(leadId);
      if (!lead) {
        console.warn(`Lead ${leadId} not found`);
        return null;
      }

      // Verify lead has responded (at least one message from lead)
      const hasResponded = await this.verifyLeadResponse(conversationId || '');
      if (!hasResponded) {
        console.log(`Lead ${leadId} has not responded yet`);
        return null;
      }

      return await this.trackLeadQualification(userId, leadId, agentId, 'interest_expressed', {
        conversationId,
        leadName: lead.contact.name || lead.contact.username,
        platform: lead.source.platform,
      });
    } catch (error) {
      console.error('Failed to mark lead as expressed interest:', error);
      return null;
    }
  }

  /**
   * Mark lead as matching target audience (high qualification score)
   */
  async markLeadAsTargetMatch(
    userId: string,
    leadId: string,
    agentId: string,
    qualificationScore: number,
    metadata?: Record<string, any>,
  ): Promise<QualifiedLeadEvent | null> {
    try {
      const lead = await this.getLead(leadId);
      if (!lead) {
        console.warn(`Lead ${leadId} not found`);
        return null;
      }

      return await this.trackLeadQualification(userId, leadId, agentId, 'target_match', {
        qualificationScore,
        leadName: lead.contact.name || lead.contact.username,
        platform: lead.source.platform,
        postTitle: metadata?.postTitle,
        subreddit: metadata?.subreddit,
      });
    } catch (error) {
      console.error('Failed to mark lead as target match:', error);
      return null;
    }
  }

  /**
   * Track link click and potentially qualify lead
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
  ): Promise<LinkClickEvent> {
    try {
      // Get lead to extract userId and agentId
      const lead = await this.getLead(leadId);
      if (!lead) {
        throw new Error(`Lead ${leadId} not found`);
      }

      // Create link click event
      const clickEvent: Omit<LinkClickEvent, 'id'> & { userId: string } = {
        userId: lead.userId,
        leadId,
        agentId: lead.agentId,
        url,
        trackingUrl,
        clickedAt: new Date(),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        referrer: metadata.referrer,
        tracked: false,
        createdAt: new Date(),
      };

      const created = await BackendService.createDocument<LinkClickEvent>(
        COLLECTIONS.LINK_CLICK_EVENTS,
        clickEvent,
      );

      // Check if lead already qualified
      const existing = await this.getExistingQualification(lead.userId, leadId);
      if (!existing) {
        // Qualify lead based on link click
        const qualifiedEvent = await this.trackLeadQualification(
          lead.userId,
          leadId,
          lead.agentId,
          'link_clicked',
          {
            linkUrl: url,
            leadName: lead.contact.name || lead.contact.username,
            platform: lead.source.platform,
          },
        );

        // Update click event with qualification reference
        if (qualifiedEvent) {
          await BackendService.updateDocument<LinkClickEvent>(
            COLLECTIONS.LINK_CLICK_EVENTS,
            created.id,
            {
              tracked: true,
              qualifiedLeadEventId: qualifiedEvent.id,
            },
          );
        }
      }

      console.log(`✅ Link click tracked for lead ${leadId}`);
      return created;
    } catch (error) {
      console.error('Failed to track link click:', error);
      throw error;
    }
  }

  /**
   * Get qualified leads for a billing cycle
   */
  async getQualifiedLeadsForCycle(
    userId: string,
    billingCycleId: string,
  ): Promise<QualifiedLeadEvent[]> {
    try {
      const events = await BackendService.queryCollection<QualifiedLeadEvent>(
        COLLECTIONS.QUALIFIED_LEAD_EVENTS,
        {
          where: [
            { field: 'userId', operator: '==', value: userId },
            { field: 'billingCycleId', operator: '==', value: billingCycleId },
            { field: 'billingStatus', operator: '==', value: 'unbilled' },
          ],
          orderBy: { field: 'qualifiedAt', direction: 'asc' },
        },
      );

      return events;
    } catch (error) {
      console.error('Failed to get qualified leads for cycle:', error);
      return [];
    }
  }

  /**
   * Check if user has unbilled leads
   */
  async hasUnbilledLeads(userId: string): Promise<boolean> {
    try {
      const events = await BackendService.queryCollection<QualifiedLeadEvent>(
        COLLECTIONS.QUALIFIED_LEAD_EVENTS,
        {
          where: [
            { field: 'userId', operator: '==', value: userId },
            { field: 'billingStatus', operator: '==', value: 'unbilled' },
          ],
          limit: 1,
        },
      );

      return events.length > 0;
    } catch (error) {
      console.error('Failed to check unbilled leads:', error);
      return false;
    }
  }

  /**
   * Mark leads as invoiced
   */
  async markLeadsAsInvoiced(eventIds: string[], invoiceId: string): Promise<void> {
    try {
      for (const eventId of eventIds) {
        await BackendService.updateDocument<QualifiedLeadEvent>(
          COLLECTIONS.QUALIFIED_LEAD_EVENTS,
          eventId,
          {
            billingStatus: 'invoiced',
            invoiceId,
            updatedAt: new Date(),
          },
        );
      }

      console.log(`✅ Marked ${eventIds.length} leads as invoiced`);
    } catch (error) {
      console.error('Failed to mark leads as invoiced:', error);
      throw error;
    }
  }

  // Helper methods

  private async getExistingQualification(
    userId: string,
    leadId: string,
  ): Promise<QualifiedLeadEvent | null> {
    const events = await BackendService.queryCollection<QualifiedLeadEvent>(
      COLLECTIONS.QUALIFIED_LEAD_EVENTS,
      {
        where: [
          { field: 'userId', operator: '==', value: userId },
          { field: 'leadId', operator: '==', value: leadId },
        ],
        limit: 1,
      },
    );

    return events.length > 0 ? events[0] : null;
  }

  private async getLead(leadId: string): Promise<Lead | null> {
    try {
      return await BackendService.getDocument<Lead>(COLLECTIONS.LEADS, leadId);
    } catch (error) {
      console.error(`Failed to get lead ${leadId}:`, error);
      return null;
    }
  }

  private async verifyLeadResponse(conversationId: string): Promise<boolean> {
    if (!conversationId) return false;

    try {
      // Check for messages from lead in conversation
      const messages = await BackendService.queryCollection(COLLECTIONS.CONVERSATION_MESSAGES, {
        where: [
          { field: 'conversationId', operator: '==', value: conversationId },
          { field: 'type', operator: '==', value: 'lead' },
        ],
        limit: 1,
      });

      return messages.length > 0;
    } catch (error) {
      console.error('Failed to verify lead response:', error);
      return false;
    }
  }

  private async getOrCreateActiveCycle(userId: string): Promise<any> {
    // Billing removed - return stub
    return null;
  }

  private async incrementCycleCounters(
    cycleId: string,
    qualificationType: QualificationType,
  ): Promise<void> {
    // Billing removed - method disabled

  }

  private async createBillingEvent(
    userId: string,
    type: BillingEvent['type'],
    data: Record<string, any>,
  ): Promise<void> {
    try {
      const event: Omit<BillingEvent, 'id'> & { userId: string } = {
        userId,
        type,
        data,
        timestamp: new Date(),
      };

      await BackendService.createDocument<BillingEvent>(COLLECTIONS.BILLING_EVENTS, event);
    } catch (error) {
      console.error('Failed to create billing event:', error);
      // Don't throw - event logging is not critical
    }
  }
}

export default new QualifiedLeadTrackingService();
