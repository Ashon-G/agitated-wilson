import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Edit3 } from 'lucide-react-native';
import { styles } from './styles';
import { hapticFeedback } from '../../utils/hapticFeedback';
import { ExtractedQuestAnswers } from '../../services/BrandExtractionService';

// Workspace colors
export const workspaceColors = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#22C55E', '#10B981', '#14B8A6',
  '#06B6D4', '#7DD3FC', '#3B82F6', '#6366F1', '#8B5CF6',
];

// Helper to darken/lighten a hex color for gradient effect
export function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

interface ExtractedData {
  websiteUrl: string;
  businessName: string;
  targetMarket: string;
  productDescription: string;
  businessStage: 'idea' | 'startup' | 'growth' | 'established';
}

interface ReviewStageProps {
  extractedData: ExtractedData;
  extractedQuestAnswers: ExtractedQuestAnswers | null;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  currentSubtitle: string;
  onEdit: (field: string, value: string) => void;
  onContinue: () => void;
  bottomInset: number;
}

export function ReviewStage({
  extractedData,
  extractedQuestAnswers,
  selectedColor,
  setSelectedColor,
  currentSubtitle,
  onEdit,
  onContinue,
  bottomInset,
}: ReviewStageProps) {
  const renderField = (label: string, field: string, value: string) => (
    <Pressable
      key={field}
      style={styles.fieldRow}
      onPress={() => onEdit(field, value)}
    >
      <View style={styles.fieldContent}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue} numberOfLines={2}>{value || 'Not found'}</Text>
      </View>
      <Edit3 size={18} color="#9CA3AF" />
    </Pressable>
  );

  const getBusinessStageLabel = (stage: string) => {
    switch (stage) {
      case 'startup': return 'Just Starting Out';
      case 'growth': return 'Growth Mode';
      case 'established': return 'Established';
      case 'idea': return 'Idea Stage';
      default: return stage;
    }
  };

  return (
    <View style={[styles.reviewContainer, { paddingBottom: bottomInset + 24 }]}>
      <Text style={styles.subtitleText}>{currentSubtitle}</Text>

      <ScrollView style={styles.fieldsScroll} showsVerticalScrollIndicator={false}>
        {/* Core Business Info */}
        {renderField('Business Name', 'businessName', extractedData.businessName)}
        {renderField('Target Market', 'targetMarket', extractedData.targetMarket)}
        {renderField('What You Sell', 'productDescription', extractedData.productDescription)}
        {renderField('Business Stage', 'businessStage', getBusinessStageLabel(extractedData.businessStage))}

        {/* Quest Answers */}
        {extractedQuestAnswers?.quest_website_url &&
          renderField('Website URL', 'quest_website_url', extractedQuestAnswers.quest_website_url)}
        {extractedQuestAnswers?.quest_hunting_keywords && extractedQuestAnswers.quest_hunting_keywords.length > 0 &&
          renderField('Hunting Keywords', 'quest_hunting_keywords', extractedQuestAnswers.quest_hunting_keywords.join(', '))}
        {extractedQuestAnswers?.quest_pricing &&
          renderField('Pricing', 'quest_pricing', extractedQuestAnswers.quest_pricing)}
        {extractedQuestAnswers?.quest_business_hours &&
          renderField('Business Hours', 'quest_business_hours', extractedQuestAnswers.quest_business_hours)}
        {extractedQuestAnswers?.quest_meeting_link &&
          renderField('Meeting/Booking Link', 'quest_meeting_link', extractedQuestAnswers.quest_meeting_link)}
        {extractedQuestAnswers?.quest_contact_sales && extractedQuestAnswers.quest_contact_sales.length > 0 &&
          renderField('Sales Contact', 'quest_contact_sales', extractedQuestAnswers.quest_contact_sales.join(', '))}
        {extractedQuestAnswers?.quest_social_links && extractedQuestAnswers.quest_social_links.length > 0 &&
          renderField('Social Links', 'quest_social_links', extractedQuestAnswers.quest_social_links.map(s => `${s.platform}: ${s.url}`).join('\n'))}
        {extractedQuestAnswers?.quest_brand_colors && extractedQuestAnswers.quest_brand_colors.length > 0 &&
          renderField('Brand Colors', 'quest_brand_colors', extractedQuestAnswers.quest_brand_colors.join(', '))}
        {extractedQuestAnswers?.quest_faq && extractedQuestAnswers.quest_faq.length > 0 &&
          renderField('FAQs', 'quest_faq', `${extractedQuestAnswers.quest_faq.length} FAQ(s) extracted`)}
        {extractedQuestAnswers?.quest_objections && extractedQuestAnswers.quest_objections.length > 0 &&
          renderField('Objection Handling', 'quest_objections', `${extractedQuestAnswers.quest_objections.length} objection response(s)`)}

        {/* Color picker */}
        <Text style={styles.colorLabel}>Brand Color</Text>
        <View style={styles.colorGrid}>
          {workspaceColors.map((color) => (
            <Pressable
              key={color}
              style={[
                styles.colorOption,
                { backgroundColor: color },
                selectedColor === color && styles.colorOptionSelected,
              ]}
              onPress={() => {
                hapticFeedback.light();
                setSelectedColor(color);
              }}
            />
          ))}
        </View>
      </ScrollView>

      <Pressable style={styles.continueButton} onPress={onContinue}>
        <LinearGradient
          colors={[selectedColor, adjustBrightness(selectedColor, -20)]}
          style={styles.continueButtonGradient}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
          <ArrowRight size={20} color="#ffffff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}
