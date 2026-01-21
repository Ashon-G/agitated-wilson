import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Workspace } from '../types/app';
import { cn } from '../utils/cn';
import { safeToLocaleDateString } from '../utils/dateUtils';
import { fontStyles } from '../utils/fonts';
import { hapticFeedback } from '../utils/hapticFeedback';

interface WorkspaceCardProps {
  workspace: Workspace;
  isSelected?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

export default function WorkspaceCard({
  workspace,
  isSelected = false,
  onPress,
  onLongPress,
}: WorkspaceCardProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className='bg-white rounded-2xl p-4 mb-4 shadow-sm border'
      style={{
        borderColor: isSelected ? workspace.color : '#E5E7EB',
        backgroundColor: isSelected ? `${workspace.color}15` : '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      <View className='flex-row items-center justify-between mb-3'>
        <View className='flex-row items-center flex-1'>
          <View
            className='w-12 h-12 rounded-xl items-center justify-center mr-3'
            style={{ backgroundColor: workspace.color }}
          >
            <Text className='text-white font-bold text-lg'>
              {workspace.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className='flex-1'>
            <Text className='text-gray-900' style={fontStyles.heading}>
              {workspace.name}
            </Text>
            {workspace.description && (
              <Text className='text-sm text-gray-600 mt-1' numberOfLines={1}>
                {workspace.description}
              </Text>
            )}
          </View>
        </View>
        {isSelected && <Ionicons name='checkmark-circle' size={24} color={workspace.color} />}
      </View>

      <View className='flex-row justify-between'>
        <View className='items-center'>
          <Text
            className='text-gray-900'
            style={{
              ...fontStyles.titleMedium,
              fontSize: 22,
            }}
          >
            {workspace.stats.files}
          </Text>
          <Text className='text-xs text-gray-500'>Files</Text>
        </View>
        <View className='items-center'>
          <Text
            className='text-gray-900'
            style={{
              ...fontStyles.titleMedium,
              fontSize: 22,
            }}
          >
            {workspace.stats.media}
          </Text>
          <Text className='text-xs text-gray-500'>Media</Text>
        </View>
        <View className='items-center'>
          <Text
            className='text-gray-900'
            style={{
              ...fontStyles.titleMedium,
              fontSize: 22,
            }}
          >
            {workspace.stats.snippets}
          </Text>
          <Text className='text-xs text-gray-500'>Snippets</Text>
        </View>
        <View className='items-center'>
          <Text
            className='text-gray-900'
            style={{
              ...fontStyles.titleMedium,
              fontSize: 22,
            }}
          >
            {workspace.stats.webpages}
          </Text>
          <Text className='text-xs text-gray-500'>Webpages</Text>
        </View>
      </View>

      <View className='mt-3 pt-3 border-t border-gray-100'>
        <Text className='text-xs text-gray-400'>
          Updated {safeToLocaleDateString(workspace.updatedAt)}
        </Text>
      </View>
    </Pressable>
  );
}
