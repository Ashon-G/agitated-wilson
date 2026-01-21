import { Quest, QuestCategory, QuestInputType } from '../types/app';
import GeminiService from '../services/GeminiService';

/**
 * Default quest definitions derived from old onboarding steps 7-14
 * These are presented as "Quick Questions" on the HomeScreen
 * Questions use {businessName}, {targetMarket}, {productDescription} placeholders
 * which get reworded by AI when displayed
 */

export interface QuestDefinition {
  id: string;
  title: string;
  question: string;
  placeholder?: string;
  category: QuestCategory;
  inputType: QuestInputType;
  priority: number;
  icon: string;
  color: string;
}

export const DEFAULT_QUESTS: QuestDefinition[] = [
  // Lead Hunting Setup (must complete before connecting Reddit)
  {
    id: 'quest_hunting_keywords',
    title: 'Quick Question',
    question: 'Before we start hunting leads, what keywords should I look for? What words would {targetMarket} use when looking for {productDescription}?',
    placeholder: 'e.g., "need help with", "looking for", "recommend"',
    category: 'hunting',
    inputType: 'multitext',
    priority: 0, // Highest priority - must complete before Reddit
    icon: 'search-outline',
    color: '#FF6B35',
  },

  // Website & Brand (from Step 8)
  {
    id: 'quest_website_url',
    title: 'Quick Question',
    question: "Hey boss, quick one. What's {businessName}'s website? I want to learn more about what I'm selling.",
    placeholder: 'https://yourwebsite.com',
    category: 'website',
    inputType: 'url',
    priority: 1,
    icon: 'globe-outline',
    color: '#3B82F6',
  },
  {
    id: 'quest_brand_colors',
    title: 'Quick Question',
    question: 'What colors represent {businessName}? This helps me stay on-brand when talking to {targetMarket}.',
    placeholder: 'Select up to 3 colors',
    category: 'website',
    inputType: 'colorpicker',
    priority: 2,
    icon: 'color-palette-outline',
    color: '#8B5CF6',
  },
  {
    id: 'quest_social_links',
    title: 'Quick Question',
    question: 'Where else can {targetMarket} find {businessName} online? Drop the social handles so I know where to send interested leads.',
    placeholder: 'Add your social profiles',
    category: 'website',
    inputType: 'sociallinks',
    priority: 3,
    icon: 'share-social-outline',
    color: '#06B6D4',
  },

  // Sales Materials (from Step 9)
  {
    id: 'quest_sales_materials',
    title: 'Quick Question',
    question: "Got any sales decks or brochures about {productDescription}? Upload them and I'll study up.",
    placeholder: 'Upload PDFs, decks, or documents',
    category: 'sales',
    inputType: 'fileupload',
    priority: 4,
    icon: 'document-text-outline',
    color: '#10B981',
  },

  // Pricing (from Step 10)
  {
    id: 'quest_pricing',
    title: 'Quick Question',
    question: "Let's talk money. How does {businessName} structure pricing for {productDescription}? Knowing this helps me qualify {targetMarket} leads better.",
    placeholder: 'Describe your pricing tiers',
    category: 'pricing',
    inputType: 'text',
    priority: 5,
    icon: 'card-outline',
    color: '#F59E0B',
  },

  // FAQ (from Step 11)
  {
    id: 'quest_faq',
    title: 'Quick Question',
    question: 'What questions do {targetMarket} ask again and again about {productDescription}? Give me the top ones so I can handle them.',
    placeholder: 'Add common questions and answers',
    category: 'faq',
    inputType: 'keyvalue',
    priority: 6,
    icon: 'help-circle-outline',
    color: '#EF4444',
  },
  {
    id: 'quest_objections',
    title: 'Quick Question',
    question: 'What pushback do we hear from {targetMarket} about {productDescription}? Tell me the objections and how to handle them.',
    placeholder: 'Add objections and your responses',
    category: 'faq',
    inputType: 'keyvalue',
    priority: 7,
    icon: 'chatbubble-ellipses-outline',
    color: '#F97316',
  },

  // Contact (from Step 12)
  {
    id: 'quest_contact_sales',
    title: 'Quick Question',
    question: 'When a {targetMarket} lead gets serious, who should they talk to at {businessName}? Give me a name and email.',
    placeholder: 'Name and email',
    category: 'contact',
    inputType: 'multitext',
    priority: 8,
    icon: 'person-outline',
    color: '#8B5CF6',
  },
  {
    id: 'quest_business_hours',
    title: 'Quick Question',
    question: 'When can {targetMarket} reach the {businessName} team? What hours do you operate?',
    placeholder: 'e.g., Mon-Fri 9am-5pm EST',
    category: 'contact',
    inputType: 'text',
    priority: 9,
    icon: 'time-outline',
    color: '#6366F1',
  },

  // Closing Links (from Step 13)
  {
    id: 'quest_meeting_link',
    title: 'Quick Question',
    question: 'Last one - where should I send hot {targetMarket} leads to book time with {businessName}? Drop your Calendly or booking link.',
    placeholder: 'Calendly, Cal.com, or meeting link',
    category: 'closing',
    inputType: 'url',
    priority: 10,
    icon: 'calendar-outline',
    color: '#14B8A6',
  },
];

/**
 * Create initial quest objects from definitions
 */
export function createInitialQuests(): Quest[] {
  return DEFAULT_QUESTS.map(def => ({
    id: def.id,
    title: def.title,
    question: def.question,
    placeholder: def.placeholder,
    category: def.category,
    inputType: def.inputType,
    isCompleted: false,
    priority: def.priority,
    icon: def.icon,
    color: def.color,
  }));
}

/**
 * Get quests by category
 */
export function getQuestsByCategory(quests: Quest[], category: QuestCategory): Quest[] {
  return quests.filter(q => q.category === category);
}

/**
 * Get the next incomplete quest (by priority)
 */
export function getNextQuest(quests: Quest[]): Quest | null {
  const incompleteQuests = quests
    .filter(q => !q.isCompleted)
    .sort((a, b) => a.priority - b.priority);

  return incompleteQuests.length > 0 ? incompleteQuests[0] : null;
}

/**
 * Category metadata for display
 */
export const QUEST_CATEGORIES: Record<QuestCategory, { label: string; icon: string; color: string }> = {
  website: { label: 'Website & Brand', icon: 'globe-outline', color: '#3B82F6' },
  sales: { label: 'Sales Materials', icon: 'document-text-outline', color: '#10B981' },
  pricing: { label: 'Pricing', icon: 'card-outline', color: '#F59E0B' },
  faq: { label: 'FAQ & Objections', icon: 'help-circle-outline', color: '#EF4444' },
  contact: { label: 'Contact Info', icon: 'people-outline', color: '#8B5CF6' },
  closing: { label: 'Closing Links', icon: 'link-outline', color: '#14B8A6' },
  hunting: { label: 'Lead Hunting', icon: 'search-outline', color: '#FF6B35' },
};

/**
 * Business context for personalizing quest questions
 */
export interface BusinessContext {
  businessName?: string;
  targetMarket?: string;
  productDescription?: string;
}

// Cache for AI-reworded questions to avoid repeated API calls
const rewordedQuestionsCache: Map<string, string> = new Map();

// Cache version - increment this to invalidate old cached rewrites
const CACHE_VERSION = 2;

/**
 * Generate a cache key for a question + context combination
 */
function getCacheKey(question: string, context: BusinessContext): string {
  return `v${CACHE_VERSION}|${question}|${context.businessName || ''}|${context.targetMarket || ''}|${context.productDescription || ''}`;
}

/**
 * Check if question needs AI rewording (has complex placeholders)
 */
function needsAIRewording(question: string): boolean {
  return question.includes('{targetMarket}') || question.includes('{productDescription}');
}

/**
 * Simple fallback personalization for when AI is not needed or fails
 * Uses generic labels instead of raw context to avoid awkward phrasing
 */
function simplePersonalize(question: string, context: BusinessContext): string {
  let result = question;
  result = result.replace(/{businessName}/g, context.businessName || 'your company');
  // Use generic labels that work grammatically - never use raw verbose context
  result = result.replace(/{targetMarket}/g, 'your ideal customers');
  result = result.replace(/{productDescription}/g, 'what you offer');
  return result;
}

/**
 * Personalize a quest question by using AI to reword it naturally
 * Uses caching to avoid repeated API calls
 */
export function personalizeQuestion(question: string, context: BusinessContext): string {
  // If no complex placeholders, just do simple replacement
  if (!needsAIRewording(question)) {
    return simplePersonalize(question, context);
  }

  // Check cache first
  const cacheKey = getCacheKey(question, context);
  const cached = rewordedQuestionsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Return simple fallback for sync call - async rewording happens elsewhere
  return simplePersonalize(question, context);
}

/**
 * Async version that uses AI to reword questions
 * Call this to pre-cache reworded questions
 */
export async function personalizeQuestionAsync(
  question: string,
  context: BusinessContext,
): Promise<string> {
  // If no complex placeholders, just do simple replacement
  if (!needsAIRewording(question)) {
    return simplePersonalize(question, context);
  }

  // Check cache first
  const cacheKey = getCacheKey(question, context);
  const cached = rewordedQuestionsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Use AI to reword the question
    const reworded = await GeminiService.rewordQuestQuestion(question, context);
    // Cache the result
    rewordedQuestionsCache.set(cacheKey, reworded);
    return reworded;
  } catch (error) {
    console.error('[questContent] AI rewording failed, using fallback:', error);
    return simplePersonalize(question, context);
  }
}

/**
 * Pre-cache all quest questions for a given business context
 * Call this when the app loads or when business context changes
 */
export async function preCacheQuestions(context: BusinessContext): Promise<void> {
  const questionsToReword = DEFAULT_QUESTS
    .filter(q => needsAIRewording(q.question))
    .map(q => q.question);

  // Reword all questions in parallel
  await Promise.all(
    questionsToReword.map(q => personalizeQuestionAsync(q, context)),
  );

  console.log(`[questContent] Pre-cached ${questionsToReword.length} reworded questions`);
}

/**
 * Clear the question cache (call when business context changes significantly)
 */
export function clearQuestionCache(): void {
  rewordedQuestionsCache.clear();
}
