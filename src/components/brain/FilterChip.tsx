import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { hapticFeedback } from '../../utils/hapticFeedback';

interface FilterChipProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
  isDark: boolean;
  accentColor?: string;
}

export function FilterChip({
  label,
  isActive,
  onPress,
  isDark,
  accentColor,
}: FilterChipProps) {
  return (
    <Pressable
      onPress={() => {
        hapticFeedback.light();
        onPress();
      }}
      style={{ marginRight: 8 }}
    >
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 20,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: isActive
            ? (accentColor || '#3B82F6')
            : isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
          backgroundColor: isActive
            ? (accentColor || '#3B82F6')
            : isDark ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.9)',
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: '500',
            color: isActive ? '#FFFFFF' : isDark ? '#9CA3AF' : '#6B7280',
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
