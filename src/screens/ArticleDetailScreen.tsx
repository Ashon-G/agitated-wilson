import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  Share,
  useWindowDimensions,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ChevronLeft, Clock, Share2, BookOpen, Calendar } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { hapticFeedback } from '../utils/hapticFeedback';
import { withScreenErrorBoundary } from '../components/ScreenErrorBoundary';
import WispBlogService, { BlogPost } from '../services/WispBlogService';
import HTMLRenderer from '../components/HTMLRenderer';

type ArticleDetailParams = {
  ArticleDetail: {
    slug: string;
    post?: BlogPost;
  };
};

function ArticleDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ArticleDetailParams, 'ArticleDetail'>>();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const { slug, post: initialPost } = route.params || {};

  const [post, setPost] = useState<BlogPost | null>(initialPost || null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadArticle = useCallback(async () => {
    if (!slug) {
      setError('No article specified');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log('ArticleDetailScreen: Fetching full article content for slug:', slug);
      const fetchedPost = await WispBlogService.getPostBySlug(slug);
      if (fetchedPost) {
        console.log('ArticleDetailScreen: Got content length:', fetchedPost.content?.length || 0);
        setPost(fetchedPost);
      } else {
        setError('Article not found');
      }
    } catch (err) {
      console.error('Error loading article:', err);
      setError('Failed to load article');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (slug) {
      loadArticle();
    }
  }, [slug, loadArticle]);

  const handleBack = useCallback(() => {
    hapticFeedback.light();
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handleShare = useCallback(async () => {
    if (!post) return;
    hapticFeedback.light();

    try {
      await Share.share({
        title: post.title,
        message: `${post.title}\n\nCheck out this article!`,
      });
    } catch (err) {
      console.error('Error sharing:', err);
    }
  }, [post]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const textStyle = isDark ? 'text-white' : 'text-gray-900';
  const textSecondaryStyle = isDark ? 'text-gray-400' : 'text-gray-600';

  if (isLoading && !post) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#121212' : '#ffffff', paddingTop: insets.top }}>
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={handleBack}
            className="w-10 h-10 rounded-full items-center justify-center bg-black/30"
          >
            <ChevronLeft size={24} color="#fff" />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={isDark ? '#fff' : '#000'} />
          <Text className={`mt-4 ${textSecondaryStyle}`}>Loading article...</Text>
        </View>
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#121212' : '#ffffff', paddingTop: insets.top }}>
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={handleBack}
            className="w-10 h-10 rounded-full items-center justify-center bg-black/30"
          >
            <ChevronLeft size={24} color="#fff" />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-5">
          <BookOpen size={48} color={isDark ? '#4B5563' : '#D1D5DB'} />
          <Text className={`text-lg font-semibold mt-4 ${textStyle}`}>
            {error || 'Article not found'}
          </Text>
          <Pressable
            onPress={loadArticle}
            className="mt-4 px-6 py-3 bg-emerald-500 rounded-full"
          >
            <Text className="text-white font-semibold">Try Again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const primaryTag = post.tags?.[0];
  const imageHeight = 280;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#121212' : '#ffffff' }}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={{ paddingBottom: 100 }}
        bounces={true}
        scrollEventThrottle={16}
      >
        {/* Hero Image with overlaid buttons */}
        <View style={{ height: imageHeight + insets.top }}>
          {post.image?.url ? (
            <Image
              source={{ uri: post.image.url }}
              style={{
                width: width,
                height: imageHeight + insets.top,
                borderBottomLeftRadius: 24,
                borderBottomRightRadius: 24,
              }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: width,
                height: imageHeight + insets.top,
                borderBottomLeftRadius: 24,
                borderBottomRightRadius: 24,
                backgroundColor: isDark ? '#1F2937' : '#E5E7EB',
              }}
              className="items-center justify-center"
            >
              <BookOpen size={64} color={isDark ? '#4B5563' : '#9CA3AF'} />
            </View>
          )}

          {/* Overlay buttons */}
          <View
            className="absolute left-0 right-0 flex-row items-center justify-between px-4"
            style={{ top: insets.top + 8 }}
          >
            <Pressable
              onPress={handleBack}
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            >
              <ChevronLeft size={24} color="#fff" />
            </Pressable>

            <Pressable
              onPress={handleShare}
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            >
              <Share2 size={20} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* Content */}
        <View className="px-5 pt-5">
          {/* Tag */}
          {primaryTag && (
            <View className="flex-row mb-4">
              <View
                className="px-3 py-1.5 rounded-full"
                style={{ backgroundColor: isDark ? 'rgba(52, 211, 153, 0.15)' : 'rgba(16, 185, 129, 0.1)' }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: isDark ? '#34D399' : '#059669' }}
                >
                  {primaryTag.name}
                </Text>
              </View>
            </View>
          )}

          {/* Title */}
          <Text className={`text-[28px] font-bold leading-tight mb-3 ${textStyle}`}>
            {post.title}
          </Text>

          {/* Meta - Date and Reading Time */}
          <View className="flex-row items-center mb-5">
            <View className="flex-row items-center">
              <Calendar size={14} color={isDark ? '#6B7280' : '#9CA3AF'} />
              <Text className={`text-sm ml-1.5 ${textSecondaryStyle}`}>
                {formatDate(post.publishedAt || post.createdAt)}
              </Text>
            </View>
            {post.readingTime && (
              <>
                <Text className={`mx-2 ${textSecondaryStyle}`}>·</Text>
                <View className="flex-row items-center">
                  <Clock size={14} color={isDark ? '#6B7280' : '#9CA3AF'} />
                  <Text className={`text-sm ml-1.5 ${textSecondaryStyle}`}>
                    {post.readingTime} min read
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Description - Styled as italic excerpt */}
          {post.description && (
            <Text
              className={`text-base mb-6 leading-7 italic ${textSecondaryStyle}`}
              style={{ opacity: 0.9 }}
            >
              {post.description}
            </Text>
          )}

          {/* Article Content */}
          <View>
            {isLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator size="small" color={isDark ? '#fff' : '#000'} />
                <Text className={`text-sm mt-2 ${textSecondaryStyle}`}>Loading content...</Text>
              </View>
            ) : post.content ? (
              <HTMLRenderer
                html={post.content}
                isDark={isDark}
                featuredImageUrl={post.image?.url}
              />
            ) : (
              <View className="items-center py-8">
                <BookOpen size={32} color={isDark ? '#4B5563' : '#D1D5DB'} />
                <Text className={`text-base text-center mt-4 ${textSecondaryStyle}`}>
                  No content available for this article.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export default withScreenErrorBoundary('ArticleDetailScreen', {
  showRetryButton: true,
  maxRetries: 3,
  fallbackMessage: 'Something went wrong while loading the article.',
})(ArticleDetailScreen);
