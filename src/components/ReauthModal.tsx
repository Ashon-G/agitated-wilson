import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface ReauthModalProps {
  visible: boolean;
  email: string;
  onConfirm: (password: string) => Promise<void>;
  onCancel: () => void;
  title?: string;
  message?: string;
  destructive?: boolean;
}

export default function ReauthModal({
  visible,
  email,
  onConfirm,
  onCancel,
  title = 'Verify Your Identity',
  message = 'Please enter your password to continue',
  destructive = true,
}: ReauthModalProps) {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { isDark } = useTheme();

  const handleConfirm = async () => {
    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await onConfirm(password);
      // Clear password on success
      setPassword('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setPassword('');
    setError(null);
    onCancel();
  };

  const backgroundStyle = isDark ? '#1F2937' : '#FFFFFF';
  const textStyle = isDark ? '#F3F4F6' : '#111827';
  const textSecondaryStyle = isDark ? '#9CA3AF' : '#6B7280';
  const inputBgStyle = isDark ? '#374151' : '#F9FAFB';
  const inputBorderStyle = isDark ? '#4B5563' : '#E5E7EB';
  const buttonText = destructive ? '#EF4444' : '#22C55E';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
          onPress={handleCancel}
        >
          <Pressable
            style={{
              backgroundColor: backgroundStyle,
              borderRadius: 16,
              padding: 24,
              width: '100%',
              maxWidth: 400,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: destructive ? '#FEE2E2' : '#DCFCE7',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Ionicons
                  name={destructive ? 'warning' : 'shield-checkmark'}
                  size={28}
                  color={destructive ? '#EF4444' : '#22C55E'}
                />
              </View>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '600',
                  color: textStyle,
                  marginBottom: 8,
                }}
              >
                {title}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: textSecondaryStyle,
                  textAlign: 'center',
                }}
              >
                {message}
              </Text>
            </View>

            {/* Email Field (Read-only) */}
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: textStyle,
                  marginBottom: 8,
                }}
              >
                Email
              </Text>
              <View
                style={{
                  backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: inputBorderStyle,
                }}
              >
                <Text style={{ color: textSecondaryStyle, fontSize: 16 }}>
                  {email}
                </Text>
              </View>
            </View>

            {/* Password Field */}
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: textStyle,
                  marginBottom: 8,
                }}
              >
                Password
              </Text>
              <View
                style={{
                  backgroundColor: inputBgStyle,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: error ? '#EF4444' : inputBorderStyle,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 14,
                }}
              >
                <TextInput
                  style={{
                    flex: 1,
                    color: textStyle,
                    fontSize: 16,
                    paddingVertical: 14,
                  }}
                  placeholder="Enter your password"
                  placeholderTextColor={textSecondaryStyle}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoFocus={true}
                  editable={!isLoading}
                  onSubmitEditing={handleConfirm}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={textSecondaryStyle}
                  />
                </Pressable>
              </View>
              {error && (
                <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 6 }}>
                  {error}
                </Text>
              )}
            </View>

            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={handleCancel}
                disabled={isLoading}
                style={{
                  flex: 1,
                  backgroundColor: isDark ? '#374151' : '#F3F4F6',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: textStyle,
                  }}
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={handleConfirm}
                disabled={isLoading || !password.trim()}
                style={{
                  flex: 1,
                  backgroundColor: destructive ? '#EF4444' : '#22C55E',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  opacity: isLoading || !password.trim() ? 0.5 : 1,
                }}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: '#FFFFFF',
                    }}
                  >
                    Confirm
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
