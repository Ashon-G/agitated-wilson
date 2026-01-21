/**
 * MinimizedIconBar - Displays minimized cards as icons on the LEFT side
 *
 * Tapping an icon triggers a simple expand animation - the icon scales up
 * and fades out as the card reappears in its original position.
 * Supports both light and dark modes with frosted glass effects.
 */

import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';
import { LucideIcon } from 'lucide-react-native';
import { hapticFeedback } from '../../utils/hapticFeedback';
import { useTheme } from '../../contexts/ThemeContext';
import { getGlassStyles } from '../../utils/colors';

const ICON_SIZE = 40;
const ICON_BORDER_RADIUS = 12;

export interface MinimizedCard {
  id: string;
  icon: LucideIcon;
  color: string;
  label: string;
  badgeCount?: number;
}

interface MinimizedIconBarProps {
  minimizedCards: MinimizedCard[];
  onRestore: (cardId: string) => void;
  topOffset: number;
}

function MinimizedIcon({
  card,
  onPress,
  index,
}: {
  card: MinimizedCard;
  onPress: () => void;
  index: number;
}) {
  const { isDark } = useTheme();
  const glass = getGlassStyles(isDark);

  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const expandProgress = useSharedValue(0);
  const Icon = card.icon;

  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 18, stiffness: 280 });
    hapticFeedback.light();
  };

  const handlePressOut = () => {
    if (expandProgress.value === 0) {
      scale.value = withSpring(1, { damping: 16, stiffness: 240 });
    }
  };

  const handlePress = useCallback(() => {
    hapticFeedback.medium();

    // Use spring physics for more organic feel
    expandProgress.value = withSpring(1, {
      damping: 18,
      stiffness: 120,
      mass: 0.7,
    });

    // Scale up with spring
    scale.value = withSpring(1.6, {
      damping: 14,
      stiffness: 100,
      mass: 0.6,
    });

    // Fade out smoothly
    opacity.value = withTiming(0, { duration: 280, easing: Easing.bezier(0.32, 0, 0.24, 1) }, () => {
      runOnJS(onPress)();
    });
  }, [onPress, scale, opacity, expandProgress]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  // Glow expands outward during restore
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0, 0.3, 1], [0.5, 0.8, 0], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(expandProgress.value, [0, 1], [1, 2.5], Extrapolation.CLAMP),
      },
    ],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.iconButton}
      >
        <View
          style={[
            styles.iconBlur,
            { backgroundColor: isDark ? 'rgba(17, 24, 39, 0.9)' : 'rgba(255, 255, 255, 0.95)' },
          ]}
        >
          <View
            style={[
              styles.iconInner,
              {
                backgroundColor: isDark ? `${card.color}20` : `${card.color}15`,
                borderColor: isDark ? glass.border : glass.borderMedium,
              },
            ]}
          >
            <Icon size={18} color={card.color} />
          </View>
        </View>

        {/* Badge */}
        {card.badgeCount !== undefined && card.badgeCount > 0 && (
          <View style={styles.badge}>
            <Animated.Text style={styles.badgeText}>
              {card.badgeCount > 9 ? '9+' : card.badgeCount}
            </Animated.Text>
          </View>
        )}

        {/* Expanding glow */}
        <Animated.View
          style={[
            styles.expandGlow,
            { backgroundColor: `${card.color}30` },
            glowStyle,
          ]}
        />

        {/* Static glow */}
        <View style={[styles.glow, { shadowColor: card.color }]} />
      </Pressable>
    </Animated.View>
  );
}

export default function MinimizedIconBar({
  minimizedCards,
  onRestore,
  topOffset,
}: MinimizedIconBarProps) {
  if (minimizedCards.length === 0) return null;

  return (
    <View style={[styles.container, { top: topOffset }]}>
      {minimizedCards.map((card, index) => (
        <MinimizedIcon
          key={card.id}
          card={card}
          index={index}
          onPress={() => onRestore(card.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    zIndex: 60,
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    borderRadius: ICON_BORDER_RADIUS,
    overflow: 'visible',
  },
  iconBlur: {
    borderRadius: ICON_BORDER_RADIUS,
    overflow: 'hidden',
  },
  iconInner: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: '#EF4444',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  expandGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_BORDER_RADIUS,
    zIndex: -1,
  },
  glow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: ICON_BORDER_RADIUS,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 0,
    zIndex: -2,
  },
});
