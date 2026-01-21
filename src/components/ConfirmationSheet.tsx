import React, { useCallback, useMemo, forwardRef, useImperativeHandle, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useBottomSheetContext } from '../contexts/BottomSheetContext';
import * as Haptics from 'expo-haptics';

export interface ConfirmationSheetConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export interface ConfirmationSheetRef {
  show: (config: ConfirmationSheetConfig) => void;
  dismiss: () => void;
}

const ConfirmationSheet = forwardRef<ConfirmationSheetRef>((_props, ref) => {
  const { isDark } = useTheme();
  const { setBottomSheetOpen } = useBottomSheetContext();
  const bottomSheetRef = React.useRef<BottomSheet>(null);
  const [config, setConfig] = React.useState<ConfirmationSheetConfig | null>(null);

  const snapPoints = useMemo(() => ['32%'], []);

  useImperativeHandle(ref, () => ({
    show: (newConfig: ConfirmationSheetConfig) => {
      setConfig(newConfig);
      bottomSheetRef.current?.snapToIndex(0);
      setBottomSheetOpen(true);
      Haptics.selectionAsync();
    },
    dismiss: () => {
      bottomSheetRef.current?.close();
      setBottomSheetOpen(false);
    },
  }));

  const handleConfirm = () => {
    Haptics.selectionAsync();
    config?.onConfirm();
    bottomSheetRef.current?.close();
    setBottomSheetOpen(false);
  };

  const handleCancel = () => {
    Haptics.selectionAsync();
    config?.onCancel?.();
    bottomSheetRef.current?.close();
    setBottomSheetOpen(false);
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
        onPress={() => setBottomSheetOpen(false)}
      />
    ),
    [],
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
      <BottomSheetView className="flex-1 px-6 py-4">
        {/* Icon */}
        <View className="items-center mb-4">
          <View
            className={`w-14 h-14 rounded-full items-center justify-center ${
              config.destructive
                ? 'bg-red-100 dark:bg-red-900/30'
                : 'bg-blue-100 dark:bg-blue-900/30'
            }`}
          >
            <Ionicons
              name={config.destructive ? 'warning' : 'help-circle'}
              size={28}
              color={config.destructive ? '#EF4444' : '#3B82F6'}
            />
          </View>
        </View>

        {/* Title */}
        <Text
          className={`text-xl font-bold text-center mb-2 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          {config.title}
        </Text>

        {/* Message */}
        <Text
          className={`text-base text-center mb-6 ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}
        >
          {config.message}
        </Text>

        {/* Action Buttons */}
        <View className="flex-row gap-3">
          <Pressable
            onPress={handleCancel}
            className={`flex-1 py-3 px-4 rounded-xl border ${
              isDark
                ? 'bg-gray-800 border-gray-600'
                : 'bg-gray-100 border-gray-300'
            }`}
          >
            <Text
              className={`text-center font-semibold text-base ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              {config.cancelText || 'Cancel'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleConfirm}
            className={`flex-1 py-3 px-4 rounded-xl ${
              config.destructive ? 'bg-red-500' : 'bg-blue-500'
            }`}
          >
            <Text className="text-center font-semibold text-base text-white">
              {config.confirmText || 'Confirm'}
            </Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
});

ConfirmationSheet.displayName = 'ConfirmationSheet';

export default ConfirmationSheet;
