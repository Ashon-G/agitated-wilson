/**
 * Firebase Cloud Function: Sync Reddit Lead to HubSpot
 *
 * Called when a qualified Reddit lead is found by the in-app hunting engine.
 * Creates or updates a HubSpot contact with Reddit lead data.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface SyncLeadRequest {
  userId: string;
  webhookToken: string;
  lead: {
    redditUsername: string;
    subreddit: string;
    postTitle: string;
    commentText: string;
    qualificationReason: string;
    leadScore?: number;
    email?: string;
  };
}

interface HubSpotIntegration {
  id: string;
  userId: string;
  type: 'hubspot';
  accessToken: string;
  refreshToken: string;
  expiresAt: admin.firestore.Timestamp;
  portalId: string;
  enabled: boolean;
}

interface HubSpotContact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    [key: string]: any;
  };
}

export const syncLeadToHubSpot = functions.https.onRequest(async (req, res) => {
  // Validate request method
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const { userId, webhookToken, lead } = req.body as SyncLeadRequest;

    // Validate required fields
    if (!userId || !webhookToken || !lead) {
      res.status(400).json({ error: 'Missing required fields: userId, webhookToken, lead' });
      return;
    }

    console.log('🔄 Syncing Reddit lead to HubSpot:', {
      userId,
      redditUsername: lead.redditUsername,
      hasEmail: !!lead.email,
    });

    // Get user's HubSpot integration
    const integrationsSnapshot = await admin
      .firestore()
      .collection(`users/${userId}/integrations`)
      .where('type', '==', 'hubspot')
      .where('enabled', '==', true)
      .limit(1)
      .get();

    if (integrationsSnapshot.empty) {
      console.log('⚠️ No HubSpot integration found for user:', userId);
      res.status(200).json({
        success: false,
        message: 'No HubSpot integration connected',
        skipped: true,
      });
      return;
    }

    const integration = integrationsSnapshot.docs[0].data() as HubSpotIntegration;

    // Check if token needs refresh
    const now = new Date();
    const expiresAt = integration.expiresAt.toDate();
    const { accessToken } = integration;

    if (expiresAt <= now) {
      console.log('🔄 Access token expired, refreshing...');
      // Token refresh would happen here - for now, return error
      res.status(200).json({
        success: false,
        message: 'HubSpot token expired, please reconnect',
        skipped: true,
      });
      return;
    }

    // Check if contact already exists by email
    let existingContact: HubSpotContact | null = null;
    if (lead.email) {
      existingContact = await searchContactByEmail(accessToken, lead.email);
    }

    if (existingContact) {
      console.log('✅ Contact exists, updating with new Reddit interaction');
      await updateContactWithRedditActivity(
        accessToken,
        existingContact.id,
        lead,
      );

      res.status(200).json({
        success: true,
        contactId: existingContact.id,
        action: 'updated',
      });
      return;
    }

    // Create new contact only if we have an email
    if (!lead.email) {
      console.log('⚠️ Cannot create HubSpot contact without email');
      res.status(200).json({
        success: false,
        message: 'Email required to create HubSpot contact',
        skipped: true,
      });
      return;
    }

    const newContact = await createHubSpotContact(accessToken, lead);

    // Add note with full context
    await addNoteToContact(accessToken, newContact.id, lead);

    console.log('✅ Created new HubSpot contact:', newContact.id);

    res.status(200).json({
      success: true,
      contactId: newContact.id,
      action: 'created',
    });
  } catch (error: any) {
    console.error('❌ Error syncing lead to HubSpot:', error);
    res.status(500).json({
      error: 'Failed to sync lead to HubSpot',
      details: error.message,
    });
  }
});

/**
 * Search for existing contact by email
 */
async function searchContactByEmail(
  accessToken: string,
  email: string,
): Promise<HubSpotContact | null> {
  try {
    const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
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

    if (!response.ok) {
      console.error('HubSpot search failed:', response.status);
      return null;
    }

    const data = await response.json();
    return data.results && data.results.length > 0 ? data.results[0] : null;
  } catch (error) {
    console.error('Error searching contact:', error);
    return null;
  }
}

/**
 * Create new HubSpot contact
 */
async function createHubSpotContact(
  accessToken: string,
  lead: SyncLeadRequest['lead'],
): Promise<HubSpotContact> {
  const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        email: lead.email,
        lifecyclestage: 'lead',
        hs_lead_status: 'NEW',
        reddit_username: lead.redditUsername,
        lead_source: 'Reddit',
        reddit_subreddit: lead.subreddit,
        hs_lead_score: lead.leadScore || 0,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create contact: ${response.status} - ${error}`);
  }

  return await response.json();
}

/**
 * Update existing contact with new Reddit activity
 */
async function updateContactWithRedditActivity(
  accessToken: string,
  contactId: string,
  lead: SyncLeadRequest['lead'],
): Promise<void> {
  // Add note about the new interaction
  await addNoteToContact(accessToken, contactId, lead);

  // Update contact properties
  await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        hs_lead_status: 'IN_PROGRESS',
        notes_last_updated: new Date().toISOString(),
        hs_lead_score: lead.leadScore || 0,
      },
    }),
  });
}

/**
 * Add note to HubSpot contact
 */
async function addNoteToContact(
  accessToken: string,
  contactId: string,
  lead: SyncLeadRequest['lead'],
): Promise<void> {
  const noteContent = `Reddit Lead - Qualified via AI Agent

Subreddit: r/${lead.subreddit}
Post: ${lead.postTitle}

Comment/Activity: ${lead.commentText}

Qualification Reason: ${lead.qualificationReason}

Lead Score: ${lead.leadScore || 'N/A'}

Source: Vibecode AI Sales Agent`;

  // Create note
  const noteResponse = await fetch('https://api.hubapi.com/crm/v3/objects/notes', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        hs_note_body: noteContent,
        hs_timestamp: new Date().toISOString(),
      },
    }),
  });

  if (!noteResponse.ok) {
    console.error('Failed to create note:', noteResponse.status);
    return;
  }

  const note = await noteResponse.json();

  // Associate note with contact
  await fetch(
    `https://api.hubapi.com/crm/v3/objects/notes/${note.id}/associations/contacts/${contactId}/note_to_contact`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );
}
