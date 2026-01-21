/**
 * Offline Service
 * Manages offline capabilities and data synchronization
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BackendService from './BackendService';
import AuthenticationService from './AuthenticationService';

interface OfflineOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  collection: string;
  documentId?: string;
  data?: any;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

interface OfflineState {
  isOnline: boolean;
  pendingOperations: number;
  lastSyncTime: number;
  syncInProgress: boolean;
}

class OfflineService {
  private isOnline: boolean = true;
  private pendingOperations: OfflineOperation[] = [];
  private syncInProgress: boolean = false;
  private listeners: Array<(state: OfflineState) => void> = [];
  private netInfoUnsubscribe?: () => void;

  private readonly STORAGE_KEY = 'offline_operations';
  private readonly MAX_RETRY_COUNT = 3;
  private readonly SYNC_INTERVAL = 30000; // 30 seconds
  private syncTimer?: NodeJS.Timeout;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Load pending operations from storage
      await this.loadPendingOperations();

      // Set up network monitoring
      this.setupNetworkMonitoring();

      // Start periodic sync
      this.startPeriodicSync();

      console.log('✅ OfflineService initialized');
    } catch (error) {
      console.error('❌ Failed to initialize OfflineService:', error);
    }
  }

  private setupNetworkMonitoring(): void {
    this.netInfoUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected === true;

      console.log(`Network status changed: ${this.isOnline ? 'Online' : 'Offline'}`);

      // If we just came back online, trigger sync
      if (!wasOnline && this.isOnline) {
        this.syncPendingOperations();
      }

      this.notifyListeners();
    });
  }

  private startPeriodicSync(): void {
    this.syncTimer = setInterval(() => {
      if (this.isOnline && this.pendingOperations.length > 0) {
        this.syncPendingOperations();
      }
    }, this.SYNC_INTERVAL);
  }

  private async loadPendingOperations(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.pendingOperations = JSON.parse(stored);
        console.log(`Loaded ${this.pendingOperations.length} pending operations`);
      }
    } catch (error) {
      console.error('Failed to load pending operations:', error);
      this.pendingOperations = [];
    }
  }

  private async savePendingOperations(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.pendingOperations));
    } catch (error) {
      console.error('Failed to save pending operations:', error);
    }
  }

  /**
   * Add offline operation to queue
   */
  async queueOperation(
    type: 'create' | 'update' | 'delete',
    collection: string,
    data?: any,
    documentId?: string,
  ): Promise<string> {
    const operation: OfflineOperation = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type,
      collection,
      documentId,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.pendingOperations.push(operation);
    await this.savePendingOperations();

    // Try to sync immediately if online
    if (this.isOnline) {
      this.syncPendingOperations();
    }

    this.notifyListeners();
    return operation.id;
  }

  /**
   * Sync all pending operations to Firestore
   */
  async syncPendingOperations(): Promise<void> {
    if (this.syncInProgress || !this.isOnline || this.pendingOperations.length === 0) {
      return;
    }

    this.syncInProgress = true;
    this.notifyListeners();

    try {
      const currentUser = AuthenticationService.getCurrentUser();
      if (!currentUser) {
        console.warn('Cannot sync: User not authenticated');
        return;
      }

      console.log(`Syncing ${this.pendingOperations.length} pending operations...`);

      const operationsToRemove: string[] = [];

      for (const operation of this.pendingOperations) {
        try {
          await this.executeOperation(operation, currentUser.uid);
          operationsToRemove.push(operation.id);
          console.log(`Synced operation: ${operation.type} ${operation.collection}`);
        } catch (error) {
          operation.retryCount++;
          operation.lastError = error instanceof Error ? error.message : 'Unknown error';

          // Remove operations that have exceeded retry limit
          if (operation.retryCount >= this.MAX_RETRY_COUNT) {
            console.error(`Operation ${operation.id} failed after ${this.MAX_RETRY_COUNT} retries, removing:`, error);
            operationsToRemove.push(operation.id);
          } else {
            console.warn(`Operation ${operation.id} failed (attempt ${operation.retryCount}/${this.MAX_RETRY_COUNT}):`, error);
          }
        }
      }

      // Remove completed/failed operations
      this.pendingOperations = this.pendingOperations.filter(
        op => !operationsToRemove.includes(op.id),
      );

      await this.savePendingOperations();

      console.log(`Sync completed. ${operationsToRemove.length} operations processed, ${this.pendingOperations.length} remaining`);
    } catch (error) {
      console.error('Failed to sync pending operations:', error);
    } finally {
      this.syncInProgress = false;
      this.notifyListeners();
    }
  }

  private async executeOperation(operation: OfflineOperation, userId: string): Promise<void> {
    switch (operation.type) {
      case 'create':
        if (operation.data) {
          // Ensure userId is set
          operation.data.userId = userId;
          await BackendService.createDocument(operation.collection, operation.data);
        }
        break;

      case 'update':
        if (operation.documentId && operation.data) {
          await BackendService.updateDocument(operation.collection, operation.documentId, operation.data);
        }
        break;

      case 'delete':
        if (operation.documentId) {
          await BackendService.deleteDocument(operation.collection, operation.documentId);
        }
        break;

      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * Get current offline state
   */
  getOfflineState(): OfflineState {
    return {
      isOnline: this.isOnline,
      pendingOperations: this.pendingOperations.length,
      lastSyncTime: this.getLastSyncTime(),
      syncInProgress: this.syncInProgress,
    };
  }

  private getLastSyncTime(): number {
    // Find the most recent successfully synced operation
    const completedOperations = this.pendingOperations.filter(op => op.retryCount === 0);
    if (completedOperations.length === 0) return 0;

    return Math.max(...completedOperations.map(op => op.timestamp));
  }

  /**
   * Force sync now
   */
  async forceSyncNow(): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    await this.syncPendingOperations();
  }

  /**
   * Clear all pending operations (use with caution)
   */
  async clearPendingOperations(): Promise<void> {
    this.pendingOperations = [];
    await AsyncStorage.removeItem(this.STORAGE_KEY);
    this.notifyListeners();
  }

  /**
   * Get pending operations for debugging
   */
  getPendingOperations(): OfflineOperation[] {
    return [...this.pendingOperations];
  }

  /**
   * Add offline state listener
   */
  addStateListener(listener: (state: OfflineState) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove offline state listener
   */
  removeStateListener(listener: (state: OfflineState) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(): void {
    const state = this.getOfflineState();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Offline state listener error:', error);
      }
    });
  }

  /**
   * Check if device is currently online
   */
  isDeviceOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Enable/disable automatic sync
   */
  setAutoSyncEnabled(enabled: boolean): void {
    if (enabled) {
      if (!this.syncTimer) {
        this.startPeriodicSync();
      }
    } else {
      if (this.syncTimer) {
        clearInterval(this.syncTimer);
        this.syncTimer = undefined;
      }
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Stop network monitoring
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
    }

    // Stop periodic sync
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    // Clear listeners
    this.listeners = [];

    console.log('OfflineService disposed');
  }
}

export default new OfflineService();