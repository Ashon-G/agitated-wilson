import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Link2, Play, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import RedditConnectionService from '../../services/RedditConnectionService';
import useProfileStore from '../../state/profileStore';
import useBrainStore from '../../state/brainStore';
import useVideoStore, { VIDEO_IDS, VIDEO_URLS } from '../../state/videoStore';
import useAuthStore from '../../state/authStore';
import useWorkspaceStore from '../../state/workspaceStore';
import useHuntingStore from '../../state/huntingStore';
import useAgentSettingsStore from '../../state/agentSettingsStore';
import FullscreenVideoPlayer from '../../components/FullscreenVideoPlayer';
import TavaMascot from '../../components/TavaMascot';
import { RedditSubredditSelector } from '../../components/RedditSubredditSelector';
import { CommentStyle } from '../../types/app';

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

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'RedditSetup'>;

export default function OnboardingRedditSetupScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { onboardingProgress } = useAuthStore();
  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace);

  const [stage, setStage] = useState<'intro' | 'video' | 'connect' | 'connecting' | 'success'>('intro');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedUsername, setConnectedUsername] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [showSubredditSelector, setShowSubredditSelector] = useState(false);

  // Get brand color from workspace or onboarding progress
  const brandColor = currentWorkspace?.color || onboardingProgress?.formData?.workspaceColor;
  const gradientColors = brandColor ? createGradientFromBrand(brandColor) : DEFAULT_GRADIENT;

  // Video store
  const hasWatchedVideo = useVideoStore(s => s.hasWatchedVideo);
  const markVideoAsWatched = useVideoStore(s => s.markVideoAsWatched);
  const loadWatchedVideos = useVideoStore(s => s.loadWatchedVideos);

  // Animation
  const buttonScale = useSharedValue(1);
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const firstName = onboardingProgress?.formData?.firstName || 'there';
  const businessName = onboardingProgress?.formData?.businessName || 'your business';

  // Load watched videos on mount
  useEffect(() => {
    loadWatchedVideos();
  }, [loadWatchedVideos]);

  const handleWatchVideo = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowVideo(true);
    setStage('video');
  }, []);

  const handleVideoEnd = useCallback(async () => {
    await markVideoAsWatched(VIDEO_IDS.REDDIT_INTRO);
  }, [markVideoAsWatched]);

  const handleVideoClose = useCallback(() => {
    setShowVideo(false);
    setStage('connect');
  }, []);

  const handleConnectReddit = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Check if video was watched
    const hasWatched = hasWatchedVideo(VIDEO_IDS.REDDIT_INTRO);
    if (!hasWatched) {
      // Show video first
      setShowVideo(true);
      setStage('video');
      return;
    }

    setStage('connecting');
    setIsConnecting(true);

    try {
      const result = await RedditConnectionService.connectRedditAccount();

      if (result.success && result.redditAccount) {
        setConnectedUsername(result.redditAccount.username);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Sync with stores
        const { connectRedditAccount } = useProfileStore.getState();
        const { connectRedditIntegration } = useBrainStore.getState();

        await connectRedditAccount(result.redditAccount);
        connectRedditIntegration(result.redditAccount.username);

        setStage('success');

        // Show subreddit selector after a short delay
        setTimeout(() => {
          setShowSubredditSelector(true);
        }, 1500);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

        // Check if there's an existing connection blocking this one
        if (result.error?.includes('already connected')) {
          // Extract username from error message
          const usernameMatch = result.error.match(/u\/([^\s.]+)/);
          const existingUsername = usernameMatch ? usernameMatch[1] : 'another account';

          Alert.alert(
            'Disconnect Existing Account?',
            `You have a Reddit account (u/${existingUsername}) already connected. Would you like to disconnect it and connect a new account?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Disconnect & Reconnect',
                style: 'destructive',
                onPress: async () => {
                  setStage('connecting');
                  setIsConnecting(true);
                  try {
                    // Disconnect old account
                    const disconnectResult = await RedditConnectionService.disconnectRedditAccount();
                    if (disconnectResult.success) {
                      // Also clear from stores
                      const { disconnectRedditAccount } = useProfileStore.getState();
                      const { disconnectRedditIntegration } = useBrainStore.getState();
                      await disconnectRedditAccount();
                      disconnectRedditIntegration();

                      // Try connecting again
                      const retryResult = await RedditConnectionService.connectRedditAccount();
                      if (retryResult.success && retryResult.redditAccount) {
                        setConnectedUsername(retryResult.redditAccount.username);
                        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                        const { connectRedditAccount } = useProfileStore.getState();
                        const { connectRedditIntegration } = useBrainStore.getState();
                        await connectRedditAccount(retryResult.redditAccount);
                        connectRedditIntegration(retryResult.redditAccount.username);

                        setStage('success');
                        setTimeout(() => {
                          setShowSubredditSelector(true);
                        }, 1500);
                        return;
                      }
                    }
                    // If disconnect or retry failed
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    Alert.alert('Error', 'Failed to disconnect the existing account. Please try again.');
                    setStage('connect');
                  } catch (e) {
                    console.error('Disconnect/reconnect error:', e);
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    Alert.alert('Error', 'Something went wrong. Please try again.');
                    setStage('connect');
                  } finally {
                    setIsConnecting(false);
                  }
                },
              },
            ],
          );
        } else {
          Alert.alert('Connection Failed', result.error || 'Failed to connect to Reddit. Please try again.');
        }
        setStage('connect');
      }
    } catch (error) {
      console.error('Reddit connection error:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Connection Failed', 'An unexpected error occurred. Please try again.');
      setStage('connect');
    } finally {
      setIsConnecting(false);
    }
  }, [hasWatchedVideo, navigation]);

  const handleSkip = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Skip to agent reveal if they don't want to connect Reddit now
    const matchedAgentId = onboardingProgress?.formData?.assignedAgentId || 'sophia';
    navigation.navigate('AgentReveal', { agentId: matchedAgentId as any });
  }, [navigation, onboardingProgress]);

  // Handler for saving subreddits and agent config from the selector
  const handleSaveSubreddits = useCallback(async (
    subreddits: string[],
    keywords?: string[],
    agentConfig?: { scoreThreshold: number; postAgeLimitDays: number; commentStyle: CommentStyle; requireApproval: boolean },
  ) => {
    try {
      const { profile } = useProfileStore.getState();
      if (!profile?.redditAccount?.username) {
        console.error('No Reddit account connected');
        return;
      }

      // Update the profile with selected subreddits
      const updatedRedditAccount = {
        ...profile.redditAccount,
        targetSubreddits: subreddits,
      };
      await useProfileStore.getState().updateProfile({ redditAccount: updatedRedditAccount });

      // Save agent settings if provided
      if (agentConfig) {
        await useAgentSettingsStore.getState().updateSettings({
          scoreThreshold: agentConfig.scoreThreshold,
          postAgeLimitDays: agentConfig.postAgeLimitDays,
          commentStyle: agentConfig.commentStyle,
          requireApproval: agentConfig.requireApproval,
        });
      }

      // Start hunting with the configuration
      const workspaceId = currentWorkspace?.id;
      await useHuntingStore.getState().startHunting(subreddits, 'balanced', workspaceId, keywords);

      // Update integration status
      useBrainStore.getState().updateIntegrationStatus('reddit', {
        statusText: `Hunting ${subreddits.length} subreddits`,
        isActive: true,
        actionText: undefined,
        lastActivity: new Date(),
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to first lead discovery
      navigation.navigate('FirstLeadDiscovery');
    } catch (error) {
      console.error('Failed to save subreddits:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to start hunting. Please try again.');
    }
  }, [currentWorkspace?.id, navigation]);

  const handleSubredditSelectorClose = useCallback(() => {
    setShowSubredditSelector(false);
    // If they close without saving, still proceed to first lead discovery
    navigation.navigate('FirstLeadDiscovery');
  }, [navigation]);

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradientColors}
        style={styles.gradient}
      >
        {/* Tava Mascot */}
        <Animated.View
          entering={FadeIn.delay(200).duration(600)}
          style={styles.avatarContainer}
        >
          <TavaMascot size={SCREEN_HEIGHT * 0.35} />
        </Animated.View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {/* Intro Stage */}
          {stage === 'intro' && (
            <>
              <Animated.View entering={FadeInUp.delay(400).duration(500)}>
                <Text style={styles.title}>Let's Find Your First Lead</Text>
                <Text style={styles.subtitle}>
                  {firstName}, I'm about to show you something amazing. But first,
                  watch this quick video about how we'll find leads for {businessName}.
                </Text>
              </Animated.View>

              <Animated.View
                entering={FadeInDown.delay(600).duration(500)}
                style={styles.buttonContainer}
              >
                <Pressable
                  onPress={handleWatchVideo}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                >
                  <Animated.View style={buttonAnimatedStyle}>
                    <LinearGradient
                      colors={['#6366f1', '#8b5cf6']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.primaryButton}
                    >
                      <Play size={22} color="#fff" />
                      <Text style={styles.primaryButtonText}>Watch Video</Text>
                    </LinearGradient>
                  </Animated.View>
                </Pressable>

                <Pressable onPress={handleSkip} style={styles.skipButton}>
                  <Text style={styles.skipButtonText}>I'll set this up later</Text>
                </Pressable>
              </Animated.View>
            </>
          )}

          {/* Connect Stage */}
          {stage === 'connect' && (
            <>
              <Animated.View entering={FadeInUp.duration(400)}>
                <View style={styles.checkBadge}>
                  <CheckCircle2 size={20} color="#22C55E" />
                  <Text style={styles.checkBadgeText}>Video watched</Text>
                </View>
                <Text style={styles.title}>Now Let's Connect Reddit</Text>
                <Text style={styles.subtitle}>
                  Connect your Reddit account and I'll start finding leads for {businessName} right away.
                </Text>
              </Animated.View>

              <Animated.View
                entering={FadeInDown.delay(200).duration(400)}
                style={styles.buttonContainer}
              >
                <Pressable
                  onPress={handleConnectReddit}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                >
                  <Animated.View style={buttonAnimatedStyle}>
                    <LinearGradient
                      colors={['#FF5E00', '#FF8C00']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.primaryButton}
                    >
                      <Link2 size={22} color="#fff" />
                      <Text style={styles.primaryButtonText}>Connect Reddit</Text>
                    </LinearGradient>
                  </Animated.View>
                </Pressable>

                <Pressable onPress={handleSkip} style={styles.skipButton}>
                  <Text style={styles.skipButtonText}>Skip for now</Text>
                </Pressable>
              </Animated.View>
            </>
          )}

          {/* Connecting Stage */}
          {stage === 'connecting' && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.centerContent}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.connectingText}>Connecting to Reddit...</Text>
            </Animated.View>
          )}

          {/* Success Stage */}
          {stage === 'success' && (
            <Animated.View entering={FadeIn.duration(400)} style={styles.centerContent}>
              <View style={styles.successIcon}>
                <CheckCircle2 size={48} color="#22C55E" />
              </View>
              <Text style={styles.successTitle}>Connected!</Text>
              <Text style={styles.successSubtitle}>
                Welcome, u/{connectedUsername}
              </Text>
              <View style={styles.nextStepBadge}>
                <Sparkles size={16} color="#fbbf24" />
                <Text style={styles.nextStepText}>Finding your first lead...</Text>
              </View>
            </Animated.View>
          )}
        </View>

        {/* Progress dots */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressDot, styles.progressDotComplete]} />
          <View style={[styles.progressDot, styles.progressDotComplete]} />
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
        </View>
      </LinearGradient>

      {/* Video Player */}
      <FullscreenVideoPlayer
        videoUrl={VIDEO_URLS[VIDEO_IDS.REDDIT_INTRO]}
        isVisible={showVideo}
        onClose={handleVideoClose}
        onVideoEnd={handleVideoEnd}
        isSkippable={false}
      />

      {/* Subreddit Selector Bottom Sheet */}
      <RedditSubredditSelector
        visible={showSubredditSelector}
        onClose={handleSubredditSelectorClose}
        onSave={handleSaveSubreddits}
        initialSubreddits={[]}
        initialKeywords={[]}
      />
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
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: SCREEN_HEIGHT * 0.4,
    paddingTop: 60,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 100,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    marginTop: 32,
    gap: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 10,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  checkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  checkBadgeText: {
    fontSize: 14,
    color: '#22C55E',
    fontWeight: '500',
  },
  centerContent: {
    alignItems: 'center',
  },
  connectingText: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 16,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 24,
  },
  nextStepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  nextStepText: {
    fontSize: 14,
    color: '#fbbf24',
    fontWeight: '500',
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
