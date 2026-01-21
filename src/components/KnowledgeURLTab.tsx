import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import URLProcessingService from '../services/URLProcessingService';
import { URLPreview } from '../types/knowledge';
import { cn } from '../utils/cn';

interface KnowledgeURLTabProps {
  onURLSelected: (url: string, preview: URLPreview) => void;
  isProcessing?: boolean;
  userId?: string;
}

export const KnowledgeURLTab: React.FC<KnowledgeURLTabProps> = ({
  onURLSelected,
  isProcessing = false,
  userId,
}) => {
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<URLPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [urlError, setUrlError] = useState('');

  const validateURL = (inputUrl: string): boolean => {
    try {
      new URL(inputUrl);
      return true;
    } catch {
      // Try adding https:// if it's missing
      try {
        new URL(`https://${inputUrl}`);
        return true;
      } catch {
        return false;
      }
    }
  };

  const loadPreview = async (inputUrl: string) => {
    if (!validateURL(inputUrl)) {
      setUrlError('Please enter a valid URL');
      setPreview(null);
      return;
    }

    setUrlError('');
    setIsLoadingPreview(true);

    try {
      // Ensure URL has protocol
      let normalizedUrl = inputUrl;
      if (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://')) {
        normalizedUrl = `https://${inputUrl}`;
      }

      const urlPreview = await URLProcessingService.processURL(normalizedUrl, userId);
      setPreview(urlPreview);
    } catch (error) {
      console.error('Preview error:', error);
      setPreview({
        url: inputUrl,
        status: 'error',
        error: 'Failed to load preview',
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (url.trim() && url.length > 10) {
        loadPreview(url.trim());
      } else {
        setPreview(null);
        setUrlError('');
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [url]);

  const handleAddURL = () => {
    if (!preview || preview.status === 'error') return;

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    onURLSelected(normalizedUrl, preview);
  };

  const canAddURL = preview && preview.status === 'loaded' && !isProcessing;

  return (
    <View className="flex-1 p-6">
      {/* URL Input */}
      <View className="mb-6">
        <Text className="text-sm font-medium text-gray-700 mb-2">
          Website URL
        </Text>
        <View className="relative">
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="Enter website URL (e.g., example.com)"
            className={cn(
              'border border-gray-300 rounded-lg px-4 py-3 pr-12 text-base',
              urlError && 'border-red-500',
              preview && preview.status === 'loaded' && 'border-green-500',
            )}
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!isProcessing}
          />
          {isLoadingPreview && (
            <View className="absolute right-3 top-3">
              <ActivityIndicator size="small" color="#22C55E" />
            </View>
          )}
          {preview && preview.status === 'loaded' && (
            <Ionicons
              name="checkmark-circle"
              size={20}
              color="#10B981"
              style={{
                position: 'absolute',
                right: 12,
                top: 12,
              }}
            />
          )}
        </View>
        {urlError && (
          <Text className="text-red-500 text-sm mt-1">{urlError}</Text>
        )}
      </View>

      {/* URL Preview */}
      {preview && (
        <View className="mb-6">
          {preview.status === 'loaded' ? (
            <View className="border border-gray-200 rounded-lg p-4 bg-white">
              <View className="flex-row">
                {preview.image && (
                  <Image
                    source={{ uri: preview.image }}
                    className="w-16 h-16 rounded-lg mr-3"
                    resizeMode="cover"
                  />
                )}
                <View className="flex-1">
                  {preview.title && (
                    <Text className="text-base font-medium text-gray-900 mb-1" numberOfLines={2}>
                      {preview.title}
                    </Text>
                  )}
                  {preview.description && (
                    <Text className="text-sm text-gray-600 mb-2" numberOfLines={3}>
                      {preview.description}
                    </Text>
                  )}
                  <View className="flex-row items-center">
                    {preview.favicon && (
                      <Image
                        source={{ uri: preview.favicon }}
                        className="w-4 h-4 rounded mr-2"
                      />
                    )}
                    <Text className="text-xs text-gray-500" numberOfLines={1}>
                      {preview.url}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ) : preview.status === 'error' ? (
            <View className="border border-red-200 rounded-lg p-4 bg-red-50">
              <View className="flex-row items-center">
                <Ionicons name="warning" size={20} color="#EF4444" />
                <Text className="text-red-700 ml-2 flex-1">
                  {preview.error || 'Failed to load preview'}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      )}

      {/* Add URL Button */}
      <Pressable
        onPress={handleAddURL}
        disabled={!canAddURL}
        className={cn(
          'bg-green-600 px-6 py-3 rounded-lg items-center justify-center',
          !canAddURL && 'bg-gray-300',
        )}
      >
        {isProcessing ? (
          <View className="flex-row items-center">
            <ActivityIndicator size="small" color="white" />
            <Text className="text-white font-medium ml-2">Processing...</Text>
          </View>
        ) : (
          <Text className="text-white font-medium">Add Website</Text>
        )}
      </Pressable>

      {/* Tips */}
      <View className="mt-6 bg-blue-50 p-4 rounded-lg">
        <View className="flex-row items-start">
          <Ionicons
            name="information-circle"
            size={20}
            color="#3B82F6"
            style={{ marginRight: 8, marginTop: 1 }}
          />
          <View className="flex-1">
            <Text className="text-sm font-medium text-blue-900 mb-1">
              Supported content
            </Text>
            <Text className="text-sm text-blue-700">
              • Articles and blog posts{'\n'}
              • Documentation pages{'\n'}
              • News articles{'\n'}
              • Public web pages
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};