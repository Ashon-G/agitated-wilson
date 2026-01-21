import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

// This is critical for OAuth to work properly in Expo
WebBrowser.maybeCompleteAuthSession();

interface BoxTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface AuthResult {
  success: boolean;
  email?: string;
  tokens?: BoxTokens;
  error?: string;
}

class BoxOAuthService {
  // Box OAuth endpoints
  private static readonly AUTH_ENDPOINT = 'https://account.box.com/api/oauth2/authorize';
  private static readonly TOKEN_ENDPOINT = 'https://api.box.com/oauth2/token';
  private static readonly REVOKE_ENDPOINT = 'https://api.box.com/oauth2/revoke';
  private static readonly USER_ENDPOINT = 'https://api.box.com/2.0/users/me';

  // Box OAuth scopes
  private static readonly SCOPES = ['root_readonly']; // Read all files and folders

  // Store redirect URI to ensure consistency between auth and token exchange
  private currentRedirectUri: string | null = null;

  /**
   * Get Box Client ID from environment variables
   */
  private getClientId(): string {
    const clientId = process.env.EXPO_PUBLIC_BOX_CLIENT_ID;
    if (!clientId) {
      throw new Error('EXPO_PUBLIC_BOX_CLIENT_ID not configured in .env file');
    }
    return clientId;
  }

  /**
   * Get Box Client Secret from environment variables
   */
  private getClientSecret(): string {
    const clientSecret = process.env.EXPO_PUBLIC_BOX_CLIENT_SECRET;
    if (!clientSecret) {
      console.warn('⚠️ EXPO_PUBLIC_BOX_CLIENT_SECRET not configured - some providers may require it');
      return '';
    }
    return clientSecret;
  }

  /**
   * Normalize redirect URI to ensure consistency
   * Removes trailing slashes and ensures proper format
   */
  private normalizeRedirectUri(uri: string): string {
    // Remove trailing slash if present
    let normalized = uri.endsWith('/') ? uri.slice(0, -1) : uri;

    // Ensure scheme is lowercase (though most are case-insensitive)
    const schemeMatch = normalized.match(/^([^:]+):\/\//);
    if (schemeMatch) {
      const scheme = schemeMatch[1].toLowerCase();
      normalized = normalized.replace(/^[^:]+:\/\//, `${scheme}://`);
    }

    console.log('🔵 Normalized redirect URI:', normalized);
    return normalized;
  }

  /**
   * Create redirect URI for OAuth flow
   * Uses custom app scheme for deep linking
   */
  private getRedirectUri(): string {
    // Use app scheme for OAuth callback
    const redirectUri = AuthSession.makeRedirectUri({
      scheme: 'tava',
      path: 'oauth2redirect',
    });

    const normalized = this.normalizeRedirectUri(redirectUri);

    console.log('🔵 Box OAuth Redirect URI (raw):', redirectUri);
    console.log('🔵 Box OAuth Redirect URI (normalized):', normalized);

    // Store for use in token exchange
    this.currentRedirectUri = normalized;

    return normalized;
  }

  /**
   * Get the redirect URI that will be used for OAuth
   * Useful for debugging and configuration
   */
  getRedirectUriForDebug(): string {
    const redirectUri = AuthSession.makeRedirectUri({
      scheme: 'tava',
      path: 'oauth2redirect',
    });
    return this.normalizeRedirectUri(redirectUri);
  }

  /**
   * Authenticate with Box using OAuth 2.0 with PKCE
   */
  async authenticateBox(): Promise<AuthResult> {
    try {
      console.log('Starting Box OAuth flow...');

      const clientId = this.getClientId();
      const redirectUri = this.getRedirectUri();

      console.log('🔵 Box OAuth config:');
      console.log('   Client ID:', `${clientId.substring(0, 20)  }...`);
      console.log('   Redirect URI:', redirectUri);
      console.log('   Scopes:', BoxOAuthService.SCOPES.join(', '));

      // Generate PKCE code verifier and challenge
      console.log('🔵 Generating PKCE code verifier and challenge...');
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);

      // Create auth request
      console.log('🔵 Creating AuthRequest...');
      const request = new AuthSession.AuthRequest({
        clientId,
        scopes: BoxOAuthService.SCOPES,
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
        codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
        codeChallenge,
      });

      // Box OAuth discovery
      const discovery = {
        authorizationEndpoint: BoxOAuthService.AUTH_ENDPOINT,
        tokenEndpoint: BoxOAuthService.TOKEN_ENDPOINT,
        revocationEndpoint: BoxOAuthService.REVOKE_ENDPOINT,
      };

      console.log('🔵 Opening browser for authentication...');

      // Prompt for authentication
      const result = await request.promptAsync(discovery);

      console.log('🔵 Box auth result type:', result.type);

      if (result.type === 'success') {
        console.log('🟢 Box OAuth success!');

        const code = (result as any).params?.code;

        if (code) {
          console.log('🔵 Authorization code received, exchanging for tokens...');

          // Exchange authorization code for tokens
          const tokens = await this.exchangeCodeForToken(
            code,
            codeVerifier,
            redirectUri,
            clientId,
          );

          if (tokens) {
            console.log('🟢 Token exchange successful!');

            // Get user email
            console.log('🔵 Fetching user email...');
            const email = await this.getUserEmail(tokens.accessToken);
            console.log('🟢 User email retrieved:', email);

            return {
              success: true,
              email,
              tokens,
            };
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
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        return {
          success: false,
          error: 'Authentication cancelled by user',
        };
      } else {
        console.error('🔴 Unexpected result type:', result.type);
        return {
          success: false,
          error: 'Authentication failed',
        };
      }
    } catch (error) {
      console.error('🔴 Box authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  private async exchangeCodeForToken(
    code: string,
    codeVerifier: string,
    redirectUri: string,
    clientId: string,
  ): Promise<BoxTokens | null> {
    try {
      console.log('🔵 Exchanging authorization code for tokens...');

      // Use stored redirect URI if available (ensures consistency)
      const actualRedirectUri = this.currentRedirectUri || redirectUri;
      const clientSecret = this.getClientSecret();

      console.log('🔵 Token exchange parameters:');
      console.log('   - Code:', `${code.substring(0, 20)  }...`);
      console.log('   - Client ID:', `${clientId.substring(0, 20)  }...`);
      console.log('   - Client Secret:', clientSecret ? `Present (length: ${  clientSecret.length  })` : 'Not provided');
      console.log('   - Redirect URI:', actualRedirectUri);
      console.log('   - Grant type: authorization_code');
      console.log('   - Code verifier length:', codeVerifier.length);
      console.log('   - PKCE enabled: Yes');

      // Build request body
      const bodyParams: Record<string, string> = {
        code,
        client_id: clientId,
        redirect_uri: actualRedirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      };

      // Add client secret if available (Box may require it even with PKCE)
      if (clientSecret) {
        bodyParams.client_secret = clientSecret;
        console.log('🔵 Including client_secret in token exchange');
      } else {
        console.log('⚠️ No client_secret provided - relying on PKCE only');
      }

      const response = await fetch(BoxOAuthService.TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(bodyParams).toString(),
      });

      console.log('🔵 Token exchange response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 Token exchange HTTP error:', response.status);
        console.error('🔴 Response body:', errorText);

        try {
          const errorJson = JSON.parse(errorText);
          console.error('🔴 Error details:', JSON.stringify(errorJson, null, 2));

          // Provide specific guidance based on error
          if (errorJson.error === 'invalid_grant') {
            console.error('🔴 INVALID_GRANT - Possible causes:');
            console.error('   1. Redirect URI mismatch');
            console.error('   2. Authorization code already used');
            console.error('   3. Authorization code expired');
            console.error('   4. Code verifier mismatch');
          } else if (errorJson.error === 'invalid_client') {
            console.error('🔴 INVALID_CLIENT - Check Client ID and Secret');
          }
        } catch (e) {
          // Not JSON, already logged as text
        }

        return null;
      }

      const data = await response.json();
      console.log('🔵 Token exchange response keys:', Object.keys(data));

      if (data.error) {
        console.error('🔴 Token exchange error:', data.error);
        console.error('🔴 Error description:', data.error_description);
        console.error('🔴 Full error response:', JSON.stringify(data, null, 2));
        return null;
      }

      if (data.access_token) {
        const expiresAt = Date.now() + (data.expires_in * 1000);

        console.log('🟢 Token exchange successful!');
        console.log('   - Access token received: Yes');
        console.log('   - Refresh token received:', data.refresh_token ? 'Yes' : 'No');
        console.log('   - Expires in:', data.expires_in, 'seconds');

        // Clear stored redirect URI after successful exchange
        this.currentRedirectUri = null;

        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || '',
          expiresAt,
        };
      }

      console.error('🔴 No access token in response');
      console.error('🔴 Response data:', JSON.stringify(data, null, 2));
      return null;
    } catch (error) {
      console.error('🔴 Token exchange exception:', error);
      console.error('🔴 Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('🔴 Error message:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Refresh Box access token using refresh token
   */
  async refreshBoxToken(refreshToken: string): Promise<BoxTokens | null> {
    try {
      console.log('🔵 Refreshing Box access token...');

      const clientId = this.getClientId();
      const clientSecret = this.getClientSecret();

      const bodyParams: Record<string, string> = {
        refresh_token: refreshToken,
        client_id: clientId,
        grant_type: 'refresh_token',
      };

      // Add client secret if available (Box may require it)
      if (clientSecret) {
        bodyParams.client_secret = clientSecret;
        console.log('🔵 Including client_secret in token refresh');
      }

      const response = await fetch(BoxOAuthService.TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(bodyParams).toString(),
      });

      console.log('🔵 Token refresh response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 Token refresh failed:', response.status, errorText);

        try {
          const errorJson = JSON.parse(errorText);
          console.error('🔴 Token refresh error details:', JSON.stringify(errorJson, null, 2));

          // Provide helpful error messages
          if (errorJson.error === 'invalid_grant') {
            console.error('🔴 INVALID_GRANT - Refresh token is invalid or expired');
            console.error('   User needs to reconnect their Box account');
          }
        } catch (e) {
          // Not JSON
        }

        return null;
      }

      const data = await response.json();

      if (data.error) {
        console.error('🔴 Token refresh error:', data.error, data.error_description);
        return null;
      }

      if (data.access_token) {
        const expiresAt = Date.now() + (data.expires_in * 1000);

        console.log('🟢 Token refresh successful');
        console.log('   - New access token received: Yes');
        console.log('   - New refresh token received:', data.refresh_token ? 'Yes' : 'No (using old)');
        console.log('   - Expires in:', data.expires_in, 'seconds');

        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || refreshToken,
          expiresAt,
        };
      }

      console.error('🔴 No access token in refresh response');
      return null;
    } catch (error) {
      console.error('🔴 Token refresh exception:', error);
      return null;
    }
  }

  /**
   * Revoke Box access token (disconnect)
   */
  async revokeBoxToken(token: string): Promise<boolean> {
    try {
      console.log('Revoking Box token...');

      const clientId = this.getClientId();

      const response = await fetch(BoxOAuthService.REVOKE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token,
          client_id: clientId,
        }).toString(),
      });

      if (response.ok) {
        console.log('Token revoked successfully');
        return true;
      } else {
        console.warn('Token revocation failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('Token revocation error:', error);
      return false;
    }
  }

  /**
   * Get user email from access token
   */
  private async getUserEmail(accessToken: string): Promise<string> {
    try {
      const response = await fetch(BoxOAuthService.USER_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.login || 'unknown@box.com';
      }

      return 'unknown@box.com';
    } catch (error) {
      console.error('Failed to get user email:', error);
      return 'unknown@box.com';
    }
  }

  /**
   * Generate PKCE code verifier (random string)
   */
  private generateCodeVerifier(): string {
    const randomBytes = Crypto.getRandomBytes(32);
    const array = Array.from(randomBytes);
    return this.base64UrlEncode(array);
  }

  /**
   * Generate PKCE code challenge from verifier
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      verifier,
      { encoding: Crypto.CryptoEncoding.BASE64 },
    );
    // Box expects base64url encoded (no padding, URL-safe characters)
    const challenge = digest
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    console.log('🔵 PKCE code challenge generated (length:', `${challenge.length  })`);
    return challenge;
  }

  /**
   * Base64 URL encode (for PKCE)
   */
  private base64UrlEncode(input: string | number[]): string {
    let str: string;

    if (Array.isArray(input)) {
      str = String.fromCharCode(...input);
    } else {
      str = input;
    }

    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}

export default new BoxOAuthService();
