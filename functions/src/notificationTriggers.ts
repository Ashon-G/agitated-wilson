/**
 * Firestore Triggers for Push Notifications
 * Automatically sends push notifications when important events occur
 */

import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { pushNotificationService } from './pushNotificationService';

const db = admin.firestore();

/**
 * Trigger when a new lead is found
 * Sends notification: "You have a new lead from r/[subreddit]!"
 */
export const onNewLeadFound = onDocumentCreated(
  {
    document: 'reddit_leads/{leadId}',
    memory: '256MiB',
  },
  async (event) => {
    try {
      const lead = event.data?.data();
      if (!lead) {
        console.log('No lead data found');
        return;
      }

      const { userId, subreddit, status, postTitle } = lead;

      // Only send notification for new/pending leads
      if (status !== 'found' && status !== 'pending') {
        console.log(`Lead status is ${status}, skipping notification`);
        return;
      }

      // Send notification
      await pushNotificationService.sendVisibleNotification(userId, {
        title: `New Lead from r/${subreddit}!`,
        body: postTitle || 'Check your inbox for details',
        data: {
          type: 'new_lead',
          leadId: event.params.leadId,
          subreddit,
        },
      });

      console.log(`✅ Sent new lead notification to user ${userId}`);
    } catch (error) {
      console.error('❌ Error sending new lead notification:', error);
    }
  },
);

/**
 * Trigger when a lead needs approval (status changed to pending/found)
 * Sends notification: "Review [X] leads waiting for your approval"
 */
export const onLeadsNeedingApproval = onDocumentUpdated(
  {
    document: 'hunting_sessions/{sessionId}',
    memory: '256MiB',
  },
  async (event) => {
    try {
      const before = event.data?.before.data();
      const after = event.data?.after.data();

      if (!before || !after) {
        console.log('No session data found');
        return;
      }

      const { userId, status } = after;

      // Check if session just moved to waiting_approval status
      if (before.status !== 'waiting_approval' && after.status === 'waiting_approval') {
        // Count pending leads for this user
        const leadsSnapshot = await db
          .collection('reddit_leads')
          .where('userId', '==', userId)
          .where('status', 'in', ['found', 'pending'])
          .get();

        const count = leadsSnapshot.size;

        if (count > 0) {
          await pushNotificationService.sendVisibleNotification(userId, {
            title: 'Leads Need Review',
            body: `${count} lead${count > 1 ? 's' : ''} waiting for your approval`,
            data: {
              type: 'lead_approval',
              count,
            },
          });

          console.log(`✅ Sent approval needed notification to user ${userId} for ${count} leads`);
        }
      }
    } catch (error) {
      console.error('❌ Error sending approval notification:', error);
    }
  },
);

/**
 * Trigger when a lead responds to DM
 * Sends notification: "[Username] replied to your DM!"
 */
export const onLeadResponded = onDocumentCreated(
  {
    document: 'lead_conversations/{conversationId}/messages/{messageId}',
    memory: '256MiB',
  },
  async (event) => {
    try {
      const message = event.data?.data();
      if (!message) {
        console.log('No message data found');
        return;
      }

      const { conversationId, isFromUser } = message;

      // Only send notification for messages FROM leads (not from user)
      if (isFromUser) {
        console.log('Message is from user, skipping notification');
        return;
      }

      // Get conversation details
      const conversationDoc = await db
        .collection('lead_conversations')
        .doc(conversationId)
        .get();

      const conversation = conversationDoc.data();
      if (!conversation) {
        console.log('Conversation not found');
        return;
      }

      const { userId, recipientUsername } = conversation;

      // Send notification
      await pushNotificationService.sendVisibleNotification(userId, {
        title: 'New Reply!',
        body: `${recipientUsername} replied to your message`,
        data: {
          type: 'lead_response',
          conversationId,
          username: recipientUsername,
        },
      });

      console.log(`✅ Sent lead response notification to user ${userId}`);
    } catch (error) {
      console.error('❌ Error sending lead response notification:', error);
    }
  },
);

/**
 * Trigger when hunting is paused (manual pause or error)
 * Sends notification: "Lead hunting paused - tap to resume"
 */
export const onHuntingPaused = onDocumentUpdated(
  {
    document: 'hunting_sessions/{sessionId}',
    memory: '256MiB',
  },
  async (event) => {
    try {
      const before = event.data?.before.data();
      const after = event.data?.after.data();

      if (!before || !after) {
        console.log('No session data found');
        return;
      }

      const { userId, status } = after;

      // Check if session just moved to paused status
      if (
        before.status !== 'paused' &&
        after.status === 'paused' &&
        before.status !== 'idle'
      ) {
        await pushNotificationService.sendVisibleNotification(userId, {
          title: 'Hunting Paused',
          body: 'Your lead hunting has been paused. Tap to resume.',
          data: {
            type: 'hunting_paused',
          },
        });

        console.log(`✅ Sent hunting paused notification to user ${userId}`);
      }
    } catch (error) {
      console.error('❌ Error sending hunting paused notification:', error);
    }
  },
);
