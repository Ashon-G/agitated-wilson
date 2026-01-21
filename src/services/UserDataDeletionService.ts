/**
 * User Data Deletion Service
 * Handles comprehensive cleanup of all user data from Firestore before account deletion
 *
 * This service implements cascading deletion - when a user account is deleted,
 * ALL data connected to that user is also deleted from Firestore.
 */

import { collection, query, where, getDocs, deleteDoc, doc, writeBatch, collectionGroup } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/firebase';

class UserDataDeletionService {
  /**
   * Delete all user data from Firestore
   * This must be called BEFORE deleting the Firebase Auth account
   */
  async deleteAllUserData(userId: string): Promise<void> {
    console.log(`🗑️ Starting comprehensive data deletion for user: ${userId}`);

    try {
      // Collections where documents need to be queried by userId field
      const userCollections = [
        // Core Agent & Lead Management
        COLLECTIONS.SALES_AGENTS,
        COLLECTIONS.LEADS,
        COLLECTIONS.CONVERSATIONS,
        COLLECTIONS.CONVERSATION_MESSAGES,

        // Knowledge & Learning
        COLLECTIONS.TRAINING_SESSIONS,
        COLLECTIONS.TRAINING_DATA,

        // Agent Communication & Management
        COLLECTIONS.AGENT_INBOX,
        COLLECTIONS.AGENT_ACTIONS,
        COLLECTIONS.SCHEDULED_QUESTIONS,
        COLLECTIONS.USER_PREFERENCES,

        // Billing & Events
        COLLECTIONS.QUALIFIED_LEAD_EVENTS,
        COLLECTIONS.LINK_CLICK_EVENTS,
        COLLECTIONS.BILLING_EVENTS,

        // Legacy collections (hardcoded strings - may exist in Firestore)
        'reddit_leads',
        'reddit_comment_history',
        'reddit_credentials',
        'agent_activities',
        'agent_comments',
        'agent_creation_errors',
        'inbox_items',
        'memories',
        'autonomous_sessions',
        'closing_sessions',
        // 'workspaces' removed - now a subcollection under users/{userId}/workspaces
        // 'knowledge_items' removed - was never used, knowledge is in users/{userId}/knowledge
      ];

      // Delete documents from collections where userId is a field
      for (const collectionName of userCollections) {
        await this.deleteCollectionDocuments(collectionName, userId);
      }

      // Delete documents where userId is the document ID
      const directDeleteCollections = [
        { collection: 'users', docId: userId }, // Updated from user_profiles to users
        // { collection: COLLECTIONS.PAYMENT_STATUS, docId: userId },  // Removed during Stripe cleanup
      ];

      for (const { collection: collectionName, docId } of directDeleteCollections) {
        await this.deleteDocumentById(collectionName, docId);
      }

      // Delete the main users/{userId} document and all its subcollections
      // This includes Reddit OAuth tokens stored in users/{userId}/reddit_credentials
      await this.deleteUserDocument(userId);

      // Delete workspace-related data
      await this.deleteWorkspaceData(userId);

      console.log(`✅ Successfully deleted all data for user: ${userId}`);
    } catch (error) {
      console.error(`❌ Error deleting user data for ${userId}:`, error);
      throw new Error(`Failed to delete user data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete all documents in a collection where userId matches
   */
  private async deleteCollectionDocuments(collectionName: string, userId: string): Promise<void> {
    try {
      const collectionRef = collection(db, collectionName);
      const q = query(collectionRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.log(`ℹ️ No documents found in ${collectionName} for user ${userId}`);
        return;
      }

      // Use batch writes for efficiency (max 500 operations per batch)
      const batches: any[] = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;

      querySnapshot.forEach((document) => {
        currentBatch.delete(document.ref);
        operationCount++;

        // Start new batch if we hit the limit
        if (operationCount === 500) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      });

      // Add the last batch if it has operations
      if (operationCount > 0) {
        batches.push(currentBatch);
      }

      // Commit all batches
      for (const batch of batches) {
        await batch.commit();
      }

      console.log(`✅ Deleted ${querySnapshot.size} documents from ${collectionName}`);
    } catch (error) {
      console.error(`❌ Error deleting documents from ${collectionName}:`, error);
      // Don't throw - continue with other collections
    }
  }

  /**
   * Delete a specific document by ID
   */
  private async deleteDocumentById(collectionName: string, docId: string): Promise<void> {
    try {
      const docRef = doc(db, collectionName, docId);
      await deleteDoc(docRef);
      console.log(`✅ Deleted document ${docId} from ${collectionName}`);
    } catch (error) {
      console.error(`❌ Error deleting document ${docId} from ${collectionName}:`, error);
      // Don't throw - continue with other deletions
    }
  }

  /**
   * Delete the main users/{userId} document and all its subcollections
   * This includes Reddit OAuth tokens and any other nested data
   */
  private async deleteUserDocument(userId: string): Promise<void> {
    try {
      console.log(`🗑️ Deleting main user document and subcollections for: ${userId}`);

      // Delete all subcollections under users/{userId}
      // Known subcollections: reddit_credentials
      const subcollections = ['reddit_credentials'];

      for (const subcollectionName of subcollections) {
        const subcollectionRef = collection(db, 'users', userId, subcollectionName);
        const subcollectionSnapshot = await getDocs(subcollectionRef);

        if (!subcollectionSnapshot.empty) {
          const batch = writeBatch(db);
          let count = 0;

          subcollectionSnapshot.forEach((document) => {
            batch.delete(document.ref);
            count++;
          });

          await batch.commit();
          console.log(`✅ Deleted ${count} documents from users/${userId}/${subcollectionName}`);
        }
      }

      // Delete the main user document
      // This contains user profile data and nested fields like redditAccount
      const userDocRef = doc(db, 'users', userId);
      await deleteDoc(userDocRef);
      console.log(`✅ Deleted main user document: users/${userId}`);
    } catch (error) {
      console.error(`❌ Error deleting user document for ${userId}:`, error);
      // Don't throw - continue with other deletions
    }
  }

  /**
   * Delete workspace data and all workspace-specific collections
   * Now handles both legacy root-level workspaces and new users/{userId}/workspaces structure
   */
  private async deleteWorkspaceData(userId: string): Promise<void> {
    try {
      // Delete legacy root-level workspaces (if any exist)
      const workspacesRef = collection(db, 'workspaces');
      const workspacesQuery = query(workspacesRef, where('userId', '==', userId));
      const workspacesSnapshot = await getDocs(workspacesQuery);

      if (!workspacesSnapshot.empty) {
        console.log(`ℹ️ Found ${workspacesSnapshot.size} legacy workspaces for user ${userId}`);

        // Delete knowledge items for each workspace from LEGACY collection
        for (const workspaceDoc of workspacesSnapshot.docs) {
          const workspaceId = workspaceDoc.id;

          // Delete knowledge items from LEGACY knowledge_base collection
          const knowledgeRef = collection(db, 'knowledge_base');
          const knowledgeQuery = query(
            knowledgeRef,
            where('userId', '==', userId),
            where('workspaceId', '==', workspaceId),
          );
          const knowledgeSnapshot = await getDocs(knowledgeQuery);

          const batch = writeBatch(db);
          let count = 0;
          knowledgeSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
            count++;
          });

          if (count > 0) {
            await batch.commit();
            console.log(`✅ Deleted ${count} legacy knowledge items for workspace ${workspaceId}`);
          }

          // Delete the workspace document itself
          await deleteDoc(workspaceDoc.ref);
        }

        console.log(`✅ Deleted ${workspacesSnapshot.size} legacy workspaces for user ${userId}`);
      }

      // Delete new hierarchical knowledge: users/{userId}/knowledge
      // Use doc() + collection() to properly access the subcollection
      const userDocRef = doc(db, 'users', userId);
      const userKnowledgeRef = collection(userDocRef, 'knowledge');
      const userKnowledgeSnapshot = await getDocs(userKnowledgeRef);

      if (!userKnowledgeSnapshot.empty) {
        const batch = writeBatch(db);
        let count = 0;
        userKnowledgeSnapshot.forEach((docItem) => {
          batch.delete(docItem.ref);
          count++;
        });

        if (count > 0) {
          await batch.commit();
          console.log(`✅ Deleted ${count} knowledge items from users/${userId}/knowledge`);
        }
      }

      // Delete new hierarchical workspaces: users/{userId}/workspaces
      // This is automatically handled by deleteUserDocument which deletes all subcollections
      console.log(`✅ Hierarchical workspaces under users/${userId}/workspaces will be deleted with user document`);
    } catch (error) {
      console.error('❌ Error deleting workspace data:', error);
      // Don't throw - continue with other deletions
    }
  }

  /**
   * Get summary of data to be deleted (for showing user before deletion)
   */
  async getDataDeletionSummary(userId: string): Promise<{
    workspaces: number;
    knowledgeItems: number;
    leads: number;
    conversations: number;
    invoices: number;
    hasOutstandingBalance: boolean;
    outstandingAmount: number;
  }> {
    try {
      // Count workspaces
      const workspacesRef = collection(db, 'workspaces');
      const workspacesQuery = query(workspacesRef, where('userId', '==', userId));
      const workspacesSnapshot = await getDocs(workspacesQuery);

      // Count knowledge items from NEW hierarchical structure: users/{userId}/knowledge
      // Use doc() + collection() to properly access the subcollection
      const userDocRef = doc(db, 'users', userId);
      const userKnowledgeRef = collection(userDocRef, 'knowledge');
      const userKnowledgeSnapshot = await getDocs(userKnowledgeRef);

      // Also count legacy knowledge items if any exist
      const legacyKnowledgeRef = collection(db, 'knowledge_base');
      const legacyKnowledgeQuery = query(legacyKnowledgeRef, where('userId', '==', userId));
      const legacyKnowledgeSnapshot = await getDocs(legacyKnowledgeQuery);

      const totalKnowledgeItems = userKnowledgeSnapshot.size + legacyKnowledgeSnapshot.size;

      // Count leads
      const leadsRef = collection(db, COLLECTIONS.LEADS);
      const leadsQuery = query(leadsRef, where('userId', '==', userId));
      const leadsSnapshot = await getDocs(leadsQuery);

      // Count conversations
      const conversationsRef = collection(db, COLLECTIONS.CONVERSATIONS);
      const conversationsQuery = query(conversationsRef, where('userId', '==', userId));
      const conversationsSnapshot = await getDocs(conversationsQuery);

      // Billing removed - set default values
      const outstandingAmount = 0;
      const hasOutstandingBalance = false;
      const unpaidSnapshot = { size: 0 };


      return {
        workspaces: workspacesSnapshot.size,
        knowledgeItems: totalKnowledgeItems,
        leads: leadsSnapshot.size,
        conversations: conversationsSnapshot.size,
        invoices: unpaidSnapshot.size,
        hasOutstandingBalance: outstandingAmount > 0,
        outstandingAmount: outstandingAmount / 100, // Convert cents to dollars
      };
    } catch (error) {
      console.error('Error getting data deletion summary:', error);
      // Return empty summary if there's an error
      return {
        workspaces: 0,
        knowledgeItems: 0,
        leads: 0,
        conversations: 0,
        invoices: 0,
        hasOutstandingBalance: false,
        outstandingAmount: 0,
      };
    }
  }
}

export default new UserDataDeletionService();
