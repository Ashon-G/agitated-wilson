import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, MessageCircle, ChevronRight, Inbox } from 'lucide-react-native';
import Animated, { FadeInRight, FadeIn } from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import useConversationStore from '../state/conversationStore';
import useLeadStore from '../state/leadStore';
import { Conversation } from '../types/lead';
import { hapticFeedback } from '../utils/hapticFeedback';
import { formatRelativeTime } from '../utils/dateUtils';
import { useWorkspaceColor } from '../hooks/useWorkspaceColor';

export default function ConversationsListScreen() {
  const { isDark } = useTheme();
  const navigation = useNavigation<any>();
  const { color, colorWithOpacity } = useWorkspaceColor();

  // Store state
  const conversations = useConversationStore(s => s.conversations);
  const leads = useLeadStore(s => s.leads);

  const handleBack = useCallback(() => {
    hapticFeedback.light();
    navigation.goBack();
  }, [navigation]);

  const handleConversationPress = useCallback((conversationId: string) => {
    hapticFeedback.light();
    navigation.navigate('Conversation', { conversationId });
  }, [navigation]);

  // Sort conversations by last message date
  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );
  }, [conversations]);

  // Stats
  const unreadCount = useMemo(() => conversations.filter(c => c.hasUnread).length, [conversations]);
  const totalCount = conversations.length;

  const gradientColors = isDark
    ? [colorWithOpacity(0.12), '#0F172A', '#0F172A'] as const
    : ['#FFFFFF', '#F8FAFC', '#F1F5F9'] as const;

  const renderConversation = useCallback(({ item, index }: { item: Conversation; index: number }) => {
    const relatedLead = leads.find(l => l.id === item.leadId);
    const lastMessage = item.messages[item.messages.length - 1];
    const initial = item.recipientUsername.charAt(0).toUpperCase();

    return (
      <Animated.View entering={FadeInRight.duration(300).delay(index * 40)}>
        <Pressable
          onPress={() => handleConversationPress(item.id)}
          style={({ pressed }) => [
            styles.conversationCard,
            {
              backgroundColor: isDark
                ? pressed ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'
                : pressed ? 'rgba(0,0,0,0.04)' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            },
          ]}
        >
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: item.hasUnread ? colorWithOpacity(0.15) : isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' },
              ]}
            >
              <Text style={[styles.avatarText, { color: item.hasUnread ? color : isDark ? '#9CA3AF' : '#6B7280' }]}>
                {initial}
              </Text>
            </View>
            {item.hasUnread && (
              <View style={[styles.unreadBadge, { backgroundColor: color }]} />
            )}
          </View>

          {/* Content */}
          <View style={styles.contentContainer}>
            {/* Top row: Username + Time */}
            <View style={styles.topRow}>
              <Text
                style={[
                  styles.username,
                  { color: isDark ? '#F9FAFB' : '#111827' },
                  item.hasUnread && styles.usernameUnread,
                ]}
                numberOfLines={1}
              >
                u/{item.recipientUsername}
              </Text>
              <Text style={[styles.timeText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                {formatRelativeTime(new Date(item.lastMessageAt))}
              </Text>
            </View>

            {/* Subreddit tag */}
            {relatedLead && (
              <View style={styles.tagRow}>
                <View style={[styles.subredditTag, { backgroundColor: isDark ? 'rgba(255, 69, 0, 0.12)' : '#FFF0ED' }]}>
                  <Text style={styles.subredditText}>r/{relatedLead.post.subreddit}</Text>
                </View>
              </View>
            )}

            {/* Last message preview */}
            {lastMessage && (
              <Text
                style={[
                  styles.lastMessage,
                  { color: isDark ? '#9CA3AF' : '#6B7280' },
                  item.hasUnread && { color: isDark ? '#D1D5DB' : '#4B5563', fontWeight: '500' },
                ]}
                numberOfLines={2}
              >
                {lastMessage.isFromUser ? 'You: ' : ''}{lastMessage.content}
              </Text>
            )}
          </View>

          {/* Chevron */}
          <ChevronRight size={18} color={isDark ? '#4B5563' : '#D1D5DB'} />
        </Pressable>
      </Animated.View>
    );
  }, [leads, color, colorWithOpacity, isDark, handleConversationPress]);

  const listHeader = useMemo(() => (
    <Animated.View entering={FadeIn.duration(400)} style={styles.statsContainer}>
      <View style={[styles.statCard, {
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      }]}>
        <View style={[styles.statIconContainer, { backgroundColor: colorWithOpacity(0.1) }]}>
          <Inbox size={18} color={color} />
        </View>
        <View>
          <Text style={[styles.statNumber, { color: isDark ? '#F9FAFB' : '#111827' }]}>
            {totalCount}
          </Text>
          <Text style={[styles.statLabel, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
            Total
          </Text>
        </View>
      </View>
      <View style={[styles.statCard, {
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      }]}>
        <View style={[styles.statIconContainer, { backgroundColor: unreadCount > 0 ? colorWithOpacity(0.15) : isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6' }]}>
          <MessageCircle size={18} color={unreadCount > 0 ? color : isDark ? '#6B7280' : '#9CA3AF'} />
        </View>
        <View>
          <Text style={[styles.statNumber, { color: isDark ? '#F9FAFB' : '#111827' }]}>
            {unreadCount}
          </Text>
          <Text style={[styles.statLabel, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
            Unread
          </Text>
        </View>
      </View>
    </Animated.View>
  ), [totalCount, unreadCount, color, colorWithOpacity, isDark]);

  const emptyComponent = useMemo(() => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colorWithOpacity(0.1) }]}>
        <MessageCircle size={32} color={color} />
      </View>
      <Text style={[styles.emptyTitle, { color: isDark ? '#F9FAFB' : '#111827' }]}>
        No conversations yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
        Send a DM to a lead to start a conversation
      </Text>
    </View>
  ), [color, colorWithOpacity, isDark]);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
      <LinearGradient
        colors={gradientColors}
        locations={[0, 0.3, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={22} color={isDark ? '#F9FAFB' : '#111827'} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: isDark ? '#F9FAFB' : '#111827' }]}>
            Conversations
          </Text>
          {unreadCount > 0 && (
            <View style={[styles.headerBadge, { backgroundColor: color }]}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </SafeAreaView>

      <FlashList
        data={sortedConversations}
        renderItem={renderConversation}
        keyExtractor={item => item.id}
        estimatedItemSize={100}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={totalCount > 0 ? listHeader : null}
        ListEmptyComponent={emptyComponent}
        ListFooterComponent={<View style={{ height: 100 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  // Stats
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  // List
  listContent: {
    paddingTop: 8,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  unreadBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  contentContainer: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  username: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    letterSpacing: -0.2,
  },
  usernameUnread: {
    fontWeight: '700',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 8,
  },
  tagRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  subredditTag: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  subredditText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF4500',
  },
  lastMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
