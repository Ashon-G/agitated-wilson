import { create } from 'zustand';
import { AgentSettings, DEFAULT_AGENT_SETTINGS, CommentStyle } from '../types/app';
import BackendService from '../services/BackendService';
import AuthenticationService from '../services/AuthenticationService';

interface AgentSettingsStore {
  settings: AgentSettings | null;
  isLoading: boolean;
  isSaving: boolean;

  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<AgentSettings>) => Promise<void>;

  // Individual setters (for UI convenience)
  setScoreThreshold: (value: number) => Promise<void>;
  setMaxPostsPerRun: (value: number) => Promise<void>;
  setPostAgeLimitDays: (value: number) => Promise<void>;
  setCommentStyle: (value: CommentStyle) => Promise<void>;
  setRequireApproval: (value: boolean) => Promise<void>;
}

const useAgentSettingsStore = create<AgentSettingsStore>((set, get) => ({
  settings: null,
  isLoading: false,
  isSaving: false,

  loadSettings: async () => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) {
      console.log('❌ loadSettings: No authenticated user');
      return;
    }

    try {
      set({ isLoading: true });
      console.log('🔄 Loading agent settings for user:', user.uid);

      // Settings are stored at users/{userId}/agentSettings/default
      const settingsPath = `users/${user.uid}/agentSettings`;
      const settings = await BackendService.getDocument<AgentSettings>(settingsPath, 'default');

      if (settings) {
        console.log('✅ Loaded existing agent settings');
        set({ settings, isLoading: false });
      } else {
        // Create default settings if none exist
        console.log('📝 Creating default agent settings');
        const defaultSettings: AgentSettings = {
          ...DEFAULT_AGENT_SETTINGS,
          userId: user.uid,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await BackendService.setDocument<AgentSettings>(settingsPath, 'default', defaultSettings);
        set({ settings: defaultSettings, isLoading: false });
        console.log('✅ Created default agent settings');
      }
    } catch (error) {
      console.error('❌ Failed to load agent settings:', error);

      // Use default settings as fallback
      const user = AuthenticationService.getCurrentUser();
      if (user) {
        const fallbackSettings: AgentSettings = {
          ...DEFAULT_AGENT_SETTINGS,
          userId: user.uid,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set({ settings: fallbackSettings, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    }
  },

  updateSettings: async (updates) => {
    const user = AuthenticationService.getCurrentUser();
    const currentSettings = get().settings;

    if (!user || !currentSettings) {
      console.warn('⚠️ Cannot update settings: no user or settings loaded');
      return;
    }

    try {
      set({ isSaving: true });

      // Enforce rate limit: maxPostsPerRun must always be 3
      if ('maxPostsPerRun' in updates) {
        console.warn('⚠️ maxPostsPerRun is hardcoded at 3 for rate limiting - ignoring update attempt');
        updates = { ...updates, maxPostsPerRun: 3 };
      }

      const updatedSettings = {
        ...currentSettings,
        ...updates,
        maxPostsPerRun: 3, // Always enforce rate limit
        updatedAt: new Date(),
      };

      // Optimistic update
      set({ settings: updatedSettings });

      // Persist to Firestore
      const settingsPath = `users/${user.uid}/agentSettings`;
      await BackendService.updateDocument<AgentSettings>(settingsPath, 'default', {
        ...updates,
        maxPostsPerRun: 3, // Always enforce in database too
        updatedAt: new Date(),
      });

      console.log('✅ Agent settings updated:', Object.keys(updates));
      set({ isSaving: false });
    } catch (error) {
      console.error('❌ Failed to update agent settings:', error);
      // Revert optimistic update
      set({ settings: currentSettings, isSaving: false });
      throw error;
    }
  },

  // Convenience methods for individual settings
  setScoreThreshold: async (value) => {
    await get().updateSettings({ scoreThreshold: value });
  },

  setMaxPostsPerRun: async (value) => {
    // Hardcoded at 3 for rate limiting - ignore any other value
    console.warn('⚠️ maxPostsPerRun is hardcoded at 3 for rate limiting');
    await get().updateSettings({ maxPostsPerRun: 3 });
  },

  setPostAgeLimitDays: async (value) => {
    await get().updateSettings({ postAgeLimitDays: value });
  },

  setCommentStyle: async (value) => {
    await get().updateSettings({ commentStyle: value });
  },

  setRequireApproval: async (value) => {
    await get().updateSettings({ requireApproval: value });
  },
}));

export default useAgentSettingsStore;
