/**
 * Batch Service
 *
 * Handles Firestore batch operations for multiple document operations.
 * Separated from BackendService for better maintainability.
 *
 * @version 1.0.0
 * @author PaynaAI Team
 */

import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';

export interface BatchOperation {
  type: 'create' | 'update' | 'delete';
  collection: string;
  documentId?: string;
  data?: any;
}

class BatchService {
  /**
   * Execute batch operations for multiple documents
   */
  async batchOperation(operations: BatchOperation[]): Promise<void> {
    try {
      const batch = writeBatch(db);

      for (const operation of operations) {
        const collectionRef = collection(db, operation.collection);

        switch (operation.type) {
          case 'create':
            if (operation.data) {
              const docRef = doc(collectionRef);
              const documentData = {
                ...operation.data,
                id: docRef.id,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              };
              batch.set(docRef, documentData);
            }
            break;

          case 'update':
            if (operation.documentId && operation.data) {
              const docRef = doc(collectionRef, operation.documentId);
              const updateData = {
                ...operation.data,
                updatedAt: serverTimestamp(),
              };
              batch.update(docRef, updateData);
            }
            break;

          case 'delete':
            if (operation.documentId) {
              const docRef = doc(collectionRef, operation.documentId);
              batch.delete(docRef);
            }
            break;
        }
      }

      await batch.commit();
    } catch (error) {
      console.error('Batch operation failed:', error);
      throw error;
    }
  }

  /**
   * Create multiple documents in a single batch
   */
  async batchCreate<T>(
    collectionName: string,
    documents: Array<Omit<T, 'id'>>,
  ): Promise<T[]> {
    try {
      const batch = writeBatch(db);
      const collectionRef = collection(db, collectionName);
      const createdDocuments: T[] = [];

      documents.forEach(docData => {
        const docRef = doc(collectionRef);
        const documentData = {
          ...docData,
          id: docRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        batch.set(docRef, documentData);
        createdDocuments.push({
          ...documentData,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as T);
      });

      await batch.commit();
      return createdDocuments;
    } catch (error) {
      console.error(`Batch create failed for ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Update multiple documents in a single batch
   */
  async batchUpdate(
    collectionName: string,
    updates: Array<{ documentId: string; data: any }>,
  ): Promise<void> {
    try {
      const batch = writeBatch(db);
      const collectionRef = collection(db, collectionName);

      updates.forEach(({ documentId, data }) => {
        const docRef = doc(collectionRef, documentId);
        const updateData = {
          ...data,
          updatedAt: serverTimestamp(),
        };
        batch.update(docRef, updateData);
      });

      await batch.commit();
    } catch (error) {
      console.error(`Batch update failed for ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Delete multiple documents in a single batch
   */
  async batchDelete(
    collectionName: string,
    documentIds: string[],
  ): Promise<void> {
    try {
      const batch = writeBatch(db);
      const collectionRef = collection(db, collectionName);

      documentIds.forEach(documentId => {
        const docRef = doc(collectionRef, documentId);
        batch.delete(docRef);
      });

      await batch.commit();
    } catch (error) {
      console.error(`Batch delete failed for ${collectionName}:`, error);
      throw error;
    }
  }
}

export default new BatchService();
