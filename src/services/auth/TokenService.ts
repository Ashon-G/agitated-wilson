/**
 * Token Service
 *
 * Handles authentication token management and refresh operations.
 * Note: Firebase Auth handles token persistence internally, so we don't need
 * to store tokens in SecureStore. This service focuses on token retrieval
 * and refresh logic.
 *
 * @version 2.0.0
 * @author PaynaAI Team
 */

import { auth } from '../../config/firebase';

/**
 * Represents authentication tokens for session management
 */
export interface AuthTokens {
  /** Firebase access token */
  accessToken: string;
  /** Firebase refresh token */
  refreshToken: string;
  /** Token expiration timestamp */
  expiresAt: number;
  /** Token type (always 'Bearer' for Firebase) */
  tokenType: 'Bearer';
}

class TokenService {
  private static readonly TOKEN_REFRESH_THRESHOLD = parseInt(
    process.env.EXPO_PUBLIC_AUTH_TOKEN_REFRESH_THRESHOLD || '300000', // 5 minutes default
    10,
  );

  /**
   * Get fresh tokens if needed
   * Firebase Auth handles persistence internally - we just get fresh tokens
   */
  async refreshTokensIfNeeded(firebaseUser: any): Promise<AuthTokens | null> {
    try {
      const tokenResult = await firebaseUser.getIdTokenResult();
      const expiresAt = new Date(tokenResult.expirationTime).getTime();
      const now = Date.now();

      // Check if token needs refresh
      if (expiresAt - now < TokenService.TOKEN_REFRESH_THRESHOLD) {
        const refreshedToken = await firebaseUser.getIdToken(true);
        const newTokenResult = await firebaseUser.getIdTokenResult();

        return {
          accessToken: refreshedToken,
          refreshToken: firebaseUser.refreshToken || '',
          expiresAt: new Date(newTokenResult.expirationTime).getTime(),
          tokenType: 'Bearer',
        };
      }

      return {
        accessToken: tokenResult.token,
        refreshToken: firebaseUser.refreshToken || '',
        expiresAt,
        tokenType: 'Bearer',
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  }

  /**
   * Get current authentication token
   * Uses Firebase Auth's internal persistence - no SecureStore needed
   */
  async getCurrentToken(firebaseUser?: any): Promise<string | null> {
    try {
      // Use provided user or get from auth
      const user = firebaseUser || auth.currentUser;

      if (user) {
        // Firebase handles token refresh internally
        const token = await user.getIdToken(false);
        console.log('🔑 Token retrieved successfully');
        return token;
      }

      console.warn('⚠️ No Firebase user available');
      return null;
    } catch (error) {
      console.error('❌ Get token error:', error);
      return null;
    }
  }

  /**
   * Store tokens - No-op since Firebase Auth handles persistence internally
   * Kept for backward compatibility but doesn't actually store anything
   */
  async securelyStoreTokens(_tokens: AuthTokens): Promise<void> {
    // Firebase Auth handles token persistence internally via AsyncStorage
    // We don't need to store tokens separately - this was causing the 2048 byte limit errors
    console.log('ℹ️ Token storage delegated to Firebase Auth internal persistence');
  }

  /**
   * Get stored tokens - Gets fresh tokens from Firebase Auth
   */
  async getStoredTokens(): Promise<AuthTokens | null> {
    try {
      const user = auth.currentUser;
      if (user) {
        const tokenResult = await user.getIdTokenResult();
        return {
          accessToken: tokenResult.token,
          refreshToken: user.refreshToken || '',
          expiresAt: new Date(tokenResult.expirationTime).getTime(),
          tokenType: 'Bearer',
        };
      }
    } catch (error) {
      console.warn('🟡 Failed to get tokens from Firebase Auth:', error);
    }
    return null;
  }

  /**
   * Clear stored tokens - Signs out from Firebase Auth
   */
  async clearStoredTokens(): Promise<void> {
    // Firebase Auth handles cleanup on sign out
    // This is called during sign out flow, so nothing extra needed here
    console.log('ℹ️ Token cleanup delegated to Firebase Auth');
  }

  /**
   * Check if token needs refresh
   */
  needsRefresh(expiresAt: number): boolean {
    const now = Date.now();
    return expiresAt - now < TokenService.TOKEN_REFRESH_THRESHOLD;
  }
}

export default new TokenService();
