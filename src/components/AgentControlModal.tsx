import React from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hapticFeedback } from '../utils/hapticFeedback';
import type { HuntingSession } from '../state/huntingStore';

interface AgentControlModalProps {
  isVisible: boolean;
  onClose: () => void;
  session: HuntingSession | null;
  onPause: () => Promise<void>;
  onStop: () => Promise<void>;
}

export default function AgentControlModal({
  isVisible,
  onClose,
  session,
  onPause,
  onStop,
}: AgentControlModalProps) {
  if (!isVisible || !session) return null;

  const getTimeSinceStarted = () => {
    const now = new Date();
    const started = new Date(session.startedAt);
    const diffMs = now.getTime() - started.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    }
    return `${diffMinutes}m`;
  };

  return (
    <Modal visible={isVisible} animationType='slide' transparent={true} onRequestClose={onClose}>
      <View className='flex-1 justify-end bg-black/50'>
        <View className='bg-white rounded-t-3xl' style={{ maxHeight: '80%' }}>
          {/* Header */}
          <View className='flex-row items-center justify-between p-4 border-b border-gray-200'>
            <Text className='text-xl font-bold text-gray-900'>Agent Control Center</Text>
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

          <ScrollView className='flex-1'>
            {/* Session Overview */}
            <View className='p-4'>
              <View className='bg-green-50 rounded-xl p-4 mb-4'>
                <View className='flex-row items-center mb-2'>
                  <View className='w-3 h-3 rounded-full bg-green-500 mr-2' />
                  <Text className='text-base font-bold text-gray-900'>
                    {session.status === 'active' ? 'Active Session' : 'Paused Session'}
                  </Text>
                </View>
                <Text className='text-sm text-gray-600'>Running for {getTimeSinceStarted()}</Text>
              </View>

              {/* Performance Stats */}
              <Text className='text-lg font-bold text-gray-900 mb-3'>Performance</Text>
              <View className='bg-gray-50 rounded-xl p-4 mb-4'>
                <View className='flex-row justify-between mb-3'>
                  <View>
                    <Text className='text-xs text-gray-500 mb-1'>Prospects Scanned</Text>
                    <Text className='text-2xl font-bold text-gray-900'>
                      {session.totalProspectsScanned}
                    </Text>
                  </View>
                  <View>
                    <Text className='text-xs text-gray-500 mb-1'>Leads Qualified</Text>
                    <Text className='text-2xl font-bold text-green-600'>
                      {session.qualifiedLeads}
                    </Text>
                  </View>
                </View>

                <View className='flex-row justify-between'>
                  <View>
                    <Text className='text-xs text-gray-500 mb-1'>Conversations</Text>
                    <Text className='text-2xl font-bold text-blue-600'>
                      {session.contactsInitiated}
                    </Text>
                  </View>
                  <View>
                    <Text className='text-xs text-gray-500 mb-1'>Conversion Rate</Text>
                    <Text className='text-2xl font-bold text-purple-600'>
                      {session.conversionRate.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>

              {/* Search Criteria */}
              <Text className='text-lg font-bold text-gray-900 mb-3'>Search Criteria</Text>
              <View className='bg-gray-50 rounded-xl p-4 mb-4'>
                {Array.isArray(session.criteria?.keywords) && session.criteria.keywords.length > 0 && (
                  <View className='mb-3'>
                    <Text className='text-xs font-semibold text-gray-500 mb-2'>Keywords</Text>
                    <View className='flex-row flex-wrap'>
                      {(session.criteria.keywords as string[])
                        .slice(0, 8)
                        .map((keyword: string) => (
                          <View
                            key={keyword}
                            className='bg-blue-100 px-3 py-1 rounded-full mr-2 mb-2'
                          >
                            <Text className='text-xs text-blue-700'>{keyword}</Text>
                          </View>
                        ))}
                    </View>
                  </View>
                )}

                {session.platforms && session.platforms.length > 0 && (
                  <View>
                    <Text className='text-xs font-semibold text-gray-500 mb-2'>Platforms</Text>
                    <View className='flex-row flex-wrap'>
                      {session.platforms.map((platform: string) => (
                        <View
                          key={platform}
                          className='bg-orange-100 px-3 py-1 rounded-full mr-2 mb-2'
                        >
                          <Text className='text-xs text-orange-700 capitalize'>{platform}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View className='p-4 border-t border-gray-200'>
            <Pressable
              onPress={async () => {
                hapticFeedback.medium();
                await onPause();
                onClose();
              }}
              className='bg-yellow-500 rounded-xl py-4 items-center mb-3'
            >
              <Text className='text-white font-semibold text-base'>Pause Agent</Text>
            </Pressable>

            <Pressable
              onPress={async () => {
                hapticFeedback.heavy();
                await onStop();
                onClose();
              }}
              className='bg-red-500 rounded-xl py-4 items-center'
            >
              <Text className='text-white font-semibold text-base'>Stop Completely</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
