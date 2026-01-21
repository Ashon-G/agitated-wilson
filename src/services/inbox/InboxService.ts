/**
 * Inbox Service
 *
 * Handles core inbox item operations including CRUD, caching, and real-time updates.
 * Separated from AgentInboxService for better maintainability.
 *
 * @version 1.0.0
 * @author PaynaAI Team
 */

import BackendService from '../BackendService';
import { COLLECTIONS } from '../../config/firebase';
import {
  AgentInboxItem,
} from '../../types/agent';

interface InboxEvent {
  type: 'inbox_item_created' | 'inbox_item_answered' | 'inbox_item_resolved' | 'inbox_item_updated';
  inboxItem: AgentInboxItem;
  userId: string;
  userResponse?: string;
  shouldLearn?: boolean;
}

class InboxService {
  private inboxCache: Map<string, AgentInboxItem[]> = new Map();
  private listeners: Map<string, (event: InboxEvent) => void> = new Map();
  private realtimeListeners: Map<string, string> = new Map();

  /**
   * Create new inbox item for user attention
   */
  async createInboxItem(
    itemData: Omit<AgentInboxItem, 'id' | 'createdAt'>,
  ): Promise<AgentInboxItem> {
    try {
      const inboxItem: AgentInboxItem = {
        id: `inbox_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        ...itemData,
      };

      // Save to storage
      await this.saveInboxItem(inboxItem);

      // Update cache
      const userInbox = this.inboxCache.get(itemData.userId) || [];
      userInbox.unshift(inboxItem); // Add to beginning
      this.inboxCache.set(itemData.userId, userInbox);

      // Emit event for real-time updates
      this.emit('inbox_item_created', {
        inboxItem,
        userId: itemData.userId,
      });

      console.log(`Inbox item created: ${inboxItem.content.title}`);
      return inboxItem;
    } catch (error) {
      console.error('Failed to create inbox item:', error);
      throw error;
    }
  }

  /**
   * Get all inbox items for a user
   */
  async getUserInbox(userId: string, filters?: {
    status?: AgentInboxItem['status'];
    type?: AgentInboxItem['type'];
    priority?: AgentInboxItem['priority'];
    limit?: number;
  }): Promise<AgentInboxItem[]> {
    try {
      // Build query without orderBy to avoid index requirement
      const queryOptions: any = {
        where: [{ field: 'userId', operator: '==', value: userId }],
        limit: filters?.limit || 100,
      };

      // Add additional where clauses for filters
      if (filters?.status) {
        queryOptions.where.push({ field: 'status', operator: '==', value: filters.status });
      }
      if (filters?.type) {
        queryOptions.where.push({ field: 'type', operator: '==', value: filters.type });
      }
      if (filters?.priority) {
        queryOptions.where.push({ field: 'priority', operator: '==', value: filters.priority });
      }

      const items = await BackendService.queryDocuments<AgentInboxItem>(
        COLLECTIONS.AGENT_INBOX,
        queryOptions,
        {
          useCache: true,
          cacheKey: `user_inbox_${userId}_${JSON.stringify(filters || {})}`,
          cacheTTL: 30 * 1000, // Short cache for inbox items
        },
      );

      // Sort client-side by createdAt (desc)
      return items.sort((a, b) => {
        const getTime = (date: any) => {
          if (!date) return 0;
          if (date instanceof Date) return date.getTime();
          if (typeof date === 'object' && 'toMillis' in date) return date.toMillis();
          if (typeof date === 'string') return new Date(date).getTime();
          return 0;
        };
        return getTime(b.createdAt) - getTime(a.createdAt);
      });
    } catch (error) {
      console.error('Failed to get user inbox:', error);

      // Fallback to simplified query without filters
      return await this.getUserInboxFallback(userId, filters);
    }
  }

  /**
   * Fallback method for getting user inbox when composite indexes are not available
   */
  private async getUserInboxFallback(userId: string, filters?: {
    status?: AgentInboxItem['status'];
    type?: AgentInboxItem['type'];
    priority?: AgentInboxItem['priority'];
    limit?: number;
  }): Promise<AgentInboxItem[]> {
    try {
      const fallbackOptions: any = {
        where: [{ field: 'userId', operator: '==', value: userId }],
        limit: 200,
      };

      const allItems = await BackendService.queryDocuments<AgentInboxItem>(
        COLLECTIONS.AGENT_INBOX,
        fallbackOptions,
      );

      // Sort and filter client-side as fallback
      const sortedItems = [...allItems].sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

      let filteredItems = sortedItems;
      if (filters) {
        filteredItems = sortedItems.filter(item => {
          if (filters.status && item.status !== filters.status) return false;
          if (filters.type && item.type !== filters.type) return false;
          if (filters.priority && item.priority !== filters.priority) return false;
          return true;
        });
      }

      const limit = filters?.limit || 100;
      return filteredItems.slice(0, limit);
    } catch (fallbackError) {
      console.error('Fallback query also failed:', fallbackError);
      return [];
    }
  }

  /**
   * Get specific inbox item
   */
  async getInboxItem(itemId: string): Promise<AgentInboxItem | null> {
    try {
      return await BackendService.getDocument<AgentInboxItem>(
        COLLECTIONS.AGENT_INBOX,
        itemId,
        { useCache: true, cacheKey: `inbox_${itemId}`, cacheTTL: 2 * 60 * 1000 },
      );
    } catch (error) {
      console.error('Failed to get inbox item:', error);
      return null;
    }
  }

  /**
   * Update inbox item
   */
  async updateInboxItem(itemId: string, updates: Partial<AgentInboxItem>): Promise<void> {
    try {
      const item = await this.getInboxItem(itemId);
      if (!item) throw new Error('Inbox item not found');

      const updatedItem = { ...item, ...updates };
      await this.saveInboxItem(updatedItem);

      // Update cache
      this.updateItemInCache(updatedItem);

      // Emit event
      this.emit('inbox_item_updated', {
        inboxItem: updatedItem,
        userId: item.userId,
      });
    } catch (error) {
      console.error('Failed to update inbox item:', error);
      throw error;
    }
  }

  /**
   * Delete inbox item
   */
  async deleteInboxItem(itemId: string): Promise<void> {
    try {
      const item = await this.getInboxItem(itemId);
      if (!item) return;

      await BackendService.deleteDocument(COLLECTIONS.AGENT_INBOX, itemId);

      // Update cache
      const userInbox = this.inboxCache.get(item.userId);
      if (userInbox) {
        const filtered = userInbox.filter(i => i.id !== itemId);
        this.inboxCache.set(item.userId, filtered);
      }
    } catch (error) {
      console.error('Failed to delete inbox item:', error);
      throw error;
    }
  }

  /**
   * Mark inbox item as resolved
   */
  async markAsResolved(itemId: string, reason?: string): Promise<void> {
    try {
      const updates: Partial<AgentInboxItem> = {
        status: 'resolved',
        resolvedAt: new Date(),
      };

      await this.updateInboxItem(itemId, updates);

      if (reason) {
        console.log(`Inbox item ${itemId} resolved with reason: ${reason}`);
      }
    } catch (error) {
      console.error('Failed to mark inbox item as resolved:', error);
      throw error;
    }
  }

  /**
   * Subscribe to inbox events
   */
  onInboxEvent(callback: (event: InboxEvent) => void): () => void {
    const listenerId = `listener_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    this.listeners.set(listenerId, callback);

    return () => {
      this.listeners.delete(listenerId);
    };
  }

  /**
   * Setup real-time listener for user inbox
   */
  setupRealtimeListener(userId: string, callback: (items: AgentInboxItem[]) => void): string {
    try {
      // Remove orderBy to avoid composite index requirement
      // Sort client-side instead
      const listenerId = BackendService.setupListener<AgentInboxItem>(
        COLLECTIONS.AGENT_INBOX,
        {
          where: [{ field: 'userId', operator: '==', value: userId }],
          limit: 100,
        },
        (items: AgentInboxItem[]) => {
          // Sort client-side by createdAt (desc)
          const sortedItems = items.sort((a, b) => {
            const getTime = (date: any) => {
              if (!date) return 0;
              if (date instanceof Date) return date.getTime();
              if (typeof date === 'object' && 'toMillis' in date) return date.toMillis();
              if (typeof date === 'string') return new Date(date).getTime();
              return 0;
            };
            return getTime(b.createdAt) - getTime(a.createdAt);
          });
          callback(sortedItems);
        },
      );

      this.realtimeListeners.set(userId, listenerId);
      return listenerId;
    } catch (error) {
      console.error('Failed to setup real-time listener:', error);
      return '';
    }
  }

  /**
   * Remove real-time listener
   */
  removeRealtimeListener(userId: string): void {
    const listenerId = this.realtimeListeners.get(userId);
    if (listenerId) {
      BackendService.removeListener(listenerId);
      this.realtimeListeners.delete(userId);
    }
  }

  /**
   * Clear inbox cache for user
   */
  clearUserCache(userId: string): void {
    this.inboxCache.delete(userId);
  }

  /**
   * Clear all inbox cache
   */
  clearAllCache(): void {
    this.inboxCache.clear();
  }

  // Private helper methods

  private async saveInboxItem(item: AgentInboxItem): Promise<void> {
    await BackendService.setDocument(COLLECTIONS.AGENT_INBOX, item.id, item);
  }

  private updateItemInCache(updatedItem: AgentInboxItem): void {
    const userInbox = this.inboxCache.get(updatedItem.userId);
    if (userInbox) {
      const index = userInbox.findIndex(item => item.id === updatedItem.id);
      if (index !== -1) {
        userInbox[index] = updatedItem;
      } else {
        userInbox.unshift(updatedItem);
      }
    }
  }

  private emit(type: InboxEvent['type'], data: Omit<InboxEvent, 'type'>): void {
    const event: InboxEvent = { type, ...data };
    this.listeners.forEach(callback => callback(event));
  }
}

export default new InboxService();
