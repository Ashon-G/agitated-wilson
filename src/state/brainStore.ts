import { create } from 'zustand';
import { KnowledgeItem, Integration } from '../types/app';
import { FileUpload, URLPreview } from '../types/knowledge';
import BackendService from '../services/BackendService';
import AuthenticationService from '../services/AuthenticationService';
import useSubscriptionStore from './subscriptionStore';
import { isUnlimited } from '../config/subscriptionTiers';

interface BrainStore {
  knowledgeItems: KnowledgeItem[];
  integrations: Integration[];
  isLoading: boolean;
  selectedBoxItems: Array<{ id: string; name: string; type: 'file' | 'folder' }>;

  // Actions
  loadKnowledgeItems: (workspaceId: string) => Promise<void>;
  addKnowledgeItem: (item: Omit<KnowledgeItem, 'id' | 'createdAt'>) => Promise<void>;
  updateKnowledgeItem: (id: string, updates: Partial<KnowledgeItem>) => Promise<void>;
  deleteKnowledgeItem: (id: string) => Promise<void>;
  getKnowledgeByWorkspace: (workspaceId: string) => KnowledgeItem[];
  searchKnowledge: (query: string, workspaceId?: string) => KnowledgeItem[];

  // New upload methods
  addFileToKnowledge: (file: FileUpload, workspaceId: string, title?: string, description?: string, tags?: string[]) => Promise<void>;
  addURLToKnowledge: (url: string, preview: URLPreview, workspaceId: string, title?: string, description?: string, tags?: string[]) => Promise<void>;
  addTextToKnowledge: (title: string, content: string, workspaceId: string, tags?: string[], description?: string) => Promise<void>;

  updateIntegration: (id: string, updates: Partial<Integration>) => void;
  updateIntegrationStatus: (id: string, status: Partial<Pick<Integration, 'statusText' | 'lastActivity' | 'isActive' | 'actionText' | 'fileCount' | 'leadCount'>>) => void;
  toggleIntegrationConnection: (id: string) => void;
  connectRedditIntegration: (username: string) => void;
  disconnectRedditIntegration: () => void;

  // Box integration
  connectBoxIntegration: (email: string) => void;
  disconnectBoxIntegration: () => void;
  setSelectedBoxItems: (items: Array<{ id: string; name: string; type: 'file' | 'folder' }>) => void;
  syncBoxToKnowledge: (workspaceId: string) => Promise<{ totalFiles: number; imported: number; failed: number; skipped: number }>;
  syncSelectedBoxItems: (workspaceId: string) => Promise<{ totalFiles: number; imported: number; failed: number; skipped: number }>;
  unlinkBoxDocuments: (itemIds: string[]) => Promise<{ success: number; failed: number }>;
}

const useBrainStore = create<BrainStore>((set, get) => ({
  knowledgeItems: [],
  selectedBoxItems: [],
  integrations: [
    {
      id: 'reddit',
      name: 'Reddit',
      type: 'social',
      icon: 'logo-reddit',
      connected: false,
      description: 'Connect your Reddit account to track mentions and engage with communities',
    },
    {
      id: 'box',
      name: 'Box',
      type: 'storage',
      icon: 'cube-outline',
      connected: false,
      description: 'Import documents from Box to your knowledge base',
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      type: 'crm',
      icon: 'cube-outline',
      connected: false,
      description: 'Connect your HubSpot CRM so your agent can learn from your closed deals, contact patterns, and engagement history.',
    },
  ],
  isLoading: false,

  loadKnowledgeItems: async (workspaceId) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) {
      console.log('📚 loadKnowledgeItems: No user, skipping');
      return;
    }

    console.log(`📚 loadKnowledgeItems: Loading for workspace ${workspaceId}, user ${user.uid}`);

    try {
      set({ isLoading: true });
      // Query from users/{userId}/knowledge subcollection (3 segments = valid collection path)
      const knowledgePath = `users/${user.uid}/knowledge`;

      // Load items for this workspace
      let workspaceItems = await BackendService.queryCollection<KnowledgeItem>(knowledgePath, {
        where: [
          { field: 'workspaceId', operator: '==', value: workspaceId },
        ],
      });

      console.log(`📚 loadKnowledgeItems: Found ${workspaceItems.length} items for workspace ${workspaceId}`);

      // Also load orphaned onboarding items (workspaceId: 'default')
      // These may have been created during onboarding before workspace was properly set
      let orphanedOnboardingItems: KnowledgeItem[] = [];
      try {
        orphanedOnboardingItems = await BackendService.queryCollection<KnowledgeItem>(knowledgePath, {
          where: [
            { field: 'workspaceId', operator: '==', value: 'default' },
          ],
        });

        console.log(`📚 loadKnowledgeItems: Found ${orphanedOnboardingItems.length} orphaned items`);

        // Migrate orphaned items to current workspace
        if (orphanedOnboardingItems.length > 0) {
          console.log(`🔄 Found ${orphanedOnboardingItems.length} orphaned knowledge items, migrating to workspace: ${workspaceId}`);
          for (const item of orphanedOnboardingItems) {
            try {
              await BackendService.updateDocument<KnowledgeItem>(knowledgePath, item.id, {
                workspaceId,
              });
              item.workspaceId = workspaceId; // Update local copy
              console.log(`✅ Migrated knowledge item "${item.title}" to workspace ${workspaceId}`);
            } catch (migrateError) {
              console.warn(`⚠️ Failed to migrate knowledge item ${item.id}:`, migrateError);
            }
          }
        }
      } catch (orphanError) {
        console.warn('Failed to check for orphaned onboarding items:', orphanError);
      }

      // If no items found for this workspace, try loading ALL items and migrate them
      if (workspaceItems.length === 0 && orphanedOnboardingItems.length === 0) {
        console.log('📚 loadKnowledgeItems: No items found, checking for items in other workspaces...');
        try {
          const allItems = await BackendService.queryCollection<KnowledgeItem>(knowledgePath, {});
          console.log(`📚 loadKnowledgeItems: Found ${allItems.length} total items across all workspaces`);

          if (allItems.length > 0) {
            // Migrate all items to current workspace
            console.log(`🔄 Migrating ${allItems.length} items to current workspace: ${workspaceId}`);
            for (const item of allItems) {
              if (item.workspaceId !== workspaceId) {
                try {
                  await BackendService.updateDocument<KnowledgeItem>(knowledgePath, item.id, {
                    workspaceId,
                  });
                  item.workspaceId = workspaceId;
                  console.log(`✅ Migrated knowledge item "${item.title}" from ${item.workspaceId} to ${workspaceId}`);
                } catch (migrateError) {
                  console.warn(`⚠️ Failed to migrate knowledge item ${item.id}:`, migrateError);
                }
              }
            }
            workspaceItems = allItems.map(item => ({ ...item, workspaceId }));
          }
        } catch (allError) {
          console.warn('Failed to load all knowledge items:', allError);
        }
      }

      // Combine items, removing duplicates by ID
      const allItems = [...workspaceItems, ...orphanedOnboardingItems];
      // Filter out items without titles (invalid/corrupted items) and remove duplicates
      const validItems = allItems.filter(item => item.title && item.title !== 'undefined');
      const uniqueItems = validItems.filter(
        (item, index, self) => self.findIndex(i => i.id === item.id) === index,
      );

      console.log(`📚 loadKnowledgeItems: Total unique items: ${uniqueItems.length}`);
      if (uniqueItems.length > 0) {
        console.log(`📚 loadKnowledgeItems: First item: ${uniqueItems[0]?.title}`);
      }

      // Sort client-side to avoid index requirement
      uniqueItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Update knowledge items for this workspace while preserving others
      set(state => ({
        knowledgeItems: [
          ...state.knowledgeItems.filter(item => item.workspaceId !== workspaceId && item.workspaceId !== 'default'),
          ...uniqueItems,
        ],
        isLoading: false,
      }));

      console.log(`📚 loadKnowledgeItems: State updated with ${uniqueItems.length} items`);

      // Note: syncFromUserKnowledge has been disabled to prevent duplicate creation.
      // The UI knowledge items are already the source of truth and accessible via KnowledgeService.
    } catch (error) {
      console.error('Failed to load knowledge items from Firestore:', error);
      set({ isLoading: false });
    }
  },

  addKnowledgeItem: async (itemData) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    // Check knowledge base item limit
    const { limits } = useSubscriptionStore.getState();
    const knowledgeLimit = limits.knowledgeItems;
    const currentItems = get().knowledgeItems.filter(
      item => item.workspaceId === itemData.workspaceId,
    );

    if (!isUnlimited(knowledgeLimit) && currentItems.length >= knowledgeLimit) {
      throw new Error(`Knowledge base limit reached (${knowledgeLimit} items). Upgrade your plan to add more.`);
    }

    try {
      // Create in users/{userId}/knowledge subcollection (3 segments = valid collection path)
      const knowledgePath = `users/${user.uid}/knowledge`;
      const newItem = await BackendService.createDocument<KnowledgeItem>(knowledgePath, {
        ...itemData,
        userId: user.uid,
        createdAt: new Date(),
      });

      set(state => ({
        knowledgeItems: [newItem, ...state.knowledgeItems],
      }));

      // Note: syncFromUserKnowledge has been disabled to prevent duplicate creation.
      // The knowledge item is already saved in the correct location.
    } catch (error) {
      console.error('Failed to create knowledge item in Firestore:', error);
      throw error;
    }
  },

  updateKnowledgeItem: async (id, updates) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    try {
      // Update in users/{userId}/knowledge subcollection (3 segments = valid collection path)
      const knowledgePath = `users/${user.uid}/knowledge`;
      await BackendService.updateDocument<KnowledgeItem>(knowledgePath, id, updates);

      set(state => ({
        knowledgeItems: state.knowledgeItems.map(item =>
          item.id === id ? { ...item, ...updates } : item,
        ),
      }));
    } catch (error) {
      console.error('Failed to update knowledge item in Firestore:', error);
      throw error;
    }
  },

  deleteKnowledgeItem: async (id) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    try {
      // Delete from users/{userId}/knowledge subcollection (3 segments = valid collection path)
      const knowledgePath = `users/${user.uid}/knowledge`;
      await BackendService.deleteDocument(knowledgePath, id);

      set(state => ({
        knowledgeItems: state.knowledgeItems.filter(item => item.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete knowledge item from Firestore:', error);
      throw error;
    }
  },

  getKnowledgeByWorkspace: (workspaceId) => {
    return get().knowledgeItems.filter(item => item.workspaceId === workspaceId);
  },

  searchKnowledge: (query, workspaceId) => {
    const items = workspaceId
      ? get().knowledgeItems.filter(item => item.workspaceId === workspaceId)
      : get().knowledgeItems;

    const lowercaseQuery = query.toLowerCase();
    return items.filter(item =>
      item.title.toLowerCase().includes(lowercaseQuery) ||
      (item.content && item.content.toLowerCase().includes(lowercaseQuery)) ||
      item.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery)),
    );
  },

  addFileToKnowledge: async (file, workspaceId, title, description, tags = []) => {
    await get().addKnowledgeItem({
      type: 'file',
      title: title || file.name,
      content: undefined,
      filePath: file.uri,
      fileSize: file.size,
      mimeType: file.mimeType,
      workspaceId,
      tags: [...tags, 'file'],
      description: description || `Uploaded file: ${file.name}`,
    });
  },

  addURLToKnowledge: async (url, preview, workspaceId, title, description, tags = []) => {
    await get().addKnowledgeItem({
      type: 'webpage',
      title: title || preview.title || 'Web Page',
      content: preview.description,
      url,
      workspaceId,
      tags: [...tags, 'webpage'],
      description: description || `Web page: ${url}`,
    });
  },

  addTextToKnowledge: async (title, content, workspaceId, tags = [], description) => {
    await get().addKnowledgeItem({
      type: 'snippet',
      title,
      content,
      workspaceId,
      tags: [...tags, 'snippet'],
      description: description || 'Text snippet',
    });
  },

  updateIntegration: (id, updates) => {
    set(state => ({
      integrations: state.integrations.map(integration =>
        integration.id === id ? { ...integration, ...updates } : integration,
      ),
    }));
  },

  // Update integration status (statusText, lastActivity, isActive, etc.)
  updateIntegrationStatus: (id: string, status: Partial<Pick<Integration, 'statusText' | 'lastActivity' | 'isActive' | 'actionText' | 'fileCount' | 'leadCount'>>) => {
    set(state => ({
      integrations: state.integrations.map(integration =>
        integration.id === id
          ? {
            ...integration,
            ...status,
            lastActivity: status.lastActivity || new Date(),
          }
          : integration,
      ),
    }));
  },

  toggleIntegrationConnection: (id) => {
    set(state => ({
      integrations: state.integrations.map(integration =>
        integration.id === id
          ? {
            ...integration,
            connected: !integration.connected,
            connectedAt: !integration.connected ? new Date() : undefined,
          }
          : integration,
      ),
    }));
  },

  connectRedditIntegration: (username) => {
    set(state => ({
      integrations: state.integrations.map(integration =>
        integration.id === 'reddit'
          ? {
            ...integration,
            connected: true,
            connectedAt: new Date(),
            settings: { username },
          }
          : integration,
      ),
    }));
  },

  disconnectRedditIntegration: () => {
    set(state => ({
      integrations: state.integrations.map(integration =>
        integration.id === 'reddit'
          ? {
            ...integration,
            connected: false,
            connectedAt: undefined,
            settings: undefined,
          }
          : integration,
      ),
    }));
  },

  // Box integration methods
  connectBoxIntegration: (email) => {
    set(state => ({
      integrations: state.integrations.map(integration =>
        integration.id === 'box'
          ? {
            ...integration,
            connected: true,
            connectedAt: new Date(),
            settings: { email },
          }
          : integration,
      ),
    }));
  },

  disconnectBoxIntegration: () => {
    set(state => ({
      integrations: state.integrations.map(integration =>
        integration.id === 'box'
          ? {
            ...integration,
            connected: false,
            connectedAt: undefined,
            settings: undefined,
          }
          : integration,
      ),
      selectedBoxItems: [], // Clear selected items on disconnect
    }));
  },

  // Set selected Box items
  setSelectedBoxItems: (items) => {
    set({ selectedBoxItems: items });
  },

  // Sync Box documents to knowledge base
  syncBoxToKnowledge: async (workspaceId) => {
    try {
      // Dynamic import to avoid circular dependencies
      const BoxService = (await import('../services/BoxService')).default;

      set({ isLoading: true });
      const summary = await BoxService.syncAllDocuments(workspaceId);

      // Reload knowledge items after sync
      await get().loadKnowledgeItems(workspaceId);

      set({ isLoading: false });
      return summary;
    } catch (error) {
      console.error('Failed to sync Box to knowledge base:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  // Sync only selected Box items to knowledge base
  syncSelectedBoxItems: async (workspaceId) => {
    try {
      const { selectedBoxItems } = get();

      if (selectedBoxItems.length === 0) {
        throw new Error('No items selected');
      }

      // Dynamic import to avoid circular dependencies
      const BoxService = (await import('../services/BoxService')).default;

      set({ isLoading: true });
      const summary = await BoxService.syncSelectedItems(workspaceId, selectedBoxItems);

      // Reload knowledge items after sync
      await get().loadKnowledgeItems(workspaceId);

      set({ isLoading: false });
      return summary;
    } catch (error) {
      console.error('Failed to sync selected Box items:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  // Unlink Box documents from knowledge base
  unlinkBoxDocuments: async (itemIds) => {
    let successCount = 0;
    let failedCount = 0;

    try {
      set({ isLoading: true });

      // Delete each selected item
      for (const itemId of itemIds) {
        try {
          await get().deleteKnowledgeItem(itemId);
          successCount++;
        } catch (error) {
          console.error(`Failed to unlink item ${itemId}:`, error);
          failedCount++;
        }
      }

      set({ isLoading: false });
      return { success: successCount, failed: failedCount };
    } catch (error) {
      console.error('Failed to unlink Box documents:', error);
      set({ isLoading: false });
      throw error;
    }
  },
}));

export default useBrainStore;