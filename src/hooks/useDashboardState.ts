/**
 * Dashboard State Hook
 *
 * Centralizes all dashboard data for holographic cards on the home screen.
 * Provides real-time data from various stores and services.
 *
 * PERFORMANCE: Uses primitive selectors and shallow comparisons to minimize re-renders.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useInboxStore from '../state/inboxStore';
import useBrainStore from '../state/brainStore';
import useHuntingStore from '../state/huntingStore';
import useWorkspaceStore from '../state/workspaceStore';
import RedditConnectionService from '../services/RedditConnectionService';

export interface DashboardState {
  // Lead Approvals
  pendingApprovals: number;
  pendingApprovalItems: Array<{
    id: string;
    title: string;
    subreddit?: string;
    score?: number;
  }>;

  // Setup Progress
  isRedditConnected: boolean;
  isHubSpotConnected: boolean;
  knowledgeCount: number;
  setupProgress: number; // 0-100
  setupItems: Array<{
    id: string;
    label: string;
    completed: boolean;
    action?: string;
  }>;

  // Stats
  leadsFound: number;
  postsScanned: number;
  commentsPosted: number;
  emailsCollected: number;

  // Inbox Alerts
  unreadReplies: number;
  unreadReplyItems: Array<{
    id: string;
    author: string;
    preview: string;
  }>;

  // Loading state
  isLoading: boolean;

  // Refresh function
  refresh: () => Promise<void>;
}

export interface AvatarSpeechTrigger {
  type: 'approval' | 'setup' | 'stats' | 'inbox' | 'greeting' | 'idle';
  message: string;
  priority: number; // Higher = more important
}

export function useDashboardState(): DashboardState {
  const [isRedditConnected, setIsRedditConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  // Get workspace ID first (primitive value)
  const currentWorkspaceId = useWorkspaceStore(state => state.currentWorkspace?.id);

  // OPTIMIZED: Use computed selectors that return counts directly
  // This prevents re-renders when the array changes but relevant counts stay the same
  const pendingApprovalCount = useInboxStore(
    useCallback(
      (state) => state.inboxItems.filter(
        item => item.type === 'comment_approval' && item.status === 'pending',
      ).length,
      [],
    ),
  );

  // Get pending approval items separately, only when count > 0
  const pendingApprovalItems = useMemo(() => {
    if (pendingApprovalCount === 0) return [];
    const items = useInboxStore.getState().inboxItems;
    return items
      .filter(item => item.type === 'comment_approval' && item.status === 'pending')
      .slice(0, 10)
      .map(item => ({
        id: item.id,
        title: item.title || 'Comment Approval',
        subreddit: item.post?.subreddit || item.tags?.find(t => t.startsWith('r/'))?.replace('r/', ''),
        score: item.aiQualityCheck?.score,
      }));
  }, [pendingApprovalCount]);

  const unreadReplyCount = useInboxStore(
    useCallback(
      (state) => state.inboxItems.filter(
        item =>
          item.id.startsWith('reddit_') &&
          item.status === 'pending' &&
          item.type === 'reddit_message',
      ).length,
      [],
    ),
  );

  // Get unread reply items separately, only when count > 0
  const unreadReplyItems = useMemo(() => {
    if (unreadReplyCount === 0) return [];
    const items = useInboxStore.getState().inboxItems;
    return items
      .filter(item =>
        item.id.startsWith('reddit_') &&
        item.status === 'pending' &&
        item.type === 'reddit_message',
      )
      .slice(0, 10)
      .map(item => ({
        id: item.id,
        author: (item as any).metadata?.author || 'Unknown',
        preview: item.content?.substring(0, 100) || '',
      }));
  }, [unreadReplyCount]);

  // OPTIMIZED: Use primitive selectors for knowledge count
  const knowledgeCount = useBrainStore(
    useCallback(
      (state) => {
        if (!currentWorkspaceId) return state.knowledgeItems.length;
        return state.knowledgeItems.filter(item => item.workspaceId === currentWorkspaceId).length;
      },
      [currentWorkspaceId],
    ),
  );

  // OPTIMIZED: Check HubSpot connection with primitive selector
  const isHubSpotConnected = useBrainStore(
    useCallback(
      (state) => state.integrations.find(i => i.id === 'hubspot')?.connected ?? false,
      [],
    ),
  );

  // OPTIMIZED: Use individual primitive selectors for hunting stats
  const leadsQualified = useHuntingStore(state => state.stats.leadsQualified);
  const prospectsScanned = useHuntingStore(state => state.stats.prospectsScanned);
  const conversationsActive = useHuntingStore(state => state.stats.conversationsActive);
  const emailsCollected = useHuntingStore(state => state.stats.emailsCollected);

  // Check Reddit connection status - debounced
  const checkRedditConnection = useCallback(async () => {
    try {
      const connected = await RedditConnectionService.hasActiveConnection();
      if (isMountedRef.current) {
        setIsRedditConnected(connected);
      }
    } catch (error) {
      console.log('[Dashboard] Error checking Reddit connection:', error);
      if (isMountedRef.current) {
        setIsRedditConnected(false);
      }
    }
  }, []);

  // Initial load and periodic refresh
  useEffect(() => {
    isMountedRef.current = true;
    const loadData = async () => {
      setIsLoading(true);
      await checkRedditConnection();
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    };

    loadData();

    // Refresh Reddit status every 60 seconds (reduced from 30s)
    const interval = setInterval(checkRedditConnection, 60000);
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [checkRedditConnection]);

  // Setup progress calculation - memoized
  const { setupItems, setupProgress } = useMemo(() => {
    const items = [
      {
        id: 'reddit',
        label: 'Connect Reddit',
        completed: isRedditConnected,
        action: 'Integrations',
      },
      {
        id: 'knowledge',
        label: 'Add 3+ knowledge items',
        completed: knowledgeCount >= 3,
        action: 'BrainAI',
      },
      {
        id: 'hubspot',
        label: 'Connect HubSpot (optional)',
        completed: isHubSpotConnected,
        action: 'Integrations',
      },
    ];

    // Reddit and knowledge are required, HubSpot is optional (so max is 2 for 100%)
    const requiredItems = items.filter(item => item.id !== 'hubspot');
    const completedRequired = requiredItems.filter(item => item.completed).length;
    const progress = Math.round((completedRequired / requiredItems.length) * 100);

    return { setupItems: items, setupProgress: progress };
  }, [isRedditConnected, knowledgeCount, isHubSpotConnected]);

  // Refresh function
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await checkRedditConnection();
    // Inbox store will auto-refresh via its listeners
    if (isMountedRef.current) {
      setIsLoading(false);
    }
  }, [checkRedditConnection]);

  return {
    // Lead Approvals
    pendingApprovals: pendingApprovalCount,
    pendingApprovalItems,

    // Setup Progress
    isRedditConnected,
    isHubSpotConnected,
    knowledgeCount,
    setupProgress,
    setupItems,

    // Stats
    leadsFound: leadsQualified,
    postsScanned: prospectsScanned,
    commentsPosted: conversationsActive,
    emailsCollected,

    // Inbox Alerts
    unreadReplies: unreadReplyCount,
    unreadReplyItems,

    // Loading state
    isLoading,

    // Refresh
    refresh,
  };
}

/**
 * Determines what the avatar should say based on current dashboard state
 * Returns the highest priority message
 */
export function useAvatarSpeech(dashboardState: DashboardState, userName: string): AvatarSpeechTrigger | null {
  const [currentTrigger, setCurrentTrigger] = useState<AvatarSpeechTrigger | null>(null);
  const [lastSpokenType, setLastSpokenType] = useState<string | null>(null);

  useEffect(() => {
    // Don't update while loading
    if (dashboardState.isLoading) return;

    const triggers: AvatarSpeechTrigger[] = [];

    // Priority 1: Pending approvals (highest priority)
    if (dashboardState.pendingApprovals > 0 && lastSpokenType !== 'approval') {
      const count = dashboardState.pendingApprovals;
      triggers.push({
        type: 'approval',
        message: count === 1
          ? `Hey ${userName}! I've got a lead that needs your approval.`
          : `Hey ${userName}! I've got ${count} leads that need your approval.`,
        priority: 100,
      });
    }

    // Priority 2: Unread replies
    if (dashboardState.unreadReplies > 0 && lastSpokenType !== 'inbox') {
      const count = dashboardState.unreadReplies;
      triggers.push({
        type: 'inbox',
        message: count === 1
          ? 'Someone replied to your comment! Check it out.'
          : `You've got ${count} new replies waiting for you.`,
        priority: 90,
      });
    }

    // Priority 3: Setup incomplete
    if (dashboardState.setupProgress < 100 && lastSpokenType !== 'setup') {
      if (!dashboardState.isRedditConnected) {
        triggers.push({
          type: 'setup',
          message: 'Let\'s get you set up! Connect your Reddit account so I can start finding leads.',
          priority: 80,
        });
      } else if (dashboardState.knowledgeCount < 3) {
        triggers.push({
          type: 'setup',
          message: 'Add some more info about your business so I can write better comments.',
          priority: 70,
        });
      }
    }

    // Priority 4: Stats update (only if there are notable stats)
    if (dashboardState.leadsFound > 0 && lastSpokenType !== 'stats') {
      triggers.push({
        type: 'stats',
        message: `I've found ${dashboardState.leadsFound} qualified leads for you so far!`,
        priority: 50,
      });
    }

    // Sort by priority and pick the highest
    triggers.sort((a, b) => b.priority - a.priority);

    if (triggers.length > 0) {
      setCurrentTrigger(triggers[0]);
    }
  }, [
    dashboardState.pendingApprovals,
    dashboardState.unreadReplies,
    dashboardState.setupProgress,
    dashboardState.leadsFound,
    dashboardState.isLoading,
    userName,
    lastSpokenType,
  ]);

  return currentTrigger;
}

export default useDashboardState;
