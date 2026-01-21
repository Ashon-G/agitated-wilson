/**
 * Approve Comment Cloud Function
 *
 * Posts approved comments to Reddit after user confirmation
 * Called when user approves a comment from their inbox
 */

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

const db = admin.firestore();

// Reddit API constants
const REDDIT_TOKEN_ENDPOINT = 'https://www.reddit.com/api/v1/access_token';
const REDDIT_API_BASE = 'https://oauth.reddit.com';
const USER_AGENT = 'Tava:com.vashon.vatas:v1.0.0 (by /u/tavaapp)';

// Get Reddit Client ID from environment
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID || process.env.EXPO_PUBLIC_REDDIT_CLIENT_ID || '';

interface RedditTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Encode string to base64
 */
function toBase64(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64');
}

/**
 * Refresh Reddit access token using refresh token
 */
async function refreshRedditToken(
  refreshToken: string,
  clientId: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number } | null> {
  try {
    const basicAuth = toBase64(`${clientId}:`);

    const response = await fetch(REDDIT_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token refresh failed:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const expiresAt = Date.now() + data.expires_in * 1000;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt,
    };
  } catch (error) {
    console.error('Error refreshing Reddit token:', error);
    return null;
  }
}

/**
 * Get valid Reddit access token for a user
 */
async function getValidAccessToken(userId: string): Promise<string | null> {
  try {
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      console.error(`User ${userId} not found in users collection`);
      return null;
    }

    const userData = userDoc.data();
    const redditAccount = userData?.redditAccount as RedditTokens | undefined;

    if (!redditAccount || !redditAccount.accessToken) {
      console.error(`User ${userId} has no Reddit account connected`);
      return null;
    }

    const { accessToken, refreshToken, expiresAt } = redditAccount;

    // Check if token is expired or will expire in next 5 minutes
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (now >= expiresAt - fiveMinutes) {
      console.log(`Token expired for user ${userId}, refreshing...`);

      if (!REDDIT_CLIENT_ID) {
        console.error('REDDIT_CLIENT_ID not configured');
        return null;
      }

      const newTokens = await refreshRedditToken(refreshToken, REDDIT_CLIENT_ID);

      if (!newTokens) {
        console.error(`Failed to refresh token for user ${userId}`);
        return null;
      }

      // Update Firestore with new tokens
      await db
        .collection('users')
        .doc(userId)
        .update({
          'redditAccount.accessToken': newTokens.accessToken,
          'redditAccount.refreshToken': newTokens.refreshToken,
          'redditAccount.expiresAt': newTokens.expiresAt,
        });

      console.log(`Token refreshed for user ${userId}`);
      return newTokens.accessToken;
    }

    return accessToken;
  } catch (error) {
    console.error(`Error getting access token for user ${userId}:`, error);
    return null;
  }
}

/**
 * Post comment to Reddit
 */
async function postCommentToReddit(
  accessToken: string,
  postId: string,
  commentText: string,
  parentId?: string,
): Promise<{ success: boolean; commentId?: string; permalink?: string; error?: string }> {
  try {
    // Determine what we're replying to
    let thingId: string;
    if (parentId) {
      thingId = parentId.startsWith('t1_') ? parentId : `t1_${parentId}`;
    } else {
      thingId = postId.startsWith('t3_') ? postId : `t3_${postId}`;
    }

    console.log(`Posting comment to Reddit thing_id: ${thingId}`);

    const response = await fetch(`${REDDIT_API_BASE}/api/comment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        thing_id: thingId,
        text: commentText,
        api_type: 'json',
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Reddit API error:', response.status, errorText);

      if (response.status === 401) {
        return {
          success: false,
          error: 'Reddit authentication expired - user needs to reconnect',
        };
      }
      if (response.status === 403) {
        return {
          success: false,
          error: 'Not allowed to post in this subreddit - may be banned or restricted',
        };
      }
      if (response.status === 429) {
        return {
          success: false,
          error: 'Rate limited by Reddit - try again later',
        };
      }

      return {
        success: false,
        error: `Reddit API error: ${response.status}`,
      };
    }

    const data = await response.json();

    // Check for Reddit API errors in response
    if (data.json?.errors?.length > 0) {
      const errors = data.json.errors.map((e: string[]) => e[1]).join(', ');
      console.error('Reddit returned errors:', errors);
      return {
        success: false,
        error: errors,
      };
    }

    // Extract comment ID and permalink
    const commentData = data.json?.data?.things?.[0]?.data;
    if (commentData) {
      return {
        success: true,
        commentId: commentData.id ? `t1_${commentData.id}` : undefined,
        permalink: commentData.permalink ? `https://reddit.com${commentData.permalink}` : undefined,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error posting to Reddit:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Cloud Function: Approve and post comment to Reddit
 */
export const approveAndPostComment = onCall(
  {
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { pendingCommentId } = request.data;

    if (!pendingCommentId) {
      throw new HttpsError('invalid-argument', 'pendingCommentId is required');
    }

    const userId = request.auth.uid;

    try {
      // Get pending comment
      const commentRef = db.collection('pending_comments').doc(pendingCommentId);
      const commentDoc = await commentRef.get();

      if (!commentDoc.exists) {
        throw new HttpsError('not-found', 'Pending comment not found');
      }

      const comment = commentDoc.data();

      // Verify ownership
      if (comment?.userId !== userId) {
        throw new HttpsError('permission-denied', 'Not authorized to approve this comment');
      }

      // Check if already posted
      if (comment.status === 'posted' || comment.status === 'user_approved') {
        throw new HttpsError('failed-precondition', 'Comment already posted or approved');
      }

      // Update status to posting
      await commentRef.update({
        status: 'posting',
        userApproval: {
          approved: true,
          approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Get valid access token
      const accessToken = await getValidAccessToken(userId);

      if (!accessToken) {
        await commentRef.update({
          status: 'failed',
          error: 'Could not get valid Reddit access token - user may need to reconnect',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        throw new HttpsError('failed-precondition', 'Reddit authentication required');
      }

      // Post to Reddit
      const result = await postCommentToReddit(
        accessToken,
        comment.postId,
        comment.commentText,
        comment.parentId,
      );

      if (result.success) {
        // Update with success
        await commentRef.update({
          status: 'posted',
          postedAt: admin.firestore.FieldValue.serverTimestamp(),
          redditCommentId: result.commentId || null,
          redditPermalink: result.permalink || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`✅ Successfully posted comment ${pendingCommentId} to Reddit: ${result.commentId}`);

        return {
          success: true,
          commentId: result.commentId,
          permalink: result.permalink,
        };
      } else {
        // Update with failure
        await commentRef.update({
          status: 'failed',
          error: result.error,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        throw new HttpsError('internal', result.error || 'Failed to post comment to Reddit');
      }
    } catch (error) {
      console.error(`Error approving comment ${pendingCommentId}:`, error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
  },
);

/**
 * Cloud Function: Reject comment
 */
export const rejectComment = onCall(
  {
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { pendingCommentId } = request.data;

    if (!pendingCommentId) {
      throw new HttpsError('invalid-argument', 'pendingCommentId is required');
    }

    const userId = request.auth.uid;

    try {
      // Get pending comment
      const commentRef = db.collection('pending_comments').doc(pendingCommentId);
      const commentDoc = await commentRef.get();

      if (!commentDoc.exists) {
        throw new HttpsError('not-found', 'Pending comment not found');
      }

      const comment = commentDoc.data();

      // Verify ownership
      if (comment?.userId !== userId) {
        throw new HttpsError('permission-denied', 'Not authorized to reject this comment');
      }

      // Update status to user_rejected
      await commentRef.update({
        status: 'user_rejected',
        userApproval: {
          approved: false,
          approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`❌ User rejected comment ${pendingCommentId}`);

      return { success: true };
    } catch (error) {
      console.error(`Error rejecting comment ${pendingCommentId}:`, error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
  },
);
