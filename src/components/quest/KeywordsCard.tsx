import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronUp, ChevronLeft, ChevronRight, Target } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { questCardStyles as styles } from './styles';
import { hapticFeedback } from '../../utils/hapticFeedback';

interface CarouselItem {
  type: string;
  id: string;
}

interface KeywordsCardProps {
  carouselItems: CarouselItem[];
  currentIndex: number;
  totalItems: number;
  buttonAnimatedStyle: any;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onKeywordsPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  setCurrentIndex: (index: number) => void;
}

export function KeywordsCard({
  carouselItems,
  currentIndex,
  totalItems,
  buttonAnimatedStyle,
  onToggle,
  onPrev,
  onNext,
  onKeywordsPress,
  onPressIn,
  onPressOut,
  setCurrentIndex,
}: KeywordsCardProps) {
  return (
    <LinearGradient
      colors={['#FF6B35', '#F97316', '#EA580C']}
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
        <Target size={24} color="#FFFFFF" />
      </View>
      <Text style={styles.label}>HUNTING KEYWORDS</Text>

      <View style={styles.divider} />

      <Text style={styles.keywordsDescription}>What words should I look for when hunting leads on Reddit?</Text>

      <View style={styles.keywordsExamples}>
        <View style={styles.keywordTag}><Text style={styles.keywordTagText}>need help with</Text></View>
        <View style={styles.keywordTag}><Text style={styles.keywordTagText}>looking for</Text></View>
        <View style={styles.keywordTag}><Text style={styles.keywordTagText}>recommend</Text></View>
      </View>

      <Animated.View style={buttonAnimatedStyle}>
        <Pressable style={styles.actionButton} onPress={onKeywordsPress} onPressIn={onPressIn} onPressOut={onPressOut}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#EA580C' }}>Set Keywords</Text>
        </Pressable>
      </Animated.View>

      <View style={styles.dots}>
        {carouselItems.map((item, index) => (
          <Pressable key={item.id} onPress={() => { hapticFeedback.light(); setCurrentIndex(index); }}>
            <View style={[styles.dot, index === currentIndex && styles.dotActiveKeywords]} />
          </Pressable>
        ))}
      </View>

      {totalItems > 1 && <Text style={styles.swipeHint}>Swipe to see more</Text>}
    </LinearGradient>
  );
}
