/**
 * Data Migration Service
 * Handles migration of existing AsyncStorage data to Firestore backend
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import BackendService from './BackendService';
import AuthenticationService from './AuthenticationService';
import { COLLECTIONS } from '../config/firebase';
import {
  SalesAgent,
  Lead,
  Conversation,
  AgentAction,
  AgentInboxItem,
} from '../types/agent';

interface MigrationProgress {
  totalItems: number;
  migratedItems: number;
  failedItems: number;
  currentCollection: string;
  isComplete: boolean;
  errors: Array<{ collection: string; key: string; error: string }>;
}

interface MigrationOptions {
  dryRun?: boolean; // Preview what would be migrated without actually migrating
  backup?: boolean; // Keep backup of AsyncStorage data
  batchSize?: number; // Number of items to migrate per batch
}

class DataMigrationService {
  private progress: MigrationProgress = {
    totalItems: 0,
    migratedItems: 0,
    failedItems: 0,
    currentCollection: '',
    isComplete: false,
    errors: [],
  };

  private listeners: Array<(progress: MigrationProgress) => void> = [];

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await BackendService.initialize();
      console.log('✅ DataMigrationService initialized');
    } catch (error) {
      console.error('❌ Failed to initialize DataMigrationService:', error);
    }
  }

  /**
   * Add progress listener
   */
  addProgressListener(listener: (progress: MigrationProgress) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove progress listener
   */
  removeProgressListener(listener: (progress: MigrationProgress) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyProgress(): void {
    this.listeners.forEach(listener => listener({ ...this.progress }));
  }

  /**
   * Analyze existing AsyncStorage data without migrating
   */
  async analyzeExistingData(): Promise<{
    agents: number;
    leads: number;
    conversations: number;
    inboxItems: number;
    actions: number;
    redditAccounts: number;
    totalSize: number;
  }> {
    // AsyncStorage analysis disabled - data should be in Firebase
    console.log('Data migration analysis disabled - all data should be stored in Firebase');
    return {
      agents: 0,
      leads: 0,
      conversations: 0,
      inboxItems: 0,
      actions: 0,
      redditAccounts: 0,
      totalSize: 0,
    };
  }

  /**
   * Migration disabled - all data should be stored directly in Firebase
   */
  async migrateAllData(options: MigrationOptions = {}): Promise<MigrationProgress> {
    console.log('Data migration disabled - all new data is stored directly in Firebase');

    return {
      totalItems: 0,
      migratedItems: 0,
      failedItems: 0,
      currentCollection: 'none',
      isComplete: true,
      errors: [],
    };
  }

  private async migrateAgents(userId: string, dryRun: boolean, batchSize: number): Promise<void> {
    this.progress.currentCollection = 'Sales Agents';
    this.notifyProgress();

    try {
      const keys = await AsyncStorage.getAllKeys();
      const agentKeys = keys.filter(key => key.startsWith('agent_'));

      for (let i = 0; i < agentKeys.length; i += batchSize) {
        const batch = agentKeys.slice(i, i + batchSize);

        for (const key of batch) {
          try {
            const data = await AsyncStorage.getItem(key);
            if (data) {
              const agent: SalesAgent = JSON.parse(data);

              if (agent.userId === userId) {
                if (!dryRun) {
                  await BackendService.createDocument<SalesAgent>(
                    COLLECTIONS.SALES_AGENTS,
                    agent,
                  );
                }
                this.progress.migratedItems++;
              }
            }
          } catch (error) {
            console.error(`Failed to migrate agent ${key}:`, error);
            this.progress.failedItems++;
            this.progress.errors.push({
              collection: 'agents',
              key,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        this.notifyProgress();

        // Small delay between batches to prevent overwhelming the system
        if (!dryRun && i + batchSize < agentKeys.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('Failed to migrate agents:', error);
      throw error;
    }
  }

  private async migrateLeads(userId: string, dryRun: boolean, batchSize: number): Promise<void> {
    this.progress.currentCollection = 'Leads';
    this.notifyProgress();

    try {
      const keys = await AsyncStorage.getAllKeys();
      const leadKeys = keys.filter(key => key.startsWith('lead_'));

      for (let i = 0; i < leadKeys.length; i += batchSize) {
        const batch = leadKeys.slice(i, i + batchSize);

        for (const key of batch) {
          try {
            const data = await AsyncStorage.getItem(key);
            if (data) {
              const lead: Lead = JSON.parse(data);

              if (lead.userId === userId) {
                if (!dryRun) {
                  await BackendService.createDocument<Lead>(
                    COLLECTIONS.LEADS,
                    lead,
                  );
                }
                this.progress.migratedItems++;
              }
            }
          } catch (error) {
            console.error(`Failed to migrate lead ${key}:`, error);
            this.progress.failedItems++;
            this.progress.errors.push({
              collection: 'leads',
              key,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        this.notifyProgress();

        if (!dryRun && i + batchSize < leadKeys.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('Failed to migrate leads:', error);
      throw error;
    }
  }

  private async migrateConversations(userId: string, dryRun: boolean, batchSize: number): Promise<void> {
    this.progress.currentCollection = 'Conversations';
    this.notifyProgress();

    try {
      const keys = await AsyncStorage.getAllKeys();
      const conversationKeys = keys.filter(key => key.startsWith('conv_'));

      for (let i = 0; i < conversationKeys.length; i += batchSize) {
        const batch = conversationKeys.slice(i, i + batchSize);

        for (const key of batch) {
          try {
            const data = await AsyncStorage.getItem(key);
            if (data) {
              const conversation: Conversation = JSON.parse(data);

              if (conversation.userId === userId) {
                if (!dryRun) {
                  await BackendService.createDocument<Conversation>(
                    COLLECTIONS.CONVERSATIONS,
                    conversation,
                  );
                }
                this.progress.migratedItems++;
              }
            }
          } catch (error) {
            console.error(`Failed to migrate conversation ${key}:`, error);
            this.progress.failedItems++;
            this.progress.errors.push({
              collection: 'conversations',
              key,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        this.notifyProgress();

        if (!dryRun && i + batchSize < conversationKeys.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('Failed to migrate conversations:', error);
      throw error;
    }
  }

  private async migrateInboxItems(userId: string, dryRun: boolean, batchSize: number): Promise<void> {
    this.progress.currentCollection = 'Inbox Items';
    this.notifyProgress();

    try {
      const keys = await AsyncStorage.getAllKeys();
      const inboxKeys = keys.filter(key => key.startsWith('inbox_'));

      for (let i = 0; i < inboxKeys.length; i += batchSize) {
        const batch = inboxKeys.slice(i, i + batchSize);

        for (const key of batch) {
          try {
            const data = await AsyncStorage.getItem(key);
            if (data) {
              const inboxItem: AgentInboxItem = JSON.parse(data);

              if (inboxItem.userId === userId) {
                if (!dryRun) {
                  await BackendService.createDocument<AgentInboxItem>(
                    COLLECTIONS.AGENT_INBOX,
                    inboxItem,
                  );
                }
                this.progress.migratedItems++;
              }
            }
          } catch (error) {
            console.error(`Failed to migrate inbox item ${key}:`, error);
            this.progress.failedItems++;
            this.progress.errors.push({
              collection: 'inbox',
              key,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        this.notifyProgress();

        if (!dryRun && i + batchSize < inboxKeys.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('Failed to migrate inbox items:', error);
      throw error;
    }
  }

  private async migrateActions(userId: string, dryRun: boolean, batchSize: number): Promise<void> {
    this.progress.currentCollection = 'Agent Actions';
    this.notifyProgress();

    try {
      const keys = await AsyncStorage.getAllKeys();
      const actionKeys = keys.filter(key => key.startsWith('action_'));

      for (let i = 0; i < actionKeys.length; i += batchSize) {
        const batch = actionKeys.slice(i, i + batchSize);

        for (const key of batch) {
          try {
            const data = await AsyncStorage.getItem(key);
            if (data) {
              const action: AgentAction = JSON.parse(data);

              if (action.userId === userId) {
                if (!dryRun) {
                  await BackendService.createDocument<AgentAction>(
                    COLLECTIONS.AGENT_ACTIONS,
                    action,
                  );
                }
                this.progress.migratedItems++;
              }
            }
          } catch (error) {
            console.error(`Failed to migrate action ${key}:`, error);
            this.progress.failedItems++;
            this.progress.errors.push({
              collection: 'actions',
              key,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        this.notifyProgress();

        if (!dryRun && i + batchSize < actionKeys.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('Failed to migrate actions:', error);
      throw error;
    }
  }

  private async migrateRedditAccounts(userId: string, dryRun: boolean, _batchSize: number): Promise<void> {
    this.progress.currentCollection = 'Reddit Accounts';
    this.notifyProgress();

    try {
      const data = await AsyncStorage.getItem('firebase_reddit_accounts');
      if (data) {
        const accounts = JSON.parse(data);

        for (const account of accounts) {
          try {
            // Convert old format to new format
            const platformConnection = {
              userId,
              platform: 'reddit' as const,
              username: account.username,
              credentials: {
                accessToken: account.accessToken,
                refreshToken: account.refreshToken,
                expiresAt: account.expiresAt,
                scopes: account.scopes || [],
              },
              status: account.isActive ? 'connected' as const : 'disconnected' as const,
              isActive: account.isActive,
              createdAt: account.createdAt ? new Date(account.createdAt) : new Date(),
              lastUsed: account.lastUsed ? new Date(account.lastUsed) : new Date(),
            };

            if (!dryRun) {
              // PLATFORM_CONNECTIONS collection removed - migration no longer needed
              console.warn('Platform connections migration skipped - collection removed');
            }
            this.progress.migratedItems++;
          } catch (error) {
            console.error(`Failed to migrate Reddit account ${account.username}:`, error);
            this.progress.failedItems++;
            this.progress.errors.push({
              collection: 'reddit_accounts',
              key: account.username,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      this.notifyProgress();
    } catch (error) {
      console.error('Failed to migrate Reddit accounts:', error);
      throw error;
    }
  }

  /**
   * Create backup of AsyncStorage data
   */
  private async createBackup(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const backup: Record<string, string | null> = {};

      for (const key of keys) {
        backup[key] = await AsyncStorage.getItem(key);
      }

      const backupData = JSON.stringify(backup);
      const backupKey = `backup_${Date.now()}`;

      await AsyncStorage.setItem(backupKey, backupData);
      console.log(`Backup created with key: ${backupKey}`);
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw error;
    }
  }

  /**
   * Clean up AsyncStorage after successful migration
   */
  async cleanupAsyncStorage(confirm: boolean = false): Promise<void> {
    if (!confirm) {
      throw new Error('Cleanup confirmation required');
    }

    try {
      const keys = await AsyncStorage.getAllKeys();
      const keysToDelete = keys.filter(key =>
        key.startsWith('agent_') ||
        key.startsWith('lead_') ||
        key.startsWith('conv_') ||
        key.startsWith('inbox_') ||
        key.startsWith('action_') ||
        key === 'firebase_reddit_accounts',
      );

      for (const key of keysToDelete) {
        await AsyncStorage.removeItem(key);
      }

      console.log(`Cleaned up ${keysToDelete.length} AsyncStorage keys`);
    } catch (error) {
      console.error('Failed to cleanup AsyncStorage:', error);
      throw error;
    }
  }

  /**
   * Get current migration progress
   */
  getMigrationProgress(): MigrationProgress {
    return { ...this.progress };
  }
}

export default new DataMigrationService();