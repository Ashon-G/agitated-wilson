/**
 * Backend Service Layer
 *
 * Main backend service that orchestrates Firestore operations.
 * Uses smaller, focused services for better maintainability and separation of concerns.
 *
 * @version 2.0.0
 * @author PaynaAI Team
 */

import DocumentService from './backend/DocumentService';
import QueryService, { QueryOptions } from './backend/QueryService';
import CacheService from './backend/CacheService';
import BatchService, { BatchOperation } from './backend/BatchService';

interface CacheOptions {
  useCache?: boolean;
  cacheKey?: string;
  cacheTTL?: number;
}

class BackendService {
  async initialize(): Promise<void> {
    try {
      console.log('✅ Backend service initialized successfully');
    } catch (error) {
      console.warn('⚠️ Backend service initialization error:', error);
    }
  }

  async createDocument<T>(
    collectionName: string,
    data: Omit<T, 'id'> & { userId: string },
    options: CacheOptions = {},
  ): Promise<T> {
    const result = await DocumentService.createDocument<T>(collectionName, data);

    if (options.useCache && options.cacheKey) {
      await CacheService.setCache(options.cacheKey, result, options.cacheTTL);
    }

    return result;
  }

  async setDocument<T>(
    collectionName: string,
    documentId: string,
    data: Omit<T, 'id'>,
    options: CacheOptions = {},
  ): Promise<T> {
    const result = await DocumentService.setDocument<T>(collectionName, documentId, data);

    if (options.useCache && options.cacheKey) {
      await CacheService.setCache(options.cacheKey, result, options.cacheTTL);
    }

    return result;
  }

  async getDocument<T>(
    collectionName: string,
    documentId: string,
    options: CacheOptions = {},
  ): Promise<T | null> {
    if (options.useCache && options.cacheKey) {
      const cached = await CacheService.getCache(options.cacheKey);
      if (cached) return cached as T;
    }

    const result = await DocumentService.getDocument<T>(collectionName, documentId);

    if (result && options.useCache && options.cacheKey) {
      await CacheService.setCache(options.cacheKey, result, options.cacheTTL);
    }

    return result;
  }

  async updateDocument<T>(
    collectionName: string,
    documentId: string,
    data: Partial<T>,
    options: CacheOptions = {},
  ): Promise<void> {
    await DocumentService.updateDocument<T>(collectionName, documentId, data);

    if (options.useCache && options.cacheKey) {
      await CacheService.invalidateCache(options.cacheKey);
    }
  }

  async mergeDocument<T>(
    collectionName: string,
    documentId: string,
    data: Partial<T>,
    options: CacheOptions = {},
  ): Promise<void> {
    await DocumentService.mergeDocument<T>(collectionName, documentId, data);

    if (options.useCache && options.cacheKey) {
      await CacheService.invalidateCache(options.cacheKey);
    }
  }

  async deleteDocument(
    collectionName: string,
    documentId: string,
    options: CacheOptions = {},
  ): Promise<void> {
    await DocumentService.deleteDocument(collectionName, documentId);

    if (options.useCache && options.cacheKey) {
      await CacheService.invalidateCache(options.cacheKey);
    }
  }

  async queryCollection<T>(
    collectionName: string,
    options: QueryOptions & CacheOptions = {},
  ): Promise<T[]> {
    if (options.useCache && options.cacheKey) {
      const cached = await CacheService.getCache(options.cacheKey);
      if (cached) return cached as T[];
    }

    const results = await QueryService.queryCollection<T>(collectionName, options);

    if (options.useCache && options.cacheKey) {
      await CacheService.setCache(options.cacheKey, results, options.cacheTTL);
    }

    return results;
  }


  // Additional methods for legacy compatibility and enhanced functionality

  /**
   * Legacy method alias for queryCollection - used by existing services
   */
  async queryDocuments<T>(
    collectionName: string,
    options: QueryOptions & CacheOptions = {},
    cacheOptions?: CacheOptions,
  ): Promise<T[]> {
    // Merge cache options for backwards compatibility
    const mergedOptions = {
      ...options,
      ...(cacheOptions ? {
        useCache: cacheOptions.useCache,
        cacheKey: cacheOptions.cacheKey,
        cacheTTL: cacheOptions.cacheTTL,
      } : {}),
    };
    return this.queryCollection<T>(collectionName, mergedOptions);
  }

  /**
   * Setup real-time listener for collection changes
   */
  setupListener<T>(
    collectionName: string,
    options: QueryOptions,
    callback: (data: T[]) => void,
  ): string {
    return QueryService.setupListener<T>(collectionName, options, callback);
  }

  /**
   * Remove real-time listener
   */
  removeListener(listenerId: string): void {
    QueryService.removeListener(listenerId);
  }

  /**
   * Batch operations for multiple document operations
   */
  async batchOperation(operations: BatchOperation[]): Promise<void> {
    return BatchService.batchOperation(operations);
  }

  /**
   * Enhanced caching with AsyncStorage fallback for offline support
   */
  async getCachedData<T>(key: string): Promise<T | null> {
    return await CacheService.getCache(key) as T | null;
  }

  /**
   * Set cache with AsyncStorage persistence
   */
  async setCachedData(key: string, data: any, ttl: number = 300000): Promise<void> {
    await CacheService.setCache(key, data, ttl);
  }

  /**
   * Clean up all listeners and cache
   */
  dispose(): void {
    QueryService.dispose();
    CacheService.clearAllCache();
  }
}

export default new BackendService();