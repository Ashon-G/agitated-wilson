/**
 * Query Service
 *
 * Handles Firestore query operations with real-time listeners and pagination.
 * Separated from BackendService for better maintainability.
 *
 * @version 1.0.0
 * @author PaynaAI Team
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  getDocs,
  onSnapshot,
  Unsubscribe,
  doc,
  CollectionReference,
} from 'firebase/firestore';
import { db } from '../../config/firebase';

export interface QueryOptions {
  limit?: number;
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  where?: Array<{ field: string; operator: any; value: any }>;
  startAfter?: any;
}

class QueryService {
  private listeners = new Map<string, Unsubscribe>();

  /**
   * Helper function to get collection reference from a path
   * Handles both simple collection names and subcollection paths
   * e.g., "users" or "users/userId/knowledge"
   */
  private getCollectionRef(path: string): CollectionReference {
    const segments = path.split('/').filter(s => s.length > 0);

    if (segments.length === 0) {
      throw new Error('Invalid collection path: empty path');
    }

    if (segments.length === 1) {
      // Simple collection
      return collection(db, segments[0]);
    }

    // For paths with more than 1 segment
    // Firestore collection paths must have an odd number of segments
    if (segments.length % 2 === 0) {
      throw new Error(`Invalid collection path: ${path}. Collection paths must have an odd number of segments.`);
    }

    // Odd number of segments (3, 5, etc.) - valid collection path
    // For "users/userId/knowledge" (3 segments):
    // We need: collection(doc(db, "users", "userId"), "knowledge")
    const parentDocPath = segments.slice(0, -1); // e.g., ["users", "userId"]
    const subcollectionName = segments[segments.length - 1]; // e.g., "knowledge"

    // Create parent document reference
    const parentDocRef = doc(db, parentDocPath[0], ...parentDocPath.slice(1));

    // Return the subcollection reference
    return collection(parentDocRef, subcollectionName);
  }

  /**
   * Query a collection with filters and pagination
   * Supports both top-level collections and subcollections (e.g., "users/userId/knowledge")
   */
  async queryCollection<T>(
    collectionName: string,
    options: QueryOptions = {},
  ): Promise<T[]> {
    try {
      const collectionRef = this.getCollectionRef(collectionName);
      let q = query(collectionRef);

      if (options.where) {
        options.where.forEach(({ field, operator, value }) => {
          q = query(q, where(field, operator, value));
        });
      }

      if (options.orderBy) {
        q = query(q, orderBy(options.orderBy.field, options.orderBy.direction));
      }

      if (options.limit) {
        q = query(q, firestoreLimit(options.limit));
      }

      if (options.startAfter) {
        q = query(q, startAfter(options.startAfter));
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    } catch (error) {
      console.error(`Failed to query collection ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Setup real-time listener for collection changes
   * Supports both top-level collections and subcollections
   */
  setupListener<T>(
    collectionName: string,
    options: QueryOptions,
    callback: (data: T[]) => void,
  ): string {
    try {
      const collectionRef = this.getCollectionRef(collectionName);
      let q = query(collectionRef);

      if (options.where) {
        options.where.forEach(({ field, operator, value }) => {
          q = query(q, where(field, operator, value));
        });
      }

      if (options.orderBy) {
        q = query(q, orderBy(options.orderBy.field, options.orderBy.direction));
      }

      if (options.limit) {
        q = query(q, firestoreLimit(options.limit));
      }

      const listenerId = `listener_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      const unsubscribe = onSnapshot(q,
        (snapshot) => {
          const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
          callback(results);
        },
        (error) => {
          console.error(`Listener error for ${collectionName}:`, error);
        },
      );

      this.listeners.set(listenerId, unsubscribe);
      return listenerId;
    } catch (error) {
      console.error(`Failed to setup listener for ${collectionName}:`, error);
      return '';
    }
  }

  /**
   * Remove real-time listener
   */
  removeListener(listenerId: string): void {
    const unsubscribe = this.listeners.get(listenerId);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(listenerId);
    }
  }

  /**
   * Get paginated results
   */
  async getPaginatedResults<T>(
    collectionName: string,
    options: QueryOptions & { pageSize: number; lastDoc?: any },
  ): Promise<{ data: T[]; lastDoc: any; hasMore: boolean }> {
    try {
      const queryOptions: QueryOptions = {
        ...options,
        limit: options.pageSize,
        startAfter: options.lastDoc,
      };

      const data = await this.queryCollection<T>(collectionName, queryOptions);

      return {
        data,
        lastDoc: data.length > 0 ? data[data.length - 1] : null,
        hasMore: data.length === options.pageSize,
      };
    } catch (error) {
      console.error(`Failed to get paginated results from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Count documents in a collection
   */
  async countDocuments(
    collectionName: string,
    whereClauses?: Array<{ field: string; operator: any; value: any }>,
  ): Promise<number> {
    try {
      let q = query(collection(db, collectionName));

      if (whereClauses) {
        whereClauses.forEach(({ field, operator, value }) => {
          q = query(q, where(field, operator, value));
        });
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error) {
      console.error(`Failed to count documents in ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Clean up all listeners
   */
  dispose(): void {
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners.clear();
  }

  /**
   * Get active listener count
   */
  getActiveListenerCount(): number {
    return this.listeners.size;
  }
}

export default new QueryService();
