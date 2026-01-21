import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, Pressable, TextInput, FlatList, ActivityIndicator, Switch } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { ChevronLeft, ChevronRight, Target, Search, Sparkles, Settings, CheckCircle, Rocket } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import { useTheme } from '../contexts/ThemeContext';
import { hapticFeedback } from '../utils/hapticFeedback';
import RedditOAuthService from '../integrations/RedditOAuthService';
import useSubscriptionStore from '../state/subscriptionStore';
import useAgentSettingsStore from '../state/agentSettingsStore';
import { CommentStyle } from '../types/app';

type SetupStep = 'subreddits' | 'keywords' | 'agent_config';

interface AgentConfig {
  scoreThreshold: number;
  postAgeLimitDays: number;
  commentStyle: CommentStyle;
  requireApproval: boolean;
}

interface RedditSubredditSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSave: (subreddits: string[], keywords?: string[], agentConfig?: AgentConfig) => Promise<void>;
  initialSubreddits?: string[];
  initialKeywords?: string[];
}

interface SubredditResult {
  name: string;
  description: string;
  subscribers?: number;
}

const POPULAR_SUBREDDITS: SubredditResult[] = [
  { name: 'startups', description: 'Startup discussions and advice' },
  { name: 'entrepreneur', description: 'Entrepreneurship community' },
  { name: 'smallbusiness', description: 'Small business owners' },
  { name: 'SaaS', description: 'Software as a Service' },
  { name: 'indiehackers', description: 'Indie makers community' },
  { name: 'marketing', description: 'Marketing strategies' },
  { name: 'sales', description: 'Sales professionals' },
  { name: 'business', description: 'General business discussions' },
  { name: 'Affiliatemarketing', description: 'Affiliate marketing' },
  { name: 'digitalnomad', description: 'Remote work lifestyle' },
];

export const RedditSubredditSelector: React.FC<RedditSubredditSelectorProps> = ({
  visible,
  onClose,
  onSave,
  initialSubreddits = [],
  initialKeywords = [],
}) => {
  const { isDark } = useTheme();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [currentStep, setCurrentStep] = useState<SetupStep>('subreddits');
  const [selectedSubreddits, setSelectedSubreddits] = useState<string[]>(initialSubreddits);
  const [keywords, setKeywords] = useState<string[]>(initialKeywords);
  const [keywordInput, setKeywordInput] = useState('');
  const [customSubreddit, setCustomSubreddit] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [searchResults, setSearchResults] = useState<SubredditResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showApiResults, setShowApiResults] = useState(false);
  const [customSubredditResults, setCustomSubredditResults] = useState<SubredditResult[]>([]);
  const [isSearchingCustom, setIsSearchingCustom] = useState(false);
  const [showCustomResults, setShowCustomResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const customSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const snapPoints = useMemo(() => ['90%'], []);

  // Agent config state
  const agentSettings = useAgentSettingsStore(s => s.settings);
  const loadSettings = useAgentSettingsStore(s => s.loadSettings);
  const [scoreThreshold, setScoreThreshold] = useState(agentSettings?.scoreThreshold || 5);
  const [postAgeLimitDays, setPostAgeLimitDays] = useState(agentSettings?.postAgeLimitDays || 7);
  const [commentStyle, setCommentStyle] = useState<CommentStyle>(agentSettings?.commentStyle || 'friendly');
  const [requireApproval, setRequireApproval] = useState(agentSettings?.requireApproval ?? true);

  // Load agent settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Sync agent config state with loaded settings
  useEffect(() => {
    if (agentSettings) {
      setScoreThreshold(agentSettings.scoreThreshold);
      setPostAgeLimitDays(agentSettings.postAgeLimitDays);
      setCommentStyle(agentSettings.commentStyle);
      setRequireApproval(agentSettings.requireApproval);
    }
  }, [agentSettings]);

  // Get subscription limits
  const limits = useSubscriptionStore(s => s.limits);
  const tier = useSubscriptionStore(s => s.tier);
  const subredditLimit = limits.subreddits;
  const hasReachedLimit = selectedSubreddits.length >= subredditLimit;

  // Check subscription features
  const allowedCommentStyles = limits.commentStyles;
  const canUseCustomKeywords = limits.customKeywords;

  useEffect(() => {
    console.log('[RedditSubredditSelector] visible changed:', visible);
    if (visible) {
      console.log('[RedditSubredditSelector] Expanding bottom sheet');
      setCurrentStep('subreddits'); // Reset to first step when opening
      // Add a small delay to ensure the bottom sheet is mounted before expanding
      // This fixes a race condition after OAuth callbacks where the ref isn't ready
      const timer = setTimeout(() => {
        console.log('[RedditSubredditSelector] Delayed expand call');
        bottomSheetRef.current?.expand();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible]);

  useEffect(() => {
    setSelectedSubreddits(initialSubreddits);
  }, [initialSubreddits.join(',')]);

  useEffect(() => {
    setKeywords(initialKeywords);
  }, [initialKeywords.join(',')]);

  // Keyword functions
  const addKeyword = () => {
    if (!keywordInput.trim()) return;
    const newKeyword = keywordInput.trim().toLowerCase();
    if (!keywords.includes(newKeyword)) {
      hapticFeedback.light();
      setKeywords(prev => [...prev, newKeyword]);
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword: string) => {
    hapticFeedback.light();
    setKeywords(prev => prev.filter(k => k !== keyword));
  };

  const goToNextStep = () => {
    hapticFeedback.light();
    if (currentStep === 'subreddits') {
      setCurrentStep('keywords');
    } else if (currentStep === 'keywords') {
      setCurrentStep('agent_config');
    }
  };

  const goToPrevStep = () => {
    hapticFeedback.light();
    if (currentStep === 'keywords') {
      setCurrentStep('subreddits');
    } else if (currentStep === 'agent_config') {
      setCurrentStep('keywords');
    }
  };

  // Debounced search effect
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If search query is empty, show popular subreddits
    if (searchQuery.trim().length === 0) {
      setShowApiResults(false);
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // If search query is less than 2 characters, don't search
    if (searchQuery.trim().length < 2) {
      setShowApiResults(false);
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Set searching state
    setIsSearching(true);
    setShowApiResults(true);

    // Debounce: wait 500ms after user stops typing
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('🔍 Searching for subreddits:', searchQuery);
        const results = await RedditOAuthService.searchSubreddits(searchQuery.trim());

        if (results) {
          setSearchResults(results);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error('Error searching subreddits:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    // Cleanup
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Debounced search for custom subreddit input (real-time autocomplete)
  useEffect(() => {
    // Clear previous timeout
    if (customSearchTimeoutRef.current) {
      clearTimeout(customSearchTimeoutRef.current);
    }

    // If input is empty, hide results
    if (customSubreddit.trim().length === 0) {
      setShowCustomResults(false);
      setCustomSubredditResults([]);
      setIsSearchingCustom(false);
      return;
    }

    // If input is less than 2 characters, don't search
    if (customSubreddit.trim().length < 2) {
      setShowCustomResults(false);
      setCustomSubredditResults([]);
      setIsSearchingCustom(false);
      return;
    }

    // Set searching state
    setIsSearchingCustom(true);
    setShowCustomResults(true);

    // Debounce: wait 300ms after user stops typing
    customSearchTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('🔍 Searching for subreddits (autocomplete):', customSubreddit);
        const results = await RedditOAuthService.searchSubreddits(customSubreddit.trim());

        if (results && results.length > 0) {
          // Filter out already selected subreddits and limit to 5 results
          const filteredResults = results
            .filter(r => !selectedSubreddits.includes(r.name))
            .slice(0, 5);
          setCustomSubredditResults(filteredResults);
        } else {
          setCustomSubredditResults([]);
        }
      } catch (error) {
        console.error('Error searching subreddits:', error);
        setCustomSubredditResults([]);
      } finally {
        setIsSearchingCustom(false);
      }
    }, 300);

    // Cleanup
    return () => {
      if (customSearchTimeoutRef.current) {
        clearTimeout(customSearchTimeoutRef.current);
      }
    };
  }, [customSubreddit, selectedSubreddits]);

  // Select a subreddit from autocomplete results
  const selectFromAutocomplete = (subredditName: string) => {
    if (selectedSubreddits.length >= subredditLimit) {
      hapticFeedback.warning();
      return;
    }

    if (!selectedSubreddits.includes(subredditName)) {
      hapticFeedback.medium();
      setSelectedSubreddits(prev => [...prev, subredditName]);
    }
    setCustomSubreddit('');
    setShowCustomResults(false);
    setCustomSubredditResults([]);
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  const toggleSubreddit = (subreddit: string) => {
    const isCurrentlySelected = selectedSubreddits.includes(subreddit);

    // If trying to add and at limit, show feedback but don't add
    if (!isCurrentlySelected && selectedSubreddits.length >= subredditLimit) {
      hapticFeedback.warning();
      return;
    }

    hapticFeedback.light();
    setSelectedSubreddits(prev =>
      isCurrentlySelected
        ? prev.filter(s => s !== subreddit)
        : [...prev, subreddit],
    );
  };

  const addCustomSubreddit = () => {
    if (!customSubreddit.trim()) return;

    // Check limit before adding
    if (selectedSubreddits.length >= subredditLimit) {
      hapticFeedback.warning();
      return;
    }

    const cleanedSubreddit = customSubreddit.trim().replace(/^r\//, '');

    if (!selectedSubreddits.includes(cleanedSubreddit)) {
      hapticFeedback.medium();
      setSelectedSubreddits(prev => [...prev, cleanedSubreddit]);
      setCustomSubreddit('');
    }
  };

  const removeSubreddit = (subreddit: string) => {
    hapticFeedback.light();
    setSelectedSubreddits(prev => prev.filter(s => s !== subreddit));
  };

  const handleSave = async () => {
    if (selectedSubreddits.length === 0) {
      return;
    }

    setIsSaving(true);
    hapticFeedback.medium();

    try {
      const agentConfig: AgentConfig = {
        scoreThreshold,
        postAgeLimitDays,
        commentStyle,
        requireApproval,
      };
      await onSave(selectedSubreddits, keywords, agentConfig);
      onClose();
    } catch (error) {
      console.error('Failed to save subreddits:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Determine which list to show
  const displayedSubreddits = showApiResults ? searchResults : POPULAR_SUBREDDITS.filter(sub =>
    sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const formatSubscriberCount = (count?: number): string => {
    if (!count) return '';
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M members`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K members`;
    }
    return `${count} members`;
  };

  // Step indicator component
  const renderStepIndicator = () => (
    <View className="flex-row justify-center items-center py-3 gap-2">
      <View className={`h-2 rounded-full ${currentStep === 'subreddits' ? 'bg-blue-500 w-8' : 'bg-blue-500 w-2'}`} />
      <View className={`h-2 rounded-full ${currentStep === 'keywords' ? 'bg-blue-500 w-8' : currentStep === 'agent_config' ? 'bg-blue-500 w-2' : isDark ? 'bg-gray-700 w-2' : 'bg-gray-300 w-2'}`} />
      <View className={`h-2 rounded-full ${currentStep === 'agent_config' ? 'bg-blue-500 w-8' : isDark ? 'bg-gray-700 w-2' : 'bg-gray-300 w-2'}`} />
    </View>
  );

  // Subreddits step content
  const renderSubredditsStep = () => (
    <>
      {/* Limit indicator */}
      <View className={`flex-row items-center justify-between mb-3 px-3 py-2 rounded-lg ${
        hasReachedLimit
          ? isDark ? 'bg-amber-900/30' : 'bg-amber-50'
          : isDark ? 'bg-gray-800' : 'bg-gray-100'
      }`}>
        <Text className={`text-sm ${
          hasReachedLimit
            ? isDark ? 'text-amber-400' : 'text-amber-700'
            : isDark ? 'text-gray-400' : 'text-gray-600'
        }`}>
          {hasReachedLimit
            ? 'Limit reached! Tap a subreddit to unselect it.'
            : 'Choose which subreddits to monitor for leads'}
        </Text>
        <View className={`px-2 py-1 rounded-full ${
          hasReachedLimit
            ? isDark ? 'bg-amber-600' : 'bg-amber-500'
            : isDark ? 'bg-blue-600' : 'bg-blue-500'
        }`}>
          <Text className="text-white text-xs font-bold">
            {selectedSubreddits.length}/{subredditLimit}
          </Text>
        </View>
      </View>

      {/* Selected Subreddits Pills */}
      {selectedSubreddits.length > 0 && (
        <View className="flex-row flex-wrap gap-2 mb-4">
          {selectedSubreddits.map(sub => (
            <Pressable
              key={sub}
              onPress={() => removeSubreddit(sub)}
              className={`flex-row items-center px-3 py-1.5 rounded-full ${
                isDark ? 'bg-blue-600' : 'bg-blue-500'
              }`}
            >
              <Text className="text-white text-sm mr-1">r/{sub}</Text>
              <Ionicons name="close" size={14} color="#fff" />
            </Pressable>
          ))}
        </View>
      )}

      {/* Add Custom Subreddit with Autocomplete */}
      <View className="mb-4">
        <View className="flex-row items-center">
          <View
            className={`flex-1 flex-row items-center px-3 py-2 rounded-lg border ${
              hasReachedLimit
                ? isDark ? 'bg-gray-900 border-gray-800 opacity-50' : 'bg-gray-200 border-gray-300 opacity-50'
                : isDark
                  ? 'bg-gray-800 border-gray-700'
                  : 'bg-gray-50 border-gray-300'
            }`}
          >
            <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>r/</Text>
            <TextInput
              value={customSubreddit}
              onChangeText={setCustomSubreddit}
              placeholder={hasReachedLimit ? 'Limit reached' : 'Type to search subreddits...'}
              placeholderTextColor={isDark ? '#666' : '#999'}
              className={`flex-1 ml-1 ${isDark ? 'text-white' : 'text-gray-900'}`}
              onSubmitEditing={addCustomSubreddit}
              returnKeyType="done"
              editable={!hasReachedLimit}
            />
            {isSearchingCustom && (
              <ActivityIndicator size="small" color={isDark ? '#666' : '#999'} />
            )}
          </View>
          <Pressable
            onPress={addCustomSubreddit}
            disabled={!customSubreddit.trim() || hasReachedLimit}
            className={`ml-2 p-3 rounded-lg ${
              customSubreddit.trim() && !hasReachedLimit
                ? isDark ? 'bg-blue-600' : 'bg-blue-500'
                : isDark ? 'bg-gray-800' : 'bg-gray-300'
            }`}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Autocomplete Dropdown */}
        {showCustomResults && customSubredditResults.length > 0 && (
          <View className={`mt-2 rounded-lg border overflow-hidden ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            {customSubredditResults.map((sub, index) => (
              <Pressable
                key={sub.name}
                onPress={() => selectFromAutocomplete(sub.name)}
                className={`flex-row items-center justify-between px-3 py-3 ${
                  index !== customSubredditResults.length - 1
                    ? isDark ? 'border-b border-gray-700' : 'border-b border-gray-100'
                    : ''
                } ${isDark ? 'active:bg-gray-700' : 'active:bg-gray-50'}`}
              >
                <View className="flex-1 mr-3">
                  <Text className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    r/{sub.name}
                  </Text>
                  {sub.description && (
                    <Text
                      className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                      numberOfLines={1}
                    >
                      {sub.description}
                    </Text>
                  )}
                  {sub.subscribers && (
                    <Text className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      {formatSubscriberCount(sub.subscribers)}
                    </Text>
                  )}
                </View>
                <Ionicons name="add-circle" size={24} color={isDark ? '#3B82F6' : '#2563EB'} />
              </Pressable>
            ))}
          </View>
        )}

        {/* No results message */}
        {showCustomResults && !isSearchingCustom && customSubredditResults.length === 0 && customSubreddit.trim().length >= 2 && (
          <View className={`mt-2 p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <Text className={`text-sm text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No subreddits found for "{customSubreddit}"
            </Text>
          </View>
        )}
      </View>

      {/* Search */}
      <View
        className={`flex-row items-center px-3 py-2 mb-4 rounded-lg border ${
          isDark
            ? 'bg-gray-800 border-gray-700'
            : 'bg-gray-50 border-gray-300'
        }`}
      >
        <Ionicons name="search" size={18} color={isDark ? '#666' : '#999'} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search for any subreddit..."
          placeholderTextColor={isDark ? '#666' : '#999'}
          className={`flex-1 ml-2 ${isDark ? 'text-white' : 'text-gray-900'}`}
        />
      </View>

      {/* Subreddits List */}
      <BottomSheetScrollView className="flex-1">
        <View className="flex-row items-center justify-between mb-2">
          <Text className={`text-sm font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {showApiResults ? 'SEARCH RESULTS' : 'POPULAR SUBREDDITS'}
          </Text>
          {isSearching && (
            <ActivityIndicator size="small" color={isDark ? '#666' : '#999'} />
          )}
        </View>
        {displayedSubreddits.length === 0 && !isSearching && searchQuery.length >= 2 ? (
          <View className="items-center justify-center py-8">
            <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No subreddits found for "{searchQuery}"
            </Text>
          </View>
        ) : (
          displayedSubreddits.map(sub => {
            const isSelected = selectedSubreddits.includes(sub.name);
            const isDisabled = !isSelected && hasReachedLimit;
            return (
              <Pressable
                key={sub.name}
                onPress={() => toggleSubreddit(sub.name)}
                className={`flex-row items-center justify-between p-3 mb-2 rounded-lg ${
                  isSelected
                    ? isDark ? 'bg-blue-900/30 border border-blue-600' : 'bg-blue-50 border border-blue-500'
                    : isDisabled
                      ? isDark ? 'bg-gray-900 opacity-50' : 'bg-gray-100 opacity-50'
                      : isDark ? 'bg-gray-800' : 'bg-gray-50'
                }`}
              >
                <View className="flex-1 mr-3">
                  <Text className={`font-semibold mb-0.5 ${
                    isDisabled
                      ? isDark ? 'text-gray-500' : 'text-gray-400'
                      : isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    r/{sub.name}
                  </Text>
                  <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {sub.description}
                  </Text>
                  {sub.subscribers && (
                    <Text className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      {formatSubscriberCount(sub.subscribers)}
                    </Text>
                  )}
                </View>
                {isSelected ? (
                  <View className="w-5 h-5 bg-blue-500 rounded-full items-center justify-center">
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                ) : isDisabled ? (
                  <Ionicons name="lock-closed" size={16} color={isDark ? '#666' : '#999'} />
                ) : null}
              </Pressable>
            );
          })
        )}
      </BottomSheetScrollView>
    </>
  );

  // Keywords step content
  const renderKeywordsStep = () => (
    <>
      {/* Header info */}
      <View className="items-center mb-4">
        <View className="w-14 h-14 rounded-full bg-purple-500/20 items-center justify-center mb-3">
          <Sparkles size={28} color="#A855F7" />
        </View>
        <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Add Keywords
        </Text>
        <Text className={`text-sm mt-1 text-center px-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Add keywords your agent should look for when searching for leads
        </Text>
      </View>

      {/* Custom keywords restriction banner */}
      {!canUseCustomKeywords && (
        <View className={`flex-row items-center mb-4 px-3 py-3 rounded-lg ${
          isDark ? 'bg-amber-900/30' : 'bg-amber-50'
        }`}>
          <Ionicons name="lock-closed" size={18} color={isDark ? '#F59E0B' : '#D97706'} />
          <View className="flex-1 ml-2">
            <Text className={`text-sm font-medium ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
              Custom keywords require Plus or higher
            </Text>
            <Text className={`text-xs mt-0.5 ${isDark ? 'text-amber-500/80' : 'text-amber-600'}`}>
              Upgrade to add your own keywords
            </Text>
          </View>
        </View>
      )}

      {/* Add Keyword Input */}
      <View className="flex-row items-center mb-4">
        <View
          className={`flex-1 flex-row items-center px-3 py-2 rounded-lg border ${
            !canUseCustomKeywords
              ? isDark ? 'bg-gray-900 border-gray-800 opacity-50' : 'bg-gray-200 border-gray-300 opacity-50'
              : isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-gray-50 border-gray-300'
          }`}
        >
          <TextInput
            value={keywordInput}
            onChangeText={setKeywordInput}
            placeholder={canUseCustomKeywords ? 'Enter a keyword...' : 'Upgrade to Plus to add keywords'}
            placeholderTextColor={isDark ? '#666' : '#999'}
            className={`flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}
            onSubmitEditing={canUseCustomKeywords ? addKeyword : undefined}
            returnKeyType="done"
            editable={canUseCustomKeywords}
          />
        </View>
        <Pressable
          onPress={canUseCustomKeywords ? addKeyword : () => hapticFeedback.warning()}
          disabled={!keywordInput.trim() || !canUseCustomKeywords}
          className={`ml-2 p-3 rounded-lg ${
            keywordInput.trim() && canUseCustomKeywords
              ? isDark ? 'bg-purple-600' : 'bg-purple-500'
              : isDark ? 'bg-gray-800' : 'bg-gray-300'
          }`}
        >
          <Ionicons name={canUseCustomKeywords ? 'add' : 'lock-closed'} size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Keywords Pills */}
      <BottomSheetScrollView className="flex-1">
        {keywords.length > 0 ? (
          <View className="flex-row flex-wrap gap-2 mb-4">
            {keywords.map(keyword => (
              <Pressable
                key={keyword}
                onPress={() => canUseCustomKeywords && removeKeyword(keyword)}
                disabled={!canUseCustomKeywords}
                className={`flex-row items-center px-3 py-2 rounded-full ${
                  isDark ? 'bg-purple-600' : 'bg-purple-500'
                } ${!canUseCustomKeywords ? 'opacity-50' : ''}`}
              >
                <Text className="text-white text-sm mr-2">{keyword}</Text>
                {canUseCustomKeywords && <Ionicons name="close" size={14} color="#fff" />}
              </Pressable>
            ))}
          </View>
        ) : (
          <View className={`items-center justify-center py-8 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-gray-100'}`}>
            <Sparkles size={32} color={isDark ? '#666' : '#999'} />
            <Text className={`text-sm mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              No keywords added yet
            </Text>
            <Text className={`text-xs mt-1 text-center px-8 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              {canUseCustomKeywords
                ? 'Add keywords like "looking for", "need help with", "recommendation", etc.'
                : 'Upgrade to Plus to add custom keywords'}
            </Text>
          </View>
        )}

        {/* Suggested Keywords */}
        <View className="mt-4">
          <Text className={`text-sm font-semibold mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            SUGGESTED KEYWORDS
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {['looking for', 'need help', 'recommendation', 'best tool', 'alternative to', 'how to', 'any suggestions'].map(suggestion => {
              const isAdded = keywords.includes(suggestion);
              const canAdd = canUseCustomKeywords && !isAdded;
              return (
                <Pressable
                  key={suggestion}
                  onPress={() => {
                    if (canAdd) {
                      hapticFeedback.light();
                      setKeywords(prev => [...prev, suggestion]);
                    } else if (!canUseCustomKeywords) {
                      hapticFeedback.warning();
                    }
                  }}
                  disabled={isAdded}
                  className={`px-3 py-2 rounded-full border ${
                    isAdded
                      ? isDark ? 'bg-purple-900/30 border-purple-600' : 'bg-purple-50 border-purple-500'
                      : !canUseCustomKeywords
                        ? isDark ? 'bg-gray-900 border-gray-800 opacity-50' : 'bg-gray-200 border-gray-300 opacity-50'
                        : isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-300'
                  }`}
                >
                  <Text className={`text-sm ${
                    isAdded
                      ? isDark ? 'text-purple-400' : 'text-purple-600'
                      : !canUseCustomKeywords
                        ? isDark ? 'text-gray-600' : 'text-gray-400'
                        : isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    {suggestion}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </BottomSheetScrollView>
    </>
  );

  // Agent config step content
  const renderAgentConfigStep = () => (
    <>
      {/* Header info */}
      <View className="items-center mb-4">
        <View className="w-14 h-14 rounded-full bg-green-500/20 items-center justify-center mb-3">
          <Settings size={28} color="#22C55E" />
        </View>
        <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Configure Agent
        </Text>
        <Text className={`text-sm mt-1 text-center px-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Set how your agent finds and responds to leads
        </Text>
      </View>

      <BottomSheetScrollView className="flex-1">
        {/* Lead Quality Threshold */}
        <View className={`p-4 rounded-xl mb-3 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <View className="flex-row items-center mb-2">
            <Target size={18} color="#22C55E" />
            <Text className={`ml-2 font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Lead Quality Threshold
            </Text>
          </View>
          <Text className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Only engage with posts scoring above this level
          </Text>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={scoreThreshold}
            onValueChange={(value) => setScoreThreshold(Math.round(value))}
            minimumTrackTintColor="#22C55E"
            maximumTrackTintColor={isDark ? '#374151' : '#E5E7EB'}
            thumbTintColor="#22C55E"
          />
          <View className="flex-row justify-between mt-1">
            <Text className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>More Leads</Text>
            <Text className="text-lg font-bold text-green-500">{scoreThreshold}/10</Text>
            <Text className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Higher Quality</Text>
          </View>
        </View>

        {/* Post Freshness */}
        <View className={`p-4 rounded-xl mb-3 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <Text className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Post Freshness
          </Text>
          <Text className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Ignore posts older than...
          </Text>
          <View className="flex-row gap-2">
            {[7, 14, 30].map((days) => (
              <Pressable
                key={days}
                onPress={() => {
                  hapticFeedback.selection();
                  setPostAgeLimitDays(days);
                }}
                className={`flex-1 py-3 rounded-xl items-center justify-center border-2 ${
                  postAgeLimitDays === days
                    ? 'bg-green-500 border-green-500'
                    : isDark
                      ? 'bg-gray-700 border-gray-600'
                      : 'bg-gray-100 border-gray-200'
                }`}
              >
                <Text className={`font-semibold ${
                  postAgeLimitDays === days ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {days} days
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Comment Style */}
        <View className={`p-4 rounded-xl mb-3 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <Text className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Comment Style
          </Text>
          <Text className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            How your agent sounds when replying
          </Text>
          {([
            { key: 'friendly', label: 'Friendly & Casual', icon: '😊', desc: 'Conversational, relatable' },
            { key: 'professional', label: 'Professional', icon: '💼', desc: 'Business-focused, polished' },
            { key: 'expert', label: 'Expert & Technical', icon: '🧠', desc: 'Authoritative, detailed' },
          ] as const).map((style) => {
            const isAllowed = allowedCommentStyles.includes(style.key);
            const isSelected = commentStyle === style.key;
            return (
              <Pressable
                key={style.key}
                onPress={() => {
                  if (isAllowed) {
                    hapticFeedback.selection();
                    setCommentStyle(style.key);
                  } else {
                    hapticFeedback.warning();
                  }
                }}
                className={`flex-row items-center p-3 rounded-xl mb-2 border-2 ${
                  isSelected
                    ? 'border-green-500 bg-green-500/10'
                    : !isAllowed
                      ? isDark ? 'border-gray-800 bg-gray-900 opacity-50' : 'border-gray-300 bg-gray-200 opacity-50'
                      : isDark
                        ? 'border-gray-700 bg-gray-700'
                        : 'border-gray-200 bg-white'
                }`}
              >
                <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                  isSelected ? 'bg-green-500' : !isAllowed ? isDark ? 'bg-gray-800' : 'bg-gray-300' : isDark ? 'bg-gray-600' : 'bg-gray-200'
                }`}>
                  <Text className="text-lg">{style.icon}</Text>
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className={`font-semibold ${
                      isSelected ? 'text-green-500' : !isAllowed ? isDark ? 'text-gray-600' : 'text-gray-400' : isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      {style.label}
                    </Text>
                    {!isAllowed && (
                      <View className={`ml-2 px-2 py-0.5 rounded-full ${isDark ? 'bg-amber-900/50' : 'bg-amber-100'}`}>
                        <Text className={`text-xs font-medium ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Plus+</Text>
                      </View>
                    )}
                  </View>
                  <Text className={`text-xs ${!isAllowed ? isDark ? 'text-gray-700' : 'text-gray-400' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {style.desc}
                  </Text>
                </View>
                {isSelected && (
                  <CheckCircle size={20} color="#22C55E" />
                )}
                {!isAllowed && !isSelected && (
                  <Ionicons name="lock-closed" size={16} color={isDark ? '#666' : '#999'} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Require Approval */}
        <View className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <Text className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Review before posting
              </Text>
              <Text className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Get notified to approve each comment
              </Text>
            </View>
            <Switch
              value={requireApproval}
              onValueChange={(value) => {
                hapticFeedback.selection();
                setRequireApproval(value);
              }}
              trackColor={{ false: '#E5E7EB', true: '#4ADE80' }}
              thumbColor={requireApproval ? '#22C55E' : '#F3F4F6'}
            />
          </View>
        </View>
      </BottomSheetScrollView>
    </>
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={visible ? 0 : -1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }}
      handleIndicatorStyle={{ backgroundColor: isDark ? '#666' : '#ccc' }}
    >
      <View className="flex-1 px-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-2">
          <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {currentStep === 'subreddits' ? 'Select Subreddits' : currentStep === 'keywords' ? 'Add Keywords' : 'Configure Agent'}
          </Text>
          <Pressable onPress={onClose} className="p-2">
            <Ionicons name="close" size={24} color={isDark ? '#fff' : '#000'} />
          </Pressable>
        </View>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Step Content */}
        {currentStep === 'subreddits'
          ? renderSubredditsStep()
          : currentStep === 'keywords'
            ? renderKeywordsStep()
            : renderAgentConfigStep()}

        {/* Navigation Buttons */}
        <View className="flex-row gap-3 pt-4 pb-6">
          {(currentStep === 'keywords' || currentStep === 'agent_config') && (
            <Pressable
              onPress={goToPrevStep}
              className={`flex-1 flex-row items-center justify-center py-4 rounded-xl ${
                isDark ? 'bg-gray-800' : 'bg-gray-100'
              }`}
            >
              <ChevronLeft size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
              <Text className={`font-semibold ml-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Back
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={currentStep === 'agent_config' ? handleSave : goToNextStep}
            disabled={selectedSubreddits.length === 0 || isSaving}
            className={`flex-1 flex-row items-center justify-center py-4 rounded-xl ${
              selectedSubreddits.length === 0 || isSaving
                ? isDark ? 'bg-gray-800' : 'bg-gray-300'
                : currentStep === 'agent_config'
                  ? 'bg-green-500'
                  : isDark ? 'bg-blue-600' : 'bg-blue-500'
            }`}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                {currentStep === 'agent_config' && <Rocket size={20} color="#fff" style={{ marginRight: 8 }} />}
                <Text className="text-white font-bold text-base">
                  {currentStep === 'agent_config' ? 'Start Hunting' : 'Next'}
                </Text>
                {currentStep !== 'agent_config' && (
                  <ChevronRight size={20} color="#fff" style={{ marginLeft: 4 }} />
                )}
              </>
            )}
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
};
