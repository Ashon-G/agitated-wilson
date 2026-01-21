/**
 * Onboarding Helper Functions
 * Utilities to support the onboarding flow
 */

import useWorkspaceStore from '../state/workspaceStore';
import { Workspace } from '../types/app';

/**
 * Get or create a workspace for onboarding knowledge items
 * Returns the workspace ID to use when saving knowledge
 */
export async function getOrCreateOnboardingWorkspaceId(
  userId: string,
  businessName?: string,
): Promise<string> {
  try {
    // Get fresh state from store
    let workspaceState = useWorkspaceStore.getState();

    // Check if user has a current workspace
    if (workspaceState.currentWorkspace) {
      console.log('✅ Using current workspace for onboarding:', workspaceState.currentWorkspace.id);
      return workspaceState.currentWorkspace.id;
    }

    // Check if user has any workspaces loaded
    if (workspaceState.workspaces.length > 0) {
      const firstWorkspace = workspaceState.workspaces[0];
      console.log('✅ Using first workspace for onboarding:', firstWorkspace.id);
      // Also set it as current workspace
      workspaceState.setCurrentWorkspace(firstWorkspace.id);
      return firstWorkspace.id;
    }

    // Workspaces might not be loaded yet - try loading them first
    console.log('🔄 No workspaces found in state, attempting to load...');
    await workspaceState.loadWorkspaces();

    // Re-fetch state after loading
    workspaceState = useWorkspaceStore.getState();

    if (workspaceState.workspaces.length > 0) {
      const firstWorkspace = workspaceState.workspaces[0];
      console.log('✅ Found workspace after loading:', firstWorkspace.id);
      workspaceState.setCurrentWorkspace(firstWorkspace.id);
      return firstWorkspace.id;
    }

    // Create a default workspace for the user
    console.log('📝 Creating new workspace for onboarding...');
    const defaultWorkspace: Omit<Workspace, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
      name: businessName || 'My Workspace',
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

    // Re-fetch state after adding - the addWorkspace sets currentWorkspace
    workspaceState = useWorkspaceStore.getState();

    // Get the newly created workspace from the updated state
    if (workspaceState.currentWorkspace) {
      console.log('✅ Created workspace for onboarding:', workspaceState.currentWorkspace.id);
      return workspaceState.currentWorkspace.id;
    }

    // Additional fallback: check workspaces array directly
    if (workspaceState.workspaces.length > 0) {
      const lastWorkspace = workspaceState.workspaces[workspaceState.workspaces.length - 1];
      console.log('✅ Using last created workspace for onboarding:', lastWorkspace.id);
      workspaceState.setCurrentWorkspace(lastWorkspace.id);
      return lastWorkspace.id;
    }

    // This should not happen, but log an error if it does
    console.error('❌ Could not create or find workspace after all attempts');
    throw new Error('Failed to create workspace for onboarding');
  } catch (error) {
    console.error('❌ Error getting/creating workspace:', error);
    throw error; // Propagate the error instead of returning 'default'
  }
}
