import React, { useState } from 'react';
import { Modal, View, Pressable, StyleSheet, Platform, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { X } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import useProfileStore from '../state/profileStore';

interface FeedbackWidgetProps {
  visible: boolean;
  onClose: () => void;
}

const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({ visible, onClose }) => {
  const { isDark } = useTheme();
  const profile = useProfileStore(s => s.profile);
  const [loading, setLoading] = useState(true);

  const userName = profile?.name || '';
  const userEmail = profile?.email || '';

  // Use the LoopedIn ideas board URL for Tava workspace
  const feedbackUrl = `https://app.loopedin.io/tava#/ideas-board?name=${encodeURIComponent(userName)}&email=${encodeURIComponent(userEmail)}`;

  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F8F9FA' }]}>
        <View style={[styles.header, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF', borderBottomColor: isDark ? '#374151' : '#E5E7EB' }]}>
          <Text style={[styles.headerTitle, { color: isDark ? '#F9FAFB' : '#1A1A1A' }]}>Send Feedback</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={24} color={isDark ? '#F9FAFB' : '#1A1A1A'} />
          </Pressable>
        </View>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
            <Text style={[styles.loadingText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              Loading feedback form...
            </Text>
          </View>
        )}
        <WebView
          source={{ uri: feedbackUrl }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          startInLoadingState={true}
          allowsInlineMediaPlayback={true}
          originWhitelist={['*']}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={(syntheticEvent) => {
            console.log('WebView error:', syntheticEvent.nativeEvent);
            setLoading(false);
          }}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  loadingContainer: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default FeedbackWidget;
