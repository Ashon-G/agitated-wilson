import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronUp, ChevronLeft, ChevronRight, Play } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { questCardStyles as styles } from './styles';
import { hapticFeedback } from '../../utils/hapticFeedback';

interface CarouselItem {
  type: string;
  id: string;
}

interface QuestionCardProps {
  displayQuestion: string;
  carouselItems: CarouselItem[];
  currentIndex: number;
  totalItems: number;
  buttonAnimatedStyle: any;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onStartChat: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  setCurrentIndex: (index: number) => void;
}

export function QuestionCard({
  displayQuestion,
  carouselItems,
  currentIndex,
  totalItems,
  buttonAnimatedStyle,
  onToggle,
  onPrev,
  onNext,
  onStartChat,
  onPressIn,
  onPressOut,
  setCurrentIndex,
}: QuestionCardProps) {
  return (
    <LinearGradient
      colors={['#F472B6', '#818CF8', '#38BDF8']}
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

      <Text style={styles.label}>QUICK QUESTION</Text>
      <View style={styles.divider} />

      <Text style={styles.question} numberOfLines={3}>{displayQuestion}</Text>

      <Animated.View style={buttonAnimatedStyle}>
        <Pressable style={styles.playButton} onPress={onStartChat} onPressIn={onPressIn} onPressOut={onPressOut}>
          <Play size={24} color="#1F2937" fill="#1F2937" />
        </Pressable>
      </Animated.View>

      <View style={styles.dots}>
        {carouselItems.map((item, index) => (
          <Pressable key={item.id} onPress={() => { hapticFeedback.light(); setCurrentIndex(index); }}>
            <View style={[styles.dot, index === currentIndex && styles.dotActive]} />
          </Pressable>
        ))}
      </View>

      {totalItems > 1 && <Text style={styles.swipeHint}>Swipe to see more</Text>}
    </LinearGradient>
  );
}
