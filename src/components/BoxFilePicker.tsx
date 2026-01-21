import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BoxService from '../services/BoxService';
import { toastManager } from '../utils/toastManager';
import { hapticFeedback } from '../utils/hapticFeedback';
import { useBottomSheetContext } from '../contexts/BottomSheetContext';

interface BoxItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  extension?: string;
}

interface BoxFilePickerProps {
  isVisible: boolean;
  onClose: () => void;
  onSyncFiles: (selectedItems: BoxItem[]) => Promise<void>;
  workspaceId: string;
}

export default function BoxFilePicker({
  isVisible,
  onClose,
  onSyncFiles,
  workspaceId,
}: BoxFilePickerProps) {
  const { setBottomSheetOpen } = useBottomSheetContext();
  const [currentFolderId, setCurrentFolderId] = useState<string>('0'); // 0 = root
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([
    { id: '0', name: 'Box' },
  ]);
  const [items, setItems] = useState<BoxItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Notify context when visibility changes
  useEffect(() => {
    setBottomSheetOpen(isVisible);
  }, [isVisible, setBottomSheetOpen]);

  useEffect(() => {
    if (isVisible) {
      loadFolder(currentFolderId);
    }
  }, [isVisible, currentFolderId]);

  const loadFolder = async (folderId: string) => {
    try {
      setIsLoading(true);
      const result = await BoxService.listFiles(folderId);

      const boxItems: BoxItem[] = result.entries.map((file: any) => ({
        id: file.id,
        name: file.name,
        type: file.type as 'file' | 'folder',
        size: file.size,
        extension: file.name.split('.').pop(),
      }));

      setItems(boxItems);
    } catch (error) {
      console.error('Failed to load Box folder:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load folder contents';

      if (errorMessage.includes('No active Box connection')) {
        toastManager.error('Your Box connection has expired. Please reconnect your Box account.');
        onClose();
      } else {
        toastManager.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFolderPress = (folder: BoxItem) => {
    hapticFeedback.light();
    setCurrentFolderId(folder.id);
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbPress = (index: number) => {
    hapticFeedback.light();
    const newPath = folderPath.slice(0, index + 1);
    setFolderPath(newPath);
    setCurrentFolderId(newPath[newPath.length - 1].id);
  };

  const toggleItemSelection = (item: BoxItem) => {
    hapticFeedback.selection();
    const newSelected = new Set(selectedItems);
    if (newSelected.has(item.id)) {
      newSelected.delete(item.id);
    } else {
      newSelected.add(item.id);
    }
    setSelectedItems(newSelected);
  };

  const handleSync = async () => {
    const selected = items.filter(item => selectedItems.has(item.id));
    await onSyncFiles(selected);
    onClose();
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isSupportedFile = (item: BoxItem) => {
    if (item.type === 'folder') return true;
    const supportedExtensions = ['txt', 'md', 'pdf', 'doc', 'docx'];
    return item.extension ? supportedExtensions.includes(item.extension.toLowerCase()) : false;
  };

  if (!isVisible) return null;

  return (
    <View className='absolute inset-0 bg-black/50' style={{ zIndex: 9999 }}>
      <View
        className='absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl'
        style={{ height: '90%', zIndex: 10000 }}
      >
        {/* Header */}
        <View className='flex-row items-center justify-between p-4 border-b border-gray-200'>
          <Text className='text-xl font-bold text-gray-900'>Select Files from Box</Text>
          <Pressable
            onPress={() => {
              hapticFeedback.light();
              onClose();
            }}
            className='w-10 h-10 items-center justify-center'
          >
            <Ionicons name='close' size={24} color='#6B7280' />
          </Pressable>
        </View>

        {/* Breadcrumb Navigation */}
        <View className='px-4 py-3 border-b border-gray-200'>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className='flex-row items-center'>
              {folderPath.map((folder, index) => (
                <View key={folder.id} className='flex-row items-center'>
                  <Pressable onPress={() => handleBreadcrumbPress(index)}>
                    <Text
                      className={`text-sm ${index === folderPath.length - 1 ? 'text-blue-600 font-semibold' : 'text-gray-600'}`}
                    >
                      {folder.name}
                    </Text>
                  </Pressable>
                  {index < folderPath.length - 1 && (
                    <Ionicons
                      name='chevron-forward'
                      size={16}
                      color='#9CA3AF'
                      style={{ marginHorizontal: 8 }}
                    />
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Selected Count */}
        {selectedItems.size > 0 && (
          <View className='px-4 py-2 bg-blue-50 border-b border-blue-100'>
            <Text className='text-sm text-blue-700 font-medium'>
              {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
            </Text>
          </View>
        )}

        {/* File List */}
        <ScrollView className='flex-1 px-4 py-2'>
          {isLoading ? (
            <View className='flex-1 items-center justify-center py-20'>
              <ActivityIndicator size='large' color='#3B82F6' />
              <Text className='text-gray-500 mt-4'>Loading...</Text>
            </View>
          ) : items.length === 0 ? (
            <View className='flex-1 items-center justify-center py-20'>
              <Ionicons name='folder-open-outline' size={64} color='#D1D5DB' />
              <Text className='text-gray-500 mt-4'>This folder is empty</Text>
            </View>
          ) : (
            items.map(item => {
              const isSelected = selectedItems.has(item.id);
              const isSupported = isSupportedFile(item);

              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    if (item.type === 'folder') {
                      handleFolderPress(item);
                    } else if (isSupported) {
                      toggleItemSelection(item);
                    }
                  }}
                  className={`flex-row items-center p-3 mb-2 rounded-xl ${
                    isSelected ? 'bg-blue-50 border-2 border-blue-500' : 'bg-gray-50'
                  } ${!isSupported && item.type === 'file' ? 'opacity-40' : ''}`}
                >
                  {/* Checkbox (for files only) */}
                  {item.type === 'file' && isSupported && (
                    <Pressable onPress={() => toggleItemSelection(item)} className='mr-3'>
                      <View
                        className={`w-6 h-6 rounded border-2 items-center justify-center ${
                          isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                        }`}
                      >
                        {isSelected && <Ionicons name='checkmark' size={16} color='white' />}
                      </View>
                    </Pressable>
                  )}

                  {/* Icon */}
                  <View
                    className={`w-10 h-10 rounded-lg items-center justify-center mr-3 ${
                      item.type === 'folder' ? 'bg-blue-100' : 'bg-green-100'
                    }`}
                  >
                    <Ionicons
                      name={item.type === 'folder' ? 'folder' : 'document-text'}
                      size={20}
                      color={item.type === 'folder' ? '#3B82F6' : '#10B981'}
                    />
                  </View>

                  {/* File/Folder Info */}
                  <View className='flex-1'>
                    <Text className='text-base font-medium text-gray-900' numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View className='flex-row items-center mt-1'>
                      {item.type === 'file' && item.size && (
                        <Text className='text-xs text-gray-500'>{formatFileSize(item.size)}</Text>
                      )}
                      {item.type === 'file' && !isSupported && (
                        <Text className='text-xs text-orange-600 ml-2'>Unsupported format</Text>
                      )}
                    </View>
                  </View>

                  {/* Chevron for folders */}
                  {item.type === 'folder' && (
                    <Ionicons name='chevron-forward' size={20} color='#9CA3AF' />
                  )}
                </Pressable>
              );
            })
          )}
        </ScrollView>

        {/* Footer Actions */}
        <View className='p-4 border-t border-gray-200 bg-white'>
          <View className='flex-row space-x-3'>
            <Pressable
              onPress={onClose}
              className='flex-1 bg-gray-100 rounded-xl py-4 items-center'
            >
              <Text className='text-gray-700 font-semibold'>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSync}
              disabled={selectedItems.size === 0}
              className={`flex-1 rounded-xl py-4 items-center ${
                selectedItems.size > 0 ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            >
              <Text className='text-white font-semibold'>Sync ({selectedItems.size})</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
