import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert, Linking, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ArrowLeft,
  ExternalLink,
  Send,
  MessageCircle,
  User,
  Clock,
  Sparkles,
  Check,
  X,
  MessageSquare,
  Target,
  TrendingUp,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import useLeadStore from '../state/leadStore';
import useConversationStore from '../state/conversationStore';
import useSubscriptionStore from '../state/subscriptionStore';
import { hapticFeedback } from '../utils/hapticFeedback';
import { Conversation } from '../types/lead';
import GeminiService from '../services/GeminiService';
import useBrainStore from '../state/brainStore';
import DMTemplates, { DMTemplate } from '../components/DMTemplates';
import PaywallModal from '../components/PaywallModal';
import { useWorkspaceColor } from '../hooks/useWorkspaceColor';
import { formatRelativeTime } from '../utils/dateUtils';

export default function LeadDetailScreen() {
  const { isDark } = useTheme();
  const { color, colorWithOpacity } = useWorkspaceColor();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const { leadId } = route.params;

  // Store state
  const leads = useLeadStore(s => s.leads);
  const approveLead = useLeadStore(s => s.approveLead);
  const rejectLead = useLeadStore(s => s.rejectLead);
  const setDMMessage = useLeadStore(s => s.setDMMessage);
  const sendDMAndComment = useLeadStore(s => s.sendDMAndComment);
  const addConversation = useConversationStore(s => s.addConversation);
  const conversations = useConversationStore(s => s.conversations);
  const knowledgeItems = useBrainStore(s => s.knowledgeItems);

  // Subscription state for paywall trigger
  const isPremium = useSubscriptionStore(s => s.isPremium);
  const shouldShowPaywall = useSubscriptionStore(s => s.shouldShowPaywall);
  const markFirstDMSent = useSubscriptionStore(s => s.markFirstDMSent);
  const refreshSubscriptionStatus = useSubscriptionStore(s => s.refreshSubscriptionStatus);

  const lead = useMemo(() => leads.find(l => l.id === leadId), [leads, leadId]);

  const existingConversation = useMemo(
    () => conversations.find(c => c.leadId === leadId),
    [conversations, leadId],
  );

  // Local state
  const [dmMessage, setDmMessageLocal] = useState(lead?.dmMessage || '');
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();

  const handleBack = useCallback(() => {
    hapticFeedback.light();
    navigation.goBack();
  }, [navigation]);

  const handleOpenPost = useCallback(() => {
    if (lead?.post.url) {
      Linking.openURL(lead.post.url);
    }
  }, [lead]);

  const handleApprove = useCallback(() => {
    if (!lead) return;
    hapticFeedback.success();
    approveLead(lead.id);
  }, [lead, approveLead]);

  const handleReject = useCallback(() => {
    if (!lead) return;
    hapticFeedback.medium();
    Alert.alert(
      'Skip Lead?',
      'This lead will be removed from your queue.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: () => {
            rejectLead(lead.id);
            navigation.goBack();
          },
        },
      ],
    );
  }, [lead, rejectLead, navigation]);

  const handleGenerateDM = useCallback(async () => {
    if (!lead) return;

    hapticFeedback.medium();
    setIsGenerating(true);

    try {
      const knowledgeContext = knowledgeItems
        .slice(0, 5)
        .map(item => item.content || item.title)
        .join('\n\n');

      const result = await GeminiService.generateDMResponse(
        {
          messages: [],
          leadContext: {
            username: lead.post.author,
            originalPost: `${lead.post.title}\n\n${lead.post.content}`,
            previousInteractions: 0,
          },
        },
        knowledgeContext || 'We help businesses grow through our products and services.',
        { collectEmail: false, emailCollectionStage: 'not_started' },
      );

      if (result.response) {
        setDmMessageLocal(result.response);
      } else {
        const template = `Hey! I saw your post about "${lead.post.title.slice(0, 50)}..." and thought I might be able to help. Would love to chat more about this. Let me know if you're interested!`;
        setDmMessageLocal(template);
      }
    } catch (error) {
      console.error('Error generating DM:', error);
      const template = `Hey! I saw your post about "${lead.post.title.slice(0, 50)}..." and thought I might be able to help. Would love to chat more about this. Let me know if you're interested!`;
      setDmMessageLocal(template);
    } finally {
      setIsGenerating(false);
    }
  }, [lead, knowledgeItems]);

  const handleSelectTemplate = useCallback((template: DMTemplate) => {
    setDmMessageLocal(template.template);
    setSelectedTemplateId(template.id);
  }, []);

  const handleSendDM = useCallback(async () => {
    if (!dmMessage.trim() || !lead) return;

    hapticFeedback.success();
    setIsSending(true);

    try {
      setDMMessage(lead.id, dmMessage);
      const result = await sendDMAndComment(lead.id);

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to send DM');
        setIsSending(false);
        return;
      }

      const newConversation: Conversation = {
        id: `conv_${Date.now()}`,
        leadId: lead.id,
        userId: lead.userId,
        recipientUsername: lead.post.author,
        platform: 'reddit',
        messages: [
          {
            id: `msg_${Date.now()}`,
            conversationId: `conv_${Date.now()}`,
            content: dmMessage,
            isFromUser: true,
            createdAt: new Date(),
          },
        ],
        hasUnread: false,
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      addConversation(newConversation);

      // Mark first DM sent - this triggers the paywall for free users
      markFirstDMSent();

      Alert.alert(
        'Sent!',
        `Your DM has been sent to u/${lead.post.author}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to send DM. Please try again.');
    } finally {
      setIsSending(false);
    }
  }, [dmMessage, lead, addConversation, setDMMessage, sendDMAndComment, navigation, markFirstDMSent]);

  const handleViewConversation = useCallback(() => {
    if (!existingConversation) return;
    hapticFeedback.light();
    navigation.navigate('Conversation', { conversationId: existingConversation.id });
  }, [existingConversation, navigation]);

  if (!lead) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
        <SafeAreaView style={styles.centered}>
          <Text style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Lead not found</Text>
        </SafeAreaView>
      </View>
    );
  }

  const isPending = lead.status === 'pending';
  const isApproved = lead.status === 'approved' || lead.status === 'dm_ready';
  const isContacted = lead.status === 'contacted' || lead.status === 'dm_sent';

  const gradientColors = isDark
    ? [colorWithOpacity(0.1), '#0F172A', '#0F172A'] as const
    : ['#FFFFFF', '#F8FAFC', '#F1F5F9'] as const;

  // Score color
  const getScoreColor = (score: number) => {
    if (score >= 8) return '#10B981';
    if (score >= 6) return '#F59E0B';
    return '#6B7280';
  };

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
            <Text style={[styles.headerTitle, { color: isDark ? '#F9FAFB' : '#111827' }]}>
              Lead Details
            </Text>
          </View>
          <Pressable onPress={handleOpenPost} style={styles.externalButton}>
            <ExternalLink size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Lead Header Card */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
            <View style={[styles.card, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            }]}>
              {/* Top row: Subreddit + Score */}
              <View style={styles.cardTopRow}>
                <View style={[styles.subredditBadge, { backgroundColor: isDark ? 'rgba(255, 69, 0, 0.12)' : '#FFF0ED' }]}>
                  <Text style={styles.subredditText}>r/{lead.post.subreddit}</Text>
                </View>
                <View style={[styles.scoreBadge, { backgroundColor: `${getScoreColor(lead.relevanceScore)}15` }]}>
                  <TrendingUp size={12} color={getScoreColor(lead.relevanceScore)} />
                  <Text style={[styles.scoreText, { color: getScoreColor(lead.relevanceScore) }]}>
                    {lead.relevanceScore}/10
                  </Text>
                </View>
              </View>

              {/* Title */}
              <Text style={[styles.postTitle, { color: isDark ? '#F9FAFB' : '#111827' }]}>
                {lead.post.title}
              </Text>

              {/* Content preview */}
              {lead.post.content && (
                <Text
                  style={[styles.postContent, { color: isDark ? '#9CA3AF' : '#6B7280' }]}
                  numberOfLines={4}
                >
                  {lead.post.content}
                </Text>
              )}

              {/* Meta row */}
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <User size={14} color={isDark ? '#6B7280' : '#9CA3AF'} />
                  <Text style={[styles.metaText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                    u/{lead.post.author}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Clock size={14} color={isDark ? '#6B7280' : '#9CA3AF'} />
                  <Text style={[styles.metaText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                    {formatRelativeTime(lead.post.createdAt)}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* AI Analysis */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
            <View style={[styles.card, {
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.08)' : '#EFF6FF',
              borderColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#DBEAFE',
            }]}>
              <View style={styles.aiHeader}>
                <View style={[styles.aiIconContainer, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#DBEAFE' }]}>
                  <Sparkles size={16} color="#3B82F6" />
                </View>
                <Text style={[styles.aiTitle, { color: isDark ? '#93C5FD' : '#1E40AF' }]}>
                  Why this lead?
                </Text>
              </View>

              <Text style={[styles.aiReason, { color: isDark ? '#BFDBFE' : '#1E3A8A' }]}>
                {lead.aiReason}
              </Text>

              {/* Keywords */}
              <View style={styles.keywordsRow}>
                {lead.matchedKeywords.slice(0, 5).map((keyword, idx) => (
                  <View
                    key={idx}
                    style={[styles.keywordBadge, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#DBEAFE' }]}
                  >
                    <Text style={[styles.keywordText, { color: '#3B82F6' }]}>{keyword}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>

          {/* Action buttons for pending leads */}
          {isPending && (
            <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
              <View style={styles.actionRow}>
                <Pressable
                  onPress={handleReject}
                  style={[styles.rejectButton, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2' }]}
                >
                  <X size={18} color="#EF4444" />
                  <Text style={styles.rejectButtonText}>Skip</Text>
                </Pressable>
                <Pressable
                  onPress={handleApprove}
                  style={[styles.approveButton, { backgroundColor: color }]}
                >
                  <Check size={18} color="#FFFFFF" />
                  <Text style={styles.approveButtonText}>Reach Out</Text>
                </Pressable>
              </View>
            </Animated.View>
          )}

          {/* DM Composer */}
          {isApproved && (
            <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
              <View style={[styles.card, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              }]}>
                <View style={styles.composerHeader}>
                  <MessageCircle size={18} color={color} />
                  <Text style={[styles.composerTitle, { color: isDark ? '#F9FAFB' : '#111827' }]}>
                    Message to u/{lead.post.author}
                  </Text>
                </View>

                {/* Templates */}
                <DMTemplates
                  selectedId={selectedTemplateId}
                  onSelectTemplate={handleSelectTemplate}
                  onGenerateAI={handleGenerateDM}
                  isGeneratingAI={isGenerating}
                />

                {/* Text input */}
                <View style={[styles.textInputContainer, {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
                }]}>
                  <TextInput
                    value={dmMessage}
                    onChangeText={setDmMessageLocal}
                    placeholder="Write your message..."
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    multiline
                    numberOfLines={6}
                    style={[styles.textInput, { color: isDark ? '#F9FAFB' : '#111827' }]}
                  />
                </View>

                {/* Info */}
                <View style={[styles.infoBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ECFDF5' }]}>
                  <Check size={14} color="#10B981" />
                  <Text style={[styles.infoText, { color: isDark ? '#6EE7B7' : '#047857' }]}>
                    A comment will be posted letting them know to check their DMs
                  </Text>
                </View>

                {/* Send button */}
                <Pressable
                  onPress={handleSendDM}
                  disabled={!dmMessage.trim() || isSending}
                  style={[
                    styles.sendButton,
                    { backgroundColor: dmMessage.trim() && !isSending ? color : isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' },
                  ]}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Send size={18} color={dmMessage.trim() ? '#FFFFFF' : isDark ? '#6B7280' : '#9CA3AF'} />
                      <Text style={[
                        styles.sendButtonText,
                        { color: dmMessage.trim() ? '#FFFFFF' : isDark ? '#6B7280' : '#9CA3AF' },
                      ]}>
                        Send Message
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </Animated.View>
          )}

          {/* Contacted status */}
          {isContacted && (
            <Animated.View entering={FadeIn.duration(400)} style={styles.section}>
              <View style={[styles.card, {
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ECFDF5',
                borderColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#A7F3D0',
              }]}>
                <View style={styles.statusHeader}>
                  <Check size={20} color="#10B981" />
                  <Text style={[styles.statusTitle, { color: '#10B981' }]}>Message Sent</Text>
                </View>
                <Text style={[styles.statusText, { color: isDark ? '#6EE7B7' : '#047857' }]}>
                  Check your conversations for any replies from u/{lead.post.author}
                </Text>

                {lead.dmMessage && (
                  <View style={[styles.sentMessageBox, { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#FFFFFF' }]}>
                    <Text style={[styles.sentMessageLabel, { color: isDark ? '#6EE7B7' : '#047857' }]}>
                      Your message:
                    </Text>
                    <Text style={[styles.sentMessageText, { color: isDark ? '#D1FAE5' : '#064E3B' }]}>
                      {lead.dmMessage}
                    </Text>
                  </View>
                )}

                {existingConversation && (
                  <Pressable
                    onPress={handleViewConversation}
                    style={[styles.viewConversationButton, { backgroundColor: '#10B981' }]}
                  >
                    <MessageSquare size={18} color="#FFFFFF" />
                    <Text style={styles.viewConversationText}>View Conversation</Text>
                  </Pressable>
                )}
              </View>
            </Animated.View>
          )}

          {/* Responded status */}
          {lead.status === 'responded' && (
            <Animated.View entering={FadeIn.duration(400)} style={styles.section}>
              <View style={[styles.card, {
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.08)' : '#EFF6FF',
                borderColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#BFDBFE',
              }]}>
                <View style={styles.statusHeader}>
                  <MessageCircle size={20} color="#3B82F6" />
                  <Text style={[styles.statusTitle, { color: '#3B82F6' }]}>They Replied!</Text>
                </View>
                <Text style={[styles.statusText, { color: isDark ? '#93C5FD' : '#1E40AF' }]}>
                  Continue the conversation to close the deal
                </Text>

                {existingConversation && (
                  <Pressable
                    onPress={handleViewConversation}
                    style={[styles.viewConversationButton, { backgroundColor: '#3B82F6' }]}
                  >
                    <MessageSquare size={18} color="#FFFFFF" />
                    <Text style={styles.viewConversationText}>Continue Conversation</Text>
                  </Pressable>
                )}
              </View>
            </Animated.View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Non-dismissible paywall shown after first DM for free users */}
      <PaywallModal
        visible={shouldShowPaywall && !isPremium}
        onSuccess={() => {
          refreshSubscriptionStatus();
        }}
        canDismiss={false}
      />
    </View>
  );
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
  scrollContent: {
    paddingBottom: 20,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  externalButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sections
  section: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  // Post card
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  subredditBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  subredditText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF4500',
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700',
  },
  postTitle: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  postContent: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // AI card
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  aiIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  aiReason: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  keywordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  keywordBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  keywordText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Actions
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  rejectButtonText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
  approveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  // Composer
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  composerTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  textInputContainer: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    marginBottom: 12,
  },
  textInput: {
    padding: 14,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    gap: 10,
    marginBottom: 14,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Status cards
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  sentMessageBox: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  sentMessageLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sentMessageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  viewConversationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  viewConversationText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
