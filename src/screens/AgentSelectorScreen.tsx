import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Check, Sparkles } from 'lucide-react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import WebView from 'react-native-webview';

import { useTheme } from '../contexts/ThemeContext';
import useProfileStore from '../state/profileStore';
import { getAllAgents, getAgent, AgentId, AgentPersonality } from '../data/agentPersonalities';
import { hapticFeedback } from '../utils/hapticFeedback';
import { toastManager } from '../utils/toastManager';
import GlobalHeader from '../components/GlobalHeader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;

interface AgentPreviewProps {
  agent: AgentPersonality;
  isSelected: boolean;
  onSelect: () => void;
  isCurrentAgent: boolean;
}

function AgentPreview({ agent, isSelected, onSelect, isCurrentAgent }: AgentPreviewProps) {
  const { isDark } = useTheme();
  const scale = useSharedValue(1);
  const [modelLoaded, setModelLoaded] = useState(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  // Agent-specific gradient colors
  const gradientColors: Record<AgentId, readonly [string, string, string]> = {
    marcus: ['#1E3A5F', '#2C5282', '#3182CE'] as const,
    sophia: ['#5B2C6F', '#7D3C98', '#9B59B6'] as const,
    vashon: ['#1A4D2E', '#2E7D32', '#4CAF50'] as const,
  };

  const idleUrl = agent.gender === 'male'
    ? 'https://raw.githubusercontent.com/readyplayerme/animation-library/master/masculine/glb/idle/M_Standing_Idle_Variations_003.glb'
    : 'https://raw.githubusercontent.com/readyplayerme/animation-library/master/feminine/glb/idle/F_Standing_Idle_Variations_003.glb';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <style>
        * { margin: 0; padding: 0; }
        body {
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: transparent;
        }
        #container { width: 100%; height: 100%; }
      </style>
    </head>
    <body>
      <div id="container"></div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
      <script>
        (function() {
          const container = document.getElementById('container');
          const scene = new THREE.Scene();
          const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 1000);
          camera.position.set(0, 0.8, 2.8);

          const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
          renderer.setSize(window.innerWidth, window.innerHeight);
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          container.appendChild(renderer.domElement);

          const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
          scene.add(ambientLight);

          const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
          directionalLight.position.set(2, 3, 4);
          scene.add(directionalLight);

          const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
          backLight.position.set(-2, 2, -2);
          scene.add(backLight);

          const controls = new THREE.OrbitControls(camera, renderer.domElement);
          controls.enableZoom = false;
          controls.enablePan = false;
          controls.autoRotate = true;
          controls.autoRotateSpeed = 1.5;
          controls.target.set(0, 0.5, 0);
          controls.update();

          const loader = new THREE.GLTFLoader();
          let mixer;

          loader.load(
            '${agent.modelUrl}',
            function(gltf) {
              const avatar = gltf.scene;
              avatar.scale.set(1, 1, 1);
              avatar.position.set(0, -0.5, 0);
              scene.add(avatar);

              loader.load('${idleUrl}', function(animGltf) {
                if (animGltf.animations && animGltf.animations.length > 0) {
                  mixer = new THREE.AnimationMixer(avatar);
                  const action = mixer.clipAction(animGltf.animations[0]);
                  action.play();
                }
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage('loaded');
              });
            }
          );

          const clock = new THREE.Clock();
          function animate() {
            requestAnimationFrame(animate);
            if (mixer) mixer.update(clock.getDelta());
            controls.update();
            renderer.render(scene, camera);
          }
          animate();
        })();
      </script>
    </body>
    </html>
  `;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onSelect}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        className="mb-4"
      >
        <View
          className={`rounded-3xl overflow-hidden border-2 ${
            isSelected
              ? 'border-green-500'
              : isDark
                ? 'border-gray-700'
                : 'border-gray-200'
          }`}
          style={{ width: CARD_WIDTH }}
        >
          {/* 3D Preview */}
          <View style={{ height: 280 }}>
            <LinearGradient
              colors={gradientColors[agent.id]}
              style={{ position: 'absolute', width: '100%', height: '100%' }}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            {!modelLoaded && (
              <View className="absolute inset-0 items-center justify-center">
                <ActivityIndicator size="large" color="white" />
              </View>
            )}
            <WebView
              source={{ html }}
              style={{ backgroundColor: 'transparent' }}
              javaScriptEnabled
              domStorageEnabled
              allowFileAccess
              originWhitelist={['*']}
              mixedContentMode="always"
              onMessage={(event) => {
                console.log(`[AgentSelector] ${agent.name} WebView message:`, event.nativeEvent.data);
                setModelLoaded(true);
              }}
              onError={(syntheticEvent) => {
                console.error(`[AgentSelector] ${agent.name} WebView error:`, syntheticEvent.nativeEvent);
              }}
              onLoad={() => {
                console.log(`[AgentSelector] ${agent.name} WebView loaded`);
              }}
            />

            {/* Selection indicator */}
            {isSelected && (
              <View className="absolute top-3 right-3 bg-green-500 rounded-full p-2">
                <Check size={20} color="white" strokeWidth={3} />
              </View>
            )}

            {/* Current agent badge */}
            {isCurrentAgent && (
              <View className="absolute top-3 left-3 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5">
                <Text className="text-white text-xs font-semibold">Current</Text>
              </View>
            )}
          </View>

          {/* Agent Info */}
          <View className={`p-5 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <View className="flex-row items-center justify-between mb-2">
              <View>
                <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {agent.name}
                </Text>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {agent.title}
                </Text>
              </View>
              <View className={`px-3 py-1.5 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <Text className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  {agent.voiceName}
                </Text>
              </View>
            </View>

            <Text className={`text-sm mb-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              {agent.description}
            </Text>

            {/* Traits */}
            <View className="flex-row flex-wrap gap-2 mb-4">
              {agent.traits.map((trait, index) => (
                <View
                  key={index}
                  className={`px-3 py-1.5 rounded-full ${
                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-600'
                    }`}
                  >
                    {trait}
                  </Text>
                </View>
              ))}
            </View>

            {/* Best For */}
            <View>
              <Text className={`text-xs font-semibold mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Best for:
              </Text>
              <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {agent.bestFor.slice(0, 3).join(' • ')}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function AgentSelectorScreen() {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const profile = useProfileStore(s => s.profile);
  const updateProfile = useProfileStore(s => s.updateProfile);

  const [selectedAgentId, setSelectedAgentId] = useState<AgentId | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const currentAgentId = profile?.onboardingData?.assignedAgentId ?? profile?.assignedAgentId;
  const agents = getAllAgents();

  useEffect(() => {
    if (currentAgentId) {
      setSelectedAgentId(currentAgentId);
    }
  }, [currentAgentId]);

  const handleSelectAgent = (agentId: AgentId) => {
    hapticFeedback.selection();
    setSelectedAgentId(agentId);
  };

  const handleClose = () => {
    hapticFeedback.light();
    navigation.goBack();
  };

  const handleSave = async () => {
    if (!selectedAgentId || selectedAgentId === currentAgentId) {
      navigation.goBack();
      return;
    }

    setIsSaving(true);
    hapticFeedback.medium();

    try {
      const agent = getAgent(selectedAgentId);
      const agentInstanceId = `${selectedAgentId}_${profile?.id ?? 'user'}_${Date.now()}`;

      await updateProfile({
        assignedAgentId: selectedAgentId,
        agentInstanceId,
        onboardingData: {
          ...profile?.onboardingData,
          assignedAgentId: selectedAgentId,
          agentInstanceId,
          agentAssignedAt: new Date(),
        },
      });

      toastManager.success(`Switched to ${agent.name}!`);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to update agent:', error);
      toastManager.error('Failed to switch agent. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = selectedAgentId && selectedAgentId !== currentAgentId;

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <GlobalHeader
        title="Choose Your Agent"
        showCloseButton
        onClose={handleClose}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100)} className="mb-6 mt-4">
          <View className="flex-row items-center mb-2">
            <Sparkles size={20} color={isDark ? '#A78BFA' : '#7C3AED'} />
            <Text className={`ml-2 text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Pick Your Sales Partner
            </Text>
          </View>
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Each agent has a unique personality and selling style. Choose the one that best fits your business.
          </Text>
        </Animated.View>

        {/* Agent Cards */}
        {agents.map((agent, index) => (
          <Animated.View key={agent.id} entering={FadeInDown.delay(200 + index * 100)}>
            <AgentPreview
              agent={agent}
              isSelected={selectedAgentId === agent.id}
              onSelect={() => handleSelectAgent(agent.id)}
              isCurrentAgent={currentAgentId === agent.id}
            />
          </Animated.View>
        ))}
      </ScrollView>

      {/* Bottom Action */}
      <View
        className={`absolute bottom-0 left-0 right-0 p-6 ${
          isDark ? 'bg-gray-900' : 'bg-gray-50'
        }`}
        style={{
          paddingBottom: 40,
          borderTopWidth: 1,
          borderTopColor: isDark ? '#374151' : '#E5E7EB',
        }}
      >
        <Pressable
          onPress={handleSave}
          disabled={isSaving || !selectedAgentId}
          className={`rounded-2xl py-4 items-center ${
            hasChanges
              ? 'bg-green-500'
              : isDark
                ? 'bg-gray-700'
                : 'bg-gray-200'
          }`}
        >
          {isSaving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text
              className={`text-lg font-semibold ${
                hasChanges ? 'text-white' : isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              {hasChanges ? 'Switch Agent' : 'Keep Current Agent'}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
