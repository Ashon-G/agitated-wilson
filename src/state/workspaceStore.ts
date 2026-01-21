import { create } from 'zustand';
import { Workspace, RedditAccount } from '../types/app';
import BackendService from '../services/BackendService';
import AuthenticationService from '../services/AuthenticationService';
import { auth } from '../config/firebase';

// Helper function to ensure Firebase auth is ready with a valid token
const ensureAuthReady = async (maxRetries = 5, delayMs = 500): Promise<boolean> => {
  for (let i = 0; i < maxRetries; i++) {
    const user = AuthenticationService.getCurrentUser();
    const firebaseUser = auth.currentUser;

    console.log(`🔄 Auth check attempt ${i + 1}/${maxRetries}:`, {
      hasUser: !!user,
      hasFirebaseUser: !!firebaseUser,
      userId: user?.uid,
    });

    if (user && firebaseUser) {
      try {
        // Try to get a token to verify auth is working (not force refresh to avoid quota issues)
        const token = await firebaseUser.getIdToken(false);
        if (token && token.length > 0) {
          console.log(`✅ Auth ready on attempt ${i + 1}, token length: ${token.length}`);

          // Add a small initial delay to ensure Firebase auth state is propagated
          if (i === 0) {
            console.log('⏳ Waiting 500ms for Firebase auth state propagation...');
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          return true;
        }
      } catch (error) {
        console.warn(`⚠️ Auth check failed on attempt ${i + 1}:`, error);
      }
    } else {
      console.warn(`⚠️ Missing auth on attempt ${i + 1}:`, {
        hasUser: !!user,
        hasFirebaseUser: !!firebaseUser,
      });
    }

    if (i < maxRetries - 1) {
      console.log(`⏳ Waiting ${delayMs}ms before retry ${i + 2}...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.error('❌ Auth not ready after all retries');
  return false;
};

interface WorkspaceStore {
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  currentWorkspace: Workspace | null;
  isLoading: boolean;

  // Actions
  loadWorkspaces: () => Promise<void>;
  addWorkspace: (workspace: Omit<Workspace, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  setCurrentWorkspace: (id: string) => void;
  getCurrentWorkspace: () => Workspace | null;
  updateWorkspaceStats: (id: string, stats: Partial<Workspace['stats']>) => Promise<void>;
  connectRedditToWorkspace: (workspaceId: string, redditAccount: RedditAccount) => Promise<void>;
  disconnectRedditFromWorkspace: (workspaceId: string) => Promise<void>;
  isWorkspaceRedditConnected: (workspaceId?: string) => boolean;
}

const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces: [],
  currentWorkspaceId: null,
  currentWorkspace: null,
  isLoading: false,

  loadWorkspaces: async () => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) {
      console.log('❌ loadWorkspaces: No authenticated user');
      return;
    }

    try {
      console.log('🔄 loadWorkspaces: Starting to load workspaces for user:', user.uid);
      set({ isLoading: true });

      // Updated to use new hierarchical path: users/{userId}/workspaces
      const workspacesPath = `users/${user.uid}/workspaces`;
      const workspaces = await BackendService.queryCollection<Workspace>(workspacesPath, {});

      console.log('📦 loadWorkspaces: Loaded workspaces:', workspaces.length, 'workspaces');
      console.log('📋 loadWorkspaces: Workspace IDs:', workspaces.map(w => w.id));

      // Sort client-side to avoid index requirement
      workspaces.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      set({ workspaces, isLoading: false });

      // Set current workspace if none selected
      const currentState = get();
      console.log('🔍 loadWorkspaces: Current state after load:', {
        workspacesCount: workspaces.length,
        hasCurrentWorkspace: !!currentState.currentWorkspace,
        currentWorkspaceId: currentState.currentWorkspaceId,
      });

      if (workspaces.length > 0 && !currentState.currentWorkspace) {
        console.log('✅ loadWorkspaces: Setting default workspace:', workspaces[0].id);
        get().setCurrentWorkspace(workspaces[0].id);
      }
    } catch (error) {
      console.error('❌ Failed to load workspaces from Firestore:', error);
      set({ isLoading: false });
    }
  },

  addWorkspace: async (workspaceData) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    // Ensure Firebase auth is ready with a valid token before proceeding
    console.log('🔄 Ensuring Firebase auth is ready before creating workspace...');
    const isAuthReady = await ensureAuthReady();

    if (!isAuthReady) {
      throw new Error('Firebase authentication not ready. Please try again.');
    }

    try {
      console.log('✅ Firebase auth confirmed ready, creating workspace...');

      // Updated to use new hierarchical path: users/{userId}/workspaces
      const workspacesPath = `users/${user.uid}/workspaces`;
      const newWorkspace = await BackendService.createDocument<Workspace>(workspacesPath, {
        ...workspaceData,
        userId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      set(state => ({
        workspaces: [...state.workspaces, newWorkspace],
        currentWorkspaceId: newWorkspace.id,
        currentWorkspace: newWorkspace,
      }));
    } catch (error) {
      console.error('Failed to create workspace in Firestore:', error);
      throw error;
    }
  },

  updateWorkspace: async (id, updates) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    try {
      // Updated to use new hierarchical path: users/{userId}/workspaces
      const workspacesPath = `users/${user.uid}/workspaces`;
      await BackendService.updateDocument<Workspace>(workspacesPath, id, updates);

      set(state => ({
        workspaces: state.workspaces.map(workspace =>
          workspace.id === id
            ? { ...workspace, ...updates, updatedAt: new Date() }
            : workspace,
        ),
        currentWorkspace:
          state.currentWorkspaceId === id
            ? { ...state.currentWorkspace!, ...updates, updatedAt: new Date() }
            : state.currentWorkspace,
      }));
    } catch (error) {
      console.error('Failed to update workspace in Firestore:', error);
      throw error;
    }
  },

  deleteWorkspace: async (id) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    try {
      // Updated to use new hierarchical path: users/{userId}/workspaces
      const workspacesPath = `users/${user.uid}/workspaces`;
      await BackendService.deleteDocument(workspacesPath, id);

      set(state => {
        const filteredWorkspaces = state.workspaces.filter(w => w.id !== id);
        const newCurrentWorkspace = state.currentWorkspaceId === id
          ? filteredWorkspaces[0] || null
          : state.currentWorkspace;

        return {
          workspaces: filteredWorkspaces,
          currentWorkspaceId: newCurrentWorkspace?.id || null,
          currentWorkspace: newCurrentWorkspace,
        };
      });
    } catch (error) {
      console.error('Failed to delete workspace from Firestore:', error);
      throw error;
    }
  },

  setCurrentWorkspace: (id) => {
    const workspace = get().workspaces.find(w => w.id === id);
    if (workspace) {
      set({
        currentWorkspaceId: id,
        currentWorkspace: workspace,
      });
    }
  },

  getCurrentWorkspace: () => {
    return get().currentWorkspace;
  },

  updateWorkspaceStats: async (id, stats) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    try {
      const currentWorkspace = get().workspaces.find(w => w.id === id);
      if (!currentWorkspace) return;

      const updatedStats = { ...currentWorkspace.stats, ...stats };
      const updates = { stats: updatedStats };

      // Updated to use new hierarchical path: users/{userId}/workspaces
      const workspacesPath = `users/${user.uid}/workspaces`;
      await BackendService.updateDocument<Workspace>(workspacesPath, id, updates);

      set(state => ({
        workspaces: state.workspaces.map(workspace =>
          workspace.id === id
            ? {
              ...workspace,
              stats: { ...workspace.stats, ...stats },
              updatedAt: new Date(),
            }
            : workspace,
        ),
        currentWorkspace:
          state.currentWorkspaceId === id
            ? {
              ...state.currentWorkspace!,
              stats: { ...state.currentWorkspace!.stats, ...stats },
              updatedAt: new Date(),
            }
            : state.currentWorkspace,
      }));
    } catch (error) {
      console.error('Failed to update workspace stats in Firestore:', error);
      throw error;
    }
  },

  connectRedditToWorkspace: async (workspaceId, redditAccount) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    try {
      const workspacesPath = `users/${user.uid}/workspaces`;
      await BackendService.updateDocument<Workspace>(workspacesPath, workspaceId, { redditAccount });

      set(state => ({
        workspaces: state.workspaces.map(workspace =>
          workspace.id === workspaceId
            ? { ...workspace, redditAccount, updatedAt: new Date() }
            : workspace,
        ),
        currentWorkspace:
          state.currentWorkspaceId === workspaceId
            ? { ...state.currentWorkspace!, redditAccount, updatedAt: new Date() }
            : state.currentWorkspace,
      }));
    } catch (error) {
      console.error('Failed to connect Reddit to workspace:', error);
      throw error;
    }
  },

  disconnectRedditFromWorkspace: async (workspaceId) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    try {
      const workspacesPath = `users/${user.uid}/workspaces`;
      await BackendService.updateDocument<Workspace>(workspacesPath, workspaceId, { redditAccount: undefined });

      set(state => ({
        workspaces: state.workspaces.map(workspace =>
          workspace.id === workspaceId
            ? { ...workspace, redditAccount: undefined, updatedAt: new Date() }
            : workspace,
        ),
        currentWorkspace:
          state.currentWorkspaceId === workspaceId
            ? { ...state.currentWorkspace!, redditAccount: undefined, updatedAt: new Date() }
            : state.currentWorkspace,
      }));
    } catch (error) {
      console.error('Failed to disconnect Reddit from workspace:', error);
      throw error;
    }
  },

  isWorkspaceRedditConnected: (workspaceId) => {
    const { workspaces, currentWorkspaceId } = get();
    const targetId = workspaceId || currentWorkspaceId;
    if (!targetId) return false;

    const workspace = workspaces.find(w => w.id === targetId);
    const redditAccount = workspace?.redditAccount;
    return !!(redditAccount?.isActive && redditAccount.expiresAt > Date.now());
  },
}));

export default useWorkspaceStore;