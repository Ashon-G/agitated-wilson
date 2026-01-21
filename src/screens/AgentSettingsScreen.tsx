import React, { useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Target, BarChart3, MessageCircle, CheckCircle, ChevronLeft, Lock, Sparkles } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import useAgentSettingsStore from '../state/agentSettingsStore';
import useSubscriptionStore from '../state/subscriptionStore';
import { useTheme } from '../contexts/ThemeContext';
import { CommentStyle } from '../types/app';
import { hapticFeedback } from '../utils/hapticFeedback';
import { toastManager } from '../utils/toastManager';
import { withScreenErrorBoundary } from '../components/ScreenErrorBoundary';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Chip selector component for discrete options
interface ChipSelectorProps {
  options: { value: number; label: string }[];
  selectedValue: number;
  onSelect: (value: number) => void;
  isDark: boolean;
}

function ChipSelector({ options, selectedValue, onSelect, isDark }: ChipSelectorProps) {
  return (
    <View className="flex-row gap-2">
      {options.map((option) => {
        const isSelected = selectedValue === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              hapticFeedback.selection();
              onSelect(option.value);
            }}
            className={`flex-1 py-3 rounded-xl items-center justify-center border-2 ${
              isSelected
                ? 'bg-green-500 border-green-500'
                : isDark
                  ? 'bg-gray-700 border-gray-600'
                  : 'bg-gray-100 border-gray-200'
            }`}
          >
            <Text
              className={`font-semibold ${
                isSelected ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Radio card component for style selection
interface StyleCardProps {
  style: CommentStyle;
  title: string;
  description: string;
  icon: string;
  isSelected: boolean;
  isLocked: boolean;
  onSelect: () => void;
  isDark: boolean;
}

function StyleCard({ title, description, icon, isSelected, isLocked, onSelect, isDark }: StyleCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (isLocked) {
      hapticFeedback.warning();
      toastManager.info('Upgrade to Plus or higher to unlock this style');
      return;
    }
    scale.value = withSpring(0.97, { damping: 15 }, () => {
      scale.value = withSpring(1);
    });
    hapticFeedback.selection();
    onSelect();
  };

  return (
    <AnimatedPressable onPress={handlePress} style={animatedStyle}>
      <View
        className={`flex-row items-center p-4 rounded-xl border-2 mb-2 ${
          isSelected
            ? 'border-green-500 bg-green-500/10'
            : isLocked
              ? isDark
                ? 'border-gray-800 bg-gray-900 opacity-60'
                : 'border-gray-300 bg-gray-200 opacity-60'
              : isDark
                ? 'border-gray-700 bg-gray-800'
                : 'border-gray-200 bg-gray-50'
        }`}
      >
        <View
          className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
            isSelected ? 'bg-green-500' : isLocked ? isDark ? 'bg-gray-800' : 'bg-gray-300' : isDark ? 'bg-gray-700' : 'bg-gray-200'
          }`}
        >
          <Text className="text-lg">{icon}</Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text
              className={`font-semibold text-base ${
                isSelected
                  ? 'text-green-500'
                  : isLocked
                    ? isDark
                      ? 'text-gray-600'
                      : 'text-gray-400'
                    : isDark
                      ? 'text-white'
                      : 'text-gray-900'
              }`}
            >
              {title}
            </Text>
            {isLocked && (
              <View className={`ml-2 px-2 py-0.5 rounded-full ${isDark ? 'bg-amber-900/50' : 'bg-amber-100'}`}>
                <Text className={`text-xs font-medium ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Plus+</Text>
              </View>
            )}
          </View>
          <Text className={`text-sm mt-0.5 ${isLocked ? isDark ? 'text-gray-700' : 'text-gray-400' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {description}
          </Text>
        </View>
        {isSelected && (
          <View
            className={'w-6 h-6 rounded-full border-2 items-center justify-center border-green-500 bg-green-500'}
          >
            <CheckCircle size={14} color="white" />
          </View>
        )}
        {isLocked && !isSelected && (
          <Lock size={16} color={isDark ? '#666' : '#999'} />
        )}
        {!isSelected && !isLocked && (
          <View
            className={'w-6 h-6 rounded-full border-2 items-center justify-center border-gray-400'}
          />
        )}
      </View>
    </AnimatedPressable>
  );
}

// Section header component
interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  isDark: boolean;
}

function SectionHeader({ icon, title, isDark }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center mb-3">
      <View className={`mr-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{icon}</View>
      <Text
        className={`text-xs font-semibold uppercase tracking-wider ${
          isDark ? 'text-gray-400' : 'text-gray-500'
        }`}
      >
        {title}
      </Text>
    </View>
  );
}

function AgentSettingsScreen() {
  const navigation = useNavigation();
  const { isDark } = useTheme();

  const settings = useAgentSettingsStore((s) => s.settings);
  const isLoading = useAgentSettingsStore((s) => s.isLoading);
  const loadSettings = useAgentSettingsStore((s) => s.loadSettings);
  const setScoreThreshold = useAgentSettingsStore((s) => s.setScoreThreshold);
  const setMaxPostsPerRun = useAgentSettingsStore((s) => s.setMaxPostsPerRun);
  const setPostAgeLimitDays = useAgentSettingsStore((s) => s.setPostAgeLimitDays);
  const setCommentStyle = useAgentSettingsStore((s) => s.setCommentStyle);
  const setRequireApproval = useAgentSettingsStore((s) => s.setRequireApproval);

  // Get allowed comment styles from subscription
  const allowedCommentStyles = useSubscriptionStore((s) => s.limits.commentStyles);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleBack = useCallback(() => {
    hapticFeedback.light();
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handleScoreChange = useCallback(
    async (value: number) => {
      try {
        await setScoreThreshold(Math.round(value));
      } catch {
        toastManager.error('Failed to update threshold');
      }
    },
    [setScoreThreshold],
  );

  const handleMaxPostsChange = useCallback(
    async (value: number) => {
      try {
        await setMaxPostsPerRun(value);
      } catch {
        toastManager.error('Failed to update posts limit');
      }
    },
    [setMaxPostsPerRun],
  );

  const handlePostAgeChange = useCallback(
    async (value: number) => {
      try {
        await setPostAgeLimitDays(value);
      } catch {
        toastManager.error('Failed to update post age');
      }
    },
    [setPostAgeLimitDays],
  );

  const handleStyleChange = useCallback(
    async (style: CommentStyle) => {
      try {
        await setCommentStyle(style);
      } catch {
        toastManager.error('Failed to update style');
      }
    },
    [setCommentStyle],
  );

  const handleApprovalChange = useCallback(
    async (value: boolean) => {
      hapticFeedback.selection();
      try {
        await setRequireApproval(value);
      } catch {
        toastManager.error('Failed to update approval setting');
      }
    },
    [setRequireApproval],
  );

  const cardStyle = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const textStyle = isDark ? 'text-white' : 'text-gray-900';
  const textSecondaryStyle = isDark ? 'text-gray-400' : 'text-gray-600';

  if (isLoading || !settings) {
    return (
      <SafeAreaView className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <View className="flex-1 items-center justify-center">
          <Text className={textSecondaryStyle}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-200/20">
        <Pressable
          onPress={handleBack}
          className="w-10 h-10 items-center justify-center rounded-full"
          style={{ backgroundColor: isDark ? '#374151' : '#F3F4F6' }}
        >
          <ChevronLeft size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
        </Pressable>
        <Text className={`flex-1 text-xl font-bold text-center ${textStyle}`}>Agent Settings</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Targeting Section */}
        <View className={`mt-6 p-4 rounded-2xl border ${cardStyle}`}>
          <SectionHeader
            icon={<Target size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />}
            title="Targeting"
            isDark={isDark}
          />

          <Text className={`text-base font-semibold mb-1 ${textStyle}`}>Lead Quality</Text>
          <Text className={`text-sm mb-4 ${textSecondaryStyle}`}>
            Choose how selective your agent should be
          </Text>

          {/* Preset Buttons - One tap selection */}
          <View className="flex-row gap-2">
            {[
              { value: 3, label: 'Relaxed', desc: 'More leads', icon: '🎯' },
              { value: 5, label: 'Balanced', desc: 'Best mix', icon: '⚖️' },
              { value: 7, label: 'Strict', desc: 'Top quality', icon: '💎' },
            ].map((preset) => {
              const isSelected = settings.scoreThreshold === preset.value;
              return (
                <Pressable
                  key={preset.value}
                  onPress={() => {
                    hapticFeedback.selection();
                    handleScoreChange(preset.value);
                  }}
                  className={`flex-1 py-3 px-2 rounded-xl items-center justify-center border-2 ${
                    isSelected
                      ? 'bg-green-500 border-green-500'
                      : isDark
                        ? 'bg-gray-700 border-gray-600'
                        : 'bg-gray-100 border-gray-200'
                  }`}
                >
                  <Text className="text-lg mb-1">{preset.icon}</Text>
                  <Text
                    className={`font-semibold text-sm ${
                      isSelected ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    {preset.label}
                  </Text>
                  <Text
                    className={`text-xs mt-0.5 ${
                      isSelected ? 'text-white/80' : isDark ? 'text-gray-500' : 'text-gray-500'
                    }`}
                  >
                    {preset.desc}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Volume Section */}
        <View className={`mt-4 p-4 rounded-2xl border ${cardStyle}`}>
          <SectionHeader
            icon={<BarChart3 size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />}
            title="Volume"
            isDark={isDark}
          />

          <Text className={`text-base font-semibold mb-1 ${textStyle}`}>Posts per Run</Text>
          <Text className={`text-sm mb-3 ${textSecondaryStyle}`}>
            Maximum posts to analyze each cycle (hardcoded at 3 for rate limiting)
          </Text>
          <View className={`px-4 py-3 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <Text className={`text-center font-bold text-lg ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              3 posts
            </Text>
          </View>

          <View className="h-4" />

          <Text className={`text-base font-semibold mb-1 ${textStyle}`}>Post Freshness</Text>
          <Text className={`text-sm mb-3 ${textSecondaryStyle}`}>Ignore posts older than...</Text>
          <ChipSelector
            options={[
              { value: 7, label: '1 Week' },
              { value: 14, label: '2 Weeks' },
              { value: 30, label: '1 Month' },
            ]}
            selectedValue={settings.postAgeLimitDays}
            onSelect={handlePostAgeChange}
            isDark={isDark}
          />
        </View>

        {/* Voice Section */}
        <View className={`mt-4 p-4 rounded-2xl border ${cardStyle}`}>
          <SectionHeader
            icon={<MessageCircle size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />}
            title="Voice"
            isDark={isDark}
          />

          <Text className={`text-base font-semibold mb-1 ${textStyle}`}>Comment Style</Text>
          <Text className={`text-sm mb-3 ${textSecondaryStyle}`}>
            How your agent sounds when replying
          </Text>

          <StyleCard
            style="friendly"
            title="Friendly & Casual"
            description="Conversational, relatable, approachable"
            icon="😊"
            isSelected={settings.commentStyle === 'friendly'}
            isLocked={!allowedCommentStyles.includes('friendly')}
            onSelect={() => handleStyleChange('friendly')}
            isDark={isDark}
          />
          <StyleCard
            style="professional"
            title="Professional"
            description="Business-focused, polished, formal"
            icon="💼"
            isSelected={settings.commentStyle === 'professional'}
            isLocked={!allowedCommentStyles.includes('professional')}
            onSelect={() => handleStyleChange('professional')}
            isDark={isDark}
          />
          <StyleCard
            style="expert"
            title="Expert & Technical"
            description="Authoritative, detailed, knowledgeable"
            icon="🧠"
            isSelected={settings.commentStyle === 'expert'}
            isLocked={!allowedCommentStyles.includes('expert')}
            onSelect={() => handleStyleChange('expert')}
            isDark={isDark}
          />
        </View>

        {/* Approval Section */}
        <View className={`mt-4 mb-8 p-4 rounded-2xl border ${cardStyle}`}>
          <SectionHeader
            icon={<CheckCircle size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />}
            title="Approval"
            isDark={isDark}
          />

          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <Text className={`text-base font-semibold ${textStyle}`}>Review before posting</Text>
              <Text className={`text-sm mt-1 ${textSecondaryStyle}`}>
                Get notified to approve each comment before it goes live
              </Text>
            </View>
            <Switch
              value={settings.requireApproval}
              onValueChange={handleApprovalChange}
              trackColor={{ false: '#E5E7EB', true: '#4ADE80' }}
              thumbColor={settings.requireApproval ? '#22C55E' : '#F3F4F6'}
            />
          </View>
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

export default withScreenErrorBoundary('AgentSettingsScreen', {
  showRetryButton: true,
  maxRetries: 3,
  fallbackMessage: 'Something went wrong with the Agent Settings screen. Please try again.',
})(AgentSettingsScreen);
