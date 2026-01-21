import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Target, CheckCircle2, ArrowRight, MessageCircle, Sparkles, ExternalLink, Radar } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import useAuthStore from '../../state/authStore';
import { discoverLeads, generateDMForLead } from '../../services/LeadDiscoveryService';
import { Lead, HuntingConfig } from '../../types/lead';
import TavaMascot from '../../components/TavaMascot';
import useInboxStore from '../../state/inboxStore';
import useWorkspaceStore from '../../state/workspaceStore';
import useHuntingStore from '../../state/huntingStore';
import { getAgent, AgentPersonality } from '../../data/agentPersonalities';

// Helper to create gradient colors from brand color
const createGradientFromBrand = (brandColor: string): [string, string, string] => {
  const hex = brandColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const darken = (value: number, amount: number) => Math.max(0, Math.floor(value * amount));
  const darkest = `rgb(${darken(r, 0.15)}, ${darken(g, 0.15)}, ${darken(b, 0.15)})`;
  const darker = `rgb(${darken(r, 0.25)}, ${darken(g, 0.25)}, ${darken(b, 0.25)})`;
  const dark = `rgb(${darken(r, 0.35)}, ${darken(g, 0.35)}, ${darken(b, 0.35)})`;
  return [darkest, darker, dark];
};

const DEFAULT_GRADIENT: [string, string, string] = ['#0f172a', '#1e293b', '#334155'];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'FirstLeadDiscovery'>;

export default function FirstLeadDiscoveryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, onboardingProgress, completeOnboarding } = useAuthStore();
  const { addInboxItem } = useInboxStore.getState();
  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace);
  const { startHunting } = useHuntingStore.getState();

  const [stage, setStage] = useState<'searching' | 'found' | 'error'>('searching');
  const [lead, setLead] = useState<Lead | null>(null);
  const [searchProgress, setSearchProgress] = useState(0);
  const [postsScanned, setPostsScanned] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Initializing hunt...');
  const [matchedAgent, setMatchedAgent] = useState<AgentPersonality | null>(null);

  const firstName = onboardingProgress?.formData?.firstName || 'there';
  const businessName = onboardingProgress?.formData?.businessName || 'your business';
  const businessDescription = onboardingProgress?.formData?.productDescription || '';
  const targetCustomer = onboardingProgress?.formData?.targetMarket || '';
  const keywords = onboardingProgress?.formData?.huntingKeywords || [];
  const subreddits = onboardingProgress?.formData?.huntingSubreddits || [];
  const assignedAgentId = onboardingProgress?.formData?.assignedAgentId || 'sophia';

  // Get brand color from workspace or onboarding progress
  const brandColor = currentWorkspace?.color || onboardingProgress?.formData?.workspaceColor;
  const gradientColors = brandColor ? createGradientFromBrand(brandColor) : DEFAULT_GRADIENT;

  // Animations
  const pulseScale = useSharedValue(1);
  const buttonScale = useSharedValue(1);
  const radarRotation = useSharedValue(0);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const radarStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${radarRotation.value}deg` }],
  }));

  // Start pulse and radar animation
  useEffect(() => {
    if (stage === 'searching') {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 800 }),
          withTiming(1, { duration: 800 }),
        ),
        -1,
        true,
      );
      radarRotation.value = withRepeat(
        withTiming(360, { duration: 2000, easing: Easing.linear }),
        -1,
        false,
      );
    }
  }, [stage, pulseScale, radarRotation]);

  // Get agent on mount
  useEffect(() => {
    const agent = getAgent(assignedAgentId as any);
    setMatchedAgent(agent);
  }, [assignedAgentId]);

  // Discover leads on mount
  useEffect(() => {
    const discoverFirstLead = async () => {
      if (!user?.uid || keywords.length === 0 || subreddits.length === 0) {
        setStage('error');
        return;
      }

      try {
        // Status messages for the hunt
        const statusMessages = [
          'Initializing hunt...',
          `Scanning r/${subreddits[0] || 'startups'}...`,
          'Analyzing post relevance...',
          'Evaluating buying intent...',
          'Scoring potential leads...',
          'Finding the best match...',
        ];
        let messageIndex = 0;

        // Simulate progress with status updates
        const progressInterval = setInterval(() => {
          setSearchProgress(prev => Math.min(prev + Math.random() * 12, 90));
          setPostsScanned(prev => prev + Math.floor(Math.random() * 3) + 1);

          // Update status message
          if (messageIndex < statusMessages.length - 1) {
            messageIndex++;
            setStatusMessage(statusMessages[messageIndex]);
          }
        }, 800);

        const config: HuntingConfig = {
          id: 'onboarding-config',
          userId: user.uid,
          keywords,
          subreddits,
          businessDescription,
          targetCustomer,
          isActive: true,
          minRelevanceScore: 6, // Lower threshold for onboarding to ensure we find something
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = await discoverLeads(user.uid, config, 10);

        clearInterval(progressInterval);
        setSearchProgress(100);
        setStatusMessage('Lead found!');

        if (result.leads.length > 0) {
          // Get the best lead (highest relevance score)
          const bestLead = result.leads.sort((a, b) => b.relevanceScore - a.relevanceScore)[0];
          setLead(bestLead);
          setPostsScanned(result.postsAnalyzed);

          // Add to inbox
          const workspaceId = currentWorkspace?.id || 'default';
          await addInboxItem({
            type: 'approval_request',
            title: `New Reddit Lead: ${bestLead.post.title.slice(0, 50)}...`,
            content: bestLead.aiReason,
            status: 'pending',
            priority: 'high',
            workspaceId,
            userId: user.uid,
            completed: false,
            post: {
              title: bestLead.post.title,
              content: bestLead.post.content,
              subreddit: bestLead.post.subreddit,
              postId: bestLead.post.id,
              url: bestLead.post.url,
            },
            tags: [
              bestLead.relevanceScore >= 8 ? 'high' : bestLead.relevanceScore >= 6 ? 'medium' : 'low',
            ],
          });

          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setStage('found');
        } else {
          setStage('error');
        }
      } catch (error) {
        console.error('Error discovering leads:', error);
        setStage('error');
      }
    };

    // Small delay before starting
    const timer = setTimeout(discoverFirstLead, 1000);
    return () => clearTimeout(timer);
  }, [user?.uid, keywords, subreddits, businessDescription, targetCustomer, currentWorkspace?.id, addInboxItem]);

  const handleContinue = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Start the hunting session in the background
      if (subreddits.length > 0 && keywords.length > 0) {
        startHunting(subreddits, 'balanced', currentWorkspace?.id, keywords).catch(err => {
          console.warn('Failed to start background hunting:', err);
        });
      }

      // Navigate to Agent Reveal screen
      navigation.navigate('AgentReveal', { agentId: assignedAgentId as any });
    } catch (error) {
      console.error('Error navigating to agent reveal:', error);
      // Still try to proceed
      navigation.navigate('AgentReveal', { agentId: assignedAgentId as any });
    }
  }, [navigation, currentWorkspace?.id, subreddits, keywords, startHunting, assignedAgentId]);

  const handleSkipToApp = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Start hunting in background anyway
      if (subreddits.length > 0 && keywords.length > 0) {
        startHunting(subreddits, 'balanced', currentWorkspace?.id, keywords).catch(err => {
          console.warn('Failed to start background hunting:', err);
        });
      }

      // Navigate to Agent Reveal screen
      navigation.navigate('AgentReveal', { agentId: assignedAgentId as any });
    } catch (error) {
      console.error('Error navigating to agent reveal:', error);
      navigation.navigate('AgentReveal', { agentId: assignedAgentId as any });
    }
  }, [navigation, currentWorkspace?.id, subreddits, keywords, startHunting, assignedAgentId]);

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1);
  };

  // Get intent color
  const getIntentColor = (score: number) => {
    if (score >= 8) return '#22C55E';
    if (score >= 6) return '#F59E0B';
    return '#6B7280';
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradientColors}
        style={styles.gradient}
      >
        {/* Searching Stage */}
        {stage === 'searching' && (
          <View style={styles.centerContent}>
            {/* Radar animation container */}
            <View style={styles.radarContainer}>
              <Animated.View style={[styles.radarRing, radarStyle]}>
                <LinearGradient
                  colors={['rgba(99, 102, 241, 0.4)', 'rgba(99, 102, 241, 0)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.radarGradient}
                />
              </Animated.View>
              <Animated.View style={[styles.searchingAvatar, pulseStyle]}>
                <TavaMascot size={SCREEN_HEIGHT * 0.22} />
              </Animated.View>
            </View>

            <Animated.View entering={FadeIn.duration(400)} style={styles.searchingContent}>
              <View style={styles.searchingBadge}>
                <Radar size={18} color="#6366f1" />
                <Text style={styles.searchingBadgeText}>
                  {matchedAgent?.name || 'Agent'} is hunting...
                </Text>
              </View>

              <Text style={styles.searchingTitle}>
                Finding your first lead
              </Text>

              <Text style={styles.searchingSubtitle}>
                Scanning Reddit for people who need {businessName}
              </Text>

              {/* Status message */}
              <Animated.Text
                entering={FadeIn.duration(300)}
                style={styles.statusMessage}
              >
                {statusMessage}
              </Animated.Text>

              {/* Progress bar */}
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBg}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      { width: `${searchProgress}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {postsScanned} posts scanned
                </Text>
              </View>
            </Animated.View>
          </View>
        )}

        {/* Found Stage */}
        {stage === 'found' && lead && (
          <View style={styles.foundContent}>
            <Animated.View entering={FadeInUp.duration(500)} style={styles.foundHeader}>
              <View style={styles.successBadge}>
                <Sparkles size={18} color="#22C55E" />
                <Text style={styles.successBadgeText}>Lead Found!</Text>
              </View>
              <Text style={styles.foundTitle}>
                {matchedAgent?.name || 'Your agent'} found a match!
              </Text>
            </Animated.View>

            {/* Lead Card */}
            <Animated.View entering={FadeIn.delay(300).duration(500)} style={styles.leadCard}>
              <View style={styles.leadCardHeader}>
                <View style={styles.subredditBadge}>
                  <Text style={styles.subredditText}>r/{lead.post.subreddit}</Text>
                </View>
                <View style={[styles.scoreBadge, { backgroundColor: `${getIntentColor(lead.relevanceScore)}20` }]}>
                  <View style={[styles.scoreDot, { backgroundColor: getIntentColor(lead.relevanceScore) }]} />
                  <Text style={[styles.scoreText, { color: getIntentColor(lead.relevanceScore) }]}>
                    {lead.relevanceScore >= 8 ? 'High Intent' : lead.relevanceScore >= 6 ? 'Good Intent' : 'Potential'}
                  </Text>
                </View>
              </View>

              <Text style={styles.leadTitle} numberOfLines={2}>
                {lead.post.title}
              </Text>

              <Text style={styles.leadContent} numberOfLines={3}>
                {lead.post.content || 'No additional content'}
              </Text>

              <View style={styles.leadMeta}>
                <Text style={styles.leadAuthor}>u/{lead.post.author}</Text>
                <View style={styles.leadMetaDot} />
                <MessageCircle size={14} color="#6B7280" />
                <Text style={styles.leadComments}>{lead.post.numComments} comments</Text>
              </View>

              {/* AI Reason */}
              <View style={styles.aiReasonContainer}>
                <Sparkles size={14} color="#6366f1" />
                <Text style={styles.aiReasonText}>{lead.aiReason}</Text>
              </View>
            </Animated.View>

            {/* Continue Button */}
            <Animated.View entering={FadeInDown.delay(600).duration(400)} style={styles.buttonContainer}>
              <Pressable
                onPress={handleContinue}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
              >
                <Animated.View style={buttonAnimatedStyle}>
                  <LinearGradient
                    colors={['#22C55E', '#16A34A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.continueButton}
                  >
                    <Text style={styles.continueButtonText}>View Lead in Inbox</Text>
                    <ArrowRight size={20} color="#fff" />
                  </LinearGradient>
                </Animated.View>
              </Pressable>

              <Text style={styles.hintText}>
                Approve or reject this lead to start engaging
              </Text>
            </Animated.View>
          </View>
        )}

        {/* Error Stage */}
        {stage === 'error' && (
          <View style={styles.centerContent}>
            <Animated.View entering={FadeIn.duration(400)}>
              <TavaMascot size={SCREEN_HEIGHT * 0.25} />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.errorContent}>
              <Text style={styles.errorTitle}>No leads found yet</Text>
              <Text style={styles.errorSubtitle}>
                Don't worry! {matchedAgent?.name || 'Your agent'} will keep searching in the background.
                Head to the app to configure more settings.
              </Text>

              <Pressable
                onPress={handleSkipToApp}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={styles.errorButton}
              >
                <Animated.View style={buttonAnimatedStyle}>
                  <LinearGradient
                    colors={['#6366f1', '#8b5cf6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.continueButton}
                  >
                    <Text style={styles.continueButtonText}>Continue to App</Text>
                    <ArrowRight size={20} color="#fff" />
                  </LinearGradient>
                </Animated.View>
              </Pressable>
            </Animated.View>
          </View>
        )}

        {/* Progress dots */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressDot, styles.progressDotComplete]} />
          <View style={[styles.progressDot, styles.progressDotComplete]} />
          <View style={[styles.progressDot, styles.progressDotComplete]} />
          <View style={[styles.progressDot, styles.progressDotComplete]} />
          <View style={[styles.progressDot, styles.progressDotActive]} />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  searchingAvatar: {
    marginBottom: 32,
  },
  radarContainer: {
    width: SCREEN_HEIGHT * 0.28,
    height: SCREEN_HEIGHT * 0.28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  radarRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: SCREEN_HEIGHT * 0.14,
    overflow: 'hidden',
  },
  radarGradient: {
    width: '100%',
    height: '50%',
  },
  statusMessage: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 24,
  },
  searchingContent: {
    alignItems: 'center',
  },
  searchingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  searchingBadgeText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
  searchingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  searchingSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 32,
  },
  progressBarContainer: {
    width: SCREEN_WIDTH - 80,
    alignItems: 'center',
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  foundContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 100,
  },
  foundHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  successBadgeText: {
    fontSize: 14,
    color: '#22C55E',
    fontWeight: '600',
  },
  foundTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  leadCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  leadCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  subredditBadge: {
    backgroundColor: 'rgba(255, 69, 0, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  subredditText: {
    fontSize: 13,
    color: '#FF4500',
    fontWeight: '600',
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scoreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600',
  },
  leadTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    lineHeight: 24,
  },
  leadContent: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
    marginBottom: 12,
  },
  leadMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  leadAuthor: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  leadMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  leadComments: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  aiReasonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  aiReasonText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 18,
  },
  buttonContainer: {
    marginTop: 'auto',
    paddingTop: 24,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 10,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  hintText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginTop: 12,
  },
  errorContent: {
    alignItems: 'center',
    marginTop: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  errorButton: {
    width: '100%',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressDotComplete: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  progressDotActive: {
    backgroundColor: '#6366f1',
    width: 24,
  },
});
