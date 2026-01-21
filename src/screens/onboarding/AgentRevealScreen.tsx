import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  FadeIn,
  FadeInUp,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { ArrowRight, Sparkles } from 'lucide-react-native';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { getAgent, getAgentRevealSpeech, AgentId } from '../../data/agentPersonalities';
import useAuthStore from '../../state/authStore';
import useWorkspaceStore from '../../state/workspaceStore';
import { hapticFeedback } from '../../utils/hapticFeedback';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Helper to create gradient colors from brand color
const createGradientFromBrand = (brandColor: string): [string, string, string] => {
  // Parse hex color
  const hex = brandColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Create darker variants for gradient
  const darken = (value: number, amount: number) => Math.max(0, Math.floor(value * amount));

  const darkest = `rgb(${darken(r, 0.15)}, ${darken(g, 0.15)}, ${darken(b, 0.15)})`;
  const darker = `rgb(${darken(r, 0.25)}, ${darken(g, 0.25)}, ${darken(b, 0.25)})`;
  const dark = `rgb(${darken(r, 0.35)}, ${darken(g, 0.35)}, ${darken(b, 0.35)})`;

  return [darkest, darker, dark];
};

// Default gradient colors (slate)
const DEFAULT_GRADIENT: [string, string, string] = ['#0f172a', '#1e293b', '#334155'];

type AgentRevealNavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'AgentReveal'>;
type AgentRevealRouteProp = RouteProp<OnboardingStackParamList, 'AgentReveal'>;

export default function AgentRevealScreen() {
  const navigation = useNavigation<AgentRevealNavigationProp>();
  const route = useRoute<AgentRevealRouteProp>();
  const { onboardingProgress, completeOnboarding } = useAuthStore();
  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace);

  const agentId: AgentId = route.params?.agentId || 'sophia';
  const agent = getAgent(agentId);
  const firstName = onboardingProgress?.formData?.firstName || 'there';

  // Get brand color from workspace or onboarding progress
  const brandColor = currentWorkspace?.color || onboardingProgress?.formData?.workspaceColor;
  const gradientColors = brandColor ? createGradientFromBrand(brandColor) : DEFAULT_GRADIENT;

  const [stage, setStage] = useState<'intro' | 'speaking' | 'ready'>('intro');
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);
  const subtitleOpacity = useSharedValue(0);
  const avatarScale = useSharedValue(0.8);
  const buttonOpacity = useSharedValue(0);

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Start intro sequence after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      startRevealSequence();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const splitIntoChunks = (text: string): string[] => {
    const words = text.split(' ');
    const chunks: string[] = [];
    let currentChunk = '';

    words.forEach((word) => {
      const testChunk = currentChunk ? `${currentChunk} ${word}` : word;
      if (testChunk.length > 50 && currentChunk) {
        chunks.push(currentChunk);
        currentChunk = word;
      } else {
        currentChunk = testChunk;
      }
    });

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  };

  const showSubtitlesWithAudio = async (chunks: string[], audioDurationMs: number) => {
    const totalWords = chunks.reduce((sum, chunk) => sum + chunk.split(' ').length, 0);
    const msPerWord = audioDurationMs / totalWords;

    subtitleOpacity.value = withTiming(1, { duration: 300 });

    for (let i = 0; i < chunks.length; i++) {
      const wordCount = chunks[i].split(' ').length;
      const duration = wordCount * msPerWord;

      setCurrentSubtitle(chunks[i]);

      await new Promise((resolve) => setTimeout(resolve, duration));

      if (i < chunks.length - 1) {
        setCurrentSubtitle('');
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  };

  const playElevenLabsAudio = async (
    text: string,
    voiceId: string,
    onFinish: () => void,
    onDurationReady?: (durationMs: number) => void,
  ) => {
    try {
      const apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.EXPO_PUBLIC_VIBECODE_ELEVENLABS_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.9,
            similarity_boost: 0.6,
            style: 0.05,
            use_speaker_boost: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      const fileUri = `${FileSystem.cacheDirectory}agent_reveal_audio.mp3`;
      const base64Audio = btoa(
        new Uint8Array(audioBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          '',
        ),
      );

      await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: fileUri },
        { shouldPlay: true },
      );

      soundRef.current = sound;

      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.durationMillis && onDurationReady) {
        onDurationReady(status.durationMillis);
      }

      sound.setOnPlaybackStatusUpdate((playbackStatus) => {
        if (playbackStatus.isLoaded && playbackStatus.didJustFinish) {
          onFinish();
        }
      });
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      // Fallback: estimate duration based on text length
      if (onDurationReady) {
        onDurationReady(text.length * 50);
      }
      setTimeout(onFinish, text.length * 50);
    }
  };

  const startRevealSequence = useCallback(async () => {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

    // Animate avatar in
    avatarScale.value = withSpring(1, { damping: 12, stiffness: 100 });

    setStage('speaking');
    setIsAudioPlaying(true);
    hapticFeedback.medium();

    // Get the reveal speech - Tava introduces the agent
    const revealSpeech = getAgentRevealSpeech(agent, firstName);
    const chunks = splitIntoChunks(revealSpeech);

    let subtitlesStarted = false;

    const audioPromise = new Promise<void>((resolve) => {
      // Use Tava's voice (Rachel) for the introduction
      playElevenLabsAudio(
        revealSpeech,
        '21m00Tcm4TlvDq8ikWAM', // Tava's voice
        () => {
          setIsAudioPlaying(false);
          resolve();
        },
        (duration) => {
          if (!subtitlesStarted) {
            subtitlesStarted = true;
            showSubtitlesWithAudio(chunks, duration);
          }
        },
      );
    });

    await audioPromise;

    // Fade out subtitles
    subtitleOpacity.value = withTiming(0, { duration: 400 });

    // Show the continue button
    setStage('ready');
    buttonOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
  }, [agent, firstName]);

  const handleContinue = async () => {
    if (isCompleting) return;

    setIsCompleting(true);
    hapticFeedback.medium();

    try {
      // Complete onboarding (this saves to Firebase and initializes quests)
      console.log('🚀 AgentReveal: Completing onboarding...');
      await completeOnboarding();
      console.log('✅ AgentReveal: Onboarding complete!');
      // Navigation to main app is handled automatically by the auth state change
    } catch (error) {
      console.error('❌ AgentReveal: Error completing onboarding:', error);
      // Still try to proceed
      setIsCompleting(false);
    }
  };

  const avatarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale.value }],
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradientColors}
        style={styles.gradient}
      >
        {/* Agent Name Badge */}
        <Animated.View
          entering={FadeInUp.delay(300).duration(600)}
          style={styles.nameContainer}
        >
          <View style={styles.sparkleContainer}>
            <Sparkles size={16} color="#fbbf24" />
          </View>
          <Text style={styles.meetText}>Meet your agent</Text>
          <Text style={styles.agentName}>{agent.name}</Text>
          <Text style={styles.agentTitle}>{agent.title}</Text>
        </Animated.View>

        {/* Agent Image Avatar */}
        <Animated.View style={[styles.avatarContainer, avatarAnimatedStyle]}>
          <View style={styles.imageWrapper}>
            <Image
              source={agent.imageSource}
              style={styles.agentImage}
              resizeMode="contain"
            />
            {/* Glow effect behind image */}
            <View style={[styles.glowEffect, { backgroundColor: brandColor || '#6366f1' }]} />
          </View>
        </Animated.View>

        {/* Subtitles */}
        <Animated.View style={[styles.subtitleContainer, subtitleAnimatedStyle]}>
          <Text style={styles.subtitleText}>{currentSubtitle}</Text>
        </Animated.View>

        {/* Agent Traits - shown when ready */}
        {stage === 'ready' && (
          <Animated.View
            entering={FadeIn.delay(200).duration(400)}
            style={styles.traitsContainer}
          >
            <View style={styles.traitsRow}>
              {agent.traits.map((trait, index) => (
                <View key={index} style={styles.traitBadge}>
                  <Text style={styles.traitText}>{trait}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Continue Button */}
        <Animated.View style={[styles.buttonContainer, buttonAnimatedStyle]}>
          <Pressable
            style={[styles.continueButton, isCompleting && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.continueButtonText}>Setting up...</Text>
              </>
            ) : (
              <>
                <Text style={styles.continueButtonText}>Let's Go</Text>
                <ArrowRight size={20} color="#fff" />
              </>
            )}
          </Pressable>
        </Animated.View>
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
  nameContainer: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  sparkleContainer: {
    marginBottom: 8,
  },
  meetText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  agentName: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  agentTitle: {
    fontSize: 18,
    color: '#fbbf24',
    fontWeight: '500',
  },
  avatarContainer: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.18,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentImage: {
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_HEIGHT * 0.5,
    zIndex: 2,
  },
  glowEffect: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.6,
    borderRadius: SCREEN_WIDTH * 0.3,
    opacity: 0.3,
    zIndex: 1,
  },
  subtitleContainer: {
    position: 'absolute',
    bottom: 180,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  subtitleText: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 26,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  traitsContainer: {
    position: 'absolute',
    bottom: 180,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  traitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  traitBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  traitText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 60,
    left: 24,
    right: 24,
  },
  continueButton: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  continueButtonDisabled: {
    backgroundColor: '#4f46e5',
    opacity: 0.8,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});
