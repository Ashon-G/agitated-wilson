import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Modal, Pressable, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useWorkspaceStore from '../state/workspaceStore';

interface NewWorkspaceModalProps {
  visible: boolean;
  onClose: () => void;
}

const WORKSPACE_COLORS = [
  '#22C55E', // Green
  '#F59E0B', // Yellow/Orange
  '#EC4899', // Pink
  '#10B981', // Teal/Emerald
  '#3B82F6', // Blue
  '#7DD3FC', // Light Blue (sky-300)
];

const WORKSPACE_TYPES = [
  {
    id: 'personal',
    title: 'Personal Workspace',
    description: 'Workspace only for you.',
    icon: 'person',
  },
  {
    id: 'team',
    title: 'Team Workspace',
    description: 'Share it with your team!',
    icon: 'people',
  },
];

export default function NewWorkspaceModal({ visible, onClose }: NewWorkspaceModalProps) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(WORKSPACE_COLORS[0]);
  const [selectedType, setSelectedType] = useState('personal');
  const { addWorkspace } = useWorkspaceStore();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      // Delay focus to ensure modal is fully rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleCreate = () => {
    if (!name.trim()) return;

    addWorkspace({
      name: name.trim(),
      description: selectedType === 'personal' ? 'Personal workspace' : 'Team workspace',
      stats: { files: 0, media: 0, snippets: 0, webpages: 0 },
      color: selectedColor,
    });

    // Reset form
    setName('');
    setSelectedColor(WORKSPACE_COLORS[0]);
    setSelectedType('personal');
    onClose();
  };

  const handleClose = () => {
    // Reset form on close
    setName('');
    setSelectedColor(WORKSPACE_COLORS[0]);
    setSelectedType('personal');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center px-4 py-4 border-b border-gray-100">
          <Pressable
            onPress={handleClose}
            className="w-10 h-10 items-center justify-center mr-3"
          >
            <Ionicons name="chevron-back" size={24} color="#374151" />
          </Pressable>
          <Text className="text-lg font-semibold text-gray-900">New Workspace</Text>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="px-4 py-6">
            {/* Name Input */}
            <View className="mb-8">
              <Text className="text-sm font-medium text-gray-700 mb-3">Name</Text>
              <TextInput
                ref={inputRef}
                className="bg-gray-50 rounded-2xl px-4 py-4 text-base text-gray-900 border border-gray-200"
                placeholder="Enter workspace name"
                placeholderTextColor="#9CA3AF"
                value={name}
                onChangeText={setName}
                editable={true}
                keyboardType="default"
                returnKeyType="done"
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="off"
              />
            </View>

            {/* Color Selection */}
            <View className="mb-8">
              <Text className="text-sm font-medium text-gray-900 mb-4">Color</Text>
              <View className="flex-row space-x-4">
                {WORKSPACE_COLORS.map((color) => (
                  <Pressable
                    key={color}
                    onPress={() => setSelectedColor(color)}
                    className="w-12 h-12 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: color,
                      borderWidth: selectedColor === color ? 3 : 0,
                      borderColor: 'white',
                      shadowColor: selectedColor === color ? color : 'transparent',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.5,
                      shadowRadius: 8,
                      elevation: selectedColor === color ? 8 : 0,
                    }}
                  >
                    {selectedColor === color && (
                      <Ionicons name="checkmark" size={20} color="white" />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Type Selection */}
            <View className="mb-8">
              <Text className="text-sm font-medium text-gray-900 mb-4">Type</Text>
              <View className="space-y-3">
                {WORKSPACE_TYPES.map((type) => (
                  <Pressable
                    key={type.id}
                    onPress={() => setSelectedType(type.id)}
                    className="flex-row items-center p-4 rounded-2xl border"
                    style={{
                      backgroundColor: selectedType === type.id ? '#F3F4F6' : 'white',
                      borderColor: selectedType === type.id ? '#22C55E' : '#E5E7EB',
                      borderWidth: selectedType === type.id ? 2 : 1,
                    }}
                  >
                    <View className="w-12 h-12 bg-gray-100 rounded-xl items-center justify-center mr-4">
                      <Text className="text-lg font-bold" style={{ color: selectedColor }}>
                        {type.id === 'personal' ? 'AD' : 'AD'}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-gray-900">
                        {type.title}
                      </Text>
                      <Text className="text-sm text-gray-600 mt-1">
                        {type.description}
                      </Text>
                    </View>
                    <View className="w-6 h-6 rounded-full border-2 items-center justify-center"
                      style={{
                        borderColor: selectedType === type.id ? '#22C55E' : '#D1D5DB',
                        backgroundColor: selectedType === type.id ? '#22C55E' : 'transparent',
                      }}
                    >
                      {selectedType === type.id && (
                        <Ionicons name="checkmark" size={12} color="white" />
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Create Button */}
        <View className="px-4 pb-6 pt-4 border-t border-gray-100">
          <Pressable
            onPress={handleCreate}
            disabled={!name.trim()}
            className="rounded-2xl py-4 items-center"
            style={{
              backgroundColor: name.trim() ? '#3B82F6' : '#E5E7EB',
            }}
          >
            <Text
              className="text-base font-semibold"
              style={{ color: name.trim() ? 'white' : '#9CA3AF' }}
            >
              Create
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}