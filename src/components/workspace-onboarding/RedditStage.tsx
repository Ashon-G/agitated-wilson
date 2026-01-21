import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Check } from 'lucide-react-native';
import { styles } from './styles';

interface RedditStageProps {
  currentSubtitle: string;
  redditConnected: boolean;
  redditUsername: string | null;
  isConnectingReddit: boolean;
  onConnectReddit: () => void;
  onContinue: () => void;
  bottomInset: number;
}

export function RedditStage({
  currentSubtitle,
  redditConnected,
  redditUsername,
  isConnectingReddit,
  onConnectReddit,
  onContinue,
  bottomInset,
}: RedditStageProps) {
  return (
    <View style={[styles.redditContainer, { paddingBottom: bottomInset + 24 }]}>
      <Text style={styles.subtitleText}>{currentSubtitle}</Text>

      {redditConnected ? (
        <View style={styles.connectedContainer}>
          <View style={styles.connectedBadge}>
            <Check size={20} color="#22C55E" />
            <Text style={styles.connectedText}>Connected as u/{redditUsername}</Text>
          </View>
          <Pressable style={styles.finishButton} onPress={onContinue}>
            <LinearGradient colors={['#22C55E', '#16A34A']} style={styles.continueButtonGradient}>
              <Text style={styles.continueButtonText}>Complete Setup</Text>
              <ArrowRight size={20} color="#ffffff" />
            </LinearGradient>
          </Pressable>
        </View>
      ) : (
        <View style={styles.redditButtons}>
          <Pressable
            style={[styles.redditConnectButton, isConnectingReddit && styles.buttonDisabled]}
            onPress={onConnectReddit}
            disabled={isConnectingReddit}
          >
            <LinearGradient colors={['#FF5E00', '#FF4500']} style={styles.continueButtonGradient}>
              {isConnectingReddit ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.continueButtonText}>Connect Reddit</Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      )}
    </View>
  );
}
