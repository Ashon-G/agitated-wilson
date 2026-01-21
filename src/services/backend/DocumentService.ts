/**
 * Document Service
 *
 * Handles Firestore document operations (CRUD) with authentication and validation.
 * Separated from BackendService for better maintainability.
 *
 * @version 1.0.0
 * @author PaynaAI Team
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  serverTimestamp,
  CollectionReference,
  DocumentReference,
} from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import AuthenticationService from '../AuthenticationService';
import { handleError, ErrorContext } from '../../utils/errorHandler';
import InputValidator from '../../utils/InputValidator';

// Token refresh cache to prevent quota exceeded errors
// Firebase has limits on token refresh operations
let lastTokenRefresh: number = 0;
const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes minimum between force refreshes

/**
 * Get a fresh token, but only force refresh if enough time has passed
 * This prevents auth/quota-exceeded errors from too many token refreshes
 */
const getTokenWithRateLimit = async (): Promise<string | null> => {
  if (!auth.currentUser) {
    return null;
  }

  const now = Date.now();
  const shouldForceRefresh = now - lastTokenRefresh > TOKEN_REFRESH_INTERVAL;

  if (shouldForceRefresh) {
    lastTokenRefresh = now;
    console.log('🔄 Force refreshing token (rate limited)');
    return auth.currentUser.getIdToken(true);
  } else {
    // Use cached token
    return auth.currentUser.getIdToken(false);
  }
};

// Helper to ensure Firebase auth instance has the current user
const waitForAuthUser = async (maxWait = 3000): Promise<boolean> => {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    if (auth.currentUser) {
      console.log('✅ auth.currentUser confirmed:', auth.currentUser.uid);
      return true;
    }
    console.log('⏳ Waiting for auth.currentUser...');
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.error('❌ auth.currentUser still null after timeout');
  return false;
};
class DocumentService {
  /**
   * Helper function to create a collection reference from a path
   * Handles both simple collection names and subcollection paths
   * e.g., "users" or "users/userId/knowledge" or "users/userId/knowledgeItems"
   *
   * For Firestore paths:
   * - Collection paths have an odd number of segments (1, 3, 5, etc.)
   * - Document paths have an even number of segments (2, 4, 6, etc.)
   *
   * Examples:
   * - "users" (1 segment) -> collection reference
   * - "users/userId/knowledge" (3 segments) -> subcollection reference
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

    // For paths with more than 1 segment, we need to build the reference correctly
    // Firestore collection paths must have an odd number of segments
    if (segments.length % 2 === 0) {
      // Even segments (2, 4, etc.) - this is a document path, not a collection path
      throw new Error(`Invalid collection path: ${path}. Collection paths must have an odd number of segments.`);
    }

    // Odd number of segments (3, 5, etc.) - valid collection path
    // For "users/userId/knowledge" (3 segments):
    // We need: collection(doc(db, "users", "userId"), "knowledge")
    //
    // General pattern for odd segments > 1:
    // segments[0..n-2] form the parent document path (even number)
    // segments[n-1] is the subcollection name
    const parentDocPath = segments.slice(0, -1); // e.g., ["users", "userId"]
    const subcollectionName = segments[segments.length - 1]; // e.g., "knowledge"

    // Create parent document reference
    const parentDocRef = doc(db, parentDocPath[0], ...parentDocPath.slice(1));

    // Return the subcollection reference
    return collection(parentDocRef, subcollectionName);
  }

  /**
   * Helper function to create a document reference from a path
   * Handles both simple paths and subcollection paths
   * e.g., "users/userId" or "users/userId/knowledge/docId"
   */
  private getDocRef(path: string, docId?: string): DocumentReference {
    const segments = path.split('/').filter(s => s.length > 0);

    if (docId) {
      // Path is a collection path, append docId
      // Use the collection reference approach for subcollections
      const collectionRef = this.getCollectionRef(path);
      return doc(collectionRef, docId);
    }

    // Path includes the document ID
    if (segments.length % 2 !== 0) {
      throw new Error(`Invalid document path: ${path}. Document paths must have an even number of segments.`);
    }

    // For document paths, use the full path string
    return doc(db, path);
  }

  /**
   * Helper function to remove undefined values for Firestore
   */
  private removeUndefined(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(item => this.removeUndefined(item));
    if (typeof obj === 'object') {
      const cleaned: Record<string, unknown> = {};
      Object.keys(obj as Record<string, unknown>).forEach(key => {
        const value = (obj as Record<string, unknown>)[key];
        if (value !== undefined) {
          cleaned[key] = this.removeUndefined(value);
        }
      });
      return cleaned;
    }
    return obj;
  }

  /**
   * Create a new document
   */
  async createDocument<T>(
    collectionName: string,
    data: Omit<T, 'id'> & { userId: string },
  ): Promise<T> {
    try {
      const currentUser = AuthenticationService.getCurrentUser();
      if (!currentUser) {
        console.error('❌ No current user found in AuthenticationService');
        throw new Error('User not authenticated');
      }

      console.log('✅ Current user:', currentUser.uid);

      // Ensure we have a valid auth token before proceeding
      console.log('🔄 Fetching auth token...');
      const token = await AuthenticationService.getCurrentToken();
      if (!token) {
        console.error('❌ No valid authentication token available');
        throw new Error('No valid authentication token available');
      }

      console.log('✅ Auth token retrieved, length:', token.length);

      // Critical: Wait for auth.currentUser to be set on the Firebase auth instance
      // This ensures Firestore requests will include the auth context
      console.log('🔄 Waiting for Firebase auth.currentUser to be set...');
      const hasAuthUser = await waitForAuthUser();
      if (!hasAuthUser) {
        throw new Error('Firebase auth.currentUser not available. Please try again.');
      }

      // Force refresh token immediately before Firestore operation to ensure it's attached
      console.log('🔄 Refreshing token before Firestore operation...');
      const freshToken = await getTokenWithRateLimit();
      console.log('✅ Token obtained, length:', freshToken?.length);

      // CRITICAL: Prime Firestore auth context by ensuring user document exists
      // This creates a successful write operation that synchronizes the auth context
      // Retry this critical step to handle auth context timing issues
      let authContextReady = false;
      const maxPrimingAttempts = 3;

      for (let primingAttempt = 1; primingAttempt <= maxPrimingAttempts; primingAttempt++) {
        try {
          if (primingAttempt > 1) {
            const primingDelay = 800 + (primingAttempt * 400); // 1200ms, 1600ms
            console.log(`⏳ Priming attempt ${primingAttempt}: Waiting ${primingDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, primingDelay));

            // Refresh token before retry (rate limited)
            await getTokenWithRateLimit();
          }

          console.log(`🔄 Priming Firestore auth context (attempt ${primingAttempt})...`);
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (!userDocSnap.exists()) {
            console.log('🔧 User document does not exist, creating it to prime auth context...');
            // Create user document with merge to avoid overwriting existing data
            await setDoc(userDocRef, {
              uid: currentUser.uid,
              email: currentUser.email || '',
              lastActive: serverTimestamp(),
            }, { merge: true });
            console.log('✅ User document created successfully');

            // Wait for auth context to propagate after first successful write
            console.log('⏳ Waiting 1000ms for auth context to propagate after user doc creation...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            console.log('✅ User document exists');
            // Update lastActive to ensure we can write
            await setDoc(userDocRef, {
              lastActive: serverTimestamp(),
            }, { merge: true });
            console.log('✅ User document updated, auth context confirmed working');

            // Shorter wait since auth context should already be established
            console.log('⏳ Waiting 300ms to ensure auth context stability...');
            await new Promise(resolve => setTimeout(resolve, 300));
          }

          authContextReady = true;
          break;
        } catch (testError: any) {
          // Check if it's a permission error
          const isPermissionError =
            testError?.code === 'permission-denied' ||
            testError?.message?.includes('Missing or insufficient permissions');

          if (isPermissionError && primingAttempt < maxPrimingAttempts) {
            console.warn(`⚠️ Priming attempt ${primingAttempt} failed with permission error, retrying...`);
            continue;
          }

          // If this fails after all retries, it's a critical auth context issue
          if (isPermissionError) {
            console.error('❌ Firestore auth context not ready after all priming attempts');
            throw new Error('Unable to establish Firestore authentication. Please try signing out and signing in again.');
          }

          throw testError;
        }
      }

      if (!authContextReady) {
        throw new Error('Failed to prime Firestore auth context after multiple attempts');
      }

      // Validate inputs
      const collectionValidation = InputValidator.validateCollectionName(collectionName);
      if (!collectionValidation.isValid) {
        throw new Error(`Invalid collection name: ${collectionValidation.error}`);
      }

      const userIdValidation = InputValidator.validateUserId(data.userId);
      if (!userIdValidation.isValid) {
        throw new Error(`Invalid user ID: ${userIdValidation.error}`);
      }

      if (data.userId !== currentUser.uid) {
        throw new Error('Unauthorized: userId mismatch');
      }

      // Sanitize the data object
      const sanitizedData = InputValidator.sanitizeObject(data) as Omit<T, 'id'> & {
        userId: string;
      };

      console.log(`🔄 Creating document in ${collectionName} for user ${data.userId}`);

      // Create a new document with auto-generated ID using addDoc
      // Use getCollectionRef to handle both simple and subcollection paths
      const collectionRef = this.getCollectionRef(collectionName);
      const documentData = this.removeUndefined({
        ...sanitizedData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }) as Record<string, unknown>;

      // Log the data being sent (excluding timestamps for readability)
      console.log('📦 Document data to be created:', {
        ...documentData,
        createdAt: '[serverTimestamp]',
        updatedAt: '[serverTimestamp]',
      });

      // Log auth context
      console.log('🔐 Auth context:', {
        'auth.currentUser.uid': auth.currentUser?.uid,
        'documentData.userId': documentData.userId,
        match: auth.currentUser?.uid === documentData.userId,
      });

      // Retry mechanism specifically for permission errors (auth context not ready)
      const maxRetries = 3;
      let lastError: any = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 1) {
            // Exponential backoff: 1500ms, 2000ms, 2500ms
            const delay = 1000 + (attempt * 500);
            console.log(`⏳ Attempt ${attempt}: Waiting ${delay}ms for Firestore auth context...`);
            await new Promise(resolve => setTimeout(resolve, delay));

            // Refresh token again before retry (rate limited)
            await getTokenWithRateLimit();
            console.log(`🔄 Attempt ${attempt}: Token refreshed`);
          }

          const docRef = await addDoc(collectionRef, documentData);
          console.log(`✅ Document created successfully with ID: ${docRef.id} (attempt ${attempt})`);

          return {
            ...documentData,
            id: docRef.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as T;
        } catch (error: any) {
          lastError = error;

          // Check if document already exists - this is not actually an error
          const isAlreadyExists =
            error?.code === 'already-exists' ||
            error?.message?.includes('Document already exists');

          if (isAlreadyExists) {
            console.log('ℹ️ Document already exists, treating as success');
            // Extract the document ID from the error message if possible
            const idMatch = error?.message?.match(/documents\/[^/]+\/(\w+)/);
            const existingId = idMatch ? idMatch[1] : null;

            if (existingId) {
              return {
                ...documentData,
                id: existingId,
                createdAt: new Date(),
                updatedAt: new Date(),
              } as T;
            } else {
              // If we can't extract the ID, just skip the retry since document exists
              console.warn('⚠️ Document exists but could not extract ID, skipping retries');
              throw error;
            }
          }

          // Check if it's a permission error
          const isPermissionError =
            error?.code === 'permission-denied' ||
            error?.message?.includes('Missing or insufficient permissions');

          if (isPermissionError && attempt < maxRetries) {
            console.warn(`⚠️ Attempt ${attempt} failed with permission error, retrying...`);
            continue;
          }

          // If it's not a permission error or we're out of retries, throw
          throw error;
        }
      }

      // This should never be reached, but TypeScript needs it
      throw lastError;
    } catch (error: any) {
      // Check if document already exists - this is expected behavior in some cases
      const isAlreadyExists =
        error?.code === 'already-exists' ||
        error?.message?.includes('Document already exists');

      if (isAlreadyExists) {
        console.log('ℹ️ Document already exists in collection:', collectionName);
        // Extract the document ID from the error message
        const idMatch = error?.message?.match(/documents\/[^/]+\/(\w+)/);
        const existingId = idMatch ? idMatch[1] : null;

        if (existingId) {
          console.log('ℹ️ Returning existing document ID:', existingId);
          // Return a minimal valid response - the document exists so this is not an error
          return {
            id: existingId,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as T;
        }
      }

      console.error('❌ createDocument error:', error);
      const errorContext: ErrorContext = {
        category: 'storage',
        operation: 'createDocument',
        technicalMessage: `Failed to create document in ${collectionName}`,
        retryable: true,
      };

      handleError(error, errorContext);
      throw error;
    }
  }

  /**
   * Set a document (create or overwrite)
   */
  async setDocument<T>(
    collectionName: string,
    documentId: string,
    data: Omit<T, 'id'>,
  ): Promise<T> {
    try {
      const currentUser = AuthenticationService.getCurrentUser();
      if (!currentUser) {
        console.error('❌ No current user found in AuthenticationService');
        throw new Error('User not authenticated');
      }

      console.log('✅ setDocument: Current user:', currentUser.uid);

      // Ensure we have a valid auth token before proceeding
      console.log('🔄 setDocument: Fetching auth token...');
      const token = await AuthenticationService.getCurrentToken();
      if (!token) {
        console.error('❌ No valid authentication token available');
        throw new Error('No valid authentication token available');
      }

      console.log('✅ setDocument: Auth token retrieved');

      // Critical: Wait for auth.currentUser to be set on the Firebase auth instance
      console.log('🔄 setDocument: Waiting for Firebase auth.currentUser...');
      const hasAuthUser = await waitForAuthUser();
      if (!hasAuthUser) {
        throw new Error('Firebase auth.currentUser not available. Please try again.');
      }

      // Force refresh token immediately before Firestore operation
      console.log('🔄 setDocument: Refreshing token...');
      await getTokenWithRateLimit();
      console.log('✅ setDocument: Token obtained');

      const docRef = doc(db, collectionName, documentId);
      const documentData = this.removeUndefined({
        ...data,
        id: documentId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }) as Record<string, unknown>;

      // Retry mechanism for permission errors (auth context not ready)
      const maxRetries = 3;
      let lastError: any = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 1) {
            const delay = 1000 + (attempt * 500);
            console.log(`⏳ setDocument attempt ${attempt}: Waiting ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));

            // Refresh token before retry (rate limited)
            await getTokenWithRateLimit();
            console.log(`🔄 setDocument attempt ${attempt}: Token refreshed`);
          }

          await setDoc(docRef, documentData);
          console.log(`✅ setDocument: Document set successfully (attempt ${attempt})`);

          return {
            ...documentData,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as T;
        } catch (error: any) {
          lastError = error;

          // Check if it's a permission error
          const isPermissionError =
            error?.code === 'permission-denied' ||
            error?.message?.includes('Missing or insufficient permissions');

          if (isPermissionError && attempt < maxRetries) {
            console.warn(`⚠️ setDocument attempt ${attempt} failed with permission error, retrying...`);
            continue;
          }

          throw error;
        }
      }

      throw lastError;
    } catch (error) {
      console.error('❌ setDocument error:', error);
      const errorContext: ErrorContext = {
        category: 'storage',
        operation: 'setDocument',
        technicalMessage: `Failed to set document ${documentId} in ${collectionName}`,
        retryable: true,
      };

      handleError(error, errorContext);
      throw error;
    }
  }

  /**
   * Get a document by ID
   */
  async getDocument<T>(collectionName: string, documentId: string): Promise<T | null> {
    try {
      const docRef = doc(db, collectionName, documentId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return docSnap.data() as T;
    } catch (error: any) {
      // Don't log errors for missing documents or permission issues on optional reads
      const isPermissionError =
        error?.code === 'permission-denied' || error?.message?.includes('permission');
      const isMissingDoc = error?.code === 'not-found';

      if (!isPermissionError && !isMissingDoc) {
        const errorContext: ErrorContext = {
          category: 'storage',
          operation: 'getDocument',
          technicalMessage: `Failed to get document ${documentId} from ${collectionName}`,
          retryable: true,
          showToast: false, // Don't show toast for background operations
        };

        handleError(error, errorContext);
      }

      // For permission/not-found errors, silently return null
      if (isPermissionError || isMissingDoc) {
        return null;
      }

      throw error;
    }
  }

  /**
   * Update a document
   */
  async updateDocument<T>(
    collectionName: string,
    documentId: string,
    data: Partial<T>,
  ): Promise<void> {
    try {
      // Validate inputs using InputValidator
      const collectionValidation = InputValidator.validateCollectionName(collectionName);
      if (!collectionValidation.isValid) {
        throw new Error(`Invalid collection name: ${collectionValidation.error}`);
      }

      const documentIdValidation = InputValidator.validateDocumentId(documentId);
      if (!documentIdValidation.isValid) {
        throw new Error(`Invalid document ID: ${documentIdValidation.error}`);
      }

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Invalid data provided for update');
      }

      // Sanitize the data object
      const sanitizedData = InputValidator.sanitizeObject(data) as Partial<T>;

      const docRef = doc(db, collectionName, documentId);

      // Clean the data to remove undefined values and ensure proper serialization
      const cleanedData = this.removeUndefined(sanitizedData) as Record<string, unknown>;

      const updateData = {
        ...cleanedData,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(docRef, updateData);
    } catch (error) {
      const errorContext: ErrorContext = {
        category: 'storage',
        operation: 'updateDocument',
        technicalMessage: `Failed to update document ${documentId} in ${collectionName}`,
        retryable: true,
      };

      handleError(error, errorContext);
      throw error;
    }
  }

  /**
   * Merge document (create if doesn't exist, merge if exists)
   */
  async mergeDocument<T>(
    collectionName: string,
    documentId: string,
    data: Partial<T>,
  ): Promise<void> {
    try {
      // Validate inputs using InputValidator
      const collectionValidation = InputValidator.validateCollectionName(collectionName);
      if (!collectionValidation.isValid) {
        throw new Error(`Invalid collection name: ${collectionValidation.error}`);
      }

      const documentIdValidation = InputValidator.validateDocumentId(documentId);
      if (!documentIdValidation.isValid) {
        throw new Error(`Invalid document ID: ${documentIdValidation.error}`);
      }

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Invalid data provided for merge');
      }

      // Ensure we have a valid auth context
      const currentUser = AuthenticationService.getCurrentUser();
      if (!currentUser) {
        console.error('❌ No current user found in AuthenticationService');
        throw new Error('User not authenticated');
      }

      // Wait for auth.currentUser to be available
      const hasAuthUser = await waitForAuthUser();
      if (!hasAuthUser) {
        throw new Error('Firebase auth.currentUser not available. Please try again.');
      }

      // Force refresh token before Firestore operation (rate limited)
      await getTokenWithRateLimit();

      // Sanitize the data object
      const sanitizedData = InputValidator.sanitizeObject(data) as Partial<T>;

      const docRef = doc(db, collectionName, documentId);

      // Clean the data to remove undefined values and ensure proper serialization
      const cleanedData = this.removeUndefined(sanitizedData) as Record<string, unknown>;

      const mergeData = {
        ...cleanedData,
        updatedAt: serverTimestamp(),
      };

      // Retry mechanism for permission errors
      const maxRetries = 3;
      let lastError: any = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 1) {
            const delay = 1000 + (attempt * 500);
            console.log(`⏳ mergeDocument attempt ${attempt}: Waiting ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));

            // Refresh token before retry (rate limited)
            await getTokenWithRateLimit();
          }

          // Use setDoc with merge option to create document if it doesn't exist
          await setDoc(docRef, mergeData, { merge: true });
          return;
        } catch (error: any) {
          lastError = error;

          // Check if it's a permission error
          const isPermissionError =
            error?.code === 'permission-denied' ||
            error?.message?.includes('Missing or insufficient permissions');

          if (isPermissionError && attempt < maxRetries) {
            console.warn(`⚠️ mergeDocument attempt ${attempt} failed with permission error, retrying...`);
            continue;
          }

          throw error;
        }
      }

      throw lastError;
    } catch (error) {
      const errorContext: ErrorContext = {
        category: 'storage',
        operation: 'mergeDocument',
        technicalMessage: `Failed to merge document ${documentId} in ${collectionName}`,
        retryable: true,
      };

      handleError(error, errorContext);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(collectionName: string, documentId: string): Promise<void> {
    try {
      const docRef = doc(db, collectionName, documentId);
      await deleteDoc(docRef);
    } catch (error) {
      const errorContext: ErrorContext = {
        category: 'storage',
        operation: 'deleteDocument',
        technicalMessage: `Failed to delete document ${documentId} from ${collectionName}`,
        retryable: true,
      };

      handleError(error, errorContext);
      throw error;
    }
  }

  /**
   * Check if a document exists
   */
  async documentExists(collectionName: string, documentId: string): Promise<boolean> {
    try {
      const docRef = doc(db, collectionName, documentId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      const errorContext: ErrorContext = {
        category: 'storage',
        operation: 'documentExists',
        technicalMessage: `Failed to check document existence ${documentId} in ${collectionName}`,
        retryable: true,
      };

      handleError(error, errorContext);
      return false;
    }
  }
}

export default new DocumentService();
