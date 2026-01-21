import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import { KnowledgeItem as KnowledgeItemType } from '../types/app';
import { safeToLocaleDateString } from '../utils/dateUtils';
import { useTheme } from '../contexts/ThemeContext';
import { hapticFeedback } from '../utils/hapticFeedback';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface KnowledgeItemProps {
  item: KnowledgeItemType;
  onPress: () => void;
  onDelete?: () => void;
}

export default function KnowledgeItem({ item, onPress, onDelete: _onDelete }: KnowledgeItemProps) {
  const { isDark } = useTheme();
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  const getTypeConfig = () => {
    switch (item.type) {
      case 'file':
        return {
          icon: 'document-text' as keyof typeof Ionicons.glyphMap,
          color: '#FF6B6B',
          bgColor: isDark ? 'rgba(255, 107, 107, 0.15)' : 'rgba(255, 107, 107, 0.1)',
          label: 'Document',
        };
      case 'media':
        return {
          icon: 'image' as keyof typeof Ionicons.glyphMap,
          color: '#4ECDC4',
          bgColor: isDark ? 'rgba(78, 205, 196, 0.15)' : 'rgba(78, 205, 196, 0.1)',
          label: 'Media',
        };
      case 'snippet':
        return {
          icon: 'chatbubble-ellipses' as keyof typeof Ionicons.glyphMap,
          color: '#95E1D3',
          bgColor: isDark ? 'rgba(149, 225, 211, 0.15)' : 'rgba(149, 225, 211, 0.1)',
          label: 'Knowledge',
        };
      case 'webpage':
        return {
          icon: 'globe' as keyof typeof Ionicons.glyphMap,
          color: '#74B9FF',
          bgColor: isDark ? 'rgba(116, 185, 255, 0.15)' : 'rgba(116, 185, 255, 0.1)',
          label: 'Webpage',
        };
      default:
        return {
          icon: 'document' as keyof typeof Ionicons.glyphMap,
          color: '#A8A8A8',
          bgColor: isDark ? 'rgba(168, 168, 168, 0.15)' : 'rgba(168, 168, 168, 0.1)',
          label: 'Item',
        };
    }
  };

  const typeConfig = getTypeConfig();

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Get a clean preview of content - only show first line or meaningful text
  const getContentPreview = () => {
    // For onboarding items, show the question text as the main preview
    if (item.metadata?.questionText) {
      return item.metadata.questionText;
    }

    // For snippets/knowledge items, prioritize content
    if (item.content && typeof item.content === 'string') {
      // Clean up and limit content
      const cleanContent = item.content.replace(/\n+/g, ' ').trim();
      if (cleanContent.length > 80) {
        return `${cleanContent.substring(0, 80)  }...`;
      }
      return cleanContent;
    }

    // Fall back to description
    if (item.description) {
      const cleanDesc = item.description.replace(/\n+/g, ' ').trim();
      if (cleanDesc.length > 80) {
        return `${cleanDesc.substring(0, 80)  }...`;
      }
      return cleanDesc;
    }

    return null;
  };

  const contentPreview = getContentPreview();

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      backgroundColor: interpolateColor(
        pressed.value,
        [0, 1],
        isDark
          ? ['rgba(31, 41, 55, 0.8)', 'rgba(55, 65, 81, 0.9)']
          : ['rgba(255, 255, 255, 1)', 'rgba(243, 244, 246, 1)'],
      ),
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
    pressed.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    pressed.value = withSpring(0, { damping: 15, stiffness: 400 });
  };

  const handlePress = () => {
    hapticFeedback.light();
    onPress();
  };

  // Check if this is from onboarding
  const isFromOnboarding = item.metadata?.source === 'onboarding';

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        animatedStyle,
        {
          borderRadius: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(75, 85, 99, 0.5)' : 'rgba(229, 231, 235, 1)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.3 : 0.06,
          shadowRadius: 8,
          elevation: 3,
        },
      ]}
    >
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {/* Type Icon */}
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: typeConfig.bgColor,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Ionicons name={typeConfig.icon} size={22} color={typeConfig.color} />
          </View>

          {/* Content */}
          <View style={{ flex: 1 }}>
            {/* Title */}
            <Text
              numberOfLines={2}
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: isDark ? '#F9FAFB' : '#1F2937',
                lineHeight: 22,
                letterSpacing: -0.3,
              }}
            >
              {item.title}
            </Text>

            {/* Content Preview */}
            {contentPreview && (
              <Text
                numberOfLines={2}
                style={{
                  fontSize: 14,
                  color: isDark ? '#9CA3AF' : '#6B7280',
                  marginTop: 4,
                  lineHeight: 20,
                }}
              >
                {contentPreview}
              </Text>
            )}

            {/* Meta row */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 10,
              flexWrap: 'wrap',
            }}>
              {/* Type badge */}
              <View
                style={{
                  backgroundColor: typeConfig.bgColor,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  marginRight: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: typeConfig.color,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {typeConfig.label}
                </Text>
              </View>

              {/* Onboarding badge */}
              {isFromOnboarding && (
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                    marginRight: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: '#8B5CF6',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Onboarding
                  </Text>
                </View>
              )}

              {/* Date */}
              <Text
                style={{
                  fontSize: 12,
                  color: isDark ? '#6B7280' : '#9CA3AF',
                }}
              >
                {safeToLocaleDateString(item.createdAt)}
              </Text>

              {/* File size if available */}
              {item.fileSize && (
                <>
                  <Text style={{
                    fontSize: 12,
                    color: isDark ? '#4B5563' : '#D1D5DB',
                    marginHorizontal: 6,
                  }}>
                    ·
                  </Text>
                  <Text style={{
                    fontSize: 12,
                    color: isDark ? '#6B7280' : '#9CA3AF',
                  }}>
                    {formatFileSize(item.fileSize)}
                  </Text>
                </>
              )}
            </View>

            {/* Tags - only show first 2 if present */}
            {item.tags && item.tags.length > 0 && (
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                marginTop: 8,
                gap: 6,
              }}>
                {item.tags.filter(tag =>
                  tag !== 'editable' &&
                  tag !== 'onboarding' &&
                  !tag.startsWith('workspace-'),
                ).slice(0, 2).map((tag) => (
                  <View
                    key={tag}
                    style={{
                      backgroundColor: isDark ? 'rgba(55, 65, 81, 0.6)' : 'rgba(243, 244, 246, 1)',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: isDark ? '#9CA3AF' : '#6B7280',
                      }}
                    >
                      #{tag}
                    </Text>
                  </View>
                ))}
                {item.tags.filter(tag =>
                  tag !== 'editable' &&
                  tag !== 'onboarding' &&
                  !tag.startsWith('workspace-'),
                ).length > 2 && (
                  <View
                    style={{
                      backgroundColor: isDark ? 'rgba(55, 65, 81, 0.6)' : 'rgba(243, 244, 246, 1)',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: isDark ? '#9CA3AF' : '#6B7280',
                      }}
                    >
                      +{item.tags.filter(tag =>
                        tag !== 'editable' &&
                        tag !== 'onboarding' &&
                        !tag.startsWith('workspace-'),
                      ).length - 2}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Chevron indicator */}
          <View style={{
            marginLeft: 8,
            justifyContent: 'center',
            height: 44,
          }}>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDark ? '#4B5563' : '#D1D5DB'}
            />
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}
