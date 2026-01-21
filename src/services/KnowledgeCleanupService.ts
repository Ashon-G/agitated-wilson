/**
 * Knowledge Cleanup Service
 *
 * Handles cleanup of duplicate and invalid knowledge items.
 * This service provides utilities to:
 * - Find and remove duplicate knowledge items
 * - Remove items with undefined/invalid titles
 * - Fix data integrity issues
 *
 * @version 1.0.0
 */

import BackendService from './BackendService';
import AuthenticationService from './AuthenticationService';
import { KnowledgeItem } from '../types/app';

interface CleanupResult {
  totalItems: number;
  duplicatesRemoved: number;
  invalidItemsRemoved: number;
  errors: string[];
}

class KnowledgeCleanupService {
  /**
   * Clean up all duplicate and invalid knowledge items for the current user
   */
  async cleanupUserKnowledge(): Promise<CleanupResult> {
    const user = AuthenticationService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    return this.cleanupKnowledgeForUser(user.uid);
  }

  /**
   * Clean up duplicate and invalid knowledge items for a specific user
   */
  async cleanupKnowledgeForUser(userId: string): Promise<CleanupResult> {
    const result: CleanupResult = {
      totalItems: 0,
      duplicatesRemoved: 0,
      invalidItemsRemoved: 0,
      errors: [],
    };

    try {
      const knowledgePath = `users/${userId}/knowledge`;

      // Load all knowledge items
      console.log(`🧹 Starting knowledge cleanup for user ${userId}...`);
      const allItems = await BackendService.queryCollection<KnowledgeItem>(knowledgePath, {});
      result.totalItems = allItems.length;
      console.log(`📊 Found ${allItems.length} total knowledge items`);

      // Track items by title+content hash for deduplication
      const seenItems = new Map<string, KnowledgeItem>();
      const itemsToDelete: string[] = [];

      for (const item of allItems) {
        // Check for invalid items (no title or undefined title)
        if (!item.title || item.title === 'undefined' || item.title.trim() === '') {
          console.log(`🗑️ Marking invalid item for deletion: ${item.id} (no title)`);
          itemsToDelete.push(item.id);
          result.invalidItemsRemoved++;
          continue;
        }

        // Create a hash key based on title and content for deduplication
        const contentKey = this.createContentKey(item);

        if (seenItems.has(contentKey)) {
          // This is a duplicate - keep the older one (first seen)
          const existingItem = seenItems.get(contentKey)!;
          const existingDate = this.getCreatedAtTime(existingItem);
          const currentDate = this.getCreatedAtTime(item);

          if (currentDate > existingDate) {
            // Current item is newer, delete it
            console.log(`🔄 Marking duplicate for deletion: "${item.title}" (keeping older item)`);
            itemsToDelete.push(item.id);
            result.duplicatesRemoved++;
          } else {
            // Existing item is newer, delete existing and keep current
            console.log(`🔄 Marking duplicate for deletion: "${existingItem.title}" (keeping older item)`);
            itemsToDelete.push(existingItem.id);
            seenItems.set(contentKey, item);
            result.duplicatesRemoved++;
          }
        } else {
          seenItems.set(contentKey, item);
        }
      }

      // Delete all marked items
      console.log(`🗑️ Deleting ${itemsToDelete.length} items...`);

      // Delete in batches to avoid overwhelming Firestore
      const batchSize = 50;
      for (let i = 0; i < itemsToDelete.length; i += batchSize) {
        const batch = itemsToDelete.slice(i, i + batchSize);
        const deletePromises = batch.map(async itemId => {
          try {
            await BackendService.deleteDocument(knowledgePath, itemId);
            return { success: true, id: itemId };
          } catch (error) {
            const errorMsg = `Failed to delete item ${itemId}: ${error}`;
            console.error(errorMsg);
            result.errors.push(errorMsg);
            return { success: false, id: itemId };
          }
        });

        await Promise.all(deletePromises);
        console.log(`✅ Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(itemsToDelete.length / batchSize)}`);
      }

      console.log('🎉 Cleanup complete!');
      console.log(`   - Total items processed: ${result.totalItems}`);
      console.log(`   - Duplicates removed: ${result.duplicatesRemoved}`);
      console.log(`   - Invalid items removed: ${result.invalidItemsRemoved}`);
      console.log(`   - Remaining items: ${result.totalItems - result.duplicatesRemoved - result.invalidItemsRemoved}`);
      console.log(`   - Errors: ${result.errors.length}`);

      return result;
    } catch (error) {
      console.error('Knowledge cleanup failed:', error);
      result.errors.push(`Cleanup failed: ${error}`);
      return result;
    }
  }

  /**
   * Create a content key for deduplication
   * Uses title + content (if available) to identify duplicates
   */
  private createContentKey(item: KnowledgeItem): string {
    const title = (item.title || '').toLowerCase().trim();
    const content = (item.content || '').toLowerCase().trim();
    const type = item.type || 'unknown';

    // For items with the same title and content, they're duplicates
    return `${type}:${title}:${content}`;
  }

  /**
   * Get the created at timestamp as a number
   */
  private getCreatedAtTime(item: KnowledgeItem): number {
    if (!item.createdAt) return 0;

    // Handle Firestore Timestamp
    if (typeof item.createdAt === 'object' && 'toMillis' in item.createdAt) {
      return (item.createdAt as unknown as { toMillis: () => number }).toMillis();
    }

    // Handle Date object
    if (item.createdAt instanceof Date) {
      return item.createdAt.getTime();
    }

    // Handle string date
    if (typeof item.createdAt === 'string') {
      return new Date(item.createdAt).getTime();
    }

    return 0;
  }

  /**
   * Get statistics about knowledge items without cleanup
   */
  async getCleanupStats(): Promise<{
    totalItems: number;
    duplicates: number;
    invalidItems: number;
    uniqueItems: number;
  }> {
    const user = AuthenticationService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const knowledgePath = `users/${user.uid}/knowledge`;
    const allItems = await BackendService.queryCollection<KnowledgeItem>(knowledgePath, {});

    const seenItems = new Set<string>();
    let duplicates = 0;
    let invalidItems = 0;

    for (const item of allItems) {
      if (!item.title || item.title === 'undefined' || item.title.trim() === '') {
        invalidItems++;
        continue;
      }

      const contentKey = this.createContentKey(item);
      if (seenItems.has(contentKey)) {
        duplicates++;
      } else {
        seenItems.add(contentKey);
      }
    }

    return {
      totalItems: allItems.length,
      duplicates,
      invalidItems,
      uniqueItems: allItems.length - duplicates - invalidItems,
    };
  }
}

export default new KnowledgeCleanupService();
