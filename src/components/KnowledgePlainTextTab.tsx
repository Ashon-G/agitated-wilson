import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cn } from '../utils/cn';
import { toastManager } from '../utils/toastManager';

interface KnowledgePlainTextTabProps {
  onTextSubmitted: (title: string, content: string, tags: string[]) => void;
  isProcessing?: boolean;
}

export const KnowledgePlainTextTab: React.FC<KnowledgePlainTextTabProps> = ({
  onTextSubmitted,
  isProcessing = false,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');

  const handleSubmit = () => {
    if (!title.trim()) {
      toastManager.error('Please enter a title for your content.');
      return;
    }

    if (!content.trim()) {
      toastManager.error('Please enter some content.');
      return;
    }

    // Parse tags
    const parsedTags = tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    onTextSubmitted(title.trim(), content.trim(), parsedTags);
  };

  const canSubmit = title.trim() && content.trim() && !isProcessing;
  const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
      {/* Title Input */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-gray-700 mb-2">
          Title <Text className="text-red-500">*</Text>
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Enter a descriptive title..."
          className="border border-gray-300 rounded-lg px-4 py-3 text-base"
          placeholderTextColor="#9CA3AF"
          maxLength={100}
          editable={!isProcessing}
        />
        <Text className="text-xs text-gray-500 mt-1">
          {title.length}/100 characters
        </Text>
      </View>

      {/* Content Input */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-gray-700 mb-2">
          Content <Text className="text-red-500">*</Text>
        </Text>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Enter your content here... This could be notes, documentation, procedures, or any text you want to add to your knowledge base."
          className="border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[200px]"
          placeholderTextColor="#9CA3AF"
          multiline
          textAlignVertical="top"
          scrollEnabled={false}
          editable={!isProcessing}
        />
        <View className="flex-row justify-between items-center mt-1">
          <Text className="text-xs text-gray-500">
            {wordCount} words
          </Text>
          {wordCount > 0 && (
            <Text className="text-xs text-gray-500">
              ~{Math.ceil(wordCount / 250)} min read
            </Text>
          )}
        </View>
      </View>

      {/* Tags Input */}
      <View className="mb-6">
        <Text className="text-sm font-medium text-gray-700 mb-2">
          Tags (Optional)
        </Text>
        <TextInput
          value={tags}
          onChangeText={setTags}
          placeholder="Enter tags separated by commas (e.g., documentation, process, guide)"
          className="border border-gray-300 rounded-lg px-4 py-3 text-base"
          placeholderTextColor="#9CA3AF"
          editable={!isProcessing}
        />
        <Text className="text-xs text-gray-500 mt-1">
          Use tags to categorize and organize your content
        </Text>
      </View>

      {/* Submit Button */}
      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        className={cn(
          'bg-green-600 px-6 py-3 rounded-lg items-center justify-center mb-4',
          !canSubmit && 'bg-gray-300',
        )}
      >
        <Text className="text-white font-medium">
          {isProcessing ? 'Adding Content...' : 'Add to Knowledge Base'}
        </Text>
      </Pressable>

      {/* Format Guide */}
      <View className="bg-green-50 p-4 rounded-lg">
        <View className="flex-row items-start">
          <Ionicons
            name="bulb"
            size={20}
            color="#10B981"
            style={{ marginRight: 8, marginTop: 1 }}
          />
          <View className="flex-1">
            <Text className="text-sm font-medium text-green-900 mb-2">
              Formatting Tips
            </Text>
            <View className="space-y-1">
              <Text className="text-sm text-green-700">
                • Use clear, descriptive titles
              </Text>
              <Text className="text-sm text-green-700">
                • Break content into paragraphs for readability
              </Text>
              <Text className="text-sm text-green-700">
                • Add relevant tags for easy searching
              </Text>
              <Text className="text-sm text-green-700">
                • Include context and background information
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Content Examples */}
      <View className="mt-4 bg-blue-50 p-4 rounded-lg">
        <View className="flex-row items-start">
          <Ionicons
            name="document-text"
            size={20}
            color="#3B82F6"
            style={{ marginRight: 8, marginTop: 1 }}
          />
          <View className="flex-1">
            <Text className="text-sm font-medium text-blue-900 mb-2">
              What to add
            </Text>
            <View className="space-y-1">
              <Text className="text-sm text-blue-700">
                • Meeting notes and decisions
              </Text>
              <Text className="text-sm text-blue-700">
                • Process documentation
              </Text>
              <Text className="text-sm text-blue-700">
                • Research findings
              </Text>
              <Text className="text-sm text-blue-700">
                • Best practices and guidelines
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};