/**
 * HubSpot OAuth Service
 * Handles OAuth flow, token management, and secure storage
 *
 * For Vibecode: Uses a state parameter to track OAuth sessions and polls for completion
 * since deep links open the published app, not the Vibecode preview.
 */

import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import BackendService from '../BackendService';
import AuthenticationService from '../AuthenticationService';
import { HubSpotIntegration } from '../../types/integrations';
import { logHubSpotDiagnostics } from '../../utils/hubspotDiagnostic';

// HubSpot OAuth Configuration
const HUBSPOT_CLIENT_ID = process.env.EXPO_PUBLIC_HUBSPOT_CLIENT_ID || '';
const HUBSPOT_CLIENT_SECRET = process.env.EXPO_PUBLIC_HUBSPOT_CLIENT_SECRET || '';
const HUBSPOT_ACCESS_TOKEN = process.env.EXPO_PUBLIC_HUBSPOT_ACCESS_TOKEN || '';

// HubSpot requires HTTPS redirect URLs - using heyvata.com callback page
const HUBSPOT_REDIRECT_URI = 'https://heyvata.com/oauth/hubspot/callback.html';

// Required scopes - minimal set for basic functionality
const HUBSPOT_SCOPES = [
  'oauth',
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
];

// Optional scopes - only request if user grants them
const HUBSPOT_OPTIONAL_SCOPES = [
  'crm.objects.companies.read',
  'crm.objects.companies.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
  'crm.schemas.companies.read',
  'crm.schemas.contacts.read',
  'crm.schemas.contacts.write',
  'crm.schemas.deals.read',
  'timeline',
];

WebBrowser.maybeCompleteAuthSession();

class HubSpotAuthService {
  private isConnecting: boolean = false;

  constructor() {
    console.log('🔗 HubSpot OAuth redirect URI:', HUBSPOT_REDIRECT_URI);
  }

  private getRedirectUri(): string {
    return HUBSPOT_REDIRECT_URI;
  }

  private isPrivateApp(): boolean {
    return !!HUBSPOT_ACCESS_TOKEN && HUBSPOT_ACCESS_TOKEN.length > 10;
  }

  /**
   * Generate a unique state for OAuth session tracking
   */
  private generateOAuthState(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Store pending OAuth session in Firestore
   */
  private async storePendingOAuth(userId: string, state: string): Promise<void> {
    await BackendService.setDocument(
      'oauth_pending',
      state,
      {
        userId,
        type: 'hubspot',
        createdAt: new Date(),
        status: 'pending',
      },
    );
    console.log('📝 Stored pending OAuth session:', state);
  }

  /**
   * Check if OAuth was completed (code was received via callback)
   */
  private async checkOAuthCompletion(state: string): Promise<string | null> {
    try {
      const doc = await BackendService.getDocument('oauth_pending', state) as {
        status?: string;
        code?: string;
      } | null;
      if (doc && doc.status === 'completed' && doc.code) {
        console.log('✅ Found completed OAuth session');
        // Clean up the pending document
        await BackendService.deleteDocument('oauth_pending', state);
        return doc.code;
      }
      return null;
    } catch (error) {
      console.log('OAuth completion check error:', error);
      return null;
    }
  }

  /**
   * Poll for OAuth completion
   */
  private async pollForOAuthCompletion(state: string, timeoutMs: number = 300000): Promise<string | null> {
    const startTime = Date.now();
    const pollInterval = 2000; // Check every 2 seconds

    console.log('🔄 Polling for OAuth completion...');

    while (Date.now() - startTime < timeoutMs) {
      const code = await this.checkOAuthCompletion(state);
      if (code) {
        return code;
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    console.log('⏰ OAuth polling timeout');
    // Clean up the pending document
    try {
      await BackendService.deleteDocument('oauth_pending', state);
    } catch (e) {
      // Ignore cleanup errors
    }
    return null;
  }

  /**
   * Start OAuth flow to connect HubSpot
   */
  async connect(): Promise<HubSpotIntegration | null> {
    if (this.isConnecting) {
      console.log('⚠️ HubSpot connection already in progress');
      throw new Error('Connection already in progress');
    }

    try {
      this.isConnecting = true;

      const user = AuthenticationService.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Check if using Private App
      if (this.isPrivateApp()) {
        console.log('🔗 Connecting with HubSpot Private App...');
        return await this.connectPrivateApp(user.uid);
      }

      // OAuth flow
      console.log('🔗 Starting HubSpot OAuth flow...');
      logHubSpotDiagnostics();

      if (!HUBSPOT_CLIENT_ID || HUBSPOT_CLIENT_ID === 'your-client-id') {
        throw new Error('HubSpot not configured. Add EXPO_PUBLIC_HUBSPOT_CLIENT_ID to your .env file.');
      }

      // Generate state for tracking this OAuth session
      const state = this.generateOAuthState();
      await this.storePendingOAuth(user.uid, state);

      const authUrl = this.buildAuthUrl(state);
      console.log('📱 Opening OAuth browser with state:', state);

      // Open browser
      WebBrowser.openBrowserAsync(authUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });

      // Poll for completion (the callback page will update Firestore)
      const code = await this.pollForOAuthCompletion(state);

      // Try to close the browser
      try {
        await WebBrowser.dismissBrowser();
      } catch (e) {
        // Browser might already be closed
      }

      if (!code) {
        console.log('⚠️ No authorization code received');
        return null;
      }

      console.log('🔑 Got authorization code, exchanging for tokens...');

      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(code, HUBSPOT_REDIRECT_URI);

      // Get portal info
      const portalInfo = await this.getPortalInfo(tokens.access_token);

      // Create integration record
      const integration: Omit<HubSpotIntegration, 'id'> = {
        userId: user.uid,
        type: 'hubspot',
        name: `HubSpot (${portalInfo.portalId})`,
        enabled: true,
        connectedAt: new Date(),
        syncStatus: 'active',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        portalId: portalInfo.portalId,
        hubDomain: portalInfo.hubDomain,
        settings: {
          syncFrequency: 'hourly',
          learnFrom: {
            closedDeals: true,
            contactNotes: true,
            engagementHistory: true,
            dealStages: true,
          },
          syncBack: {
            newLeads: true,
            agentActivity: true,
            leadScores: true,
            statusUpdates: true,
          },
          filters: {
            dealDaysBack: 90,
          },
        },
      };

      // Save to Firestore
      const savedIntegration = await BackendService.createDocument<HubSpotIntegration>(
        `users/${user.uid}/integrations`,
        integration,
      );

      console.log('✅ HubSpot connected successfully:', savedIntegration.id);
      return savedIntegration;
    } catch (error) {
      console.error('❌ Failed to connect HubSpot:', error);
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Connect using Private App access token
   */
  private async connectPrivateApp(userId: string): Promise<HubSpotIntegration> {
    try {
      // Verify token works by making a test API call
      const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
        headers: {
          Authorization: `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Invalid HubSpot access token. Please check your EXPO_PUBLIC_HUBSPOT_ACCESS_TOKEN in .env file.');
      }

      // Get account info
      const accountResponse = await fetch('https://api.hubapi.com/account-info/v3/details', {
        headers: {
          Authorization: `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      let portalId = 'unknown';
      const hubDomain = 'app.hubspot.com';

      if (accountResponse.ok) {
        const accountData = await accountResponse.json();
        portalId = accountData.portalId || accountData.hubId || 'unknown';
      }

      // Create integration record for Private App
      const integration: Omit<HubSpotIntegration, 'id'> = {
        userId,
        type: 'hubspot',
        name: 'HubSpot Private App',
        enabled: true,
        connectedAt: new Date(),
        syncStatus: 'active',
        accessToken: HUBSPOT_ACCESS_TOKEN,
        refreshToken: '', // Private apps don't have refresh tokens
        expiresAt: new Date('2099-12-31'), // Private app tokens don't expire
        portalId,
        hubDomain,
        settings: {
          syncFrequency: 'hourly',
          learnFrom: {
            closedDeals: true,
            contactNotes: true,
            engagementHistory: true,
            dealStages: true,
          },
          syncBack: {
            newLeads: true,
            agentActivity: true,
            leadScores: true,
            statusUpdates: true,
          },
          filters: {
            dealDaysBack: 90,
          },
        },
      };

      // Save to Firestore
      const savedIntegration = await BackendService.createDocument<HubSpotIntegration>(
        `users/${userId}/integrations`,
        integration,
      );

      console.log('✅ HubSpot Private App connected successfully');

      return savedIntegration;
    } catch (error) {
      console.error('❌ Failed to connect HubSpot Private App:', error);
      throw error;
    }
  }

  /**
   * Disconnect HubSpot integration
   */
  async disconnect(integrationId: string): Promise<void> {
    try {
      const user = AuthenticationService.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      await BackendService.deleteDocument(
        `users/${user.uid}/integrations`,
        integrationId,
      );

      console.log('✅ HubSpot disconnected');
    } catch (error) {
      console.error('❌ Failed to disconnect HubSpot:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(integration: HubSpotIntegration): Promise<HubSpotIntegration> {
    try {
      console.log('🔄 Refreshing HubSpot access token...');

      const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: HUBSPOT_CLIENT_ID,
          client_secret: HUBSPOT_CLIENT_SECRET,
          refresh_token: integration.refreshToken,
        }).toString(),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const tokens = await response.json();

      // Update integration with new tokens
      const updatedIntegration: HubSpotIntegration = {
        ...integration,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || integration.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      };

      // Save to Firestore
      const user = AuthenticationService.getCurrentUser();
      if (user) {
        await BackendService.updateDocument<HubSpotIntegration>(
          `users/${user.uid}/integrations`,
          integration.id,
          {
            accessToken: updatedIntegration.accessToken,
            refreshToken: updatedIntegration.refreshToken,
            expiresAt: updatedIntegration.expiresAt,
          } as any,
        );
      }

      console.log('✅ Token refreshed successfully');

      return updatedIntegration;
    } catch (error) {
      console.error('❌ Failed to refresh token:', error);
      throw error;
    }
  }

  /**
   * Get current HubSpot integration for user
   */
  async getCurrentIntegration(): Promise<HubSpotIntegration | null> {
    try {
      const user = AuthenticationService.getCurrentUser();
      if (!user) {
        return null;
      }

      const integrations = await BackendService.queryCollection<HubSpotIntegration>(
        `users/${user.uid}/integrations`,
        {
          where: [{ field: 'type', operator: '==', value: 'hubspot' }],
          limit: 1,
        },
      );

      if (integrations.length === 0) {
        return null;
      }

      const integration = integrations[0];

      // Check if token needs refresh
      const now = new Date();
      const expiresAt = integration.expiresAt instanceof Date
        ? integration.expiresAt
        : new Date(integration.expiresAt);

      if (expiresAt <= now) {
        return await this.refreshAccessToken(integration);
      }

      return integration;
    } catch (error) {
      console.error('❌ Failed to get HubSpot integration:', error);
      return null;
    }
  }

  /**
   * Build OAuth authorization URL
   */
  private buildAuthUrl(state?: string): string {
    // Use the exact install URL format from HubSpot to avoid encoding issues
    const baseUrl = 'https://app-na2.hubspot.com/oauth/authorize';
    const params = new URLSearchParams();

    params.set('client_id', HUBSPOT_CLIENT_ID);
    params.set('redirect_uri', HUBSPOT_REDIRECT_URI);
    params.set('scope', HUBSPOT_SCOPES.join(' '));

    if (HUBSPOT_OPTIONAL_SCOPES.length > 0) {
      params.set('optional_scope', HUBSPOT_OPTIONAL_SCOPES.join(' '));
    }

    if (state) {
      params.set('state', state);
    }

    const url = `${baseUrl}?${params.toString()}`;
    console.log('🔗 OAuth URL:', url);
    return url;
  }

  /**
   * Extract authorization code from redirect URL
   */
  private extractCodeFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get('code');
    } catch (error) {
      console.error('Failed to parse redirect URL:', error);
      return null;
    }
  }

  /**
   * Exchange authorization code for access tokens
   */
  private async exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    console.log('🔄 Exchanging code for tokens...');
    console.log('  Client ID:', HUBSPOT_CLIENT_ID);
    console.log('  Redirect URI:', redirectUri);
    console.log('  Code (first 10 chars):', `${code.substring(0, 10)}...`);

    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: HUBSPOT_CLIENT_ID,
        client_secret: HUBSPOT_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Token exchange failed:', response.status, errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
        console.error('❌ Error details:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.error('❌ Raw error:', errorText);
      }
      throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
    }

    const tokens = await response.json();
    console.log('✅ Token exchange successful');
    return tokens;
  }

  /**
   * Get portal information
   */
  private async getPortalInfo(accessToken: string): Promise<{
    portalId: string;
    hubDomain: string;
  }> {
    // Use the access token info endpoint - no auth header needed, token is in URL
    const response = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${accessToken}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to get portal info:', response.status, errorText);
      throw new Error(`Failed to get portal info: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Got portal info:', data.hub_id);

    return {
      portalId: String(data.hub_id),
      hubDomain: `https://app.hubspot.com/contacts/${data.hub_id}`,
    };
  }
}

export default new HubSpotAuthService();
