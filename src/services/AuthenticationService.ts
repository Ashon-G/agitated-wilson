/**
 * Authentication Service
 *
 * Main authentication service that orchestrates user authentication operations.
 * Uses smaller, focused services for better maintainability and separation of concerns.
 *
 * Features:
 * - Email/password authentication
 * - Anonymous authentication
 * - Session persistence via Firebase Auth (internal AsyncStorage)
 * - Automatic token refresh (handled by Firebase)
 * - Error handling and logging
 * - User state management with listeners
 *
 * @version 2.0.0
 * @author PaynaAI Team
 */

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import TokenService from './auth/TokenService';
import UserService, { AuthUser } from './auth/UserService';
import SessionService, { AuthState } from './auth/SessionService';
import CacheService from './CacheService';

// Re-export types for backward compatibility
export type { AuthUser } from './auth/UserService';
export type { AuthState } from './auth/SessionService';
export type { AuthTokens } from './auth/TokenService';

/**
 * Main authentication service class
 *
 * Provides methods for user authentication, token management, and session persistence.
 * Uses Firebase Auth for authentication and delegates to specialized services.
 */
class AuthenticationService {
  constructor() {
    this.initializeAuthListener();
  }

  /**
   * Initialize Firebase auth state listener
   *
   * Sets up a listener for Firebase authentication state changes.
   * Firebase Auth handles token persistence internally via AsyncStorage.
   *
   * @private
   */
  private initializeAuthListener() {
    onAuthStateChanged(auth, async firebaseUser => {
      try {
        if (firebaseUser) {
          const user = await UserService.mapFirebaseUser(firebaseUser);

          // User storage for quick access - non-blocking, failures are OK
          try {
            await UserService.securelyStoreUser(user);
          } catch (userStoreError) {
            console.warn('🟡 User storage failed (non-critical):', userStoreError);
          }

          // Identify user in LogRocket
          UserService.identifyUserInLogRocket(user);

          SessionService.handleSignIn(user);
        } else {
          await this.clearSecureStorage();
          SessionService.handleSignOut();
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        SessionService.setError(error instanceof Error ? error.message : 'Authentication error');
      }
    });
  }

  /**
   * Sign in with email and password
   *
   * Authenticates a user using their email and password credentials.
   * Updates the authentication state and stores user information securely.
   *
   * @param email - User's email address
   * @param password - User's password
   * @returns Promise resolving to the authenticated user
   * @throws {Error} If authentication fails
   *
   * @example
   * ```typescript
   * try {
   *   const user = await authService.signInWithEmailAndPassword('user@example.com', 'password123');
   *   console.log('User signed in:', user.uid);
   * } catch (error) {
   *   console.error('Sign in failed:', error.message);
   * }
   * ```
   */
  async signInWithEmailAndPassword(email: string, password: string): Promise<AuthUser> {
    try {
      console.log('🔐 AuthenticationService.signInWithEmailAndPassword called');
      SessionService.setLoading(true);
      SessionService.clearError();

      // Clean up expired cache to free storage space before sign-in
      try {
        // First try normal cleanup
        await CacheService.cleanup();
        // Then do aggressive cleanup to free more space
        const clearedCount = await CacheService.aggressiveCleanup();
        console.log(`🧹 Cache cleanup completed before sign-in (cleared ${clearedCount} items)`);
      } catch (cleanupError) {
        console.warn('⚠️ Cache cleanup failed (non-critical):', cleanupError);
      }

      console.log('📡 Calling Firebase signInWithEmailAndPassword...');

      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (firebaseError: any) {
        // Check if this is a storage error but the user actually got signed in
        const errorMessage = firebaseError?.message || '';
        const isStorageError = errorMessage.includes('No space left on device') ||
                              errorMessage.includes('NSCocoaErrorDomain Code=640') ||
                              errorMessage.includes("can't save the file");

        if (isStorageError && auth.currentUser) {
          // Firebase signed in the user but failed to persist - that's OK, we can continue
          console.warn('⚠️ Storage error during Firebase sign-in, but user is authenticated. Continuing...');
          const user = await UserService.mapFirebaseUser(auth.currentUser);
          return user;
        }

        // Re-throw if it's not a recoverable storage error
        throw firebaseError;
      }

      console.log('✅ Firebase sign-in successful, mapping user...');
      const user = await UserService.mapFirebaseUser(userCredential.user);
      console.log('✅ User mapped:', user.uid);

      return user;
    } catch (error) {
      console.error('❌ AuthenticationService sign-in error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Sign in failed';
      SessionService.setError(errorMessage);
      throw error;
    } finally {
      // AGENTS.md Section 8: Always reset loading state
      SessionService.setLoading(false);
    }
  }

  /**
   * Create account with email and password
   */
  async createUserWithEmailAndPassword(email: string, password: string): Promise<AuthUser> {
    try {
      SessionService.setLoading(true);
      SessionService.clearError();

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = await UserService.mapFirebaseUser(userCredential.user);

      // Send email verification
      await this.sendEmailVerification();

      return user;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Account creation failed';
      SessionService.setError(errorMessage);
      throw error;
    }
  }

  /**
   * Sign in anonymously
   */
  async signInAnonymously(): Promise<AuthUser> {
    try {
      SessionService.setLoading(true);
      SessionService.clearError();

      const userCredential = await signInAnonymously(auth);
      const user = await UserService.mapFirebaseUser(userCredential.user);

      return user;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Anonymous sign in failed';
      SessionService.setError(errorMessage);
      throw error;
    }
  }

  /**
   * Sign out current user
   * Clears in-memory state to prevent data leaks between accounts
   * NOTE: Reddit OAuth tokens are preserved - user stays connected to integrations
   */
  async signOut(): Promise<void> {
    try {
      // Clear inbox store data (in-memory only - prevents seeing other user's messages)
      try {
        const useInboxStore = (await import('../state/inboxStore')).default;
        useInboxStore.getState().cleanupListeners();
        useInboxStore.setState({ inboxItems: [], memories: [], currentWorkspaceId: null });
        console.log('🧹 [Auth] Cleared inbox store on signout');
      } catch (inboxError) {
        console.warn('🟡 [Auth] Failed to clear inbox store:', inboxError);
      }

      // Clear profile store (in-memory only)
      try {
        const useProfileStore = (await import('../state/profileStore')).default;
        useProfileStore.setState({ profile: null });
        console.log('🧹 [Auth] Cleared profile store on signout');
      } catch (profileError) {
        console.warn('🟡 [Auth] Failed to clear profile store:', profileError);
      }

      // Clear quest store (in-memory only)
      try {
        const useQuestStore = (await import('../state/questStore')).default;
        useQuestStore.setState({ quests: [], currentQuest: null, isInitialized: false });
        console.log('🧹 [Auth] Cleared quest store on signout');
      } catch (questError) {
        console.warn('🟡 [Auth] Failed to clear quest store:', questError);
      }

      // NOTE: We do NOT clear Reddit OAuth tokens - user stays connected to integrations
      // The hasActiveConnection() check uses Firestore (user-scoped) as source of truth,
      // so a different user logging in won't see another user's Reddit connection

      await signOut(auth);
      await this.clearSecureStorage();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  /**
   * Clear secure storage
   */
  private async clearSecureStorage(): Promise<void> {
    await Promise.all([TokenService.clearStoredTokens(), UserService.clearStoredUser()]);
  }

  /**
   * Send email verification to current user
   */
  async sendEmailVerification(): Promise<void> {
    const { currentUser } = auth;
    if (currentUser) {
      await sendEmailVerification(currentUser);
    } else {
      throw new Error('No user is currently signed in');
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  }

  /**
   * Reauthenticate user with email and password
   * Required before sensitive operations like account deletion
   */
  async reauthenticateWithCredential(email: string, password: string): Promise<void> {
    const { currentUser } = auth;
    if (!currentUser) {
      throw new Error('No user is currently signed in');
    }

    try {
      const credential = EmailAuthProvider.credential(email, password);
      await reauthenticateWithCredential(currentUser, credential);
    } catch (error: any) {
      // Provide user-friendly error messages
      if (error.code === 'auth/wrong-password') {
        throw new Error('Incorrect password. Please try again.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many attempts. Please try again later.');
      } else if (error.code === 'auth/network-request-failed') {
        throw new Error('Network error. Please check your connection.');
      }
      throw error;
    }
  }

  /**
   * Delete the current user's account
   * Requires recent authentication
   */
  async deleteAccount(): Promise<void> {
    const { currentUser } = auth;
    if (!currentUser) {
      throw new Error('No user is currently signed in');
    }

    try {
      await deleteUser(currentUser);
      await this.clearSecureStorage();
    } catch (error: any) {
      // Handle specific error codes
      if (error.code === 'auth/requires-recent-login') {
        throw {
          code: 'auth/requires-recent-login',
          message: 'Please sign in again to delete your account',
        };
      } else if (error.code === 'auth/network-request-failed') {
        throw new Error('Network error. Please check your connection.');
      }
      throw error;
    }
  }

  /**
   * Get current authentication token
   */
  async getCurrentToken(): Promise<string | null> {
    const { currentUser } = auth;
    return await TokenService.getCurrentToken(currentUser);
  }

  /**
   * Get current user
   */
  getCurrentUser(): AuthUser | null {
    return SessionService.getCurrentUser();
  }

  /**
   * Get current auth state
   */
  getAuthState(): AuthState {
    return SessionService.getAuthState();
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChanged(callback: (state: AuthState) => void): () => void {
    return SessionService.onAuthStateChanged(callback);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return SessionService.isAuthenticated();
  }

  /**
   * Update profile information
   */
  async updateProfile(updates: { displayName?: string; photoURL?: string }): Promise<void> {
    await UserService.updateProfile(updates);

    // Update local state
    const currentUser = SessionService.getCurrentUser();
    if (currentUser) {
      const updatedUser = {
        ...currentUser,
        ...updates,
      };
      await UserService.securelyStoreUser(updatedUser);
      SessionService.handleTokenRefresh(updatedUser);
    }
  }
}

export default new AuthenticationService();
