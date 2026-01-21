/**
 * SwipeTutorial - Animated tutorial overlay for swipe-to-minimize
 *
 * Shows a Lottie animation with text instructing users to swipe left.
 * Only displays until user has minimized at least one card (permanently dismissed after).
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface SwipeTutorialProps {
  visible: boolean;
}

export default function SwipeTutorial({ visible }: SwipeTutorialProps) {
  const lottieRef = useRef<LottieView>(null);
  const { isDark } = useTheme();

  // Subtle pulse animation for the text
  const textOpacity = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      // Gentle pulse effect
      textOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1200 }),
          withTiming(1, { duration: 1200 }),
        ),
        -1, // infinite
        false,
      );
    }
  }, [visible, textOpacity]);

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(400).delay(300)}
      exiting={FadeOut.duration(300)}
      style={styles.container}
      pointerEvents="none"
    >
      <View style={styles.content}>
        {/* Lottie Animation */}
        <View style={styles.lottieContainer}>
          <LottieView
            ref={lottieRef}
            source={require('../../../assets/swipe-left-tutorial.json')}
            autoPlay
            loop
            style={styles.lottie}
          />
        </View>

        {/* Instruction Text */}
        <Animated.Text
          style={[
            styles.instructionText,
            !isDark && styles.instructionTextLight,
            textAnimatedStyle,
          ]}
        >
          Swipe left to minimize notifications
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  lottieContainer: {
    width: 180,
    height: 180,
    marginBottom: 8,
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  instructionTextLight: {
    color: 'rgba(31, 41, 55, 0.9)',
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
  },
});
