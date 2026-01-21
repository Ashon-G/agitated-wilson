import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronUp, ChevronLeft, ChevronRight, Settings2, Check, Circle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { questCardStyles as styles } from './styles';
import { hapticFeedback } from '../../utils/hapticFeedback';

interface SetupItem {
  id: string;
  label: string;
  completed: boolean;
  action?: string;
}

interface CarouselItem {
  type: string;
  id: string;
}

interface SetupCardProps {
  setupProgress: number;
  setupItems: SetupItem[];
  carouselItems: CarouselItem[];
  currentIndex: number;
  totalItems: number;
  buttonAnimatedStyle: any;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSetupPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  setCurrentIndex: (index: number) => void;
}

export function SetupCard({
  setupProgress,
  setupItems,
  carouselItems,
  currentIndex,
  totalItems,
  buttonAnimatedStyle,
  onToggle,
  onPrev,
  onNext,
  onSetupPress,
  onPressIn,
  onPressOut,
  setCurrentIndex,
}: SetupCardProps) {
  return (
    <LinearGradient
      colors={['#FBBF24', '#F59E0B', '#D97706']}
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
        <Settings2 size={24} color="#FFFFFF" />
      </View>
      <Text style={styles.label}>FINISH SETUP</Text>

      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${setupProgress}%` }]} />
        </View>
        <Text style={styles.progressText}>{setupProgress}% complete</Text>
      </View>

      <View style={styles.checklist}>
        {setupItems.filter(item => item.id !== 'hubspot').map((item) => (
          <View key={item.id} style={styles.checkItem}>
            {item.completed ? (
              <View style={styles.checkIcon}>
                <Check size={12} color="#22C55E" strokeWidth={3} />
              </View>
            ) : (
              <Circle size={16} color="rgba(255,255,255,0.5)" />
            )}
            <Text style={[styles.checkText, item.completed && styles.checkTextCompleted]}>{item.label}</Text>
          </View>
        ))}
      </View>

      <Animated.View style={buttonAnimatedStyle}>
        <Pressable style={styles.actionButton} onPress={onSetupPress} onPressIn={onPressIn} onPressOut={onPressOut}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#D97706' }}>Continue Setup</Text>
        </Pressable>
      </Animated.View>

      <View style={styles.dots}>
        {carouselItems.map((item, index) => (
          <Pressable key={item.id} onPress={() => { hapticFeedback.light(); setCurrentIndex(index); }}>
            <View style={[styles.dot, index === currentIndex && styles.dotActiveSetup]} />
          </Pressable>
        ))}
      </View>

      {totalItems > 1 && <Text style={styles.swipeHint}>Swipe to see questions</Text>}
    </LinearGradient>
  );
}
