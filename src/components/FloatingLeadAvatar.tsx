import React, { useEffect } from 'react';
import { View, Image, Dimensions, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  interpolate,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FloatingLeadAvatarProps {
  imageUrl?: string;
  username?: string;
  size?: number;
  animationState?: 'normal' | 'sending' | 'success';
}

export default function FloatingLeadAvatar({
  imageUrl,
  username,
  size = 160,
  animationState = 'normal',
}: FloatingLeadAvatarProps) {
  // Animation values
  const floatY = useSharedValue(0);
  const rotateX = useSharedValue(0);
  const rotateY = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const glowPulse = useSharedValue(0);
  const ringRotation = useSharedValue(0);
  const ringOpacity = useSharedValue(0.6);
  const glowColor = useSharedValue(0); // 0 = normal (blue/purple), 1 = green (success)

  // Generate initials from username
  const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.replace(/[_-]/g, ' ').split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  useEffect(() => {
    // Entrance animation
    scale.value = withSpring(1, { damping: 15, stiffness: 100 });

    // Performance optimization: Reduce animation complexity and frequency
    // Floating animation - smooth up and down (reduced range from -15/15 to -10/10)
    floatY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 2500, easing: Easing.inOut(Easing.ease) }), // Slower
        withTiming(10, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    // Subtle 3D tilt animation (reduced angles from 5/-5 to 3/-3)
    rotateX.value = withRepeat(
      withSequence(
        withTiming(3, { duration: 4000, easing: Easing.inOut(Easing.ease) }), // Slower
        withTiming(-3, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    rotateY.value = withRepeat(
      withSequence(
        withTiming(5, { duration: 5000, easing: Easing.inOut(Easing.ease) }), // Slower
        withTiming(-5, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    // Glow pulse animation
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    // Ring rotation
    ringRotation.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false,
    );

    // Ring opacity pulse
    ringOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, []);

  // Handle animation state changes
  useEffect(() => {
    if (animationState === 'sending') {
      // Speed up all animations and glow blue
      floatY.value = withRepeat(
        withSequence(
          withTiming(-10, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(10, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );

      ringRotation.value = withRepeat(
        withTiming(360, { duration: 2000, easing: Easing.linear }),
        -1,
        false,
      );

      glowPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );

      ringOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.6, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );

      glowColor.value = withTiming(0, { duration: 300 }); // Stay blue
    } else if (animationState === 'success') {
      // Turn green and pulse once
      glowColor.value = withTiming(1, { duration: 300 });

      scale.value = withSequence(
        withTiming(1.15, { duration: 200, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) }),
      );

      // Bright glow pulse
      glowPulse.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0, { duration: 800 }),
      );

      ringOpacity.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0.6, { duration: 800 }),
      );

      // Return to normal after 2 seconds
      setTimeout(() => {
        glowColor.value = withTiming(0, { duration: 500 });

        // Reset to normal speed animations
        floatY.value = withRepeat(
          withSequence(
            withTiming(-10, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
            withTiming(10, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          true,
        );

        ringRotation.value = withRepeat(
          withTiming(360, { duration: 8000, easing: Easing.linear }),
          -1,
          false,
        );

        glowPulse.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          true,
        );

        ringOpacity.value = withRepeat(
          withSequence(
            withTiming(0.8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.4, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          true,
        );
      }, 2000);
    } else {
      // Normal state - already set in first useEffect
      glowColor.value = withTiming(0, { duration: 500 });
    }
  }, [animationState]);

  // Main container animation (floating + 3D rotation)
  const containerAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [
        { translateY: floatY.value },
        { perspective: 1000 },
        { rotateX: `${rotateX.value}deg` },
        { rotateY: `${rotateY.value}deg` },
        { scale: scale.value },
      ] as const,
    };
  });

  // Glow effect animation
  const glowAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const glowSize = interpolate(glowPulse.value, [0, 1], [size * 1.2, size * 1.4]);
    const glowOpacity = interpolate(glowPulse.value, [0, 1], [0.3, 0.6]);

    return {
      width: glowSize,
      height: glowSize,
      borderRadius: glowSize / 2,
      opacity: glowOpacity,
    };
  });

  // Dynamic gradient colors based on state
  const getGlowGradientColors = () => {
    if (animationState === 'success') {
      return ['rgba(34, 197, 94, 0.6)', 'rgba(22, 163, 74, 0.4)', 'transparent'] as const; // Green
    }
    return ['rgba(96, 165, 250, 0.4)', 'rgba(139, 92, 246, 0.3)', 'transparent'] as const; // Blue/Purple
  };

  const getBorderGradientColors = () => {
    if (animationState === 'success') {
      return ['rgba(34, 197, 94, 0.9)', 'rgba(22, 163, 74, 0.8)', 'rgba(34, 197, 94, 0.7)'] as const; // Green
    }
    return ['rgba(96, 165, 250, 0.8)', 'rgba(139, 92, 246, 0.8)', 'rgba(236, 72, 153, 0.6)'] as const; // Blue/Purple/Pink
  };

  // Outer ring animation
  const outerRingAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ rotate: `${ringRotation.value}deg` }] as const,
      opacity: ringOpacity.value,
    };
  });

  // Inner ring animation (opposite rotation)
  const innerRingAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ rotate: `${-ringRotation.value * 0.7}deg` }] as const,
      opacity: ringOpacity.value * 0.8,
    };
  });

  // Shadow animation for depth
  const shadowAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const shadowScale = interpolate(floatY.value, [-15, 15], [0.9, 1.1]);
    const shadowOpacity = interpolate(floatY.value, [-15, 15], [0.4, 0.2]);

    return {
      transform: [{ scaleX: shadowScale }, { scaleY: 0.3 }] as const,
      opacity: shadowOpacity,
    };
  });

  const initials = getInitials(username);
  const hasImage = imageUrl && imageUrl.length > 0 && !imageUrl.includes('default');

  return (
    <View style={[styles.wrapper, { width: size * 1.8, height: size * 1.8 }]}>
      {/* Shadow on the ground */}
      <Animated.View
        style={[
          styles.shadow,
          {
            width: size * 0.8,
            height: size * 0.8,
            bottom: -size * 0.1,
          },
          shadowAnimatedStyle,
        ]}
      />

      {/* Main floating container */}
      <Animated.View style={[styles.container, containerAnimatedStyle]}>
        {/* Outer glow effect */}
        <Animated.View style={[styles.glow, glowAnimatedStyle]}>
          <LinearGradient
            colors={getGlowGradientColors()}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        {/* Outer rotating ring */}
        <Animated.View
          style={[
            styles.ring,
            { width: size * 1.25, height: size * 1.25 },
            outerRingAnimatedStyle,
          ]}
        >
          <View style={[styles.ringSegment, styles.ringSegmentTop]} />
          <View style={[styles.ringSegment, styles.ringSegmentRight]} />
          <View style={[styles.ringSegment, styles.ringSegmentBottom]} />
          <View style={[styles.ringSegment, styles.ringSegmentLeft]} />
        </Animated.View>

        {/* Inner rotating ring */}
        <Animated.View
          style={[
            styles.ring,
            { width: size * 1.1, height: size * 1.1 },
            innerRingAnimatedStyle,
          ]}
        >
          <View style={[styles.innerRingSegment, styles.ringSegmentTop]} />
          <View style={[styles.innerRingSegment, styles.ringSegmentBottom]} />
        </Animated.View>

        {/* Main circle with gradient border */}
        <View style={[styles.circleOuter, { width: size, height: size, borderRadius: size / 2 }]}>
          <LinearGradient
            colors={getBorderGradientColors()}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

          {/* Inner circle with image or initials */}
          <View style={[styles.circleInner, { width: size - 6, height: size - 6, borderRadius: (size - 6) / 2 }]}>
            {hasImage ? (
              <Image
                source={{ uri: imageUrl }}
                style={[styles.image, { width: size - 10, height: size - 10, borderRadius: (size - 10) / 2 }]}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={['#1e3a5f', '#0f172a']}
                style={[styles.initialsContainer, { width: size - 10, height: size - 10, borderRadius: (size - 10) / 2 }]}
              >
                <Animated.Text style={[styles.initials, { fontSize: size * 0.35 }]}>
                  {initials}
                </Animated.Text>
              </LinearGradient>
            )}
          </View>
        </View>

        {/* Floating particles/orbs around the avatar */}
        <FloatingOrb
          size={8}
          delay={0}
          radius={size * 0.8}
          duration={4000}
          color="rgba(96, 165, 250, 0.6)"
        />
        <FloatingOrb
          size={6}
          delay={1000}
          radius={size * 0.75}
          duration={5000}
          color="rgba(139, 92, 246, 0.6)"
        />
        <FloatingOrb
          size={5}
          delay={2000}
          radius={size * 0.9}
          duration={6000}
          color="rgba(236, 72, 153, 0.5)"
        />
      </Animated.View>
    </View>
  );
}

// Floating orb component for decorative particles
function FloatingOrb({
  size,
  delay,
  radius,
  duration,
  color,
}: {
  size: number;
  delay: number;
  radius: number;
  duration: number;
  color: string;
}) {
  const rotation = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    setTimeout(() => {
      rotation.value = withRepeat(
        withTiming(360, { duration, easing: Easing.linear }),
        -1,
        false,
      );

      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.8, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    }, delay);
  }, []);

  const orbStyle = useAnimatedStyle(() => {
    'worklet';
    const angle = (rotation.value * Math.PI) / 180;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * 0.4; // Elliptical orbit

    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: pulseScale.value },
      ] as const,
    };
  });

  return (
    <Animated.View
      style={[
        styles.orb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        orbStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 100,
  },
  glow: {
    position: 'absolute',
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
    borderRadius: 1000,
    borderStyle: 'dashed',
  },
  ringSegment: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(96, 165, 250, 0.8)',
  },
  innerRingSegment: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(139, 92, 246, 0.7)',
  },
  ringSegmentTop: {
    top: -2,
    left: '50%',
    marginLeft: -2,
  },
  ringSegmentRight: {
    right: -2,
    top: '50%',
    marginTop: -2,
  },
  ringSegmentBottom: {
    bottom: -2,
    left: '50%',
    marginLeft: -2,
  },
  ringSegmentLeft: {
    left: -2,
    top: '50%',
    marginTop: -2,
  },
  circleOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  circleInner: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    overflow: 'hidden',
  },
  image: {
    backgroundColor: '#1e3a5f',
  },
  initialsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 2,
  },
  orb: {
    position: 'absolute',
    shadowColor: '#60a5fa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
});
