import React, { useState, useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';

import HomeScreen from '../screens/HomeScreen';
import BrainAIScreen from '../screens/BrainAIScreen';
import InboxScreen from '../screens/InboxScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AboutScreen from '../screens/AboutScreen';
import AgentSettingsScreen from '../screens/AgentSettingsScreen';
import AgentSelectorScreen from '../screens/AgentSelectorScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import ArticleDetailScreen from '../screens/ArticleDetailScreen';
import ChatScreen from '../screens/ChatScreen';
import LeadDetailScreen from '../screens/LeadDetailScreen';
import ConversationScreen from '../screens/ConversationScreen';
import ConversationsListScreen from '../screens/ConversationsListScreen';
import RedditAccountSetupScreen from '../screens/RedditAccountSetupScreen';
import WorkspaceOnboardingScreen from '../screens/WorkspaceOnboardingScreen';
import FloatingTabBar from '../components/FloatingTabBar';
import WorkspaceDrawer from '../components/WorkspaceDrawer';
import FeedbackContainer from '../components/FeedbackContainer';
import { WorkspaceProvider } from '../contexts/WorkspaceContext';
import { BottomSheetProvider } from '../contexts/BottomSheetContext';
// import PaywallGuard from '../components/PaywallGuard';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      id={undefined}
      tabBar={props => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: 'transparent' },
        lazy: true,
        freezeOnBlur: true,
      }}
      // Keep screens mounted to prevent WebView reinitialization on Home screen
      // This is critical for performance - the 3D agent WebView is expensive to load
      detachInactiveScreens={false}
    >
      <Tab.Screen name='Home' component={HomeScreen} />
      <Tab.Screen name='Brain AI' component={BrainAIScreen} />
      <Tab.Screen name='Inbox' component={InboxScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [showWorkspaceDrawer, setShowWorkspaceDrawer] = useState(false);
  const { isDark } = useTheme();
  const navigation = useNavigation<any>();

  const handleOpenWorkspaceDrawer = () => {
    setShowWorkspaceDrawer(true);
  };

  const handleCloseWorkspaceDrawer = () => {
    setShowWorkspaceDrawer(false);
  };

  const handleOpenNewWorkspace = () => {
    // Close the drawer first, then navigate to workspace onboarding
    setShowWorkspaceDrawer(false);
    // Small delay to let the drawer close animation complete
    setTimeout(() => {
      navigation.navigate('WorkspaceOnboarding');
    }, 100);
  };

  return (
    <BottomSheetProvider>
      <WorkspaceProvider openWorkspaceDrawer={handleOpenWorkspaceDrawer}>
        {/* <PaywallGuard> */}
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={{ flex: 1, backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }}>
            <Stack.Navigator
              id={undefined}
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
              }}
            >
              <Stack.Screen name='Main' component={TabNavigator} />
              <Stack.Screen
                name='Profile'
                component={ProfileScreen}
                options={{
                  presentation: 'modal',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name='ChatScreen'
                component={ChatScreen}
                options={{
                  presentation: 'transparentModal',
                  headerShown: false,
                  animation: 'fade_from_bottom',
                }}
              />
              <Stack.Screen
                name='AgentSettings'
                component={AgentSettingsScreen}
                options={{
                  presentation: 'card',
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='AgentSelector'
                component={AgentSelectorScreen}
                options={{
                  presentation: 'card',
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='HelpSupport'
                component={HelpSupportScreen}
                options={{
                  presentation: 'card',
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='ArticleDetail'
                component={ArticleDetailScreen}
                options={{
                  presentation: 'card',
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='LeadDetail'
                component={LeadDetailScreen}
                options={{
                  presentation: 'card',
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='Conversation'
                component={ConversationScreen}
                options={{
                  presentation: 'card',
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='ConversationsList'
                component={ConversationsListScreen}
                options={{
                  presentation: 'card',
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='RedditAccountSetup'
                component={RedditAccountSetupScreen}
                options={{
                  presentation: 'card',
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='About'
                component={AboutScreen}
                options={{
                  presentation: 'card',
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='WorkspaceOnboarding'
                component={WorkspaceOnboardingScreen}
                options={{
                  presentation: 'fullScreenModal',
                  headerShown: false,
                  animation: 'slide_from_bottom',
                }}
              />
            </Stack.Navigator>

            {/* Workspace Drawer Modal */}
            <WorkspaceDrawer
              visible={showWorkspaceDrawer}
              onClose={handleCloseWorkspaceDrawer}
              onOpenNewWorkspace={handleOpenNewWorkspace}
            />

            {/* Global Feedback Animations (Lottie) */}
            <FeedbackContainer />
          </View>
        </TouchableWithoutFeedback>
        {/* </PaywallGuard> */}
      </WorkspaceProvider>
    </BottomSheetProvider>
  );
}
