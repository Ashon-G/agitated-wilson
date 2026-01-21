import React, { useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { FileText, Link, StickyNote, ChevronRight, Trash2 } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { KnowledgeItem as KnowledgeItemType } from '../../types/app';
import { formatRelativeTime } from '../../utils/dateUtils';
import { hapticFeedback } from '../../utils/hapticFeedback';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface MinimalKnowledgeItemProps {
  item: KnowledgeItemType;
  onPress: () => void;
  onDelete: () => void;
  isDark: boolean;
}

export function MinimalKnowledgeItem({
  item,
  onPress,
  onDelete,
  isDark,
}: MinimalKnowledgeItemProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const scale = useSharedValue(1);

  const getIcon = () => {
    switch (item.type) {
      case 'file':
        return <FileText size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />;
      case 'webpage':
        return <Link size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />;
      case 'snippet':
        return <StickyNote size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />;
      default:
        return <FileText size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />;
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const renderRightActions = () => (
    <Pressable
      onPress={() => {
        swipeableRef.current?.close();
        onDelete();
      }}
      style={{
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        borderRadius: 16,
        marginLeft: 8,
      }}
    >
      <Trash2 size={24} color="white" />
    </Pressable>
  );

  return (
    <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} overshootRight={false}>
      <AnimatedPressable
        onPress={() => {
          hapticFeedback.light();
          onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[animatedStyle, { marginBottom: 8 }]}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 16,
            paddingHorizontal: 16,
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
            backgroundColor: isDark ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.9)',
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            {getIcon()}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 16,
                fontWeight: '500',
                color: isDark ? '#F9FAFB' : '#1F2937',
                marginBottom: 2,
              }}
            >
              {item.title}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: isDark ? '#6B7280' : '#9CA3AF',
              }}
            >
              {formatRelativeTime(item.createdAt)}
            </Text>
          </View>
          <ChevronRight size={20} color={isDark ? '#4B5563' : '#D1D5DB'} />
        </View>
      </AnimatedPressable>
    </Swipeable>
  );
}
