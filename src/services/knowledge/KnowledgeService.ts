/**
 * Knowledge Service
 *
 * Handles core knowledge item operations including CRUD, search, and retrieval.
 * Uses hierarchical structure under users/{userId}/knowledge/
 *
 * @version 2.0.0
 * @author PaynaAI Team
 */

import BackendService from '../BackendService';
import { KnowledgeItem, ConversationContext, ConversationMessage } from '../../types/agent';
import CategoryService from './CategoryService';

class KnowledgeService {
  private knowledgeCache: Map<string, KnowledgeItem[]> = new Map();

  /**
   * Add new knowledge item to user's private knowledge base
   * Now uses hierarchical structure: users/{userId}/knowledge/
   */
  async addKnowledgeItem(
    userId: string,
    agentId: string,
    knowledgeData: Omit<
      KnowledgeItem,
      'id' | 'userId' | 'agentId' | 'timestamps' | 'usage' | 'version'
    >,
  ): Promise<KnowledgeItem> {
    try {
      const knowledgeItem: KnowledgeItem = {
        id: `kb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        agentId,
        ...knowledgeData,
        usage: {
          timesUsed: 0,
          lastUsed: new Date(),
          effectiveness: 0,
        },
        version: 1,
        timestamps: {
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      // Ensure category exists
      if (knowledgeItem.categoryId) {
        const category = await CategoryService.getCategory(userId, knowledgeItem.categoryId);
        if (category) {
          await CategoryService.incrementCategoryItemCount(userId, knowledgeItem.categoryId);
        }
      }

      // Save to storage (new hierarchical structure)
      await this.saveKnowledgeItem(userId, knowledgeItem);

      // Update cache
      const userKnowledge = this.knowledgeCache.get(userId) || [];
      userKnowledge.push(knowledgeItem);
      this.knowledgeCache.set(userId, userKnowledge);

      console.log(`Knowledge item added: ${knowledgeItem.content.title}`);
      return knowledgeItem;
    } catch (error) {
      console.error('Failed to add knowledge item:', error);
      throw error;
    }
  }

  /**
   * Get all knowledge for a user
   * Supports both new hierarchical structure and legacy flat structure
   */
  async getUserKnowledge(userId: string): Promise<KnowledgeItem[]> {
    try {
      // Check cache first
      const cached = this.knowledgeCache.get(userId);
      if (cached) {
        return cached;
      }

      // Load from hierarchical structure: users/{userId}/knowledge
      const knowledge = await this.loadUserKnowledgeNew(userId);

      this.knowledgeCache.set(userId, knowledge);

      return knowledge;
    } catch (error) {
      console.error('Failed to get user knowledge:', error);

      // Check if this is a Firestore index error
      if (error instanceof Error && error.message.includes('index')) {
        console.error(
          'Firestore index required. Please create the composite index in Firebase Console.',
        );
        console.error('Collection: users/{userId}/knowledge');
        console.error('Fields: timestamps.createdAt (Descending)');
      }

      return [];
    }
  }

  /**
   * Get a specific knowledge item by ID
   * Uses hierarchical structure: users/{userId}/knowledge/{itemId}
   */
  async getKnowledgeItem(knowledgeId: string, userId?: string): Promise<KnowledgeItem | null> {
    try {
      // Require userId for the new structure
      if (!userId) {
        console.warn('getKnowledgeItem: userId is required for knowledge lookup');
        return null;
      }

      const path = `users/${userId}/knowledge`;
      return await BackendService.getDocument<KnowledgeItem>(path, knowledgeId);
    } catch {
      return null;
    }
  }

  /**
   * Update knowledge item
   */
  async updateKnowledgeItem(knowledgeId: string, updates: Partial<KnowledgeItem>, userId?: string): Promise<void> {
    try {
      const item = await this.getKnowledgeItem(knowledgeId, userId);
      if (!item) throw new Error('Knowledge item not found');

      // Create new version if content changed
      if (updates.content) {
        updates.version = (item.version || 1) + 1;
        updates.parentId = item.id;
      }

      // Update timestamps
      updates.timestamps = {
        ...item.timestamps,
        updatedAt: new Date(),
      };

      const updatedItem = { ...item, ...updates };
      await this.saveKnowledgeItem(item.userId, updatedItem);

      // Update cache
      const userKnowledge = this.knowledgeCache.get(item.userId);
      if (userKnowledge) {
        const index = userKnowledge.findIndex(k => k.id === knowledgeId);
        if (index !== -1) {
          userKnowledge[index] = updatedItem;
        }
      }
    } catch (error) {
      console.error('Failed to update knowledge item:', error);
      throw error;
    }
  }

  /**
   * Delete knowledge item
   */
  async deleteKnowledgeItem(knowledgeId: string, userId?: string): Promise<void> {
    try {
      const item = await this.getKnowledgeItem(knowledgeId, userId);
      if (!item) return;

      // Decrement category item count
      if (item.categoryId) {
        await CategoryService.decrementCategoryItemCount(item.userId, item.categoryId);
      }

      // Delete from hierarchical structure
      const effectiveUserId = userId || item.userId;
      const path = `users/${effectiveUserId}/knowledge`;
      await BackendService.deleteDocument(path, knowledgeId);

      // Update cache
      const userKnowledge = this.knowledgeCache.get(item.userId);
      if (userKnowledge) {
        const filtered = userKnowledge.filter(k => k.id !== knowledgeId);
        this.knowledgeCache.set(item.userId, filtered);
      }
    } catch (error) {
      console.error('Failed to delete knowledge item:', error);
      throw error;
    }
  }

  /**
   * Update knowledge usage statistics
   */
  async updateKnowledgeUsage(knowledgeId: string, userId?: string): Promise<void> {
    try {
      const item = await this.getKnowledgeItem(knowledgeId, userId);
      if (!item) return;

      await this.updateKnowledgeItem(knowledgeId, {
        usage: {
          ...item.usage,
          timesUsed: item.usage.timesUsed + 1,
          lastUsed: new Date(),
        },
      }, item.userId);
    } catch (error) {
      console.error('Failed to update knowledge usage:', error);
    }
  }

  /**
   * Mark knowledge as validated/effective
   */
  async markKnowledgeEffective(knowledgeId: string, effectiveness: number, userId?: string): Promise<void> {
    try {
      const item = await this.getKnowledgeItem(knowledgeId, userId);
      if (!item) return;

      const newEffectiveness = (item.usage.effectiveness + effectiveness) / 2;

      await this.updateKnowledgeItem(knowledgeId, {
        usage: {
          ...item.usage,
          effectiveness: newEffectiveness,
          lastUsed: new Date(),
        },
        confidence: Math.min(item.confidence + 0.1, 1.0), // Increase confidence
      }, item.userId);
    } catch (error) {
      console.error('Failed to mark knowledge effective:', error);
    }
  }

  /**
   * Save knowledge item to storage
   * Uses hierarchical structure: users/{userId}/knowledge/{itemId}
   */
  private async saveKnowledgeItem(userId: string, item: KnowledgeItem): Promise<void> {
    const path = `users/${userId}/knowledge`;
    await BackendService.setDocument(path, item.id, item);
  }

  /**
   * Load user knowledge from hierarchical structure
   */
  private async loadUserKnowledgeNew(userId: string): Promise<KnowledgeItem[]> {
    try {
      const path = `users/${userId}/knowledge`;
      const items = await BackendService.queryCollection<KnowledgeItem>(path, {});

      // Sort client-side by createdAt timestamp
      return this.sortByCreatedAt(items);
    } catch (error) {
      console.error('Failed to load user knowledge:', error);
      return [];
    }
  }

  /**
   * Legacy loader - now just returns empty array
   * Kept for backward compatibility during migration
   */
  private async loadUserKnowledgeLegacy(_userId: string): Promise<KnowledgeItem[]> {
    // Legacy collection removed - return empty array
    return [];
  }

  /**
   * Sort items by createdAt timestamp (newest first)
   * Handles both Date objects and Firestore Timestamp objects
   */
  private sortByCreatedAt(items: KnowledgeItem[]): KnowledgeItem[] {
    return items.sort((a, b) => {
      let aTime = 0;
      let bTime = 0;

      if (a.timestamps?.createdAt) {
        if (typeof a.timestamps.createdAt === 'object' && 'toMillis' in a.timestamps.createdAt) {
          // Firestore Timestamp
          aTime = (a.timestamps.createdAt as any).toMillis();
        } else if (a.timestamps.createdAt instanceof Date) {
          aTime = a.timestamps.createdAt.getTime();
        }
      }

      if (b.timestamps?.createdAt) {
        if (typeof b.timestamps.createdAt === 'object' && 'toMillis' in b.timestamps.createdAt) {
          // Firestore Timestamp
          bTime = (b.timestamps.createdAt as any).toMillis();
        } else if (b.timestamps.createdAt instanceof Date) {
          bTime = b.timestamps.createdAt.getTime();
        }
      }

      return bTime - aTime; // desc order
    });
  }

  /**
   * Clear knowledge cache for user
   */
  clearUserCache(userId: string): void {
    this.knowledgeCache.delete(userId);
  }

  /**
   * Clear all knowledge cache
   */
  clearAllCache(): void {
    this.knowledgeCache.clear();
  }
}

export default new KnowledgeService();
