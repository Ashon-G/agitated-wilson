/**
 * SetupProgressCard - Holographic card showing onboarding/setup progress
 *
 * Shows checklist of setup items with progress bar.
 * Guides users to complete their setup for best experience.
 * Supports both light and dark modes with frosted glass effects.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Settings2, Check, Circle, ChevronRight } from 'lucide-react-native';
import HolographicCard, { CardIcon } from './HolographicCard';
import { DashboardState } from '../../hooks/useDashboardState';
import { useTheme } from '../../contexts/ThemeContext';
import { getGlassStyles } from '../../utils/colors';

interface SetupProgressCardProps {
  dashboardState: DashboardState;
}

export default function SetupProgressCard({ dashboardState }: SetupProgressCardProps) {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const glass = getGlassStyles(isDark);
  const { setupProgress, setupItems } = dashboardState;

  // Don't show if setup is complete
  if (setupProgress >= 100) return null;

  // Find next incomplete required item
  const nextItem = setupItems.find(item => !item.completed && item.id !== 'hubspot');

  const handlePress = () => {
    if (nextItem?.action) {
      navigation.navigate(nextItem.action);
    }
  };

  // Theme-aware gradient colors
  const gradientColors: [string, string, string] = isDark
    ? ['rgba(251, 191, 36, 0.2)', 'rgba(249, 115, 22, 0.15)', 'rgba(239, 68, 68, 0.1)']
    : ['rgba(251, 191, 36, 0.15)', 'rgba(249, 115, 22, 0.1)', 'rgba(239, 68, 68, 0.05)'];

  return (
    <HolographicCard
      onPress={handlePress}
      gradientColors={gradientColors}
      glowColor={isDark ? 'rgba(251, 191, 36, 0.4)' : 'rgba(251, 191, 36, 0.25)'}
    >
      <View style={styles.container}>
        {/* Header row */}
        <View style={styles.header}>
          <CardIcon color="#FBBF24">
            <Settings2 size={20} color="#FBBF24" />
          </CardIcon>

          <View style={styles.headerText}>
            <Text style={[styles.title, { color: glass.text }]}>Finish Setup</Text>
            <Text style={[styles.subtitle, { color: glass.textSecondary }]}>
              {setupProgress}% complete
            </Text>
          </View>

          <ChevronRight size={16} color={glass.textMuted} />
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' }]}>
            <View style={[styles.progressFill, { width: `${setupProgress}%` }]} />
          </View>
        </View>

        {/* Checklist */}
        <View style={styles.checklist}>
          {setupItems
            .filter(item => item.id !== 'hubspot') // Only show required items
            .map((item) => (
              <View key={item.id} style={styles.checkItem}>
                {item.completed ? (
                  <View style={[styles.checkIcon, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.15)' }]}>
                    <Check size={12} color="#22C55E" strokeWidth={3} />
                  </View>
                ) : (
                  <Circle size={16} color={glass.textMuted} />
                )}
                <Text style={[
                  styles.checkText,
                  { color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(31, 41, 55, 0.8)' },
                  item.completed && {
                    color: glass.textMuted,
                    textDecorationLine: 'line-through',
                  },
                ]}>
                  {item.label}
                </Text>
              </View>
            ))}
        </View>

        {/* Next action hint */}
        {nextItem && (
          <View style={[styles.nextAction, { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' }]}>
            <Text style={styles.nextActionText}>
              Tap to {nextItem.label.toLowerCase()}
            </Text>
          </View>
        )}
      </View>
    </HolographicCard>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 16,
    marginBottom: 12,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FBBF24',
    borderRadius: 2,
  },
  checklist: {
    gap: 8,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    fontSize: 13,
  },
  nextAction: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  nextActionText: {
    fontSize: 12,
    color: '#FBBF24',
    fontWeight: '500',
  },
});
