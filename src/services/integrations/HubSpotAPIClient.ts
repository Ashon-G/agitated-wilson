/**
 * HubSpot API Client
 * Wrapper for HubSpot API calls with automatic token refresh
 */

import { HubSpotIntegration, HubSpotContact, HubSpotDeal, HubSpotEngagement } from '../../types/integrations';
import HubSpotAuthService from './HubSpotAuthService';

class HubSpotAPIClient {
  private baseUrl = 'https://api.hubapi.com';

  /**
   * Make authenticated request to HubSpot API with automatic token refresh
   */
  private async makeRequest<T>(
    integration: HubSpotIntegration,
    endpoint: string,
    options: Record<string, any> = {},
  ): Promise<T> {
    // Check if token needs refresh
    const now = new Date();
    const expiresAt = integration.expiresAt instanceof Date
      ? integration.expiresAt
      : new Date(integration.expiresAt);

    let currentIntegration = integration;
    if (expiresAt <= now) {
      console.log('🔄 Token expired, refreshing...');
      currentIntegration = await HubSpotAuthService.refreshAccessToken(integration);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${currentIntegration.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HubSpot API error (${response.status}): ${error}`);
    }

    return await response.json();
  }

  /**
   * Get contacts from HubSpot
   */
  async getContacts(
    integration: HubSpotIntegration,
    options?: {
      limit?: number;
      after?: string;
      properties?: string[];
    },
  ): Promise<{
    results: HubSpotContact[];
    paging?: { next?: { after: string } };
  }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.after) params.append('after', options.after);
    if (options?.properties) {
      options.properties.forEach(prop => params.append('properties', prop));
    }

    const endpoint = `/crm/v3/objects/contacts?${params.toString()}`;
    return await this.makeRequest<any>(integration, endpoint);
  }

  /**
   * Search contacts by email
   */
  async searchContactsByEmail(
    integration: HubSpotIntegration,
    email: string,
  ): Promise<HubSpotContact[]> {
    const endpoint = '/crm/v3/objects/contacts/search';
    const response = await this.makeRequest<any>(integration, endpoint, {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'email',
                operator: 'EQ',
                value: email,
              },
            ],
          },
        ],
      }),
    });

    return response.results || [];
  }

  /**
   * Create a new contact in HubSpot
   */
  async createContact(
    integration: HubSpotIntegration,
    contactData: {
      email: string;
      firstname?: string;
      lastname?: string;
      company?: string;
      jobtitle?: string;
      lifecyclestage?: string;
      hs_lead_status?: string;
      [key: string]: any;
    },
  ): Promise<HubSpotContact> {
    const endpoint = '/crm/v3/objects/contacts';
    return await this.makeRequest<HubSpotContact>(integration, endpoint, {
      method: 'POST',
      body: JSON.stringify({
        properties: contactData,
      }),
    });
  }

  /**
   * Update an existing contact
   */
  async updateContact(
    integration: HubSpotIntegration,
    contactId: string,
    updates: Record<string, any>,
  ): Promise<HubSpotContact> {
    const endpoint = `/crm/v3/objects/contacts/${contactId}`;
    return await this.makeRequest<HubSpotContact>(integration, endpoint, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: updates,
      }),
    });
  }

  /**
   * Get deals from HubSpot
   */
  async getDeals(
    integration: HubSpotIntegration,
    options?: {
      limit?: number;
      after?: string;
      properties?: string[];
    },
  ): Promise<{
    results: HubSpotDeal[];
    paging?: { next?: { after: string } };
  }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.after) params.append('after', options.after);
    if (options?.properties) {
      options.properties.forEach(prop => params.append('properties', prop));
    }

    const endpoint = `/crm/v3/objects/deals?${params.toString()}`;
    return await this.makeRequest<any>(integration, endpoint);
  }

  /**
   * Get closed-won deals for ICP analysis
   */
  async getClosedWonDeals(
    integration: HubSpotIntegration,
    daysBack: number = 90,
  ): Promise<HubSpotDeal[]> {
    const endpoint = '/crm/v3/objects/deals/search';
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const response = await this.makeRequest<any>(integration, endpoint, {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'dealstage',
                operator: 'EQ',
                value: 'closedwon',
              },
              {
                propertyName: 'closedate',
                operator: 'GTE',
                value: cutoffDate.getTime().toString(),
              },
            ],
          },
        ],
        properties: [
          'dealname',
          'dealstage',
          'amount',
          'closedate',
          'pipeline',
          'createdate',
          'hs_object_id',
        ],
        limit: 100,
      }),
    });

    return response.results || [];
  }

  /**
   * Create a timeline event (engagement) in HubSpot
   */
  async createTimelineEvent(
    integration: HubSpotIntegration,
    eventData: {
      eventTemplateId: string;
      email: string;
      tokens: Record<string, string>;
      extraData?: Record<string, any>;
    },
  ): Promise<void> {
    const endpoint = '/crm/v3/timeline/events';
    await this.makeRequest(integration, endpoint, {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  }

  /**
   * Add a note to a contact
   */
  async addNoteToContact(
    integration: HubSpotIntegration,
    contactId: string,
    noteContent: string,
  ): Promise<void> {
    const endpoint = '/crm/v3/objects/notes';
    const note = await this.makeRequest<any>(integration, endpoint, {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          hs_note_body: noteContent,
          hs_timestamp: new Date().toISOString(),
        },
      }),
    });

    // Associate note with contact
    const associationEndpoint = `/crm/v3/objects/notes/${note.id}/associations/contacts/${contactId}/note_to_contact`;
    await this.makeRequest(integration, associationEndpoint, {
      method: 'PUT',
    });
  }

  /**
   * Get contact's associated deals
   */
  async getContactDeals(
    integration: HubSpotIntegration,
    contactId: string,
  ): Promise<HubSpotDeal[]> {
    const endpoint = `/crm/v3/objects/contacts/${contactId}/associations/deals`;
    const response = await this.makeRequest<any>(integration, endpoint);

    if (!response.results || response.results.length === 0) {
      return [];
    }

    // Fetch full deal details
    const dealIds = response.results.map((r: any) => r.id);
    const deals: HubSpotDeal[] = [];

    for (const dealId of dealIds) {
      const deal = await this.makeRequest<HubSpotDeal>(
        integration,
        `/crm/v3/objects/deals/${dealId}`,
      );
      deals.push(deal);
    }

    return deals;
  }

  /**
   * Get all engagements (notes, emails, calls) for a contact
   */
  async getContactEngagements(
    integration: HubSpotIntegration,
    contactId: string,
  ): Promise<HubSpotEngagement[]> {
    const engagements: HubSpotEngagement[] = [];

    // Get notes
    const notesEndpoint = `/crm/v3/objects/contacts/${contactId}/associations/notes`;
    const notesResponse = await this.makeRequest<any>(integration, notesEndpoint);

    if (notesResponse.results) {
      for (const noteAssoc of notesResponse.results) {
        const note = await this.makeRequest<any>(
          integration,
          `/crm/v3/objects/notes/${noteAssoc.id}`,
        );
        engagements.push({
          id: note.id,
          type: 'NOTE',
          timestamp: new Date(note.properties.hs_timestamp),
          body: note.properties.hs_note_body,
        });
      }
    }

    return engagements;
  }

  /**
   * Get contact properties schema
   */
  async getContactProperties(
    integration: HubSpotIntegration,
  ): Promise<any[]> {
    const endpoint = '/crm/v3/properties/contacts';
    const response = await this.makeRequest<any>(integration, endpoint);
    return response.results || [];
  }

  /**
   * Create custom contact property
   */
  async createContactProperty(
    integration: HubSpotIntegration,
    propertyData: {
      name: string;
      label: string;
      type: 'string' | 'number' | 'date' | 'enumeration' | 'bool';
      fieldType: 'text' | 'textarea' | 'number' | 'select' | 'checkbox';
      groupName: string;
      description?: string;
      options?: Array<{ label: string; value: string }>;
    },
  ): Promise<any> {
    const endpoint = '/crm/v3/properties/contacts';
    return await this.makeRequest(integration, endpoint, {
      method: 'POST',
      body: JSON.stringify(propertyData),
    });
  }

  /**
   * Batch update contacts
   */
  async batchUpdateContacts(
    integration: HubSpotIntegration,
    updates: Array<{ id: string; properties: Record<string, any> }>,
  ): Promise<void> {
    const endpoint = '/crm/v3/objects/contacts/batch/update';
    await this.makeRequest(integration, endpoint, {
      method: 'POST',
      body: JSON.stringify({ inputs: updates }),
    });
  }
}

export default new HubSpotAPIClient();
