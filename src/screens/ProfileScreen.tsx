import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Switch, ActivityIndicator, Linking, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { UserCircle2, Plug, Sun, Moon, Smartphone, Download, HelpCircle, Info, LogOut, Trash2, ChevronRight, RefreshCw, X, Lock, Palette, Check, MessageSquare, Camera, Bell } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import useProfileStore from '../state/profileStore';
import useAuthStore from '../state/authStore';
import useSubscriptionStore from '../state/subscriptionStore';
import AuthenticationService from '../services/AuthenticationService';
import UserDataDeletionService from '../services/UserDataDeletionService';
import NotificationService from '../services/NotificationService';
import ConfirmationSheet, { ConfirmationSheetRef } from '../components/ConfirmationSheet';
import ReauthModal from '../components/ReauthModal';
import UpgradeButton from '../components/UpgradeButton';
import FeedbackWidget from '../components/FeedbackWidget';
import { useNavigation } from '@react-navigation/native';
import { ThemeMode } from '../state/themeStore';
import { toastManager } from '../utils/toastManager';
import { hapticFeedback } from '../utils/hapticFeedback';
import { withScreenErrorBoundary } from '../components/ScreenErrorBoundary';
import { DiscordButton, InstagramButton, LinkedInButton } from '../components/SocialButtons';
import { restorePurchases, isRevenueCatEnabled } from '../lib/revenuecatClient';
import { useWorkspaceColor } from '../hooks/useWorkspaceColor';
import useWorkspaceStore from '../state/workspaceStore';
import { useTheme } from '../contexts/ThemeContext';
import { GLASS } from '../utils/colors';

const WORKSPACE_COLORS = [
  '#22C55E', // Green
  '#F59E0B', // Yellow/Orange
  '#EC4899', // Pink
  '#10B981', // Teal/Emerald
  '#3B82F6', // Blue
  '#7DD3FC', // Light Blue
  '#A855F7', // Purple
  '#EF4444', // Red
];

function ProfileScreen() {
  const navigation = useNavigation();
  const confirmationSheetRef = React.useRef<ConfirmationSheetRef>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const [showFeedbackWidget, setShowFeedbackWidget] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const profile = useProfileStore(s => s.profile);
  const updateProfile = useProfileStore(s => s.updateProfile);
  const updatePreferences = useProfileStore(s => s.updatePreferences);

  const user = useAuthStore(s => s.user);
  const signOut = useAuthStore(s => s.signOut);
  const deleteAccount = useAuthStore(s => s.deleteAccount);

  const isPremium = useSubscriptionStore(s => s.isPremium);
  const customerInfo = useSubscriptionStore(s => s.customerInfo);
  const refreshSubscriptionStatus = useSubscriptionStore(s => s.refreshSubscriptionStatus);
  const canExportData = useSubscriptionStore(s => s.limits.exportData);

  const { themeMode, setThemeMode, isDark } = useTheme();
  const { color, colorWithOpacity } = useWorkspaceColor();

  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace);
  const updateWorkspace = useWorkspaceStore(s => s.updateWorkspace);

  const glass = isDark ? GLASS.dark : GLASS.light;

  const handleClose = () => {
    hapticFeedback.light();
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // @ts-ignore
      navigation.navigate('Main');
    }
  };

  useEffect(() => {
    if (profile) {
      setEditName(profile.name || '');
      setEditEmail(profile.email || '');
    }
  }, [profile]);

  // Check notification permission status on mount
  useEffect(() => {
    const checkNotificationStatus = async () => {
      const enabled = await NotificationService.areNotificationsEnabled();
      setNotificationsEnabled(enabled);
    };
    checkNotificationStatus();
  }, []);

  const handleNotificationToggle = async (value: boolean) => {
    hapticFeedback.selection();

    if (value) {
      // User wants to enable notifications - request permissions
      const permissionGranted = await NotificationService.requestPermissions();
      if (permissionGranted) {
        // Initialize notifications if not already done
        await NotificationService.initialize();
        setNotificationsEnabled(true);
        updatePreferences({ notifications: true });
        toastManager.success('Notifications enabled');
      } else {
        // Permission denied - show instructions to enable in settings
        toastManager.info('Enable notifications in Settings');
        Linking.openSettings();
      }
    } else {
      // User wants to disable - update preference (they need to disable in system settings)
      setNotificationsEnabled(false);
      updatePreferences({ notifications: false });
      toastManager.success('Notifications disabled');
    }
  };

  const hasInitializedTheme = React.useRef(false);
  useEffect(() => {
    if (profile?.preferences.theme && !hasInitializedTheme.current) {
      const profileTheme = profile.preferences.theme;
      if (profileTheme !== themeMode) {
        setThemeMode(profileTheme);
      }
      hasInitializedTheme.current = true;
    }
  }, [profile?.preferences.theme, themeMode, setThemeMode]);

  useEffect(() => {
    if (!profile || !editName || editName === profile.name) return;
    const timer = setTimeout(() => {
      if (editName.trim() && editName !== profile.name) {
        updateProfile({ name: editName.trim() });
        toastManager.success('Name updated');
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [editName, profile?.name, updateProfile, profile]);

  useEffect(() => {
    if (!profile || !editEmail || editEmail === profile.email) return;
    const timer = setTimeout(() => {
      if (editEmail.trim() && editEmail !== profile.email) {
        updateProfile({ email: editEmail.trim() });
        toastManager.success('Email updated');
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [editEmail, profile?.email, updateProfile, profile]);

  const themes = [
    { key: 'light', name: 'Light', icon: Sun },
    { key: 'dark', name: 'Dark', icon: Moon },
    { key: 'system', name: 'System', icon: Smartphone },
  ];

  const handleThemeChange = async (selectedTheme: ThemeMode) => {
    hapticFeedback.selection();
    setThemeMode(selectedTheme);
    updatePreferences({ theme: selectedTheme }).catch(console.error);
    toastManager.success(`Theme changed to ${selectedTheme}`);
  };

  const handleWorkspaceColorChange = async (newColor: string) => {
    if (!currentWorkspace) return;
    hapticFeedback.selection();
    console.log('🎨 Changing workspace color from', currentWorkspace.color, 'to', newColor);
    try {
      await updateWorkspace(currentWorkspace.id, { color: newColor });
      console.log('✅ Workspace color updated successfully to:', newColor);
      toastManager.success('Workspace color updated');
    } catch (error) {
      console.error('Failed to update workspace color:', error);
      toastManager.error('Failed to update color');
    }
  };

  const handleSignOut = () => {
    hapticFeedback.medium();
    confirmationSheetRef.current?.show({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      confirmText: 'Sign Out',
      destructive: true,
      onConfirm: async () => {
        try {
          await signOut();
        } catch (error) {
          toastManager.error('Failed to sign out');
        }
      },
    });
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      const summary = await UserDataDeletionService.getDataDeletionSummary(user.uid);
      let message = 'This will permanently delete your account and all data. This action cannot be undone.';
      if (summary.hasOutstandingBalance) {
        message = `You have $${summary.outstandingAmount.toFixed(2)} in unpaid invoices. ${message}`;
      }
      confirmationSheetRef.current?.show({
        title: 'Delete Account?',
        message,
        confirmText: 'Delete Account',
        destructive: true,
        onConfirm: async () => {
          try {
            toastManager.info('Deleting account...');
            await deleteAccount();
            toastManager.success('Account deleted successfully');
          } catch (error: any) {
            if (error?.code === 'auth/requires-recent-login') {
              setShowReauthModal(true);
            } else {
              toastManager.error('Failed to delete account');
            }
          }
        },
      });
    } catch {
      toastManager.error('Failed to load account information');
    }
  };

  const handleReauthAndDelete = async (password: string) => {
    if (!user?.email) return;
    await AuthenticationService.reauthenticateWithCredential(user.email, password);
    setShowReauthModal(false);
    toastManager.info('Deleting account...');
    await deleteAccount();
    toastManager.success('Account deleted successfully');
  };

  const handleRestorePurchases = async () => {
    if (!isRevenueCatEnabled()) {
      toastManager.info('Subscriptions are not available yet');
      return;
    }
    setRestoringPurchases(true);
    hapticFeedback.light();
    try {
      const result = await restorePurchases();
      if (!result.ok) {
        toastManager.error('Unable to restore purchases');
        return;
      }
      await refreshSubscriptionStatus();
      toastManager.success('Purchases restored!');
    } catch {
      toastManager.error('Failed to restore purchases');
    } finally {
      setRestoringPurchases(false);
    }
  };

  const handleManageSubscription = () => {
    hapticFeedback.light();
    if (isPremium) {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else {
      toastManager.info('No active subscription found');
    }
  };

  const handleChangePhoto = async () => {
    hapticFeedback.light();
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toastManager.error('Permission to access photos is required');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadingPhoto(true);
        const imageUri = result.assets[0].uri;

        // Update profile with new photo
        await updateProfile({ avatar: imageUri });
        toastManager.success('Profile photo updated');
      }
    } catch (error) {
      console.error('Error changing photo:', error);
      toastManager.error('Failed to update photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const getSubscriptionExpiryDate = () => {
    if (!customerInfo || !isPremium) return null;
    const premiumEntitlement = customerInfo.entitlements.active?.['premium'];
    return premiumEntitlement?.expirationDate ?? null;
  };

  const formatSubscriptionDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
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

  if (!profile) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F8F9FA' }]}>
        <LinearGradient colors={gradientColors} locations={[0, 0.25, 0.5, 1]} style={StyleSheet.absoluteFillObject} />
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: isDark ? '#F9FAFB' : '#1A1A1A' }]}>Profile</Text>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={isDark ? '#F9FAFB' : '#1A1A1A'} />
            </Pressable>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={color} />
            <Text style={[styles.loadingText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Loading profile...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F8F9FA' }]}>
      <LinearGradient colors={gradientColors} locations={[0, 0.25, 0.5, 1]} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: isDark ? '#F9FAFB' : '#1A1A1A' }]}>Profile</Text>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <X size={24} color={isDark ? '#F9FAFB' : '#1A1A1A'} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={[styles.card, { backgroundColor: glass.background, borderColor: glass.border }]}>
          <View style={styles.avatarSection}>
            <View style={[styles.avatar, { backgroundColor: colorWithOpacity(0.15) }]}>
              {profile.avatar ? (
                <Image source={{ uri: profile.avatar }} style={styles.avatarImage} />
              ) : (
                <Text style={[styles.avatarText, { color }]}>{profile.name.charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <Pressable
              onPress={handleChangePhoto}
              disabled={uploadingPhoto}
              style={[styles.changePhotoButton, { backgroundColor: glass.backgroundLight }]}
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={isDark ? '#60A5FA' : '#3B82F6'} />
              ) : (
                <>
                  <Camera size={14} color={isDark ? '#60A5FA' : '#3B82F6'} style={{ marginRight: 6 }} />
                  <Text style={[styles.changePhotoText, { color: isDark ? '#60A5FA' : '#3B82F6' }]}>Change Photo</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: glass.textMuted }]}>Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: glass.backgroundLight, color: glass.text, borderColor: glass.border }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter your name"
              placeholderTextColor={glass.textMuted}
            />
            <Text style={[styles.inputHint, { color: glass.textMuted }]}>Changes save automatically</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: glass.textMuted }]}>Email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: glass.backgroundLight, color: glass.text, borderColor: glass.border }]}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="Enter your email"
              placeholderTextColor={glass.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={[styles.inputHint, { color: glass.textMuted }]}>Changes save automatically</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: glass.textMuted }]}>Timezone</Text>
            <View style={[styles.readOnlyInput, { backgroundColor: glass.backgroundLight }]}>
              <Text style={[styles.readOnlyText, { color: glass.text }]}>{Intl.DateTimeFormat().resolvedOptions().timeZone}</Text>
            </View>
          </View>
        </View>

        {/* Subscription */}
        {isRevenueCatEnabled() && (
          <View style={[styles.card, { backgroundColor: glass.background, borderColor: glass.border }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: glass.text }]}>Subscription</Text>
              {isPremium && (
                <View style={[styles.premiumBadge, { backgroundColor: colorWithOpacity(0.15) }]}>
                  <Text style={[styles.premiumBadgeText, { color }]}>Premium</Text>
                </View>
              )}
            </View>

            {isPremium ? (
              <>
                <View style={styles.subscriptionInfo}>
                  <Text style={styles.subscriptionLabel}>Status</Text>
                  <Text style={styles.subscriptionValue}>Active</Text>
                </View>
                <View style={styles.subscriptionInfo}>
                  <Text style={styles.subscriptionLabel}>Renews On</Text>
                  <Text style={styles.subscriptionValue}>{formatSubscriptionDate(getSubscriptionExpiryDate())}</Text>
                </View>
                <View style={styles.subscriptionActions}>
                  <Pressable onPress={handleManageSubscription} style={[styles.primaryButton, { backgroundColor: color }]}>
                    <Text style={styles.primaryButtonText}>Manage Subscription</Text>
                  </Pressable>
                  <Pressable onPress={handleRestorePurchases} disabled={restoringPurchases} style={styles.iconButton}>
                    {restoringPurchases ? (
                      <ActivityIndicator size="small" color="#6B7280" />
                    ) : (
                      <RefreshCw size={20} color="#6B7280" />
                    )}
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <UpgradeButton variant="default" label="Upgrade to Premium" />
                <View style={{ height: 12 }} />
                <Pressable onPress={handleRestorePurchases} disabled={restoringPurchases} style={styles.menuItem}>
                  <RefreshCw size={20} color="#6B7280" />
                  <Text style={styles.menuItemText}>{restoringPurchases ? 'Restoring...' : 'Restore Purchases'}</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* Navigation Items */}
        <Pressable
          onPress={() => {
            hapticFeedback.light();
            navigation.goBack();
            setTimeout(() => {
              // @ts-ignore
              navigation.navigate('AgentSelector');
            }, 100);
          }}
          style={[styles.card, { backgroundColor: glass.background, borderColor: glass.border }]}
        >
          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: '#F3E8FF' }]}>
              <UserCircle2 size={22} color="#A855F7" />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: glass.text }]}>Change Agent</Text>
              <Text style={[styles.menuSubtitle, { color: glass.textMuted }]}>Switch to a different AI sales agent</Text>
            </View>
            <ChevronRight size={20} color={glass.textMuted} />
          </View>
        </Pressable>

        <Pressable
          onPress={() => {
            hapticFeedback.light();
            navigation.goBack();
            setTimeout(() => {
              // @ts-ignore - Navigate to Brain AI tab with integrations tab selected
              navigation.navigate('Main', { screen: 'Brain AI', params: { initialTab: 'integrations' } });
            }, 100);
          }}
          style={[styles.card, { backgroundColor: glass.background, borderColor: glass.border }]}
        >
          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: '#EFF6FF' }]}>
              <Plug size={22} color="#3B82F6" />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: glass.text }]}>Integrations</Text>
              <Text style={[styles.menuSubtitle, { color: glass.textMuted }]}>Connect Reddit, manage subreddits</Text>
            </View>
            <ChevronRight size={20} color={glass.textMuted} />
          </View>
        </Pressable>

        {/* Theme */}
        <View style={[styles.card, { backgroundColor: glass.background, borderColor: glass.border }]}>
          <Text style={[styles.cardTitle, { color: glass.text }]}>Theme</Text>
          <View style={styles.themeOptions}>
            {themes.map(theme => {
              const Icon = theme.icon;
              const isActive = themeMode === theme.key;
              return (
                <Pressable
                  key={theme.key}
                  onPress={() => handleThemeChange(theme.key as ThemeMode)}
                  style={[styles.themeOption, { backgroundColor: glass.backgroundLight }, isActive && { backgroundColor: colorWithOpacity(0.2) }]}
                >
                  <View style={[styles.themeIconContainer, { backgroundColor: glass.backgroundMedium }, isActive && { backgroundColor: color }]}>
                    <Icon size={18} color={isActive ? '#fff' : glass.textMuted} />
                  </View>
                  <Text style={[styles.themeText, { color: glass.textSecondary }, isActive && { color, fontWeight: '600' }]}>{theme.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Workspace Color */}
        {currentWorkspace && (
          <View style={[styles.card, { backgroundColor: glass.background, borderColor: glass.border }]}>
            <View style={styles.workspaceColorHeader}>
              <View style={[styles.menuIcon, { backgroundColor: colorWithOpacity(0.15) }]}>
                <Palette size={20} color={color} />
              </View>
              <View style={styles.workspaceColorTitleContainer}>
                <Text style={[styles.cardTitle, { color: glass.text, marginBottom: 0 }]}>Workspace Color</Text>
                <Text style={[styles.workspaceColorSubtitle, { color: glass.textMuted }]}>
                  {currentWorkspace.name}
                </Text>
              </View>
            </View>
            <View style={styles.colorGrid}>
              {WORKSPACE_COLORS.map((c) => {
                const isSelected = currentWorkspace.color === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => handleWorkspaceColorChange(c)}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: c },
                      isSelected && styles.colorSwatchSelected,
                    ]}
                  >
                    {isSelected && <Check size={18} color="#FFFFFF" strokeWidth={3} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Preferences */}
        <View style={[styles.card, { backgroundColor: glass.background, borderColor: glass.border }]}>
          <Text style={[styles.cardTitle, { color: glass.text }]}>Preferences</Text>
          <View style={styles.preferenceItem}>
            <View style={[styles.menuIcon, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2' }]}>
              <Bell size={20} color="#EF4444" />
            </View>
            <View style={styles.preferenceInfo}>
              <Text style={[styles.preferenceTitle, { color: glass.text }]}>Push Notifications</Text>
              <Text style={[styles.preferenceSubtitle, { color: glass.textMuted }]}>
                {notificationsEnabled ? 'Get notified about new leads & responses' : 'Enable to receive alerts'}
              </Text>
            </View>
            <Switch
              value={notificationsEnabled && profile.preferences.notifications}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: '#E5E7EB', true: colorWithOpacity(0.4) }}
              thumbColor={notificationsEnabled && profile.preferences.notifications ? color : '#F3F4F6'}
            />
          </View>
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Text style={[styles.preferenceTitle, { color: glass.text }]}>Auto Save</Text>
              <Text style={[styles.preferenceSubtitle, { color: glass.textMuted }]}>Automatically save your work</Text>
            </View>
            <Switch
              value={profile.preferences.autoSave}
              onValueChange={value => {
                hapticFeedback.selection();
                updatePreferences({ autoSave: value });
              }}
              trackColor={{ false: '#E5E7EB', true: colorWithOpacity(0.4) }}
              thumbColor={profile.preferences.autoSave ? color : '#F3F4F6'}
            />
          </View>
        </View>

        {/* Account */}
        <View style={[styles.card, { backgroundColor: glass.background, borderColor: glass.border }]}>
          <Text style={[styles.cardTitle, { color: glass.text }]}>Account</Text>

          <View style={styles.socialButtons}>
            <DiscordButton url="https://discord.gg/VtseTUBxY" />
            <InstagramButton url="https://www.instagram.com/gonzaleslorona?igsh=NTc4MTIwNjQ2YQ%3D%3D&utm_source=qr" />
            <LinkedInButton url="https://www.linkedin.com/company/hey-vata/" />
          </View>

          <View style={[styles.divider, { backgroundColor: glass.border }]} />

          <Pressable
            onPress={() => {
              if (canExportData) {
                toastManager.info('Export data feature coming soon');
              } else {
                hapticFeedback.warning();
                toastManager.info('Upgrade to Pro to export your data');
              }
            }}
            style={[styles.accountItem, !canExportData && { opacity: 0.6 }]}
          >
            <Download size={20} color={glass.textMuted} />
            <Text style={[styles.accountItemText, { color: glass.text }]}>Export Data</Text>
            {!canExportData && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' }}>
                <View style={{ backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginRight: 8 }}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? '#F59E0B' : '#D97706' }}>Pro</Text>
                </View>
                <Lock size={16} color={glass.textMuted} />
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              hapticFeedback.light();
              navigation.goBack();
              setTimeout(() => {
                // @ts-ignore
                navigation.navigate('HelpSupport');
              }, 100);
            }}
            style={styles.accountItem}
          >
            <HelpCircle size={20} color={glass.textMuted} />
            <Text style={[styles.accountItemText, { color: glass.text }]}>Help & Support</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              hapticFeedback.light();
              setShowFeedbackWidget(true);
            }}
            style={styles.accountItem}
          >
            <MessageSquare size={20} color={glass.textMuted} />
            <Text style={[styles.accountItemText, { color: glass.text }]}>Send Feedback</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              hapticFeedback.light();
              navigation.goBack();
              setTimeout(() => {
                // @ts-ignore
                navigation.navigate('About');
              }, 100);
            }}
            style={styles.accountItem}
          >
            <Info size={20} color={glass.textMuted} />
            <Text style={[styles.accountItemText, { color: glass.text }]}>About</Text>
          </Pressable>

          <View style={[styles.divider, { backgroundColor: glass.border }]} />

          <Pressable onPress={handleSignOut} style={styles.accountItem}>
            <LogOut size={20} color="#EF4444" />
            <Text style={[styles.accountItemText, { color: '#EF4444' }]}>Sign Out</Text>
          </Pressable>
        </View>

        {/* Danger Zone */}
        <View style={[styles.dangerCard, { backgroundColor: isDark ? 'rgba(127, 29, 29, 0.3)' : '#FEF2F2', borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA' }]}>
          <View style={styles.dangerHeader}>
            <Trash2 size={18} color="#EF4444" />
            <Text style={styles.dangerTitle}>Danger Zone</Text>
          </View>
          <Text style={[styles.dangerSubtitle, { color: glass.textMuted }]}>Irreversible and destructive actions</Text>
          <Pressable onPress={handleDeleteAccount} style={[styles.deleteButton, { backgroundColor: glass.background, borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA' }]}>
            <Trash2 size={20} color="#EF4444" />
            <View style={styles.deleteButtonContent}>
              <Text style={styles.deleteButtonTitle}>Delete Account</Text>
              <Text style={[styles.deleteButtonSubtitle, { color: glass.textMuted }]}>Permanently delete your account and all data</Text>
            </View>
            <ChevronRight size={20} color="#EF4444" />
          </Pressable>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <ConfirmationSheet ref={confirmationSheetRef} />
      <ReauthModal
        visible={showReauthModal}
        email={user?.email || ''}
        onConfirm={handleReauthAndDelete}
        onCancel={() => setShowReauthModal(false)}
        title="Confirm Account Deletion"
        message="For security, please enter your password to delete your account"
        destructive={true}
      />
      <FeedbackWidget
        visible={showFeedbackWidget}
        onClose={() => setShowFeedbackWidget(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  safeArea: {
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
  },
  card: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
  },
  changePhotoButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
  },
  readOnlyInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  readOnlyText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  premiumBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  premiumBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  subscriptionInfo: {
    marginBottom: 12,
  },
  subscriptionLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  subscriptionValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  subscriptionActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  menuItemText: {
    fontSize: 16,
    color: '#1A1A1A',
    marginLeft: 12,
  },
  themeOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
  },
  themeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    marginBottom: 8,
  },
  themeText: {
    fontSize: 13,
    color: '#6B7280',
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  preferenceInfo: {
    flex: 1,
  },
  preferenceTitle: {
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 2,
  },
  preferenceSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  socialButtons: {
    gap: 8,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  accountItemText: {
    fontSize: 16,
    color: '#1A1A1A',
    marginLeft: 14,
  },
  dangerCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dangerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 8,
  },
  dangerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteButtonContent: {
    flex: 1,
    marginLeft: 12,
  },
  deleteButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
  deleteButtonSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  workspaceColorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  workspaceColorTitleContainer: {
    flex: 1,
    marginLeft: 14,
  },
  workspaceColorSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default withScreenErrorBoundary('ProfileScreen', {
  showRetryButton: true,
  maxRetries: 3,
  fallbackMessage: 'Something went wrong with the Profile screen. Please try again.',
})(ProfileScreen);
