import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowRight } from 'lucide-react-native';
import { OnboardingStackParamList } from '../navigation/OnboardingNavigator';
import useAuthStore from '../state/authStore';
import TavaAvatar3D from '../components/TavaAvatar3D';

type WelcomeNavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'Welcome'>;

interface WelcomeScreenProps {
  onComplete?: (firstName: string) => void;
}

export default function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const navigation = useNavigation<WelcomeNavigationProp>();
  const { user, setOnboardingProgress, onboardingProgress, loadOnboardingProgress } = useAuthStore();

  const [stage, setStage] = useState<
    'initial' | 'speaking' | 'input' | 'greeting'
  >('initial');
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [name, setName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [avatarReady, setAvatarReady] = useState(false);

  const continueBlinkAnim = useRef(new Animated.Value(1)).current;
  const inputSlideAnim = useRef(new Animated.Value(300)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(50)).current;
  const soundRef = useRef<Audio.Sound | null>(null);

  // Check for saved onboarding progress on mount
  useEffect(() => {
    const checkSavedProgress = async () => {
      if (!user) return;

      await loadOnboardingProgress();
      const progress = useAuthStore.getState().onboardingProgress;

      // If we have saved progress and it's not completed, resume at VoiceOnboarding
      if (progress && !progress.isCompleted && progress.currentStep > 1) {
        console.log('✅ Found saved progress, resuming voice onboarding');
        navigation.navigate('VoiceOnboarding');
      }
    };

    checkSavedProgress();
  }, [user, navigation, loadOnboardingProgress]);

  // Blinking animation for "tap to begin"
  useEffect(() => {
    if (stage === 'initial') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(continueBlinkAnim, {
            toValue: 0.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(continueBlinkAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [stage, continueBlinkAnim]);

  // Fallback: auto-set avatarReady after timeout in case model fails to load
  useEffect(() => {
    if (stage === 'initial') {
      const fallbackTimer = setTimeout(() => {
        if (!avatarReady) {
          console.log('Avatar load timeout - proceeding without avatar ready signal');
          setAvatarReady(true);
        }
      }, 8000); // 8 second fallback
      return () => clearTimeout(fallbackTimer);
    }
  }, [stage, avatarReady]);

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const slideUpInput = () => {
    Animated.spring(inputSlideAnim, {
      toValue: 0,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  const fadeOutSubtitle = () => {
    return new Promise<void>((resolve) => {
      Animated.parallel([
        Animated.timing(subtitleOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(subtitleTranslateY, {
          toValue: -50,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => resolve());
    });
  };

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
    console.log('Starting subtitles with duration:', audioDurationMs, 'ms');

    const totalWords = chunks.reduce((sum, chunk) => sum + chunk.split(' ').length, 0);
    const msPerWord = audioDurationMs / totalWords;

    subtitleOpacity.setValue(1);
    subtitleTranslateY.setValue(0);

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
    onFinish: () => void,
    onDurationReady?: (durationMs: number) => void,
  ) => {
    try {
      const voiceId = '21m00Tcm4TlvDq8ikWAM';
      const apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

      console.log('Fetching audio from ElevenLabs...');

      try {
        const cacheDir = FileSystem.cacheDirectory;
        if (cacheDir) {
          const oldFile = `${cacheDir}temp_audio.mp3`;
          const fileInfo = await FileSystem.getInfoAsync(oldFile);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(oldFile, { idempotent: true });
          }
        }
      } catch (cleanupError) {
        console.warn('Cache cleanup failed:', cleanupError);
      }

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
      const fileUri = `${FileSystem.cacheDirectory}temp_audio.mp3`;
      const base64Audio = btoa(
        new Uint8Array(audioBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          '',
        ),
      );

      try {
        await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (writeError: any) {
        const errorMsg = writeError?.message || '';
        if (errorMsg.includes('Writing to') || errorMsg.includes('failed')) {
          if (onDurationReady) {
            const estimatedDuration = text.length * 50;
            onDurationReady(estimatedDuration);
          }
          setTimeout(onFinish, 100);
          return;
        }
        throw writeError;
      }

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

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          onFinish();
        }
      });
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      onFinish();
    }
  };

  const speakIntroduction = useCallback(async () => {
    setStage('speaking');
    setIsAudioPlaying(true);

    const introText =
      'Hello builder, my name is Tava and I\'ll be in charge of managing your digital sales team. Before we start can I have your name?';

    const chunks = splitIntoChunks(introText);

    let subtitlesStarted = false;

    const audioPromise = new Promise<void>((resolve) => {
      playElevenLabsAudio(
        introText,
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

    await fadeOutSubtitle();
    setTimeout(() => {
      setStage('input');
      slideUpInput();
    }, 400);
  }, []);

  const handleInitialClick = async () => {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
    // Skip countdown, go directly to speaking
    speakIntroduction();
  };

  const handleSubmitName = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || isProcessing) return;

    const nameParts = trimmedName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    setIsProcessing(true);
    setStage('greeting');
    setIsAudioPlaying(true);
    Keyboard.dismiss();

    const greetingText = `Nice to meet you ${firstName}, I'm going to take you through the process of setting up your first digital sales agent. This process is quick and really fun! You will be able to customize your agent, train it on your business or brand, and send it off to find and close deals for you, let's begin.`;

    const greetingChunks = splitIntoChunks(greetingText);

    let subtitlesStarted = false;

    const audioPromise = new Promise<void>((resolve) => {
      playElevenLabsAudio(
        greetingText,
        () => {
          setIsAudioPlaying(false);
          resolve();
        },
        (duration) => {
          if (!subtitlesStarted) {
            subtitlesStarted = true;
            showSubtitlesWithAudio(greetingChunks, duration);
          }
        },
      );
    });

    await audioPromise;

    await fadeOutSubtitle();

    // Initialize or update onboarding progress with the user's name
    const { setOnboardingProgress, onboardingProgress: currentProgress, updateOnboardingStep } = useAuthStore.getState();

    if (!currentProgress) {
      // Initialize onboarding progress for new users
      const newProgress = {
        userId: user?.uid || '',
        currentStep: 2,
        totalSteps: 6,
        completedSteps: [1, 2],
        formData: {
          firstName,
          lastName,
        },
        isCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setOnboardingProgress(newProgress);
      console.log('✅ Initialized onboarding progress with name:', firstName, lastName);
    } else {
      // Update existing progress
      await updateOnboardingStep(2, {
        firstName,
        lastName,
      });
      console.log('✅ Updated onboarding progress with name:', firstName, lastName);
    }

    setTimeout(() => {
      if (onComplete) {
        onComplete(firstName);
      } else {
        navigation.navigate('VoiceOnboarding');
      }
    }, 500);
  };

  const handleAvatarReady = () => {
    console.log('Tava avatar is ready');
    setAvatarReady(true);
  };

  // Render initial tap-to-start screen
  if (stage === 'initial') {
    return (
      <Pressable onPress={handleInitialClick} style={styles.container}>
        <LinearGradient
          colors={['#0f172a', '#1e293b', '#334155']}
          style={styles.gradient}
        >
          <TavaAvatar3D
            isAudioPlaying={false}
            onReady={handleAvatarReady}
            showPlatform={true}
            cameraDistance={3}
            cameraHeight={0.3}
          />
          <View style={styles.bottomContent}>
            <Text style={styles.volumeOnText}>VOLUME ON</Text>
            <Animated.Text
              style={[styles.continueText, { opacity: continueBlinkAnim }]}
            >
              tap to begin
            </Animated.Text>
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  // Render speaking/greeting stages with avatar
  if (stage === 'speaking' || stage === 'greeting') {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0f172a', '#1e293b', '#334155']}
          style={styles.gradient}
        >
          <TavaAvatar3D
            isAudioPlaying={isAudioPlaying}
            showPlatform={true}
            cameraDistance={2.5}
            cameraHeight={0.2}
          />
          <View style={styles.subtitleContainer}>
            <Animated.Text
              style={[
                styles.subtitleText,
                {
                  opacity: subtitleOpacity,
                  transform: [{ translateY: subtitleTranslateY }],
                },
              ]}
            >
              {currentSubtitle}
            </Animated.Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // Render input screen
  if (stage === 'input') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <LinearGradient
          colors={['#0f172a', '#1e293b', '#334155']}
          style={styles.gradient}
        >
          <TavaAvatar3D
            isAudioPlaying={false}
            showPlatform={true}
            cameraDistance={3}
            cameraHeight={0.3}
          />
          <View style={styles.inputContainer}>
            <Animated.View
              style={[
                styles.inputWrapper,
                { transform: [{ translateY: inputSlideAnim }] },
              ]}
            >
              <View style={styles.inputRow}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="First and Last Name"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  style={styles.textInput}
                  autoFocus
                  onSubmitEditing={handleSubmitName}
                  returnKeyType="done"
                  editable={!isProcessing}
                />
                <Pressable
                  onPress={handleSubmitName}
                  disabled={!name.trim() || isProcessing}
                  style={[
                    styles.arrowButton,
                    (!name.trim() || isProcessing) && styles.arrowButtonDisabled,
                  ]}
                >
                  <ArrowRight size={24} color="#ffffff" strokeWidth={2.5} />
                </Pressable>
              </View>
            </Animated.View>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  bottomContent: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  volumeOnText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ef4444',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: '#000000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  continueText: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '500',
    textShadowColor: '#000000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitleContainer: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  subtitleText: {
    fontSize: 20,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 28,
    textShadowColor: '#000000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 48,
  },
  inputWrapper: {
    width: '100%',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingLeft: 20,
    paddingRight: 6,
  },
  textInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 18,
    color: '#ffffff',
  },
  arrowButton: {
    backgroundColor: '#6366f1',
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowButtonDisabled: {
    backgroundColor: 'rgba(99, 102, 241, 0.4)',
  },
});
