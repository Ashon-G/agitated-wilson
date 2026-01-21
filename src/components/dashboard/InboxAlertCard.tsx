/**
 * InboxAlertCard - Holographic card showing unread Reddit replies
 *
 * Displays count of unread messages with preview.
 * Tapping navigates to inbox for conversation.
 * Supports both light and dark modes with frosted glass effects.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MessageCircle, ChevronRight } from 'lucide-react-native';
import HolographicCard, { CardBadge, CardIcon, getDarkerColor } from './HolographicCard';
import { DashboardState } from '../../hooks/useDashboardState';
import { useTheme } from '../../contexts/ThemeContext';
import { getGlassStyles } from '../../utils/colors';

interface InboxAlertCardProps {
  dashboardState: DashboardState;
}

export default function InboxAlertCard({ dashboardState }: InboxAlertCardProps) {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const glass = getGlassStyles(isDark);
  const { unreadReplies, unreadReplyItems } = dashboardState;
  const blueColor = isDark ? '#38BDF8' : getDarkerColor('#38BDF8');

  // Don't render if no unread replies
  if (unreadReplies === 0) return null;

  const topReply = unreadReplyItems[0];

  const handlePress = () => {
    // Navigate to inbox tab
    navigation.navigate('MainTabs', { screen: 'Inbox' });
  };

  // Theme-aware gradient colors
  const gradientColors: [string, string, string] = isDark
    ? ['rgba(56, 189, 248, 0.2)', 'rgba(14, 165, 233, 0.15)', 'rgba(2, 132, 199, 0.1)']
    : ['rgba(56, 189, 248, 0.15)', 'rgba(14, 165, 233, 0.1)', 'rgba(2, 132, 199, 0.05)'];

  return (
    <HolographicCard
      onPress={handlePress}
      gradientColors={gradientColors}
      glowColor={isDark ? 'rgba(56, 189, 248, 0.4)' : 'rgba(56, 189, 248, 0.25)'}
    >
      <View style={styles.container}>
        {/* Header row */}
        <View style={styles.header}>
          <CardIcon color="#38BDF8">
            <MessageCircle size={20} color={blueColor} />
          </CardIcon>

          <View style={styles.headerText}>
            <Text style={[styles.title, { color: glass.text }]}>New Replies</Text>
            <Text style={[styles.subtitle, { color: glass.textSecondary }]}>
              {unreadReplies === 1
                ? 'Someone replied!'
                : `${unreadReplies} new messages`}
            </Text>
          </View>

          <View style={styles.badgeRow}>
            <CardBadge count={unreadReplies} color="#38BDF8" />
            <ChevronRight size={16} color={glass.textMuted} style={styles.chevron} />
          </View>
        </View>

        {/* Preview of top reply */}
        {topReply && (
          <View style={[styles.preview, { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' }]}>
            <Text style={[styles.previewAuthor, { color: blueColor }]}>u/{topReply.author}</Text>
            <Text style={[styles.previewText, { color: glass.textSecondary }]} numberOfLines={2}>
              {topReply.preview}
            </Text>
          </View>
        )}

        {/* More indicator */}
        {unreadReplies > 1 && (
          <Text style={[styles.moreText, { color: glass.textMuted }]}>
            +{unreadReplies - 1} more
          </Text>
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
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevron: {
    marginLeft: 4,
  },
  preview: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  previewAuthor: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewText: {
    fontSize: 13,
    lineHeight: 18,
  },
  moreText: {
    fontSize: 11,
    marginTop: 8,
    textAlign: 'right',
  },
});
