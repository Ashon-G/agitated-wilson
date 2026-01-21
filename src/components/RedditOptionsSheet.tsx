import React, { useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Settings, PlayCircle, LogOut, Users, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useBottomSheetContext } from '../contexts/BottomSheetContext';
import { hapticFeedback } from '../utils/hapticFeedback';

export interface RedditOptionsSheetConfig {
  username: string;
  isHunting: boolean;
  onStartHunting: () => void;
  onViewInbox: () => void;
  onOpenSettings: () => void;
  onManageSubreddits: () => void;
  onDisconnect: () => void;
  isDisconnecting?: boolean;
}

export interface RedditOptionsSheetRef {
  show: (config: RedditOptionsSheetConfig) => void;
  dismiss: () => void;
}

interface OptionItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onPress: () => void;
  isDark: boolean;
  destructive?: boolean;
  isLoading?: boolean;
}

function OptionItem({ icon, title, description, onPress, isDark, destructive = false, isLoading = false }: OptionItemProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={isLoading}
      className={`flex-row items-center p-4 rounded-2xl mb-2 ${
        isDark ? 'bg-gray-800' : 'bg-gray-50'
      } ${destructive ? 'border border-red-500/30' : ''}`}
    >
      <View
        className={`w-11 h-11 rounded-full items-center justify-center mr-4 ${
          destructive
            ? 'bg-red-500/20'
            : isDark
              ? 'bg-gray-700'
              : 'bg-white'
        }`}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={destructive ? '#EF4444' : isDark ? '#9CA3AF' : '#6B7280'} />
        ) : (
          icon
        )}
      </View>
      <View className="flex-1">
        <Text
          className={`text-base font-semibold mb-0.5 ${
            destructive ? 'text-red-500' : isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          {title}
        </Text>
        <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {description}
        </Text>
      </View>
      <ChevronRight size={20} color={isDark ? '#6B7280' : '#9CA3AF'} />
    </Pressable>
  );
}

const RedditOptionsSheet = forwardRef<RedditOptionsSheetRef>((_props, ref) => {
  const { isDark } = useTheme();
  const { setBottomSheetOpen } = useBottomSheetContext();
  const bottomSheetRef = React.useRef<BottomSheet>(null);
  const [config, setConfig] = React.useState<RedditOptionsSheetConfig | null>(null);

  const snapPoints = useMemo(() => ['65%'], []);

  useImperativeHandle(ref, () => ({
    show: (newConfig: RedditOptionsSheetConfig) => {
      setConfig(newConfig);
      bottomSheetRef.current?.snapToIndex(0);
      setBottomSheetOpen(true);
      hapticFeedback.light();
    },
    dismiss: () => {
      bottomSheetRef.current?.close();
      setBottomSheetOpen(false);
    },
  }));

  const handleClose = useCallback(() => {
    bottomSheetRef.current?.close();
    setBottomSheetOpen(false);
  }, [setBottomSheetOpen]);

  const handleOptionPress = useCallback((action: () => void) => {
    hapticFeedback.selection();
    // Execute the action immediately, then close the sheet
    // This prevents touch-through issues where closing the sheet first
    // could cause taps to fall through to the chat button below
    action();
    // Close the sheet after a brief delay to allow navigation to start
    setTimeout(() => handleClose(), 100);
  }, [handleClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
        onPress={() => {
          setBottomSheetOpen(false);
        }}
      />
    ),
    [setBottomSheetOpen],
  );

  if (!config) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onClose={() => setBottomSheetOpen(false)}
      backgroundStyle={{
        backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      }}
      handleIndicatorStyle={{
        backgroundColor: isDark ? '#6B7280' : '#D1D5DB',
      }}
    >
      <BottomSheetScrollView className="flex-1 px-6 pb-4">
        {/* Header */}
        <View className="items-center mb-6">
          <View
            className={`w-16 h-16 rounded-full items-center justify-center mb-3 ${
              isDark ? 'bg-[#FF4500]/20' : 'bg-[#FF4500]/10'
            }`}
          >
            <Text className="text-3xl">🔴</Text>
          </View>
          <Text className={`text-xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Reddit Connected
          </Text>
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            u/{config.username}
          </Text>
        </View>

        {/* Options */}
        <View className="mb-4">
          {config.isHunting ? (
            <OptionItem
              icon={<Users size={22} color={isDark ? '#9CA3AF' : '#6B7280'} />}
              title="View Inbox"
              description="Check your pending leads and conversations"
              onPress={() => handleOptionPress(config.onViewInbox)}
              isDark={isDark}
            />
          ) : (
            <OptionItem
              icon={<PlayCircle size={22} color="#10B981" />}
              title="Start Hunting"
              description="Begin searching for new leads"
              onPress={() => handleOptionPress(config.onStartHunting)}
              isDark={isDark}
            />
          )}

          <OptionItem
            icon={<Settings size={22} color={isDark ? '#9CA3AF' : '#6B7280'} />}
            title="Agent Settings"
            description="Configure lead quality, style, and approval"
            onPress={() => handleOptionPress(config.onOpenSettings)}
            isDark={isDark}
          />

          <OptionItem
            icon={<Users size={22} color={isDark ? '#9CA3AF' : '#6B7280'} />}
            title="Manage Subreddits"
            description="Choose which communities to monitor"
            onPress={() => handleOptionPress(config.onManageSubreddits)}
            isDark={isDark}
          />

          <View className="h-4" />

          <OptionItem
            icon={<LogOut size={22} color="#EF4444" />}
            title="Disconnect Reddit"
            description="Remove Reddit account from app"
            onPress={() => {
              hapticFeedback.warning();
              // Execute the action immediately, then close the sheet
              config.onDisconnect();
              setTimeout(() => handleClose(), 100);
            }}
            isDark={isDark}
            destructive
            isLoading={config.isDisconnecting}
          />
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
});

RedditOptionsSheet.displayName = 'RedditOptionsSheet';

export default RedditOptionsSheet;
