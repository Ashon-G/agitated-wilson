/**
 * Storage Cleanup Utilities
 * Tools to diagnose and clean up problematic AsyncStorage entries
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export class StorageCleanup {
  /**
   * Diagnose AsyncStorage for problematic entries
   */
  static async diagnoseStorage(): Promise<{
    totalKeys: number;
    largeEntries: Array<{ key: string; size: number }>;
    corruptedEntries: string[];
    totalSize: number;
  }> {
    const result = {
      totalKeys: 0,
      largeEntries: [] as Array<{ key: string; size: number }>,
      corruptedEntries: [] as string[],
      totalSize: 0,
    };

    try {
      const keys = await AsyncStorage.getAllKeys();
      result.totalKeys = keys.length;

      for (const key of keys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const size = data.length;
            result.totalSize += size;

            // Flag entries larger than 1MB
            if (size > 1024 * 1024) {
              result.largeEntries.push({ key, size });
            }
          }
        } catch (error) {
          console.warn(`Corrupted entry detected: ${key}`, error);
          result.corruptedEntries.push(key);
        }
      }

      // Sort large entries by size
      result.largeEntries.sort((a, b) => b.size - a.size);
    } catch (error) {
      console.error('Failed to diagnose storage:', error);
    }

    return result;
  }

  /**
   * Clean up corrupted entries
   */
  static async cleanupCorruptedEntries(): Promise<number> {
    let cleanedCount = 0;

    try {
      const diagnosis = await this.diagnoseStorage();

      for (const key of diagnosis.corruptedEntries) {
        try {
          await AsyncStorage.removeItem(key);
          cleanedCount++;
          console.log(`Cleaned up corrupted entry: ${key}`);
        } catch (error) {
          console.warn(`Failed to clean up ${key}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup corrupted entries:', error);
    }

    return cleanedCount;
  }

  /**
   * Remove extremely large entries that might cause issues
   */
  static async cleanupLargeEntries(maxSize: number = 10 * 1024 * 1024): Promise<number> {
    let cleanedCount = 0;

    try {
      const diagnosis = await this.diagnoseStorage();

      for (const entry of diagnosis.largeEntries) {
        if (entry.size > maxSize) {
          try {
            await AsyncStorage.removeItem(entry.key);
            cleanedCount++;
            console.log(`Cleaned up large entry: ${entry.key} (${Math.round(entry.size / 1024 / 1024)}MB)`);
          } catch (error) {
            console.warn(`Failed to clean up large entry ${entry.key}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup large entries:', error);
    }

    return cleanedCount;
  }

  /**
   * Get storage summary for debugging
   */
  static async getStorageSummary(): Promise<string> {
    try {
      const diagnosis = await this.diagnoseStorage();

      return `
Storage Summary:
- Total keys: ${diagnosis.totalKeys}
- Total size: ${Math.round(diagnosis.totalSize / 1024 / 1024)}MB
- Large entries (>1MB): ${diagnosis.largeEntries.length}
- Corrupted entries: ${diagnosis.corruptedEntries.length}

${diagnosis.largeEntries.length > 0 ?
    `Large entries:\n${  diagnosis.largeEntries.slice(0, 5).map(e =>
      `  - ${e.key}: ${Math.round(e.size / 1024 / 1024)}MB`,
    ).join('\n')}` : ''}

${diagnosis.corruptedEntries.length > 0 ?
    `Corrupted entries:\n${  diagnosis.corruptedEntries.slice(0, 5).map(k =>
      `  - ${k}`,
    ).join('\n')}` : ''}
      `.trim();
    } catch (error) {
      return `Failed to generate storage summary: ${error}`;
    }
  }
}