/**
 * Session Service
 *
 * Handles session management, state tracking, and authentication state changes.
 * Separated from AuthenticationService for better maintainability.
 *
 * @version 1.0.0
 * @author PaynaAI Team
 */

import { AuthUser } from './UserService';

/**
 * Represents the current authentication state
 */
export interface AuthState {
  /** Current authenticated user or null if not authenticated */
  user: AuthUser | null;
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
  /** Whether authentication is currently in progress */
  isLoading: boolean;
  /** Current authentication error message */
  error: string | null;
}

/**
 * Event types for authentication state changes
 */
export type AuthEventType = 'signIn' | 'signOut' | 'tokenRefresh' | 'error';

/**
 * Authentication event data
 */
export interface AuthEvent {
  type: AuthEventType;
  user?: AuthUser | null;
  error?: string;
  timestamp: Date;
}

class SessionService {
  private authStateListeners: ((state: AuthState) => void)[] = [];
  private authEventListeners: ((event: AuthEvent) => void)[] = [];
  private currentAuthState: AuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  };

  /**
   * Get current auth state
   */
  getAuthState(): AuthState {
    return this.currentAuthState;
  }

  /**
   * Update auth state and notify listeners
   */
  updateAuthState(newState: AuthState): void {
    this.currentAuthState = newState;
    this.authStateListeners.forEach(listener => listener(newState));
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChanged(callback: (state: AuthState) => void): () => void {
    this.authStateListeners.push(callback);

    // Immediately call with current state
    callback(this.currentAuthState);

    // Return unsubscribe function
    return () => {
      this.authStateListeners = this.authStateListeners.filter(
        listener => listener !== callback,
      );
    };
  }

  /**
   * Subscribe to auth events
   */
  onAuthEvent(callback: (event: AuthEvent) => void): () => void {
    this.authEventListeners.push(callback);

    // Return unsubscribe function
    return () => {
      this.authEventListeners = this.authEventListeners.filter(
        listener => listener !== callback,
      );
    };
  }

  /**
   * Emit authentication event
   */
  emitAuthEvent(type: AuthEventType, user?: AuthUser | null, error?: string): void {
    const event: AuthEvent = {
      type,
      user,
      error,
      timestamp: new Date(),
    };

    this.authEventListeners.forEach(listener => listener(event));
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentAuthState.isAuthenticated;
  }

  /**
   * Get current user
   */
  getCurrentUser(): AuthUser | null {
    return this.currentAuthState.user;
  }

  /**
   * Set loading state
   */
  setLoading(isLoading: boolean): void {
    this.updateAuthState({
      ...this.currentAuthState,
      isLoading,
    });
  }

  /**
   * Set error state
   */
  setError(error: string | null): void {
    this.updateAuthState({
      ...this.currentAuthState,
      error,
      isLoading: false,
    });

    if (error) {
      this.emitAuthEvent('error', this.currentAuthState.user, error);
    }
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.updateAuthState({
      ...this.currentAuthState,
      error: null,
    });
  }

  /**
   * Handle successful sign in
   */
  handleSignIn(user: AuthUser): void {
    this.updateAuthState({
      user,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    this.emitAuthEvent('signIn', user);
  }

  /**
   * Handle sign out
   */
  handleSignOut(): void {
    this.updateAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });

    this.emitAuthEvent('signOut', null);
  }

  /**
   * Handle token refresh
   */
  handleTokenRefresh(user: AuthUser): void {
    this.updateAuthState({
      ...this.currentAuthState,
      user,
    });

    this.emitAuthEvent('tokenRefresh', user);
  }

  /**
   * Clean up all listeners
   */
  dispose(): void {
    this.authStateListeners = [];
    this.authEventListeners = [];
  }
}

export default new SessionService();
