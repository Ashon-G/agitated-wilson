import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ToastConfig } from '../utils/toastManager';
import { useTheme } from '../contexts/ThemeContext';

interface ToastProps {
  toast: ToastConfig;
  onDismiss: (id: string) => void;
}

export default function Toast({ toast, onDismiss }: ToastProps) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Enter animation
    translateY.value = withSpring(0, {
      damping: 15,
      stiffness: 150,
    });
    opacity.value = withTiming(1, { duration: 200 });

    // Auto-dismiss if duration is set
    if (toast.duration) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, toast.duration);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    translateY.value = withTiming(-100, { duration: 200 });
    opacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(onDismiss)(toast.id);
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const getBackgroundColor = () => {
    if (isDark) {
      switch (toast.type) {
        case 'success':
          return 'bg-green-900/95';
        case 'error':
          return 'bg-red-900/95';
        case 'warning':
          return 'bg-amber-900/95';
        case 'info':
        default:
          return 'bg-gray-800/95';
      }
    } else {
      switch (toast.type) {
        case 'success':
          return 'bg-green-50';
        case 'error':
          return 'bg-red-50';
        case 'warning':
          return 'bg-amber-50';
        case 'info':
        default:
          return 'bg-white';
      }
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-green-500';
      case 'error':
        return 'border-red-500';
      case 'warning':
        return 'border-amber-500';
      case 'info':
      default:
        return isDark ? 'border-gray-600' : 'border-gray-300';
    }
  };

  const getIconName = (): keyof typeof Ionicons.glyphMap => {
    switch (toast.type) {
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'alert-circle';
      case 'warning':
        return 'warning';
      case 'info':
      default:
        return 'information-circle';
    }
  };

  const getIconColor = () => {
    switch (toast.type) {
      case 'success':
        return '#22c55e';
      case 'error':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'info':
      default:
        return isDark ? '#9ca3af' : '#6b7280';
    }
  };

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          position: 'absolute',
          top: insets.top + 8,
          left: 16,
          right: 16,
          zIndex: 9999,
        },
      ]}
    >
      <View
        className={`${getBackgroundColor()} ${getBorderColor()} border-l-4 rounded-xl px-4 py-3 flex-row items-center shadow-lg`}
      >
        <Ionicons
          name={getIconName()}
          size={24}
          color={getIconColor()}
          style={{ marginRight: 12 }}
        />

        <View className='flex-1 mr-2'>
          <Text
            className={`text-base font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}
            numberOfLines={3}
          >
            {toast.message}
          </Text>
        </View>

        {toast.action && (
          <Pressable
            onPress={() => {
              toast.action?.onPress();
              handleDismiss();
            }}
            className='ml-2'
          >
            <Text className='text-blue-500 font-semibold text-sm'>{toast.action.label}</Text>
          </Pressable>
        )}

        <Pressable onPress={handleDismiss} className='ml-2' hitSlop={8}>
          <Ionicons name='close' size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
