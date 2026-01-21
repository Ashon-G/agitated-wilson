/**
 * HubSpot Knowledge Service
 * Analyzes HubSpot data to build ICP profiles, engagement patterns, and enrich leads
 */

import {
  HubSpotIntegration,
  HubSpotContact,
  HubSpotDeal,
  ICPProfile,
  EngagementPattern,
  HubSpotInsights,
  IntegrationSyncStats,
} from '../../types/integrations';
import HubSpotAPIClient from './HubSpotAPIClient';
import HubSpotAuthService from './HubSpotAuthService';
import BackendService from '../BackendService';
import AuthenticationService from '../AuthenticationService';

class HubSpotKnowledgeService {
  /**
   * Analyze closed deals to build ICP profile
   */
  async analyzeICP(integration: HubSpotIntegration): Promise<ICPProfile> {
    console.log('📊 Analyzing ICP from HubSpot data...');

    const { settings } = integration;
    const daysBack = settings.filters.dealDaysBack || 90;

    // Get closed-won deals
    const deals = await HubSpotAPIClient.getClosedWonDeals(integration, daysBack);

    if (deals.length === 0) {
      console.log('⚠️ No closed-won deals found for ICP analysis');
      return this.getEmptyICPProfile();
    }

    // Fetch contacts associated with these deals
    const contactData: HubSpotContact[] = [];
    for (const deal of deals) {
      try {
        const contacts = await this.getContactsForDeal(integration, deal.id);
        contactData.push(...contacts);
      } catch (error) {
        console.error(`Failed to get contacts for deal ${deal.id}:`, error);
      }
    }

    // Analyze job titles
    const jobTitleMap = new Map<string, number>();
    contactData.forEach(contact => {
      const title = contact.jobtitle || contact.properties?.jobtitle;
      if (title) {
        jobTitleMap.set(title, (jobTitleMap.get(title) || 0) + 1);
      }
    });

    // Analyze industries
    const industryMap = new Map<string, number>();
    contactData.forEach(contact => {
      const industry = contact.company || contact.properties?.industry;
      if (industry) {
        industryMap.set(industry, (industryMap.get(industry) || 0) + 1);
      }
    });

    // Calculate average deal size
    const dealAmounts = deals
      .map(d => d.amount || d.properties?.amount)
      .filter(amount => amount !== null && amount !== undefined && !isNaN(Number(amount)))
      .map(amount => Number(amount));

    const avgDealSize = dealAmounts.length > 0
      ? dealAmounts.reduce((a, b) => a + b, 0) / dealAmounts.length
      : 0;

    // Calculate average time to close
    const closeTimes = deals
      .filter(d => d.createdate && d.closedate)
      .map(d => {
        const created = new Date(d.createdate!).getTime();
        const closed = new Date(d.closedate!).getTime();
        return (closed - created) / (1000 * 60 * 60 * 24); // Days
      });

    const avgTimeToClose = closeTimes.length > 0
      ? closeTimes.reduce((a, b) => a + b, 0) / closeTimes.length
      : 0;

    // Build common traits
    const commonTraits: string[] = [];
    if (jobTitleMap.size > 0) {
      const topTitle = Array.from(jobTitleMap.entries())
        .sort((a, b) => b[1] - a[1])[0];
      commonTraits.push(`Most common title: ${topTitle[0]}`);
    }
    if (industryMap.size > 0) {
      const topIndustry = Array.from(industryMap.entries())
        .sort((a, b) => b[1] - a[1])[0];
      commonTraits.push(`Most common industry: ${topIndustry[0]}`);
    }

    const profile: ICPProfile = {
      jobTitles: Array.from(jobTitleMap.entries())
        .map(([title, frequency]) => ({ title, frequency }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10),
      industries: Array.from(industryMap.entries())
        .map(([industry, frequency]) => ({ industry, frequency }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10),
      companySizes: [], // Would need company size data
      technologies: [], // Would need tech stack data
      avgDealSize,
      avgTimeToClose,
      commonTraits,
      updatedAt: new Date(),
    };

    console.log('✅ ICP analysis complete:', {
      jobTitles: profile.jobTitles.length,
      industries: profile.industries.length,
      avgDealSize: profile.avgDealSize,
      avgTimeToClose: profile.avgTimeToClose,
    });

    return profile;
  }

  /**
   * Analyze engagement patterns from HubSpot interactions
   */
  async analyzeEngagementPatterns(integration: HubSpotIntegration): Promise<EngagementPattern[]> {
    console.log('📈 Analyzing engagement patterns...');

    // Get recent contacts with high engagement
    const contacts = await HubSpotAPIClient.getContacts(integration, {
      limit: 100,
      properties: ['email', 'lifecyclestage', 'hs_lead_status', 'notes_last_updated'],
    });

    const patterns: EngagementPattern[] = [];

    // Analyze note patterns (simplified - would need more data in production)
    for (const contact of contacts.results) {
      try {
        const engagements = await HubSpotAPIClient.getContactEngagements(integration, contact.id);

        if (engagements.length > 0) {
          // Group by topic/type
          const noteEngagements = engagements.filter(e => e.type === 'NOTE');
          if (noteEngagements.length > 0) {
            // This is simplified - in production, would use NLP to extract topics
            patterns.push({
              messageType: 'note',
              topic: 'general_outreach',
              responseRate: 0.5, // Would calculate from actual responses
              avgTimeToResponse: 24, // Hours
              conversionRate: 0.2,
              examples: noteEngagements.slice(0, 3).map(e => e.body || '').filter(Boolean),
              updatedAt: new Date(),
            });
          }
        }
      } catch (error) {
        console.error(`Failed to analyze engagement for contact ${contact.id}:`, error);
      }
    }

    console.log(`✅ Found ${patterns.length} engagement patterns`);
    return patterns;
  }

  /**
   * Check if a Reddit lead already exists in HubSpot
   */
  async findExistingContact(
    integration: HubSpotIntegration,
    email: string,
  ): Promise<HubSpotContact | null> {
    try {
      const contacts = await HubSpotAPIClient.searchContactsByEmail(integration, email);
      return contacts.length > 0 ? contacts[0] : null;
    } catch (error) {
      console.error('Failed to search for existing contact:', error);
      return null;
    }
  }

  /**
   * Sync a new lead to HubSpot
   */
  async syncLeadToHubSpot(
    integration: HubSpotIntegration,
    leadData: {
      email?: string;
      redditUsername: string;
      subreddit: string;
      postTitle: string;
      commentText: string;
      qualificationReason: string;
      leadScore?: number;
    },
  ): Promise<HubSpotContact | null> {
    try {
      console.log('📤 Syncing lead to HubSpot:', leadData.redditUsername);

      // Check if already exists
      if (leadData.email) {
        const existing = await this.findExistingContact(integration, leadData.email);
        if (existing) {
          console.log('✅ Contact already exists, updating...');
          return await this.updateLeadInHubSpot(integration, existing.id, leadData);
        }
      }

      // Create new contact
      const contactData: {
        email?: string;
        lifecyclestage: string;
        hs_lead_status: string;
        reddit_username: string;
        lead_source: string;
        reddit_subreddit: string;
        [key: string]: any;
      } = {
        lifecyclestage: 'lead',
        hs_lead_status: 'NEW',
        reddit_username: leadData.redditUsername,
        lead_source: 'Reddit',
        reddit_subreddit: leadData.subreddit,
      };

      if (leadData.email) {
        contactData.email = leadData.email;
      }

      // Only create contact if we have an email (HubSpot requires it)
      if (!contactData.email) {
        console.log('⚠️ Cannot create HubSpot contact without email');
        return null;
      }

      const contact = await HubSpotAPIClient.createContact(integration, contactData as any);

      // Add a note with qualification details
      const noteContent = `Reddit Lead - Qualified via AI Agent

Subreddit: r/${leadData.subreddit}
Post: ${leadData.postTitle}

Comment: ${leadData.commentText}

Qualification Reason: ${leadData.qualificationReason}

Lead Score: ${leadData.leadScore || 'N/A'}

Source: Vibecode AI Sales Agent`;

      await HubSpotAPIClient.addNoteToContact(integration, contact.id, noteContent);

      console.log('✅ Lead synced to HubSpot:', contact.id);
      return contact;
    } catch (error) {
      console.error('❌ Failed to sync lead to HubSpot:', error);
      return null;
    }
  }

  /**
   * Update existing lead in HubSpot
   */
  async updateLeadInHubSpot(
    integration: HubSpotIntegration,
    contactId: string,
    updates: {
      subreddit?: string;
      postTitle?: string;
      commentText?: string;
      qualificationReason?: string;
      leadScore?: number;
    },
  ): Promise<HubSpotContact> {
    // Add a new note for the interaction
    const noteContent = `New Reddit Interaction

Subreddit: r/${updates.subreddit || 'Unknown'}
Post: ${updates.postTitle || 'N/A'}

Comment: ${updates.commentText || 'N/A'}

Qualification: ${updates.qualificationReason || 'N/A'}

Source: Vibecode AI Sales Agent`;

    await HubSpotAPIClient.addNoteToContact(integration, contactId, noteContent);

    // Update properties
    const propertyUpdates: Record<string, any> = {
      hs_lead_status: 'IN_PROGRESS',
      notes_last_updated: new Date().toISOString(),
    };

    if (updates.leadScore) {
      propertyUpdates.hs_lead_score = updates.leadScore;
    }

    return await HubSpotAPIClient.updateContact(integration, contactId, propertyUpdates);
  }

  /**
   * Get insights summary from HubSpot
   */
  async getInsights(integration: HubSpotIntegration): Promise<HubSpotInsights> {
    console.log('📊 Fetching HubSpot insights...');

    // Get contacts count
    const contactsResponse = await HubSpotAPIClient.getContacts(integration, { limit: 1 });
    const totalContacts = contactsResponse.paging?.next ? 100 : contactsResponse.results.length;

    // Get deals data
    const dealsResponse = await HubSpotAPIClient.getDeals(integration, { limit: 100 });
    const deals = dealsResponse.results;

    const closedWonDeals = deals.filter(d => d.dealstage === 'closedwon').length;

    const dealAmounts = deals
      .filter(d => d.amount !== null && d.amount !== undefined)
      .map(d => Number(d.amount));

    const avgDealSize = dealAmounts.length > 0
      ? dealAmounts.reduce((a, b) => a + b, 0) / dealAmounts.length
      : 0;

    return {
      totalContacts,
      totalDeals: deals.length,
      closedWonDeals,
      avgDealSize,
      topIndustries: [],
      topJobTitles: [],
      avgTimeToClose: 0,
      engagementRate: 0,
      lastUpdated: new Date(),
    };
  }

  /**
   * Perform full sync from HubSpot to knowledge base
   */
  async performFullSync(integration: HubSpotIntegration): Promise<IntegrationSyncStats> {
    console.log('🔄 Starting full HubSpot sync...');
    const startTime = Date.now();

    const stats: IntegrationSyncStats = {
      contactsCreated: 0,
      contactsUpdated: 0,
      engagementsSynced: 0,
      dealsCreated: 0,
      insightsPulled: 0,
      lastSyncDuration: 0,
      failedSyncs: 0,
    };

    try {
      // Analyze ICP
      const icpProfile = await this.analyzeICP(integration);

      // Analyze engagement patterns
      const engagementPatterns = await this.analyzeEngagementPatterns(integration);

      // Get general insights
      const insights = await this.getInsights(integration);

      // Save to knowledge base
      const user = AuthenticationService.getCurrentUser();
      if (user) {
        await BackendService.createDocument(
          `users/${user.uid}/integrations/${integration.id}/insights`,
          {
            userId: user.uid,
            icpProfile,
            engagementPatterns,
            insights,
            syncedAt: new Date(),
          } as any,
        );

        stats.insightsPulled = 1;
      }

      stats.lastSyncDuration = Date.now() - startTime;

      // Update integration sync status
      await BackendService.updateDocument(
        `users/${user?.uid}/integrations`,
        integration.id,
        {
          lastSyncAt: new Date(),
          syncStatus: 'active',
        } as any,
      );

      console.log('✅ Full sync complete:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Full sync failed:', error);
      stats.failedSyncs = 1;
      stats.lastSyncDuration = Date.now() - startTime;

      // Update integration with error
      const user = AuthenticationService.getCurrentUser();
      if (user) {
        await BackendService.updateDocument(
          `users/${user.uid}/integrations`,
          integration.id,
          {
            syncStatus: 'error',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          } as any,
        );
      }

      return stats;
    }
  }

  /**
   * Get contacts for a specific deal
   */
  private async getContactsForDeal(
    integration: HubSpotIntegration,
    dealId: string,
  ): Promise<HubSpotContact[]> {
    const endpoint = `/crm/v3/objects/deals/${dealId}/associations/contacts`;
    const response = await HubSpotAPIClient['makeRequest']<any>(integration, endpoint);

    if (!response.results || response.results.length === 0) {
      return [];
    }

    // Fetch full contact details
    const contacts: HubSpotContact[] = [];
    for (const contactAssoc of response.results) {
      try {
        const contactEndpoint = `/crm/v3/objects/contacts/${contactAssoc.id}`;
        const contact = await HubSpotAPIClient['makeRequest']<HubSpotContact>(
          integration,
          contactEndpoint,
        );
        contacts.push(contact);
      } catch (error) {
        console.error(`Failed to fetch contact ${contactAssoc.id}:`, error);
      }
    }

    return contacts;
  }

  /**
   * Get empty ICP profile
   */
  private getEmptyICPProfile(): ICPProfile {
    return {
      jobTitles: [],
      industries: [],
      companySizes: [],
      technologies: [],
      avgDealSize: 0,
      avgTimeToClose: 0,
      commonTraits: [],
      updatedAt: new Date(),
    };
  }
}

export default new HubSpotKnowledgeService();
