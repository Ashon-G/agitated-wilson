import React from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Sparkles } from 'lucide-react-native';
import { styles } from './styles';
import { adjustBrightness } from './ReviewStage';
import { AgentPersonality } from '../../data/agentPersonalities';

interface AgentRevealStageProps {
  matchedAgent: AgentPersonality;
  currentSubtitle: string;
  subtitleOpacity: Animated.Value;
  subtitleTranslateY: Animated.Value;
  selectedColor: string;
  onContinue: () => void;
  bottomInset: number;
}

export function AgentRevealStage({
  matchedAgent,
  currentSubtitle,
  subtitleOpacity,
  subtitleTranslateY,
  selectedColor,
  onContinue,
  bottomInset,
}: AgentRevealStageProps) {
  return (
    <View style={[styles.agentRevealContainer, { paddingBottom: bottomInset + 24 }]}>
      {/* Agent name badge */}
      <View style={styles.agentBadge}>
        <Sparkles size={16} color="#F59E0B" />
        <Text style={styles.agentBadgeText}>Your AI Agent</Text>
      </View>

      {/* Agent name */}
      <Text style={styles.agentName}>{matchedAgent.name}</Text>
      <Text style={styles.agentTitle}>{matchedAgent.title}</Text>

      {/* Subtitle (agent introduction speech) */}
      <Animated.Text
        style={[
          styles.subtitleText,
          { opacity: subtitleOpacity, transform: [{ translateY: subtitleTranslateY }], marginTop: 20 },
        ]}
      >
        {currentSubtitle}
      </Animated.Text>

      {/* Continue button */}
      <Pressable style={styles.finishButton} onPress={onContinue}>
        <LinearGradient
          colors={[selectedColor, adjustBrightness(selectedColor, -20)]}
          style={styles.continueButtonGradient}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
          <ArrowRight size={20} color="#ffffff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}
