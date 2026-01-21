/**
 * Subscription Tiers Configuration
 *
 * Defines all subscription tiers and their feature limits.
 * These match the products configured in RevenueCat.
 */

export type SubscriptionTier = 'free' | 'basic' | 'plus' | 'pro';

export interface TierLimits {
  // Lead hunting
  subreddits: number;
  postsScannedPerDay: number;
  aiCommentsPerDay: number;
  leadScoreThreshold: number; // Minimum lead score (lower = more leads)

  // Features
  commentStyles: ('friendly' | 'professional' | 'expert' | 'custom')[];
  dmOutreach: boolean;
  emailCollection: boolean;

  // HubSpot integration
  hubspotSync: 'none' | 'manual' | 'auto';

  // Analytics
  analyticsHistoryDays: number;
  exportData: boolean;

  // Knowledge base
  knowledgeItems: number;

  // Custom keywords
  customKeywords: boolean;

  // Post age filter (days)
  maxPostAgeDays: number;
}

export interface TierConfig {
  id: SubscriptionTier;
  name: string;
  description: string;
  monthlyPrice: number; // in USD
  yearlyPrice: number; // in USD (annual)
  entitlementId: string; // RevenueCat entitlement ID
  limits: TierLimits;
  badge?: {
    text: string;
    color: string;
  };
}

// RevenueCat product identifiers
export const REVENUECAT_PRODUCTS = {
  basic: {
    monthly: 'basic_monthly',
    yearly: 'basic_yearly',
  },
  plus: {
    monthly: 'plus_monthly',
    yearly: 'plus_yearly',
  },
  pro: {
    monthly: 'pro_monthly',
    yearly: 'pro_yearly',
  },
} as const;

// RevenueCat entitlement IDs
export const ENTITLEMENTS = {
  basic: 'basic',
  plus: 'plus',
  pro: 'pro',
} as const;

export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, TierConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Try out the basics',
    monthlyPrice: 0,
    yearlyPrice: 0,
    entitlementId: '',
    limits: {
      subreddits: 1,
      postsScannedPerDay: 10,
      aiCommentsPerDay: 1,
      leadScoreThreshold: 80, // Only highest quality leads
      commentStyles: ['friendly'],
      dmOutreach: false,
      emailCollection: false,
      hubspotSync: 'none',
      analyticsHistoryDays: 1,
      exportData: false,
      knowledgeItems: 10,
      customKeywords: false,
      maxPostAgeDays: 3,
    },
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    description: 'Get started with lead generation',
    monthlyPrice: 9.99,
    yearlyPrice: 99.99,
    entitlementId: ENTITLEMENTS.basic,
    limits: {
      subreddits: 3,
      postsScannedPerDay: 50,
      aiCommentsPerDay: 5,
      leadScoreThreshold: 70, // High quality leads only
      commentStyles: ['friendly'],
      dmOutreach: false,
      emailCollection: false,
      hubspotSync: 'none',
      analyticsHistoryDays: 7,
      exportData: false,
      knowledgeItems: 50,
      customKeywords: false,
      maxPostAgeDays: 7,
    },
    badge: {
      text: 'Starter',
      color: '#3B82F6',
    },
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    description: 'Scale your outreach',
    monthlyPrice: 29.99,
    yearlyPrice: 299.99,
    entitlementId: ENTITLEMENTS.plus,
    limits: {
      subreddits: 9,
      postsScannedPerDay: 200,
      aiCommentsPerDay: 25,
      leadScoreThreshold: 50, // More leads included
      commentStyles: ['friendly', 'professional', 'expert'],
      dmOutreach: true,
      emailCollection: false,
      hubspotSync: 'manual',
      analyticsHistoryDays: 30,
      exportData: false,
      knowledgeItems: 200,
      customKeywords: true,
      maxPostAgeDays: 14,
    },
    badge: {
      text: 'Popular',
      color: '#8B5CF6',
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Full automation & CRM integration',
    monthlyPrice: 79.99,
    yearlyPrice: 799.99,
    entitlementId: ENTITLEMENTS.pro,
    limits: {
      subreddits: 15,
      postsScannedPerDay: -1, // Unlimited
      aiCommentsPerDay: -1, // Unlimited
      leadScoreThreshold: 0, // All leads
      commentStyles: ['friendly', 'professional', 'expert', 'custom'],
      dmOutreach: true,
      emailCollection: true,
      hubspotSync: 'auto',
      analyticsHistoryDays: 365,
      exportData: true,
      knowledgeItems: -1, // Unlimited
      customKeywords: true,
      maxPostAgeDays: 30,
    },
    badge: {
      text: 'Best Value',
      color: '#F59E0B',
    },
  },
};

// Helper to check if a limit is unlimited
export const isUnlimited = (value: number): boolean => value === -1;

// Helper to format limit display
export const formatLimit = (value: number): string => {
  if (value === -1) return 'Unlimited';
  return value.toString();
};

// Feature comparison for paywall display
export interface FeatureComparison {
  name: string;
  description?: string;
  tiers: {
    free: string | boolean;
    basic: string | boolean;
    plus: string | boolean;
    pro: string | boolean;
  };
}

export const FEATURE_COMPARISON: FeatureComparison[] = [
  {
    name: 'Subreddits to monitor',
    tiers: {
      free: '1',
      basic: '3',
      plus: '9',
      pro: '15',
    },
  },
  {
    name: 'Posts scanned/day',
    tiers: {
      free: '10',
      basic: '50',
      plus: '200',
      pro: 'Unlimited',
    },
  },
  {
    name: 'AI comments/day',
    tiers: {
      free: '1',
      basic: '5',
      plus: '25',
      pro: 'Unlimited',
    },
  },
  {
    name: 'Comment styles',
    tiers: {
      free: 'Friendly only',
      basic: 'Friendly only',
      plus: 'All 3 styles',
      pro: 'All + Custom',
    },
  },
  {
    name: 'Lead score access',
    tiers: {
      free: '80+ only',
      basic: '70+ only',
      plus: '50+',
      pro: 'All scores',
    },
  },
  {
    name: 'DM outreach',
    tiers: {
      free: false,
      basic: false,
      plus: true,
      pro: true,
    },
  },
  {
    name: 'Email collection',
    tiers: {
      free: false,
      basic: false,
      plus: false,
      pro: true,
    },
  },
  {
    name: 'HubSpot sync',
    tiers: {
      free: false,
      basic: false,
      plus: 'Manual',
      pro: 'Auto-sync',
    },
  },
  {
    name: 'Analytics history',
    tiers: {
      free: '1 day',
      basic: '7 days',
      plus: '30 days',
      pro: '1 year',
    },
  },
  {
    name: 'Export leads to CSV',
    tiers: {
      free: false,
      basic: false,
      plus: false,
      pro: true,
    },
  },
  {
    name: 'Custom keywords',
    tiers: {
      free: false,
      basic: false,
      plus: true,
      pro: true,
    },
  },
  {
    name: 'Knowledge base items',
    tiers: {
      free: '10',
      basic: '50',
      plus: '200',
      pro: 'Unlimited',
    },
  },
  {
    name: 'Post age filter',
    tiers: {
      free: '3 days',
      basic: '7 days',
      plus: '14 days',
      pro: '30 days',
    },
  },
];

// Export default tier for non-subscribed users
export const DEFAULT_TIER: SubscriptionTier = 'free';
