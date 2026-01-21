import React, { useState, useEffect } from 'react';
import { Pressable, Text, View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Sparkles, Zap, ArrowRight, Star } from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import useSubscriptionStore from '../state/subscriptionStore';
import PaywallModal from './PaywallModal';
import { hapticFeedback } from '../utils/hapticFeedback';
import { isRevenueCatEnabled } from '../lib/revenuecatClient';

type UpgradeButtonVariant = 'default' | 'compact' | 'inline' | 'banner';

interface UpgradeButtonProps {
  variant?: UpgradeButtonVariant;
  label?: string;
  showIcon?: boolean;
  onSuccess?: () => void;
}

const GRADIENT_COLORS = {
  primary: ['#D4AF37', '#F5D67B', '#C9A227'] as const,
  gold: ['#D4AF37', '#F5D67B', '#B8960F'] as const,
  accent: ['#E8C55B', '#D4AF37', '#B8960F'] as const,
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function UpgradeButton({
  variant = 'default',
  label,
  showIcon = true,
  onSuccess,
}: UpgradeButtonProps) {
  const isPremium = useSubscriptionStore(s => s.isPremium);
  const refreshSubscriptionStatus = useSubscriptionStore(s => s.refreshSubscriptionStatus);
  const [showPaywall, setShowPaywall] = useState(false);

  // Animated values
  const shimmerProgress = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);
  const shinePosition = useSharedValue(-100);

  useEffect(() => {
    // Subtle pulse animation
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    // Glow animation
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    // Shine animation
    shinePosition.value = withRepeat(
      withTiming(SCREEN_WIDTH + 100, {
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      false,
    );
  }, []);

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const shineAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shinePosition.value }],
  }));

  // Don't render if user is premium or RevenueCat is not enabled
  if (isPremium || !isRevenueCatEnabled()) {
    return null;
  }

  const handlePress = () => {
    hapticFeedback.medium();
    setShowPaywall(true);
  };

  const handleSuccess = () => {
    refreshSubscriptionStatus();
    setShowPaywall(false);
    onSuccess?.();
  };

  const buttonLabel = label || 'Upgrade';

  if (variant === 'compact') {
    return (
      <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
        <Pressable
          onPress={handlePress}
          style={({ pressed }) => [
            styles.compactButton,
            pressed && styles.pressed,
          ]}
        >
          <LinearGradient
            colors={['rgba(212, 175, 55, 0.2)', 'rgba(200, 162, 39, 0.15)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.compactGradient}
          >
            <Zap size={12} color="#F5D67B" fill="#F5D67B" />
            <Text style={styles.compactText}>{buttonLabel}</Text>
          </LinearGradient>
        </Pressable>
        <PaywallModal
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          onSuccess={handleSuccess}
          canDismiss={true}
        />
      </Animated.View>
    );
  }

  if (variant === 'inline') {
    return (
      <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
        <Pressable
          onPress={handlePress}
          style={({ pressed }) => [
            styles.inlineButton,
            pressed && styles.pressed,
          ]}
        >
          {showIcon && <Sparkles size={14} color="#F5D67B" />}
          <Text style={styles.inlineText}>{buttonLabel}</Text>
          <ArrowRight size={12} color="#F5D67B" />
        </Pressable>
        <PaywallModal
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          onSuccess={handleSuccess}
          canDismiss={true}
        />
      </Animated.View>
    );
  }

  if (variant === 'banner') {
    return (
      <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)}>
        <AnimatedPressable
          onPress={handlePress}
          style={[styles.bannerContainer, pulseAnimatedStyle]}
        >
          {/* Background glow effect */}
          <Animated.View style={[styles.bannerGlow, glowAnimatedStyle]}>
            <LinearGradient
              colors={['rgba(212, 175, 55, 0.4)', 'rgba(245, 214, 123, 0.3)', 'rgba(212, 175, 55, 0.4)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>

          {/* Main content */}
          <LinearGradient
            colors={['rgba(212, 175, 55, 0.12)', 'rgba(184, 150, 15, 0.06)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bannerGradient}
          >
            {/* Animated Shine Effect */}
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: -30,
                  bottom: -30,
                  width: 60,
                  backgroundColor: 'transparent',
                },
                shineAnimatedStyle,
              ]}
            >
              <LinearGradient
                colors={[
                  'transparent',
                  'rgba(255, 255, 255, 0.08)',
                  'rgba(255, 255, 255, 0.25)',
                  'rgba(255, 255, 255, 0.08)',
                  'transparent',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  flex: 1,
                  transform: [{ skewX: '-20deg' }],
                }}
              />
            </Animated.View>

            <View style={styles.bannerContent}>
              {/* Icon with gradient background */}
              <View style={styles.bannerIconWrapper}>
                <LinearGradient
                  colors={GRADIENT_COLORS.gold}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.bannerIconGradient}
                >
                  <Crown size={16} color="#1A1A1A" />
                </LinearGradient>
              </View>

              <View style={styles.bannerTextContainer}>
                <Text style={styles.bannerTitle}>Upgrade to Premium</Text>
                <Text style={styles.bannerSubtitle}>Unlimited leads & features</Text>
              </View>

              {/* Chevron indicator */}
              <View style={styles.bannerChevron}>
                <ArrowRight size={18} color="#D4AF37" />
              </View>
            </View>
          </LinearGradient>
        </AnimatedPressable>
        <PaywallModal
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          onSuccess={handleSuccess}
          canDismiss={true}
        />
      </Animated.View>
    );
  }

  // Default variant - premium gradient button
  return (
    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
      <AnimatedPressable
        onPress={handlePress}
        style={[styles.defaultContainer, pulseAnimatedStyle]}
      >
        {/* Glow effect */}
        <Animated.View style={[styles.defaultGlow, glowAnimatedStyle]}>
          <LinearGradient
            colors={['rgba(212, 175, 55, 0.5)', 'rgba(200, 162, 39, 0.3)']}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        <LinearGradient
          colors={GRADIENT_COLORS.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.defaultGradient}
        >
          {showIcon && <Crown size={18} color="#1A1A1A" />}
          <Text style={styles.defaultText}>{buttonLabel}</Text>
          <ArrowRight size={16} color="#1A1A1A" />
        </LinearGradient>
      </AnimatedPressable>
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSuccess={handleSuccess}
        canDismiss={true}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },

  // Default variant
  defaultContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  defaultGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 26,
  },
  defaultGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 10,
  },
  defaultText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Compact variant
  compactButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  compactGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  compactText: {
    color: '#F5D67B',
    fontSize: 12,
    fontWeight: '600',
  },

  // Inline variant
  inlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineText: {
    color: '#F5D67B',
    fontSize: 14,
    fontWeight: '600',
  },

  // Banner variant
  bannerContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: 40,
  },
  bannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  bannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerIconWrapper: {
    marginRight: 12,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  bannerIconGradient: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  bannerSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  bannerChevron: {
    marginLeft: 8,
    opacity: 0.8,
  },
});
