import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Send } from 'lucide-react-native';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import useAuthStore from '../../state/authStore';
import useWorkspaceStore from '../../state/workspaceStore';
import TavaMascot from '../../components/TavaMascot';
import { matchAgentToUser, AgentId } from '../../data/agentPersonalities';
import { hapticFeedback } from '../../utils/hapticFeedback';

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

type VoiceOnboardingNavigationProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'VoiceOnboarding'
>;

interface OnboardingQuestion {
  id: string;
  field: string;
  placeholder: string;
  multiline?: boolean;
  type?: 'text' | 'multipleChoice';
  options?: { label: string; value: string }[];
}

// Question templates - we'll interpolate the values when speaking
const questionTemplates: OnboardingQuestion[] = [
  {
    id: 'businessName',
    field: 'businessName',
    placeholder: 'Enter your business name...',
    type: 'text',
  },
  {
    id: 'targetMarket',
    field: 'targetMarket',
    placeholder: 'Describe your ideal customer...',
    multiline: true,
    type: 'text',
  },
  {
    id: 'productDescription',
    field: 'productDescription',
    placeholder: 'Describe what you sell...',
    multiline: true,
    type: 'text',
  },
  {
    id: 'businessStage',
    field: 'businessStage',
    placeholder: '',
    type: 'multipleChoice',
    options: [
      { label: 'Just Starting Out', value: 'startup' },
      { label: 'Growth Mode', value: 'growth' },
      { label: 'Established', value: 'established' },
    ],
  },
];

// Generate the question text dynamically with actual values
const getQuestionText = (questionIndex: number, firstName: string, businessName?: string): string => {
  switch (questionIndex) {
    case 0:
      return `Perfect ${firstName}. Now let's talk about your business. What's the name of the company or brand your agent will be selling for?`;
    case 1:
      return `Nice, ${businessName || 'your business'} - I like it. So tell me, who are we going after? Describe your dream customer - the kind of person who would be thrilled to find what you offer.`;
    case 2:
      return businessName
        ? `Okay, so we know who we're targeting. Now help me understand what ${businessName} actually sells. What's the product or service, and what makes it special?`
        : 'Okay, so we know who we\'re targeting. Now help me understand what you actually sell. What\'s the product or service, and what makes it special?';
    case 3:
      return businessName
        ? `I'm getting a clearer picture of ${businessName}. Quick question - where are you at in your journey? Are you just starting out, in growth mode, or already established?`
        : 'I\'m getting a clearer picture. Quick question - where are you at in your journey? Are you just starting out, in growth mode, or already established?';
    default:
      return '';
  }
};

// Workspace colors
const workspaceColors = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#22C55E', '#10B981', '#14B8A6',
  '#06B6D4', '#7DD3FC', '#3B82F6', '#6366F1', '#8B5CF6',
];

export default function VoiceOnboardingScreen() {
  const navigation = useNavigation<VoiceOnboardingNavigationProp>();
  const { onboardingProgress, setOnboardingProgress, user } = useAuthStore();
  const { addWorkspace } = useWorkspaceStore();

  // State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [stage, setStage] = useState<'ready' | 'speaking' | 'listening' | 'processing'>('ready');
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [avatarReady, setAvatarReady] = useState(false);
  const [collectedData, setCollectedData] = useState<Record<string, string>>({});
  const [selectedColor, setSelectedColor] = useState(workspaceColors[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Animation refs
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(50)).current;
  const inputOpacity = useRef(new Animated.Value(0)).current;
  const inputTranslateY = useRef(new Animated.Value(30)).current;
  const audioOnBlinkAnim = useRef(new Animated.Value(1)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const soundRef = useRef<Audio.Sound | null>(null);

  // Get user data
  const firstName = onboardingProgress?.formData?.firstName || 'there';

  // Get current question template
  const currentQuestion = questionTemplates[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex >= questionTemplates.length - 1;

  // Blinking animation for ready stage
  useEffect(() => {
    if (stage === 'ready') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(audioOnBlinkAnim, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(audioOnBlinkAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [stage, audioOnBlinkAnim]);

  // Setup audio on mount
  useEffect(() => {
    const setupAudio = async () => {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
    };
    setupAudio();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Animate subtitle in
  const animateSubtitleIn = (text: string) => {
    subtitleOpacity.setValue(0);
    subtitleTranslateY.setValue(50);
    setCurrentSubtitle(text);

    Animated.parallel([
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(subtitleTranslateY, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Animate input field in
  const animateInputIn = () => {
    inputOpacity.setValue(0);
    inputTranslateY.setValue(30);

    Animated.parallel([
      Animated.timing(inputOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(inputTranslateY, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Play ElevenLabs audio
  const playElevenLabsAudio = async (
    text: string,
    onFinish: () => void,
  ) => {
    try {
      const voiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel voice (Tava)
      const apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

      console.log('Fetching audio from ElevenLabs...');

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
      const fileUri = `${FileSystem.cacheDirectory}temp_voice_onboarding_${Date.now()}.mp3`;
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

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log('Audio playback finished');
          onFinish();
        }
      });
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      onFinish();
    }
  };

  // Speak the current question (optionally pass a specific question index and business name)
  const speakQuestion = useCallback(async (questionIndex?: number, updatedBusinessName?: string) => {
    const index = questionIndex ?? currentQuestionIndex;
    const questionTemplate = questionTemplates[index];

    if (!questionTemplate) return;

    // Generate the question text with current data
    const questionText = getQuestionText(index, firstName, updatedBusinessName);

    console.log(`[VoiceOnboarding] Speaking question ${index}:`, {
      firstName,
      businessName: updatedBusinessName,
      questionText: `${questionText.substring(0, 50)}...`,
    });

    setStage('speaking');
    setIsAudioPlaying(true);
    animateSubtitleIn(questionText);

    await new Promise<void>((resolve) => {
      playElevenLabsAudio(questionText, () => {
        setIsAudioPlaying(false);
        resolve();
      });
    });

    // Show input field after speaking
    setStage('listening');
    animateInputIn();
  }, [currentQuestionIndex, firstName]);

  // Handle start button press
  const handleStartPress = () => {
    hapticFeedback.medium();
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      speakQuestion();
    });
  };

  // Handle answer submission (for text inputs)
  const handleSubmitAnswer = async () => {
    if (!inputValue.trim() || !currentQuestion) return;
    await submitAnswer(inputValue.trim());
  };

  // Handle multiple choice selection
  const handleMultipleChoiceSelect = async (value: string) => {
    if (!currentQuestion) return;
    await submitAnswer(value);
  };

  // Core submission logic
  const submitAnswer = async (answerValue: string) => {
    if (!answerValue || !currentQuestion) return;

    hapticFeedback.light();
    Keyboard.dismiss();

    // Store the answer
    const newData = {
      ...collectedData,
      [currentQuestion.field]: answerValue,
    };
    setCollectedData(newData);

    // Update onboarding progress
    if (onboardingProgress) {
      setOnboardingProgress({
        ...onboardingProgress,
        formData: {
          ...onboardingProgress.formData,
          [currentQuestion.field]: answerValue,
        },
        updatedAt: new Date(),
      });
    }

    // Clear input
    setInputValue('');

    if (isLastQuestion) {
      // Show color picker for workspace
      setShowColorPicker(true);
      setStage('processing');

      // Speak workspace setup message - use business name from any source
      const workspaceName = newData.businessName || collectedData.businessName || 'your';
      const setupMessage = `Alright ${firstName}, we're almost there. I'm going to create ${workspaceName}'s knowledge hub. Pick a color that feels like ${workspaceName}.`;

      setIsAudioPlaying(true);
      animateSubtitleIn(setupMessage);

      await new Promise<void>((resolve) => {
        playElevenLabsAudio(setupMessage, () => {
          setIsAudioPlaying(false);
          resolve();
        });
      });
    } else {
      // Move to next question
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      setStage('speaking');

      // Small delay then speak next question with explicit index
      // Always pass the business name from collected data for personalization
      const businessNameToUse = newData.businessName || collectedData.businessName;
      setTimeout(() => {
        speakQuestion(nextIndex, businessNameToUse);
      }, 500);
    }
  };

  // Handle workspace completion
  const handleCompleteSetup = async () => {
    hapticFeedback.medium();
    setStage('processing');

    try {
      // Auto-match agent personality type
      const matchedAgentId: AgentId = matchAgentToUser({
        businessName: collectedData.businessName,
        targetMarket: collectedData.targetMarket,
        productDescription: collectedData.productDescription,
        businessStage: collectedData.businessStage as 'idea' | 'startup' | 'growth' | 'established',
        teamSize: onboardingProgress?.formData?.teamSize,
      });

      // Generate a unique agent instance ID (combines personality type + user ID + timestamp)
      const uniqueAgentInstanceId = `${matchedAgentId}_${user?.uid?.slice(0, 8) || 'user'}_${Date.now()}`;

      const workspaceName = `${collectedData.businessName || 'My'} Sales Hub`;

      // Update final onboarding progress
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
          ...collectedData,
          workspaceName,
          workspaceColor: selectedColor,
          assignedAgentId: matchedAgentId, // Personality type: 'sophia' or 'marcus'
          agentInstanceId: uniqueAgentInstanceId, // Unique instance ID per user
          agentAssignedAt: new Date(),
        },
        updatedAt: new Date(),
      };

      setOnboardingProgress(finalProgress);

      // Create workspace
      await addWorkspace({
        name: workspaceName,
        description: '',
        color: selectedColor,
        stats: {
          files: 0,
          media: 0,
          snippets: 0,
          webpages: 0,
        },
      });

      // Navigate to Reddit setup (which will lead to first lead discovery, then agent reveal)
      navigation.navigate('RedditSetup');
    } catch (error) {
      console.error('Error completing setup:', error);
      navigation.navigate('RedditSetup');
    }
  };

  const handleAvatarReady = () => {
    console.log('Tava avatar is ready for voice onboarding');
    setAvatarReady(true);
  };

  // Get gradient colors based on selected color (for color picker stage)
  const gradientColors = showColorPicker ? createGradientFromBrand(selectedColor) : DEFAULT_GRADIENT;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradientColors}
        style={styles.gradient}
      >
        {/* Tava Mascot */}
        <View style={styles.avatarContainer}>
          <TavaMascot
            onReady={handleAvatarReady}
            size={320}
            style={styles.mascot}
          />
        </View>

        {/* Ready Stage - Start Button */}
        {stage === 'ready' && (
          <View style={styles.readyContainer}>
            <Animated.Text
              style={[styles.audioOnText, { opacity: audioOnBlinkAnim }]}
            >
              Audio on
            </Animated.Text>
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <Pressable onPress={handleStartPress} style={styles.arrowButton}>
                <LinearGradient
                  colors={['#6366f1', '#8b5cf6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.arrowButtonGradient}
                >
                  <ArrowRight size={32} color="#ffffff" strokeWidth={2.5} />
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </View>
        )}

        {/* Speaking/Listening Stage - Subtitle and Input */}
        {(stage === 'speaking' || stage === 'listening') && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.interactionContainer}
          >
            {/* Subtitle */}
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

            {/* Input Field - Text or Multiple Choice */}
            {stage === 'listening' && (
              <Animated.View
                style={[
                  styles.inputContainer,
                  {
                    opacity: inputOpacity,
                    transform: [{ translateY: inputTranslateY }],
                  },
                  currentQuestion?.type === 'multipleChoice' && styles.multipleChoiceContainer,
                ]}
              >
                {currentQuestion?.type === 'multipleChoice' ? (
                  // Multiple Choice Buttons
                  <View style={styles.optionsContainer}>
                    {currentQuestion.options?.map((option) => (
                      <Pressable
                        key={option.value}
                        style={styles.optionButton}
                        onPress={() => handleMultipleChoiceSelect(option.value)}
                      >
                        <LinearGradient
                          colors={['rgba(99, 102, 241, 0.9)', 'rgba(139, 92, 246, 0.9)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.optionButtonGradient}
                        >
                          <Text style={styles.optionButtonText}>{option.label}</Text>
                        </LinearGradient>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  // Text Input
                  <>
                    <TextInput
                      style={[
                        styles.textInput,
                        currentQuestion?.multiline && styles.textInputMultiline,
                      ]}
                      placeholder={currentQuestion?.placeholder}
                      placeholderTextColor="#9CA3AF"
                      value={inputValue}
                      onChangeText={setInputValue}
                      multiline={currentQuestion?.multiline}
                      autoFocus
                      returnKeyType={currentQuestion?.multiline ? 'default' : 'done'}
                      onSubmitEditing={!currentQuestion?.multiline ? handleSubmitAnswer : undefined}
                    />
                    <Pressable
                      style={[
                        styles.sendButton,
                        !inputValue.trim() && styles.sendButtonDisabled,
                      ]}
                      onPress={handleSubmitAnswer}
                      disabled={!inputValue.trim()}
                    >
                      <Send size={24} color={inputValue.trim() ? '#ffffff' : '#6B7280'} />
                    </Pressable>
                  </>
                )}
              </Animated.View>
            )}
          </KeyboardAvoidingView>
        )}

        {/* Color Picker Stage */}
        {showColorPicker && (
          <View style={styles.colorPickerContainer}>
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

            <View style={styles.colorGrid}>
              {workspaceColors.map((color) => (
                <Pressable
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorOptionSelected,
                  ]}
                  onPress={() => {
                    hapticFeedback.light();
                    setSelectedColor(color);
                  }}
                />
              ))}
            </View>

            <Pressable
              style={styles.completeButton}
              onPress={handleCompleteSetup}
            >
              <LinearGradient
                colors={[selectedColor, selectedColor]}
                style={styles.completeButtonGradient}
              >
                <Text style={styles.completeButtonText}>Meet Your Agent</Text>
                <ArrowRight size={20} color="#ffffff" />
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {/* Progress Indicator */}
        {stage !== 'ready' && !showColorPicker && (
          <View style={styles.progressContainer}>
            {questionTemplates.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index <= currentQuestionIndex && styles.progressDotActive,
                  index === currentQuestionIndex && styles.progressDotCurrent,
                ]}
              />
            ))}
          </View>
        )}
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
  avatarContainer: {
    flex: 1,
    maxHeight: '55%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mascot: {
    alignSelf: 'center',
  },
  readyContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  audioOnText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 24,
    textShadowColor: '#000000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  arrowButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  arrowButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  interactionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  subtitleText: {
    fontSize: 20,
    color: '#ffffff',
    textAlign: 'center',
    textShadowColor: '#000000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
    lineHeight: 28,
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    maxHeight: 120,
  },
  textInputMultiline: {
    minHeight: 80,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  sendButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#374151',
    shadowOpacity: 0,
  },
  multipleChoiceContainer: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  optionButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  optionButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  progressContainer: {
    position: 'absolute',
    top: 60,
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
  progressDotActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  progressDotCurrent: {
    backgroundColor: '#6366f1',
    width: 24,
  },
  colorPickerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 32,
    maxWidth: 280,
  },
  colorOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  completeButton: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  completeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 8,
  },
  completeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
});
