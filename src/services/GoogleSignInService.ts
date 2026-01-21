/**
 * Google Sign-In Service
 *
 * Handles Google OAuth authentication using authorization code flow with PKCE
 * Integrates with Firebase Authentication to create user sessions
 */

import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../config/firebase';
import { User } from 'firebase/auth';

// Required for proper redirect behavior
WebBrowser.maybeCompleteAuthSession();

export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

interface GoogleSignInResult {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * Configure Google Sign-In
 * Called on app startup
 */
export function configureGoogleSignIn() {
  console.log('✅ Google Sign-In ready');
}

/**
 * Generate a random string for PKCE
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Generate code verifier and challenge for PKCE
 */
async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const codeVerifier = generateRandomString(64);
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    codeVerifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  // Convert base64 to base64url
  const codeChallenge = digest
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return { codeVerifier, codeChallenge };
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<string> {
  const tokenUrl = 'https://oauth2.googleapis.com/token';

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_IOS_CLIENT_ID,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Token exchange error:', error);
    throw new Error('Failed to exchange code for tokens');
  }

  const data = await response.json();
  return data.id_token;
}

/**
 * Sign in with Google using authorization code flow with PKCE
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  try {
    console.log('🔵 Starting Google Sign-In with PKCE');

    // Use the iOS client ID's reversed format as redirect URI
    const reversedClientId = GOOGLE_IOS_CLIENT_ID.split('.').reverse().join('.');
    const redirectUri = `${reversedClientId}:/oauth2redirect/google`;

    console.log('🔵 Redirect URI:', redirectUri);
    console.log('🔵 Using iOS Client ID:', GOOGLE_IOS_CLIENT_ID);

    // Generate PKCE values
    const { codeVerifier, codeChallenge } = await generatePKCE();
    console.log('🔵 Generated PKCE challenge');

    // Build the authorization URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_IOS_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('access_type', 'offline');

    console.log('🔵 Opening auth URL...');

    // Open the browser for authentication
    const result = await WebBrowser.openAuthSessionAsync(
      authUrl.toString(),
      redirectUri,
    );

    console.log('🔵 Auth result type:', result.type);

    if (result.type === 'success' && result.url) {
      console.log('🔵 Got success response, parsing URL...');

      // Extract the authorization code from the URL
      const url = new URL(result.url);
      const code = url.searchParams.get('code');

      if (!code) {
        throw new Error('No authorization code in response');
      }

      console.log('🔵 Got authorization code, exchanging for tokens...');

      // Exchange the code for tokens
      const idToken = await exchangeCodeForTokens(code, codeVerifier, redirectUri);

      console.log('🔵 Got ID token, signing into Firebase...');

      // Sign in to Firebase with the Google credential
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);

      console.log('✅ Successfully signed in:', userCredential.user.email);

      return {
        success: true,
        user: userCredential.user,
      };
    } else if (result.type === 'cancel' || result.type === 'dismiss') {
      return {
        success: false,
        error: 'Sign-in was cancelled',
      };
    } else {
      throw new Error('Authentication failed');
    }
  } catch (error) {
    console.error('❌ Google Sign-In error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Google sign-in failed',
    };
  }
}

/**
 * Sign out from Google
 */
export async function signOutFromGoogle(): Promise<void> {
  try {
    await auth.signOut();
    console.log('✅ Signed out from Google');
  } catch (error) {
    console.error('❌ Error signing out from Google:', error);
  }
}
