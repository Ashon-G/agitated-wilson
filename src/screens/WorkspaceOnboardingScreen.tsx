import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Pressable, Animated, Keyboard, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import useAuthStore from '../state/authStore';
import useWorkspaceStore from '../state/workspaceStore';
import useProfileStore from '../state/profileStore';
import useBrainStore from '../state/brainStore';
import useQuestStore from '../state/questStore';
import TavaMascot from '../components/TavaMascot';
import { hapticFeedback } from '../utils/hapticFeedback';
import BrandExtractionService, { ExtractedQuestAnswers } from '../services/BrandExtractionService';
import { matchAgentToUser, AgentId, getAgent, getAgentRevealSpeech, AgentPersonality } from '../data/agentPersonalities';
import RedditConnectionService from '../services/RedditConnectionService';
import { RedditSubredditSelector } from '../components/RedditSubredditSelector';
import useAgentSettingsStore from '../state/agentSettingsStore';
import Agent3D from '../components/Agent3D';
import {
  ReadyStage,
  URLInputStage,
  ReviewStage,
  AgentRevealStage,
  RedditStage,
  EditModal,
  LoadingStage,
  styles,
  workspaceColors,
} from '../components/workspace-onboarding';

type OnboardingStage = 'ready' | 'speaking' | 'listening' | 'extracting' | 'error' | 'review' | 'reddit' | 'agent-reveal' | 'processing';

interface ExtractedData {
  websiteUrl: string;
  businessName: string;
  targetMarket: string;
  productDescription: string;
  businessStage: 'idea' | 'startup' | 'growth' | 'established';
}

export default function WorkspaceOnboardingScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, onboardingProgress, setOnboardingProgress } = useAuthStore();
  const profile = useProfileStore(s => s.profile);
  const { addWorkspace } = useWorkspaceStore();
  const { addTextToKnowledge } = useBrainStore();

  // State
  const [inputValue, setInputValue] = useState('');
  const [stage, setStage] = useState<OnboardingStage>('ready');
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [avatarReady, setAvatarReady] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [selectedColor, setSelectedColor] = useState(workspaceColors[Math.floor(Math.random() * workspaceColors.length)]);
  const [errorMessage, setErrorMessage] = useState('');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isConnectingReddit, setIsConnectingReddit] = useState(false);
  const [redditConnected, setRedditConnected] = useState(false);
  const [redditUsername, setRedditUsername] = useState<string | null>(null);
  const [pendingRedditAccount, setPendingRedditAccount] = useState<any>(null);
  const [extractedQuestAnswers, setExtractedQuestAnswers] = useState<ExtractedQuestAnswers | null>(null);
  const [matchedAgent, setMatchedAgent] = useState<AgentPersonality | null>(null);
  const [showRedditConfigSheet, setShowRedditConfigSheet] = useState(false);

  // Animation refs
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(50)).current;
  const inputOpacity = useRef(new Animated.Value(0)).current;
  const inputTranslateY = useRef(new Animated.Value(30)).current;
  const audioOnBlinkAnim = useRef(new Animated.Value(1)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const soundRef = useRef<Audio.Sound | null>(null);

  const firstName = profile?.firstName || profile?.name?.split(' ')[0] || 'there';

  // Blinking animation for ready stage
  useEffect(() => {
    if (stage === 'ready') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(audioOnBlinkAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
          Animated.timing(audioOnBlinkAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
    }
  }, [stage, audioOnBlinkAnim]);

  // Setup audio on mount
  useEffect(() => {
    const setupAudio = async () => {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
    };
    setupAudio();
    return () => { if (soundRef.current) soundRef.current.unloadAsync(); };
  }, []);

  const animateSubtitleIn = (text: string) => {
    subtitleOpacity.setValue(0);
    subtitleTranslateY.setValue(50);
    setCurrentSubtitle(text);
    Animated.parallel([
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(subtitleTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  };

  const animateInputIn = () => {
    inputOpacity.setValue(0);
    inputTranslateY.setValue(30);
    Animated.parallel([
      Animated.timing(inputOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(inputTranslateY, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  const playElevenLabsAudio = async (text: string, onFinish: () => void) => {
    const apiKey = process.env.EXPO_PUBLIC_VIBECODE_ELEVENLABS_API_KEY;
    if (!apiKey) {
      setTimeout(onFinish, 1500);
      return;
    }

    try {
      const voiceId = '21m00Tcm4TlvDq8ikWAM';
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.9, similarity_boost: 0.6, style: 0.05, use_speaker_boost: true },
        }),
      });

      if (!response.ok) throw new Error(`API request failed with status ${response.status}`);

      const audioBuffer = await response.arrayBuffer();
      const fileUri = `${FileSystem.cacheDirectory}temp_workspace_onboarding_${Date.now()}.mp3`;
      const base64Audio = btoa(new Uint8Array(audioBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
      await FileSystem.writeAsStringAsync(fileUri, base64Audio, { encoding: FileSystem.EncodingType.Base64 });

      if (soundRef.current) await soundRef.current.unloadAsync();
      const { sound } = await Audio.Sound.createAsync({ uri: fileUri }, { shouldPlay: true });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) onFinish();
      });
    } catch {
      setTimeout(onFinish, 1500);
    }
  };

  const speakURLPrompt = useCallback(async () => {
    const questionText = `Hey ${firstName}! Paste your website or App Store link and I'll learn everything about your business.`;
    setStage('speaking');
    animateSubtitleIn(questionText);
    await new Promise<void>((resolve) => playElevenLabsAudio(questionText, resolve));
    setStage('listening');
    animateInputIn();
  }, [firstName]);

  const handleStartPress = () => {
    hapticFeedback.medium();
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start(() => speakURLPrompt());
  };

  const handleClose = () => {
    hapticFeedback.light();
    navigation.goBack();
  };

  const handleURLExtract = async () => {
    if (!inputValue.trim()) return;
    const normalizedUrl = BrandExtractionService.normalizeURL(inputValue.trim());

    if (!BrandExtractionService.isValidURL(normalizedUrl)) {
      setErrorMessage('Please enter a valid URL');
      setStage('error');
      animateSubtitleIn('Hmm, that doesn\'t look like a valid URL. Try again?');
      animateInputIn();
      return;
    }

    hapticFeedback.medium();
    Keyboard.dismiss();
    setStage('extracting');
    setErrorMessage('');
    animateSubtitleIn('Analyzing your brand...');

    try {
      const info = await BrandExtractionService.extractFromURL(normalizedUrl);
      const validStages = ['idea', 'startup', 'growth', 'established'] as const;
      const businessStage = validStages.includes(info.businessStage as typeof validStages[number])
        ? (info.businessStage as 'idea' | 'startup' | 'growth' | 'established')
        : 'startup';

      setExtractedData({
        websiteUrl: normalizedUrl,
        businessName: info.businessName,
        targetMarket: info.targetMarket,
        productDescription: info.productDescription,
        businessStage,
      });

      if (info.questAnswers) {
        setExtractedQuestAnswers(info.questAnswers);
        await useQuestStore.getState().completeQuestsFromExtraction(info.questAnswers);
        const qa = info.questAnswers;
        const extractedCount = [
          qa.quest_website_url, qa.quest_hunting_keywords?.length, qa.quest_pricing, qa.quest_business_hours,
          qa.quest_meeting_link, qa.quest_contact_sales?.length, qa.quest_social_links?.length,
          qa.quest_brand_colors?.length, qa.quest_faq?.length, qa.quest_objections?.length,
        ].filter(Boolean).length;

        setInputValue('');
        setStage('review');
        const totalAnswered = 4 + extractedCount;
        animateSubtitleIn(`Here's what I found about ${info.businessName}. I answered ${totalAnswered} questions. Tap any field to edit.`);
      } else {
        setInputValue('');
        setStage('review');
        animateSubtitleIn(`Here's what I found about ${info.businessName}. Tap any field to edit.`);
      }
    } catch {
      setErrorMessage('Could not extract info. Try a different URL.');
      setStage('error');
      animateSubtitleIn('I couldn\'t read that page. Try a different URL?');
      animateInputIn();
    }
  };

  const handleStartEdit = (field: string, value: string) => {
    setEditingField(field);
    setEditValue(value);
  };

  const handleSaveEdit = () => {
    if (editingField && extractedData) {
      setExtractedData({ ...extractedData, [editingField]: editValue });
    }
    setEditingField(null);
    setEditValue('');
  };

  const handleContinueToAgentReveal = async () => {
    if (!extractedData) return;
    hapticFeedback.medium();
    setStage('processing');

    const matchedAgentId: AgentId = matchAgentToUser({
      businessName: extractedData.businessName,
      targetMarket: extractedData.targetMarket,
      productDescription: extractedData.productDescription,
      businessStage: extractedData.businessStage,
    });

    const agent = getAgent(matchedAgentId);
    setMatchedAgent(agent);
    setStage('agent-reveal');

    const revealSpeech = getAgentRevealSpeech(agent, firstName);
    animateSubtitleIn(revealSpeech);
    playElevenLabsAudio(revealSpeech, () => {});
  };

  const handleContinueToReddit = () => {
    hapticFeedback.medium();
    setStage('reddit');
    animateSubtitleIn('Last step! Connect your Reddit account to start finding leads.');
  };

  const handleContinueFromReddit = () => {
    hapticFeedback.medium();
    setShowRedditConfigSheet(true);
  };

  const handleSaveRedditConfig = async (subreddits: string[], _keywords?: string[], agentConfig?: any) => {
    try {
      const currentProfile = useProfileStore.getState().profile;
      if (currentProfile?.redditAccount) {
        const updatedRedditAccount = { ...currentProfile.redditAccount, targetSubreddits: subreddits };
        await useProfileStore.getState().updateProfile({ redditAccount: updatedRedditAccount });
      }
      if (agentConfig) {
        await useAgentSettingsStore.getState().updateSettings({
          scoreThreshold: agentConfig.scoreThreshold,
          postAgeLimitDays: agentConfig.postAgeLimitDays,
          commentStyle: agentConfig.commentStyle,
          requireApproval: agentConfig.requireApproval,
        });
      }
      setShowRedditConfigSheet(false);
      handleCompleteSetup();
    } catch {
      setShowRedditConfigSheet(false);
      handleCompleteSetup();
    }
  };

  const handleConnectReddit = async () => {
    hapticFeedback.medium();
    setIsConnectingReddit(true);

    try {
      const result = await RedditConnectionService.connectRedditAccount();

      if (result.success && result.redditAccount) {
        setRedditConnected(true);
        setRedditUsername(result.redditAccount.username);
        setPendingRedditAccount(result.redditAccount);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        useBrainStore.getState().connectRedditIntegration(result.redditAccount.username);
        animateSubtitleIn(`Connected as u/${result.redditAccount.username}! Let's go!`);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (result.error?.includes('already connected')) {
          const usernameMatch = result.error.match(/u\/([^\s.]+)/);
          const existingUsername = usernameMatch ? usernameMatch[1] : 'another account';

          Alert.alert('Disconnect Existing Account?',
            `You have a Reddit account (u/${existingUsername}) already connected. Would you like to disconnect it and connect a different account?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Disconnect & Reconnect',
                style: 'destructive',
                onPress: async () => {
                  setIsConnectingReddit(true);
                  try {
                    const disconnectResult = await RedditConnectionService.disconnectRedditAccount();
                    if (disconnectResult.success) {
                      await useProfileStore.getState().disconnectRedditAccount();
                      useBrainStore.getState().disconnectRedditIntegration();
                      await new Promise(resolve => setTimeout(resolve, 500));
                      const retryResult = await RedditConnectionService.connectRedditAccount();
                      if (retryResult.success && retryResult.redditAccount) {
                        setRedditConnected(true);
                        setRedditUsername(retryResult.redditAccount.username);
                        setPendingRedditAccount(retryResult.redditAccount);
                        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        useBrainStore.getState().connectRedditIntegration(retryResult.redditAccount.username);
                        animateSubtitleIn(`Connected as u/${retryResult.redditAccount.username}! Let's go!`);
                        return;
                      }
                      animateSubtitleIn('Disconnected! Tap Connect Reddit to try again.');
                    }
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    Alert.alert('Error', 'Failed to disconnect. Please try again.');
                  } catch {
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    Alert.alert('Error', 'Something went wrong. Please try again.');
                  } finally {
                    setIsConnectingReddit(false);
                  }
                },
              },
            ],
          );
        } else {
          Alert.alert('Connection Failed', result.error || 'Please try again.');
        }
      }
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsConnectingReddit(false);
    }
  };

  const handleCompleteSetup = async () => {
    if (!extractedData || !matchedAgent) return;
    hapticFeedback.medium();
    setStage('processing');

    try {
      const workspaceName = extractedData.businessName || 'New Workspace';
      const uniqueAgentInstanceId = `${matchedAgent.id}_${user?.uid?.slice(0, 8) || 'user'}_${Date.now()}`;

      const finalProgress = {
        ...(onboardingProgress || {
          userId: user?.uid || '',
          currentStep: 6,
          totalSteps: 6,
          completedSteps: [],
          formData: {},
          isCompleted: false,
          createdAt: new Date(),
        }),
        currentStep: 6,
        completedSteps: [1, 2, 3, 4, 5, 6],
        formData: {
          ...(onboardingProgress?.formData || {}),
          ...extractedData,
          workspaceName: `${workspaceName} Sales Hub`,
          workspaceColor: selectedColor,
          assignedAgentId: matchedAgent.id,
          agentInstanceId: uniqueAgentInstanceId,
          agentAssignedAt: new Date(),
        },
        updatedAt: new Date(),
      };

      setOnboardingProgress(finalProgress);

      await addWorkspace({
        name: workspaceName,
        description: extractedData.productDescription || '',
        color: selectedColor,
        stats: { files: 0, media: 0, snippets: 0, webpages: 0 },
      });

      const workspaceState = useWorkspaceStore.getState();
      const workspaceId = workspaceState.currentWorkspaceId;

      if (workspaceId) {
        if (pendingRedditAccount) {
          await useWorkspaceStore.getState().connectRedditToWorkspace(workspaceId, pendingRedditAccount);
        }
        if (extractedData.websiteUrl) {
          await addTextToKnowledge('Company Website', extractedData.websiteUrl, workspaceId, ['website', 'source'], 'Company website URL');
        }
        if (extractedData.targetMarket) {
          await addTextToKnowledge('Target Market', `Our ideal customer: ${extractedData.targetMarket}`, workspaceId, ['target-market', 'audience'], 'Information about our target customer demographic');
        }
        if (extractedData.productDescription) {
          await addTextToKnowledge('Product/Service Description', extractedData.productDescription, workspaceId, ['product', 'service', 'offering'], 'What we sell and what makes it special');
        }
      }

      navigation.goBack();
    } catch {
      navigation.goBack();
    }
  };

  const handleAvatarReady = () => setAvatarReady(true);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f172a', '#1e293b', '#334155']} style={styles.gradient}>
        <Pressable onPress={handleClose} style={[styles.closeButton, { top: insets.top + 16 }]}>
          <X size={24} color="#9CA3AF" />
        </Pressable>

        <View style={styles.avatarContainer}>
          {(stage === 'agent-reveal' || stage === 'reddit') && matchedAgent ? (
            <Agent3D agentId={matchedAgent.id} workspaceColor={selectedColor} transparentBottom showGrid={false} modelScale={1.2} modelOffsetY={0.2} />
          ) : (
            <TavaMascot onReady={handleAvatarReady} size={840} style={styles.mascot} />
          )}
        </View>

        {stage === 'ready' && <ReadyStage buttonScale={buttonScale} audioOnBlinkAnim={audioOnBlinkAnim} onStart={handleStartPress} />}

        {stage === 'extracting' && (
          <LoadingStage currentSubtitle={currentSubtitle} subtitleOpacity={subtitleOpacity} subtitleTranslateY={subtitleTranslateY} bottomInset={insets.bottom} />
        )}

        {stage === 'processing' && (
          <LoadingStage currentSubtitle="Creating your workspace..." subtitleOpacity={subtitleOpacity} subtitleTranslateY={subtitleTranslateY} bottomInset={insets.bottom} color="#6366F1" />
        )}

        {(stage === 'speaking' || stage === 'listening' || stage === 'error') && (
          <URLInputStage
            stage={stage}
            currentSubtitle={currentSubtitle}
            subtitleOpacity={subtitleOpacity}
            subtitleTranslateY={subtitleTranslateY}
            inputOpacity={inputOpacity}
            inputTranslateY={inputTranslateY}
            inputValue={inputValue}
            setInputValue={setInputValue}
            onSubmit={handleURLExtract}
            errorMessage={errorMessage}
            bottomInset={insets.bottom}
          />
        )}

        {stage === 'review' && extractedData && (
          <ReviewStage
            extractedData={extractedData}
            extractedQuestAnswers={extractedQuestAnswers}
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            currentSubtitle={currentSubtitle}
            onEdit={handleStartEdit}
            onContinue={handleContinueToAgentReveal}
            bottomInset={insets.bottom}
          />
        )}

        {stage === 'reddit' && (
          <RedditStage
            currentSubtitle={currentSubtitle}
            redditConnected={redditConnected}
            redditUsername={redditUsername}
            isConnectingReddit={isConnectingReddit}
            onConnectReddit={handleConnectReddit}
            onContinue={handleContinueFromReddit}
            bottomInset={insets.bottom}
          />
        )}

        {stage === 'agent-reveal' && matchedAgent && (
          <AgentRevealStage
            matchedAgent={matchedAgent}
            currentSubtitle={currentSubtitle}
            subtitleOpacity={subtitleOpacity}
            subtitleTranslateY={subtitleTranslateY}
            selectedColor={selectedColor}
            onContinue={handleContinueToReddit}
            bottomInset={insets.bottom}
          />
        )}

        <EditModal
          editingField={editingField}
          editValue={editValue}
          setEditValue={setEditValue}
          onSave={handleSaveEdit}
          onCancel={() => setEditingField(null)}
          bottomInset={insets.bottom}
        />
      </LinearGradient>

      <RedditSubredditSelector
        visible={showRedditConfigSheet}
        onClose={() => setShowRedditConfigSheet(false)}
        onSave={handleSaveRedditConfig}
        initialSubreddits={[]}
        initialKeywords={[]}
      />
    </View>
  );
}
