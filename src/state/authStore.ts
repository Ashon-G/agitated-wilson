import { create } from 'zustand';
import AuthenticationService, { AuthUser } from '../services/AuthenticationService';
import BackendService from '../services/BackendService';
import UserDataDeletionService from '../services/UserDataDeletionService';
import OnboardingProgressService from '../services/OnboardingProgressService';
import { BusinessInfo, OnboardingProgress, UserProfile, KnowledgeItem, Workspace } from '../types/app';

interface AuthStore {
  // Auth state
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Onboarding state
  onboardingProgress: OnboardingProgress | null;
  isOnboardingComplete: boolean;

  // Business info
  businessInfo: BusinessInfo | null;

  // Cleanup function for auth listener
  _unsubscribe: (() => void) | null;

  // Actions
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;

  // Onboarding actions
  setOnboardingProgress: (progress: OnboardingProgress) => void;
  loadOnboardingProgress: () => Promise<void>;
  updateOnboardingStep: (step: number, data: Partial<OnboardingProgress['formData']>) => void;
  completeOnboarding: (workspaceId?: string) => Promise<void>;

  // Business info actions
  setBusinessInfo: (info: BusinessInfo) => void;
  clearOnboarding: () => void;

  // Initialize auth state
  initialize: () => void;
}

const useAuthStore = create<AuthStore>((set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  onboardingProgress: null,
  isOnboardingComplete: false,
  businessInfo: null,
  _unsubscribe: null,

  // Actions
  setUser: user => {
    set({
      user,
      isAuthenticated: !!user,
      error: null,
    });
  },

  setLoading: isLoading => {
    set({ isLoading });
  },

  setError: error => {
    set({ error });
  },

  signIn: async (email, password) => {
    try {
      set({ isLoading: true, error: null });
      console.log('🔐 Auth store: signIn called with email:', email);
      console.log('🔐 Auth store: About to call AuthenticationService.signInWithEmailAndPassword');

      const user = await AuthenticationService.signInWithEmailAndPassword(email, password);
      console.log('✅ Auth store: signIn successful, user:', user.uid);

      // Update auth state immediately
      console.log('🔄 Auth store: Updating auth state to authenticated');
      set({ user, isAuthenticated: true, isLoading: false });

      // Also check onboarding status immediately - wrap in separate try-catch so sign-in completes
      try {
        console.log('🔍 Loading user profile for:', user.uid);
        const userProfile = await BackendService.getDocument<UserProfile>(
          'users',
          user.uid,
        );

        console.log('📄 User profile loaded:', userProfile ? 'exists' : 'not found');

        if (userProfile && userProfile.isOnboardingComplete) {
          console.log('✅ Onboarding complete - showing main app');
          set({
            isOnboardingComplete: true,
            businessInfo: userProfile.businessInfo || null,
          });
        } else if (!userProfile) {
          // No profile exists - this is a NEW user who needs to complete onboarding
          console.log('🆕 No user profile found - NEW USER, sending to onboarding');
          set({
            isOnboardingComplete: false,
            businessInfo: null,
          });
        } else {
          console.log('❌ Onboarding not complete - showing onboarding');
          set({
            isOnboardingComplete: false,
            businessInfo: null,
          });
        }
      } catch (profileError) {
        console.error(
          '❌ Error loading onboarding status from Firebase:',
          profileError instanceof Error ? profileError.message : 'Unknown error',
        );
        // On error, default to NOT complete to force onboarding (safer default)
        console.warn('⚠️ Error loading profile - defaulting to onboarding NOT complete');
        set({
          isOnboardingComplete: false,
          businessInfo: null,
        });
      }

      console.log('🎉 Auth store: signIn process completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign in failed';

      // Check if this is a storage space error - these are non-critical and shouldn't block sign-in
      const isStorageError = errorMessage.includes('No space left on device') ||
                            errorMessage.includes('NSCocoaErrorDomain Code=640') ||
                            errorMessage.includes("can't save the file");

      if (isStorageError) {
        console.warn('⚠️ Auth store: Storage error during sign-in (non-critical):', errorMessage);
        // Try to recover - check if Firebase actually signed in the user
        const { auth } = await import('../config/firebase');
        if (auth.currentUser) {
          console.log('✅ Firebase user exists despite storage error, recovering...');
          const UserService = (await import('../services/auth/UserService')).default;
          const user = await UserService.mapFirebaseUser(auth.currentUser);
          set({ user, isAuthenticated: true, isLoading: false, error: null });
          return; // Successfully recovered
        }
      }

      console.error('❌ Auth store sign-in error:', errorMessage);
      console.error('❌ Auth store error details:', {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        name: error instanceof Error ? error.name : 'Unknown error type',
      });
      // AGENTS.md Section 8: Always reset loading state, even on error
      set({ error: errorMessage, isLoading: false, isAuthenticated: false });
      throw error;
    } finally {
      // Extra safety: ensure loading is always turned off (AGENTS.md Section 8)
      set(state => ({ ...state, isLoading: false }));
    }
  },

  signUp: async (email, password) => {
    try {
      set({ isLoading: true, error: null });
      const user = await AuthenticationService.createUserWithEmailAndPassword(email, password);

      // Create initial user profile in Firestore with onboarding incomplete
      await BackendService.setDocument('users', user.uid, {
        uid: user.uid,
        email: user.email,
        isOnboardingComplete: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      set({
        user,
        isAuthenticated: true,
        isOnboardingComplete: false, // New users need to complete onboarding
        isLoading: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign up failed';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  signOut: async () => {
    try {
      set({ isLoading: true });
      await AuthenticationService.signOut();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        onboardingProgress: null,
        isOnboardingComplete: false,
        businessInfo: null,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign out failed';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  deleteAccount: async () => {
    try {
      const { user } = get();
      if (!user) {
        throw new Error('No user logged in');
      }

      set({ isLoading: true, error: null });

      // Delete all user data from Firestore first
      await UserDataDeletionService.deleteAllUserData(user.uid);

      // Delete Firebase Auth account
      await AuthenticationService.deleteAccount();

      // Clear local state
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        onboardingProgress: null,
        isOnboardingComplete: false,
        businessInfo: null,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Account deletion failed';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  setOnboardingProgress: progress => {
    set({ onboardingProgress: progress });
  },

  loadOnboardingProgress: async () => {
    const { user } = get();
    if (!user) return;

    try {
      const progress = await OnboardingProgressService.loadProgress(user.uid);
      if (progress && !progress.isCompleted) {
        console.log('✅ Loaded saved onboarding progress from Firestore');
        set({ onboardingProgress: progress });
      }
    } catch (error) {
      console.error('❌ Failed to load onboarding progress:', error);
    }
  },

  updateOnboardingStep: async (step, data) => {
    const currentProgress = get().onboardingProgress;
    const { user } = get();
    if (!currentProgress) return;

    const updatedProgress = {
      ...currentProgress,
      currentStep: step,
      completedSteps: [...new Set([...currentProgress.completedSteps, step])],
      formData: { ...currentProgress.formData, ...data },
      updatedAt: new Date(),
    };

    set({ onboardingProgress: updatedProgress });

    // Auto-save progress to Firestore after every step
    if (user) {
      await OnboardingProgressService.saveProgress(updatedProgress);
    }

    // If firstName and/or lastName are being updated, save them immediately to the database
    if (user && (data.firstName || data.lastName)) {
      try {
        const nameData: any = {};
        if (data.firstName || data.lastName) {
          const firstName = data.firstName || currentProgress.formData.firstName || '';
          const lastName = data.lastName || currentProgress.formData.lastName || '';
          // Save both combined name and separate firstName/lastName
          nameData.name = `${firstName} ${lastName}`.trim();
          nameData.firstName = firstName;
          nameData.lastName = lastName;
        }

        if (Object.keys(nameData).length > 0) {
          await BackendService.mergeDocument('users', user.uid, {
            ...nameData,
            updatedAt: new Date().toISOString(),
          });
          console.log('✅ Name saved to database - First:', nameData.firstName, 'Last:', nameData.lastName);
        }
      } catch (error) {
        console.warn('⚠️ Could not save name to database:', error);
      }
    }
  },

  completeOnboarding: async (workspaceId?: string) => {
    const currentProgress = get().onboardingProgress;
    const { user } = get();

    if (!user || !currentProgress) {
      console.error('Cannot complete onboarding: missing user or progress data');
      return;
    }

    try {
      // Ensure we have a workspace ID - get from workspace store or create one
      let finalWorkspaceId = workspaceId;

      if (!finalWorkspaceId) {
        // Import workspace store to get or create workspace
        const { default: useWorkspaceStore } = await import('./workspaceStore');
        const workspaceState = useWorkspaceStore.getState();

        // Check if user has a current workspace
        if (workspaceState.currentWorkspace) {
          finalWorkspaceId = workspaceState.currentWorkspace.id;
          console.log('✅ Using current workspace for knowledge items:', finalWorkspaceId);
        } else if (workspaceState.workspaces.length > 0) {
          // Use first available workspace
          finalWorkspaceId = workspaceState.workspaces[0].id;
          console.log('✅ Using first workspace for knowledge items:', finalWorkspaceId);
        } else {
          // Create a default workspace
          const defaultWorkspace: Omit<Workspace, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
            name: currentProgress.formData.businessName || 'My Workspace',
            description: 'Your personal workspace for AI agents and projects',
            stats: {
              files: 0,
              media: 0,
              snippets: 0,
              webpages: 0,
            },
            color: '#22C55E',
          };

          await workspaceState.addWorkspace(defaultWorkspace);

          // Get the newly created workspace
          const newWorkspace = workspaceState.getCurrentWorkspace();
          if (newWorkspace) {
            finalWorkspaceId = newWorkspace.id;
            console.log('✅ Created new workspace for knowledge items:', finalWorkspaceId);
          } else {
            // Fallback to 'default' if workspace creation somehow fails
            finalWorkspaceId = 'default';
            console.warn('⚠️ Could not get workspace ID, using "default"');
          }
        }
      }

      // Stripe customer creation removed during cleanup
      console.log('Stripe billing integration removed');

      // Save onboarding completion to Firebase using user ID as document ID
      // Generate agent GLB URL from avatarId (Ready Player Me format) - only for legacy users
      const agentGlbUrl = currentProgress.formData.avatarId
        ? `https://models.readyplayer.me/${currentProgress.formData.avatarId}.glb`
        : undefined;

      await BackendService.setDocument<UserProfile>('users', user.uid, {
        userId: user.uid,
        name: `${currentProgress.formData.firstName} ${currentProgress.formData.lastName}`.trim(),
        firstName: currentProgress.formData.firstName || '',
        lastName: currentProgress.formData.lastName || '',
        email: user.email || '',
        avatar: agentGlbUrl, // Save agent GLB URL to avatar field (legacy)
        language: 'en',
        timezone: 'UTC',
        preferences: {
          theme: 'system',
          notifications: true,
          autoSave: true,
        },
        isOnboardingComplete: true,
        onboardingCompletedAt: new Date(),
        onboardingData: currentProgress.formData,
        assignedAgentId: currentProgress.formData.assignedAgentId, // Personality type: 'sophia' or 'marcus'
        agentInstanceId: currentProgress.formData.agentInstanceId, // Unique agent instance ID per user
        businessInfo: {
          businessName: currentProgress.formData.businessName || '',
          website: currentProgress.formData.websiteInfo?.url,
          targetMarket: currentProgress.formData.targetMarket || '',
          productDescription: currentProgress.formData.productDescription || '',
          businessStage: currentProgress.formData.businessStage || 'startup',
          teamSize: currentProgress.formData.teamSize,
          businessStartDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Save each onboarding answer as individual knowledge items for easy editing
      const knowledgeItems = [
        {
          question: 'What is your first name?',
          answer: currentProgress.formData.firstName || '',
          title: 'My First Name',
          tags: ['personal-info', 'onboarding'],
          category: 'personal_profile',
        },
        {
          question: 'What is your last name?',
          answer: currentProgress.formData.lastName || '',
          title: 'My Last Name',
          tags: ['personal-info', 'onboarding'],
          category: 'personal_profile',
        },
        {
          question: 'What is your business name?',
          answer: currentProgress.formData.businessName || '',
          title: 'Business Name',
          tags: ['business-profile', 'onboarding', 'company-info'],
          category: 'business_basics',
        },
        {
          question: 'Who are your ideal customers?',
          answer: currentProgress.formData.targetMarket || '',
          title: 'Target Market / Ideal Customer Profile',
          tags: ['business-profile', 'onboarding', 'target-audience'],
          category: 'target_audience',
        },
        {
          question: 'What product or service do you offer?',
          answer: currentProgress.formData.productDescription || '',
          title: 'Product/Service Description',
          tags: ['business-profile', 'onboarding', 'product-info'],
          category: 'product_service',
        },
        {
          question: 'What stage is your business in?',
          answer: currentProgress.formData.businessStage || '',
          title: 'Business Stage',
          tags: ['business-profile', 'onboarding'],
          category: 'business_basics',
        },
        {
          question: 'What is your team size?',
          answer: currentProgress.formData.teamSize?.toString() || '',
          title: 'Team Size',
          tags: ['business-profile', 'onboarding'],
          category: 'business_basics',
        },
        {
          question: 'What is your website URL?',
          answer: currentProgress.formData.websiteInfo?.url || '',
          title: 'Website URL',
          tags: ['business-profile', 'onboarding', 'contact-info'],
          category: 'contact_information',
        },
      ];

      // Create individual knowledge items for each onboarding answer
      for (const item of knowledgeItems) {
        if (item.answer && item.answer.trim()) {
          try {
            const knowledgeData = {
              type: 'snippet' as const,
              title: item.title,
              content: `**${item.question}**\n\n${item.answer}`,
              tags: [...item.tags, 'editable'],
              description:
                'Onboarding information - You can edit this anytime in the Brain AI screen',
              workspaceId: finalWorkspaceId,
              metadata: {
                source: 'onboarding',
                editable: true,
                canDelete: true,
                questionText: item.question,
                originalAnswer: item.answer,
                category: item.category,
              },
              createdAt: new Date(),
            };

            // Save to users/{userId}/knowledge subcollection
            const knowledgeCollectionPath = `users/${user.uid}/knowledge`;
            await BackendService.createDocument<KnowledgeItem>(knowledgeCollectionPath, {
              ...knowledgeData,
              userId: user.uid,
            } as Omit<KnowledgeItem, 'id'> & { userId: string });

            console.log(`✅ Saved onboarding knowledge: ${item.title}`);
          } catch (err) {
            console.warn(`⚠️ Could not save ${item.title}:`, err);
          }
        }
      }

      console.log('Onboarding data saved to Firebase successfully');

      // Delete the saved onboarding progress since it's now complete
      await OnboardingProgressService.deleteProgress(user.uid);
    } catch (error) {
      console.warn(
        'Could not save onboarding data to Firebase - will use local storage until Firestore rules are deployed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      // Continue with completion even if Firebase save fails - local AsyncStorage will work fine
    }

    // Initialize the quest system for the user
    try {
      const { default: useQuestStore } = await import('./questStore');
      await useQuestStore.getState().initializeQuests();
      console.log('✅ Quest system initialized for user');
    } catch (questError) {
      console.warn('⚠️ Could not initialize quest system:', questError);
      // Continue - quests can be initialized later
    }

    set({
      isOnboardingComplete: true,
      onboardingProgress: null,
    });
  },

  setBusinessInfo: businessInfo => {
    set({ businessInfo });
  },

  clearOnboarding: () => {
    set({
      onboardingProgress: null,
      isOnboardingComplete: false,
    });
  },

  initialize: () => {
    console.log('🔄 Auth store: Initializing...');

    // Subscribe to auth state changes
    const unsubscribe = AuthenticationService.onAuthStateChanged(async authState => {
      console.log('🔄 Auth store: Auth state changed', {
        isAuthenticated: authState.isAuthenticated,
        hasUser: !!authState.user,
        isLoading: authState.isLoading,
        error: authState.error,
      });

      set({
        user: authState.user,
        isAuthenticated: authState.isAuthenticated,
        isLoading: authState.isLoading,
        error: authState.error,
      });

      // Load onboarding status from Firebase when user signs in
      if (authState.user && authState.isAuthenticated) {
        try {
          console.log('🔍 Loading user profile for:', authState.user.uid);
          const userProfile = await BackendService.getDocument<UserProfile>(
            'users',
            authState.user.uid,
          );

          console.log('📄 User profile loaded:', userProfile ? 'exists' : 'not found');

          if (userProfile && userProfile.isOnboardingComplete) {
            console.log('✅ Onboarding complete - showing main app');
            set({
              isOnboardingComplete: true,
              businessInfo: userProfile.businessInfo || null,
            });
          } else if (!userProfile) {
            // No profile exists - this is a NEW user who needs to complete onboarding
            console.log('🆕 No user profile found - NEW USER, sending to onboarding');
            set({
              isOnboardingComplete: false,
              businessInfo: null,
            });
          } else {
            console.log('❌ Onboarding not complete - showing onboarding');
            set({
              isOnboardingComplete: false,
              businessInfo: null,
            });
          }
        } catch (error) {
          console.error(
            '❌ Error loading onboarding status from Firebase:',
            error instanceof Error ? error.message : 'Unknown error',
          );
          // On error, default to NOT complete to force onboarding (safer default)
          console.warn('⚠️ Error loading profile - defaulting to onboarding NOT complete');
          set({
            isOnboardingComplete: false,
            businessInfo: null,
          });
        }
      } else {
        // User signed out - clear onboarding state
        console.log('🔓 Auth store: User signed out, clearing onboarding state');
        set({
          isOnboardingComplete: false,
          businessInfo: null,
        });
      }
    });

    // Store unsubscribe function for cleanup
    set({ _unsubscribe: unsubscribe });
  },
}));

export default useAuthStore;
