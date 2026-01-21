import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
  SlideInUp,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Quest } from '../types/app';
import { hapticFeedback } from '../utils/hapticFeedback';
import { personalizeQuestion, personalizeQuestionAsync, BusinessContext } from '../data/questContent';
import useProfileStore from '../state/profileStore';
import useQuestStore from '../state/questStore';
import { useDashboardState } from '../hooks/useDashboardState';
import { SetupCard, InboxCard, KeywordsCard, QuestionCard, questCardStyles as styles } from './quest';

interface QuestCardProps {
  quest: Quest;
  onStartChat: () => void;
  onDismiss?: () => void;
}

const SWIPE_THRESHOLD = 50;

type CardType = 'quest' | 'setup' | 'inbox' | 'keywords';
interface CarouselItem {
  type: CardType;
  id: string;
  quest?: Quest;
}

export default function QuestCard({ quest, onStartChat, onDismiss }: QuestCardProps) {
  const navigation = useNavigation<any>();
  const [isExpanded, setIsExpanded] = useState(false);
  const [displayQuestion, setDisplayQuestion] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const buttonScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const profile = useProfileStore(state => state.profile);
  const quests = useQuestStore(state => state.quests);
  const dashboardState = useDashboardState();

  const needsSetup = dashboardState.setupProgress < 100;
  const hasUnreadReplies = dashboardState.unreadReplies > 0;

  const incompleteQuests = quests.filter(q => !q.isCompleted).sort((a, b) => a.priority - b.priority);
  const keywordsQuest = incompleteQuests.find(q => q.id === 'quest_hunting_keywords');
  const needsKeywords = !!keywordsQuest;

  const carouselItems: CarouselItem[] = [];
  if (needsKeywords) carouselItems.push({ type: 'keywords', id: 'keywords-setup', quest: keywordsQuest });
  if (hasUnreadReplies) carouselItems.push({ type: 'inbox', id: 'inbox-replies' });
  if (needsSetup) carouselItems.push({ type: 'setup', id: 'setup-progress' });
  incompleteQuests.filter(q => q.id !== 'quest_hunting_keywords').forEach(q => {
    carouselItems.push({ type: 'quest', id: q.id, quest: q });
  });

  const totalItems = carouselItems.length;
  const currentItem = carouselItems[currentIndex] || carouselItems[0];
  const isSetupCard = currentItem?.type === 'setup';
  const isInboxCard = currentItem?.type === 'inbox';
  const isKeywordsCard = currentItem?.type === 'keywords';
  const activeQuest = currentItem?.type === 'quest' ? currentItem.quest : null;

  const businessContext: BusinessContext = {
    businessName: profile?.businessInfo?.businessName || profile?.onboardingData?.businessName,
    targetMarket: profile?.businessInfo?.targetMarket || profile?.onboardingData?.targetMarket,
    productDescription: profile?.businessInfo?.productDescription || profile?.onboardingData?.productDescription,
  };

  useEffect(() => {
    if (!activeQuest) return;
    setDisplayQuestion(personalizeQuestion(activeQuest.question, businessContext));
    personalizeQuestionAsync(activeQuest.question, businessContext)
      .then(reworded => setDisplayQuestion(reworded))
      .catch(err => console.log('[QuestCard] AI rewording failed:', err));
  }, [activeQuest?.question, businessContext.businessName, businessContext.targetMarket, businessContext.productDescription]);

  const goToNext = () => {
    if (currentIndex < totalItems - 1) {
      hapticFeedback.light();
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      hapticFeedback.light();
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handlePressIn = () => { buttonScale.value = withSpring(0.9); };
  const handlePressOut = () => { buttonScale.value = withSpring(1); };
  const handleToggle = () => { hapticFeedback.light(); setIsExpanded(!isExpanded); };

  const handleStartChat = () => {
    hapticFeedback.medium();
    useQuestStore.getState().refreshCurrentQuest();
    onStartChat();
  };

  const handleSetupPress = () => {
    hapticFeedback.medium();
    const nextItem = dashboardState.setupItems.find(item => !item.completed && item.id !== 'hubspot');
    if (nextItem?.action) navigation.navigate(nextItem.action);
  };

  const handleInboxPress = () => {
    hapticFeedback.medium();
    navigation.navigate('Inbox');
  };

  const handleKeywordsPress = () => {
    hapticFeedback.medium();
    if (keywordsQuest) {
      useQuestStore.getState().refreshCurrentQuest();
      navigation.navigate('ChatScreen', { questId: 'quest_hunting_keywords' });
    }
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => { if (totalItems > 1) translateX.value = event.translationX; })
    .onEnd((event) => {
      if (event.translationX < -SWIPE_THRESHOLD && currentIndex < totalItems - 1) runOnJS(goToNext)();
      else if (event.translationX > SWIPE_THRESHOLD && currentIndex > 0) runOnJS(goToPrev)();
      translateX.value = withSpring(0);
    });

  const buttonAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: buttonScale.value }] }));
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(translateX.value, [-100, 0, 100], [-20, 0, 20], Extrapolation.CLAMP) }],
    opacity: interpolate(Math.abs(translateX.value), [0, 100], [1, 0.8], Extrapolation.CLAMP),
  }));

  if (!isExpanded) {
    return (
      <Animated.View entering={SlideInUp.duration(400).springify()} exiting={FadeOut.duration(200)} style={styles.collapsedContainer}>
        <Pressable onPress={handleToggle} style={styles.collapsedArrow}>
          <ChevronDown size={24} color="#FFFFFF" strokeWidth={2.5} />
          {totalItems > 0 && (
            <View style={styles.badgeContainer}>
              <View style={styles.badge}><Text style={styles.badgeText}>{totalItems}</Text></View>
            </View>
          )}
        </Pressable>
      </Animated.View>
    );
  }

  const commonProps = {
    carouselItems,
    currentIndex,
    totalItems,
    buttonAnimatedStyle,
    onToggle: handleToggle,
    onPrev: goToPrev,
    onNext: goToNext,
    onPressIn: handlePressIn,
    onPressOut: handlePressOut,
    setCurrentIndex,
  };

  return (
    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={cardAnimatedStyle}>
          {isInboxCard ? (
            <InboxCard
              {...commonProps}
              unreadReplies={dashboardState.unreadReplies}
              unreadReplyItems={dashboardState.unreadReplyItems}
              onInboxPress={handleInboxPress}
            />
          ) : isKeywordsCard ? (
            <KeywordsCard {...commonProps} onKeywordsPress={handleKeywordsPress} />
          ) : isSetupCard ? (
            <SetupCard
              {...commonProps}
              setupProgress={dashboardState.setupProgress}
              setupItems={dashboardState.setupItems}
              onSetupPress={handleSetupPress}
            />
          ) : (
            <QuestionCard {...commonProps} displayQuestion={displayQuestion} onStartChat={handleStartChat} />
          )}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}
