import { create } from 'zustand';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Quest, QuestProgress } from '../types/app';
import { createInitialQuests, getNextQuest } from '../data/questContent';
import AuthenticationService from '../services/AuthenticationService';
import OnboardingKnowledgeService from '../services/OnboardingKnowledgeService';
import { getOrCreateOnboardingWorkspaceId } from '../utils/onboardingHelpers';
import { ExtractedQuestAnswers } from '../services/BrandExtractionService';

interface QuestState {
  // State
  quests: Quest[];
  isLoading: boolean;
  isInitialized: boolean;
  currentQuest: Quest | null;

  // Computed
  totalQuests: number;
  completedQuests: number;
  hasIncompleteQuests: boolean;

  // Actions
  loadQuests: () => Promise<void>;
  initializeQuests: () => Promise<void>;
  completeQuest: (questId: string, answer: any) => Promise<void>;
  completeQuestsFromExtraction: (questAnswers: ExtractedQuestAnswers) => Promise<number>;
  skipQuest: (questId: string) => Promise<void>;
  resetQuests: () => Promise<void>;
  getNextIncompleteQuest: () => Quest | null;
  refreshCurrentQuest: () => void;
  isHuntingKeywordsCompleted: () => boolean;
  getHuntingKeywords: () => string[];
}

const useQuestStore = create<QuestState>((set, get) => ({
  // Initial state
  quests: [],
  isLoading: false,
  isInitialized: false,
  currentQuest: null,
  totalQuests: 0,
  completedQuests: 0,
  hasIncompleteQuests: false,

  /**
   * Load quests from Firestore
   */
  loadQuests: async () => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) {
      console.log('[QuestStore] No user, skipping quest load');
      return;
    }

    set({ isLoading: true });

    try {
      const questDocRef = doc(db, 'users', user.uid, 'quests', 'progress');
      const questDoc = await getDoc(questDocRef);

      if (questDoc.exists()) {
        const data = questDoc.data() as QuestProgress;
        let quests = data.quests || [];

        // Check for any missing quests from the default list and add them
        const defaultQuests = createInitialQuests();
        const existingIds = new Set(quests.map(q => q.id));
        const missingQuests = defaultQuests.filter(q => !existingIds.has(q.id));

        if (missingQuests.length > 0) {
          console.log(`[QuestStore] Adding ${missingQuests.length} missing quests:`, missingQuests.map(q => q.id));
          quests = [...quests, ...missingQuests];

          // Save the updated quests back to Firestore
          await updateDoc(questDocRef, {
            quests,
            totalQuests: quests.length,
            lastUpdated: new Date(),
          });
        }

        const completedCount = quests.filter(q => q.isCompleted).length;
        const nextQuest = getNextQuest(quests);

        set({
          quests,
          totalQuests: quests.length,
          completedQuests: completedCount,
          hasIncompleteQuests: completedCount < quests.length,
          currentQuest: nextQuest,
          isInitialized: true,
          isLoading: false,
        });

        console.log(`[QuestStore] Loaded ${quests.length} quests, ${completedCount} completed`);
      } else {
        // No quests exist yet - will be initialized after onboarding
        set({
          quests: [],
          totalQuests: 0,
          completedQuests: 0,
          hasIncompleteQuests: false,
          currentQuest: null,
          isInitialized: true,
          isLoading: false,
        });

        console.log('[QuestStore] No quests found for user');
      }
    } catch (error) {
      console.error('[QuestStore] Error loading quests:', error);
      set({ isLoading: false, isInitialized: true });
    }
  },

  /**
   * Initialize quests for a new user (called after onboarding)
   */
  initializeQuests: async () => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) {
      console.error('[QuestStore] Cannot initialize quests - no user');
      return;
    }

    set({ isLoading: true });

    try {
      const initialQuests = createInitialQuests();

      const questProgress: QuestProgress = {
        userId: user.uid,
        quests: initialQuests,
        totalQuests: initialQuests.length,
        completedQuests: 0,
        lastUpdated: new Date(),
        createdAt: new Date(),
      };

      // Save to Firestore
      const questDocRef = doc(db, 'users', user.uid, 'quests', 'progress');
      await setDoc(questDocRef, questProgress);

      const nextQuest = getNextQuest(initialQuests);

      set({
        quests: initialQuests,
        totalQuests: initialQuests.length,
        completedQuests: 0,
        hasIncompleteQuests: true,
        currentQuest: nextQuest,
        isInitialized: true,
        isLoading: false,
      });

      console.log(`[QuestStore] Initialized ${initialQuests.length} quests`);
    } catch (error) {
      console.error('[QuestStore] Error initializing quests:', error);
      set({ isLoading: false });
    }
  },

  /**
   * Complete a quest and save the answer to knowledge base
   */
  completeQuest: async (questId: string, answer: any) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) return;

    const { quests } = get();
    const questIndex = quests.findIndex(q => q.id === questId);

    if (questIndex === -1) {
      console.error('[QuestStore] Quest not found:', questId);
      return;
    }

    set({ isLoading: true });

    try {
      // Update the quest
      const updatedQuests = [...quests];
      updatedQuests[questIndex] = {
        ...updatedQuests[questIndex],
        isCompleted: true,
        completedAt: new Date(),
        answer,
      };

      const completedCount = updatedQuests.filter(q => q.isCompleted).length;
      const nextQuest = getNextQuest(updatedQuests);

      // Save to Firestore
      const questDocRef = doc(db, 'users', user.uid, 'quests', 'progress');
      await updateDoc(questDocRef, {
        quests: updatedQuests,
        completedQuests: completedCount,
        lastUpdated: new Date(),
      });

      // Save answer to knowledge base
      await saveQuestAnswerToKnowledge(user.uid, updatedQuests[questIndex]);

      set({
        quests: updatedQuests,
        completedQuests: completedCount,
        hasIncompleteQuests: completedCount < updatedQuests.length,
        currentQuest: nextQuest,
        isLoading: false,
      });

      console.log(`[QuestStore] Completed quest: ${questId}`);
    } catch (error) {
      console.error('[QuestStore] Error completing quest:', error);
      set({ isLoading: false });
    }
  },

  /**
   * Bulk complete quests from AI-extracted data
   * Returns the number of quests completed
   */
  completeQuestsFromExtraction: async (questAnswers: ExtractedQuestAnswers): Promise<number> => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) return 0;

    console.log('[QuestStore] Starting auto-completion with extracted answers:', JSON.stringify(questAnswers, null, 2));

    let { quests } = get();

    // If quests aren't loaded yet, initialize them first
    if (quests.length === 0) {
      quests = createInitialQuests();
      console.log('[QuestStore] Initialized quests from defaults');
    }

    const updatedQuests = [...quests];
    let completedCount = 0;

    // Map extraction data to quest IDs
    const questDataMap: Record<string, any> = {
      quest_hunting_keywords: questAnswers.quest_hunting_keywords,
      quest_website_url: questAnswers.quest_website_url,
      quest_brand_colors: questAnswers.quest_brand_colors,
      quest_social_links: questAnswers.quest_social_links,
      quest_pricing: questAnswers.quest_pricing,
      quest_faq: questAnswers.quest_faq,
      quest_objections: questAnswers.quest_objections,
      quest_contact_sales: questAnswers.quest_contact_sales,
      quest_business_hours: questAnswers.quest_business_hours,
      quest_meeting_link: questAnswers.quest_meeting_link,
    };

    console.log('[QuestStore] Quest data map:', Object.keys(questDataMap).map(k => `${k}: ${questDataMap[k] ? 'HAS DATA' : 'empty/null'}`));

    // Complete each quest that has extracted data
    for (const [questId, answer] of Object.entries(questDataMap)) {
      if (answer === undefined || answer === null) {
        console.log(`[QuestStore] Skipping ${questId}: undefined or null`);
        continue;
      }

      // Skip empty arrays
      if (Array.isArray(answer) && answer.length === 0) {
        console.log(`[QuestStore] Skipping ${questId}: empty array`);
        continue;
      }

      // Skip empty strings
      if (typeof answer === 'string' && answer.trim() === '') {
        console.log(`[QuestStore] Skipping ${questId}: empty string`);
        continue;
      }

      const questIndex = updatedQuests.findIndex(q => q.id === questId);
      if (questIndex === -1) {
        console.log(`[QuestStore] Skipping ${questId}: quest not found in list`);
        continue;
      }

      // Skip if already completed
      if (updatedQuests[questIndex].isCompleted) {
        console.log(`[QuestStore] Skipping ${questId}: already completed`);
        continue;
      }

      // Mark as completed with the extracted answer
      updatedQuests[questIndex] = {
        ...updatedQuests[questIndex],
        isCompleted: true,
        completedAt: new Date(),
        answer,
      };
      completedCount++;

      console.log(`[QuestStore] Auto-completed quest from extraction: ${questId}`);
    }

    if (completedCount === 0) {
      console.log('[QuestStore] No quests to auto-complete from extraction');
      return 0;
    }

    try {
      const totalCompleted = updatedQuests.filter(q => q.isCompleted).length;
      const nextQuest = getNextQuest(updatedQuests);

      // Save to Firestore
      const questDocRef = doc(db, 'users', user.uid, 'quests', 'progress');

      // Try to update, or create if doesn't exist
      const questDoc = await getDoc(questDocRef);
      if (questDoc.exists()) {
        await updateDoc(questDocRef, {
          quests: updatedQuests,
          completedQuests: totalCompleted,
          lastUpdated: new Date(),
        });
      } else {
        await setDoc(questDocRef, {
          userId: user.uid,
          quests: updatedQuests,
          totalQuests: updatedQuests.length,
          completedQuests: totalCompleted,
          lastUpdated: new Date(),
          createdAt: new Date(),
        });
      }

      // Save answers to knowledge base
      for (const quest of updatedQuests) {
        if (quest.isCompleted && quest.answer) {
          await saveQuestAnswerToKnowledge(user.uid, quest);
        }
      }

      set({
        quests: updatedQuests,
        totalQuests: updatedQuests.length,
        completedQuests: totalCompleted,
        hasIncompleteQuests: totalCompleted < updatedQuests.length,
        currentQuest: nextQuest,
        isInitialized: true,
      });

      console.log(`[QuestStore] Auto-completed ${completedCount} quests from extraction`);
      return completedCount;
    } catch (error) {
      console.error('[QuestStore] Error saving auto-completed quests:', error);
      return 0;
    }
  },

  /**
   * Skip a quest without answering
   */
  skipQuest: async (questId: string) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) return;

    const { quests } = get();
    const questIndex = quests.findIndex(q => q.id === questId);

    if (questIndex === -1) return;

    try {
      // Mark as completed but with no answer (skipped)
      const updatedQuests = [...quests];
      updatedQuests[questIndex] = {
        ...updatedQuests[questIndex],
        isCompleted: true,
        completedAt: new Date(),
        answer: null, // null indicates skipped
      };

      const completedCount = updatedQuests.filter(q => q.isCompleted).length;
      const nextQuest = getNextQuest(updatedQuests);

      // Save to Firestore
      const questDocRef = doc(db, 'users', user.uid, 'quests', 'progress');
      await updateDoc(questDocRef, {
        quests: updatedQuests,
        completedQuests: completedCount,
        lastUpdated: new Date(),
      });

      set({
        quests: updatedQuests,
        completedQuests: completedCount,
        hasIncompleteQuests: completedCount < updatedQuests.length,
        currentQuest: nextQuest,
      });

      console.log(`[QuestStore] Skipped quest: ${questId}`);
    } catch (error) {
      console.error('[QuestStore] Error skipping quest:', error);
    }
  },

  /**
   * Reset all quests (for testing)
   */
  resetQuests: async () => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) return;

    try {
      const initialQuests = createInitialQuests();

      const questProgress: QuestProgress = {
        userId: user.uid,
        quests: initialQuests,
        totalQuests: initialQuests.length,
        completedQuests: 0,
        lastUpdated: new Date(),
        createdAt: new Date(),
      };

      const questDocRef = doc(db, 'users', user.uid, 'quests', 'progress');
      await setDoc(questDocRef, questProgress);

      const nextQuest = getNextQuest(initialQuests);

      set({
        quests: initialQuests,
        totalQuests: initialQuests.length,
        completedQuests: 0,
        hasIncompleteQuests: true,
        currentQuest: nextQuest,
      });

      console.log('[QuestStore] Reset all quests');
    } catch (error) {
      console.error('[QuestStore] Error resetting quests:', error);
    }
  },

  /**
   * Get the next incomplete quest
   */
  getNextIncompleteQuest: () => {
    const { quests } = get();
    return getNextQuest(quests);
  },

  /**
   * Refresh the current quest pointer
   */
  refreshCurrentQuest: () => {
    const { quests } = get();
    const nextQuest = getNextQuest(quests);
    set({ currentQuest: nextQuest });
  },

  /**
   * Check if hunting keywords quest is completed
   */
  isHuntingKeywordsCompleted: (): boolean => {
    const { quests } = get();
    const keywordsQuest = quests.find(q => q.id === 'quest_hunting_keywords');
    return !!(keywordsQuest?.isCompleted && keywordsQuest?.answer?.length > 0);
  },

  /**
   * Get the hunting keywords from the completed quest
   */
  getHuntingKeywords: (): string[] => {
    const { quests } = get();
    const keywordsQuest = quests.find(q => q.id === 'quest_hunting_keywords');
    if (keywordsQuest?.isCompleted && Array.isArray(keywordsQuest.answer)) {
      return keywordsQuest.answer.filter((k: string) => k && k.trim().length > 0);
    }
    return [];
  },
}));

/**
 * Save quest answer to the knowledge base
 */
async function saveQuestAnswerToKnowledge(userId: string, quest: Quest): Promise<void> {
  if (!quest.answer) return; // Skip if no answer (quest was skipped)

  try {
    const workspaceId = await getOrCreateOnboardingWorkspaceId(userId);

    switch (quest.id) {
      case 'quest_hunting_keywords':
        if (quest.answer && Array.isArray(quest.answer) && quest.answer.length > 0) {
          // Save keywords to user profile for use in lead hunting
          console.log('[QuestStore] Saved hunting keywords:', quest.answer);
          // Keywords will be used by HuntingEngine when searching Reddit
        }
        break;

      case 'quest_website_url':
        if (quest.answer) {
          await OnboardingKnowledgeService.processWebsiteContent(
            quest.answer,
            userId,
            workspaceId,
            [],
            {},
          );
        }
        break;

      case 'quest_brand_colors':
        // Brand colors are stored as part of website info
        // Could add a dedicated knowledge item if needed
        console.log('[QuestStore] Saved brand colors:', quest.answer);
        break;

      case 'quest_social_links':
        // Social links stored with website info
        console.log('[QuestStore] Saved social links:', quest.answer);
        break;

      case 'quest_sales_materials':
        if (quest.answer && Array.isArray(quest.answer) && quest.answer.length > 0) {
          await OnboardingKnowledgeService.processSalesMaterials(
            quest.answer,
            userId,
            workspaceId,
          );
        }
        break;

      case 'quest_pricing':
        if (quest.answer) {
          // Simple pricing text - create a structured version
          await OnboardingKnowledgeService.structurePricingData(
            {
              currency: 'USD',
              tiers: [],
              coreFeatures: [],
              competitiveAdvantages: [],
              targetCustomerProfile: quest.answer,
            },
            userId,
            workspaceId,
          );
        }
        break;

      case 'quest_faq':
        if (quest.answer && Array.isArray(quest.answer) && quest.answer.length > 0) {
          await OnboardingKnowledgeService.saveFAQsToKnowledge(
            quest.answer,
            userId,
            workspaceId,
          );
        }
        break;

      case 'quest_objections':
        if (quest.answer && Array.isArray(quest.answer) && quest.answer.length > 0) {
          await OnboardingKnowledgeService.saveObjectionResponses(
            quest.answer,
            userId,
            workspaceId,
          );
        }
        break;

      case 'quest_contact_sales':
      case 'quest_business_hours':
        // Contact info - combine with other contact quests
        console.log('[QuestStore] Saved contact info:', quest.answer);
        break;

      case 'quest_meeting_link':
        if (quest.answer) {
          await OnboardingKnowledgeService.saveClosingLinks(
            { meetingCalendarUrl: quest.answer },
            userId,
            workspaceId,
          );
        }
        break;

      default:
        console.log(`[QuestStore] No knowledge handler for quest: ${quest.id}`);
    }
  } catch (error) {
    console.error('[QuestStore] Error saving quest to knowledge:', error);
    // Don't throw - quest is still marked complete even if knowledge save fails
  }
}

export default useQuestStore;
