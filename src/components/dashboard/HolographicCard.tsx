/**
 * HolographicCard - Base component for floating holographic cards
 *
 * Creates a futuristic, glassmorphic card that appears to float
 * in 3D space. Supports both light and dark modes with proper
 * frosted glass effects.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  FadeOut,
  SlideInRight,
} from 'react-native-reanimated';
import { hapticFeedback } from '../../utils/hapticFeedback';
import { useSwipeInteraction } from './SwipeableCard';
import { useTheme } from '../../contexts/ThemeContext';
import { getGlassStyles } from '../../utils/colors';

interface HolographicCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  gradientColors?: [string, string, string];
  glowColor?: string;
  animate?: boolean;
  entering?: any;
  exiting?: any;
}

export default function HolographicCard({
  children,
  onPress,
  style,
  gradientColors,
  glowColor,
  animate = true,
  entering = SlideInRight.duration(400).springify().damping(18).stiffness(100),
  exiting = FadeOut.duration(200),
}: HolographicCardProps) {
  const { isDark } = useTheme();
  const glass = useMemo(() => getGlassStyles(isDark), [isDark]);

  // Default gradient colors based on theme - more subtle, minimal
  const defaultGradientColors: [string, string, string] = isDark
    ? ['rgba(255, 255, 255, 0.03)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)']
    : ['rgba(0, 0, 0, 0.02)', 'rgba(0, 0, 0, 0.01)', 'rgba(0, 0, 0, 0.005)'];

  const finalGradientColors = gradientColors || defaultGradientColors;
  const finalGlowColor = glowColor || (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)');

  // Border gradient colors based on theme - more subtle
  const borderGradientColors: [string, string, string] = isDark
    ? ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']
    : ['rgba(0, 0, 0, 0.06)', 'rgba(0, 0, 0, 0.04)', 'rgba(0, 0, 0, 0.02)'];

  const scale = useSharedValue(1);
  const glow = useSharedValue(isDark ? 0.08 : 0.04);

  // Subtle floating animation - reduced for minimal feel
  React.useEffect(() => {
    if (animate) {
      glow.value = withRepeat(
        withSequence(
          withTiming(isDark ? 0.12 : 0.06, { duration: 3000 }),
          withTiming(isDark ? 0.08 : 0.04, { duration: 3000 }),
        ),
        -1,
        true,
      );
    }
  }, [animate, glow, isDark]);

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 18, stiffness: 300, mass: 0.8 });
    hapticFeedback.light();
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 16, stiffness: 250, mass: 0.7 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glow.value,
  }));

  const content = (
    <Animated.View
      entering={entering}
      exiting={exiting}
      style={[
        styles.container,
        animatedStyle,
        glowStyle,
        { shadowColor: finalGlowColor },
        style,
      ]}
    >
      {/* Glassmorphic background - using solid background for performance */}
      <View
        style={[
          styles.blur,
          { backgroundColor: isDark ? 'rgba(18, 18, 20, 0.9)' : 'rgba(255, 255, 255, 0.92)' },
        ]}
      >
        <LinearGradient
          colors={finalGradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Holographic border effect */}
          <View style={styles.borderGlow}>
            <LinearGradient
              colors={borderGradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.borderGradient, { opacity: isDark ? 0.3 : 0.25 }]}
            />
          </View>

          {/* Content */}
          <View
            style={[
              styles.content,
              {
                backgroundColor: glass.background,
                borderWidth: 1,
                borderColor: glass.border,
              },
            ]}
          >
            {children}
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

// Sub-components for consistent styling
export function CardTitle({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();
  const glass = getGlassStyles(isDark);

  return <Text style={[styles.title, { color: glass.text }]}>{children}</Text>;
}

export function CardSubtitle({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();
  const glass = getGlassStyles(isDark);

  return <Text style={[styles.subtitle, { color: glass.textSecondary }]}>{children}</Text>;
}

export function CardBadge({
  count,
  color = '#EF4444',
}: {
  count: number;
  color?: string;
}) {
  const { isDark } = useTheme();
  if (count <= 0) return null;

  // Use darker colors in light mode for better visibility
  const badgeColor = isDark ? color : getDarkerColor(color);

  return (
    <View style={[styles.badge, { backgroundColor: badgeColor }]}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

// Helper function to get darker versions of colors for light mode
export function getDarkerColor(color: string): string {
  const colorMap: Record<string, string> = {
    '#38BDF8': '#0369a1', // sky blue -> darker blue
    '#F472B6': '#be185d', // pink -> darker pink/magenta
    '#A78BFA': '#6d28d9', // purple -> darker purple
    '#22C55E': '#15803d', // green -> darker green
    '#818CF8': '#4338ca', // indigo -> darker indigo
    '#EF4444': '#b91c1c', // red -> darker red
  };
  return colorMap[color] || color;
}

export function CardIcon({
  children,
  color = '#38BDF8',
}: {
  children: React.ReactNode;
  color?: string;
}) {
  const isInteracting = useSwipeInteraction();
  const { isDark } = useTheme();

  // Use darker colors in light mode for better visibility
  const iconColor = isDark ? color : getDarkerColor(color);

  // Hide the icon when swipe interaction is active (the fixed icon will show instead)
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: isInteracting?.value ? 0 : 1,
    };
  });

  return (
    <Animated.View
      style={[
        styles.iconContainer,
        {
          backgroundColor: `${iconColor}20`,
          borderWidth: 1,
          borderColor: `${iconColor}30`,
        },
        animatedStyle,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 6,
  },
  blur: {
    overflow: 'hidden',
    borderRadius: 20,
  },
  gradient: {
    borderRadius: 20,
    padding: 1,
  },
  borderGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    overflow: 'hidden',
  },
  borderGradient: {
    flex: 1,
  },
  content: {
    borderRadius: 19,
    padding: 18,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    letterSpacing: -0.1,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
