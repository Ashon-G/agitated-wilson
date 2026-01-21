import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import FileProcessingService from '../services/FileProcessingService';
import { FileUpload } from '../types/knowledge';
import { cn } from '../utils/cn';
import { toastManager } from '../utils/toastManager';

interface KnowledgeUploadTabProps {
  onFileSelected: (file: FileUpload) => void;
  isUploading?: boolean;
  userId?: string;
}

export const KnowledgeUploadTab: React.FC<KnowledgeUploadTabProps> = ({
  onFileSelected,
  isUploading = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFilePicker = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];

      // Create FileUpload object
      const fileUpload: FileUpload = {
        id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        name: file.name,
        size: file.size || 0,
        type: FileProcessingService.getFileCategory(file.mimeType || ''),
        uri: file.uri,
        mimeType: file.mimeType || 'application/octet-stream',
        uploadProgress: 0,
        status: 'pending',
      };

      // Validate file
      const validation = FileProcessingService.validateFile(fileUpload);

      if (!validation.isValid) {
        toastManager.error(validation.error || 'Please select a valid file');
        return;
      }

      onFileSelected(fileUpload);
    } catch (error) {
      console.error('File picker error:', error);
      toastManager.error('Failed to select file. Please try again.');
    }
  };

  const supportedFormats = [
    { icon: 'document-text', label: 'PDF, DOC, TXT' },
    { icon: 'image', label: 'Images' },
    { icon: 'videocam', label: 'Videos' },
    { icon: 'musical-notes', label: 'Audio' },
  ];

  return (
    <View className="flex-1 p-6">
      {/* Upload Area */}
      <Pressable
        onPress={handleFilePicker}
        disabled={isUploading}
        className={cn(
          'border-2 border-dashed border-gray-300 rounded-lg p-8 items-center justify-center min-h-[200px] mb-6',
          isDragOver && 'border-green-500 bg-green-50',
          isUploading && 'opacity-50',
        )}
      >
        <View className="items-center">
          <Ionicons
            name="cloud-upload-outline"
            size={48}
            color={isUploading ? '#9CA3AF' : '#22C55E'}
          />
          <Text className="text-lg font-medium text-gray-900 mt-4 mb-2">
            {isUploading ? 'Uploading...' : 'Upload Files'}
          </Text>
          <Text className="text-gray-500 text-center">
            Tap to browse files or drag and drop
          </Text>
          {isUploading && (
            <View className="w-full bg-gray-200 rounded-full h-2 mt-4">
              <View className="bg-green-500 h-2 rounded-full w-1/3" />
            </View>
          )}
        </View>
      </Pressable>

      {/* Supported Formats */}
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-3">
          Supported Formats
        </Text>
        <View className="flex-row flex-wrap gap-3">
          {supportedFormats.map((format) => (
            <View
              key={format.label}
              className="flex-row items-center bg-gray-100 px-3 py-2 rounded-lg"
            >
              <Ionicons
                name={format.icon as any}
                size={16}
                color="#6B7280"
                style={{ marginRight: 6 }}
              />
              <Text className="text-sm text-gray-600">{format.label}</Text>
            </View>
          ))}
        </View>
      </View>

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
              Tips for better results
            </Text>
            <Text className="text-sm text-blue-700">
              • Use clear, high-quality files{'\n'}
              • Name files descriptively{'\n'}
              • Maximum file size: 50MB
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};