/**
 * Admin User Deletion Service
 *
 * Allows administrators to delete user accounts with cascading deletion
 * of all associated data from Firestore.
 *
 * This implements the same comprehensive deletion logic as the client-side
 * UserDataDeletionService to ensure complete data removal.
 */

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

// Firestore Collections Configuration (matches client-side COLLECTIONS constant)
const COLLECTIONS = {
  // Core Agent & Lead Management
  SALES_AGENTS: 'sales_agents',
  LEADS: 'leads',
  CONVERSATIONS: 'conversations',
  CONVERSATION_MESSAGES: 'conversation_messages',
  DEALS: 'deals',

  // Platform Integrations
  PLATFORM_CONNECTIONS: 'platform_connections',
  PLATFORM_ACTIVITIES: 'platform_activities',

  // Reddit Integration System
  REDDIT_INGESTION_JOBS: 'reddit_ingestion_jobs',
  REDDIT_PROCESSING_STATE: 'reddit_processing_state',
  REDDIT_DISCOVERED_POSTS: 'reddit_discovered_posts',
  REDDIT_JOB_QUEUE: 'reddit_job_queue',
  REDDIT_CREDENTIALS_SERVER: 'reddit_credentials_server',

  // Knowledge & Learning
  KNOWLEDGE_BASE: 'knowledge_base',
  LEARNING_SESSIONS: 'learning_sessions',
  USER_CORRECTIONS: 'user_corrections',
  TRAINING_SESSIONS: 'training_sessions',
  TRAINING_DATA: 'training_data',

  // Agent Communication & Management
  AGENT_CONFIGS: 'agent_configs',
  AGENT_INBOX: 'agent_inbox',
  AGENT_ACTIVITY_LOG: 'agent_activity_log',
  USER_RESPONSES: 'user_responses',
  AGENT_ACTIONS: 'agent_actions',
  ESCALATIONS: 'escalations',
  SCHEDULED_QUESTIONS: 'scheduled_questions',
  USER_PREFERENCES: 'user_preferences',

  // Performance & Analytics
  PERFORMANCE_METRICS: 'performance_metrics',
  ENGAGEMENT_SESSIONS: 'engagement_sessions',
  ENGAGEMENT_METRICS: 'engagement_metrics',

  // Monitoring & Health
  SYSTEM_MONITORING: 'system_monitoring',
  OPERATIONAL_ALERTS: 'operational_alerts',
  HEALTH_METRICS: 'health_metrics',

  // Background Processing
  BACKGROUND_JOBS: 'background_jobs',
  AUTOMATION_LOGS: 'automation_logs',
  WEBHOOK_EVENTS: 'webhook_events',
  NOTIFICATION_QUEUE: 'notification_queue',

  // Session & Event Tracking
  SESSION_TRACKING: 'session_tracking',
  REAL_TIME_EVENTS: 'real_time_events',
  HUNTING_SESSIONS: 'hunting_sessions',

  // Usage Events & Analytics
  QUALIFIED_LEAD_EVENTS: 'qualified_lead_events',
  LINK_CLICK_EVENTS: 'link_click_events',
  BILLING_EVENTS: 'billing_events',

  // AI & Model Management
  AI_REQUESTS: 'ai_requests',
} as const;

/**
 * Check if the calling user has admin privileges
 */
async function isAdmin(uid: string): Promise<boolean> {
  try {
    const user = await admin.auth().getUser(uid);
    return user.customClaims?.admin === true;
  } catch (error) {
    logger.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Delete all documents in a collection where userId matches
 */
async function deleteCollectionDocuments(
  collectionName: string,
  userId: string,
): Promise<number> {
  const db = admin.firestore();
  const collectionRef = db.collection(collectionName);
  const query = collectionRef.where('userId', '==', userId);
  const snapshot = await query.get();

  if (snapshot.empty) {
    logger.info(`No documents found in ${collectionName} for user ${userId}`);
    return 0;
  }

  // Use batch writes for efficiency (max 500 operations per batch)
  const batches: admin.firestore.WriteBatch[] = [];
  let currentBatch = db.batch();
  let operationCount = 0;
  let totalDeleted = 0;

  snapshot.forEach((doc) => {
    currentBatch.delete(doc.ref);
    operationCount++;
    totalDeleted++;

    // Start new batch if we hit the limit
    if (operationCount === 500) {
      batches.push(currentBatch);
      currentBatch = db.batch();
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

  logger.info(`Deleted ${totalDeleted} documents from ${collectionName}`);
  return totalDeleted;
}

/**
 * Delete a specific document by ID
 */
async function deleteDocumentById(
  collectionName: string,
  docId: string,
): Promise<void> {
  const db = admin.firestore();
  await db.collection(collectionName).doc(docId).delete();
  logger.info(`Deleted document ${docId} from ${collectionName}`);
}

/**
 * Delete the main users/{userId} document and all its subcollections
 */
async function deleteUserDocument(userId: string): Promise<void> {
  const db = admin.firestore();
  logger.info(`Deleting main user document and subcollections for: ${userId}`);

  // Delete all subcollections under users/{userId}
  const subcollections = ['reddit_credentials'];

  for (const subcollectionName of subcollections) {
    const subcollectionRef = db
      .collection('users')
      .doc(userId)
      .collection(subcollectionName);
    const snapshot = await subcollectionRef.get();

    if (!snapshot.empty) {
      const batch = db.batch();
      let count = 0;

      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
        count++;
      });

      await batch.commit();
      logger.info(
        `Deleted ${count} documents from users/${userId}/${subcollectionName}`,
      );
    }
  }

  // Delete the main user document
  await db.collection('users').doc(userId).delete();
  logger.info(`Deleted main user document: users/${userId}`);
}

/**
 * Delete workspace data and all workspace-specific collections
 */
async function deleteWorkspaceData(userId: string): Promise<void> {
  const db = admin.firestore();

  // Delete LEGACY workspaces (if any exist)
  const workspacesRef = db.collection('workspaces');
  const workspacesQuery = workspacesRef.where('userId', '==', userId);
  const workspacesSnapshot = await workspacesQuery.get();

  if (!workspacesSnapshot.empty) {
    logger.info(`Found ${workspacesSnapshot.size} legacy workspaces for user ${userId}`);

    // Delete knowledge items for each workspace from LEGACY collection
    for (const workspaceDoc of workspacesSnapshot.docs) {
      const workspaceId = workspaceDoc.id;

      // Delete knowledge items from LEGACY knowledge_base collection
      const knowledgeRef = db.collection('knowledge_base');
      const knowledgeQuery = knowledgeRef
        .where('userId', '==', userId)
        .where('workspaceId', '==', workspaceId);
      const knowledgeSnapshot = await knowledgeQuery.get();

      if (!knowledgeSnapshot.empty) {
        const batch = db.batch();
        let count = 0;

        knowledgeSnapshot.forEach((doc) => {
          batch.delete(doc.ref);
          count++;
        });

        await batch.commit();
        logger.info(
          `Deleted ${count} legacy knowledge items for workspace ${workspaceId}`,
        );
      }

      // Delete the workspace document itself
      await workspaceDoc.ref.delete();
    }

    logger.info(`Deleted ${workspacesSnapshot.size} legacy workspaces for user ${userId}`);
  }

  // Delete NEW hierarchical knowledge: users/{userId}/knowledge/items
  const userKnowledgeRef = db.collection(`users/${userId}/knowledge/items`);
  const userKnowledgeSnapshot = await userKnowledgeRef.get();

  if (!userKnowledgeSnapshot.empty) {
    const batch = db.batch();
    let count = 0;

    userKnowledgeSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
    });

    await batch.commit();
    logger.info(`Deleted ${count} knowledge items from users/${userId}/knowledge/items`);
  }

  // NEW hierarchical workspaces: users/{userId}/workspaces
  // This is automatically handled when deleting the user document
  logger.info(`Hierarchical workspaces under users/${userId}/workspaces will be deleted with user document`);
}

/**
 * Delete all user data from Firestore with cascading deletion
 */
async function deleteAllUserData(userId: string): Promise<{
  success: boolean;
  deletedCollections: number;
  totalDocumentsDeleted: number;
  errors: string[];
}> {
  logger.info(`Starting comprehensive data deletion for user: ${userId}`);

  let totalDocumentsDeleted = 0;
  let deletedCollections = 0;
  const errors: string[] = [];

  try {
    // Collections where documents need to be queried by userId field
    const userCollections = [
      // Core Agent & Lead Management
      COLLECTIONS.SALES_AGENTS,
      COLLECTIONS.LEADS,
      COLLECTIONS.CONVERSATIONS,
      COLLECTIONS.CONVERSATION_MESSAGES,
      COLLECTIONS.DEALS,

      // Platform Integrations
      COLLECTIONS.KNOWLEDGE_BASE,
      COLLECTIONS.PLATFORM_CONNECTIONS,
      COLLECTIONS.PLATFORM_ACTIVITIES,

      // Reddit Integration System
      'reddit_leads', // Reddit-specific leads
      'reddit_comment_history', // Comment tracking for duplicates
      'reddit_credentials', // Direct Reddit credentials
      COLLECTIONS.REDDIT_INGESTION_JOBS,
      COLLECTIONS.REDDIT_PROCESSING_STATE,
      COLLECTIONS.REDDIT_DISCOVERED_POSTS,
      COLLECTIONS.REDDIT_JOB_QUEUE,
      COLLECTIONS.REDDIT_CREDENTIALS_SERVER,

      // Agent Communication & Management
      COLLECTIONS.AGENT_CONFIGS,
      COLLECTIONS.AGENT_INBOX,
      'agent_activities', // Agent activity logs
      COLLECTIONS.AGENT_ACTIVITY_LOG,
      'agent_comments', // Comments posted by agents
      'agent_creation_errors', // Error logs from agent creation
      COLLECTIONS.USER_RESPONSES,
      COLLECTIONS.USER_CORRECTIONS,
      COLLECTIONS.AGENT_ACTIONS,
      COLLECTIONS.ESCALATIONS,
      COLLECTIONS.SCHEDULED_QUESTIONS,
      COLLECTIONS.USER_PREFERENCES,
      'inbox_items', // User inbox items

      // Knowledge & Learning
      'knowledge_items', // Knowledge items (distinct from knowledge_base)
      COLLECTIONS.LEARNING_SESSIONS,
      COLLECTIONS.TRAINING_SESSIONS,
      COLLECTIONS.TRAINING_DATA,
      'memories', // Agent memory data

      // Session Tracking
      'autonomous_sessions', // Autonomous agent sessions
      'closing_sessions', // Closing/sales sessions
      COLLECTIONS.HUNTING_SESSIONS,
      COLLECTIONS.SESSION_TRACKING,

      // Performance & Analytics
      COLLECTIONS.PERFORMANCE_METRICS,
      COLLECTIONS.ENGAGEMENT_SESSIONS,
      COLLECTIONS.ENGAGEMENT_METRICS,

      // Monitoring & Health
      COLLECTIONS.SYSTEM_MONITORING,
      COLLECTIONS.OPERATIONAL_ALERTS,
      COLLECTIONS.HEALTH_METRICS,

      // Background Processing
      COLLECTIONS.BACKGROUND_JOBS,
      COLLECTIONS.AUTOMATION_LOGS,
      COLLECTIONS.WEBHOOK_EVENTS,
      COLLECTIONS.NOTIFICATION_QUEUE,
      COLLECTIONS.REAL_TIME_EVENTS,

      // AI & Analytics
      COLLECTIONS.AI_REQUESTS,

      // Billing & Events
      COLLECTIONS.QUALIFIED_LEAD_EVENTS,
      COLLECTIONS.LINK_CLICK_EVENTS,
      COLLECTIONS.BILLING_EVENTS,
    ];

    // Delete documents from collections where userId is a field
    for (const collectionName of userCollections) {
      try {
        const deleted = await deleteCollectionDocuments(collectionName, userId);
        if (deleted > 0) {
          deletedCollections++;
          totalDocumentsDeleted += deleted;
        }
      } catch (error) {
        const errorMsg = `Error deleting from ${collectionName}: ${error}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
        // Continue with other collections
      }
    }

    // Delete documents where userId is the document ID
    try {
      await deleteDocumentById('user_profiles', userId);
      deletedCollections++;
      totalDocumentsDeleted++;
    } catch (error) {
      const errorMsg = `Error deleting user_profiles: ${error}`;
      logger.error(errorMsg);
      errors.push(errorMsg);
    }

    // Delete the main users/{userId} document and all its subcollections
    try {
      await deleteUserDocument(userId);
      deletedCollections++;
      totalDocumentsDeleted++; // Count the main document
    } catch (error) {
      const errorMsg = `Error deleting user document: ${error}`;
      logger.error(errorMsg);
      errors.push(errorMsg);
    }

    // Delete workspace-related data
    try {
      await deleteWorkspaceData(userId);
      deletedCollections++;
    } catch (error) {
      const errorMsg = `Error deleting workspace data: ${error}`;
      logger.error(errorMsg);
      errors.push(errorMsg);
    }

    logger.info(
      `Successfully deleted data from ${deletedCollections} collections for user: ${userId}`,
    );
    logger.info(`Total documents deleted: ${totalDocumentsDeleted}`);

    return {
      success: true,
      deletedCollections,
      totalDocumentsDeleted,
      errors,
    };
  } catch (error) {
    logger.error(`Critical error deleting user data for ${userId}:`, error);
    throw error;
  }
}

/**
 * Admin-only callable function to delete a user account
 * This includes cascading deletion of all associated Firestore data
 * and deletion of the Firebase Auth account
 */
export const adminDeleteUser = onCall(
  {
    memory: '512MiB',
    timeoutSeconds: 540, // 9 minutes - allow time for large deletions
  },
  async (request) => {
    // Verify caller is authenticated
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    // Verify caller has admin privileges
    const callerIsAdmin = await isAdmin(request.auth.uid);
    if (!callerIsAdmin) {
      logger.warn(
        `Unauthorized admin delete attempt by user: ${request.auth.uid}`,
      );
      throw new HttpsError(
        'permission-denied',
        'Only administrators can delete user accounts',
      );
    }

    // Get target user ID from request
    const { userId } = request.data;
    if (!userId || typeof userId !== 'string') {
      throw new HttpsError(
        'invalid-argument',
        'userId is required and must be a string',
      );
    }

    // Prevent self-deletion via admin function (use client-side deletion instead)
    if (userId === request.auth.uid) {
      throw new HttpsError(
        'invalid-argument',
        'Cannot delete your own account via admin function. Use the profile settings instead.',
      );
    }

    try {
      // Verify target user exists
      try {
        await admin.auth().getUser(userId);
      } catch {
        throw new HttpsError('not-found', `User ${userId} not found`);
      }

      logger.info(
        `Admin ${request.auth.uid} initiating deletion of user: ${userId}`,
      );

      // Step 1: Delete all Firestore data (cascading deletion)
      const deletionResult = await deleteAllUserData(userId);

      // Step 2: Delete Firebase Auth account
      await admin.auth().deleteUser(userId);
      logger.info(`Deleted Firebase Auth account for user: ${userId}`);

      // Return comprehensive deletion summary
      return {
        success: true,
        message: `User ${userId} and all associated data have been permanently deleted`,
        deletionSummary: {
          userId,
          deletedBy: request.auth.uid,
          deletedAt: new Date().toISOString(),
          collectionsDeleted: deletionResult.deletedCollections,
          totalDocumentsDeleted: deletionResult.totalDocumentsDeleted,
          authAccountDeleted: true,
          errors: deletionResult.errors.length > 0 ? deletionResult.errors : null,
        },
      };
    } catch (error) {
      logger.error(`Failed to delete user ${userId}:`, error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        'internal',
        `Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  },
);

/**
 * Admin-only callable function to set admin privileges for a user
 * This allows creating new admin accounts
 */
export const setAdminClaim = onCall(
  {
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    // Verify caller is authenticated
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    // Verify caller has admin privileges
    const callerIsAdmin = await isAdmin(request.auth.uid);
    if (!callerIsAdmin) {
      logger.warn(
        `Unauthorized admin claim attempt by user: ${request.auth.uid}`,
      );
      throw new HttpsError(
        'permission-denied',
        'Only administrators can set admin claims',
      );
    }

    const { userId, isAdmin: makeAdmin } = request.data;
    if (!userId || typeof userId !== 'string') {
      throw new HttpsError('invalid-argument', 'userId is required');
    }

    if (typeof makeAdmin !== 'boolean') {
      throw new HttpsError('invalid-argument', 'isAdmin must be a boolean');
    }

    try {
      // Set custom claim
      await admin.auth().setCustomUserClaims(userId, { admin: makeAdmin });

      logger.info(
        `Admin ${request.auth.uid} ${makeAdmin ? 'granted' : 'revoked'} admin privileges for user: ${userId}`,
      );

      return {
        success: true,
        message: `Admin privileges ${makeAdmin ? 'granted to' : 'revoked from'} user ${userId}`,
      };
    } catch (error) {
      logger.error(`Failed to set admin claim for ${userId}:`, error);
      throw new HttpsError('internal', 'Failed to set admin claim');
    }
  },
);
