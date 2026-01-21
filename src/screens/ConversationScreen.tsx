import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Send, RefreshCw, MoreHorizontal, ExternalLink, Check, CheckCheck } from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import { GLASS } from '../utils/colors';
import useConversationStore from '../state/conversationStore';
import useLeadStore from '../state/leadStore';
import { ConversationMessage } from '../types/lead';
import { hapticFeedback } from '../utils/hapticFeedback';
import LeadHuntingService from '../services/LeadHuntingService';
import RedditAPIService from '../services/RedditAPIService';
import { useWorkspaceColor } from '../hooks/useWorkspaceColor';
import FloatingLeadAvatar from '../components/FloatingLeadAvatar';

export default function ConversationScreen() {
  const { isDark } = useTheme();
  const { color, colorWithOpacity } = useWorkspaceColor();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const flatListRef = useRef<FlatList>(null);

  const { conversationId } = route.params;

  // Store state
  const conversations = useConversationStore(s => s.conversations);
  const addMessage = useConversationStore(s => s.addMessage);
  const markAsRead = useConversationStore(s => s.markAsRead);

  // Get lead info if this conversation is linked to a lead
  const leads = useLeadStore(s => s.leads);

  const conversation = useMemo(
    () => conversations.find(c => c.id === conversationId),
    [conversations, conversationId],
  );

  const relatedLead = useMemo(
    () => conversation ? leads.find(l => l.id === conversation.leadId) : null,
    [conversation, leads],
  );

  // Local state
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [messageSendStatus, setMessageSendStatus] = useState<'normal' | 'sending' | 'success'>('normal');

  // Mark as read when opening
  useEffect(() => {
    if (conversation?.hasUnread) {
      markAsRead(conversationId);
    }
  }, [conversationId, markAsRead, conversation?.hasUnread]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (conversation?.messages.length) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [conversation?.messages.length]);

  const handleBack = useCallback(() => {
    hapticFeedback.light();
    navigation.goBack();
  }, [navigation]);

  // Refresh messages from Reddit
  const handleRefresh = useCallback(async () => {
    if (!conversation) return;

    setIsRefreshing(true);
    hapticFeedback.light();

    try {
      const result = await RedditAPIService.fetchAllMessages(50);

      if (result.success && result.data) {
        const relevantMessages = result.data.filter(
          msg => msg.author.toLowerCase() === conversation.recipientUsername.toLowerCase() ||
                 (msg.type === 'private_message' && msg.subject?.includes(conversation.recipientUsername)),
        );

        for (const msg of relevantMessages) {
          const existingMsg = conversation.messages.find(m => m.id === `msg_${msg.id}`);
          if (!existingMsg) {
            const newMessage: ConversationMessage = {
              id: `msg_${msg.id}`,
              conversationId: conversation.id,
              content: msg.body,
              isFromUser: false,
              createdAt: new Date(msg.created * 1000),
            };
            addMessage(conversation.id, newMessage);
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing messages:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [conversation, addMessage]);

  // Send a DM via Reddit API
  const handleSend = useCallback(async () => {
    if (!message.trim() || !conversation) return;

    hapticFeedback.medium();
    setIsSending(true);
    setMessageSendStatus('sending'); // Start animation

    try {
      const result = await LeadHuntingService.sendDM(
        conversation.recipientUsername,
        relatedLead
          ? `Re: Your post in r/${relatedLead.post.subreddit}`
          : 'Message',
        message.trim(),
      );

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to send message');
        setIsSending(false);
        setMessageSendStatus('normal'); // Reset on error
        return;
      }

      const newMessage: ConversationMessage = {
        id: `msg_${Date.now()}`,
        conversationId: conversation.id,
        content: message.trim(),
        isFromUser: true,
        createdAt: new Date(),
        status: 'sent', // Mark as sent
      };

      addMessage(conversation.id, newMessage);
      setMessage('');

      // Show success animation
      setMessageSendStatus('success');
      hapticFeedback.success();

      // Reset to normal after 2 seconds
      setTimeout(() => {
        setMessageSendStatus('normal');
      }, 2000);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      setMessageSendStatus('normal'); // Reset on error
    } finally {
      setIsSending(false);
    }
  }, [message, conversation, relatedLead, addMessage]);

  if (!conversation) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
        <SafeAreaView style={styles.centered}>
          <Text style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Conversation not found</Text>
        </SafeAreaView>
      </View>
    );
  }

  const renderMessage = ({ item, index }: { item: ConversationMessage; index: number }) => {
    const isFirstInGroup = index === 0 ||
      conversation.messages[index - 1]?.isFromUser !== item.isFromUser;
    const isLastInGroup = index === conversation.messages.length - 1 ||
      conversation.messages[index + 1]?.isFromUser !== item.isFromUser;

    return (
      <MessageBubble
        message={item}
        isDark={isDark}
        color={color}
        recipientUsername={conversation.recipientUsername}
        isFirstInGroup={isFirstInGroup}
        isLastInGroup={isLastInGroup}
      />
    );
  };

  const gradientColors = isDark
    ? [colorWithOpacity(0.08), '#0F172A', '#0F172A'] as const
    : ['#FFFFFF', '#F8FAFC', '#F1F5F9'] as const;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
      <LinearGradient
        colors={gradientColors}
        locations={[0, 0.3, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView edges={['top']} style={styles.flex}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={22} color={isDark ? '#F9FAFB' : '#111827'} />
          </Pressable>

          <View style={styles.headerCenter}>
            {/* Avatar */}
            <View style={[styles.avatar, { backgroundColor: colorWithOpacity(0.15) }]}>
              <Text style={[styles.avatarText, { color }]}>
                {conversation.recipientUsername.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.headerInfo}>
              <Text style={[styles.headerTitle, { color: isDark ? '#F9FAFB' : '#111827' }]}>
                u/{conversation.recipientUsername}
              </Text>
              {relatedLead && (
                <View style={styles.subredditRow}>
                  <View style={[styles.subredditDot, { backgroundColor: '#FF4500' }]} />
                  <Text style={styles.subredditLabel}>r/{relatedLead.post.subreddit}</Text>
                </View>
              )}
            </View>
          </View>

          <Pressable
            onPress={handleRefresh}
            disabled={isRefreshing}
            style={[styles.iconButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color={isDark ? '#9CA3AF' : '#6B7280'} />
            ) : (
              <RefreshCw size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
            )}
          </Pressable>
        </View>

        {/* Lead context banner */}
        {relatedLead && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.contextBanner}>
            <View style={[styles.contextCard, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            }]}>
              <Text
                style={[styles.contextText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}
                numberOfLines={2}
              >
                {relatedLead.post.title}
              </Text>
              <Pressable style={styles.contextLink}>
                <ExternalLink size={14} color={color} />
              </Pressable>
            </View>
          </Animated.View>
        )}

        {/* Floating Avatar */}
        {conversation.messages.length === 0 && (
          <View style={styles.avatarContainer}>
            <FloatingLeadAvatar
              username={conversation.recipientUsername}
              size={140}
              animationState={messageSendStatus}
            />
          </View>
        )}

        {/* Messages */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={flatListRef}
            data={conversation.messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyMessages}>
                <Text style={[styles.emptyText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                  No messages yet. Start the conversation!
                </Text>
              </View>
            }
          />

          {/* Input Area */}
          <View style={[styles.inputContainer, {
            borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          }]}>
            <SafeAreaView edges={['bottom']}>
              <View style={styles.inputRow}>
                <View style={[styles.inputWrapper, {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                }]}>
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Type a message..."
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    multiline
                    maxLength={1000}
                    style={[styles.input, { color: isDark ? '#F9FAFB' : '#111827' }]}
                  />
                </View>
                <Pressable
                  onPress={handleSend}
                  disabled={!message.trim() || isSending}
                  style={[
                    styles.sendButton,
                    { backgroundColor: message.trim() && !isSending ? color : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
                  ]}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Send size={18} color={message.trim() ? '#FFFFFF' : isDark ? '#6B7280' : '#9CA3AF'} />
                  )}
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// Message Bubble Component - Modern, clean design
function MessageBubble({
  message,
  isDark,
  color,
  recipientUsername,
  isFirstInGroup,
  isLastInGroup,
}: {
  message: ConversationMessage;
  isDark: boolean;
  color: string;
  recipientUsername: string;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
}) {
  const { isFromUser } = message;

  // Adaptive border radius based on position in message group
  const getBorderRadius = () => {
    if (isFromUser) {
      return {
        borderTopLeftRadius: 18,
        borderTopRightRadius: isFirstInGroup ? 18 : 6,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: isLastInGroup ? 18 : 6,
      };
    }
    return {
      borderTopLeftRadius: isFirstInGroup ? 18 : 6,
      borderTopRightRadius: 18,
      borderBottomLeftRadius: isLastInGroup ? 18 : 6,
      borderBottomRightRadius: 18,
    };
  };

  return (
    <Animated.View
      entering={FadeInUp.duration(250).springify()}
      style={[
        styles.messageRow,
        isFromUser ? styles.messageRowRight : styles.messageRowLeft,
        !isLastInGroup && { marginBottom: 2 },
      ]}
    >
      <View
        style={[
          styles.messageBubble,
          isFromUser
            ? { backgroundColor: color }
            : { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF' },
          !isFromUser && {
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          },
          getBorderRadius(),
        ]}
      >
        <Text style={[
          styles.messageText,
          { color: isFromUser ? '#FFFFFF' : isDark ? '#F9FAFB' : '#111827' },
        ]}>
          {message.content}
        </Text>

        {/* Delivery status indicator for sent messages */}
        {isFromUser && message.status && (
          <View style={styles.statusIndicator}>
            {message.status === 'sent' ? (
              <CheckCheck size={14} color="rgba(255,255,255,0.8)" strokeWidth={2.5} />
            ) : message.status === 'sending' ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
            ) : null}
          </View>
        )}
      </View>

      {/* Timestamp - only show on last message of group */}
      {isLastInGroup && (
        <Text style={[
          styles.messageTime,
          isFromUser ? styles.messageTimeRight : styles.messageTimeLeft,
          { color: isDark ? '#6B7280' : '#9CA3AF' },
        ]}>
          {formatTime(message.createdAt)}
        </Text>
      )}
    </Animated.View>
  );
}

// Helper function to format time
function formatTime(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  // Header
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
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  subredditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  subredditDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subredditLabel: {
    fontSize: 12,
    color: '#FF4500',
    fontWeight: '500',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Context banner
  contextBanner: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  contextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  contextText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  contextLink: {
    padding: 4,
  },
  // Messages
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  emptyMessages: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
  },
  messageRow: {
    marginBottom: 8,
  },
  messageRowLeft: {
    alignItems: 'flex-start',
    paddingRight: 48,
  },
  messageRowRight: {
    alignItems: 'flex-end',
    paddingLeft: 48,
  },
  messageBubble: {
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    flex: 1,
  },
  statusIndicator: {
    marginLeft: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  messageTimeLeft: {
    marginLeft: 4,
  },
  messageTimeRight: {
    marginRight: 4,
  },
  // Input
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
  },
  input: {
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
