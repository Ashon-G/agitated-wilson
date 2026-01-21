import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import useAuthStore from '../state/authStore';
import useWorkspaceStore from '../state/workspaceStore';
import useProfileStore from '../state/profileStore';
import { useBackendInitialization } from '../hooks/useBackendInitialization';
import { useTheme } from '../contexts/ThemeContext';
import AppNavigator from './AppNavigator';
import AuthNavigator from './AuthNavigator';
import OnboardingNavigator from './OnboardingNavigator';

// Simple splash loader component
function TavaLoader() {
  const { isDark } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
    </View>
  );
}

export default function RootNavigator() {
  const [minimumLoadTime, setMinimumLoadTime] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const backendInitStartedRef = useRef(false);

  // Use selectors to avoid re-renders from unrelated state changes
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const isLoading = useAuthStore(s => s.isLoading);
  const isOnboardingComplete = useAuthStore(s => s.isOnboardingComplete);
  const initialize = useAuthStore(s => s.initialize);

  const workspaces = useWorkspaceStore(s => s.workspaces);
  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace);
  const setCurrentWorkspace = useWorkspaceStore(s => s.setCurrentWorkspace);
  const loadWorkspaces = useWorkspaceStore(s => s.loadWorkspaces);
  const workspacesLoading = useWorkspaceStore(s => s.isLoading);

  const loadProfile = useProfileStore(s => s.loadProfile);

  // Only enable backend initialization once conditions are met
  const shouldInitBackend = isAuthenticated && isOnboardingComplete && !backendInitStartedRef.current;

  // Initialize backend services ONLY when user is authenticated AND onboarding is complete
  const {
    isInitialized: isBackendInitialized,
    isInitializing: isBackendInitializing,
    error: backendError,
  } = useBackendInitialization({
    autoMigrate: true,
    validateSecurity: false, // Skip security validation for faster startup
    restoreOfflineData: true,
    initializeOnMount: shouldInitBackend,
  });

  // Mark that we've started backend init to prevent duplicate calls
  useEffect(() => {
    if (shouldInitBackend) {
      backendInitStartedRef.current = true;
    }
  }, [shouldInitBackend]);

  useEffect(() => {
    console.log('🔄 RootNavigator: Initializing auth...');
    initialize();
  }, [initialize]);

  // Enforce minimum 2 second load time (reduced from 3)
  useEffect(() => {
    console.log('⏱️ RootNavigator: Starting minimum load timer...');
    const timer = setTimeout(() => {
      console.log('✅ RootNavigator: Minimum load time complete');
      setMinimumLoadTime(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Mark as ready once auth loading is done and we have workspace data (if authenticated)
  useEffect(() => {
    console.log('📊 RootNavigator: Auth state -', {
      isLoading,
      isAuthenticated,
      isOnboardingComplete,
      workspacesLoading,
    });

    if (!isLoading) {
      if (isAuthenticated && isOnboardingComplete) {
        // Wait for workspaces to load before marking ready
        if (!workspacesLoading) {
          console.log('✅ RootNavigator: Ready to show app');
          // Add buffer for any final redirects
          const timer = setTimeout(() => {
            setIsReady(true);
          }, 100);
          return () => clearTimeout(timer);
        } else {
          // Workspaces are loading - ensure we show loader
          console.log('⏳ RootNavigator: Waiting for workspaces...');
          setIsReady(false);
        }
      } else if (!isAuthenticated) {
        // Not authenticated - show auth screen
        console.log('✅ RootNavigator: Ready to show auth');
        setIsReady(true);
      } else if (isAuthenticated && !isOnboardingComplete) {
        // In onboarding - show onboarding screen
        console.log('✅ RootNavigator: Ready to show onboarding');
        setIsReady(true);
      }
    }
  }, [isLoading, isAuthenticated, isOnboardingComplete, workspacesLoading]);

  // Load workspaces and profile when user authenticates
  useEffect(() => {
    if (isAuthenticated && isOnboardingComplete) {
      console.log('🔄 RootNavigator: Loading workspaces and profile...');
      loadWorkspaces();
      loadProfile();
    }
  }, [isAuthenticated, isOnboardingComplete, loadWorkspaces, loadProfile]);

  // Set current workspace if user has workspaces but none selected
  useEffect(() => {
    if (isAuthenticated && isOnboardingComplete && !workspacesLoading) {
      if (workspaces.length > 0 && !currentWorkspace) {
        console.log('🔄 RootNavigator: Setting default workspace');
        // Set first workspace as current if no current workspace
        setCurrentWorkspace(workspaces[0].id);
      }
    }
  }, [
    isAuthenticated,
    isOnboardingComplete,
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    workspacesLoading,
  ]);

  // Show loader until minimum time AND ready state
  if (minimumLoadTime || !isReady) {
    console.log('⏳ RootNavigator: Showing loader -', { minimumLoadTime, isReady });
    return <TavaLoader />;
  }

  // User is not authenticated - show auth screens only
  if (!isAuthenticated) {
    console.log('🔓 RootNavigator: Rendering AuthNavigator', {
      isAuthenticated,
      isOnboardingComplete,
      isLoading,
    });
    return <AuthNavigator />;
  }

  // User is authenticated but hasn't completed onboarding
  if (!isOnboardingComplete) {
    console.log('📝 RootNavigator: Rendering OnboardingNavigator', {
      isAuthenticated,
      isOnboardingComplete,
      isLoading,
    });
    return <OnboardingNavigator />;
  }

  // User is authenticated and onboarding is complete - show main app
  console.log('🏠 RootNavigator: Rendering AppNavigator', {
    isAuthenticated,
    isOnboardingComplete,
    isLoading,
  });
  return <AppNavigator />;
}
