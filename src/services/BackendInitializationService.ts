/**
 * Backend Initialization Service
 * Manages backend service initialization after authentication
 */

import AuthenticationService from './AuthenticationService';
import BackendService from './BackendService';
// SalesAgentCore is initialized via its own constructor - no import needed
import AgentInboxService from './AgentInboxService';
import ProactiveQuestionService from './ProactiveQuestionService';
import DataMigrationService from './DataMigrationService';
import OfflineService from './OfflineService';
import SecurityValidationService from './SecurityValidationService';
import RedditOAuthService from '../integrations/RedditOAuthService';
import HuntingEngine from './HuntingEngine';
import NotificationService from './NotificationService';
import useBrainStore from '../state/brainStore';
import useWorkspaceStore from '../state/workspaceStore';
// Note: PendingCommentService removed - comments are now posted via Cloud Function

interface InitializationProgress {
  step: string;
  progress: number; // 0-100
  isComplete: boolean;
  error?: string;
}

interface InitializationOptions {
  autoMigrate?: boolean;
  validateSecurity?: boolean;
  restoreOfflineData?: boolean;
}

class BackendInitializationService {
  private isInitialized = false;
  private listeners: Array<(progress: InitializationProgress) => void> = [];

  /**
   * Add initialization progress listener
   */
  addProgressListener(listener: (progress: InitializationProgress) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove initialization progress listener
   */
  removeProgressListener(listener: (progress: InitializationProgress) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyProgress(step: string, progress: number, error?: string): void {
    const progressData: InitializationProgress = {
      step,
      progress,
      isComplete: progress >= 100,
      error,
    };

    this.listeners.forEach(listener => {
      try {
        listener(progressData);
      } catch (listenerError) {
        console.error('Backend initialization progress listener error:', listenerError);
      }
    });
  }

  /**
   * Initialize all backend services after authentication
   */
  async initializeBackendServices(options: InitializationOptions = {}): Promise<void> {
    const { autoMigrate = false, validateSecurity = true, restoreOfflineData = true } = options;

    if (this.isInitialized) {
      console.log('Backend services already initialized');
      return;
    }

    try {
      this.notifyProgress('Starting backend initialization...', 0);

      // Step 1: Verify user authentication
      this.notifyProgress('Checking authentication...', 10);
      const currentUser = AuthenticationService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User must be authenticated before backend initialization');
      }

      // Step 2: Initialize backend service
      this.notifyProgress('Initializing backend service...', 20);
      await BackendService.initialize();

      // Step 3: Initialize enhanced sales agent core with Vertex AI Agent Builder
      this.notifyProgress('Initializing enhanced sales agent core...', 30);

      // Step 3.5: Skip agent initialization - agent will be created when user connects Reddit
      this.notifyProgress('Preparing agent system...', 35);
      console.log(
        'ℹ️ Agent initialization skipped - agent will be created after Reddit connection',
      );

      // Step 4: Initialize inbox service with real-time listeners
      this.notifyProgress('Setting up inbox service...', 40);
      // AgentInboxService initialization is handled in its constructor

      // Set up real-time inbox listener for the user
      AgentInboxService.setupRealtimeListener(currentUser.uid, (items: any[]) => {
        console.log(`Received ${items.length} inbox updates`);
      });

      // Step 5: Initialize offline service
      this.notifyProgress('Setting up offline capabilities...', 50);
      // OfflineService initialization is handled in its constructor

      // Step 6: Restore offline data if requested
      if (restoreOfflineData) {
        try {
          this.notifyProgress('Restoring offline data...', 60);
          await OfflineService.syncPendingOperations();
        } catch (offlineError) {
          console.warn(
            'Offline data restoration failed, continuing with initialization:',
            offlineError,
          );
          // Don't fail the entire initialization due to offline sync issues
        }
      }

      // Step 7: Check for data migration if requested
      if (autoMigrate) {
        try {
          this.notifyProgress('Checking for data migration...', 70);
          const analysis = await DataMigrationService.analyzeExistingData();
          const totalItems = Object.values(analysis).reduce(
            (sum, count) => sum + (typeof count === 'number' ? count : 0),
            0,
          );

          if (totalItems > 0) {
            console.log(`Found ${totalItems} items that can be migrated from AsyncStorage`);
            this.notifyProgress('Migrating legacy data...', 75);
            await DataMigrationService.migrateAllData({
              dryRun: false,
              backup: true,
              batchSize: 5,
            });
          }
        } catch (migrationError) {
          console.warn('Data migration failed, continuing with initialization:', migrationError);
          // Don't fail the entire initialization due to migration issues
        }
      }

      // Step 8: Initialize platform services and restore integrations
      this.notifyProgress('Initializing platform integrations...', 85);

      // Restore Reddit connection from Firestore if available
      try {
        const redditRestored = await RedditOAuthService.restoreTokensFromFirestore();
        if (redditRestored) {
          console.log('✅ Reddit connection restored from Firestore');

          // Start hunting engine automatically when Reddit is connected!
          this.notifyProgress('Starting lead hunting engine...', 87);
          await this.startHuntingEngine(currentUser.uid);
        }
      } catch (redditError) {
        console.warn('Reddit connection restoration failed:', redditError);
        // Don't fail initialization - user can reconnect manually if needed
      }

      // Step 9: Security validation if requested
      if (validateSecurity) {
        try {
          this.notifyProgress('Validating security configuration...', 90);
          const securityReport = await SecurityValidationService.generateSecurityReport();

          if (securityReport.summary.criticalIssues > 0) {
            console.warn('Security issues detected:', securityReport.summary);
          } else {
            console.log('Security validation passed:', securityReport.summary.overallRating);
          }
        } catch (securityError) {
          console.warn(
            'Security validation failed, continuing with initialization:',
            securityError,
          );
          // Don't fail the entire initialization due to security validation issues
        }
      }

      // Step 10: Initialize push notifications
      try {
        this.notifyProgress('Setting up push notifications...', 90);
        const notificationsEnabled = await NotificationService.initialize();

        if (notificationsEnabled) {
          console.log('✅ Push notifications initialized');

          // Schedule predetermined notifications (daily reminders, weekly recaps, etc.)
          await NotificationService.scheduleAllPredeterminedNotifications();

          // Schedule inactivity reminder (resets each time app opens)
          await NotificationService.scheduleInactivityReminder(3); // 3 days
        } else {
          console.log('⚠️ Push notifications not available (simulator or permission denied)');
        }
      } catch (notificationError) {
        console.warn(
          'Push notification setup failed, continuing with initialization:',
          notificationError,
        );
        // Don't fail the entire initialization due to notification issues
      }

      // Step 11: Initialize proactive question system
      try {
        this.notifyProgress('Setting up proactive questions...', 95);
        await ProactiveQuestionService.initialize(currentUser.uid);

        console.log('✅ Proactive questions initialized');
      } catch (questionError) {
        console.warn(
          'Proactive question setup failed, continuing with initialization:',
          questionError,
        );
        // Don't fail the entire initialization due to question setup issues
      }

      // Note: Pending comments are now posted via Cloud Function (onPendingCommentCreated)
      // No client-side listener needed - comments post even when app is closed

      // Step 12: Complete initialization
      this.notifyProgress('Backend initialization complete', 100);
      this.isInitialized = true;

      console.log('✅ Backend services initialization completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';

      // Safely log the error without potentially causing string length issues
      if (error instanceof Error) {
        console.error('❌ Backend services initialization failed:', {
          name: error.name,
          message:
            error.message.length > 1000 ? `${error.message.substring(0, 1000)  }...` : error.message,
          stack: error.stack ? error.stack.substring(0, 2000) : 'No stack trace available',
        });
      } else {
        console.error('❌ Backend services initialization failed with unknown error type');
      }

      this.notifyProgress('Backend initialization failed', 0, errorMessage);
      throw error;
    }
  }

  /**
   * Check if backend services are initialized
   */
  isBackendInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Reset initialization state (useful for testing or re-initialization)
   */
  reset(): void {
    this.isInitialized = false;

    // Clean up any existing listeners
    const currentUser = AuthenticationService.getCurrentUser();
    if (currentUser) {
      AgentInboxService.removeRealtimeListener(currentUser.uid);
    }

    // Clean up notification listeners
    NotificationService.cleanup();
  }

  /**
   * Clean up all backend services
   */
  async cleanup(): Promise<void> {
    try {
      console.log('Cleaning up backend services...');

      // Clean up inbox listeners
      const currentUser = AuthenticationService.getCurrentUser();
      if (currentUser) {
        AgentInboxService.removeRealtimeListener(currentUser.uid);
      }

      // Note: PendingCommentService removed - comments now posted via Cloud Function

      // Dispose services (only if they have dispose methods)
      try {
        if (typeof OfflineService.dispose === 'function') {
          OfflineService.dispose();
        }
      } catch (offlineError) {
        console.warn('OfflineService disposal failed:', offlineError);
      }

      try {
        if (typeof BackendService.dispose === 'function') {
          BackendService.dispose();
        }
      } catch (backendError) {
        console.warn('BackendService disposal failed:', backendError);
      }

      // Note: AgentInboxService doesn't have a dispose method, so we skip it
      // The service cleanup is handled by removing listeners above

      this.isInitialized = false;
      this.listeners = [];

      console.log('✅ Backend services cleanup completed');
    } catch (error) {
      // Enhanced error handling to prevent "undefined is not a function" errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown cleanup error';
      const errorName = error instanceof Error ? error.name : 'UnknownError';

      console.error('❌ Error during backend services cleanup:', {
        name: errorName,
        message: errorMessage,
        type: typeof error,
        isError: error instanceof Error,
      });
    }
  }

  /**
   * Start the hunting engine with user's configured subreddits
   * NEW FLOW: Now reads agent settings from agentSettingsStore (configured in 3-step wizard)
   */
  private async startHuntingEngine(userId: string): Promise<void> {
    try {
      console.log('🚀 [BackendInit] Starting hunting engine...');

      // Get user's selected subreddits from Firestore
      const userDoc = await BackendService.getDocument<{
        selectedSubreddits?: string[];
        huntingConfig?: {
          subreddits: string[];
          keywords: string[];
          minLeadScore: number;
          requireApproval: boolean;
        };
      }>('users', userId);

      // Get subreddits from user config or use defaults
      const subreddits = userDoc?.huntingConfig?.subreddits ||
        userDoc?.selectedSubreddits ||
        ['entrepreneur', 'smallbusiness', 'startups'];

      if (subreddits.length === 0) {
        console.log('⚠️ [BackendInit] No subreddits configured, using defaults');
        subreddits.push('entrepreneur', 'smallbusiness', 'startups');
      }

      // Get knowledge context from brain store
      const brainState = useBrainStore.getState();
      const knowledgeItems = brainState.knowledgeItems || [];

      // Build knowledge context string
      const knowledgeContext = knowledgeItems
        .map(item => `${item.title || ''}: ${item.content || ''}`)
        .join('\n\n')
        .substring(0, 5000); // Limit context size

      // NEW FLOW: Read agent settings from agentSettingsStore (configured in 3-step wizard)
      const useAgentSettingsStore = (await import('../state/agentSettingsStore')).default;
      await useAgentSettingsStore.getState().loadSettings();
      const agentSettings = useAgentSettingsStore.getState().settings;

      // Initialize hunting session with config
      let config;
      if (agentSettings) {
        // Use settings from 3-step wizard
        console.log('🎯 [BackendInit] Using agent settings from wizard:', {
          scoreThreshold: agentSettings.scoreThreshold,
          postAgeLimitDays: agentSettings.postAgeLimitDays,
          commentStyle: agentSettings.commentStyle,
          requireApproval: agentSettings.requireApproval,
        });
        config = {
          subreddits,
          keywords: userDoc?.huntingConfig?.keywords || [],
          minLeadScore: agentSettings.scoreThreshold * 10, // Convert 1-10 scale to 10-100
          maxPostAge: agentSettings.postAgeLimitDays * 24, // Convert days to hours
          commentStyle: agentSettings.commentStyle,
          requireApproval: agentSettings.requireApproval,
        };
      } else {
        // Fallback to old config
        console.log('⚠️ [BackendInit] No agent settings found, using defaults');
        config = {
          subreddits,
          keywords: userDoc?.huntingConfig?.keywords || [],
          minLeadScore: userDoc?.huntingConfig?.minLeadScore || 70,
          maxPostAge: 168, // 1 week in hours
          commentStyle: 'friendly' as const,
          requireApproval: userDoc?.huntingConfig?.requireApproval ?? true, // Default to requiring approval
        };
      }

      await HuntingEngine.initSession(userId, config);

      // Start hunting with knowledge context
      console.log(`🎯 [BackendInit] Starting hunt across ${subreddits.length} subreddits: ${subreddits.join(', ')}`);

      // Run hunting in background (don't await - let it run async)
      HuntingEngine.startHunting(knowledgeContext, (progress) => {
        console.log(`📊 [HuntingProgress] ${progress.status}: ${progress.message} (${progress.progress}%)`);
      }).catch(error => {
        console.error('🔴 [BackendInit] Hunting error:', error);
      });

      console.log('✅ [BackendInit] Hunting engine started successfully');
    } catch (error) {
      console.error('🔴 [BackendInit] Failed to start hunting engine:', error);
      // Don't throw - hunting failure shouldn't break app initialization
    }
  }

  /**
   * Initialize backend services with progress tracking for UI
   */
  async initializeWithProgress(
    options: InitializationOptions = {},
    progressCallback?: (progress: InitializationProgress) => void,
  ): Promise<void> {
    if (progressCallback) {
      this.addProgressListener(progressCallback);
    }

    try {
      await this.initializeBackendServices(options);
    } finally {
      if (progressCallback) {
        this.removeProgressListener(progressCallback);
      }
    }
  }

  /**
   * Quick health check for all backend services
   */
  async performBackendHealthCheck(): Promise<{
    backend: boolean;
    offline: boolean;
    authentication: boolean;
    security: number; // 0-100 score
    overallHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  }> {
    const health = {
      backend: false,
      offline: false,
      authentication: false,
      security: 0,
      overallHealth: 'CRITICAL' as 'HEALTHY' | 'WARNING' | 'CRITICAL',
    };

    try {
      // Check authentication
      health.authentication = AuthenticationService.getCurrentUser() !== null;

      // Check backend connectivity
      try {
        // Try a simple query to test backend
        await BackendService.queryDocuments('sales_agents', { limit: 1 }, { useCache: false });
        health.backend = true;
      } catch {
        health.backend = false;
      }

      // Check offline service
      const offlineState = OfflineService.getOfflineState();
      health.offline = offlineState.pendingOperations < 10; // Arbitrary threshold

      // Quick security check
      if (health.authentication) {
        try {
          const securityAudit = await SecurityValidationService.performSecurityAudit();
          health.security = securityAudit.overallScore;
        } catch {
          health.security = 0;
        }
      }

      // Determine overall health
      const healthyServices = [health.backend, health.offline, health.authentication].filter(
        Boolean,
      ).length;

      if (healthyServices === 3 && health.security >= 80) {
        health.overallHealth = 'HEALTHY';
      } else if (healthyServices >= 2 && health.security >= 60) {
        health.overallHealth = 'WARNING';
      } else {
        health.overallHealth = 'CRITICAL';
      }

      return health;
    } catch (error) {
      console.error('Backend health check failed:', error);
      return health; // Return critical health state
    }
  }
}

export default new BackendInitializationService();
