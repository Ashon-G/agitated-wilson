import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import useWorkspaceStore from '../state/workspaceStore';
import { useWorkspaceContext } from '../contexts/WorkspaceContext';
import { fontStyles } from '../utils/fonts';
import { useTheme } from '../contexts/ThemeContext';

interface GlobalHeaderProps {
  title: string;
  hideProfileIcon?: boolean;
  showCloseButton?: boolean;
  onClose?: () => void;
  transparent?: boolean;
}

export default function GlobalHeader({ title, hideProfileIcon = false, showCloseButton = false, onClose, transparent = false }: GlobalHeaderProps) {
  const navigation = useNavigation();
  const { currentWorkspace } = useWorkspaceStore();
  const { openWorkspaceDrawer } = useWorkspaceContext();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const getWorkspaceInitials = () => {
    if (!currentWorkspace) return 'WS';
    return currentWorkspace.name.substring(0, 2).toUpperCase();
  };

  const getWorkspaceColor = () => {
    return currentWorkspace?.color || '#22C55E';
  };

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: transparent ? 'rgba(0, 0, 0, 0)' : undefined,
      ...(transparent && {
        position: 'absolute',
        top: insets.top,
        left: 0,
        right: 0,
        zIndex: 100,
      }),
    }}>
      {/* Left - Workspace Avatar */}
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          openWorkspaceDrawer();
        }}
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: getWorkspaceColor(),
        }}
      >
        <Text style={{
          color: '#FFFFFF',
          fontWeight: '600',
          fontSize: 16,
          letterSpacing: -0.5,
        }}>
          {getWorkspaceInitials()}
        </Text>
      </Pressable>

      {/* Center - Title */}
      <Text
        style={{
          ...fontStyles.titleSmall,
          color: transparent
            ? (isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.85)')
            : (isDark ? 'rgba(255, 255, 255, 0.9)' : '#18181B'),
          letterSpacing: -0.3,
        }}
      >
        {title}
      </Text>

      {/* Right - Profile or Close */}
      {showCloseButton ? (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onClose?.();
          }}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: transparent
              ? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)')
              : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#F4F4F5'),
          }}
        >
          <Ionicons name="close" size={18} color={transparent ? (isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)') : (isDark ? 'rgba(255, 255, 255, 0.6)' : '#52525B')} />
        </Pressable>
      ) : !hideProfileIcon ? (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            navigation.navigate('Profile' as never);
          }}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: transparent
              ? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)')
              : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#F4F4F5'),
          }}
        >
          <Ionicons name="person" size={18} color={transparent ? (isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)') : (isDark ? 'rgba(255, 255, 255, 0.6)' : '#52525B')} />
        </Pressable>
      ) : (
        <View style={{ width: 38, height: 38 }} />
      )}
    </View>
  );
}