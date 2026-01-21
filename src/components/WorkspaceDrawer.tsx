import React from 'react';
import { View, Text, Modal, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useWorkspaceStore from '../state/workspaceStore';

interface WorkspaceDrawerProps {
  visible: boolean;
  onClose: () => void;
  onOpenNewWorkspace: () => void;
}

export default function WorkspaceDrawer({
  visible,
  onClose,
  onOpenNewWorkspace,
}: WorkspaceDrawerProps) {
  const { workspaces, currentWorkspaceId, setCurrentWorkspace } = useWorkspaceStore();

  const handleWorkspaceSelect = (workspaceId: string) => {
    setCurrentWorkspace(workspaceId);
    onClose();
  };

  const handleAddWorkspace = () => {
    onClose();
    onOpenNewWorkspace();
  };

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
      onRequestClose={onClose}
    >
      <SafeAreaView className='flex-1 bg-white'>
        {/* Header */}
        <View className='flex-row items-center px-4 py-4 border-b border-gray-100'>
          <Pressable onPress={onClose} className='w-10 h-10 items-center justify-center mr-3'>
            <Ionicons name='chevron-back' size={24} color='#374151' />
          </Pressable>
          <Text className='text-lg font-semibold text-gray-900'>My workspaces</Text>
        </View>

        <FlatList
          data={workspaces}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}
          renderItem={({ item: workspace }) => {
            const isSelected = currentWorkspaceId === workspace.id;
            return (
              <Pressable
                onPress={() => handleWorkspaceSelect(workspace.id)}
                className='flex-row items-center justify-between bg-gray-50 rounded-2xl p-4 mb-3'
                style={{
                  backgroundColor: isSelected ? '#F3F4F6' : '#F9FAFB',
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? workspace.color : '#E5E7EB',
                }}
              >
                <View className='flex-row items-center flex-1'>
                  <View
                    className='w-12 h-12 rounded-xl items-center justify-center mr-4'
                    style={{ backgroundColor: workspace.color }}
                  >
                    <Text className='text-white font-bold text-lg'>
                      {workspace.name.substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View className='flex-1'>
                    <Text className='text-base font-semibold text-gray-900'>{workspace.name}</Text>
                    {workspace.description && (
                      <Text className='text-sm text-gray-600 mt-1' numberOfLines={1}>
                        {workspace.description}
                      </Text>
                    )}
                  </View>
                </View>
                <Pressable className='w-8 h-8 items-center justify-center'>
                  <Ionicons name='settings-outline' size={20} color='#9CA3AF' />
                </Pressable>
              </Pressable>
            );
          }}
          ListFooterComponent={
            <Pressable
              onPress={handleAddWorkspace}
              className='flex-row items-center bg-white rounded-2xl p-4 border border-gray-200'
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 2,
              }}
            >
              <View className='w-12 h-12 bg-gray-100 rounded-xl items-center justify-center mr-4'>
                <Ionicons name='add' size={24} color='#6B7280' />
              </View>
              <Text className='text-base font-medium text-gray-900'>Add workspace</Text>
            </Pressable>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}
