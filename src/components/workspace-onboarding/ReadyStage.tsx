import React from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { styles } from './styles';

interface ReadyStageProps {
  buttonScale: Animated.Value;
  audioOnBlinkAnim: Animated.Value;
  onStart: () => void;
}

export function ReadyStage({ buttonScale, audioOnBlinkAnim, onStart }: ReadyStageProps) {
  return (
    <View style={styles.readyContainer}>
      <Text style={styles.titleText}>New Workspace</Text>
      <Animated.Text style={[styles.audioOnText, { opacity: audioOnBlinkAnim }]}>
        Audio on
      </Animated.Text>
      <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
        <Pressable onPress={onStart} style={styles.arrowButton}>
          <LinearGradient
            colors={['#6366f1', '#8b5cf6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.arrowButtonGradient}
          >
            <ArrowRight size={32} color="#ffffff" strokeWidth={2.5} />
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}
