/**
 * Dashboard UI Store
 *
 * Persists UI state for dashboard cards across tab switches.
 * This prevents cards from resetting when navigating away and back to the home screen.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SWIPE_TUTORIAL_KEY = 'hasEverMinimizedCard';

type CardId = 'approvals' | 'stats' | 'inbox' | 'quest' | 'question' | 'upgrade' | 'ad';

interface DashboardUIState {
  // Cards that have been dismissed (permanently hidden for this session)
  dismissedCards: Set<CardId>;

  // Cards that have been minimized (genie animation, can be restored)
  minimizedCards: Set<CardId>;

  // Whether the greeting has been played this session
  hasPlayedGreeting: boolean;

  // Whether speech has been triggered this session
  hasTriggeredSpeech: boolean;

  // Whether user has EVER minimized a card (persistent - for swipe tutorial)
  hasEverMinimizedCard: boolean;

  // Whether the swipe tutorial state has been loaded from storage
  swipeTutorialLoaded: boolean;

  // Actions
  dismissCard: (cardId: CardId) => void;
  minimizeCard: (cardId: CardId) => void;
  restoreCard: (cardId: CardId) => void;
  setGreetingPlayed: () => void;
  setSpeechTriggered: () => void;
  resetSpeechTriggered: () => void;
  isCardDismissed: (cardId: CardId) => boolean;
  isCardMinimized: (cardId: CardId) => boolean;

  // Load swipe tutorial state from AsyncStorage
  loadSwipeTutorialState: () => Promise<void>;

  // Reset all UI state (for logout, etc.)
  resetUIState: () => void;
}

const useDashboardUIStore = create<DashboardUIState>((set, get) => ({
  dismissedCards: new Set(),
  minimizedCards: new Set(),
  hasPlayedGreeting: false,
  hasTriggeredSpeech: false,
  hasEverMinimizedCard: false,
  swipeTutorialLoaded: false,

  dismissCard: (cardId: CardId) => {
    set(state => ({
      dismissedCards: new Set([...state.dismissedCards, cardId]),
      // Also remove from minimized if it was there
      minimizedCards: new Set([...state.minimizedCards].filter(id => id !== cardId)),
    }));
  },

  minimizeCard: (cardId: CardId) => {
    const { hasEverMinimizedCard } = get();

    set(state => ({
      minimizedCards: new Set([...state.minimizedCards, cardId]),
      hasEverMinimizedCard: true,
    }));

    // Persist to AsyncStorage if this is the first time ever minimizing
    if (!hasEverMinimizedCard) {
      AsyncStorage.setItem(SWIPE_TUTORIAL_KEY, 'true').catch(err => {
        console.error('Failed to save swipe tutorial state:', err);
      });
    }
  },

  restoreCard: (cardId: CardId) => {
    set(state => ({
      minimizedCards: new Set([...state.minimizedCards].filter(id => id !== cardId)),
    }));
  },

  setGreetingPlayed: () => {
    set({ hasPlayedGreeting: true });
  },

  setSpeechTriggered: () => {
    set({ hasTriggeredSpeech: true });
  },

  resetSpeechTriggered: () => {
    set({ hasTriggeredSpeech: false });
  },

  isCardDismissed: (cardId: CardId) => {
    return get().dismissedCards.has(cardId);
  },

  isCardMinimized: (cardId: CardId) => {
    return get().minimizedCards.has(cardId);
  },

  loadSwipeTutorialState: async () => {
    try {
      const value = await AsyncStorage.getItem(SWIPE_TUTORIAL_KEY);
      set({
        hasEverMinimizedCard: value === 'true',
        swipeTutorialLoaded: true,
      });
    } catch (err) {
      console.error('Failed to load swipe tutorial state:', err);
      set({ swipeTutorialLoaded: true });
    }
  },

  resetUIState: () => {
    set({
      dismissedCards: new Set(),
      minimizedCards: new Set(),
      hasPlayedGreeting: false,
      hasTriggeredSpeech: false,
      // Note: hasEverMinimizedCard is NOT reset - it's permanent
    });
  },
}));

export default useDashboardUIStore;
export type { CardId };
