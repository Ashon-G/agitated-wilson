import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Globe, Sparkles } from 'lucide-react-native';
import { styles } from './styles';

interface URLInputStageProps {
  stage: 'speaking' | 'listening' | 'error';
  currentSubtitle: string;
  subtitleOpacity: Animated.Value;
  subtitleTranslateY: Animated.Value;
  inputOpacity: Animated.Value;
  inputTranslateY: Animated.Value;
  inputValue: string;
  setInputValue: (value: string) => void;
  onSubmit: () => void;
  errorMessage?: string;
  bottomInset: number;
}

export function URLInputStage({
  stage,
  currentSubtitle,
  subtitleOpacity,
  subtitleTranslateY,
  inputOpacity,
  inputTranslateY,
  inputValue,
  setInputValue,
  onSubmit,
  errorMessage,
  bottomInset,
}: URLInputStageProps) {
  const showInput = stage === 'listening' || stage === 'error';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.interactionContainer, { paddingBottom: bottomInset + 24 }]}
    >
      <Animated.Text
        style={[
          styles.subtitleText,
          { opacity: subtitleOpacity, transform: [{ translateY: subtitleTranslateY }] },
        ]}
      >
        {currentSubtitle}
      </Animated.Text>

      {stage === 'error' && errorMessage && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {showInput && (
        <Animated.View
          style={[
            styles.inputContainer,
            { opacity: inputOpacity, transform: [{ translateY: inputTranslateY }] },
          ]}
        >
          <View style={styles.urlInputWrapper}>
            <Globe size={18} color="#9CA3AF" />
            <TextInput
              style={styles.urlTextInput}
              placeholder="yourwebsite.com"
              placeholderTextColor="#9CA3AF"
              value={inputValue}
              onChangeText={setInputValue}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />
          </View>
          <Pressable
            style={[styles.extractButton, !inputValue.trim() && styles.sendButtonDisabled]}
            onPress={onSubmit}
            disabled={!inputValue.trim()}
          >
            <Sparkles size={24} color={inputValue.trim() ? '#ffffff' : '#6B7280'} />
          </Pressable>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}
