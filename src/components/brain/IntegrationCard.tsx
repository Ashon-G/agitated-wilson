import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  FadeInDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Integration } from '../../types/app';

interface IntegrationCardProps {
  integration: Integration;
  onPress: () => void;
  index: number;
  isLarge?: boolean;
  isDark: boolean;
}

export function IntegrationCard({ integration, onPress, index, isLarge = false, isDark }: IntegrationCardProps) {
  const glowProgress = useSharedValue(0);

  useEffect(() => {
    if (integration.connected) {
      glowProgress.value = withTiming(1, { duration: 2000 });
    }
  }, [integration.connected]);

  const animatedBorderStyle = useAnimatedStyle(() => {
    'worklet';
    if (!integration.connected) {
      return {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
      } as const;
    }

    const borderColor = interpolateColor(
      glowProgress.value,
      [0, 0.5, 1],
      ['#22C55E', '#4ADE80', '#22C55E'],
    );

    return {
      borderColor,
      borderWidth: 2,
    } as const;
  });

  const getIconName = (iconName: string): keyof typeof Ionicons.glyphMap => {
    const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
      'logo-reddit': 'logo-reddit',
      'logo-linkedin': 'logo-linkedin',
      'logo-google': 'logo-google',
      'logo-slack': 'logo-slack',
      mail: 'mail',
      'cube-outline': 'cube-outline',
    };
    return iconMap[iconName] || 'apps';
  };

  const getIconColor = () => {
    if (integration.id === 'reddit') return '#FF4500';
    if (integration.id === 'box') return '#0061D5';
    if (integration.id === 'hubspot') return '#FF7A59';
    return isDark ? '#60A5FA' : '#3B82F6';
  };

  if (isLarge) {
    return (
      <Animated.View entering={FadeInDown.delay(index * 100).springify()}>
        <Pressable onPress={onPress}>
          <View
            style={{
              borderRadius: 20,
              padding: 20,
              marginBottom: 16,
              overflow: 'hidden',
              borderWidth: integration.connected ? 2 : 1,
              borderColor: integration.connected ? '#22C55E' : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'),
              backgroundColor: isDark ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.9)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: `${getIconColor()}20`,
                }}
              >
                <Ionicons name={getIconName(integration.icon)} size={32} color={getIconColor()} />
              </View>

              {integration.connected && integration.isActive && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 8, height: 8, backgroundColor: '#22C55E', borderRadius: 4, marginRight: 8 }} />
                </View>
              )}
            </View>

            <Text
              style={{
                fontSize: 20,
                fontWeight: '700',
                marginTop: 16,
                color: isDark ? '#FFFFFF' : '#1F2937',
              }}
            >
              {integration.name}
            </Text>

            <Text style={{ fontSize: 14, marginTop: 4, color: isDark ? '#9CA3AF' : '#6B7280' }}>
              {integration.connected
                ? integration.statusText || 'Connected'
                : integration.description}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).springify()}
      style={{ width: '48%', marginBottom: 12 }}
    >
      <Pressable onPress={onPress}>
        <View
          style={{
            borderRadius: 16,
            padding: 16,
            minHeight: 140,
            overflow: 'hidden',
            borderWidth: integration.connected ? 2 : 1,
            borderColor: integration.connected ? '#22C55E' : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'),
            backgroundColor: isDark ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.9)',
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
              backgroundColor: `${getIconColor()}20`,
            }}
          >
            <Ionicons name={getIconName(integration.icon)} size={24} color={getIconColor()} />
          </View>

          <Text
            numberOfLines={1}
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: isDark ? '#FFFFFF' : '#1F2937',
            }}
          >
            {integration.name}
          </Text>

          <Text
            numberOfLines={1}
            style={{
              fontSize: 12,
              marginTop: 4,
              color: '#6B7280',
            }}
          >
            {integration.connected ? 'CONNECTED' : 'CONNECT'}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
