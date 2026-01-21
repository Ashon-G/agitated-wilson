/**
 * DashboardOverlay - Container for all holographic cards
 * v7 - SwipeableCard handles minimize/restore internally
 *
 * Cards are positioned higher on screen, scrollable vertically.
 * Swipe right: Dismiss (if allowed)
 * Swipe left: Genie animation into icon, tap icon to restore
 * Rubber band scroll even when cards don't fill screen.
 */

import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, ScrollView } from 'react-native';
import Animated, {
  FadeIn,
  SlideInRight,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  UserCheck,
  MessageCircle,
  HelpCircle,
  Target,
  ChevronRight,
  Play,
  Crown,
  BadgeDollarSign,
} from 'lucide-react-native';
import { useDashboardState } from '../../hooks/useDashboardState';
import SwipeableCard from './SwipeableCard';
import SwipeTutorial from './SwipeTutorial';
import HolographicCard, { CardIcon, CardBadge, getDarkerColor } from './HolographicCard';
import LeadApprovalCard from './LeadApprovalCard';
import UpgradeButton from '../UpgradeButton';
import YandexAdCard from './YandexAdCard';
import useQuestStore from '../../state/questStore';
import useInboxStore from '../../state/inboxStore';
import useWorkspaceStore from '../../state/workspaceStore';
import useDashboardUIStore from '../../state/dashboardUIStore';
import useSubscriptionStore from '../../state/subscriptionStore';
import type { CardId as DashboardCardId } from '../../state/dashboardUIStore';
import { hapticFeedback } from '../../utils/hapticFeedback';
import { useTheme } from '../../contexts/ThemeContext';

// Card configuration - defines icon, color, and dismissability
const CARD_CONFIG = {
  approvals: {
    id: 'approvals',
    icon: UserCheck,
    color: '#22C55E',
    label: 'Approvals',
    canDismiss: true,
  },
  inbox: {
    id: 'inbox',
    icon: MessageCircle,
    color: '#38BDF8',
    label: 'Replies',
    canDismiss: true,
  },
  quest: {
    id: 'quest',
    icon: HelpCircle,
    color: '#F472B6',
    label: 'Quest',
    canDismiss: true,
  },
  question: {
    id: 'question',
    icon: Target,
    color: '#A78BFA',
    label: 'Question',
    canDismiss: true,
  },
  upgrade: {
    id: 'upgrade',
    icon: Crown,
    color: '#8B5CF6',
    label: 'Upgrade',
    canDismiss: false,
  },
  ad: {
    id: 'ad',
    icon: BadgeDollarSign,
    color: '#F59E0B',
    label: 'Ad',
    canDismiss: true,
  },
} as const;

type CardId = keyof typeof CARD_CONFIG;

interface DashboardOverlayProps {
  onSpeechTrigger?: (message: string) => void;
}

/**
 * Compact Quest Card - Smaller holographic version
 */
function CompactQuestCard({ onPress, isDark }: { onPress: () => void; isDark: boolean }) {
  const currentQuest = useQuestStore(s => s.currentQuest);
  const pinkColor = isDark ? '#F472B6' : getDarkerColor('#F472B6');

  if (!currentQuest) return null;

  return (
    <HolographicCard
      gradientColors={isDark
        ? ['rgba(244, 114, 182, 0.2)', 'rgba(129, 140, 248, 0.15)', 'rgba(56, 189, 248, 0.1)']
        : ['rgba(244, 114, 182, 0.25)', 'rgba(129, 140, 248, 0.2)', 'rgba(56, 189, 248, 0.15)']}
      glowColor={isDark ? 'rgba(244, 114, 182, 0.4)' : 'rgba(244, 114, 182, 0.3)'}
    >
      <View style={styles.compactCard}>
        <View style={styles.compactHeader}>
          <CardIcon color="#F472B6">
            <HelpCircle size={18} color={pinkColor} />
          </CardIcon>
          <View style={styles.compactHeaderText}>
            <Text style={[styles.compactTitle, !isDark && { color: '#1F2937' }]}>Quick Question</Text>
            <Text style={[styles.compactSubtitle, !isDark && { color: 'rgba(31, 41, 55, 0.7)' }]} numberOfLines={1}>
              {currentQuest.question}
            </Text>
          </View>
          <View style={styles.compactAction}>
            <View style={[styles.playIcon, !isDark && { backgroundColor: `${pinkColor}20` }]}>
              <Play size={14} color={pinkColor} fill={pinkColor} />
            </View>
            <ChevronRight size={16} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'} />
          </View>
        </View>
      </View>
    </HolographicCard>
  );
}

/**
 * Compact Inbox Replies Card - Smaller holographic version
 */
function CompactInboxCard({
  unreadReplies,
  onPress,
  isDark,
}: {
  unreadReplies: number;
  onPress: () => void;
  isDark: boolean;
}) {
  const blueColor = isDark ? '#38BDF8' : getDarkerColor('#38BDF8');

  if (unreadReplies === 0) return null;

  return (
    <HolographicCard
      gradientColors={isDark
        ? ['rgba(56, 189, 248, 0.2)', 'rgba(14, 165, 233, 0.15)', 'rgba(2, 132, 199, 0.1)']
        : ['rgba(56, 189, 248, 0.25)', 'rgba(14, 165, 233, 0.2)', 'rgba(2, 132, 199, 0.15)']}
      glowColor={isDark ? 'rgba(56, 189, 248, 0.4)' : 'rgba(56, 189, 248, 0.3)'}
    >
      <View style={styles.compactCard}>
        <View style={styles.compactHeader}>
          <CardIcon color="#38BDF8">
            <MessageCircle size={18} color={blueColor} />
          </CardIcon>
          <View style={styles.compactHeaderText}>
            <Text style={[styles.compactTitle, !isDark && { color: '#1F2937' }]}>New Replies</Text>
            <Text style={[styles.compactSubtitle, !isDark && { color: 'rgba(31, 41, 55, 0.7)' }]}>
              {unreadReplies === 1 ? 'Someone replied!' : `${unreadReplies} new messages`}
            </Text>
          </View>
          <View style={styles.compactBadgeRow}>
            <CardBadge count={unreadReplies} color="#38BDF8" />
            <ChevronRight size={16} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'} />
          </View>
        </View>
      </View>
    </HolographicCard>
  );
}

/**
 * Compact Question Card - For proactive questions
 */
function CompactQuestionCard({ onPress, isDark }: { onPress: () => void; isDark: boolean }) {
  const purpleColor = isDark ? '#A78BFA' : getDarkerColor('#A78BFA');

  return (
    <HolographicCard
      gradientColors={isDark
        ? ['rgba(167, 139, 250, 0.2)', 'rgba(139, 92, 246, 0.15)', 'rgba(124, 58, 237, 0.1)']
        : ['rgba(167, 139, 250, 0.25)', 'rgba(139, 92, 246, 0.2)', 'rgba(124, 58, 237, 0.15)']}
      glowColor={isDark ? 'rgba(167, 139, 250, 0.4)' : 'rgba(167, 139, 250, 0.3)'}
    >
      <View style={styles.compactCard}>
        <View style={styles.compactHeader}>
          <CardIcon color="#A78BFA">
            <Target size={18} color={purpleColor} />
          </CardIcon>
          <View style={styles.compactHeaderText}>
            <Text style={[styles.compactTitle, !isDark && { color: '#1F2937' }]}>Quick Question</Text>
            <Text style={[styles.compactSubtitle, !isDark && { color: 'rgba(31, 41, 55, 0.7)' }]}>Help improve your agent</Text>
          </View>
          <View style={styles.compactAction}>
            <ChevronRight size={16} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'} />
          </View>
        </View>
      </View>
    </HolographicCard>
  );
}

export default function DashboardOverlay({ onSpeechTrigger }: DashboardOverlayProps) {
  const dashboardState = useDashboardState();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();

  // Use persisted UI state from store (survives tab switches)
  const dismissCard = useDashboardUIStore(s => s.dismissCard);
  const isCardDismissed = useDashboardUIStore(s => s.isCardDismissed);
  const hasTriggeredSpeech = useDashboardUIStore(s => s.hasTriggeredSpeech);
  const setSpeechTriggered = useDashboardUIStore(s => s.setSpeechTriggered);

  // Swipe tutorial state - shows until user minimizes first card
  const hasEverMinimizedCard = useDashboardUIStore(s => s.hasEverMinimizedCard);
  const swipeTutorialLoaded = useDashboardUIStore(s => s.swipeTutorialLoaded);
  const loadSwipeTutorialState = useDashboardUIStore(s => s.loadSwipeTutorialState);

  // Load swipe tutorial state from AsyncStorage on mount
  useEffect(() => {
    if (!swipeTutorialLoaded) {
      loadSwipeTutorialState();
    }
  }, [swipeTutorialLoaded, loadSwipeTutorialState]);

  // Subscription state - for showing upgrade banner
  const isPremium = useSubscriptionStore(s => s.isPremium);

  // Quest and question state - use primitive selectors
  const currentQuest = useQuestStore(s => s.currentQuest);
  const currentWorkspaceId = useWorkspaceStore(s => s.currentWorkspace?.id);

  // OPTIMIZED: Use a selector that only returns whether there's a proactive question
  // instead of subscribing to the entire inboxItems array
  const hasProactiveQuestion = useInboxStore(
    useCallback(
      (s) => s.inboxItems.some(
        item =>
          item.type === 'proactive_question' &&
          item.workspaceId === currentWorkspaceId &&
          !item.completed,
      ),
      [currentWorkspaceId],
    ),
  );

  // Determine which cards should show
  const hasApprovals = dashboardState.pendingApprovals > 0;
  const hasReplies = dashboardState.unreadReplies > 0;
  const hasQuest = !!currentQuest;
  const hasQuestion = hasProactiveQuestion;

  // Handle dismissing a card (permanently) - uses store for persistence
  const handleDismiss = useCallback((cardId: CardId) => {
    dismissCard(cardId as DashboardCardId);
  }, [dismissCard]);

  // Check if a card is dismissed - uses store for persistence
  const isDismissed = (cardId: CardId) => isCardDismissed(cardId as DashboardCardId);

  // Navigation handlers
  const handleApprovalsPress = () => {
    hapticFeedback.medium();
    navigation.navigate('Main', { screen: 'Inbox' });
  };

  const handleQuestPress = () => {
    hapticFeedback.medium();
    if (currentQuest) {
      navigation.navigate('ChatScreen', { questId: currentQuest.id });
    }
  };

  const handleInboxPress = () => {
    hapticFeedback.medium();
    navigation.navigate('Main', { screen: 'Inbox' });
  };

  const handleQuestionPress = () => {
    hapticFeedback.medium();
  };

  // Speech trigger effect - uses store for persistence across tab switches
  useEffect(() => {
    if (!onSpeechTrigger || dashboardState.isLoading || hasTriggeredSpeech) return;

    if (hasApprovals) {
      const count = dashboardState.pendingApprovals;
      const message = count === 1
        ? 'Hey! I\'ve got a lead that needs your approval.'
        : `Hey! I\'ve got ${count} leads that need your approval.`;
      setSpeechTriggered();
      onSpeechTrigger(message);
    } else if (hasReplies) {
      const count = dashboardState.unreadReplies;
      const message = count === 1
        ? 'Someone replied to your comment! Check it out.'
        : `You've got ${count} new replies waiting for you.`;
      setSpeechTriggered();
      onSpeechTrigger(message);
    } else if (dashboardState.setupProgress < 100 && !dashboardState.isRedditConnected) {
      setSpeechTriggered();
      onSpeechTrigger('Let\'s get you set up! Connect your Reddit account so I can start finding leads.');
    }
  }, [
    dashboardState.pendingApprovals,
    dashboardState.unreadReplies,
    dashboardState.isRedditConnected,
    dashboardState.isLoading,
    dashboardState.setupProgress,
    hasApprovals,
    hasReplies,
    onSpeechTrigger,
    hasTriggeredSpeech,
    setSpeechTriggered,
  ]);

  // Show Yandex ad (always visible unless dismissed)
  const showAd = !isDismissed('ad');

  // Calculate visible cards count (cards that should render)
  const visibleCards = [
    hasApprovals && !isDismissed('approvals'),
    hasReplies && !isDismissed('inbox'),
    hasQuest && !isDismissed('quest'),
    hasQuestion && !isDismissed('question'),
    showAd,
  ].filter(Boolean).length;

  // Show upgrade banner for free users even when no other cards
  const showUpgradeBanner = !isPremium;

  // If no cards to show and user is premium, render nothing
  if (visibleCards === 0 && !showUpgradeBanner) return null;

  // Calculate positions
  const headerHeight = insets.top + 80;
  const tabBarHeight = 90 + insets.bottom;

  return (
    <Animated.View
      entering={FadeIn.duration(400).delay(50)}
      style={[
        styles.container,
        {
          top: insets.top, // Start from safe area top to allow scrolling under header
          bottom: tabBarHeight,
        },
      ]}
      pointerEvents="box-none"
    >
      {/* Main scrollable content area for priority cards */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: 80 }, // Push content down to start below header
        ]}
        showsVerticalScrollIndicator={false}
        bounces={true}
        alwaysBounceVertical={true}
      >
        {/* Lead Approvals Card */}
        {hasApprovals && !isDismissed('approvals') && (
          <SwipeableCard
            id="approvals"
            icon={CARD_CONFIG.approvals.icon}
            iconColor={CARD_CONFIG.approvals.color}
            canDismiss={CARD_CONFIG.approvals.canDismiss}
            onDismiss={() => handleDismiss('approvals')}
            onTap={handleApprovalsPress}
          >
            <Animated.View
              entering={SlideInRight.delay(100).duration(450).springify().damping(18).stiffness(90)}
              style={styles.cardWrapper}
            >
              <LeadApprovalCard dashboardState={dashboardState} />
            </Animated.View>
          </SwipeableCard>
        )}

        {/* Inbox Replies Card - Compact version */}
        {hasReplies && !isDismissed('inbox') && (
          <SwipeableCard
            id="inbox"
            icon={CARD_CONFIG.inbox.icon}
            iconColor={CARD_CONFIG.inbox.color}
            canDismiss={CARD_CONFIG.inbox.canDismiss}
            onDismiss={() => handleDismiss('inbox')}
            onTap={handleInboxPress}
            badgeCount={dashboardState.unreadReplies}
          >
            <Animated.View
              entering={SlideInRight.delay(150).duration(450).springify().damping(18).stiffness(90)}
              style={styles.cardWrapper}
            >
              <CompactInboxCard
                unreadReplies={dashboardState.unreadReplies}
                onPress={handleInboxPress}
                isDark={isDark}
              />
            </Animated.View>
          </SwipeableCard>
        )}

        {/* Quest Card - Compact version */}
        {hasQuest && !isDismissed('quest') && (
          <SwipeableCard
            id="quest"
            icon={CARD_CONFIG.quest.icon}
            iconColor={CARD_CONFIG.quest.color}
            canDismiss={CARD_CONFIG.quest.canDismiss}
            onDismiss={() => handleDismiss('quest')}
            onTap={handleQuestPress}
          >
            <Animated.View
              entering={SlideInRight.delay(200).duration(450).springify().damping(18).stiffness(90)}
              style={styles.cardWrapper}
            >
              <CompactQuestCard onPress={handleQuestPress} isDark={isDark} />
            </Animated.View>
          </SwipeableCard>
        )}

        {/* Proactive Question Card - Compact version */}
        {hasQuestion && !isDismissed('question') && (
          <SwipeableCard
            id="question"
            icon={CARD_CONFIG.question.icon}
            iconColor={CARD_CONFIG.question.color}
            canDismiss={CARD_CONFIG.question.canDismiss}
            onDismiss={() => handleDismiss('question')}
            onTap={handleQuestionPress}
            badgeCount={1}
          >
            <Animated.View
              entering={SlideInRight.delay(250).duration(450).springify().damping(18).stiffness(90)}
              style={styles.cardWrapper}
            >
              <CompactQuestionCard onPress={handleQuestionPress} isDark={isDark} />
            </Animated.View>
          </SwipeableCard>
        )}

        {/* Yandex Native Ad - Swipeable and dismissible */}
        {showAd && (
          <SwipeableCard
            id="ad"
            icon={CARD_CONFIG.ad.icon}
            iconColor={CARD_CONFIG.ad.color}
            canDismiss={CARD_CONFIG.ad.canDismiss}
            onDismiss={() => handleDismiss('ad')}
            onTap={() => {
              hapticFeedback.medium();
              // Handle ad tap - could open upgrade screen or external link
            }}
          >
            <Animated.View
              entering={SlideInRight.delay(300).duration(450).springify().damping(18).stiffness(90)}
              style={styles.cardWrapper}
            >
              <YandexAdCard />
            </Animated.View>
          </SwipeableCard>
        )}

        {/* Upgrade Banner - Only shown for free users */}
        {!isPremium && (
          <SwipeableCard
            id="upgrade"
            icon={CARD_CONFIG.upgrade.icon}
            iconColor={CARD_CONFIG.upgrade.color}
            canDismiss={CARD_CONFIG.upgrade.canDismiss}
          >
            <Animated.View
              entering={SlideInRight.delay(350).duration(450).springify().damping(18).stiffness(90)}
              style={styles.cardWrapper}
            >
              <UpgradeButton variant="banner" />
            </Animated.View>
          </SwipeableCard>
        )}
      </ScrollView>

      {/* Swipe Tutorial - shows until user minimizes their first card */}
      <SwipeTutorial
        visible={swipeTutorialLoaded && !hasEverMinimizedCard && visibleCards > 0}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 50,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 8,
    paddingLeft: 60, // Offset from left to avoid overlapping minimized icons
    paddingRight: 20,
    gap: 12,
    alignItems: 'flex-end', // Align cards to the right
  },
  cardWrapper: {
    width: '100%',
  },
  // Compact card styles
  compactCard: {
    width: '100%',
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  compactSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
  compactAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(244, 114, 182, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
