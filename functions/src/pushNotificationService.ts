/**
 * Push Notification Service
 * Sends both silent and visible push notifications via Firebase Cloud Messaging
 */

import * as admin from 'firebase-admin';

const db = admin.firestore();

interface SilentPushData {
  type: string;
  sessionId?: string;
  leadId?: string;
  commentId?: string;
  [key: string]: any;
}

interface VisibleNotificationData {
  title: string;
  body: string;
  data?: any;
}

class PushNotificationService {
  /**
   * Send silent push notification (wakes app in background for ~30 seconds)
   */
  async sendSilentPush(userId: string, data: SilentPushData): Promise<boolean> {
    try {
      // Get user's device tokens
      const tokens = await this.getUserDeviceTokens(userId);

      if (tokens.length === 0) {
        console.log(`No device tokens found for user ${userId}`);
        return false;
      }

      // Send silent notification to all devices
      const message: admin.messaging.MulticastMessage = {
        tokens,
        apns: {
          payload: {
            aps: {
              'content-available': 1, // Silent push flag for iOS
              badge: 0,
              sound: '', // No sound for silent push
            },
          },
          headers: {
            'apns-priority': '5', // Low priority for background
            'apns-push-type': 'background',
          },
        },
        data: {
          ...data,
          silent: 'true',
          timestamp: Date.now().toString(),
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      console.log(`Silent push sent to user ${userId}: ${response.successCount}/${tokens.length} devices`);

      // Clean up invalid tokens
      if (response.failureCount > 0) {
        await this.removeInvalidTokens(userId, tokens, response.responses);
      }

      return response.successCount > 0;
    } catch (error) {
      console.error('Error sending silent push:', error);
      return false;
    }
  }

  /**
   * Send visible notification (shows to user immediately)
   */
  async sendVisibleNotification(userId: string, notification: VisibleNotificationData): Promise<boolean> {
    try {
      const tokens = await this.getUserDeviceTokens(userId);

      if (tokens.length === 0) {
        console.log(`No device tokens found for user ${userId}`);
        return false;
      }

      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data ? {
          ...notification.data,
          timestamp: Date.now().toString(),
        } : undefined,
        apns: {
          payload: {
            aps: {
              alert: {
                title: notification.title,
                body: notification.body,
              },
              badge: 1,
              sound: 'default',
            },
          },
          headers: {
            'apns-priority': '10', // High priority for immediate delivery
            'apns-push-type': 'alert',
          },
        },
        android: {
          priority: 'high',
          notification: {
            title: notification.title,
            body: notification.body,
            sound: 'default',
            priority: 'high',
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      console.log(`Visible notification sent to user ${userId}: ${response.successCount}/${tokens.length} devices`);

      // Clean up invalid tokens
      if (response.failureCount > 0) {
        await this.removeInvalidTokens(userId, tokens, response.responses);
      }

      return response.successCount > 0;
    } catch (error) {
      console.error('Error sending visible notification:', error);
      return false;
    }
  }

  /**
   * Get all device tokens for a user
   */
  private async getUserDeviceTokens(userId: string): Promise<string[]> {
    try {
      const userDoc = await db.collection('users').doc(userId).get();

      if (!userDoc.exists) {
        return [];
      }

      const userData = userDoc.data();
      const tokens = userData?.deviceTokens || [];

      // Filter out empty/invalid tokens
      return tokens.filter((token: string) => token && token.length > 0);
    } catch (error) {
      console.error('Error getting device tokens:', error);
      return [];
    }
  }

  /**
   * Remove invalid/expired device tokens
   */
  private async removeInvalidTokens(
    userId: string,
    tokens: string[],
    responses: admin.messaging.SendResponse[],
  ): Promise<void> {
    try {
      const invalidTokens: string[] = [];

      responses.forEach((response, index) => {
        if (!response.success) {
          const { error } = response;
          // Check for token-related errors
          if (
            error?.code === 'messaging/invalid-registration-token' ||
            error?.code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokens[index]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        // Remove invalid tokens from user document
        await db.collection('users').doc(userId).update({
          deviceTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
        });

        console.log(`Removed ${invalidTokens.length} invalid tokens for user ${userId}`);
      }
    } catch (error) {
      console.error('Error removing invalid tokens:', error);
    }
  }

  /**
   * Register a device token for a user (called from client app)
   */
  async registerDeviceToken(userId: string, token: string): Promise<boolean> {
    try {
      await db.collection('users').doc(userId).update({
        deviceTokens: admin.firestore.FieldValue.arrayUnion(token),
        lastTokenUpdateAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Registered device token for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error registering device token:', error);
      return false;
    }
  }

  /**
   * Unregister a device token
   */
  async unregisterDeviceToken(userId: string, token: string): Promise<boolean> {
    try {
      await db.collection('users').doc(userId).update({
        deviceTokens: admin.firestore.FieldValue.arrayRemove(token),
      });

      console.log(`Unregistered device token for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error unregistering device token:', error);
      return false;
    }
  }
}

export const pushNotificationService = new PushNotificationService();
