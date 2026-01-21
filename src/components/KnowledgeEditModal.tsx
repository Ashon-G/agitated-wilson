import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { KnowledgeItem } from '../types/app';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { safeToLocaleDateString } from '../utils/dateUtils';

interface KnowledgeEditModalProps {
  visible: boolean;
  onClose: () => void;
  item: KnowledgeItem | null;
  onSave: (id: string, updates: Partial<KnowledgeItem>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export default function KnowledgeEditModal({
  visible,
  onClose,
  item,
  onSave,
  onDelete,
}: KnowledgeEditModalProps) {
  const { isDark } = useTheme();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Initialize form with item data
  useEffect(() => {
    if (item) {
      setTitle(item.title || '');
      setContent(item.content || '');
      setIsEditing(false);
    }
  }, [item]);

  if (!item) return null;

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
  const isFromOnboarding = item.metadata?.source === 'onboarding';

  const handleClose = () => {
    Haptics.selectionAsync();
    Keyboard.dismiss();
    setIsEditing(false);
    onClose();
  };

  const handleEdit = () => {
    Haptics.selectionAsync();
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    Haptics.selectionAsync();
    setTitle(item.title || '');
    setContent(item.content || '');
    setIsEditing(false);
    Keyboard.dismiss();
  };

  const handleSave = async () => {
    if (!title.trim()) {
      return;
    }

    try {
      Haptics.selectionAsync();
      setIsSaving(true);

      await onSave(item.id, {
        title: title.trim(),
        content: content.trim(),
      });

      setIsEditing(false);
      handleClose();
    } catch (error) {
      console.error('Failed to save knowledge item:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!onDelete) return;

    Alert.alert(
      'Delete Knowledge',
      'Are you sure you want to delete this knowledge item? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.selectionAsync();
              setIsDeleting(true);

              await onDelete(item.id);
              handleClose();
            } catch (error) {
              console.error('Failed to delete knowledge item:', error);
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <SafeAreaView
          className="flex-1"
          style={{ backgroundColor: isDark ? '#111827' : '#F9FAFB' }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 1)',
              backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            }}
          >
            <Pressable
              onPress={handleClose}
              style={{
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 20,
                backgroundColor: isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(243, 244, 246, 1)',
              }}
            >
              <Ionicons name="close" size={20} color={isDark ? '#D1D5DB' : '#374151'} />
            </Pressable>

            <Text
              style={{
                fontSize: 17,
                fontWeight: '600',
                color: isDark ? '#F9FAFB' : '#1F2937',
              }}
            >
              {isEditing ? 'Edit Knowledge' : 'Knowledge Details'}
            </Text>

            {/* Right header button */}
            {isEditing ? (
              <Pressable
                onPress={handleCancelEdit}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: '#6B7280', fontSize: 15, fontWeight: '500' }}>
                  Cancel
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleEdit}
                style={{
                  width: 40,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 20,
                  backgroundColor: isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(243, 244, 246, 1)',
                }}
              >
                <Ionicons name="pencil" size={18} color={isDark ? '#D1D5DB' : '#374151'} />
              </Pressable>
            )}
          </View>

          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 100 }}
          >
            <View style={{ padding: 20 }}>
              {/* Type Header Card */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: isDark ? 'rgba(31, 41, 55, 0.8)' : '#FFFFFF',
                  marginBottom: 24,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 1)',
                }}
              >
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    backgroundColor: typeConfig.bgColor,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 14,
                  }}
                >
                  <Ionicons name={typeConfig.icon} size={26} color={typeConfig.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        backgroundColor: typeConfig.bgColor,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: typeConfig.color,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        {typeConfig.label}
                      </Text>
                    </View>
                    {isFromOnboarding && (
                      <View
                        style={{
                          backgroundColor: isDark
                            ? 'rgba(139, 92, 246, 0.15)'
                            : 'rgba(139, 92, 246, 0.1)',
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 6,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
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
                  </View>
                  <Text
                    style={{
                      fontSize: 13,
                      color: isDark ? '#6B7280' : '#9CA3AF',
                      marginTop: 6,
                    }}
                  >
                    Created {safeToLocaleDateString(item.createdAt)}
                  </Text>
                </View>
              </View>

              {/* Title Field */}
              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: isDark ? '#9CA3AF' : '#6B7280',
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Title
                </Text>
                {isEditing ? (
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Enter title"
                    placeholderTextColor={isDark ? '#4B5563' : '#9CA3AF'}
                    style={{
                      fontSize: 16,
                      padding: 16,
                      borderRadius: 12,
                      backgroundColor: isDark ? 'rgba(31, 41, 55, 0.8)' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 1)',
                      color: isDark ? '#F9FAFB' : '#1F2937',
                    }}
                    editable={!isSaving}
                  />
                ) : (
                  <View
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      backgroundColor: isDark ? 'rgba(31, 41, 55, 0.8)' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 1)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        color: isDark ? '#F9FAFB' : '#1F2937',
                        lineHeight: 24,
                      }}
                    >
                      {title || 'No title'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Content Field */}
              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: isDark ? '#9CA3AF' : '#6B7280',
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Content
                </Text>
                {isEditing ? (
                  <TextInput
                    value={content}
                    onChangeText={setContent}
                    placeholder="Enter content"
                    placeholderTextColor={isDark ? '#4B5563' : '#9CA3AF'}
                    style={{
                      fontSize: 16,
                      padding: 16,
                      borderRadius: 12,
                      backgroundColor: isDark ? 'rgba(31, 41, 55, 0.8)' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 1)',
                      color: isDark ? '#F9FAFB' : '#1F2937',
                      minHeight: 160,
                      textAlignVertical: 'top',
                    }}
                    multiline
                    numberOfLines={8}
                    editable={!isSaving}
                  />
                ) : (
                  <View
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      backgroundColor: isDark ? 'rgba(31, 41, 55, 0.8)' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 1)',
                      minHeight: 100,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        color: isDark ? '#D1D5DB' : '#374151',
                        lineHeight: 24,
                      }}
                    >
                      {content || 'No content'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Original Question (for onboarding items) */}
              {item.metadata?.questionText && (
                <View style={{ marginBottom: 20 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: isDark ? '#9CA3AF' : '#6B7280',
                      marginBottom: 8,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Original Question
                  </Text>
                  <View
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      backgroundColor: isDark
                        ? 'rgba(139, 92, 246, 0.1)'
                        : 'rgba(139, 92, 246, 0.08)',
                      borderWidth: 1,
                      borderColor: isDark
                        ? 'rgba(139, 92, 246, 0.2)'
                        : 'rgba(139, 92, 246, 0.15)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        color: isDark ? '#C4B5FD' : '#7C3AED',
                        lineHeight: 22,
                      }}
                    >
                      {item.metadata.questionText}
                    </Text>
                  </View>
                </View>
              )}

              {/* Tags */}
              {item.tags && item.tags.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: isDark ? '#9CA3AF' : '#6B7280',
                      marginBottom: 8,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Tags
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {item.tags
                      .filter(
                        tag =>
                          tag !== 'editable' &&
                          tag !== 'onboarding' &&
                          !tag.startsWith('workspace-'),
                      )
                      .map((tag, index) => (
                        <View
                          key={index}
                          style={{
                            backgroundColor: isDark
                              ? 'rgba(55, 65, 81, 0.6)'
                              : 'rgba(243, 244, 246, 1)',
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 8,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 14,
                              color: isDark ? '#D1D5DB' : '#4B5563',
                            }}
                          >
                            #{tag}
                          </Text>
                        </View>
                      ))}
                  </View>
                </View>
              )}

              {/* URL (for webpage items) */}
              {item.url && (
                <View style={{ marginBottom: 20 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: isDark ? '#9CA3AF' : '#6B7280',
                      marginBottom: 8,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Source URL
                  </Text>
                  <View
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      backgroundColor: isDark ? 'rgba(31, 41, 55, 0.8)' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 1)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: '#3B82F6',
                      }}
                      numberOfLines={2}
                    >
                      {item.url}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Bottom Action Bar */}
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: Platform.OS === 'ios' ? 34 : 20,
              backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
              borderTopWidth: 1,
              borderTopColor: isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 1)',
            }}
          >
            {isEditing ? (
              <Pressable
                onPress={handleSave}
                disabled={isSaving || !title.trim()}
                style={{
                  backgroundColor: isSaving || !title.trim() ? '#6B7280' : '#3B82F6',
                  paddingVertical: 16,
                  borderRadius: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600' }}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleDelete}
                disabled={isDeleting || !onDelete}
                style={{
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                  paddingVertical: 16,
                  borderRadius: 14,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={isDeleting ? '#9CA3AF' : '#EF4444'}
                />
                <Text
                  style={{
                    color: isDeleting ? '#9CA3AF' : '#EF4444',
                    fontSize: 17,
                    fontWeight: '600',
                  }}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Knowledge'}
                </Text>
              </Pressable>
            )}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
