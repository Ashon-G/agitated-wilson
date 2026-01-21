/**
 * Firebase Functions
 *
 * Provides backend infrastructure for the app.
 */

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

// Set global options
setGlobalOptions({
  maxInstances: 10,
});

// Initialize Firebase Admin
admin.initializeApp();

/**
 * =============================================================================
 * USER-AGENT COMMUNICATION FUNCTIONS
 * =============================================================================
 * Allow users to chat with their AI agent and ask questions
 */

// User chats with agent
export { userAgentChat } from './userAgentChat';

// Get user-agent conversation history
export { getUserAgentConversations } from './userAgentChat';

// Agent asks user a question
export { agentAskUser } from './userAgentChat';

// User responds to agent question
export { respondToAgentQuestion } from './userAgentChat';

// Get pending agent questions
export { getPendingAgentQuestions } from './userAgentChat';

/**
 * =============================================================================
 * HUBSPOT CRM INTEGRATION FUNCTIONS
 * =============================================================================
 * Sync Reddit leads to HubSpot CRM
 */

// Sync qualified Reddit lead to HubSpot
export { syncLeadToHubSpot } from './syncLeadToHubSpot';

/**
 * =============================================================================
 * PUSH NOTIFICATION FUNCTIONS
 * =============================================================================
 * Register and manage push notification tokens
 */

// Firestore triggers for automatic push notifications
export {
  onNewLeadFound,
  onLeadsNeedingApproval,
  onLeadResponded,
  onHuntingPaused,
} from './notificationTriggers';

// Register device token for push notifications
export const registerPushToken = onCall(
  {
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { token } = request.data;
    if (!token) {
      throw new HttpsError('invalid-argument', 'token is required');
    }

    try {
      const { pushNotificationService } = await import('./pushNotificationService');
      const success = await pushNotificationService.registerDeviceToken(
        request.auth.uid,
        token,
      );

      return {
        success,
        message: success ? 'Push token registered' : 'Failed to register token',
      };
    } catch (error) {
      console.error('Error registering push token:', error);
      throw new HttpsError('internal', 'Failed to register push token');
    }
  },
);

// Unregister device token
export const unregisterPushToken = onCall(
  {
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { token } = request.data;
    if (!token) {
      throw new HttpsError('invalid-argument', 'token is required');
    }

    try {
      const { pushNotificationService } = await import('./pushNotificationService');
      const success = await pushNotificationService.unregisterDeviceToken(
        request.auth.uid,
        token,
      );

      return {
        success,
        message: success ? 'Push token unregistered' : 'Failed to unregister token',
      };
    } catch (error) {
      console.error('Error unregistering push token:', error);
      throw new HttpsError('internal', 'Failed to unregister push token');
    }
  },
);

/**
 * =============================================================================
 * ADMIN FUNCTIONS
 * =============================================================================
 * Admin-only functions for user management and account deletion
 */

// Admin function to delete a user account with cascading deletion
export { adminDeleteUser } from './adminUserDeletion';

// Admin function to set admin privileges for a user
export { setAdminClaim } from './adminUserDeletion';

/**
 * =============================================================================
 * SCHEDULED CLEANUP FUNCTIONS
 * =============================================================================
 * Automatically run maintenance tasks on a schedule
 */

// Weekly cleanup of orphaned user data (runs every Sunday at 3 AM UTC)
export { weeklyOrphanedDataCleanup } from './scheduledCleanup';

/**
 * =============================================================================
 * AUTONOMOUS REDDIT AGENT
 * =============================================================================
 * Scheduled function that runs every 30 minutes to hunt for leads
 * even when the app is closed
 */

// Autonomous Reddit Agent (runs every 30 minutes)
export { autonomousRedditAgent } from './autonomousRedditAgent';

/**
 * =============================================================================
 * PENDING COMMENT QUALITY CHECK & APPROVAL FUNCTIONS
 * =============================================================================
 * AI quality check + manual user approval before posting to Reddit
 */

// Triggered when a new pending_comments document is created - performs AI quality check
export { onPendingCommentCreated } from './postPendingComment';

// Approve and post comment to Reddit (called by user)
export { approveAndPostComment, rejectComment } from './approveComment';

/**
 * =============================================================================
 * SPOTIFY CONVERSIONS API INTEGRATION
 * =============================================================================
 * Server-to-server conversion tracking for Spotify Ads
 */

// HTTP endpoint for sending conversion events manually
export { sendSpotifyConversion } from './spotifyConversions';

// RevenueCat webhook for automatic purchase conversion tracking
export { revenueCatWebhook } from './spotifyConversions';

// Firestore trigger for registration conversion tracking
export { onUserCreated } from './spotifyConversions';

// Callable function for app-triggered conversions
export { trackSpotifyConversion } from './spotifyConversions';
