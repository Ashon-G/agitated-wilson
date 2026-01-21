/**
 * Scheduled Cleanup of Orphaned User Data
 *
 * Automatically runs every week to find and delete data for users who were
 * deleted from Firebase Auth but still have data in Firestore.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Check if a Firebase Auth user exists
 */
async function userExists(userId: string): Promise<boolean> {
  try {
    await admin.auth().getUser(userId);
    return true;
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      return false;
    }
    throw error;
  }
}

/**
 * Find all user IDs that exist in Firestore but not in Firebase Auth
 */
async function findOrphanedUserIds(): Promise<string[]> {
  const db = admin.firestore();
  const userIds = new Set<string>();

  // Collections that contain userId field
  const collectionsToCheck = [
    'users',
    'sales_agents',
    'leads',
    'conversations',
    'knowledge_base',
    'platform_connections',
    'reddit_leads',
    'agent_inbox',
    'inbox_items',
  ];

  logger.info('Scanning Firestore for user IDs...');

  // Collect all unique user IDs from key collections
  for (const collectionName of collectionsToCheck) {
    try {
      if (collectionName === 'users') {
        const snapshot = await db.collection(collectionName).get();
        snapshot.forEach(doc => {
          userIds.add(doc.id);
        });
      } else {
        const snapshot = await db.collection(collectionName).limit(1000).get();
        snapshot.forEach(doc => {
          const { userId } = doc.data();
          if (userId) {
            userIds.add(userId);
          }
        });
      }
    } catch (error) {
      logger.error(`Error scanning ${collectionName}:`, error);
    }
  }

  logger.info(`Found ${userIds.size} unique user IDs in Firestore`);

  // Check which users don't exist in Firebase Auth
  const orphanedUsers: string[] = [];

  for (const userId of Array.from(userIds)) {
    try {
      const exists = await userExists(userId);
      if (!exists) {
        orphanedUsers.push(userId);
        logger.info(`Found orphaned user: ${userId}`);
      }
    } catch (error) {
      logger.error(`Error checking user ${userId}:`, error);
    }
  }

  logger.info(`Found ${orphanedUsers.length} orphaned users`);
  return orphanedUsers;
}

/**
 * Delete all data for a specific user
 */
async function deleteUserData(userId: string): Promise<{
  deletedCollections: number;
  totalDocumentsDeleted: number;
}> {
  const db = admin.firestore();
  let totalDocumentsDeleted = 0;
  let deletedCollections = 0;

  const userCollections = [
    'sales_agents',
    'leads',
    'conversations',
    'conversation_messages',
    'deals',
    'knowledge_base',
    'platform_connections',
    'platform_activities',
    'reddit_leads',
    'reddit_comment_history',
    'reddit_credentials',
    'reddit_ingestion_jobs',
    'reddit_processing_state',
    'reddit_discovered_posts',
    'reddit_job_queue',
    'agent_configs',
    'agent_inbox',
    'agent_activities',
    'user_responses',
    'inbox_items',
    'memories',
    'autonomous_sessions',
    'session_tracking',
    'performance_metrics',
    'background_jobs',
    'ai_requests',
  ];

  // Delete from collections where userId is a field
  for (const collectionName of userCollections) {
    try {
      const query = db.collection(collectionName).where('userId', '==', userId);
      const snapshot = await query.get();

      if (!snapshot.empty) {
        const batch = db.batch();
        let count = 0;

        snapshot.forEach(doc => {
          batch.delete(doc.ref);
          count++;
        });

        await batch.commit();
        logger.info(`Deleted ${count} documents from ${collectionName}`);
        totalDocumentsDeleted += count;
        deletedCollections++;
      }
    } catch (error) {
      logger.error(`Error deleting from ${collectionName}:`, error);
    }
  }

  // Delete main users document
  try {
    await db.collection('users').doc(userId).delete();
    logger.info(`Deleted users/${userId}`);
    totalDocumentsDeleted++;
    deletedCollections++;
  } catch (error: any) {
    if (error.code !== 'not-found') {
      logger.error('Error deleting users document:', error);
    }
  }

  return { deletedCollections, totalDocumentsDeleted };
}

/**
 * Scheduled function that runs every week
 * Schedule: Every Sunday at 3 AM UTC
 */
export const weeklyOrphanedDataCleanup = onSchedule(
  {
    schedule: 'every sunday 03:00',
    timeZone: 'UTC',
    memory: '1GiB',
    timeoutSeconds: 540, // 9 minutes
  },
  async event => {
    logger.info('🧹 Starting weekly orphaned data cleanup...');

    try {
      // Find orphaned users
      const orphanedUsers = await findOrphanedUserIds();

      if (orphanedUsers.length === 0) {
        logger.info('✅ No orphaned users found. All data is clean.');
        return;
      }

      logger.info(`Found ${orphanedUsers.length} orphaned users. Starting cleanup...`);

      // Delete data for each orphaned user
      let totalDocumentsDeleted = 0;

      for (const userId of orphanedUsers) {
        logger.info(`Cleaning up data for orphaned user: ${userId}`);
        const result = await deleteUserData(userId);
        totalDocumentsDeleted += result.totalDocumentsDeleted;
      }

      logger.info(
        `✅ Weekly cleanup complete! Deleted ${totalDocumentsDeleted} documents for ${orphanedUsers.length} orphaned users.`,
      );
    } catch (error) {
      logger.error('❌ Error during weekly cleanup:', error);
      throw error; // Re-throw to mark the function execution as failed
    }
  },
);
