/**
 * Cache Service
 * Handles caching strategy with AsyncStorage fallback for offline support
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheItem {
  data: any;
  timestamp: number;
  ttl: number;
}

class CacheService {
  private memoryCache = new Map<string, CacheItem>();

  /**
   * Get data from cache (memory first, then AsyncStorage)
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Check memory cache first
      const memoryItem = this.memoryCache.get(key);
      if (memoryItem && this.isValid(memoryItem)) {
        return memoryItem.data as T;
      }

      // Check AsyncStorage
      const asyncData = await AsyncStorage.getItem(`cache_${key}`);
      if (asyncData) {
        const parsed: CacheItem = JSON.parse(asyncData);
        if (this.isValid(parsed)) {
          // Restore to memory cache
          this.memoryCache.set(key, parsed);
          return parsed.data as T;
        } else {
          // Clean up expired data
          await AsyncStorage.removeItem(`cache_${key}`);
        }
      }

      return null;
    } catch (error) {
      console.warn('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set data in cache (both memory and AsyncStorage)
   */
  async set(key: string, data: any, ttl: number = 300000): Promise<void> {
    try {
      const cacheItem: CacheItem = {
        data,
        timestamp: Date.now(),
        ttl,
      };

      // Set in memory
      this.memoryCache.set(key, cacheItem);

      // Set in AsyncStorage for persistence
      await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(cacheItem));
    } catch (error) {
      console.warn('Cache set error:', error);
    }
  }

  /**
   * Remove data from cache
   */
  async remove(key: string): Promise<void> {
    try {
      this.memoryCache.delete(key);
      await AsyncStorage.removeItem(`cache_${key}`);
    } catch (error) {
      console.warn('Cache remove error:', error);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      this.memoryCache.clear();

      // Clear AsyncStorage cache items
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.warn('Cache clear error:', error);
    }
  }

  /**
   * Get or set pattern - if data exists in cache, return it, otherwise fetch and cache
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 300000,
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Fetch fresh data
      const data = await fetcher();

      // Cache the result
      await this.set(key, data, ttl);

      return data;
    } catch (error) {
      console.warn('Cache getOrSet error:', error);
      // Fall back to fetcher
      return await fetcher();
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // Invalidate memory cache
      for (const key of this.memoryCache.keys()) {
        if (key.includes(pattern)) {
          this.memoryCache.delete(key);
        }
      }

      // Invalidate AsyncStorage
      const keys = await AsyncStorage.getAllKeys();
      const matchingKeys = keys.filter(key =>
        key.startsWith('cache_') && key.includes(pattern),
      );
      if (matchingKeys.length > 0) {
        await AsyncStorage.multiRemove(matchingKeys);
      }
    } catch (error) {
      console.warn('Cache invalidate pattern error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    memoryCount: number;
    memorySize: string;
    } {
    const memoryCount = this.memoryCache.size;
    const memorySize = `${Math.round(JSON.stringify(Array.from(this.memoryCache.entries())).length / 1024)}KB`;

    return {
      memoryCount,
      memorySize,
    };
  }

  /**
   * Preload critical data for user
   */
  async preloadUserData(userId: string): Promise<void> {
    try {
      // Preload common cache keys for the user
      const commonKeys = [
        `agent_${userId}`,
        `user_inbox_${userId}_{}`,
        `platform_configs_${userId}`,
        `conversations_${userId}`,
      ];

      // Just ensure keys exist in AsyncStorage cache for quick access
      for (const key of commonKeys) {
        const exists = await AsyncStorage.getItem(`cache_${key}`);
        if (exists) {
          // Load into memory if not already there
          if (!this.memoryCache.has(key)) {
            const parsed: CacheItem = JSON.parse(exists);
            if (this.isValid(parsed)) {
              this.memoryCache.set(key, parsed);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Preload user data error:', error);
    }
  }

  /**
   * Clean up expired cache items
   */
  async cleanup(): Promise<void> {
    try {
      // Clean memory cache
      for (const [key, item] of this.memoryCache.entries()) {
        if (!this.isValid(item)) {
          this.memoryCache.delete(key);
        }
      }

      // Clean AsyncStorage cache
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));

      for (const key of cacheKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const parsed: CacheItem = JSON.parse(data);
          if (!this.isValid(parsed)) {
            await AsyncStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.warn('Cache cleanup error:', error);
    }
  }

  /**
   * Aggressive storage cleanup - clears all non-critical data to free space
   * Call this when storage is running low
   */
  async aggressiveCleanup(): Promise<number> {
    let clearedCount = 0;
    try {
      // Clear all memory cache
      this.memoryCache.clear();

      // Get all AsyncStorage keys
      const keys = await AsyncStorage.getAllKeys();
      console.log(`🧹 Aggressive cleanup: Found ${keys.length} total keys in AsyncStorage`);

      // Keys to preserve (critical for app function)
      const preservePatterns = [
        'firebase:', // Firebase Auth internal storage
        '@firebase', // Firebase internal
        'persist:', // Zustand persist (but we should clear old ones)
      ];

      // Keys to always remove (safe to delete)
      const removePatterns = [
        'cache_', // Our cache items
        'activity_', // Activity cache
        'lead_', // Lead cache
        'pipeline_', // Pipeline cache
        'box_tokens', // Box OAuth tokens (can re-auth)
      ];

      const keysToRemove: string[] = [];

      for (const key of keys) {
        // Skip Firebase internal storage
        const shouldPreserve = preservePatterns.some(pattern => key.includes(pattern));
        if (shouldPreserve) {
          continue;
        }

        // Remove if matches remove patterns
        const shouldRemove = removePatterns.some(pattern => key.includes(pattern));
        if (shouldRemove) {
          keysToRemove.push(key);
        }
      }

      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        clearedCount = keysToRemove.length;
        console.log(`🧹 Aggressive cleanup: Removed ${clearedCount} keys`);
      }
    } catch (error) {
      console.warn('Aggressive cleanup error:', error);
    }
    return clearedCount;
  }

  private isValid(item: CacheItem): boolean {
    return Date.now() - item.timestamp < item.ttl;
  }
}

export default new CacheService();