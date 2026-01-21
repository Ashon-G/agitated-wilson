import { create } from 'zustand';
import { UserProfile, RedditAccount, GoogleDriveAccount, GoogleAnalyticsAccount } from '../types/app';
import BackendService from '../services/BackendService';
import AuthenticationService from '../services/AuthenticationService';

interface ProfileStore {
  profile: UserProfile | null;
  isLoading: boolean;

  // Actions
  loadProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updatePreferences: (preferences: Partial<UserProfile['preferences']>) => Promise<void>;
  connectRedditAccount: (redditAccount: RedditAccount) => Promise<void>;
  disconnectRedditAccount: () => Promise<void>;
  isRedditConnected: () => boolean;

  // Google integrations
  connectGoogleDriveAccount: (account: GoogleDriveAccount) => Promise<void>;
  connectGoogleAnalyticsAccount: (account: GoogleAnalyticsAccount) => Promise<void>;
  disconnectGoogleDriveAccount: () => Promise<void>;
  disconnectGoogleAnalyticsAccount: () => Promise<void>;
  isGoogleDriveConnected: () => boolean;
  isGoogleAnalyticsConnected: () => boolean;
}

const useProfileStore = create<ProfileStore>((set, get) => ({
  profile: null,
  isLoading: false,

  loadProfile: async () => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) return;

    try {
      set({ isLoading: true });
      const profile = await BackendService.getDocument<UserProfile>('users', user.uid);

      if (profile) {
        set({ profile, isLoading: false });
      } else {
        // Create a basic profile if none exists
        const basicProfile: UserProfile = {
          id: user.uid,
          userId: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          language: 'en',
          timezone: 'UTC',
          preferences: {
            theme: 'system',
            notifications: true,
            autoSave: true,
          },
          isOnboardingComplete: false,
          onboardingCompletedAt: undefined,
          onboardingData: undefined,
          businessInfo: undefined,
        };

        try {
          await BackendService.setDocument<UserProfile>('users', user.uid, basicProfile);
          set({ profile: basicProfile, isLoading: false });
        } catch (firebaseError) {
          // If Firebase save fails (rules not deployed yet), still set the profile
          console.warn('Could not save basic profile to Firebase, using local state:', firebaseError);
          set({ profile: basicProfile, isLoading: false });
        }
      }
    } catch (error) {
      console.error('Failed to load user profile from Firestore:', error);

      // Create a basic profile as fallback
      const user = AuthenticationService.getCurrentUser();
      if (user) {
        const basicProfile: UserProfile = {
          id: user.uid,
          userId: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          language: 'en',
          timezone: 'UTC',
          preferences: {
            theme: 'system',
            notifications: true,
            autoSave: true,
          },
          isOnboardingComplete: false,
          onboardingCompletedAt: undefined,
          onboardingData: undefined,
          businessInfo: undefined,
        };
        set({ profile: basicProfile, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    }
  },

  updateProfile: async (updates) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user || !get().profile) return;

    try {
      await BackendService.updateDocument<UserProfile>('users', user.uid, updates);

      set(state => ({
        profile: state.profile ? { ...state.profile, ...updates } : null,
      }));
    } catch (error) {
      console.error('Failed to update user profile in Firestore:', error);
      throw error;
    }
  },

  updatePreferences: async (preferences) => {
    const currentProfile = get().profile;
    if (!currentProfile) return;

    const updatedPreferences = { ...currentProfile.preferences, ...preferences };
    await get().updateProfile({ preferences: updatedPreferences });
  },

  connectRedditAccount: async (redditAccount) => {
    await get().updateProfile({ redditAccount });
  },

  disconnectRedditAccount: async () => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) return;

    // Update local state to reflect disconnection immediately
    set(state => ({
      profile: state.profile ? { ...state.profile, redditAccount: undefined } : null,
    }));

    // Invalidate profile cache to ensure fresh data on next load
    const CacheService = (await import('../services/backend/CacheService')).default;
    await CacheService.invalidateCache(`user_profile_${user.uid}`);
  },

  isRedditConnected: () => {
    const { profile } = get();
    const redditAccount = profile?.redditAccount;
    return !!(redditAccount?.isActive && redditAccount.expiresAt > Date.now());
  },

  // Google Drive integration methods
  connectGoogleDriveAccount: async (account) => {
    await get().updateProfile({ googleDriveAccount: account });
  },

  disconnectGoogleDriveAccount: async () => {
    await get().updateProfile({ googleDriveAccount: undefined });
  },

  isGoogleDriveConnected: () => {
    const { profile } = get();
    const driveAccount = profile?.googleDriveAccount;
    return !!(driveAccount?.isActive && driveAccount.expiresAt > Date.now());
  },

  // Google Analytics integration methods
  connectGoogleAnalyticsAccount: async (account) => {
    await get().updateProfile({ googleAnalyticsAccount: account });
  },

  disconnectGoogleAnalyticsAccount: async () => {
    await get().updateProfile({ googleAnalyticsAccount: undefined });
  },

  isGoogleAnalyticsConnected: () => {
    const { profile } = get();
    const analyticsAccount = profile?.googleAnalyticsAccount;
    return !!(analyticsAccount?.isActive && analyticsAccount.expiresAt > Date.now());
  },
}));

export default useProfileStore;