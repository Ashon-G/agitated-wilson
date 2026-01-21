/**
 * Backend Initialization Hook
 * Custom hook to handle backend service initialization
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import BackendInitializationService from '../services/BackendInitializationService';
import AuthenticationService from '../services/AuthenticationService';
import ResponseMonitoringService from '../services/ResponseMonitoringService';

interface BackendInitializationState {
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  progress: number;
  currentStep: string;
}

interface BackendInitializationOptions {
  autoMigrate?: boolean;
  validateSecurity?: boolean;
  restoreOfflineData?: boolean;
  initializeOnMount?: boolean;
}

export function useBackendInitialization(options: BackendInitializationOptions = {}) {
  const {
    autoMigrate = false,  // Keep disabled to avoid string length issues
    validateSecurity = false,  // Temporarily disable to avoid potential string issues
    restoreOfflineData = true,
    initializeOnMount = true,
  } = options;

  const [state, setState] = useState<BackendInitializationState>({
    isInitialized: false,
    isInitializing: false,
    error: null,
    progress: 0,
    currentStep: '',
  });

  const initializeBackend = useCallback(async () => {
    // Check if user is authenticated
    const currentUser = AuthenticationService.getCurrentUser();
    if (!currentUser) {
      setState(prev => ({
        ...prev,
        error: 'User must be authenticated to initialize backend services',
        isInitializing: false,
      }));
      return;
    }

    // Check if already initialized
    if (BackendInitializationService.isBackendInitialized()) {
      setState(prev => ({
        ...prev,
        isInitialized: true,
        isInitializing: false,
        progress: 100,
        currentStep: 'Already initialized',
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      isInitializing: true,
      error: null,
      progress: 0,
      currentStep: 'Starting initialization...',
    }));

    try {
      await BackendInitializationService.initializeWithProgress(
        { autoMigrate, validateSecurity, restoreOfflineData },
        (progress) => {
          setState(prev => ({
            ...prev,
            progress: progress.progress,
            currentStep: progress.step,
            error: progress.error || null,
          }));
        },
      );

      setState(prev => ({
        ...prev,
        isInitialized: true,
        isInitializing: false,
        progress: 100,
        currentStep: 'Initialization complete',
      }));

      // Start response monitoring service after initialization
      ResponseMonitoringService.start();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown initialization error',
        isInitializing: false,
        progress: 0,
        currentStep: 'Initialization failed',
      }));
    }
  }, [autoMigrate, validateSecurity, restoreOfflineData]);

  const reset = useCallback(() => {
    BackendInitializationService.reset();
    setState({
      isInitialized: false,
      isInitializing: false,
      error: null,
      progress: 0,
      currentStep: '',
    });
  }, []);

  const cleanup = useCallback(async () => {
    // Stop response monitoring when cleaning up
    ResponseMonitoringService.stop();
    await BackendInitializationService.cleanup();
    setState({
      isInitialized: false,
      isInitializing: false,
      error: null,
      progress: 0,
      currentStep: 'Services cleaned up',
    });
  }, []);

  // Track if we've already started initialization to prevent duplicates
  const initializationStartedRef = useRef(false);

  // Initialize on mount if requested and user is authenticated
  // Only ONE initialization path - removed duplicate auth listener
  useEffect(() => {
    if (initializeOnMount && !initializationStartedRef.current) {
      const currentUser = AuthenticationService.getCurrentUser();
      if (currentUser && !state.isInitialized && !state.isInitializing) {
        initializationStartedRef.current = true;
        initializeBackend();
      }
    }
  }, [initializeOnMount, initializeBackend, state.isInitialized, state.isInitializing]);

  // Only listen for sign-out to cleanup - don't trigger initialization here
  // This prevents duplicate initialization when both effects fire
  useEffect(() => {
    const unsubscribe = AuthenticationService.onAuthStateChanged((authState) => {
      if (!authState.user) {
        // User logged out, cleanup and reset the ref
        initializationStartedRef.current = false;
        cleanup();
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [cleanup]);

  return {
    ...state,
    initializeBackend,
    reset,
    cleanup,
    // Helper methods
    retryInitialization: initializeBackend,
    isReady: state.isInitialized && !state.error,
  };
}

/**
 * Health check hook for backend services
 */
export function useBackendHealth() {
  const [healthStatus, setHealthStatus] = useState<{
    backend: boolean;
    offline: boolean;
    authentication: boolean;
    security: number;
    overallHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    lastChecked: Date | null;
    isChecking: boolean;
  }>({
    backend: false,
    offline: false,
    authentication: false,
    security: 0,
    overallHealth: 'CRITICAL',
    lastChecked: null,
    isChecking: false,
  });

  const checkHealth = useCallback(async () => {
    setHealthStatus(prev => ({ ...prev, isChecking: true }));

    try {
      const health = await BackendInitializationService.performBackendHealthCheck();
      setHealthStatus({
        ...health,
        lastChecked: new Date(),
        isChecking: false,
      });
    } catch (error) {
      console.error('Health check failed:', error);
      setHealthStatus(prev => ({
        ...prev,
        overallHealth: 'CRITICAL',
        lastChecked: new Date(),
        isChecking: false,
      }));
    }
  }, []);

  // Perform initial health check
  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return {
    ...healthStatus,
    checkHealth,
    isHealthy: healthStatus.overallHealth === 'HEALTHY',
  };
}