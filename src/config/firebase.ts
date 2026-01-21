/**
 * Firebase Configuration
 * Environment-based configuration to prevent hardcoded credentials
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, Auth } from 'firebase/auth';
// @ts-expect-error - getReactNativePersistence is exported from RN bundle but not in types
import { getReactNativePersistence } from '@firebase/auth/dist/rn/index.js';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Environment-based Firebase configuration
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Validate required configuration
const requiredConfig = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

const missingConfig = requiredConfig.filter(
  key => !firebaseConfig[key as keyof typeof firebaseConfig],
);

if (missingConfig.length > 0) {
  throw new Error(
    `Firebase configuration missing required environment variables: ${missingConfig.join(', ')}\n` +
      'Please check your .env file and ensure all EXPO_PUBLIC_FIREBASE_* variables are set.',
  );
}

// Initialize Firebase app (prevent multiple initializations)
let app: FirebaseApp;
let auth: Auth;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  // Initialize Firebase Auth with AsyncStorage persistence for React Native
  // This ensures user stays logged in even after closing the app
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
  console.log('✅ Firebase Auth initialized with AsyncStorage persistence');
} else {
  app = getApps()[0];
  auth = getAuth(app);
  console.log('✅ Firebase Auth retrieved from existing app');
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Note: In Vibecode environment, we use production Firebase Functions
// The emulator connection is disabled to prevent "internal" errors
// when the emulator is not running locally
// If you need to test with emulator locally, uncomment the code below:
//
// if (__DEV__ && process.env.EXPO_PUBLIC_USE_EMULATOR === 'true') {
//   const { connectFunctionsEmulator } = require('firebase/functions');
//   try {
//     connectFunctionsEmulator(functions, '127.0.0.1', 5001);
//     console.log('✅ Connected to Firebase Functions Emulator');
//   } catch (error) {
//     console.warn('⚠️ Could not connect to Functions Emulator:', error);
//   }
// }

// Export the app instance
export default app;

// Firestore Collections Configuration
// Only collections actively used in the codebase
export const COLLECTIONS = {
  // Core Agent & Lead Management
  SALES_AGENTS: 'sales_agents',
  LEADS: 'leads',
  CONVERSATIONS: 'conversations',
  CONVERSATION_MESSAGES: 'conversation_messages',

  // Knowledge & Learning
  TRAINING_SESSIONS: 'training_sessions',
  TRAINING_DATA: 'training_data',

  // Agent Communication & Management
  AGENT_INBOX: 'agent_inbox',
  AGENT_ACTIONS: 'agent_actions',
  SCHEDULED_QUESTIONS: 'scheduled_questions',
  USER_PREFERENCES: 'user_preferences',

  // Usage Events & Billing
  QUALIFIED_LEAD_EVENTS: 'qualified_lead_events',
  LINK_CLICK_EVENTS: 'link_click_events',
  BILLING_EVENTS: 'billing_events',
} as const;

// Configuration validation helper
export const validateFirebaseConfig = () => {
  const config = {
    hasApiKey: !!firebaseConfig.apiKey,
    hasAuthDomain: !!firebaseConfig.authDomain,
    hasProjectId: !!firebaseConfig.projectId,
    hasStorageBucket: !!firebaseConfig.storageBucket,
    hasMessagingSenderId: !!firebaseConfig.messagingSenderId,
    hasAppId: !!firebaseConfig.appId,
    hasMeasurementId: !!firebaseConfig.measurementId,
  };

  const isValid = Object.values(config).every(Boolean);

  return {
    isValid,
    config,
    missing: Object.entries(config)
      .filter(([_, value]) => !value)
      .map(([key]) => key.replace('has', '').toLowerCase()),
  };
};
