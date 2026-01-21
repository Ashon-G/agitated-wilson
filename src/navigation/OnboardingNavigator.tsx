import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import WelcomeScreen from '../screens/WelcomeScreen';
import AgentRevealScreen from '../screens/onboarding/AgentRevealScreen';
import VoiceOnboardingScreen from '../screens/onboarding/VoiceOnboardingScreen';
import OnboardingRedditSetupScreen from '../screens/onboarding/OnboardingRedditSetupScreen';
import FirstLeadDiscoveryScreen from '../screens/onboarding/FirstLeadDiscoveryScreen';
import { AgentId } from '../data/agentPersonalities';

export type OnboardingStackParamList = {
  Welcome: undefined;
  VoiceOnboarding: undefined;
  RedditSetup: undefined;
  FirstLeadDiscovery: undefined;
  AgentReveal: { agentId: AgentId };
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export default function OnboardingNavigator() {
  const { isDark } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }}>
      <Stack.Navigator
        id={undefined}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="VoiceOnboarding" component={VoiceOnboardingScreen} />
        <Stack.Screen name="RedditSetup" component={OnboardingRedditSetupScreen} />
        <Stack.Screen name="FirstLeadDiscovery" component={FirstLeadDiscoveryScreen} />
        <Stack.Screen name="AgentReveal" component={AgentRevealScreen} />
      </Stack.Navigator>
    </View>
  );
}
