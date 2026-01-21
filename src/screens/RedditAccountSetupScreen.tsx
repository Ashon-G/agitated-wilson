import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  ArrowLeft,
  ExternalLink,
  Shield,
  UserPlus,
  CheckCircle2,
  Link2,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../contexts/ThemeContext';
import { GLASS } from '../utils/colors';
import RedditConnectionService from '../services/RedditConnectionService';
import useProfileStore from '../state/profileStore';
import useBrainStore from '../state/brainStore';
import useVideoStore, { VIDEO_IDS, VIDEO_URLS } from '../state/videoStore';
import FullscreenVideoPlayer from '../components/FullscreenVideoPlayer';
import { useWorkspaceColor } from '../hooks/useWorkspaceColor';
import { RedditSubredditSelector } from '../components/RedditSubredditSelector';
import useHuntingStore from '../state/huntingStore';
import useWorkspaceStore from '../state/workspaceStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface StepProps {
  stepNumber: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: {
    label: string;
    onPress: () => void;
    isExternal?: boolean;
  };
  tips?: string[];
  isCompleted?: boolean;
  accentColor?: string;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function StepCard({
  stepNumber,
  title,
  description,
  icon,
  action,
  tips,
  isCompleted,
  accentColor = '#22C55E',
}: StepProps) {
  const { isDark } = useTheme();
  const glass = isDark ? GLASS.dark : GLASS.light;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  // Convert hex to rgba for background
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(stepNumber * 100).springify()}
      style={[
        animatedStyle,
        {
          backgroundColor: glass.background,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: isCompleted ? '#22C55E' : glass.border,
          marginBottom: 16,
          overflow: 'hidden',
        },
      ]}
    >
      <View className="p-5">
        {/* Step header */}
        <View className="flex-row items-center mb-3">
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: isCompleted ? '#22C55E' : hexToRgba(accentColor, 0.2),
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            {isCompleted ? (
              <CheckCircle2 size={20} color="#fff" />
            ) : (
              <Text
                style={{
                  color: accentColor,
                  fontWeight: '700',
                  fontSize: 16,
                }}
              >
                {stepNumber}
              </Text>
            )}
          </View>
          <View className="flex-1">
            <Text
              style={{
                color: glass.text,
                fontSize: 18,
                fontWeight: '700',
              }}
            >
              {title}
            </Text>
          </View>
          <View style={{ marginLeft: 8 }}>{icon}</View>
        </View>

        {/* Description */}
        <Text
          style={{
            color: glass.textSecondary,
            fontSize: 15,
            lineHeight: 22,
            marginBottom: tips && tips.length > 0 ? 12 : action ? 16 : 0,
          }}
        >
          {description}
        </Text>

        {/* Tips */}
        {tips && tips.length > 0 && (
          <View
            style={{
              backgroundColor: hexToRgba(accentColor, isDark ? 0.1 : 0.08),
              borderRadius: 12,
              padding: 12,
              marginBottom: action ? 16 : 0,
            }}
          >
            {tips.map((tip, index) => (
              <View key={index} className="flex-row items-start mb-1 last:mb-0">
                <Text style={{ color: accentColor, marginRight: 8 }}>•</Text>
                <Text
                  style={{
                    color: glass.textSecondary,
                    fontSize: 13,
                    lineHeight: 18,
                    flex: 1,
                  }}
                >
                  {tip}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Action button */}
        {action && (
          <TouchableOpacity
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={action.onPress}
            activeOpacity={0.8}
            style={{
              backgroundColor: accentColor,
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: '600',
                marginRight: action.isExternal ? 8 : 0,
              }}
            >
              {action.label}
            </Text>
            {action.isExternal && <ExternalLink size={18} color="#fff" />}
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

export default function RedditAccountSetupScreen() {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const glass = isDark ? GLASS.dark : GLASS.light;
  const insets = useSafeAreaInsets();
  const { color: workspaceColor } = useWorkspaceColor();
  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace);
  const startHunting = useHuntingStore(s => s.startHunting);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsername, setConnectedUsername] = useState<string | null>(null);
  const [showIntroVideo, setShowIntroVideo] = useState(false);
  const [pendingConnection, setPendingConnection] = useState(false);
  const [showSubredditWizard, setShowSubredditWizard] = useState(false);

  // Video store
  const hasWatchedVideo = useVideoStore(s => s.hasWatchedVideo);
  const markVideoAsWatched = useVideoStore(s => s.markVideoAsWatched);
  const loadWatchedVideos = useVideoStore(s => s.loadWatchedVideos);

  // Load watched videos on mount
  useEffect(() => {
    loadWatchedVideos();
  }, [loadWatchedVideos]);

  const handleOpenRedditSignup = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Linking.openURL('https://www.reddit.com/register');
  }, []);

  const proceedWithConnection = useCallback(async () => {
    setIsConnecting(true);

    try {
      const result = await RedditConnectionService.connectRedditAccount();

      if (result.success && result.redditAccount) {
        setIsConnected(true);
        setConnectedUsername(result.redditAccount.username);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Sync with stores
        const { connectRedditAccount } = useProfileStore.getState();
        const { connectRedditIntegration } = useBrainStore.getState();

        await connectRedditAccount(result.redditAccount);
        connectRedditIntegration(result.redditAccount.username);

        // Show subreddit wizard after a brief delay to let the UI settle after OAuth
        console.log('[RedditAccountSetup] Connection successful, showing subreddit wizard after delay');
        setTimeout(() => {
          console.log('[RedditAccountSetup] Setting showSubredditWizard to true');
          setShowSubredditWizard(true);
        }, 300);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Connection Failed',
          result.error || 'Unable to connect to Reddit. Please try again.',
          [{ text: 'OK' }],
        );
      }
    } catch (error) {
      console.error('Reddit connection error:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Error',
        'Something went wrong while connecting. Please try again.',
        [{ text: 'OK' }],
      );
    } finally {
      setIsConnecting(false);
      setPendingConnection(false);
    }
  }, []);

  const handleSubredditSave = useCallback(async (subreddits: string[], keywords?: string[], agentConfig?: any) => {
    try {
      // Start hunting with the selected subreddits
      await startHunting(subreddits, 'balanced', currentWorkspace?.id, keywords);
      setShowSubredditWizard(false);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to start hunting:', error);
      Alert.alert('Error', 'Failed to start hunting. Please try again.');
    }
  }, [startHunting, currentWorkspace?.id, navigation]);

  const handleConnectReddit = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Check if user has watched the intro video
    const hasWatched = hasWatchedVideo(VIDEO_IDS.REDDIT_INTRO);

    if (!hasWatched) {
      // Show intro video first (non-skippable)
      setPendingConnection(true);
      setShowIntroVideo(true);
    } else {
      // Already watched, proceed directly
      await proceedWithConnection();
    }
  }, [hasWatchedVideo, proceedWithConnection]);

  const handleVideoEnd = useCallback(async () => {
    // Mark video as watched
    await markVideoAsWatched(VIDEO_IDS.REDDIT_INTRO);
  }, [markVideoAsWatched]);

  const handleVideoClose = useCallback(async () => {
    setShowIntroVideo(false);

    // If there was a pending connection, proceed with it
    if (pendingConnection) {
      await proceedWithConnection();
    }
  }, [pendingConnection, proceedWithConnection]);

  const handleGoBack = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  }, [navigation]);

  return (
    <View className="flex-1">
      <LinearGradient
        colors={isDark ? ['#0F172A', '#1E293B', '#0F172A'] : ['#F8FAFC', '#E2E8F0', '#F8FAFC']}
        style={{ flex: 1 }}
      >
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          {/* Header */}
          <View className="flex-row items-center px-5 py-4">
            <TouchableOpacity
              onPress={handleGoBack}
              className="mr-4"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={24} color={glass.text} />
            </TouchableOpacity>
            <View className="flex-1">
              <Animated.Text
                entering={FadeInUp.delay(100)}
                style={{
                  color: glass.text,
                  fontSize: 22,
                  fontWeight: '700',
                }}
              >
                Reddit Account Setup
              </Animated.Text>
              <Animated.Text
                entering={FadeInUp.delay(150)}
                style={{
                  color: glass.textMuted,
                  fontSize: 14,
                  marginTop: 2,
                }}
              >
                Connect a dedicated account for lead generation
              </Animated.Text>
            </View>
          </View>

          <ScrollView
            className="flex-1 px-5"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          >
            {/* Info banner */}
            <Animated.View
              entering={FadeInDown.delay(50)}
              style={{
                backgroundColor: isDark
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(34, 197, 94, 0.1)',
                borderRadius: 16,
                padding: 16,
                marginBottom: 24,
                flexDirection: 'row',
                alignItems: 'flex-start',
                borderWidth: 1,
                borderColor: isDark
                  ? 'rgba(34, 197, 94, 0.3)'
                  : 'rgba(34, 197, 94, 0.4)',
              }}
            >
              <Shield
                size={22}
                color="#22C55E"
                style={{ marginRight: 12, marginTop: 2 }}
              />
              <View className="flex-1">
                <Text
                  style={{
                    color: isDark ? '#86EFAC' : '#166534',
                    fontSize: 15,
                    fontWeight: '600',
                    marginBottom: 4,
                  }}
                >
                  Best practice: Use a dedicated account
                </Text>
                <Text
                  style={{
                    color: isDark ? 'rgba(134, 239, 172, 0.9)' : '#15803D',
                    fontSize: 14,
                    lineHeight: 20,
                  }}
                >
                  We recommend using a separate Reddit account for outreach. This keeps your personal browsing separate from your business activities.
                </Text>
              </View>
            </Animated.View>

            {/* Step 1 - Create Account */}
            <StepCard
              stepNumber={1}
              title="Create a New Reddit Account"
              description="Go to Reddit and create a fresh account specifically for lead generation. Use a professional username that represents your business."
              icon={<UserPlus size={24} color={workspaceColor} />}
              accentColor={workspaceColor}
              tips={[
                'Choose a professional username (e.g., YourBrand_Outreach)',
                'Use a business email address',
                'Complete email verification',
                'Consider adding a profile picture',
              ]}
              action={{
                label: 'Create Reddit Account',
                onPress: handleOpenRedditSignup,
                isExternal: true,
              }}
            />

            {/* Step 2 - Build Karma */}
            <StepCard
              stepNumber={2}
              title="Build Initial Karma"
              description="New Reddit accounts have posting restrictions. Spend 5-10 minutes engaging naturally to build some karma before connecting."
              icon={<Sparkles size={24} color={workspaceColor} />}
              accentColor={workspaceColor}
              tips={[
                'Comment on posts in subreddits related to your industry',
                'Upvote helpful content',
                'Aim for at least 10-20 karma points',
                'Wait a day or two for best results',
              ]}
            />

            {/* Step 3 - Connect */}
            <StepCard
              stepNumber={3}
              title="Connect Your Account"
              description={
                isConnected
                  ? `Successfully connected as u/${connectedUsername}!`
                  : 'Once your new account is ready, connect it here to start finding leads automatically.'
              }
              icon={<Link2 size={24} color={isConnected ? '#22C55E' : workspaceColor} />}
              accentColor={workspaceColor}
              isCompleted={isConnected}
              action={
                !isConnected
                  ? {
                    label: isConnecting ? 'Connecting...' : 'Connect Reddit Account',
                    onPress: handleConnectReddit,
                  }
                  : undefined
              }
            />

            {/* Security note */}
            <Animated.View
              entering={FadeInDown.delay(400)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 8,
                paddingHorizontal: 16,
              }}
            >
              <Shield size={16} color={glass.textMuted} />
              <Text
                style={{
                  color: glass.textMuted,
                  fontSize: 13,
                  marginLeft: 8,
                  textAlign: 'center',
                }}
              >
                Your credentials are encrypted and securely stored
              </Text>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>

      {/* Fullscreen Intro Video - Non-skippable for first-time connection */}
      <FullscreenVideoPlayer
        videoUrl={VIDEO_URLS[VIDEO_IDS.REDDIT_INTRO]}
        isVisible={showIntroVideo}
        onClose={handleVideoClose}
        onVideoEnd={handleVideoEnd}
        isSkippable={false}
      />

      {/* Subreddit Configuration Wizard - shown after successful connection */}
      <RedditSubredditSelector
        visible={showSubredditWizard}
        onClose={() => {
          setShowSubredditWizard(false);
          navigation.goBack();
        }}
        onSave={handleSubredditSave}
      />
    </View>
  );
}
