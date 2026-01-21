/**
 * StatsCard - Holographic card showing agent performance stats
 *
 * Displays key metrics: leads found, posts scanned, comments posted, emails collected.
 * Supports both light and dark modes with frosted glass effects.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarChart3, Users, Search, MessageSquare, Mail } from 'lucide-react-native';
import HolographicCard, { CardIcon } from './HolographicCard';
import { DashboardState } from '../../hooks/useDashboardState';
import { useTheme } from '../../contexts/ThemeContext';
import { getGlassStyles } from '../../utils/colors';

interface StatsCardProps {
  dashboardState: DashboardState;
}

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  isDark: boolean;
}

function StatItem({ icon, label, value, color, isDark }: StatItemProps) {
  const glass = getGlassStyles(isDark);

  return (
    <View style={styles.statItem}>
      <View style={[styles.statIcon, { backgroundColor: isDark ? `${color}20` : `${color}15` }]}>
        {icon}
      </View>
      <Text style={[styles.statValue, { color: glass.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: glass.textMuted }]}>{label}</Text>
    </View>
  );
}

export default function StatsCard({ dashboardState }: StatsCardProps) {
  const { isDark } = useTheme();
  const glass = getGlassStyles(isDark);
  const { leadsFound, postsScanned, commentsPosted, emailsCollected } = dashboardState;

  // Only show if there's some activity
  const hasActivity = leadsFound > 0 || postsScanned > 0;
  if (!hasActivity) return null;

  // Theme-aware gradient colors
  const gradientColors: [string, string, string] = isDark
    ? ['rgba(129, 140, 248, 0.2)', 'rgba(167, 139, 250, 0.15)', 'rgba(196, 181, 253, 0.1)']
    : ['rgba(129, 140, 248, 0.25)', 'rgba(167, 139, 250, 0.2)', 'rgba(196, 181, 253, 0.15)'];

  return (
    <HolographicCard
      gradientColors={gradientColors}
      glowColor={isDark ? 'rgba(129, 140, 248, 0.4)' : 'rgba(129, 140, 248, 0.25)'}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <CardIcon color="#818CF8">
            <BarChart3 size={20} color="#818CF8" />
          </CardIcon>

          <View style={styles.headerText}>
            <Text style={[styles.title, { color: glass.text }]}>Agent Stats</Text>
            <Text style={[styles.subtitle, { color: glass.textSecondary }]}>
              How your agent is performing
            </Text>
          </View>
        </View>

        {/* Stats grid */}
        <View style={[styles.statsGrid, { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' }]}>
          <StatItem
            icon={<Users size={14} color="#22C55E" />}
            label="Leads"
            value={leadsFound}
            color="#22C55E"
            isDark={isDark}
          />
          <StatItem
            icon={<Search size={14} color="#38BDF8" />}
            label="Scanned"
            value={postsScanned}
            color="#38BDF8"
            isDark={isDark}
          />
          <StatItem
            icon={<MessageSquare size={14} color="#A78BFA" />}
            label="Comments"
            value={commentsPosted}
            color="#A78BFA"
            isDark={isDark}
          />
          <StatItem
            icon={<Mail size={14} color="#F472B6" />}
            label="Emails"
            value={emailsCollected}
            color="#F472B6"
            isDark={isDark}
          />
        </View>
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
    marginBottom: 16,
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
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
