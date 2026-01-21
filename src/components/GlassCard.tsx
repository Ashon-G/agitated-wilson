import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../contexts/ThemeContext';
import { GLASS } from '../utils/colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  intensity?: 'light' | 'medium' | 'heavy';
  disabled?: boolean;
}

export default function GlassCard({
  children,
  style,
  onPress,
  intensity = 'medium',
  disabled = false,
}: GlassCardProps) {
  const { isDark } = useTheme();
  const glass = isDark ? GLASS.dark : GLASS.light;

  const blurIntensity = {
    light: GLASS.blur.light,
    medium: GLASS.blur.medium,
    heavy: GLASS.blur.heavy,
  }[intensity];

  const content = (
    <View style={[styles.container, style]}>
      <BlurView
        intensity={blurIntensity}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: glass.background,
            borderRadius: 20,
          },
        ]}
      />
      <View style={[styles.content, { borderColor: glass.border }]}>
        {children}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} disabled={disabled}>
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  content: {
    padding: 18,
    borderWidth: 0.5,
    borderRadius: 20,
  },
});
