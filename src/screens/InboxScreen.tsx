import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, ActivityIndicator, InteractionManager, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';
import { Search, X, Check, MessageCircle, HelpCircle, Zap, Mail, Target, Clock } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import useInboxStore from '../state/inboxStore';
import useWorkspaceStore from '../state/workspaceStore';
import useHuntingStore from '../state/huntingStore';
import useSubscriptionStore from '../state/subscriptionStore';
import AgentControlModal from '../components/AgentControlModal';
import CommentApprovalCard from '../components/CommentApprovalCard';
import ConfirmationSheet, { ConfirmationSheetRef } from '../components/ConfirmationSheet';
import GlobalHeader from '../components/GlobalHeader';
import UpgradeButton from '../components/UpgradeButton';
import { InboxItem } from '../types/app';
import { toastManager } from '../utils/toastManager';
import { hapticFeedback } from '../utils/hapticFeedback';
import { formatRelativeTime } from '../utils/dateUtils';
import { withScreenErrorBoundary } from '../components/ScreenErrorBoundary';
import { useWorkspaceColor } from '../hooks/useWorkspaceColor';
import { useTheme } from '../contexts/ThemeContext';
import { GLASS } from '../utils/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;
const ACTION_THRESHOLD = 120;

type TabParamList = {
  Inbox: {
    initialFilter?: FilterType;
  };
};

type RootStackParamList = {
  Main: undefined;
  Profile: undefined;
  ChatScreen: {
    inboxItemId?: string;
    questId?: string;
  };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type FilterType = 'all' | 'leads' | 'messages' | 'pending';

interface UnifiedInboxItem {
  id: string;
  type: 'lead' | 'message' | 'comment_approval' | 'question';
  title: string;
  subtitle: string;
  timestamp: Date;
  isUnread: boolean;
  isCompleted: boolean;
  score?: number;
  subreddit?: string;
  buyingIntent?: string;
  originalItem: InboxItem;
}

const PAGE_SIZE = 20;

// Swipeable inbox item component for leads - Clean, minimal design
const SwipeableInboxItemCard = React.memo(({
  item,
  isSelected,
  isMultiSelectMode,
  color,
  glass,
  isDark,
  onPress,
  onLongPress,
  onApprove,
  onReject,
}: {
  item: UnifiedInboxItem;
  isSelected: boolean;
  isMultiSelectMode: boolean;
  color: string;
  glass: typeof GLASS.dark | typeof GLASS.light;
  isDark: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onApprove: () => void;
  onReject: () => void;
}) => {
  const translateX = useSharedValue(0);

  const canSwipe = item.type === 'lead' && !item.isCompleted && !isMultiSelectMode;

  const handleApprove = useCallback(() => {
    hapticFeedback.success();
    onApprove();
    toastManager.success('Lead approved!');
  }, [onApprove]);

  const handleReject = useCallback(() => {
    hapticFeedback.medium();
    onReject();
    toastManager.info('Lead skipped');
  }, [onReject]);

  const handlePress = useCallback(() => {
    hapticFeedback.light();
    onPress();
  }, [onPress]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-30, 30])
    .failOffsetY([-15, 15])
    .enabled(canSwipe)
    .onUpdate((event) => {
      'worklet';
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      'worklet';
      if (event.translationX > ACTION_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH, { duration: 200 }, () => {
          runOnJS(handleApprove)();
        });
      } else if (event.translationX < -ACTION_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH, { duration: 200 }, () => {
          runOnJS(handleReject)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onStart(() => {
      'worklet';
      // Required for tap to register
    })
    .onEnd(() => {
      'worklet';
      runOnJS(handlePress)();
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(400)
    .onStart(() => {
      'worklet';
      runOnJS(onLongPress)();
    });

  // Compose gestures - pan is exclusive (either swipe OR tap/longpress)
  // Use Race for non-swipeable items to ensure tap registers properly
  const composedGesture = canSwipe
    ? Gesture.Exclusive(panGesture, Gesture.Race(tapGesture, longPressGesture))
    : Gesture.Race(tapGesture, longPressGesture);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const leftActionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(translateX.value, [0, ACTION_THRESHOLD], [0.8, 1], Extrapolation.CLAMP) },
    ],
  }));

  const rightActionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(translateX.value, [-ACTION_THRESHOLD, 0], [1, 0.8], Extrapolation.CLAMP) },
    ],
  }));

  // Get intent color and icon
  const getIntentStyles = (intent?: string) => {
    switch (intent) {
      case 'high':
        return { color: '#10B981', bgColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5', label: 'High' };
      case 'medium':
        return { color: '#F59E0B', bgColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB', label: 'Med' };
      default:
        return { color: '#6B7280', bgColor: isDark ? 'rgba(107, 114, 128, 0.15)' : '#F9FAFB', label: 'Low' };
    }
  };

  const intentStyles = getIntentStyles(item.buyingIntent);

  return (
    <View style={styles.swipeContainer}>
      {/* Swipe action backgrounds */}
      {canSwipe && (
        <>
          {/* Left - Approve */}
          <Animated.View style={[styles.swipeActionLeft, leftActionStyle]}>
            <View style={styles.swipeActionContent}>
              <Check size={22} color="#fff" strokeWidth={2.5} />
              <Text style={styles.swipeActionText}>Approve</Text>
            </View>
          </Animated.View>

          {/* Right - Skip */}
          <Animated.View style={[styles.swipeActionRight, rightActionStyle]}>
            <View style={styles.swipeActionContent}>
              <Text style={styles.swipeActionText}>Skip</Text>
              <X size={22} color="#fff" strokeWidth={2.5} />
            </View>
          </Animated.View>
        </>
      )}

      <GestureDetector gesture={composedGesture}>
        <Animated.View
          style={[
            styles.itemCard,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
            },
            item.isCompleted && styles.itemCardCompleted,
            isSelected && { borderWidth: 2, borderColor: color },
            cardStyle,
          ]}
        >
          {/* Multi-select checkbox */}
          {isMultiSelectMode && (
            <View
              style={[
                styles.checkbox,
                { borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : '#D1D5DB' },
                isSelected && { backgroundColor: color, borderColor: color },
              ]}
            >
              {isSelected && <Check size={14} color="#fff" strokeWidth={2.5} />}
            </View>
          )}

          {/* Main content */}
          <View style={styles.cardContent}>
            {/* Top row: Type icon, Title, Time */}
            <View style={styles.cardTopRow}>
              {/* Type indicator */}
              <View style={[
                styles.typeIndicator,
                item.type === 'lead' && { backgroundColor: isDark ? 'rgba(255, 69, 0, 0.15)' : '#FFF7ED' },
                item.type === 'message' && { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF' },
                item.type === 'question' && { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : '#F5F3FF' },
              ]}>
                {item.type === 'lead' && <Target size={14} color="#FF4500" />}
                {item.type === 'message' && <MessageCircle size={14} color="#3B82F6" />}
                {item.type === 'question' && <HelpCircle size={14} color="#8B5CF6" />}
              </View>

              {/* Title */}
              <Text
                style={[
                  styles.cardTitle,
                  { color: isDark ? '#F9FAFB' : '#111827' },
                  item.isCompleted && { color: isDark ? '#6B7280' : '#9CA3AF' },
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>

              {/* Unread indicator */}
              {item.isUnread && !item.isCompleted && (
                <View style={[styles.unreadIndicator, { backgroundColor: color }]} />
              )}

              {/* Time */}
              <Text style={[styles.cardTime, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                {formatRelativeTime(item.timestamp)}
              </Text>
            </View>

            {/* Subtitle / Preview */}
            <Text
              style={[
                styles.cardSubtitle,
                { color: isDark ? '#9CA3AF' : '#6B7280' },
                item.isCompleted && { color: isDark ? '#4B5563' : '#D1D5DB' },
              ]}
              numberOfLines={2}
            >
              {item.subtitle}
            </Text>

            {/* Bottom row: Tags */}
            <View style={styles.cardBottomRow}>
              {/* Subreddit badge */}
              {item.type === 'lead' && item.subreddit && (
                <View style={[styles.tagBadge, { backgroundColor: isDark ? 'rgba(255, 69, 0, 0.12)' : '#FFF0ED' }]}>
                  <Text style={[styles.tagText, { color: '#FF4500' }]}>r/{item.subreddit}</Text>
                </View>
              )}

              {/* Intent badge */}
              {item.type === 'lead' && item.buyingIntent && (
                <View style={[styles.intentPill, { backgroundColor: intentStyles.bgColor }]}>
                  <View style={[styles.intentDot, { backgroundColor: intentStyles.color }]} />
                  <Text style={[styles.intentLabel, { color: intentStyles.color }]}>
                    {intentStyles.label}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

function InboxScreen() {
  // Get route params for initial filter
  const route = useRoute<RouteProp<TabParamList, 'Inbox'>>();
  const initialFilter = route.params?.initialFilter;

  // Get store actions via getState() to avoid re-renders - these are stable references
  const {
    loadInboxItems,
    loadMoreInboxItems,
    setupRealtimeListeners,
    cleanupListeners,
    enableMultiSelect,
    disableMultiSelect,
    toggleItemSelection,
    selectAllItems,
    massApproveSelected,
    massRejectSelected,
  } = useInboxStore.getState();

  // OPTIMIZED: Subscribe to only primitives for UI state
  const isMultiSelectMode = useInboxStore(state => state.isMultiSelectMode);
  const selectedItemIds = useInboxStore(state => state.selectedItemIds);
  const isLoadingMore = useInboxStore(state => state.isLoadingMore);
  const hasMoreFirestoreItems = useInboxStore(state => state.hasMoreFirestoreItems);

  // Use selectors for workspace to avoid full object subscription
  const currentWorkspaceId = useWorkspaceStore(state => state.currentWorkspace?.id);

  // Use selectors for hunting store - use primitive values only
  const activeSession = useHuntingStore(state => state.activeSession);
  const isHunting = useHuntingStore(state => state.isHunting);
  const prospectsScanned = useHuntingStore(state => state.stats.prospectsScanned);
  const leadsQualified = useHuntingStore(state => state.stats.leadsQualified);
  const pauseHunting = useHuntingStore(state => state.pauseHunting);
  const stopHunting = useHuntingStore(state => state.stopHunting);

  // Subscription state - for showing upgrade button
  const isPremium = useSubscriptionStore(state => state.isPremium);

  const [isControlModalVisible, setIsControlModalVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>(initialFilter || 'all');
  const [searchText, setSearchText] = useState('');
  const [isReady, setIsReady] = useState(false);
  const navigation = useNavigation<NavigationProp>();
  const confirmationSheetRef = useRef<ConfirmationSheetRef>(null);
  const { color, colorWithOpacity } = useWorkspaceColor();
  const { isDark } = useTheme();
  const glass = isDark ? GLASS.dark : GLASS.light;

  const workspaceId = currentWorkspaceId || 'default-workspace';

  // Get the full inbox items array and filter in useMemo to avoid infinite re-renders
  // Using a selector that returns a new array on every call causes Zustand to trigger re-renders
  const allInboxItems = useInboxStore(state => state.inboxItems);
  const workspaceInboxItems = useMemo(
    () => allInboxItems.filter(item => item.workspaceId === workspaceId),
    [allInboxItems, workspaceId],
  );

  // Apply initial filter from route params
  useEffect(() => {
    if (initialFilter) {
      setActiveFilter(initialFilter);
    }
  }, [initialFilter]);

  // Defer heavy work until after navigation completes
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
    return () => task.cancel();
  }, []);

  useEffect(() => {
    const loadSession = async () => {
      try {
        await useHuntingStore.getState().loadActiveSession();
      } catch (error) {
        console.error('Failed to load active hunting session:', error);
      }
    };
    loadSession();
  }, []);

  useEffect(() => {
    if (currentWorkspaceId) {
      // Only load if we don't already have data - pass false for reset
      loadInboxItems(currentWorkspaceId, false);
      setupRealtimeListeners(currentWorkspaceId);
      return () => cleanupListeners();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspaceId]);

  // Transform all items into a unified format
  // Now uses workspaceInboxItems which is already filtered by workspace
  const unifiedItems = useMemo((): UnifiedInboxItem[] => {
    const items: UnifiedInboxItem[] = [];

    workspaceInboxItems.forEach(item => {
      // Skip comment approvals - they're handled separately
      if (item.type === 'comment_approval') return;

      if (item.type === 'approval_request') {
        // Lead
        const subreddit = item.post?.subreddit || '';

        items.push({
          id: item.id,
          type: 'lead',
          title: item.post?.title || item.title.replace(/^New Reddit Lead: /, ''),
          subtitle: subreddit ? `r/${subreddit}` : 'Reddit Lead',
          timestamp: new Date(item.createdAt),
          isUnread: item.status === 'pending' && !item.completed,
          isCompleted: item.completed || false,
          subreddit,
          buyingIntent: item.tags?.find(t => ['high', 'medium', 'low'].includes(t)),
          originalItem: item,
        });
      } else if (item.id.startsWith('reddit_')) {
        // Reddit message
        const metadata = (item as any).metadata || {};
        const isDM = item.id.startsWith('reddit_dm_');

        items.push({
          id: item.id,
          type: 'message',
          title: isDM ? `u/${metadata.conversationAuthor || metadata.author}` : item.title,
          subtitle: item.content,
          timestamp: new Date(item.createdAt),
          isUnread: item.status === 'pending',
          isCompleted: item.completed || false,
          originalItem: item,
        });
      } else if (item.type === 'proactive_question' || item.type === 'agent_question') {
        // Question
        items.push({
          id: item.id,
          type: 'question',
          title: item.title,
          subtitle: item.content,
          timestamp: new Date(item.createdAt),
          isUnread: item.status === 'pending',
          isCompleted: item.completed || false,
          originalItem: item,
        });
      }
    });

    // Deduplicate by id (items from multiple sources may have same id)
    const seenIds = new Set<string>();
    const uniqueItems = items.filter(item => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });

    // Sort by timestamp (newest first), but keep unread items at top
    uniqueItems.sort((a, b) => {
      // Unread items first
      if (a.isUnread !== b.isUnread) return a.isUnread ? -1 : 1;
      // Then by timestamp
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    return uniqueItems;
  }, [workspaceInboxItems]);

  // Get comment approvals separately (also deduplicated)
  const commentApprovals = useMemo(() => {
    const approvals = workspaceInboxItems.filter(
      item => item.type === 'comment_approval',
    );
    const seenIds = new Set<string>();
    return approvals.filter(item => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });
  }, [workspaceInboxItems]);

  // Filter items
  const filteredItems = useMemo(() => {
    let items = unifiedItems;

    // Apply type filter
    if (activeFilter === 'leads') {
      items = items.filter(item => item.type === 'lead');
    } else if (activeFilter === 'messages') {
      items = items.filter(item => item.type === 'message');
    } else if (activeFilter === 'pending') {
      items = items.filter(item => item.isUnread && !item.isCompleted);
    }

    // Apply search filter
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      items = items.filter(item =>
        item.title.toLowerCase().includes(search) ||
        item.subtitle.toLowerCase().includes(search),
      );
    }

    return items;
  }, [unifiedItems, activeFilter, searchText]);

  // Load more handler - now uses server-side pagination from store
  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMoreFirestoreItems) return;
    loadMoreInboxItems(workspaceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingMore, hasMoreFirestoreItems, workspaceId]);

  // Count for filter badges - single pass through items for efficiency
  const counts = useMemo(() => {
    let leads = 0;
    let messages = 0;
    let pending = 0;
    for (const item of unifiedItems) {
      if (item.type === 'lead') leads++;
      else if (item.type === 'message') messages++;
      if (item.isUnread && !item.isCompleted) pending++;
    }
    return { all: unifiedItems.length, leads, messages, pending };
  }, [unifiedItems]);

  const handleAgentStatusPress = useCallback(() => {
    if (!isHunting || !activeSession) return;
    hapticFeedback.light();
    setIsControlModalVisible(true);
  }, [isHunting, activeSession]);

  const handlePauseAgent = async () => {
    try {
      hapticFeedback.medium();
      await pauseHunting();
      toastManager.success('Agent paused');
    } catch {
      toastManager.error('Failed to pause agent');
    }
  };

  const handleStopAgent = async () => {
    hapticFeedback.medium();
    confirmationSheetRef.current?.show({
      title: 'Stop Agent?',
      message: 'This will stop the hunting session.',
      confirmText: 'Stop',
      cancelText: 'Cancel',
      destructive: true,
      onConfirm: async () => {
        try {
          await stopHunting();
          toastManager.success('Agent stopped');
        } catch {
          toastManager.error('Failed to stop');
        }
      },
    });
  };

  const handleCardPress = useCallback((id: string) => {
    if (isMultiSelectMode) {
      const item = unifiedItems.find(i => i.id === id);
      if (item?.isCompleted) return;
      toggleItemSelection(id);
      return;
    }
    navigation.navigate('ChatScreen', { inboxItemId: id });
  }, [isMultiSelectMode, unifiedItems, toggleItemSelection, navigation]);

  const handleLongPress = useCallback((id: string) => {
    const item = unifiedItems.find(i => i.id === id);
    if (item?.isCompleted) return;
    if (!isMultiSelectMode) {
      enableMultiSelect();
      toggleItemSelection(id);
      hapticFeedback.medium();
    }
  }, [unifiedItems, isMultiSelectMode, enableMultiSelect, toggleItemSelection]);

  const handleSelectAll = () => {
    const selectableItems = filteredItems
      .filter(item => !item.isCompleted)
      .map(item => item.originalItem);
    selectAllItems(selectableItems);
    hapticFeedback.light();
  };

  const handleMassApprove = async () => {
    hapticFeedback.medium();
    confirmationSheetRef.current?.show({
      title: 'Approve Selected',
      message: `Approve ${selectedItemIds.length} item${selectedItemIds.length !== 1 ? 's' : ''}?`,
      confirmText: 'Approve',
      cancelText: 'Cancel',
      destructive: false,
      onConfirm: async () => {
        try {
          await massApproveSelected();
          toastManager.success('Items approved');
        } catch {
          toastManager.error('Failed to approve');
        }
      },
    });
  };

  const handleMassReject = async () => {
    hapticFeedback.medium();
    confirmationSheetRef.current?.show({
      title: 'Reject Selected',
      message: `Reject ${selectedItemIds.length} item${selectedItemIds.length !== 1 ? 's' : ''}?`,
      confirmText: 'Reject',
      cancelText: 'Cancel',
      destructive: true,
      onConfirm: async () => {
        try {
          await massRejectSelected();
          toastManager.success('Items rejected');
        } catch {
          toastManager.error('Failed to reject');
        }
      },
    });
  };

  const gradientColors = isDark
    ? [
      colorWithOpacity(0.2),
      colorWithOpacity(0.1),
      '#111827',
    ] as const
    : [
      colorWithOpacity(0.12),
      colorWithOpacity(0.04),
      '#F8F9FA',
    ] as const;

  // Combined list data for FlashList - all filtered items (server handles pagination)
  const listData = useMemo(() => filteredItems, [filteredItems]);

  // Single item approve/reject handlers for swipe
  const handleApproveItem = useCallback(async (itemId: string) => {
    try {
      const { markMessageAsRead } = useInboxStore.getState();
      await markMessageAsRead(itemId);
    } catch (error) {
      console.error('Failed to approve item:', error);
    }
  }, []);

  const handleRejectItem = useCallback(async (itemId: string) => {
    try {
      const { deleteInboxItem } = useInboxStore.getState();
      await deleteInboxItem(itemId);
    } catch (error) {
      console.error('Failed to reject item:', error);
    }
  }, []);

  // Render individual list item using memoized component
  const renderListItem = useCallback(({ item }: { item: UnifiedInboxItem }) => {
    const isSelected = selectedItemIds.includes(item.id);

    return (
      <SwipeableInboxItemCard
        item={item}
        isSelected={isSelected}
        isMultiSelectMode={isMultiSelectMode}
        color={color}
        glass={glass}
        isDark={isDark}
        onPress={() => handleCardPress(item.id)}
        onLongPress={() => handleLongPress(item.id)}
        onApprove={() => handleApproveItem(item.id)}
        onReject={() => handleRejectItem(item.id)}
      />
    );
  }, [selectedItemIds, isMultiSelectMode, color, glass, isDark, handleCardPress, handleLongPress, handleApproveItem, handleRejectItem]);

  // List header with agent status and comment approvals
  const listHeader = useMemo(() => (
    <>
      {/* Agent Status */}
      {isHunting && activeSession && (
        <Pressable onPress={handleAgentStatusPress} style={[styles.agentCard, { backgroundColor: glass.background, borderColor: glass.border }]}>
          <View style={[styles.agentIcon, { backgroundColor: colorWithOpacity(0.15) }]}>
            <Zap size={20} color={color} />
          </View>
          <View style={styles.agentContent}>
            <Text style={[styles.agentTitle, { color: glass.text }]}>Agent Active</Text>
            <Text style={[styles.agentSubtitle, { color: glass.textMuted }]}>
              {prospectsScanned} scanned · {leadsQualified} leads
            </Text>
          </View>
          <View style={[styles.agentPulse, { backgroundColor: color }]} />
        </Pressable>
      )}

      {/* Comment Approvals - Priority items */}
      {commentApprovals.map(approval => {
        if (!approval.post || !approval.comment || !approval.pendingCommentId) return null;
        return (
          <CommentApprovalCard
            key={approval.id}
            id={approval.id}
            post={approval.post}
            comment={approval.comment}
            aiQualityCheck={approval.aiQualityCheck}
            pendingCommentId={approval.pendingCommentId}
            createdAt={approval.createdAt}
            onApprove={() => loadInboxItems(workspaceId)}
            onReject={() => loadInboxItems(workspaceId)}
          />
        );
      })}

      {/* Upgrade Banner for free users */}
      {!isPremium && (
        <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 4 }}>
          <UpgradeButton variant="banner" />
        </View>
      )}
    </>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [isHunting, activeSession, prospectsScanned, leadsQualified, color, colorWithOpacity, commentApprovals, workspaceId, handleAgentStatusPress, glass, isPremium]);

  // Empty state component
  const emptyComponent = useMemo(() => {
    if (filteredItems.length > 0 || commentApprovals.length > 0) return null;
    return (
      <View style={styles.emptyState}>
        <View style={[styles.emptyIcon, { backgroundColor: colorWithOpacity(0.1) }]}>
          <Mail size={32} color={color} />
        </View>
        <Text style={[styles.emptyTitle, { color: glass.text }]}>
          {searchText.trim()
            ? 'No results'
            : activeFilter === 'leads'
              ? 'No leads yet'
              : activeFilter === 'messages'
                ? 'No messages'
                : activeFilter === 'pending'
                  ? 'All caught up!'
                  : 'Inbox empty'}
        </Text>
        <Text style={[styles.emptySubtitle, { color: glass.textMuted }]}>
          {searchText.trim()
            ? 'Try a different search term'
            : activeFilter === 'pending'
              ? 'No pending items to review'
              : 'New leads and messages will appear here'}
        </Text>
      </View>
    );
  }, [filteredItems.length, commentApprovals.length, searchText, activeFilter, color, colorWithOpacity, glass]);

  // Show minimal skeleton while deferring heavy work
  if (!isReady) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F8F9FA' }]}>
        <LinearGradient
          colors={gradientColors}
          locations={[0, 0.3, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <GlobalHeader title="Inbox" transparent={true} />
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.headerSpacer} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F8F9FA' }]}>
      <LinearGradient
        colors={gradientColors}
        locations={[0, 0.3, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Fixed Header - Overlay with safe area */}
      <GlobalHeader title="Inbox" transparent={true} />

      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Spacer for GlobalHeader */}
        <View style={styles.headerSpacer} />

        {/* Multi-select header */}
        {isMultiSelectMode && (
          <View style={styles.header}>
            <Pressable onPress={disableMultiSelect} style={styles.headerButton}>
              <X size={24} color={isDark ? '#F9FAFB' : '#1A1A1A'} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: isDark ? '#F9FAFB' : '#1A1A1A' }]}>{selectedItemIds.length} Selected</Text>
            <Pressable onPress={handleSelectAll} style={styles.headerButton}>
              <Text style={[styles.selectAllText, { color }]}>All</Text>
            </Pressable>
          </View>
        )}

        {/* Search */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: glass.background, borderColor: glass.border, borderWidth: 1 }]}>
            <Search size={18} color={glass.textMuted} />
            <TextInput
              placeholder="Search..."
              placeholderTextColor={glass.textMuted}
              value={searchText}
              onChangeText={setSearchText}
              style={[styles.searchInput, { color: glass.text }]}
            />
            {searchText.length > 0 && (
              <Pressable onPress={() => setSearchText('')} hitSlop={8}>
                <X size={18} color={glass.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {[
            { key: 'all', label: 'All', count: counts.all },
            { key: 'leads', label: 'Leads', count: counts.leads },
            { key: 'messages', label: 'Messages', count: counts.messages },
            { key: 'pending', label: 'Pending', count: counts.pending },
          ].map(filter => (
            <Pressable
              key={filter.key}
              onPress={() => {
                setActiveFilter(filter.key as FilterType);
                hapticFeedback.light();
              }}
              style={[
                styles.filterPill,
                {
                  backgroundColor: isDark ? glass.background : 'rgba(255, 255, 255, 0.5)',
                  borderColor: isDark ? glass.border : 'rgba(0, 0, 0, 0.08)',
                  borderWidth: 1,
                },
                activeFilter === filter.key && { backgroundColor: color, borderColor: color },
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  { color: glass.textSecondary },
                  activeFilter === filter.key && styles.filterPillTextActive,
                ]}
              >
                {filter.label}
              </Text>
              {filter.count > 0 && (
                <View
                  style={[
                    styles.filterPillBadge,
                    activeFilter === filter.key
                      ? { backgroundColor: 'rgba(255,255,255,0.3)' }
                      : { backgroundColor: glass.backgroundMedium },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterPillBadgeText,
                      { color: isDark ? '#9CA3AF' : '#6B7280' },
                      activeFilter === filter.key && { color: '#fff' },
                    ]}
                  >
                    {filter.count}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>

        {/* Multi-select actions */}
        {isMultiSelectMode && selectedItemIds.length > 0 && (
          <View style={styles.actionBar}>
            <Pressable
              onPress={handleMassApprove}
              style={[styles.actionButton, { backgroundColor: color }]}
            >
              <Check size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Approve</Text>
            </Pressable>
            <Pressable onPress={handleMassReject} style={styles.rejectButton}>
              <X size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Reject</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>

      <FlashList
        data={listData}
        renderItem={renderListItem}
        keyExtractor={item => item.id}
        estimatedItemSize={100}
        drawDistance={250}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyComponent}
        ListFooterComponent={
          <View style={styles.footerContainer}>
            {isLoadingMore && (
              <ActivityIndicator size="small" color={color} style={styles.loadingIndicator} />
            )}
            {hasMoreFirestoreItems && !isLoadingMore && (
              <Text style={[styles.loadMoreText, { color: glass.textMuted }]}>
                Load more items
              </Text>
            )}
            <View style={{ height: 100 }} />
          </View>
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        extraData={selectedItemIds.length + (isMultiSelectMode ? 1 : 0)}
      />

      <AgentControlModal
        isVisible={isControlModalVisible}
        onClose={() => setIsControlModalVisible(false)}
        session={activeSession}
        onPause={handlePauseAgent}
        onStop={handleStopAgent}
      />
      <ConfirmationSheet ref={confirmationSheetRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  safeArea: {
    backgroundColor: 'transparent',
  },
  headerSpacer: {
    height: 80,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  headerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  selectAllText: {
    fontSize: 15,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    marginLeft: 10,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterPillTextActive: {
    color: '#fff',
  },
  filterPillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  filterPillBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  rejectButton: {
    flex: 0.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 4,
  },
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  agentIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentContent: {
    flex: 1,
    marginLeft: 12,
  },
  agentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  agentSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  agentPulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  itemCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  itemCardCompleted: {
    opacity: 0.6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  itemTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  itemTitleCompleted: {
    color: '#9CA3AF',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  itemSubtitleCompleted: {
    color: '#9CA3AF',
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  subredditBadge: {
    backgroundColor: '#FFF0ED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  subredditText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FF4500',
  },
  intentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  intentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  footerContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  loadingIndicator: {
    marginVertical: 8,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '500',
    marginVertical: 8,
  },
  // Swipe styles
  swipeContainer: {
    marginHorizontal: 16,
    marginBottom: 10,
    position: 'relative',
  },
  swipeActionLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 100,
    backgroundColor: '#10B981',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 20,
    zIndex: -1,
  },
  swipeActionRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
    backgroundColor: '#EF4444',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
    zIndex: -1,
  },
  swipeActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // Card styles
  cardContent: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  typeIndicator: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  cardTime: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 8,
  },
  unreadIndicator: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginLeft: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
    marginLeft: 38,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 38,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  intentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
  },
  intentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  intentLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Legacy styles (kept for compatibility)
  hintLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: -1,
  },
  hintRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: -1,
  },
  hintIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintTextApprove: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22C55E',
  },
  hintTextReject: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  swipeHintBar: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
  },
  swipeHintText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

export default withScreenErrorBoundary('InboxScreen', {
  showRetryButton: true,
  maxRetries: 3,
  fallbackMessage: 'Something went wrong. Please try again.',
})(InboxScreen);
