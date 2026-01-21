import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KnowledgeItem } from '../types/app';
import ConfirmationSheet, { ConfirmationSheetRef } from './ConfirmationSheet';
import { toastManager } from '../utils/toastManager';

interface BoxUnlinkModalProps {
  isVisible: boolean;
  onClose: () => void;
  onUnlinkSelected: (itemIds: string[]) => Promise<void>;
  boxFiles: KnowledgeItem[];
}

export default function BoxUnlinkModal({
  isVisible,
  onClose,
  onUnlinkSelected,
  boxFiles,
}: BoxUnlinkModalProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isUnlinking, setIsUnlinking] = useState(false);
  const confirmationSheetRef = useRef<ConfirmationSheetRef>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isVisible) {
      setSelectedItems(new Set());
      setSearchQuery('');
    }
  }, [isVisible]);

  const filteredFiles = boxFiles.filter(file => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return file.title.toLowerCase().includes(query) ||
           file.description?.toLowerCase().includes(query);
  });

  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredFiles.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredFiles.map(f => f.id)));
    }
  };

  const handleUnlink = async () => {
    if (selectedItems.size === 0) return;

    confirmationSheetRef.current?.show({
      title: 'Unlink Files',
      message: `Are you sure you want to unlink ${selectedItems.size} file${selectedItems.size !== 1 ? 's' : ''}? The files will remain in your Box account but will no longer be available to your AI agent.`,
      confirmText: 'Unlink',
      cancelText: 'Cancel',
      destructive: true,
      onConfirm: async () => {
        setIsUnlinking(true);
        try {
          await onUnlinkSelected(Array.from(selectedItems));
          toastManager.success('Files unlinked successfully');
          onClose();
        } catch (error) {
          console.error('Failed to unlink files:', error);
          toastManager.error('Failed to unlink some files. Please try again.');
        } finally {
          setIsUnlinking(false);
        }
      },
    });
  };

  if (!isVisible) return null;

  return (
    <View className="absolute inset-0 bg-black/50" style={{ zIndex: 9999 }}>
      <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl" style={{ height: '90%', zIndex: 10000 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
          <Text className="text-xl font-bold text-gray-900">Unlink Box Files</Text>
          <Pressable onPress={onClose} className="w-10 h-10 items-center justify-center">
            <Ionicons name="close" size={24} color="#6B7280" />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View className="px-4 py-3 border-b border-gray-200">
          <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              className="flex-1 ml-3 text-base text-gray-900"
              placeholder="Search files..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="done"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Select All / Deselect All */}
        {filteredFiles.length > 0 && (
          <View className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <Pressable
              onPress={toggleSelectAll}
              className="flex-row items-center"
            >
              <View className={`w-6 h-6 rounded border-2 items-center justify-center mr-3 ${
                selectedItems.size === filteredFiles.length ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
              }`}>
                {selectedItems.size === filteredFiles.length && (
                  <Ionicons name="checkmark" size={16} color="white" />
                )}
              </View>
              <Text className="text-sm font-medium text-gray-700">
                {selectedItems.size === filteredFiles.length ? 'Deselect All' : 'Select All'}
              </Text>
              <Text className="text-sm text-gray-500 ml-2">
                ({filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''})
              </Text>
            </Pressable>
          </View>
        )}

        {/* Selected Count */}
        {selectedItems.size > 0 && (
          <View className="px-4 py-2 bg-blue-50 border-b border-blue-100">
            <Text className="text-sm text-blue-700 font-medium">
              {selectedItems.size} file{selectedItems.size !== 1 ? 's' : ''} selected
            </Text>
          </View>
        )}

        {/* File List */}
        <ScrollView className="flex-1 px-4 py-2">
          {filteredFiles.length === 0 ? (
            <View className="flex-1 items-center justify-center py-20">
              <Ionicons name="folder-open-outline" size={64} color="#D1D5DB" />
              <Text className="text-gray-500 mt-4">
                {searchQuery ? 'No files found' : 'No Box files linked'}
              </Text>
              {searchQuery && (
                <Text className="text-gray-400 text-center text-sm mt-2">
                  Try adjusting your search terms
                </Text>
              )}
            </View>
          ) : (
            filteredFiles.map((file) => {
              const isSelected = selectedItems.has(file.id);

              return (
                <Pressable
                  key={file.id}
                  onPress={() => toggleItemSelection(file.id)}
                  className={`flex-row items-center p-3 mb-2 rounded-xl ${
                    isSelected ? 'bg-blue-50 border-2 border-blue-500' : 'bg-gray-50'
                  }`}
                >
                  {/* Checkbox */}
                  <Pressable
                    onPress={() => toggleItemSelection(file.id)}
                    className="mr-3"
                  >
                    <View className={`w-6 h-6 rounded border-2 items-center justify-center ${
                      isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                    }`}>
                      {isSelected && <Ionicons name="checkmark" size={16} color="white" />}
                    </View>
                  </Pressable>

                  {/* Icon */}
                  <View className="w-10 h-10 rounded-lg items-center justify-center mr-3 bg-blue-100">
                    <Ionicons
                      name="document-text"
                      size={20}
                      color="#3B82F6"
                    />
                  </View>

                  {/* File Info */}
                  <View className="flex-1">
                    <Text className="text-base font-medium text-gray-900" numberOfLines={1}>
                      {file.title}
                    </Text>
                    {file.description && (
                      <Text className="text-xs text-gray-500 mt-1" numberOfLines={1}>
                        {file.description}
                      </Text>
                    )}
                  </View>

                  {/* Box indicator */}
                  <View className="bg-blue-100 px-2 py-1 rounded">
                    <Text className="text-xs text-blue-700 font-medium">Box</Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        {/* Footer Actions */}
        <View className="p-4 border-t border-gray-200 bg-white">
          <View className="flex-row space-x-3">
            <Pressable
              onPress={onClose}
              className="flex-1 bg-gray-100 rounded-xl py-4 items-center"
              disabled={isUnlinking}
            >
              <Text className="text-gray-700 font-semibold">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleUnlink}
              disabled={selectedItems.size === 0 || isUnlinking}
              className={`flex-1 rounded-xl py-4 items-center ${
                selectedItems.size > 0 && !isUnlinking ? 'bg-red-500' : 'bg-gray-300'
              }`}
            >
              <Text className="text-white font-semibold">
                {isUnlinking ? 'Unlinking...' : `Unlink (${selectedItems.size})`}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Confirmation Sheet */}
      <ConfirmationSheet ref={confirmationSheetRef} />
    </View>
  );
}
