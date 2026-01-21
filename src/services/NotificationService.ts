/**
 * Notification Service
 * Handles push notification registration, permissions, and handling on the client
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { arrayUnion } from 'firebase/firestore';
import AuthenticationService from './AuthenticationService';
import BackendService from './BackendService';

// Navigation reference - will be set by App.tsx
// eslint-disable-next-line prefer-const
let navigationRef: any = null;

// Configure how notifications should be handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  type: 'new_lead' | 'lead_approval' | 'lead_response' | 'hunting_paused' | 'reminder' | 'daily_summary' | 'engagement_prompt';
  leadId?: string;
  subreddit?: string;
  username?: string;
  count?: number;
  [key: string]: any;
}

// Predetermined notification templates
const SCHEDULED_NOTIFICATIONS = {
  // Daily check-in reminder (morning)
  morningCheckIn: {
    id: 'morning-checkin',
    title: 'Good morning! 🌅',
    body: 'Check your inbox - your AI agent may have found new leads overnight.',
    data: { type: 'reminder' as const },
  },
  // Evening summary reminder
  eveningSummary: {
    id: 'evening-summary',
    title: 'Daily Lead Summary 📊',
    body: 'See how your AI agent performed today. Review pending leads before EOD.',
    data: { type: 'daily_summary' as const },
  },
  // Engagement prompt (if user hasn't opened app)
  engagementPrompt: {
    id: 'engagement-prompt',
    title: 'Your agent is working hard! 🤖',
    body: 'Don\'t miss out on potential leads. Tap to review what\'s been found.',
    data: { type: 'engagement_prompt' as const },
  },
  // Weekly performance recap
  weeklyRecap: {
    id: 'weekly-recap',
    title: 'Weekly Performance Recap 📈',
    body: 'See your lead generation stats for this week.',
    data: { type: 'daily_summary' as const },
  },
  // Inactivity reminder (after 3 days)
  inactivityReminder: {
    id: 'inactivity-reminder',
    title: 'We miss you! 👋',
    body: 'Your AI agent has been finding leads. Come back and review them!',
    data: { type: 'engagement_prompt' as const },
  },
};

class NotificationService {
  private expoPushToken: string | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;

  /**
   * Initialize notifications - call this on app start
   */
  async initialize(): Promise<boolean> {
    try {
      // Only register for push notifications on real devices
      if (!Device.isDevice) {
        console.log('⚠️ [Notifications] Push notifications only work on physical devices');
        return false;
      }

      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('❌ [Notifications] Permission denied');
        return false;
      }

      // Get and register push token
      const token = await this.registerForPushNotifications();
      if (!token) {
        console.log('❌ [Notifications] Failed to get push token');
        return false;
      }

      this.expoPushToken = token;

      // Save token to backend
      await this.saveTokenToBackend(token);

      // Set up notification listeners
      this.setupNotificationListeners();

      console.log('✅ [Notifications] Initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ [Notifications] Initialization error:', error);
      return false;
    }
  }

  /**
   * Request notification permissions from user
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('❌ [Notifications] Permission denied');
        return false;
      }

      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF4500',
          sound: 'default',
        });
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Register for push notifications and get Expo push token
   */
  async registerForPushNotifications(): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        return null;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;

      // If no EAS project ID, try to get native device token instead
      if (!projectId || projectId === '') {
        console.log('⚠️ [Notifications] No EAS project ID configured, using native device token');

        // Get native device push token (FCM for Android, APNs for iOS)
        const tokenData = await Notifications.getDevicePushTokenAsync();
        console.log('✅ [Notifications] Got native device token:', tokenData.data);
        return tokenData.data;
      }

      // Use Expo push token if project ID is available
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      console.log('✅ [Notifications] Got Expo push token:', tokenData.data);
      return tokenData.data;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  /**
   * Save push token to backend (Firestore + Firebase Cloud Messaging)
   */
  private async saveTokenToBackend(token: string): Promise<void> {
    try {
      const user = AuthenticationService.getCurrentUser();
      if (!user) {
        console.log('⚠️ [Notifications] No user logged in, skipping token save');
        return;
      }

      // Save to Firestore user document
      await BackendService.updateDocument('users', user.uid, {
        deviceTokens: arrayUnion(token),
        lastTokenUpdateAt: new Date(),
      });

      console.log('✅ [Notifications] Token saved to backend');
    } catch (error) {
      console.error('Error saving token to backend:', error);
    }
  }

  /**
   * Set up listeners for incoming notifications
   */
  private setupNotificationListeners(): void {
    // Handle notifications received while app is in foreground
    this.notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('📩 [Notifications] Received:', notification);
      this.handleNotification(notification);
    });

    // Handle user tapping on notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('👆 [Notifications] Tapped:', response);
      this.handleNotificationResponse(response);
    });
  }

  /**
   * Handle incoming notification (when app is open)
   */
  private handleNotification(notification: Notifications.Notification): void {
    const data = notification.request.content.data as NotificationData;

    // Log notification for debugging
    console.log('📩 [Notifications] Received in foreground:', data);
  }

  /**
   * Handle notification tap (navigate to appropriate screen)
   */
  private handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const data = response.notification.request.content.data as NotificationData;
    console.log('👆 [Notifications] User tapped notification:', data);

    // Navigate based on notification type
    this.navigateToScreen(data);
  }

  /**
   * Navigate to appropriate screen based on notification data
   */
  private navigateToScreen(data: NotificationData): void {
    if (!navigationRef?.isReady?.()) {
      console.log('⚠️ [Notifications] Navigation not ready, using deep link');
      // Fallback to deep linking if navigation ref not ready
      this.handleDeepLink(data);
      return;
    }

    try {
      switch (data.type) {
        case 'new_lead':
          if (data.leadId) {
            navigationRef.navigate('LeadDetail', { leadId: data.leadId });
          } else {
            // Navigate to Inbox tab
            navigationRef.navigate('Main', { screen: 'Inbox' });
          }
          break;

        case 'lead_approval':
          if (data.leadId) {
            navigationRef.navigate('LeadDetail', { leadId: data.leadId });
          } else {
            navigationRef.navigate('Main', { screen: 'Inbox' });
          }
          break;

        case 'lead_response':
          if (data.leadId) {
            navigationRef.navigate('Conversation', { leadId: data.leadId });
          } else {
            navigationRef.navigate('ConversationsList');
          }
          break;

        case 'hunting_paused':
          // Navigate to Home to see hunting status
          navigationRef.navigate('Main', { screen: 'Home' });
          break;

        default:
          // Default to Inbox
          navigationRef.navigate('Main', { screen: 'Inbox' });
          break;
      }

      console.log('✅ [Notifications] Navigated to screen for type:', data.type);
    } catch (error) {
      console.error('❌ [Notifications] Navigation error:', error);
    }
  }

  /**
   * Handle deep link fallback for notifications
   */
  private handleDeepLink(data: NotificationData): void {
    let url = 'tava://';

    switch (data.type) {
      case 'new_lead':
      case 'lead_approval':
        url = data.leadId ? `tava://lead/${data.leadId}` : 'tava://inbox';
        break;
      case 'lead_response':
        url = data.leadId ? `tava://conversation/${data.leadId}` : 'tava://conversations';
        break;
      case 'hunting_paused':
        url = 'tava://home';
        break;
      default:
        url = 'tava://inbox';
        break;
    }

    Linking.openURL(url).catch(err => {
      console.error('❌ [Notifications] Deep link error:', err);
    });
  }

  /**
   * Set navigation reference (call from App.tsx)
   */
  setNavigationRef(ref: any): void {
    navigationRef = ref;
    console.log('✅ [Notifications] Navigation ref set');
  }

  /**
   * Send a local notification (for testing or immediate feedback)
   */
  async sendLocalNotification(title: string, body: string, data?: NotificationData): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: 'default',
        },
        trigger: null, // Send immediately
      });

      console.log('✅ [Notifications] Local notification sent');
    } catch (error) {
      console.error('Error sending local notification:', error);
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('✅ [Notifications] All notifications cancelled');
    } catch (error) {
      console.error('Error cancelling notifications:', error);
    }
  }

  /**
   * Set badge count (iOS)
   */
  async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }

  /**
   * Clear all notifications from notification center
   */
  async clearAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('✅ [Notifications] All notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }

  /**
   * Clean up listeners
   */
  cleanup(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
    }
    if (this.responseListener) {
      this.responseListener.remove();
    }
  }

  /**
   * Get current push token
   */
  getPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Check if notifications are enabled
   */
  async areNotificationsEnabled(): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      return false;
    }
  }

  // ============================================
  // SCHEDULED / PREDETERMINED NOTIFICATIONS
  // ============================================

  /**
   * Schedule all predetermined notifications
   * Call this after user completes onboarding or enables notifications
   */
  async scheduleAllPredeterminedNotifications(): Promise<void> {
    try {
      // Cancel existing scheduled notifications first to avoid duplicates
      await this.cancelAllNotifications();

      // Schedule morning check-in (9 AM daily)
      await this.scheduleDailyNotification(
        SCHEDULED_NOTIFICATIONS.morningCheckIn,
        9, // 9 AM
        0,
      );

      // Schedule evening summary (6 PM daily)
      await this.scheduleDailyNotification(
        SCHEDULED_NOTIFICATIONS.eveningSummary,
        18, // 6 PM
        0,
      );

      // Schedule weekly recap (Sunday 10 AM)
      await this.scheduleWeeklyNotification(
        SCHEDULED_NOTIFICATIONS.weeklyRecap,
        1, // Sunday
        10, // 10 AM
        0,
      );

      console.log('✅ [Notifications] All predetermined notifications scheduled');
    } catch (error) {
      console.error('❌ [Notifications] Error scheduling predetermined notifications:', error);
    }
  }

  /**
   * Schedule a notification to fire at a specific time each day
   */
  async scheduleDailyNotification(
    notification: { id: string; title: string; body: string; data: NotificationData },
    hour: number,
    minute: number,
  ): Promise<string | null> {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data,
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
        identifier: notification.id,
      });

      console.log(`✅ [Notifications] Scheduled daily notification: ${notification.id} at ${hour}:${minute.toString().padStart(2, '0')}`);
      return identifier;
    } catch (error) {
      console.error(`❌ [Notifications] Error scheduling daily notification ${notification.id}:`, error);
      return null;
    }
  }

  /**
   * Schedule a notification to fire at a specific time each week
   */
  async scheduleWeeklyNotification(
    notification: { id: string; title: string; body: string; data: NotificationData },
    weekday: number, // 1 = Sunday, 2 = Monday, etc.
    hour: number,
    minute: number,
  ): Promise<string | null> {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data,
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour,
          minute,
        },
        identifier: notification.id,
      });

      console.log(`✅ [Notifications] Scheduled weekly notification: ${notification.id}`);
      return identifier;
    } catch (error) {
      console.error(`❌ [Notifications] Error scheduling weekly notification ${notification.id}:`, error);
      return null;
    }
  }

  /**
   * Schedule a one-time notification after a delay (in seconds)
   */
  async scheduleDelayedNotification(
    title: string,
    body: string,
    delaySeconds: number,
    data?: NotificationData,
  ): Promise<string | null> {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: delaySeconds,
        },
      });

      console.log(`✅ [Notifications] Scheduled delayed notification in ${delaySeconds}s`);
      return identifier;
    } catch (error) {
      console.error('❌ [Notifications] Error scheduling delayed notification:', error);
      return null;
    }
  }

  /**
   * Schedule an inactivity reminder (fires after X days of no app usage)
   * Call this each time user opens the app to reset the timer
   */
  async scheduleInactivityReminder(daysUntilReminder: number = 3): Promise<void> {
    try {
      // Cancel any existing inactivity reminder
      await Notifications.cancelScheduledNotificationAsync(SCHEDULED_NOTIFICATIONS.inactivityReminder.id);

      // Schedule new reminder
      const secondsUntilReminder = daysUntilReminder * 24 * 60 * 60;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: SCHEDULED_NOTIFICATIONS.inactivityReminder.title,
          body: SCHEDULED_NOTIFICATIONS.inactivityReminder.body,
          data: SCHEDULED_NOTIFICATIONS.inactivityReminder.data,
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsUntilReminder,
        },
        identifier: SCHEDULED_NOTIFICATIONS.inactivityReminder.id,
      });

      console.log(`✅ [Notifications] Inactivity reminder scheduled for ${daysUntilReminder} days from now`);
    } catch (error) {
      console.error('❌ [Notifications] Error scheduling inactivity reminder:', error);
    }
  }

  /**
   * Schedule engagement prompt (for users who haven't engaged in a while)
   */
  async scheduleEngagementPrompt(hoursFromNow: number = 24): Promise<void> {
    try {
      // Cancel any existing engagement prompt
      await Notifications.cancelScheduledNotificationAsync(SCHEDULED_NOTIFICATIONS.engagementPrompt.id);

      const secondsFromNow = hoursFromNow * 60 * 60;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: SCHEDULED_NOTIFICATIONS.engagementPrompt.title,
          body: SCHEDULED_NOTIFICATIONS.engagementPrompt.body,
          data: SCHEDULED_NOTIFICATIONS.engagementPrompt.data,
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsFromNow,
        },
        identifier: SCHEDULED_NOTIFICATIONS.engagementPrompt.id,
      });

      console.log(`✅ [Notifications] Engagement prompt scheduled for ${hoursFromNow} hours from now`);
    } catch (error) {
      console.error('❌ [Notifications] Error scheduling engagement prompt:', error);
    }
  }

  /**
   * Cancel a specific scheduled notification by ID
   */
  async cancelScheduledNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log(`✅ [Notifications] Cancelled notification: ${notificationId}`);
    } catch (error) {
      console.error(`❌ [Notifications] Error cancelling notification ${notificationId}:`, error);
    }
  }

  /**
   * Get all currently scheduled notifications
   */
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      console.log(`📋 [Notifications] ${scheduled.length} notifications currently scheduled`);
      return scheduled;
    } catch (error) {
      console.error('❌ [Notifications] Error getting scheduled notifications:', error);
      return [];
    }
  }
}

export default new NotificationService();
