/**
 * Cache Service Re-export
 *
 * Re-exports the main CacheService for backward compatibility.
 * The actual implementation is in src/services/CacheService.ts
 *
 * @deprecated Import directly from '../CacheService' instead
 */

import CacheService from '../CacheService';

// Re-export with method name aliases for backward compatibility
export default {
  setCache: CacheService.set.bind(CacheService),
  getCache: CacheService.get.bind(CacheService),
  invalidateCache: CacheService.remove.bind(CacheService),
  clearAllCache: CacheService.clear.bind(CacheService),
  isCacheValid: (key: string) => CacheService.get(key).then(v => v !== null),
  getCacheStats: () => ({
    memoryItems: CacheService.getCacheStats().memoryCount,
    memorySize: parseInt(CacheService.getCacheStats().memorySize) * 1024,
  }),
};
