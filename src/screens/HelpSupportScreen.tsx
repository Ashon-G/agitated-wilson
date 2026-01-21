import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Search, ChevronLeft, Clock, TrendingUp, BookOpen, Play } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import { hapticFeedback } from '../utils/hapticFeedback';
import { withScreenErrorBoundary } from '../components/ScreenErrorBoundary';
import WispBlogService, { BlogPost, BlogTag } from '../services/WispBlogService';
import FullscreenVideoPlayer from '../components/FullscreenVideoPlayer';
import { VIDEO_IDS, VIDEO_URLS, VideoId } from '../state/videoStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HIGHLIGHT_CARD_SIZE = 80;
const ARTICLE_CARD_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2;

// Story/Highlight thumbnail component (placeholder for videos)
interface HighlightCardProps {
  title: string;
  imageUrl?: string | number; // string for URI, number for require()
  index: number;
  isDark: boolean;
  onPress: () => void;
}

function HighlightCard({ title, imageUrl, index, isDark, onPress }: HighlightCardProps) {
  // Handle both require() (number) and URI (string) image sources
  const imageSource = typeof imageUrl === 'number' ? imageUrl : imageUrl ? { uri: imageUrl } : undefined;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Pressable onPress={onPress} className="items-center mr-4">
        <View
          className={`w-20 h-20 rounded-2xl overflow-hidden border-2 ${
            index === 0 ? 'border-blue-500' : isDark ? 'border-gray-700' : 'border-gray-200'
          }`}
        >
          {imageSource ? (
            <Image source={imageSource} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className={`w-full h-full items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <Play size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </View>
          )}
        </View>
        <Text
          className={`text-xs mt-2 text-center ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
          numberOfLines={1}
          style={{ width: 80 }}
        >
          {title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// Tag filter chip component
interface TagChipProps {
  tag: BlogTag;
  isSelected: boolean;
  isDark: boolean;
  onPress: () => void;
}

function TagChip({ tag, isSelected, isDark, onPress }: TagChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-5 py-2.5 rounded-full mr-2 ${
        isSelected
          ? 'bg-gray-900'
          : isDark
            ? 'bg-gray-800 border border-gray-700'
            : 'bg-white border border-gray-200'
      }`}
      style={
        !isSelected
          ? {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
          }
          : undefined
      }
    >
      <Text
        className={`text-sm font-medium ${
          isSelected ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-700'
        }`}
      >
        {tag.name}
      </Text>
    </Pressable>
  );
}

// Featured article card component
interface ArticleCardProps {
  post: BlogPost;
  index: number;
  isDark: boolean;
  onPress: () => void;
  isFeatured?: boolean;
}

function ArticleCard({ post, index, isDark, onPress, isFeatured = false }: ArticleCardProps) {
  const primaryTag = post.tags?.[0];

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).springify()}
      style={{ width: isFeatured ? ARTICLE_CARD_WIDTH : '100%' }}
    >
      <Pressable onPress={onPress} className={isFeatured ? 'mr-3' : 'mb-4'}>
        {/* Image */}
        <View
          className={`rounded-2xl overflow-hidden mb-3 ${isFeatured ? 'h-40' : 'h-32'}`}
          style={{ backgroundColor: isDark ? '#374151' : '#F3F4F6' }}
        >
          {post.image?.url ? (
            <Image source={{ uri: post.image.url }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="w-full h-full items-center justify-center">
              <BookOpen size={32} color={isDark ? '#6B7280' : '#9CA3AF'} />
            </View>
          )}
          {/* Tag badge */}
          {primaryTag && isFeatured && (
            <View
              className="absolute top-3 right-3 px-3 py-1 rounded-lg"
              style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
            >
              <Text className="text-xs font-semibold text-gray-800">{primaryTag.name.toUpperCase()}</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text
          className={`font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'} ${
            isFeatured ? 'text-base' : 'text-lg'
          }`}
          numberOfLines={2}
        >
          {post.title}
        </Text>

        {/* Description */}
        {post.description && (
          <Text
            className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
            numberOfLines={isFeatured ? 2 : 3}
          >
            {post.description}
          </Text>
        )}

        {/* Meta info */}
        <View className="flex-row items-center">
          <Clock size={12} color={isDark ? '#9CA3AF' : '#6B7280'} />
          <Text className={`text-xs ml-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {post.readingTime ? `${post.readingTime} min` : WispBlogService.formatDate(post.createdAt)}
          </Text>
          {primaryTag && !isFeatured && (
            <>
              <Text className={`mx-2 ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>•</Text>
              <Text className="text-xs text-blue-500 font-medium">{primaryTag.name}</Text>
            </>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// Trending article card (horizontal layout)
interface TrendingCardProps {
  post: BlogPost;
  index: number;
  isDark: boolean;
  onPress: () => void;
}

function TrendingCard({ post, index, isDark, onPress }: TrendingCardProps) {
  const primaryTag = post.tags?.[0];

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).springify()}
      style={{ width: ARTICLE_CARD_WIDTH }}
    >
      <Pressable onPress={onPress} className="mr-3">
        {/* Image */}
        <View
          className="rounded-2xl overflow-hidden mb-3 h-28"
          style={{ backgroundColor: isDark ? '#374151' : '#F3F4F6' }}
        >
          {post.image?.url ? (
            <Image source={{ uri: post.image.url }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="w-full h-full items-center justify-center">
              <BookOpen size={24} color={isDark ? '#6B7280' : '#9CA3AF'} />
            </View>
          )}
        </View>

        {/* Tag */}
        {primaryTag && (
          <Text className="text-xs font-semibold text-orange-500 mb-1">{primaryTag.name.toUpperCase()}</Text>
        )}

        {/* Title */}
        <Text
          className={`font-bold text-sm mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}
          numberOfLines={2}
        >
          {post.title}
        </Text>

        {/* Description */}
        {post.description && (
          <Text
            className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
            numberOfLines={2}
          >
            {post.description}
          </Text>
        )}

        {/* Meta */}
        <View className="flex-row items-center justify-between">
          <Text className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {WispBlogService.formatDate(post.createdAt)}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// Highlight video type
interface HighlightVideo {
  id: string;
  title: string;
  videoId: VideoId | null;
  thumbnailUrl?: string | number; // string for URI, number for require()
}

// Video highlights data
const VIDEO_HIGHLIGHTS: HighlightVideo[] = [
  { id: '1', title: 'Getting Started', videoId: null, thumbnailUrl: undefined },
  { id: '2', title: 'Reddit Setup', videoId: VIDEO_IDS.REDDIT_INTRO, thumbnailUrl: require('../../assets/image-1767313164.png') },
  { id: '3', title: 'Lead Hunting', videoId: null, thumbnailUrl: undefined },
  { id: '4', title: 'Tips & Tricks', videoId: null, thumbnailUrl: undefined },
];

function HelpSupportScreen() {
  const navigation = useNavigation();
  const { isDark } = useTheme();

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [tags, setTags] = useState<BlogTag[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Video player state
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>('');

  const handleHighlightPress = useCallback((highlight: HighlightVideo) => {
    hapticFeedback.light();

    // If highlight has a video, play it
    if (highlight.videoId && VIDEO_URLS[highlight.videoId]) {
      setCurrentVideoUrl(VIDEO_URLS[highlight.videoId]);
      setShowVideoPlayer(true);
    }
  }, []);

  const handleCloseVideo = useCallback(() => {
    setShowVideoPlayer(false);
    setCurrentVideoUrl('');
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [postsData, tagsData] = await Promise.all([
        WispBlogService.getPosts(),
        WispBlogService.getTags(),
      ]);
      setPosts(postsData);
      setTags(tagsData);
    } catch (error) {
      console.error('Error loading help data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData();
  }, [loadData]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const results = await WispBlogService.searchPosts(query);
      setPosts(results);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleTagSelect = useCallback(async (tagSlug: string | null) => {
    hapticFeedback.light();
    setSelectedTag(tagSlug);
    setIsLoading(true);

    try {
      if (tagSlug) {
        const filtered = await WispBlogService.getPosts({ tag: tagSlug });
        setPosts(filtered);
      } else {
        const allPosts = await WispBlogService.getPosts();
        setPosts(allPosts);
      }
    } catch (error) {
      console.error('Error filtering by tag:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleArticlePress = useCallback((post: BlogPost) => {
    hapticFeedback.light();
    // Navigate to article detail screen
    if (post.slug) {
      (navigation as any).navigate('ArticleDetail', { slug: post.slug, post });
    }
  }, [navigation]);

  const handleBack = useCallback(() => {
    hapticFeedback.light();
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  // Split posts for different sections
  const featuredPosts = posts.slice(0, 4);
  const trendingPosts = posts.slice(4, 8);

  const backgroundStyle = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const textStyle = isDark ? 'text-white' : 'text-gray-900';
  const textSecondaryStyle = isDark ? 'text-gray-400' : 'text-gray-600';

  return (
    <SafeAreaView className={`flex-1 ${backgroundStyle}`}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <View className="flex-row items-center">
          <Pressable
            onPress={handleBack}
            className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
            }}
          >
            <ChevronLeft size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
          </Pressable>
          <Text className={`text-sm font-semibold uppercase tracking-wider ${textSecondaryStyle}`}>
            Help & Support
          </Text>
        </View>
        <Pressable
          onPress={() => setSearchQuery('')}
          className={`w-10 h-10 rounded-full items-center justify-center ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}
        >
          <Search size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={isDark ? '#fff' : '#000'} />
        }
      >
        {/* Hero Title */}
        <Animated.View entering={FadeIn.duration(500)} className="px-5 pt-4 pb-6">
          <Text className={`text-3xl font-bold ${textStyle}`}>Find guidance</Text>
          <Text className={`text-3xl font-bold ${textStyle}`}>for your journey</Text>
        </Animated.View>

        {/* Highlights Section (Story-like thumbnails) */}
        <View className="mb-6">
          <Text className={`text-xs font-semibold uppercase tracking-wider px-5 mb-3 ${textSecondaryStyle}`}>
            Highlights
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {VIDEO_HIGHLIGHTS.map((highlight, index) => (
              <HighlightCard
                key={highlight.id}
                title={highlight.title}
                imageUrl={highlight.thumbnailUrl}
                index={index}
                isDark={isDark}
                onPress={() => handleHighlightPress(highlight)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Search Bar */}
        <View className="px-5 mb-4">
          <View
            className={`flex-row items-center px-4 py-3 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 3,
              elevation: 1,
            }}
          >
            <Search size={18} color={isDark ? '#6B7280' : '#9CA3AF'} />
            <TextInput
              value={searchQuery}
              onChangeText={handleSearch}
              placeholder="Search articles..."
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              className={`flex-1 ml-3 text-base ${isDark ? 'text-white' : 'text-gray-900'}`}
            />
            {isSearching && <ActivityIndicator size="small" color={isDark ? '#fff' : '#000'} />}
          </View>
        </View>

        {/* Tag Filters */}
        <View className="mb-6">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            <TagChip
              tag={{ id: 'all', name: 'All', slug: 'all' }}
              isSelected={selectedTag === null}
              isDark={isDark}
              onPress={() => handleTagSelect(null)}
            />
            {tags.map((tag) => (
              <TagChip
                key={tag.id}
                tag={tag}
                isSelected={selectedTag === tag.slug}
                isDark={isDark}
                onPress={() => handleTagSelect(tag.slug)}
              />
            ))}
          </ScrollView>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color={isDark ? '#fff' : '#000'} />
          </View>
        ) : posts.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20 px-5">
            <BookOpen size={48} color={isDark ? '#4B5563' : '#D1D5DB'} />
            <Text className={`text-lg font-semibold mt-4 ${textStyle}`}>No articles found</Text>
            <Text className={`text-sm mt-2 text-center ${textSecondaryStyle}`}>
              {searchQuery ? 'Try a different search term' : 'Check back soon for new content'}
            </Text>
          </View>
        ) : (
          <>
            {/* Featured Articles */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between px-5 mb-4">
                <View className="flex-row items-center">
                  <Text className={`text-lg font-bold ${textStyle}`}>Featured Articles</Text>
                  <View className="w-2 h-2 bg-blue-500 rounded-full ml-2" />
                </View>
                <Pressable onPress={() => handleTagSelect(null)}>
                  <Text className="text-sm font-medium text-blue-500">View All</Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20 }}
              >
                {featuredPosts.map((post, index) => (
                  <ArticleCard
                    key={post.id}
                    post={post}
                    index={index}
                    isDark={isDark}
                    onPress={() => handleArticlePress(post)}
                    isFeatured
                  />
                ))}
              </ScrollView>
            </View>

            {/* Trending Now */}
            {trendingPosts.length > 0 && (
              <View className="mb-8">
                <View className="flex-row items-center px-5 mb-4">
                  <Text className={`text-lg font-bold ${textStyle}`}>Trending Now</Text>
                  <TrendingUp size={18} color="#F97316" className="ml-2" />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 20 }}
                >
                  {trendingPosts.map((post, index) => (
                    <TrendingCard
                      key={post.id}
                      post={post}
                      index={index}
                      isDark={isDark}
                      onPress={() => handleArticlePress(post)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* All Articles List */}
            {posts.length > 8 && (
              <View className="px-5 mb-8">
                <Text className={`text-lg font-bold mb-4 ${textStyle}`}>All Articles</Text>
                {posts.slice(8).map((post, index) => (
                  <ArticleCard
                    key={post.id}
                    post={post}
                    index={index}
                    isDark={isDark}
                    onPress={() => handleArticlePress(post)}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Video Player Modal */}
      <FullscreenVideoPlayer
        videoUrl={currentVideoUrl}
        isVisible={showVideoPlayer}
        onClose={handleCloseVideo}
        isSkippable={true}
      />
    </SafeAreaView>
  );
}

export default withScreenErrorBoundary('HelpSupportScreen', {
  showRetryButton: true,
  maxRetries: 3,
  fallbackMessage: 'Something went wrong with the Help & Support screen.',
})(HelpSupportScreen);
