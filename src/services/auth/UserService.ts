/**
 * User Service
 *
 * Handles user data management, profile operations, and user state.
 * Separated from AuthenticationService for better maintainability.
 *
 * @version 1.0.0
 * @author PaynaAI Team
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateProfile } from 'firebase/auth';
import { auth } from '../../config/firebase';
import LogRocket from '@logrocket/react-native';

/**
 * Represents an authenticated user with all necessary information
 */
export interface AuthUser {
  /** Unique user identifier from Firebase Auth */
  uid: string;
  /** User's email address */
  email: string | null;
  /** User's display name */
  displayName: string | null;
  /** URL to user's profile photo */
  photoURL: string | null;
  /** Whether the user's email has been verified */
  emailVerified: boolean;
  /** Whether this is an anonymous user */
  isAnonymous: boolean;
  /** Optional tenant ID for multi-tenant applications */
  tenantId?: string;
}

class UserService {
  private static readonly SECURE_USER_KEY = 'firebase_auth_user';

  /**
   * Map Firebase user to our AuthUser interface
   */
  async mapFirebaseUser(firebaseUser: any): Promise<AuthUser> {
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      emailVerified: firebaseUser.emailVerified,
      isAnonymous: firebaseUser.isAnonymous,
      tenantId: firebaseUser.tenantId,
    };
  }

  /**
   * Store user data for persistent login
   * Uses AsyncStorage instead of SecureStore to avoid iOS 2048 byte limit errors
   * User data (uid, email, displayName) is not sensitive and doesn't require secure storage
   */
  async securelyStoreUser(user: AuthUser): Promise<void> {
    try {
      await AsyncStorage.setItem(
        UserService.SECURE_USER_KEY,
        JSON.stringify(user),
      );
    } catch (error) {
      console.warn('Failed to store user data:', error);
    }
  }

  /**
   * Get stored user data
   * Uses AsyncStorage only (SecureStore removed to avoid iOS 2048 byte limit)
   */
  async getStoredUser(): Promise<AuthUser | null> {
    try {
      const userJson = await AsyncStorage.getItem(UserService.SECURE_USER_KEY);
      if (userJson) {
        return JSON.parse(userJson);
      }
    } catch (error) {
      console.warn('Failed to retrieve stored user:', error);
    }

    return null;
  }

  /**
   * Clear stored user data
   */
  async clearStoredUser(): Promise<void> {
    try {
      await AsyncStorage.removeItem(UserService.SECURE_USER_KEY);
    } catch (error) {
      console.warn('Failed to clear stored user:', error);
    }
  }

  /**
   * Update profile information
   */
  async updateProfile(updates: { displayName?: string; photoURL?: string }): Promise<void> {
    const { currentUser } = auth;
    if (currentUser) {
      await updateProfile(currentUser, updates);
    } else {
      throw new Error('No user is currently signed in');
    }
  }

  /**
   * Identify user in LogRocket
   */
  identifyUserInLogRocket(user: AuthUser): void {
    LogRocket.identify(user.uid, {
      name: user.displayName || 'Unknown User',
      email: user.email || 'no-email@example.com',
      emailVerified: user.emailVerified,
      isAnonymous: user.isAnonymous,
    });
  }

  /**
   * Validate user data
   */
  validateUser(user: any): user is AuthUser {
    return (
      user &&
      typeof user.uid === 'string' &&
      (user.email === null || typeof user.email === 'string') &&
      (user.displayName === null || typeof user.displayName === 'string') &&
      (user.photoURL === null || typeof user.photoURL === 'string') &&
      typeof user.emailVerified === 'boolean' &&
      typeof user.isAnonymous === 'boolean'
    );
  }
}

export default new UserService();
