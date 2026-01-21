import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronUp, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { questCardStyles as styles } from './styles';
import { hapticFeedback } from '../../utils/hapticFeedback';

interface UnreadReplyItem {
  author: string;
  preview?: string;
}

interface CarouselItem {
  type: string;
  id: string;
}

interface InboxCardProps {
  unreadReplies: number;
  unreadReplyItems: UnreadReplyItem[];
  carouselItems: CarouselItem[];
  currentIndex: number;
  totalItems: number;
  buttonAnimatedStyle: any;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onInboxPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  setCurrentIndex: (index: number) => void;
}

export function InboxCard({
  unreadReplies,
  unreadReplyItems,
  carouselItems,
  currentIndex,
  totalItems,
  buttonAnimatedStyle,
  onToggle,
  onPrev,
  onNext,
  onInboxPress,
  onPressIn,
  onPressOut,
  setCurrentIndex,
}: InboxCardProps) {
  return (
    <LinearGradient
      colors={['#3B82F6', '#6366F1', '#8B5CF6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Pressable onPress={onToggle} style={styles.collapseButton}>
        <ChevronUp size={20} color="rgba(255,255,255,0.8)" />
      </Pressable>

      {totalItems > 1 && (
        <>
          <Pressable onPress={onPrev} style={[styles.navArrow, styles.navArrowLeft]} disabled={currentIndex === 0}>
            <ChevronLeft size={24} color={currentIndex === 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)'} />
          </Pressable>
          <Pressable onPress={onNext} style={[styles.navArrow, styles.navArrowRight]} disabled={currentIndex === totalItems - 1}>
            <ChevronRight size={24} color={currentIndex === totalItems - 1 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)'} />
          </Pressable>
        </>
      )}

      <View style={styles.iconContainer}>
        <MessageCircle size={24} color="#FFFFFF" />
      </View>
      <Text style={styles.label}>NEW REPLIES</Text>

      <View style={styles.divider} />

      <Text style={styles.inboxCount}>
        {unreadReplies === 1 ? '1 new reply' : `${unreadReplies} new replies`}
      </Text>

      {unreadReplyItems.length > 0 && (
        <View style={styles.replyPreview}>
          <Text style={styles.replyAuthor} numberOfLines={1}>From: {unreadReplyItems[0].author}</Text>
          <Text style={styles.replyText} numberOfLines={2}>{unreadReplyItems[0].preview || 'New message...'}</Text>
        </View>
      )}

      <Animated.View style={buttonAnimatedStyle}>
        <Pressable style={styles.actionButton} onPress={onInboxPress} onPressIn={onPressIn} onPressOut={onPressOut}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#6366F1' }}>View Inbox</Text>
        </Pressable>
      </Animated.View>

      <View style={styles.dots}>
        {carouselItems.map((item, index) => (
          <Pressable key={item.id} onPress={() => { hapticFeedback.light(); setCurrentIndex(index); }}>
            <View style={[styles.dot, index === currentIndex && styles.dotActiveInbox]} />
          </Pressable>
        ))}
      </View>

      {totalItems > 1 && <Text style={styles.swipeHint}>Swipe to see more</Text>}
    </LinearGradient>
  );
}
