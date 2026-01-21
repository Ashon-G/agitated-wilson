import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

// This is critical for OAuth to work properly in Expo
WebBrowser.maybeCompleteAuthSession();

/**
 * Convert string to base64 using Buffer
 * Buffer is available via the 'buffer' package in React Native
 */
function toBase64(str: string): string {
  // Use Buffer from the buffer package (polyfill for Node.js Buffer in React Native)
  const { Buffer } = require('buffer');
  return Buffer.from(str, 'utf-8').toString('base64');
}

interface RedditTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
  scope: string;
}

interface RedditUserInfo {
  username: string;
  id: string;
  icon_img: string;
  karma: number;
}

interface AuthResult {
  success: boolean;
  username?: string;
  userId?: string;
  tokens?: RedditTokens;
  error?: string;
}

class RedditOAuthService {
  // Reddit OAuth endpoints
  private static readonly AUTH_ENDPOINT = 'https://www.reddit.com/api/v1/authorize.compact';
  private static readonly TOKEN_ENDPOINT = 'https://www.reddit.com/api/v1/access_token';
  private static readonly REVOKE_ENDPOINT = 'https://www.reddit.com/api/v1/revoke_token';
  private static readonly USER_ENDPOINT = 'https://oauth.reddit.com/api/v1/me';

  // Reddit OAuth scopes - request minimal permissions needed
  private static readonly SCOPES = [
    'identity', // Access username and basic account info
    'read', // Read posts and comments
    'submit', // Post links and comments
    'edit', // Edit and delete own comments
    'history', // Access own voting history
    'privatemessages', // Read and send private messages (required for inbox API)
  ];

  // Secure storage keys
  private static readonly STORAGE_KEY_ACCESS_TOKEN = 'reddit_access_token';
  private static readonly STORAGE_KEY_REFRESH_TOKEN = 'reddit_refresh_token';
  private static readonly STORAGE_KEY_EXPIRES_AT = 'reddit_expires_at';
  private static readonly STORAGE_KEY_SCOPE = 'reddit_scope';
  private static readonly STORAGE_KEY_USERNAME = 'reddit_username';
  private static readonly STORAGE_KEY_USER_ID = 'reddit_user_id';

  /**
   * Get Reddit Client ID from environment variables
   */
  private getClientId = (): string => {
    const clientId = process.env.EXPO_PUBLIC_REDDIT_CLIENT_ID;
    if (!clientId) {
      throw new Error('EXPO_PUBLIC_REDDIT_CLIENT_ID not configured in .env file');
    }
    return clientId;
  };

  /**
   * Create redirect URI for OAuth flow
   * Reddit requires exact match with registered redirect URI
   */
  private getRedirectUri = (): string => {
    // Reddit OAuth redirect URI - must match what's registered in Reddit app settings
    // Always use 'tava://reddit-auth' for both development and production
    // This must EXACTLY match what's configured in Reddit app settings at https://www.reddit.com/prefs/apps

    const redirectUri = 'tava://reddit-auth';

    console.log('🔴 Reddit OAuth Redirect URI:', redirectUri);
    console.log('🔴🔴🔴 CRITICAL: This URI must be added to your Reddit app settings!');
    console.log('🔴🔴🔴 Go to https://www.reddit.com/prefs/apps and add:', redirectUri);

    return redirectUri;
  };

  /**
   * Get the redirect URI that will be used for OAuth
   * Useful for debugging and configuration
   */
  getRedirectUriForDebug = (): string => {
    return this.getRedirectUri();
  };

  /**
   * Generate a random state parameter for CSRF protection
   */
  private generateState = (): string => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  /**
   * Authenticate with Reddit using OAuth 2.0
   * Reddit mobile apps don't need client secret (implicit flow)
   */
  authenticateReddit = async (): Promise<AuthResult> => {
    try {
      console.log('🔴 Starting Reddit OAuth flow...');

      const clientId = this.getClientId();
      const redirectUri = this.getRedirectUri();
      const state = this.generateState();

      console.log('🔴 Reddit OAuth config:');
      console.log('   Client ID:', `${clientId.substring(0, 20)}...`);
      console.log('   Redirect URI:', redirectUri);
      console.log('   Scopes:', RedditOAuthService.SCOPES.join(', '));

      // Reddit OAuth discovery
      const discovery = {
        authorizationEndpoint: RedditOAuthService.AUTH_ENDPOINT,
        tokenEndpoint: RedditOAuthService.TOKEN_ENDPOINT,
        revocationEndpoint: RedditOAuthService.REVOKE_ENDPOINT,
      };

      // Build authorization URL manually for better control
      // Note: Reddit doesn't support prompt=login or prompt=consent
      // To switch accounts, users need to log out of Reddit in their browser first
      const authUrl = `${RedditOAuthService.AUTH_ENDPOINT}?client_id=${clientId}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}&duration=permanent&scope=${encodeURIComponent(RedditOAuthService.SCOPES.join(' '))}`;

      console.log('🔴 Opening browser for authentication...');
      console.log('🔴 Full auth URL:', authUrl);
      console.log('🔴🔴🔴 IMPORTANT: Copy the URL above and check if the redirect_uri matches what you added to Reddit app settings');
      console.log('🔴🔴🔴 The redirect_uri in the URL must EXACTLY match what is in your Reddit app at https://www.reddit.com/prefs/apps');

      // Use WebBrowser for OAuth flow with preferEphemeralSession to avoid using cached credentials
      // This gives users a fresh login screen where they can choose which account to use
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri, {
        preferEphemeralSession: true, // Use private browsing - no cookies from Safari
      });

      console.log('🔴 Reddit auth result type:', result.type);

      if (result.type === 'success') {
        console.log('🟢 Reddit OAuth success!');

        // Parse the redirect URL
        const redirectUrl = result.url;
        const params = new URL(redirectUrl).searchParams;
        const code = params.get('code');
        const returnedState = params.get('state');

        // Verify state to prevent CSRF attacks
        if (returnedState !== state) {
          console.error('🔴 State mismatch - possible CSRF attack');
          return {
            success: false,
            error: 'Security validation failed',
          };
        }

        if (code) {
          console.log('🔴 Authorization code received, exchanging for tokens...');

          // Exchange authorization code for tokens
          const tokens = await this.exchangeCodeForToken(code, redirectUri, clientId);

          if (tokens) {
            console.log('🟢 Token exchange successful!');

            // Store tokens securely
            await this.storeTokens(tokens);

            // Get user info
            console.log('🔴 Fetching user info...');
            const userInfo = await this.getUserInfo(tokens.accessToken);

            if (userInfo) {
              console.log('🟢 User info retrieved:', userInfo.username);

              // Store username and user ID (may fail silently)
              try {
                await SecureStore.setItemAsync(RedditOAuthService.STORAGE_KEY_USERNAME, userInfo.username);
                await SecureStore.setItemAsync(RedditOAuthService.STORAGE_KEY_USER_ID, userInfo.id);
              } catch (storeError) {
                console.warn('🟡 [RedditOAuth] Failed to store username/userId in SecureStore:', storeError);
              }

              return {
                success: true,
                username: userInfo.username,
                userId: userInfo.id,
                tokens,
              };
            } else {
              return {
                success: false,
                error: 'Failed to fetch user info',
              };
            }
          } else {
            console.error('🔴 Token exchange failed');
            return {
              success: false,
              error: 'Failed to exchange authorization code for tokens',
            };
          }
        } else {
          console.error('🔴 No authorization code in success response');
          return {
            success: false,
            error: 'No authorization code received',
          };
        }
      } else if (result.type === 'cancel') {
        console.log('🟡 User cancelled Reddit authentication');
        return {
          success: false,
          error: 'Authentication cancelled by user',
        };
      } else {
        console.error('🔴 Reddit authentication failed:', result.type);
        return {
          success: false,
          error: 'Authentication failed',
        };
      }
    } catch (error: any) {
      console.error('🔴 Reddit OAuth error:', error);
      return {
        success: false,
        error: error.message || 'An unexpected error occurred',
      };
    }
  };

  /**
   * Exchange authorization code for access and refresh tokens
   * Reddit requires Basic Auth with client_id:client_secret (empty secret for mobile apps)
   */
  private async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    clientId: string,
  ): Promise<RedditTokens | null> {
    try {
      // Reddit requires Basic Auth with format: base64(client_id:)
      // Note: Mobile apps have empty client secret, so it's just "client_id:"
      const basicAuth = toBase64(`${clientId}:`);

      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      });

      console.log('🔴 Exchanging code for token...');
      console.log('   Token endpoint:', RedditOAuthService.TOKEN_ENDPOINT);

      const response = await fetch(RedditOAuthService.TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
          'User-Agent': 'Vibecode:com.vibecode.app:v1.0.0 (by /u/vibecode)',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 Token exchange failed:', response.status, errorText);
        return null;
      }

      const data = await response.json();
      console.log('🟢 Token exchange response received');

      // Reddit tokens expire in 3600 seconds (1 hour)
      const expiresAt = Date.now() + (data.expires_in * 1000);

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
        scope: data.scope,
      };
    } catch (error) {
      console.error('🔴 Error exchanging code for token:', error);
      return null;
    }
  }

  /**
   * Refresh the access token using the refresh token
   * Falls back to Firestore if SecureStore is unavailable
   */
  refreshAccessToken = async (): Promise<RedditTokens | null> => {
    try {
      // First try to get refresh token from SecureStore
      let refreshToken: string | null = null;

      try {
        refreshToken = await SecureStore.getItemAsync(RedditOAuthService.STORAGE_KEY_REFRESH_TOKEN);
      } catch (secureStoreError) {
        console.warn('🟡 [RedditOAuth] SecureStore unavailable for refresh token, trying Firestore...');
      }

      // If SecureStore failed or had no token, try Firestore
      if (!refreshToken) {
        const firestoreTokens = await this.getTokensFromFirestore();
        if (firestoreTokens?.refreshToken) {
          ({ refreshToken } = firestoreTokens);
          console.log('🟢 [RedditOAuth] Got refresh token from Firestore');
        }
      }

      if (!refreshToken) {
        console.error('🔴 No refresh token available in SecureStore or Firestore');
        return null;
      }

      const clientId = this.getClientId();
      const basicAuth = toBase64(`${clientId}:`);

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      console.log('🔴 Refreshing Reddit access token...');

      const response = await fetch(RedditOAuthService.TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
          'User-Agent': 'Vibecode:com.vibecode.app:v1.0.0 (by /u/vibecode)',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 Token refresh failed:', response.status, errorText);
        return null;
      }

      const data = await response.json();
      console.log('🟢 Token refresh successful');

      const expiresAt = Date.now() + (data.expires_in * 1000);

      const tokens: RedditTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Reddit may not return new refresh token
        expiresAt,
        scope: data.scope,
      };

      // Store refreshed tokens in SecureStore (may fail silently)
      await this.storeTokens(tokens);

      // Also update Firestore so Cloud Functions can access fresh tokens
      await this.updateFirestoreTokens(tokens);

      return tokens;
    } catch (error) {
      console.error('🔴 Error refreshing token:', error);
      return null;
    }
  };

  /**
   * Get valid access token (automatically refreshes if expired)
   * Falls back to Firestore if SecureStore is unavailable
   */
  getValidAccessToken = async (): Promise<string | null> => {
    try {
      // First try SecureStore
      let accessToken: string | null = null;
      let expiresAt: number | null = null;

      try {
        accessToken = await SecureStore.getItemAsync(RedditOAuthService.STORAGE_KEY_ACCESS_TOKEN);
        const expiresAtStr = await SecureStore.getItemAsync(RedditOAuthService.STORAGE_KEY_EXPIRES_AT);
        expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : null;
      } catch (secureStoreError) {
        console.warn('🟡 [RedditOAuth] SecureStore unavailable, trying Firestore...');
      }

      // If SecureStore failed or had no tokens, try Firestore
      if (!accessToken || !expiresAt) {
        console.log('🔴 [RedditOAuth] No tokens in SecureStore, checking Firestore...');
        const firestoreTokens = await this.getTokensFromFirestore();

        if (firestoreTokens) {
          ({ accessToken, expiresAt } = firestoreTokens);
          console.log('🟢 [RedditOAuth] Got tokens from Firestore');
        } else {
          console.log('🔴 [RedditOAuth] No tokens found in SecureStore or Firestore');
          return null;
        }
      }

      const now = Date.now();

      // If token expires in less than 5 minutes, refresh it
      if (now >= expiresAt - (5 * 60 * 1000)) {
        console.log('🔴 Access token expired or expiring soon, refreshing...');
        const tokens = await this.refreshAccessToken();
        return tokens?.accessToken || null;
      }

      return accessToken;
    } catch (error) {
      console.error('🔴 Error getting valid access token:', error);
      return null;
    }
  };

  /**
   * Get tokens directly from Firestore (fallback when SecureStore is unavailable)
   */
  private async getTokensFromFirestore(): Promise<RedditTokens | null> {
    try {
      const { auth } = await import('../config/firebase');
      const { getFirestore, doc, getDoc } = await import('firebase/firestore');

      const { currentUser } = auth;
      if (!currentUser) {
        return null;
      }

      const db = getFirestore();
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        return null;
      }

      const userData = userDoc.data();
      const redditAccount = userData?.redditAccount;

      if (!redditAccount || !redditAccount.isActive) {
        return null;
      }

      return {
        accessToken: redditAccount.accessToken,
        refreshToken: redditAccount.refreshToken,
        expiresAt: redditAccount.expiresAt,
        scope: Array.isArray(redditAccount.scopes) ? redditAccount.scopes.join(' ') : redditAccount.scopes || '',
      };
    } catch (error) {
      console.error('🔴 [RedditOAuth] Error getting tokens from Firestore:', error);
      return null;
    }
  }

  /**
   * Get user info from Reddit API
   */
  private async getUserInfo(accessToken: string): Promise<RedditUserInfo | null> {
    try {
      const response = await fetch(RedditOAuthService.USER_ENDPOINT, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'Vibecode:com.vibecode.app:v1.0.0 (by /u/vibecode)',
        },
      });

      if (!response.ok) {
        console.error('🔴 Failed to fetch user info:', response.status);
        return null;
      }

      const data = await response.json();

      return {
        username: data.name,
        id: data.id,
        icon_img: data.icon_img,
        karma: data.total_karma || 0,
      };
    } catch (error) {
      console.error('🔴 Error fetching user info:', error);
      return null;
    }
  }

  /**
   * Store tokens securely
   * Returns true if successful, false if storage failed (e.g., user interaction not allowed)
   */
  private async storeTokens(tokens: RedditTokens): Promise<boolean> {
    try {
      await Promise.all([
        SecureStore.setItemAsync(RedditOAuthService.STORAGE_KEY_ACCESS_TOKEN, tokens.accessToken),
        SecureStore.setItemAsync(RedditOAuthService.STORAGE_KEY_REFRESH_TOKEN, tokens.refreshToken),
        SecureStore.setItemAsync(RedditOAuthService.STORAGE_KEY_EXPIRES_AT, tokens.expiresAt.toString()),
        SecureStore.setItemAsync(RedditOAuthService.STORAGE_KEY_SCOPE, tokens.scope),
      ]);
      return true;
    } catch (error) {
      // SecureStore can fail with "User interaction is not allowed" in certain contexts
      // (e.g., during app initialization, background state, or TestFlight builds)
      console.warn('🟡 [RedditOAuth] Failed to store tokens in SecureStore:', error);
      return false;
    }
  }

  /**
   * Update tokens in Firestore for Cloud Functions access
   * This ensures Cloud Functions workflows always have fresh tokens
   */
  private async updateFirestoreTokens(tokens: RedditTokens): Promise<void> {
    try {
      const { auth } = await import('../config/firebase');
      const { getFirestore, doc, setDoc } = await import('firebase/firestore');

      const { currentUser } = auth;
      if (!currentUser) {
        console.log('🟡 No authenticated user - skipping Firestore token update');
        return;
      }

      const db = getFirestore();
      const userDocRef = doc(db, 'users', currentUser.uid);

      await setDoc(
        userDocRef,
        {
          redditAccount: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt,
            scopes: tokens.scope.split(' '),
          },
        },
        { merge: true },
      );

      console.log('🟢 Firestore tokens updated for Cloud Functions access');
    } catch (error) {
      console.error('🔴 Error updating Firestore tokens:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Get stored tokens
   * Returns null if SecureStore is unavailable (e.g., during app init)
   */
  async getStoredTokens(): Promise<RedditTokens | null> {
    try {
      const [accessToken, refreshToken, expiresAtStr, scope] = await Promise.all([
        SecureStore.getItemAsync(RedditOAuthService.STORAGE_KEY_ACCESS_TOKEN),
        SecureStore.getItemAsync(RedditOAuthService.STORAGE_KEY_REFRESH_TOKEN),
        SecureStore.getItemAsync(RedditOAuthService.STORAGE_KEY_EXPIRES_AT),
        SecureStore.getItemAsync(RedditOAuthService.STORAGE_KEY_SCOPE),
      ]);

      if (!accessToken || !refreshToken || !expiresAtStr || !scope) {
        return null;
      }

      return {
        accessToken,
        refreshToken,
        expiresAt: parseInt(expiresAtStr, 10),
        scope,
      };
    } catch (error) {
      // SecureStore can fail with "User interaction is not allowed" in certain contexts
      console.warn('🟡 [RedditOAuth] SecureStore unavailable for reading tokens');
      return null;
    }
  }

  /**
   * Get stored username
   * Returns null if SecureStore is unavailable
   */
  async getStoredUsername(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(RedditOAuthService.STORAGE_KEY_USERNAME);
    } catch (error) {
      console.warn('🟡 [RedditOAuth] SecureStore unavailable for reading username');
      return null;
    }
  }

  /**
   * Check if user has active Reddit connection
   * IMPORTANT: Always check Firestore first to ensure user isolation
   * SecureStore is device-scoped, not user-scoped, so it can leak between accounts
   */
  async hasActiveConnection(): Promise<boolean> {
    // ALWAYS check Firestore first - it's the only user-isolated source of truth
    // SecureStore is device-scoped and can contain another user's tokens after logout
    const firestoreHasConnection = await this.checkFirestoreConnection();

    if (firestoreHasConnection) {
      // Optionally restore to SecureStore for faster access
      await this.restoreTokensFromFirestore();
      return true;
    }

    // No connection in Firestore means no valid connection for this user
    // Clear any stale SecureStore data from other users
    await this.clearStoredData();
    return false;
  }

  /**
   * Check Firestore for active Reddit connection (user-isolated)
   */
  private async checkFirestoreConnection(): Promise<boolean> {
    try {
      const { auth } = await import('../config/firebase');
      const { getFirestore, doc, getDoc } = await import('firebase/firestore');

      const { currentUser } = auth;
      if (!currentUser) {
        console.log('🔴 [RedditOAuth] No authenticated user');
        return false;
      }

      const db = getFirestore();
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        return false;
      }

      const userData = userDoc.data();
      const redditAccount = userData?.redditAccount;

      return !!(redditAccount && redditAccount.isActive);
    } catch (error) {
      console.error('🔴 [RedditOAuth] Error checking Firestore connection:', error);
      return false;
    }
  }

  /**
   * Restore tokens from Firestore to SecureStore
   * This is called on app startup to restore connection state
   * Returns true if tokens exist in Firestore (even if SecureStore fails)
   */
  async restoreTokensFromFirestore(): Promise<boolean> {
    try {
      const { auth } = await import('../config/firebase');
      const { getFirestore, doc, getDoc } = await import('firebase/firestore');

      const { currentUser } = auth;
      if (!currentUser) {
        console.log('🔴 [RedditOAuth] No authenticated user - cannot restore tokens');
        return false;
      }

      const db = getFirestore();
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        console.log('🔴 [RedditOAuth] No user document found');
        return false;
      }

      const userData = userDoc.data();
      const redditAccount = userData?.redditAccount;

      if (!redditAccount || !redditAccount.isActive) {
        console.log('🔴 [RedditOAuth] No active Reddit account in Firestore');
        return false;
      }

      // Check if tokens are expired (with 5 min buffer)
      const now = Date.now();
      if (redditAccount.expiresAt < now - 5 * 60 * 1000) {
        console.log('🟡 [RedditOAuth] Tokens from Firestore are expired, will need refresh');
        // Still restore them - the refresh logic will handle it
      }

      // Restore tokens to SecureStore
      const tokens: RedditTokens = {
        accessToken: redditAccount.accessToken,
        refreshToken: redditAccount.refreshToken,
        expiresAt: redditAccount.expiresAt,
        scope: Array.isArray(redditAccount.scopes) ? redditAccount.scopes.join(' ') : redditAccount.scopes || '',
      };

      // Try to store tokens - may fail in certain contexts (e.g., during app init)
      const stored = await this.storeTokens(tokens);

      // Also try to restore username if available
      if (redditAccount.username) {
        try {
          await SecureStore.setItemAsync(RedditOAuthService.STORAGE_KEY_USERNAME, redditAccount.username);
        } catch (usernameError) {
          console.warn('🟡 [RedditOAuth] Failed to store username in SecureStore:', usernameError);
        }
      }

      if (stored) {
        console.log('🟢 [RedditOAuth] Tokens restored from Firestore for user:', redditAccount.username);
      } else {
        console.log('🟡 [RedditOAuth] Tokens found in Firestore but SecureStore unavailable. User:', redditAccount.username);
      }

      // Return true if tokens exist in Firestore - the connection is still valid
      // even if we couldn't cache them locally
      return true;
    } catch (error) {
      console.error('🔴 [RedditOAuth] Error restoring tokens from Firestore:', error);
      return false;
    }
  }

  /**
   * Revoke Reddit access token (disconnect)
   */
  async revokeAccess(): Promise<boolean> {
    try {
      console.log('🔴 revokeAccess: Starting token revocation...');

      // Try to get access token from SecureStore first, fall back to Firestore
      let accessToken: string | null = null;

      try {
        accessToken = await SecureStore.getItemAsync(RedditOAuthService.STORAGE_KEY_ACCESS_TOKEN);
      } catch (secureStoreError) {
        console.warn('🟡 [RedditOAuth] SecureStore unavailable for revokeAccess, trying Firestore...');
      }

      if (!accessToken) {
        // Try Firestore as fallback
        const firestoreTokens = await this.getTokensFromFirestore();
        if (firestoreTokens?.accessToken) {
          ({ accessToken } = firestoreTokens);
          console.log('🟢 [RedditOAuth] Got access token from Firestore for revocation');
        }
      }

      if (!accessToken) {
        console.log('🔴 No access token to revoke, clearing local data only');
        await this.clearStoredData();
        return true; // Consider it successful if no token exists
      }

      console.log('🔴 Access token found, attempting to revoke with Reddit...');
      const clientId = this.getClientId();
      const basicAuth = toBase64(`${clientId}:`);

      const body = new URLSearchParams({
        token: accessToken,
        token_type_hint: 'access_token',
      });

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        console.log('🔴 Sending revoke request to Reddit...');
        const response = await fetch(RedditOAuthService.REVOKE_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${basicAuth}`,
            'User-Agent': 'Vibecode:com.vibecode.app:v1.0.0 (by /u/vibecode)',
          },
          body: body.toString(),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error('🔴 Failed to revoke token from Reddit:', response.status);
          // Continue anyway to clear local storage
        } else {
          console.log('🟢 Token successfully revoked from Reddit');
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error('🔴 Revoke request timed out after 10 seconds');
        } else {
          console.error('🔴 Fetch error during revocation:', fetchError.message);
        }
        // Continue anyway to clear local storage
      }

      // Clear all stored tokens and user info
      console.log('🔴 Clearing local stored data...');
      await this.clearStoredData();

      console.log('🟢 Reddit access revoked and local data cleared');
      return true;
    } catch (error: any) {
      console.error('🔴 Error revoking access:', error);
      console.error('🔴 Error details:', error?.message, error?.stack);
      // Clear local storage anyway
      try {
        await this.clearStoredData();
        console.log('🟢 Local data cleared despite error');
      } catch (clearError) {
        console.error('🔴 Failed to clear local data:', clearError);
      }
      return false;
    }
  }

  /**
   * Clear all stored Reddit data
   */
  clearStoredData = async (): Promise<void> => {
    await Promise.all([
      SecureStore.deleteItemAsync(RedditOAuthService.STORAGE_KEY_ACCESS_TOKEN).catch((error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Failed to delete access token from storage:', error);
        }
      }),
      SecureStore.deleteItemAsync(RedditOAuthService.STORAGE_KEY_REFRESH_TOKEN).catch((error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Failed to delete refresh token from storage:', error);
        }
      }),
      SecureStore.deleteItemAsync(RedditOAuthService.STORAGE_KEY_EXPIRES_AT).catch((error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Failed to delete expires_at from storage:', error);
        }
      }),
      SecureStore.deleteItemAsync(RedditOAuthService.STORAGE_KEY_SCOPE).catch((error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Failed to delete scope from storage:', error);
        }
      }),
      SecureStore.deleteItemAsync(RedditOAuthService.STORAGE_KEY_USERNAME).catch((error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Failed to delete username from storage:', error);
        }
      }),
      SecureStore.deleteItemAsync(RedditOAuthService.STORAGE_KEY_USER_ID).catch((error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Failed to delete user_id from storage:', error);
        }
      }),
    ]);
  };

  /**
   * Search for subreddits by name or topic
   * Uses Reddit's search API to find matching subreddits
   */
  searchSubreddits = async (query: string): Promise<Array<{name: string; description: string; subscribers: number}> | null> => {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const accessToken = await this.getValidAccessToken();
      if (!accessToken) {
        console.error('🔴 No valid access token for subreddit search');
        return null;
      }

      // Reddit API endpoint for searching subreddits
      const searchUrl = `https://oauth.reddit.com/subreddits/search?q=${encodeURIComponent(query)}&limit=20&type=sr`;

      console.log('🔴 Searching subreddits with query:', query);

      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'Vibecode:com.vibecode.app:v1.0.0 (by /u/vibecode)',
        },
      });

      if (!response.ok) {
        console.error('🔴 Failed to search subreddits:', response.status);
        return null;
      }

      const data = await response.json();

      if (!data?.data?.children) {
        return [];
      }

      // Map Reddit API response to our format
      const subreddits = data.data.children.map((child: any) => ({
        name: child.data.display_name,
        description: child.data.public_description || child.data.title || 'No description available',
        subscribers: child.data.subscribers || 0,
      }));

      console.log('🟢 Found', subreddits.length, 'subreddits');
      return subreddits;
    } catch (error) {
      console.error('🔴 Error searching subreddits:', error);
      return null;
    }
  };
}

export default new RedditOAuthService();
