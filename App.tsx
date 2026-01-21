import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme, NavigationContainerRef } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import React, { useEffect, useState, useRef } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import LogRocket from '@logrocket/react-native';
import NotificationService from './src/services/NotificationService';

import { safeErrorLog } from './src/utils/errorLogger';

// Import global CSS for NativeWind
import './global.css';

// Keep splash screen visible during initialization
SplashScreen.preventAutoHideAsync();

// Debug mode toggle
const DEBUG_MODE = false;

// Component to handle StatusBar theme
function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

// Component to handle NavigationContainer theme
function ThemedNavigationContainer({
  children,
  linking,
  navigationRef,
}: {
  children: React.ReactNode;
  linking: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  navigationRef: React.RefObject<NavigationContainerRef<any> | null>;
}) {
  const { isDark } = useTheme();

  const customTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: 'transparent',
    },
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      theme={customTheme}
      onReady={() => {
        // Set the navigation ref for NotificationService once ready
        NotificationService.setNavigationRef(navigationRef.current);
      }}
    >
      {children}
    </NavigationContainer>
  );
}

// Wrapper to apply theme
function ThemedAppContainer({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      }}
    >
      {children}
    </View>
  );
}

/*
IMPORTANT NOTICE: DO NOT REMOVE
There are already environment keys in the project.
Before telling the user to add them, check if you already have access to the required keys through bash.
Directly access them with process.env.${key}

Correct usage:
process.env.EXPO_PUBLIC_VIBECODE_{key}
//directly access the key

Incorrect usage:
import { OPENAI_API_KEY } from '@env';
//don't use @env, its depreicated

Incorrect usage:
import Constants from 'expo-constants';
const openai_api_key = Constants.expoConfig.extra.apikey;
//don't use expo-constants, its depreicated

*/

export default function App() {
  console.log('🚀 App.tsx starting...');
  const [showDebug, setShowDebug] = useState(DEBUG_MODE);
  const [isReady, setIsReady] = useState(false);
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  // Hide splash screen after brief initialization
  useEffect(() => {
    async function prepare() {
      try {
        // Brief delay to ensure everything is ready
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('❌ Initialization error:', error);
      } finally {
        setIsReady(true);
        await SplashScreen.hideAsync();
        console.log('✅ App initialized');
      }
    }
    prepare();
  }, []);

  // Initialize LogRocket
  useEffect(() => {
    try {
      console.log('🔧 Initializing LogRocket...');
      LogRocket.init('8mef1p/arcadia-next');
      console.log('✅ LogRocket initialized');
    } catch (error) {
      console.error('❌ LogRocket initialization failed:', error);
    }
  }, []);

  // NOTE: Lead hunting is handled by:
  // 1. BackendInitializationService.startHuntingEngine() - when app opens with Reddit connected
  // 2. autonomousRedditAgent Cloud Function - runs every 30 minutes as backup

  // Log Google OAuth setup status (development only)
  useEffect(() => {
    if (__DEV__) {
      const hasIOSClient = !!process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
      const hasAndroidClient = !!process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

      console.log('');
      console.log('🔧 Google OAuth Status:');
      console.log(`   iOS Client ID: ${hasIOSClient ? '✅ Configured' : '❌ Missing'}`);
      console.log(`   Android Client ID: ${hasAndroidClient ? '✅ Configured' : '❌ Missing'}`);
      console.log('');
    }
  }, []);

  const handleAppError = (error: Error, errorInfo: any) => {
    safeErrorLog({
      error,
      context: 'App',
      errorInfo,
      extra: {
        message: 'Top-level application error - this indicates a critical issue',
      },
    });
  };

  // Linking configuration for OAuth callbacks and push notifications
  const linking = {
    prefixes: ['tava://', 'https://auth.expo.io/@anonymous/tava'],
    config: {
      screens: {
        Main: {
          screens: {
            Home: 'home',
            'Brain AI': 'brain',
            Inbox: 'inbox',
          },
        },
        LeadDetail: 'lead/:leadId',
        Conversation: 'conversation/:leadId',
        ConversationsList: 'conversations',
        Profile: 'profile',
      },
    },
  };

  // Debug screen to test if app is rendering
  if (showDebug) {
    return (
      <SafeAreaProvider>
        <View
          style={{
            flex: 1,
            backgroundColor: '#FFFFFF',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#000000', marginBottom: 20 }}>
            Debug Screen
          </Text>
          <Text style={{ fontSize: 18, color: '#333333', marginBottom: 10, textAlign: 'center' }}>
            If you can see this, React Native is working!
          </Text>
          <Text style={{ fontSize: 16, color: '#666666', marginBottom: 20, textAlign: 'center' }}>
            The black screen was likely a loading issue or navigation problem
          </Text>
          <Pressable
            onPress={() => setShowDebug(false)}
            style={{
              backgroundColor: '#4F46E5',
              paddingHorizontal: 32,
              paddingVertical: 16,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600' }}>Load Main App</Text>
          </Pressable>
        </View>
      </SafeAreaProvider>
    );
  }

  // Return a simple loading screen while initializing
  if (!isReady) {
    console.log('⏳ Initializing app...');
    return (
      <SafeAreaProvider>
        <View
          style={{
            flex: 1,
            backgroundColor: '#FFFFFF',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <ActivityIndicator size='large' color='#4F46E5' />
          <Text style={{ marginTop: 24, fontSize: 24, fontWeight: 'bold', color: '#000000' }}>
            Tava
          </Text>
          <Text style={{ marginTop: 12, fontSize: 16, color: '#666666' }}>
            Loading your workspace...
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  console.log('✅ App ready, rendering...');

  return (
    <ErrorBoundary
      onError={handleAppError}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <ThemedAppContainer>
              <ThemedNavigationContainer linking={linking} navigationRef={navigationRef}>
                <RootNavigator />
                <ThemedStatusBar />
              </ThemedNavigationContainer>
            </ThemedAppContainer>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
