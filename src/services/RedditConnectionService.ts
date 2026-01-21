/**
 * Reddit Connection Service
 *
 * Handles Reddit OAuth connection and token management
 *
 * NOTE: This service now focuses purely on Reddit OAuth.
 * HuntingEngine automation handles lead generation automatically.
 * The inbox displays Reddit comment replies and DMs via direct Reddit API integration.
 */

import RedditOAuthService from '../integrations/RedditOAuthService';
import { RedditAccount } from '../types/app';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { auth } from '../config/firebase';

class RedditConnectionService {
  /**
   * Connect Reddit account
   * 1. Check if user already has Reddit account connected
   * 2. Perform OAuth flow
   * 3. Save to Firestore
   * 4. Return success
   */
  async connectRedditAccount(): Promise<{ success: boolean; redditAccount?: RedditAccount; error?: string; needsSubreddits?: boolean }> {
    try {
      console.log('🔴 Starting Reddit connection flow...');

      // Step 1: Check if user already has a Reddit account connected
      const { currentUser } = auth;
      if (!currentUser) {
        console.error('🔴 No authenticated user');
        return {
          success: false,
          error: 'User not authenticated',
        };
      }

      const existingConnection = await this.checkExistingConnection(currentUser.uid);
      if (existingConnection) {
        console.log('ℹ️ User already has a Reddit account connected:', existingConnection.username);
        return {
          success: false,
          error: `Reddit account already connected as u/${existingConnection.username}. Disconnect first to connect a different account.`,
        };
      }

      // Step 2: Authenticate with Reddit OAuth
      const authResult = await RedditOAuthService.authenticateReddit();

      if (!authResult.success || !authResult.tokens || !authResult.username || !authResult.userId) {
        console.error('🔴 Reddit OAuth failed:', authResult.error);
        return {
          success: false,
          error: authResult.error || 'Failed to authenticate with Reddit',
        };
      }

      const { username, userId, tokens } = authResult;

      // Step 3: Create RedditAccount object
      const redditAccount: RedditAccount = {
        username,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        connectedAt: new Date(),
        scopes: tokens.scope.split(' '),
        isActive: true,
      };

      // Step 4: Save to Firestore
      await this.saveToFirestore(currentUser.uid, redditAccount);

      console.log('🟢 Reddit connection successful!');

      // Return success - automatically trigger subreddit selection
      return {
        success: true,
        redditAccount,
        needsSubreddits: true, // Always show subreddit selection after connection
      };
    } catch (error: any) {
      console.error('🔴 Error connecting Reddit account:', error);
      return {
        success: false,
        error: error.message || 'Unexpected error during Reddit connection',
      };
    }
  }

  /**
   * Get the redirect URI for debugging purposes
   */
  getRedirectUriForDebug(): string {
    return RedditOAuthService.getRedirectUriForDebug();
  }

  /**
   * Disconnect Reddit account
   * 1. Revoke OAuth tokens
   * 2. Remove from Firestore
   */
  async disconnectRedditAccount(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔴 Disconnecting Reddit account...');

      // Step 1: Revoke OAuth tokens
      await RedditOAuthService.revokeAccess();

      // Step 2: Remove from Firestore
      const { currentUser } = auth;
      if (!currentUser) {
        console.error('🔴 No authenticated user');
        return {
          success: false,
          error: 'User not authenticated',
        };
      }

      await this.removeFromFirestore(currentUser.uid);

      console.log('🟢 Reddit disconnection successful!');

      return {
        success: true,
      };
    } catch (error: any) {
      console.error('🔴 Error disconnecting Reddit account:', error);
      return {
        success: false,
        error: error.message || 'Unexpected error during Reddit disconnection',
      };
    }
  }

  /**
   * Check if user has active Reddit connection
   */
  async hasActiveConnection(): Promise<boolean> {
    return await RedditOAuthService.hasActiveConnection();
  }

  /**
   * Get valid access token (automatically refreshes if expired)
   */
  async getValidAccessToken(): Promise<string | null> {
    return await RedditOAuthService.getValidAccessToken();
  }

  /**
   * Check if user already has a Reddit account connected
   * Returns the RedditAccount if connected, null otherwise
   */
  private async checkExistingConnection(userId: string): Promise<RedditAccount | null> {
    try {
      const db = getFirestore();
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData?.redditAccount && userData.redditAccount.isActive) {
          return userData.redditAccount as RedditAccount;
        }
      }

      return null;
    } catch (error) {
      console.error('🔴 Error checking existing Reddit connection:', error);
      // If we can't check, allow the connection attempt to proceed
      return null;
    }
  }

  /**
   * Save Reddit account to Firestore
   */
  private async saveToFirestore(userId: string, redditAccount: RedditAccount): Promise<void> {
    try {
      const db = getFirestore();
      const userDocRef = doc(db, 'users', userId);

      await setDoc(
        userDocRef,
        {
          redditAccount: {
            username: redditAccount.username,
            accessToken: redditAccount.accessToken,
            refreshToken: redditAccount.refreshToken,
            expiresAt: redditAccount.expiresAt,
            connectedAt: serverTimestamp(),
            scopes: redditAccount.scopes,
            isActive: true,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      console.log('🟢 Reddit account saved to Firestore user_profiles collection');
    } catch (error) {
      console.error('🔴 Error saving to Firestore:', error);
      throw error;
    }
  }

  /**
   * Remove Reddit account from Firestore
   */
  private async removeFromFirestore(userId: string): Promise<void> {
    try {
      console.log('🔴 removeFromFirestore: Starting removal for user:', userId);
      const db = getFirestore();
      const userDocRef = doc(db, 'users', userId);

      // First, verify the document exists
      const { getDoc } = await import('firebase/firestore');
      const beforeDoc = await getDoc(userDocRef);
      console.log('🔴 Document before removal:', {
        exists: beforeDoc.exists(),
        hasRedditAccount: beforeDoc.exists() ? !!beforeDoc.data()?.redditAccount : false,
      });

      // Use deleteField to completely remove the redditAccount field
      const { deleteField } = await import('firebase/firestore');

      await setDoc(
        userDocRef,
        {
          redditAccount: deleteField(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      console.log('🟢 Reddit account removed from Firestore user_profiles collection - setDoc completed');

      // Verify removal
      const afterDoc = await getDoc(userDocRef);
      console.log('🔴 Document after removal:', {
        exists: afterDoc.exists(),
        hasRedditAccount: afterDoc.exists() ? !!afterDoc.data()?.redditAccount : false,
        redditAccountValue: afterDoc.exists() ? afterDoc.data()?.redditAccount : null,
      });
    } catch (error) {
      console.error('🔴 Error removing from Firestore:', error);
      throw error;
    }
  }
}

export default new RedditConnectionService();
