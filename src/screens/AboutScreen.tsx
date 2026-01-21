import React from 'react';
import { View, Text, ScrollView, Pressable, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Shield, Info, Headphones, FileText, ExternalLink } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useWorkspaceColor } from '../hooks/useWorkspaceColor';
import { hapticFeedback } from '../utils/hapticFeedback';
import { GLASS } from '../utils/colors';
import { withScreenErrorBoundary } from '../components/ScreenErrorBoundary';

const APP_VERSION = '1.0.0';
const DISCORD_URL = 'https://discord.gg/VtseTUBxY';
const PRIVACY_POLICY_URL = 'https://www.heyvata.com/privacy-policy';
const TERMS_URL = 'https://www.heyvata.com/terms-conditions';

function AboutScreen() {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const { color, colorWithOpacity } = useWorkspaceColor();

  const glass = isDark ? GLASS.dark : GLASS.light;

  const handleBack = () => {
    hapticFeedback.light();
    navigation.goBack();
  };

  const handleOpenLink = (url: string) => {
    hapticFeedback.light();
    Linking.openURL(url);
  };

  const gradientColors = isDark
    ? [
      colorWithOpacity(0.2),
      colorWithOpacity(0.1),
      colorWithOpacity(0.05),
      '#111827',
    ] as const
    : [
      colorWithOpacity(0.15),
      colorWithOpacity(0.08),
      colorWithOpacity(0.02),
      '#F8F9FA',
    ] as const;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F8F9FA' }]}>
      <LinearGradient colors={gradientColors} locations={[0, 0.25, 0.5, 1]} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <ChevronLeft size={28} color={isDark ? '#F9FAFB' : '#1A1A1A'} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: isDark ? '#F9FAFB' : '#1A1A1A' }]}>About</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* About Tava Section */}
        <View style={[styles.card, { backgroundColor: glass.background, borderColor: glass.border }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: colorWithOpacity(0.15) }]}>
              <Info size={22} color={color} />
            </View>
            <Text style={[styles.sectionTitle, { color: glass.text }]}>About Tava</Text>
          </View>
          <Text style={[styles.bodyText, { color: glass.textSecondary }]}>
            Tava is a digital sales agent that generates leads through your connected social accounts—automatically.
          </Text>
          <Text style={[styles.bodyText, { color: glass.textSecondary, marginTop: 12 }]}>
            It identifies opportunities, starts conversations, and moves prospects forward while you focus on closing.
          </Text>
          <Text style={[styles.bodyText, { color: glass.textSecondary, marginTop: 12 }]}>
            Built for modern teams who want leverage, not noise.
          </Text>
        </View>

        {/* Trust & Privacy Section */}
        <View style={[styles.card, { backgroundColor: glass.background, borderColor: glass.border }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: colorWithOpacity(0.15) }]}>
              <Shield size={22} color={color} />
            </View>
            <Text style={[styles.sectionTitle, { color: glass.text }]}>Trust & Privacy</Text>
          </View>
          <Text style={[styles.bodyText, { color: glass.textSecondary }]}>
            Secure connections. Privacy-first by design. No spam. No shortcuts.
          </Text>
        </View>

        {/* App Info Section */}
        <View style={[styles.card, { backgroundColor: glass.background, borderColor: glass.border }]}>
          <Text style={[styles.cardTitle, { color: glass.text }]}>App Info</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: glass.textMuted }]}>Version</Text>
            <Text style={[styles.infoValue, { color: glass.text }]}>{APP_VERSION}</Text>
          </View>
        </View>

        {/* Support Section */}
        <View style={[styles.card, { backgroundColor: glass.background, borderColor: glass.border }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: colorWithOpacity(0.15) }]}>
              <Headphones size={22} color={color} />
            </View>
            <Text style={[styles.sectionTitle, { color: glass.text }]}>Support</Text>
          </View>
          <Pressable
            onPress={() => handleOpenLink(DISCORD_URL)}
            style={[styles.linkButton, { backgroundColor: glass.backgroundLight }]}
          >
            <Text style={[styles.linkText, { color: glass.text }]}>Community & support</Text>
            <ExternalLink size={18} color={color} />
          </Pressable>
        </View>

        {/* Legal Section */}
        <View style={[styles.card, { backgroundColor: glass.background, borderColor: glass.border }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: colorWithOpacity(0.15) }]}>
              <FileText size={22} color={color} />
            </View>
            <Text style={[styles.sectionTitle, { color: glass.text }]}>Legal</Text>
          </View>
          <Pressable
            onPress={() => handleOpenLink(PRIVACY_POLICY_URL)}
            style={[styles.linkButton, { backgroundColor: glass.backgroundLight }]}
          >
            <Text style={[styles.linkText, { color: glass.text }]}>Privacy Policy</Text>
            <ExternalLink size={18} color={color} />
          </Pressable>
          <Pressable
            onPress={() => handleOpenLink(TERMS_URL)}
            style={[styles.linkButton, { backgroundColor: glass.backgroundLight, marginTop: 10 }]}
          >
            <Text style={[styles.linkText, { color: glass.text }]}>Terms of Service</Text>
            <ExternalLink size={18} color={color} />
          </Pressable>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
  },
  card: {
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 15,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '500',
  },
});

export default withScreenErrorBoundary('AboutScreen', {
  showRetryButton: true,
  maxRetries: 3,
  fallbackMessage: 'Something went wrong with the About screen. Please try again.',
})(AboutScreen);
