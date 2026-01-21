import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CustomerInfo } from 'react-native-purchases';
import {
  getCustomerInfo,
  hasPremiumAccess,
  isRevenueCatEnabled,
} from '../lib/revenuecatClient';
import {
  SUBSCRIPTION_TIERS,
  ENTITLEMENTS,
  DEFAULT_TIER,
  type SubscriptionTier,
  type TierLimits,
  type TierConfig,
} from '../config/subscriptionTiers';

interface SubscriptionState {
  // Customer state
  customerInfo: CustomerInfo | null;
  isPremium: boolean;
  isLoading: boolean;
  lastChecked: number | null;

  // Tier state
  tier: SubscriptionTier;
  tierConfig: TierConfig;
  limits: TierLimits;

  // First DM tracking for paywall trigger
  hasSeenPaywall: boolean;
  hasSentFirstDM: boolean;
  shouldShowPaywall: boolean;

  // Actions
  refreshSubscriptionStatus: () => Promise<void>;
  checkPremiumAccess: () => Promise<boolean>;

  // Tier helpers
  canAccessFeature: (feature: keyof TierLimits) => boolean;
  isWithinLimit: (feature: keyof TierLimits, currentUsage: number) => boolean;
  isAtLeastTier: (requiredTier: SubscriptionTier) => boolean;

  // Paywall actions
  markFirstDMSent: () => void;
  markPaywallSeen: () => void;
  dismissPaywall: () => void;
}

// Tier hierarchy for comparison
const TIER_HIERARCHY: Record<SubscriptionTier, number> = {
  free: 0,
  basic: 1,
  plus: 2,
  pro: 3,
};

const detectTierFromCustomerInfo = (customerInfo: CustomerInfo | null): SubscriptionTier => {
  if (!customerInfo) return DEFAULT_TIER;

  const activeEntitlements = customerInfo.entitlements.active;

  // Check from highest tier to lowest
  if (activeEntitlements?.[ENTITLEMENTS.pro]) {
    return 'pro';
  }
  if (activeEntitlements?.[ENTITLEMENTS.plus]) {
    return 'plus';
  }
  if (activeEntitlements?.[ENTITLEMENTS.basic]) {
    return 'basic';
  }

  return DEFAULT_TIER;
};

const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      customerInfo: null,
      isPremium: false,
      isLoading: false,
      lastChecked: null,

      // Initialize with default tier
      tier: DEFAULT_TIER,
      tierConfig: SUBSCRIPTION_TIERS[DEFAULT_TIER],
      limits: SUBSCRIPTION_TIERS[DEFAULT_TIER].limits,

      // First DM tracking
      hasSeenPaywall: false,
      hasSentFirstDM: false,
      shouldShowPaywall: false,

      refreshSubscriptionStatus: async () => {
        if (!isRevenueCatEnabled()) {
          set({
            isPremium: false,
            isLoading: false,
            tier: DEFAULT_TIER,
            tierConfig: SUBSCRIPTION_TIERS[DEFAULT_TIER],
            limits: SUBSCRIPTION_TIERS[DEFAULT_TIER].limits,
            // If user is premium (subscribed), hide paywall
            shouldShowPaywall: false,
          });
          return;
        }

        set({ isLoading: true });

        try {
          const customerInfoResult = await getCustomerInfo();

          if (customerInfoResult.ok === false) {
            set({
              isPremium: false,
              isLoading: false,
              lastChecked: Date.now(),
              tier: DEFAULT_TIER,
              tierConfig: SUBSCRIPTION_TIERS[DEFAULT_TIER],
              limits: SUBSCRIPTION_TIERS[DEFAULT_TIER].limits,
            });
            return;
          }

          const customerInfo = customerInfoResult.data;
          const isPremium = Object.keys(customerInfo.entitlements.active || {}).length > 0;
          const tier = detectTierFromCustomerInfo(customerInfo);

          set({
            customerInfo,
            isPremium,
            isLoading: false,
            lastChecked: Date.now(),
            tier,
            tierConfig: SUBSCRIPTION_TIERS[tier],
            limits: SUBSCRIPTION_TIERS[tier].limits,
            // If user subscribed, dismiss paywall
            shouldShowPaywall: isPremium ? false : get().shouldShowPaywall,
          });
        } catch (error) {
          console.error('[SubscriptionStore] Error refreshing subscription:', error);
          set({ isLoading: false, lastChecked: Date.now() });
        }
      },

      checkPremiumAccess: async () => {
        const result = await hasPremiumAccess();
        return result.ok && result.data;
      },

      canAccessFeature: (feature: keyof TierLimits) => {
        const { limits } = get();
        const value = limits[feature];

        if (typeof value === 'boolean') {
          return value;
        }
        if (typeof value === 'number') {
          return value !== 0;
        }
        if (typeof value === 'string') {
          return value !== 'none';
        }
        if (Array.isArray(value)) {
          return value.length > 0;
        }
        return false;
      },

      isWithinLimit: (feature: keyof TierLimits, currentUsage: number) => {
        const { limits } = get();
        const limit = limits[feature];

        if (typeof limit !== 'number') {
          return true;
        }
        if (limit === -1) {
          // Unlimited
          return true;
        }
        return currentUsage < limit;
      },

      isAtLeastTier: (requiredTier: SubscriptionTier) => {
        const { tier } = get();
        return TIER_HIERARCHY[tier] >= TIER_HIERARCHY[requiredTier];
      },

      // Mark that user sent their first DM - triggers paywall for free users
      markFirstDMSent: () => {
        const { isPremium, hasSentFirstDM } = get();

        // Only show paywall if user is not premium and hasn't sent a DM before
        if (!isPremium && !hasSentFirstDM) {
          set({
            hasSentFirstDM: true,
            shouldShowPaywall: true,
          });
        } else if (!hasSentFirstDM) {
          set({ hasSentFirstDM: true });
        }
      },

      // Mark that user has seen the paywall (for tracking)
      markPaywallSeen: () => {
        set({ hasSeenPaywall: true });
      },

      // Dismiss the paywall (only works if subscription is active)
      dismissPaywall: () => {
        const { isPremium } = get();
        if (isPremium) {
          set({ shouldShowPaywall: false });
        }
        // Non-premium users cannot dismiss the paywall after first DM
      },
    }),
    {
      name: 'subscription-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist these fields
      partialize: (state) => ({
        hasSeenPaywall: state.hasSeenPaywall,
        hasSentFirstDM: state.hasSentFirstDM,
      }),
    },
  ),
);

export default useSubscriptionStore;
