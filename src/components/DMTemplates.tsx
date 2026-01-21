/**
 * DMTemplates - Quick tap-to-select DM templates for leads
 *
 * Provides pre-written message templates that users can select with one tap
 * instead of typing messages manually.
 */

import React, { memo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { MessageSquare, Sparkles, HelpCircle, Handshake, Zap } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import { GLASS } from '../utils/colors';
import { hapticFeedback } from '../utils/hapticFeedback';

export interface DMTemplate {
  id: string;
  label: string;
  icon: 'intro' | 'help' | 'offer' | 'connect' | 'ai';
  template: string;
  description: string;
}

// Pre-defined templates that work for most lead scenarios
export const DEFAULT_DM_TEMPLATES: DMTemplate[] = [
  {
    id: 'intro',
    label: 'Introduce',
    icon: 'connect',
    description: 'Friendly introduction',
    template: 'Hey! I came across your post and thought I might be able to help. I\'ve worked on similar challenges before and would love to share some insights. Would you be open to a quick chat?',
  },
  {
    id: 'help',
    label: 'Offer Help',
    icon: 'help',
    description: 'Offer assistance',
    template: 'Hi there! I noticed your post and it really resonated with me - I\'ve dealt with something similar before. I\'d be happy to share what worked for me if you\'re interested. Just let me know!',
  },
  {
    id: 'value',
    label: 'Share Value',
    icon: 'offer',
    description: 'Lead with value',
    template: 'Hey! Saw your post and wanted to reach out. I actually have some resources/experience that might help with exactly what you\'re looking for. Happy to share - no strings attached. Would that be helpful?',
  },
  {
    id: 'curious',
    label: 'Ask More',
    icon: 'intro',
    description: 'Learn more first',
    template: 'Hi! Your post caught my attention - sounds like an interesting challenge. I\'d love to learn more about what you\'re working on. Mind if I ask a few questions to see if I can point you in the right direction?',
  },
];

interface DMTemplateButtonProps {
  template: DMTemplate;
  isSelected: boolean;
  onSelect: () => void;
  isDark: boolean;
}

const IconMap = {
  intro: MessageSquare,
  help: HelpCircle,
  offer: Handshake,
  connect: Zap,
  ai: Sparkles,
};

const DMTemplateButton = memo(({ template, isSelected, onSelect, isDark }: DMTemplateButtonProps) => {
  const Icon = IconMap[template.icon];

  return (
    <Pressable
      onPress={onSelect}
      style={[
        styles.templateButton,
        {
          backgroundColor: isSelected
            ? isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.15)'
            : isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
          borderColor: isSelected ? '#22C55E' : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        },
      ]}
    >
      <View style={[styles.templateIcon, { backgroundColor: isSelected ? 'rgba(34, 197, 94, 0.2)' : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)' }]}>
        <Icon size={16} color={isSelected ? '#22C55E' : isDark ? '#9CA3AF' : '#6B7280'} />
      </View>
      <Text style={[styles.templateLabel, { color: isSelected ? '#22C55E' : isDark ? '#E5E7EB' : '#374151' }]}>
        {template.label}
      </Text>
    </Pressable>
  );
});

interface DMTemplatesProps {
  templates?: DMTemplate[];
  selectedId?: string;
  onSelectTemplate: (template: DMTemplate) => void;
  onGenerateAI?: () => void;
  isGeneratingAI?: boolean;
  postTitle?: string;
  postContent?: string;
}

export default function DMTemplates({
  templates = DEFAULT_DM_TEMPLATES,
  selectedId,
  onSelectTemplate,
  onGenerateAI,
  isGeneratingAI = false,
}: DMTemplatesProps) {
  const { isDark } = useTheme();
  const glass = isDark ? GLASS.dark : GLASS.light;

  const handleSelect = useCallback((template: DMTemplate) => {
    hapticFeedback.selection();
    onSelectTemplate(template);
  }, [onSelectTemplate]);

  const handleGenerateAI = useCallback(() => {
    if (onGenerateAI && !isGeneratingAI) {
      hapticFeedback.medium();
      onGenerateAI();
    }
  }, [onGenerateAI, isGeneratingAI]);

  return (
    <Animated.View entering={FadeInDown.duration(300).delay(100)} style={styles.container}>
      <Text style={[styles.sectionTitle, { color: glass.textSecondary }]}>
        Quick Templates
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.templatesRow}
      >
        {templates.map((template) => (
          <DMTemplateButton
            key={template.id}
            template={template}
            isSelected={selectedId === template.id}
            onSelect={() => handleSelect(template)}
            isDark={isDark}
          />
        ))}

        {/* AI Generate Button */}
        {onGenerateAI && (
          <Pressable
            onPress={handleGenerateAI}
            disabled={isGeneratingAI}
            style={[
              styles.templateButton,
              styles.aiButton,
              {
                backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)',
                borderColor: isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)',
                opacity: isGeneratingAI ? 0.6 : 1,
              },
            ]}
          >
            <View style={[styles.templateIcon, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
              <Sparkles size={16} color="#8B5CF6" />
            </View>
            <Text style={[styles.templateLabel, { color: '#8B5CF6' }]}>
              {isGeneratingAI ? 'Writing...' : 'AI Write'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  templatesRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 8,
  },
  aiButton: {
    borderStyle: 'dashed',
  },
  templateIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
