import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText, Search, Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute } from '@react-navigation/native';
import Animated, { FadeIn, FadeOut, Layout, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import useWorkspaceStore from '../state/workspaceStore';
import useBrainStore from '../state/brainStore';
import useProfileStore from '../state/profileStore';
import useHuntingStore from '../state/huntingStore';
import useAuthStore from '../state/authStore';
import useQuestStore from '../state/questStore';
import useAgentSettingsStore from '../state/agentSettingsStore';
import GlobalHeader from '../components/GlobalHeader';
import BoxOAuthService from '../integrations/BoxOAuthService';
import BoxService from '../services/BoxService';
import RedditConnectionService from '../services/RedditConnectionService';
import HubSpotAuthService from '../services/integrations/HubSpotAuthService';
import HubSpotKnowledgeService from '../services/integrations/HubSpotKnowledgeService';
import GeminiService from '../services/GeminiService';
import BoxFilePicker from '../components/BoxFilePicker';
import BoxUnlinkModal from '../components/BoxUnlinkModal';
import ConfirmationSheet, { ConfirmationSheetRef } from '../components/ConfirmationSheet';
import RedditOptionsSheet, { RedditOptionsSheetRef } from '../components/RedditOptionsSheet';
import KnowledgeEditModal from '../components/KnowledgeEditModal';
import { RedditSubredditSelector } from '../components/RedditSubredditSelector';
import { KnowledgeItem as KnowledgeItemType } from '../types/app';
import { KnowledgeBaseDrawer } from '../components/KnowledgeBaseDrawer';
import { FileUpload, URLPreview } from '../types/knowledge';
import { toastManager } from '../utils/toastManager';
import { hapticFeedback } from '../utils/hapticFeedback';
import { useTheme } from '../contexts/ThemeContext';
import { useWorkspaceColor } from '../hooks/useWorkspaceColor';
import { withScreenErrorBoundary } from '../components/ScreenErrorBoundary';
import { MinimalKnowledgeItem, FilterChip, IntegrationCard } from '../components/brain';

type FilterType = 'all' | 'file' | 'webpage' | 'snippet';
type TabType = 'knowledge' | 'integrations';

function BrainAIScreen({ navigation }: any) {
  const route = useRoute<any>();
  const confirmationSheetRef = useRef<ConfirmationSheetRef>(null);
  const redditOptionsSheetRef = useRef<RedditOptionsSheetRef>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [activeTab, setActiveTab] = useState<TabType>(
    route.params?.initialTab === 'integrations' ? 'integrations' : 'knowledge',
  );
  const [isConnectingReddit, setIsConnectingReddit] = useState(false);
  const [isDisconnectingReddit, setIsDisconnectingReddit] = useState(false);
  const [isConnectingBox, setIsConnectingBox] = useState(false);
  const [isConnectingHubSpot, setIsConnectingHubSpot] = useState(false);
  const [isSyncingBox, setIsSyncingBox] = useState(false);
  const [isBoxFilePickerVisible, setIsBoxFilePickerVisible] = useState(false);
  const [isBoxUnlinkModalVisible, setIsBoxUnlinkModalVisible] = useState(false);
  const [isSubredditSelectorVisible, setIsSubredditSelectorVisible] = useState(false);
  const [isKnowledgeDrawerVisible, setIsKnowledgeDrawerVisible] = useState(false);
  const [isProcessingKnowledge, setIsProcessingKnowledge] = useState(false);
  const [isKnowledgeEditModalVisible, setIsKnowledgeEditModalVisible] = useState(false);
  const [selectedKnowledgeItem, setSelectedKnowledgeItem] = useState<KnowledgeItemType | null>(null);
  const [isRedditPickerVisible, setIsRedditPickerVisible] = useState(false);
  const { color: workspaceColorValue, colorWithOpacity } = useWorkspaceColor();

  // Hide tab bar when modals are open
  useEffect(() => {
    navigation.setOptions({
      tabBarStyle:
        isBoxFilePickerVisible ||
        isKnowledgeDrawerVisible ||
        isRedditPickerVisible ||
        isSubredditSelectorVisible ||
        isBoxUnlinkModalVisible ||
        isKnowledgeEditModalVisible ||
        isConnectingHubSpot
          ? { display: 'none' }
          : undefined,
    });
  }, [
    isBoxFilePickerVisible,
    isKnowledgeDrawerVisible,
    isRedditPickerVisible,
    isSubredditSelectorVisible,
    isBoxUnlinkModalVisible,
    isKnowledgeEditModalVisible,
    isConnectingHubSpot,
    navigation,
  ]);

  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace);
  const updateWorkspaceStats = useWorkspaceStore(s => s.updateWorkspaceStats);

  const integrations = useBrainStore(s => s.integrations);
  const knowledgeItems = useBrainStore(s => s.knowledgeItems);
  const loadKnowledgeItems = useBrainStore(s => s.loadKnowledgeItems);
  const searchKnowledge = useBrainStore(s => s.searchKnowledge);
  const connectRedditIntegration = useBrainStore(s => s.connectRedditIntegration);
  const disconnectRedditIntegration = useBrainStore(s => s.disconnectRedditIntegration);
  const connectBoxIntegration = useBrainStore(s => s.connectBoxIntegration);
  const disconnectBoxIntegration = useBrainStore(s => s.disconnectBoxIntegration);
  const setSelectedBoxItems = useBrainStore(s => s.setSelectedBoxItems);
  const syncSelectedBoxItems = useBrainStore(s => s.syncSelectedBoxItems);
  const unlinkBoxDocuments = useBrainStore(s => s.unlinkBoxDocuments);
  const addFileToKnowledge = useBrainStore(s => s.addFileToKnowledge);
  const addURLToKnowledge = useBrainStore(s => s.addURLToKnowledge);
  const addTextToKnowledge = useBrainStore(s => s.addTextToKnowledge);
  const updateIntegration = useBrainStore(s => s.updateIntegration);
  const updateIntegrationStatus = useBrainStore(s => s.updateIntegrationStatus);
  const updateKnowledgeItem = useBrainStore(s => s.updateKnowledgeItem);
  const deleteKnowledgeItem = useBrainStore(s => s.deleteKnowledgeItem);

  const connectRedditAccount = useProfileStore(s => s.connectRedditAccount);
  const disconnectRedditAccount = useProfileStore(s => s.disconnectRedditAccount);
  const profile = useProfileStore(s => s.profile);

  const isHunting = useHuntingStore(s => s.isHunting);
  const startHunting = useHuntingStore(s => s.startHunting);

  const user = useAuthStore(s => s.user);
  const { isDark } = useTheme();

  const workspaceKnowledge = currentWorkspace
    ? knowledgeItems.filter(item => item.workspaceId === currentWorkspace.id)
    : [];

  const getFilteredKnowledge = useCallback(() => {
    let filtered = workspaceKnowledge;
    if (searchQuery) {
      filtered = searchKnowledge(searchQuery, currentWorkspace?.id) || [];
    }
    if (activeFilter !== 'all') {
      filtered = filtered.filter(item => item.type === activeFilter);
    }
    return filtered;
  }, [workspaceKnowledge, searchQuery, activeFilter, currentWorkspace?.id, searchKnowledge]);

  const filteredKnowledge = getFilteredKnowledge();

  useEffect(() => {
    if (currentWorkspace?.id) {
      loadKnowledgeItems(currentWorkspace.id);
    }
  }, [currentWorkspace?.id, loadKnowledgeItems]);

  useEffect(() => {
    const checkBoxConnection = async () => {
      try {
        const hasTokens = await BoxService.isConnected();
        const boxIntegration = integrations.find(i => i.id === 'box');
        if (hasTokens) {
          try {
            await BoxService.listFiles('0', { limit: 1 });
            if (!boxIntegration?.connected) {
              connectBoxIntegration('Connected');
            }
          } catch {
            disconnectBoxIntegration();
          }
        } else {
          if (boxIntegration?.connected) {
            disconnectBoxIntegration();
          }
        }
      } catch (error) {
        console.error('Error checking Box connection:', error);
      }
    };
    checkBoxConnection();
  }, []);

  useEffect(() => {
    if (profile?.redditAccount?.username) {
      const redditIntegration = integrations.find(i => i.id === 'reddit');
      if (!redditIntegration?.connected) {
        connectRedditIntegration(profile.redditAccount.username);
      }
    } else {
      const redditIntegration = integrations.find(i => i.id === 'reddit');
      if (redditIntegration?.connected) {
        disconnectRedditIntegration();
      }
    }
  }, [profile?.redditAccount?.username]);

  const regenerateKeywordsAndSubreddits = async () => {
    if (!user?.uid || !currentWorkspace?.id) return;
    try {
      const { knowledgeItems } = useBrainStore.getState();
      if (knowledgeItems.length === 0) return;
      const knowledgeContext = knowledgeItems
        .map(item => `${item.title}: ${item.content || item.description || ''}`)
        .join('\n');
      await GeminiService.generateKeywordsAndSubreddits(knowledgeContext);
    } catch (error) {
      console.error('Failed to regenerate keywords:', error);
    }
  };

  const handleIntegrationPress = async (integrationId: string) => {
    if (integrationId === 'reddit') {
      await handleRedditIntegrationPress();
    } else if (integrationId === 'box') {
      await handleBoxIntegrationPress();
    } else if (integrationId === 'hubspot') {
      await handleHubSpotIntegrationPress();
    }
  };

  const handleConnectReddit = async () => {
    if (isConnectingReddit || isDisconnectingReddit) return;
    const isKeywordsCompleted = useQuestStore.getState().isHuntingKeywordsCompleted();
    if (!isKeywordsCompleted) {
      toastManager.error('Please complete the keyword setup quest first. Go to Home to answer the Quick Question about keywords.');
      hapticFeedback.warning();
      return;
    }
    hapticFeedback.light();
    navigation.navigate('RedditAccountSetup');
  };

  const handleRedditIntegrationPress = async () => {
    if (isConnectingReddit || isDisconnectingReddit) return;
    const redditIntegration = integrations.find(i => i.id === 'reddit');
    if (redditIntegration?.connected) {
      redditOptionsSheetRef.current?.show({
        username: profile?.redditAccount?.username || 'Unknown',
        isHunting,
        onStartHunting: () => setIsRedditPickerVisible(true),
        onViewInbox: () => navigation.navigate('Inbox'),
        onOpenSettings: () => navigation.navigate('AgentSettings'),
        onManageSubreddits: () => setIsSubredditSelectorVisible(true),
        onDisconnect: async () => {
          setIsDisconnectingReddit(true);
          try {
            const result = await RedditConnectionService.disconnectRedditAccount();
            if (!result.success) {
              toastManager.error(result.error || 'Failed to disconnect Reddit');
              setIsDisconnectingReddit(false);
              return;
            }
            await disconnectRedditAccount();
            disconnectRedditIntegration();
            updateIntegrationStatus('reddit', {
              statusText: undefined,
              actionText: undefined,
              isActive: false,
              leadCount: 0,
            });
            toastManager.success('Reddit account disconnected');
            hapticFeedback.success();
          } catch (error: any) {
            toastManager.error('Failed to disconnect Reddit account');
            hapticFeedback.error();
          } finally {
            setIsDisconnectingReddit(false);
          }
        },
        isDisconnecting: isDisconnectingReddit,
      });
    } else {
      await handleConnectReddit();
    }
  };

  const handleStartHuntingWithConfig = async (
    subreddits: string[],
    keywords?: string[],
    agentConfig?: { scoreThreshold: number; postAgeLimitDays: number; commentStyle: 'friendly' | 'professional' | 'expert'; requireApproval: boolean },
  ) => {
    try {
      const redditIntegration = integrations.find(i => i.id === 'reddit');
      if (!redditIntegration?.connected) {
        toastManager.error('Connect Reddit first to start hunting');
        return;
      }
      await startHunting(subreddits, 'balanced', currentWorkspace?.id, keywords);
      updateIntegrationStatus('reddit', {
        statusText: `Hunting ${subreddits.length} subreddits`,
        isActive: true,
        actionText: undefined,
        lastActivity: new Date(),
      });
    } catch (error) {
      console.error('Failed to start hunting with config:', error);
      throw error;
    }
  };

  const handleBoxIntegrationPress = async () => {
    const boxIntegration = integrations.find(i => i.id === 'box');
    const hasTokens = await BoxService.isConnected();
    if (boxIntegration?.connected && hasTokens) {
      try {
        await BoxService.listFiles('0', { limit: 1 });
        setIsBoxFilePickerVisible(true);
      } catch {
        disconnectBoxIntegration();
        toastManager.error('Box connection expired. Please reconnect.');
        setTimeout(() => handleConnectBox(), 500);
      }
    } else {
      if (boxIntegration?.connected && !hasTokens) {
        disconnectBoxIntegration();
      }
      await handleConnectBox();
    }
  };

  const handleConnectBox = async () => {
    if (isConnectingBox) return;
    try {
      setIsConnectingBox(true);
      const result = await BoxOAuthService.authenticateBox();
      if (result.success && result.email && result.tokens) {
        await BoxService.saveTokens(result.tokens);
        connectBoxIntegration(result.email);
        updateIntegrationStatus('box', {
          statusText: 'Ready to sync',
          actionText: 'Select Files',
          lastActivity: new Date(),
        });
        toastManager.success(`Connected to Box as ${result.email}`);
        setIsBoxFilePickerVisible(true);
      } else {
        const errorMsg = result.error || 'Unable to connect to Box';
        if (errorMsg.includes('cancelled') || errorMsg.includes('dismiss')) {
          toastManager.info('Box connection cancelled');
        } else {
          toastManager.error(errorMsg);
        }
      }
      setIsConnectingBox(false);
    } catch {
      toastManager.error('Failed to connect to Box');
      setIsConnectingBox(false);
    }
  };

  const handleHubSpotIntegrationPress = async () => {
    const hubspotIntegration = integrations.find(i => i.id === 'hubspot');
    if (hubspotIntegration?.connected) {
      confirmationSheetRef.current?.show({
        title: 'HubSpot Connected',
        message: 'Your agent is learning from your CRM.',
        confirmText: 'Sync Now',
        cancelText: 'Disconnect',
        destructive: false,
        onConfirm: async () => {
          try {
            toastManager.info('Syncing HubSpot data...');
            const integration = await HubSpotAuthService.getCurrentIntegration();
            if (integration) {
              await HubSpotKnowledgeService.performFullSync(integration);
              toastManager.success('HubSpot data synced!');
              hapticFeedback.success();
            }
          } catch (error: any) {
            toastManager.error(error.message || 'Failed to sync HubSpot');
          }
        },
        onCancel: async () => {
          try {
            const integration = await HubSpotAuthService.getCurrentIntegration();
            if (integration) {
              await HubSpotAuthService.disconnect(integration.id);
              updateIntegration('hubspot', { connected: false });
              toastManager.success('HubSpot disconnected');
              hapticFeedback.success();
            }
          } catch (error: any) {
            toastManager.error(error.message || 'Failed to disconnect');
          }
        },
      });
    } else {
      await handleConnectHubSpot();
    }
  };

  const handleConnectHubSpot = async () => {
    if (isConnectingHubSpot) return;
    try {
      setIsConnectingHubSpot(true);
      hapticFeedback.light();
      const accessToken = process.env.EXPO_PUBLIC_HUBSPOT_ACCESS_TOKEN;
      const clientId = process.env.EXPO_PUBLIC_HUBSPOT_CLIENT_ID;
      if ((!accessToken || accessToken.length < 10) && (!clientId || clientId === 'your-client-id')) {
        toastManager.error('HubSpot not configured.');
        return;
      }
      const integration = await HubSpotAuthService.connect();
      if (integration) {
        updateIntegration('hubspot', {
          connected: true,
          connectedAt: new Date(),
          statusText: 'Learning from your CRM',
          lastActivity: new Date(),
        });
        toastManager.success('HubSpot connected!');
        hapticFeedback.success();
        HubSpotKnowledgeService.performFullSync(integration).catch(() => {});
      }
    } catch (error: any) {
      if (!error.message?.includes('error 1') && !error.message?.includes('cancel')) {
        toastManager.error(error.message || 'Failed to connect HubSpot');
        hapticFeedback.error();
      }
    } finally {
      setIsConnectingHubSpot(false);
    }
  };

  const handleKnowledgePress = (itemId: string) => {
    hapticFeedback.light();
    const item = knowledgeItems.find(k => k.id === itemId);
    if (item) {
      setSelectedKnowledgeItem(item);
      setIsKnowledgeEditModalVisible(true);
    }
  };

  const handleKnowledgeSave = async (id: string, updates: Partial<KnowledgeItemType>) => {
    try {
      await updateKnowledgeItem(id, updates);
      toastManager.success('Knowledge updated');
      if (currentWorkspace?.id) {
        await loadKnowledgeItems(currentWorkspace.id);
      }
    } catch {
      toastManager.error('Failed to save');
      throw new Error('Failed to save');
    }
  };

  const handleKnowledgeDelete = async (id: string) => {
    confirmationSheetRef.current?.show({
      title: 'Delete Item?',
      message: 'This will permanently remove this knowledge item.',
      confirmText: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteKnowledgeItem(id);
          toastManager.success('Deleted');
          if (currentWorkspace?.id) {
            await loadKnowledgeItems(currentWorkspace.id);
          }
        } catch {
          toastManager.error('Failed to delete');
        }
      },
    });
  };

  const handleAddFile = () => {
    if (!currentWorkspace) return;
    hapticFeedback.light();
    setIsKnowledgeDrawerVisible(true);
  };

  const handleKnowledgeFileUpload = async (file: FileUpload) => {
    if (!currentWorkspace) return;
    setIsProcessingKnowledge(true);
    try {
      await addFileToKnowledge(file, currentWorkspace.id);
      updateWorkspaceStats(currentWorkspace.id, { files: currentWorkspace.stats.files + 1 });
      setIsKnowledgeDrawerVisible(false);
      toastManager.success('File added');
      regenerateKeywordsAndSubreddits();
    } catch {
      toastManager.error('Failed to add file');
    } finally {
      setIsProcessingKnowledge(false);
    }
  };

  const handleKnowledgeURLSubmit = async (url: string, preview: URLPreview) => {
    if (!currentWorkspace) return;
    setIsProcessingKnowledge(true);
    try {
      await addURLToKnowledge(url, preview, currentWorkspace.id);
      updateWorkspaceStats(currentWorkspace.id, { webpages: currentWorkspace.stats.webpages + 1 });
      setIsKnowledgeDrawerVisible(false);
      toastManager.success('URL added');
      regenerateKeywordsAndSubreddits();
    } catch {
      toastManager.error('Failed to add URL');
    } finally {
      setIsProcessingKnowledge(false);
    }
  };

  const handleKnowledgeTextSubmit = async (title: string, content: string, tags: string[]) => {
    if (!currentWorkspace) return;
    setIsProcessingKnowledge(true);
    try {
      await addTextToKnowledge(title, content, currentWorkspace.id, tags);
      updateWorkspaceStats(currentWorkspace.id, { snippets: currentWorkspace.stats.snippets + 1 });
      setIsKnowledgeDrawerVisible(false);
      toastManager.success('Note added');
      regenerateKeywordsAndSubreddits();
    } catch {
      toastManager.error('Failed to add note');
    } finally {
      setIsProcessingKnowledge(false);
    }
  };

  const handleBoxFilesSelected = async (items: Array<{ id: string; name: string; type: 'file' | 'folder' }>) => {
    if (!currentWorkspace) return;
    setSelectedBoxItems(items);
    setIsSyncingBox(true);
    try {
      const summary = await syncSelectedBoxItems(currentWorkspace.id);
      const boxFiles = workspaceKnowledge.filter(item => item.source === 'box');
      updateIntegrationStatus('box', {
        statusText: `${boxFiles.length + summary.imported} files synced`,
        fileCount: boxFiles.length + summary.imported,
        isActive: false,
        actionText: 'Add More Files',
        lastActivity: new Date(),
      });
      const successMsg = summary.imported > 0 ? `Linked ${summary.imported} files` : `Skipped ${summary.skipped} duplicates`;
      toastManager.success(successMsg, 4000);
      if (summary.imported > 0) {
        regenerateKeywordsAndSubreddits();
      }
    } catch (error) {
      toastManager.error('Failed to link files');
    } finally {
      setIsSyncingBox(false);
    }
  };

  const handleUnlinkBoxFiles = async (itemIds: string[]) => {
    if (!currentWorkspace) return;
    try {
      const result = await unlinkBoxDocuments(itemIds);
      if (result.success > 0) {
        await loadKnowledgeItems(currentWorkspace.id);
        const boxFiles = workspaceKnowledge.filter(item => item.source === 'box');
        updateIntegrationStatus('box', {
          fileCount: boxFiles.length - result.success,
          statusText: `${boxFiles.length - result.success} files synced`,
          lastActivity: new Date(),
        });
        toastManager.success(`Unlinked ${result.success} files`);
      } else {
        toastManager.error('Failed to unlink files');
      }
    } catch {
      toastManager.error('Failed to unlink files');
    }
  };

  const handleSaveSubreddits = async (
    subreddits: string[],
    keywords?: string[],
    agentConfig?: { scoreThreshold: number; postAgeLimitDays: number; commentStyle: 'friendly' | 'professional' | 'expert'; requireApproval: boolean },
  ) => {
    try {
      if (!user?.uid || !profile?.redditAccount?.username) {
        toastManager.error('Reddit not connected');
        return;
      }
      const updatedRedditAccount = { ...profile.redditAccount, targetSubreddits: subreddits };
      await useProfileStore.getState().updateProfile({ redditAccount: updatedRedditAccount });
      if (agentConfig) {
        await useAgentSettingsStore.getState().updateSettings({
          scoreThreshold: agentConfig.scoreThreshold,
          postAgeLimitDays: agentConfig.postAgeLimitDays,
          commentStyle: agentConfig.commentStyle,
          requireApproval: agentConfig.requireApproval,
        });
      }
      await handleStartHuntingWithConfig(subreddits, keywords, agentConfig);
      const subredditCount = subreddits.length;
      const message = subredditCount === 1
        ? `Agent started! Monitoring r/${subreddits[0]} for leads`
        : `Agent started! Monitoring ${subredditCount} subreddits for leads`;
      toastManager.success(message, 4000);
      hapticFeedback.success();
      if (currentWorkspace?.id) {
        await loadKnowledgeItems(currentWorkspace.id);
      }
    } catch {
      toastManager.error('Failed to save settings');
    }
  };

  const filterCounts = {
    all: workspaceKnowledge.length,
    file: workspaceKnowledge.filter(i => i.type === 'file').length,
    webpage: workspaceKnowledge.filter(i => i.type === 'webpage').length,
    snippet: workspaceKnowledge.filter(i => i.type === 'snippet').length,
  };

  if (!currentWorkspace) {
    return (
      <View className="flex-1" style={{ backgroundColor: isDark ? '#111827' : '#F8F9FA' }}>
        <GlobalHeader title="Brain AI" transparent={true} />
        <SafeAreaView className="flex-1" edges={['top']}>
          <View className="flex-1 items-center justify-center">
            <Text style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>No workspace selected</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const gradientColors = isDark
    ? [colorWithOpacity(0.2), colorWithOpacity(0.1), colorWithOpacity(0.05), '#111827'] as const
    : [colorWithOpacity(0.15), colorWithOpacity(0.08), colorWithOpacity(0.02), '#F8F9FA'] as const;

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? '#111827' : '#F8F9FA' }}>
      <LinearGradient
        colors={gradientColors}
        locations={[0, 0.25, 0.5, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <GlobalHeader title="Brain AI" transparent={true} />
      <SafeAreaView className="flex-1" edges={['top']}>
        <View style={{ height: 80 }} />

        {/* Tab Selector */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16 }}>
          <Pressable onPress={() => { hapticFeedback.light(); setActiveTab('knowledge'); }} style={{ marginRight: 12 }}>
            <View style={{
              paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, overflow: 'hidden', borderWidth: 1,
              borderColor: activeTab === 'knowledge' ? workspaceColorValue : isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              backgroundColor: activeTab === 'knowledge' ? workspaceColorValue : (isDark ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.9)'),
            }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: activeTab === 'knowledge' ? '#FFFFFF' : (isDark ? '#9CA3AF' : '#6B7280') }}>Knowledge</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => { hapticFeedback.light(); setActiveTab('integrations'); }}>
            <View style={{
              paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, overflow: 'hidden', borderWidth: 1,
              borderColor: activeTab === 'integrations' ? workspaceColorValue : isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              backgroundColor: activeTab === 'integrations' ? workspaceColorValue : (isDark ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.9)'),
            }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: activeTab === 'integrations' ? '#FFFFFF' : (isDark ? '#9CA3AF' : '#6B7280') }}>Integrations</Text>
            </View>
          </Pressable>
        </View>

        {activeTab === 'knowledge' ? (
          <>
            {/* Search Bar */}
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 16, height: 52, overflow: 'hidden', borderWidth: 1,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                backgroundColor: isDark ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.9)',
              }}>
                <Search size={20} color={isDark ? '#9CA3AF' : '#9CA3AF'} />
                <TextInput
                  placeholder="Search knowledge..."
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={{ flex: 1, marginLeft: 12, fontSize: 16, color: isDark ? '#F9FAFB' : '#1F2937' }}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <Text style={{ color: '#3B82F6', fontWeight: '500' }}>Clear</Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Filter Chips */}
            <View style={{ marginBottom: 16 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                <FilterChip label={`All (${filterCounts.all})`} isActive={activeFilter === 'all'} onPress={() => setActiveFilter('all')} isDark={isDark} accentColor={workspaceColorValue} />
                <FilterChip label={`Files (${filterCounts.file})`} isActive={activeFilter === 'file'} onPress={() => setActiveFilter('file')} isDark={isDark} accentColor={workspaceColorValue} />
                <FilterChip label={`URLs (${filterCounts.webpage})`} isActive={activeFilter === 'webpage'} onPress={() => setActiveFilter('webpage')} isDark={isDark} accentColor={workspaceColorValue} />
                <FilterChip label={`Notes (${filterCounts.snippet})`} isActive={activeFilter === 'snippet'} onPress={() => setActiveFilter('snippet')} isDark={isDark} accentColor={workspaceColorValue} />
              </ScrollView>
            </View>

            {/* Knowledge List */}
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
              {filteredKnowledge.length > 0 ? (
                filteredKnowledge.map(item => (
                  <Animated.View key={item.id} entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} layout={Layout.springify()}>
                    <MinimalKnowledgeItem item={item} onPress={() => handleKnowledgePress(item.id)} onDelete={() => handleKnowledgeDelete(item.id)} isDark={isDark} />
                  </Animated.View>
                ))
              ) : (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                  <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: isDark ? '#1F2937' : '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <FileText size={32} color={isDark ? '#4B5563' : '#9CA3AF'} />
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '600', color: isDark ? '#F9FAFB' : '#1F2937', marginBottom: 8 }}>
                    {searchQuery ? 'No results found' : 'No knowledge yet'}
                  </Text>
                  <Text style={{ fontSize: 15, color: isDark ? '#6B7280' : '#9CA3AF', textAlign: 'center', maxWidth: 280 }}>
                    {searchQuery ? 'Try a different search term' : 'Tap the + button to add files, URLs, or notes'}
                  </Text>
                  {!searchQuery && (
                    <Pressable onPress={handleAddFile} style={{ marginTop: 24, backgroundColor: '#3B82F6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
                      <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>Add Knowledge</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </ScrollView>

            {/* FAB */}
            <Pressable
              onPress={handleAddFile}
              style={{
                position: 'absolute', bottom: 100, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#3B82F6',
                alignItems: 'center', justifyContent: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
              }}
            >
              <Plus size={28} color="#FFFFFF" />
            </Pressable>
          </>
        ) : (
          <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
            {integrations.filter(i => i.connected).length > 0 && (
              <View style={{ marginBottom: 24 }}>
                {integrations.filter(i => i.connected).map((integration, index) => (
                  <IntegrationCard key={integration.id} integration={integration} onPress={() => handleIntegrationPress(integration.id)} index={index} isLarge={true} isDark={isDark} />
                ))}
              </View>
            )}
            {integrations.filter(i => !i.connected).length > 0 && (
              <View>
                {integrations.filter(i => i.connected).length > 0 && (
                  <Text style={{ fontSize: 12, fontWeight: '500', color: '#6B7280', marginBottom: 16 }}>AVAILABLE</Text>
                )}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  {integrations.filter(i => !i.connected).map((integration, index) => (
                    <IntegrationCard key={integration.id} integration={integration} onPress={() => handleIntegrationPress(integration.id)} index={index} isDark={isDark} />
                  ))}
                </View>
              </View>
            )}
            {integrations.length === 0 && (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
                <Ionicons name="apps-outline" size={64} color={isDark ? '#374151' : '#D1D5DB'} />
                <Text style={{ fontSize: 18, fontWeight: '500', marginTop: 16, color: isDark ? '#9CA3AF' : '#6B7280' }}>No integrations available</Text>
                <Text style={{ fontSize: 14, marginTop: 8, color: '#6B7280' }}>Check back soon for new integrations</Text>
              </View>
            )}
            <Animated.View entering={FadeInDown.delay(400).springify()} style={{ marginTop: 32 }}>
              <View style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)', backgroundColor: isDark ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.9)' }}>
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? '#FFFFFF' : '#1F2937' }}>Explore Directory</Text>
                      <Text style={{ fontSize: 14, marginTop: 4, color: isDark ? '#9CA3AF' : '#6B7280' }}>Discover more integrations</Text>
                    </View>
                    <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}>
                      <Ionicons name="compass-outline" size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    </View>
                  </View>
                  <Pressable style={{ marginTop: 16 }} onPress={() => toastManager.info('More integrations coming soon!')}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: isDark ? '#60A5FA' : '#3B82F6' }}>Browse All →</Text>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Modals */}
      <KnowledgeBaseDrawer isVisible={isKnowledgeDrawerVisible} onClose={() => setIsKnowledgeDrawerVisible(false)} onFileUpload={handleKnowledgeFileUpload} onURLSubmit={handleKnowledgeURLSubmit} onTextSubmit={handleKnowledgeTextSubmit} isProcessing={isProcessingKnowledge} />
      <BoxFilePicker isVisible={isBoxFilePickerVisible} onClose={() => setIsBoxFilePickerVisible(false)} onSyncFiles={handleBoxFilesSelected} workspaceId={currentWorkspace?.id || ''} />
      <BoxUnlinkModal isVisible={isBoxUnlinkModalVisible} onClose={() => setIsBoxUnlinkModalVisible(false)} onUnlinkSelected={handleUnlinkBoxFiles} boxFiles={workspaceKnowledge.filter(item => item.source === 'box')} />
      <KnowledgeEditModal visible={isKnowledgeEditModalVisible} onClose={() => { setIsKnowledgeEditModalVisible(false); setSelectedKnowledgeItem(null); }} item={selectedKnowledgeItem} onSave={handleKnowledgeSave} onDelete={handleKnowledgeDelete} />
      <RedditSubredditSelector visible={isSubredditSelectorVisible} onClose={() => setIsSubredditSelectorVisible(false)} onSave={handleSaveSubreddits} initialSubreddits={profile?.redditAccount?.targetSubreddits || []} />
      <RedditOptionsSheet ref={redditOptionsSheetRef} />
      <ConfirmationSheet ref={confirmationSheetRef} />
    </View>
  );
}

export default withScreenErrorBoundary('BrainAIScreen', {
  showRetryButton: true,
  maxRetries: 3,
  fallbackMessage: 'Something went wrong. Please try again.',
})(BrainAIScreen);
