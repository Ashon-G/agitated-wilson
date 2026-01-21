import React from 'react';
import { View, Animated, ActivityIndicator } from 'react-native';
import { styles } from './styles';

interface LoadingStageProps {
  currentSubtitle: string;
  subtitleOpacity: Animated.Value;
  subtitleTranslateY: Animated.Value;
  bottomInset: number;
  color?: string;
}

export function LoadingStage({
  currentSubtitle,
  subtitleOpacity,
  subtitleTranslateY,
  bottomInset,
  color = '#22C55E',
}: LoadingStageProps) {
  return (
    <View style={[styles.interactionContainer, { paddingBottom: bottomInset + 24 }]}>
      <Animated.Text
        style={[
          styles.subtitleText,
          { opacity: subtitleOpacity, transform: [{ translateY: subtitleTranslateY }] },
        ]}
      >
        {currentSubtitle}
      </Animated.Text>
      <View style={styles.extractingContainer}>
        <ActivityIndicator size="large" color={color} />
      </View>
    </View>
  );
}
