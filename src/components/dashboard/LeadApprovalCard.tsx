/**
 * LeadApprovalCard - Holographic card showing pending lead approvals
 *
 * Displays count of leads needing approval with preview of top lead.
 * Tapping navigates to inbox for approval flow.
 * Supports both light and dark modes with frosted glass effects.
 */

import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UserCheck, ChevronRight } from 'lucide-react-native';
import HolographicCard, { CardBadge, CardIcon } from './HolographicCard';
import { DashboardState } from '../../hooks/useDashboardState';
import { useTheme } from '../../contexts/ThemeContext';
import { getGlassStyles } from '../../utils/colors';

interface LeadApprovalCardProps {
  dashboardState: DashboardState;
}

function LeadApprovalCard({ dashboardState }: LeadApprovalCardProps) {
  const { isDark } = useTheme();
  const glass = getGlassStyles(isDark);
  const { pendingApprovals, pendingApprovalItems } = dashboardState;

  const topLead = pendingApprovalItems[0];

  // Theme-aware gradient colors
  const gradientColors = useMemo((): [string, string, string] => isDark
    ? ['rgba(34, 197, 94, 0.2)', 'rgba(56, 189, 248, 0.15)', 'rgba(129, 140, 248, 0.1)']
    : ['rgba(34, 197, 94, 0.25)', 'rgba(56, 189, 248, 0.2)', 'rgba(129, 140, 248, 0.15)'], [isDark]);

  // Don't render if no pending approvals
  if (pendingApprovals === 0) return null;

  return (
    <HolographicCard
      gradientColors={gradientColors}
      glowColor={isDark ? 'rgba(34, 197, 94, 0.4)' : 'rgba(34, 197, 94, 0.25)'}
    >
      <View style={styles.container}>
        {/* Header row */}
        <View style={styles.header}>
          <CardIcon color="#22C55E">
            <UserCheck size={20} color="#22C55E" />
          </CardIcon>

          <View style={styles.headerText}>
            <Text style={[styles.title, { color: glass.text }]}>Leads Ready</Text>
            <Text style={[styles.subtitle, { color: glass.textSecondary }]}>
              {pendingApprovals === 1
                ? '1 lead needs your approval'
                : `${pendingApprovals} leads need your approval`}
            </Text>
          </View>

          <View style={styles.badgeRow}>
            <CardBadge count={pendingApprovals} color="#22C55E" />
            <ChevronRight size={16} color={glass.textMuted} style={styles.chevron} />
          </View>
        </View>

        {/* Preview of top lead */}
        {topLead && (
          <View style={[styles.preview, { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' }]}>
            <View style={styles.previewDot} />
            <Text style={[styles.previewText, { color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(31, 41, 55, 0.8)' }]} numberOfLines={1}>
              {topLead.subreddit ? `r/${topLead.subreddit}` : 'Lead'}: {topLead.title}
            </Text>
            {topLead.score !== undefined && (
              <View style={[styles.scoreContainer, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.15)' }]}>
                <Text style={styles.scoreText}>{topLead.score}</Text>
              </View>
            )}
          </View>
        )}

        {/* More indicator */}
        {pendingApprovals > 1 && (
          <Text style={[styles.moreText, { color: glass.textMuted }]}>
            +{pendingApprovals - 1} more
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
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  previewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
    marginRight: 8,
  },
  previewText: {
    flex: 1,
    fontSize: 13,
  },
  scoreContainer: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22C55E',
  },
  moreText: {
    fontSize: 11,
    marginTop: 8,
    textAlign: 'right',
  },
});

export default memo(LeadApprovalCard);
