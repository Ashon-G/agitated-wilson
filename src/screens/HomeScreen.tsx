import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useProfileStore from '../state/profileStore';
import useInboxStore from '../state/inboxStore';
import useWorkspaceStore from '../state/workspaceStore';
import useQuestStore from '../state/questStore';
import useDashboardUIStore from '../state/dashboardUIStore';
import GlobalHeader from '../components/GlobalHeader';
import Agent3D, { Agent3DRef } from '../components/Agent3D';
import { DashboardOverlay } from '../components/dashboard';
import { useWorkspaceColor } from '../hooks/useWorkspaceColor';
import { withScreenErrorBoundary } from '../components/ScreenErrorBoundary';
import { AgentId } from '../data/agentPersonalities';

// Memoized Agent3D wrapper to prevent re-renders
const MemoizedAgent3D = memo(Agent3D);

function HomeScreen() {
  // Use selectors to subscribe only to specific slices of state
  const profile = useProfileStore(s => s.profile);
  const isLoading = useProfileStore(s => s.isLoading);
  const navigation = useNavigation<any>();
  const workspaceColor = useWorkspaceColor();
  const currentWorkspaceId = useWorkspaceStore(s => s.currentWorkspace?.id);
  const loadInboxItems = useInboxStore(s => s.loadInboxItems);
  const loadQuests = useQuestStore(s => s.loadQuests);
  const questsInitialized = useQuestStore(s => s.isInitialized);
  const [agentId, setAgentId] = useState<AgentId | null>(null);
  const [checkedForAgent, setCheckedForAgent] = useState(false);

  // Use persisted greeting state from store (survives tab switches)
  const hasPlayedGreeting = useDashboardUIStore(s => s.hasPlayedGreeting);
  const setGreetingPlayed = useDashboardUIStore(s => s.setGreetingPlayed);

  const hasAttemptedRedirect = useRef(false);

  // Ref for Agent3D to trigger speech
  const agentRef = useRef<Agent3DRef>(null);

  // Track if we've spoken to avoid repeat speech
  const lastSpokenMessageRef = useRef<string | null>(null);

  // Use a selector that calculates the count directly to avoid re-renders
  // when inbox items array reference changes but relevant count stays the same
  const pendingItemsCount = useInboxStore(
    useCallback(
      (s) => {
        if (!currentWorkspaceId) return 0;
        return s.inboxItems.filter(
          item => item.workspaceId === currentWorkspaceId && item.status === 'pending',
        ).length;
      },
      [currentWorkspaceId],
    ),
  );

  // Memoize hasInboxItems to prevent unnecessary re-computations
  const hasInboxItems = pendingItemsCount > 0;

  // Load inbox items when workspace changes - only on first mount for this workspace
  useEffect(() => {
    if (currentWorkspaceId) {
      // Pass reset=false to skip loading if we already have data for this workspace
      loadInboxItems(currentWorkspaceId, false).catch(error => {
        console.error('Failed to load inbox items:', error);
      });
    }
  }, [currentWorkspaceId]); // Remove loadInboxItems from deps - it's a stable store function

  // Load quests when component mounts
  useEffect(() => {
    if (profile && !questsInitialized) {
      loadQuests().catch(error => {
        console.error('Failed to load quests:', error);
      });
    }
  }, [profile, questsInitialized, loadQuests]);

  // Handle speech trigger from dashboard - only after greeting completes
  const handleSpeechTrigger = useCallback((message: string) => {
    // Wait for greeting to complete before dashboard speech
    if (!hasPlayedGreeting) {
      console.log('[HomeScreen] Skipping dashboard speech - greeting not complete');
      return;
    }

    // Don't repeat the same message
    if (lastSpokenMessageRef.current === message) return;

    // Only speak if agent is ready
    if (agentRef.current) {
      lastSpokenMessageRef.current = message;
      agentRef.current.speak(message);
    }
  }, [hasPlayedGreeting]);

  // Memoize the greeting complete callback to prevent Agent3D re-renders
  const handleGreetingComplete = useCallback(() => {
    console.log('[HomeScreen] Greeting complete - enabling dashboard speech');
    setGreetingPlayed();
  }, [setGreetingPlayed]);

  // Reset speech tracking when screen loses focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      lastSpokenMessageRef.current = null;
    });
    return unsubscribe;
  }, [navigation]);

  // Extract agentId from user profile
  useEffect(() => {
    if (!profile || isLoading) return;

    console.log('🔍 Checking for agent...', {
      hasAssignedAgentId: !!profile?.assignedAgentId,
      hasAttemptedRedirect: hasAttemptedRedirect.current,
    });

    // Check for assigned agent from personality system
    // assignedAgentId is stored directly on profile, not in onboardingData
    if (profile?.assignedAgentId) {
      const assignedAgent = profile.assignedAgentId as AgentId;
      setAgentId(assignedAgent);
      setCheckedForAgent(true);
      hasAttemptedRedirect.current = false;
      console.log('🎭 Agent ID loaded from assigned personality:', assignedAgent);
    } else {
      // No agent found - user needs to complete onboarding
      console.log('⚠️ No agent found for user - user needs to complete onboarding');
      setCheckedForAgent(true);
      setAgentId(null);
    }
  }, [profile, isLoading, navigation]);

  // Re-check agent only if it's not already set (avoid unnecessary state updates)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Only log, don't re-set state if agent is already loaded
      // This prevents unnecessary re-renders on tab switches
      if (!agentId && profile?.assignedAgentId) {
        console.log('🏠 Home screen focused - loading agent');
        const assignedAgent = profile.assignedAgentId as AgentId;
        setAgentId(assignedAgent);
        setCheckedForAgent(true);
      }
    });

    return unsubscribe;
  }, [navigation, profile?.assignedAgentId, agentId]);

  // Show loading spinner if profile is still loading or we haven't checked yet
  if (isLoading || !checkedForAgent) {
    return (
      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={workspaceColor.color} />
        </View>
        <GlobalHeader title="Home" transparent={true} />
      </View>
    );
  }

  // If no agent, show loading while redirecting (will navigate to AgentCreator)
  if (!agentId) {
    return (
      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={workspaceColor.color} />
        </View>
        <GlobalHeader title="Home" transparent={true} />
      </View>
    );
  }

  // Log the workspace color being used
  console.log('🎨 HomeScreen using workspace color:', workspaceColor.color);

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      {/* Agent 3D Viewer - Full Screen (no safe area, can go behind status bar) */}
      <View style={{ flex: 1 }}>
        <MemoizedAgent3D
          ref={agentRef}
          agentId={agentId}
          accepted={true}
          userName={profile?.name || profile?.onboardingData?.firstName || 'there'}
          workspaceColor={workspaceColor.color}
          transparentBottom={true}
          hasInboxItems={hasInboxItems}
          onGreetingComplete={handleGreetingComplete}
        />
      </View>

      {/* Dashboard Overlay - All cards (activity, approvals, inbox, quests, questions, stats) */}
      {hasPlayedGreeting && (
        <DashboardOverlay onSpeechTrigger={handleSpeechTrigger} />
      )}

      {/* Fixed Header - Overlay with safe area */}
      <GlobalHeader title="Home" transparent={true} />
    </View>
  );
}

export default withScreenErrorBoundary('HomeScreen', {
  showRetryButton: true,
  maxRetries: 3,
  fallbackMessage: 'Something went wrong with the Home screen. Please try again.',
})(HomeScreen);
