/**
 * Quality Check & Inbox Delivery for Pending Comments
 *
 * NEW FLOW (Quality Control + Manual Approval):
 * 1. Cloud Function creates document in `pending_comments` with status: 'pending'
 * 2. This function triggers automatically on document creation
 * 3. Performs AI quality check using Gemini + Knowledge Base
 * 4. If approved by AI: Sends to user's inbox for manual approval
 * 5. User approves in inbox: Separate function posts to Reddit
 * 6. User rejects: Marks as rejected
 *
 * OLD FLOW (Auto-posting - DISABLED):
 * - No longer auto-posts to Reddit
 * - All comments must pass AI quality check + user approval
 */

import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';

const db = admin.firestore();

// Get Gemini API key from environment
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_VIBECODE_GOOGLE_API_KEY || '';

interface PendingComment {
  userId: string;
  postId: string;
  parentId?: string;
  commentText: string;
  subreddit: string;
  postTitle?: string;
  postContent?: string;
  postUrl?: string;
  leadId?: string;
  status: 'pending' | 'ai_reviewing' | 'ai_approved' | 'ai_rejected' | 'user_approved' | 'user_rejected' | 'posted' | 'failed';
  createdAt: admin.firestore.Timestamp;
  aiQualityCheck?: {
    approved: boolean;
    score: number;
    reason: string;
    checkedAt: admin.firestore.Timestamp;
  };
  userApproval?: {
    approved: boolean;
    approvedAt: admin.firestore.Timestamp;
  };
}

interface KnowledgeItem {
  id: string;
  content: string;
  title?: string;
  category?: string;
}

/**
 * Fetch user's knowledge base from Firestore
 */
async function fetchKnowledgeBase(userId: string): Promise<KnowledgeItem[]> {
  try {
    // Query from users/{userId}/knowledge/items subcollection
    const knowledgeSnapshot = await db
      .collection(`users/${userId}/knowledge/items`)
      .limit(20) // Limit to avoid token limits
      .get();

    const knowledgeItems: KnowledgeItem[] = [];
    knowledgeSnapshot.forEach((doc) => {
      const data = doc.data();
      knowledgeItems.push({
        id: doc.id,
        content: data.content || '',
        title: data.title,
        category: data.category,
      });
    });

    console.log(`📚 Fetched ${knowledgeItems.length} knowledge items for user ${userId}`);
    return knowledgeItems;
  } catch (error) {
    console.error('Failed to fetch knowledge base:', error);
    return [];
  }
}

/**
 * Perform AI quality check using Gemini
 */
async function performAIQualityCheck(
  comment: PendingComment,
  knowledgeBase: KnowledgeItem[],
): Promise<{ approved: boolean; score: number; reason: string }> {
  try {
    if (!GEMINI_API_KEY) {
      console.error('⚠️ GEMINI_API_KEY not configured - skipping AI quality check');
      return {
        approved: true, // Default to approved if no API key
        score: 0.5,
        reason: 'AI quality check skipped - no API key configured',
      };
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Build knowledge context
    const knowledgeContext = knowledgeBase
      .map((item, index) => `${index + 1}. ${item.title || 'Knowledge'}: ${item.content}`)
      .join('\n\n');

    const prompt = `You are a Reddit comment quality checker. Analyze this AI-generated comment to determine if it should be posted.

KNOWLEDGE BASE (Company/Product Information):
${knowledgeContext || 'No knowledge base provided.'}

REDDIT POST:
Title: ${comment.postTitle || 'N/A'}
Content: ${comment.postContent || 'N/A'}
Subreddit: r/${comment.subreddit}
URL: ${comment.postUrl || 'N/A'}

AI-GENERATED COMMENT:
${comment.commentText}

QUALITY CRITERIA:
1. **Relevance**: Does the comment directly address the post content?
2. **Accuracy**: Is the information accurate based on the knowledge base?
3. **Tone**: Is the tone appropriate, helpful, and not overly promotional?
4. **Value**: Does it provide genuine value to the discussion?
5. **Natural**: Does it sound natural and human-like (not robotic/spammy)?
6. **Knowledge Alignment**: Does it accurately represent the knowledge base?

REJECTION REASONS:
- Off-topic or irrelevant to the post
- Contains inaccurate information not supported by knowledge base
- Too promotional or salesy
- Spammy or low-quality
- Could be perceived as bot-generated
- Misrepresents the knowledge base

Respond in this EXACT JSON format:
{
  "approved": true/false,
  "score": 0.0-1.0,
  "reason": "Brief explanation (max 100 chars)"
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log('🤖 Gemini raw response:', responseText);

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse Gemini response as JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      approved: parsed.approved === true,
      score: parseFloat(parsed.score) || 0,
      reason: parsed.reason || 'No reason provided',
    };
  } catch (error) {
    console.error('❌ AI quality check failed:', error);
    // Default to requiring manual review on error
    return {
      approved: false,
      score: 0,
      reason: 'AI quality check error - requires manual review',
    };
  }
}

/**
 * Send comment to user's inbox for approval
 */
async function sendToInbox(
  userId: string,
  comment: PendingComment,
  aiCheck: { approved: boolean; score: number; reason: string },
): Promise<void> {
  try {
    // Create inbox message
    const inboxMessage = {
      userId,
      type: 'comment_approval',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      pendingCommentId: comment.postId, // Reference to the pending comment doc

      // Post information
      post: {
        title: comment.postTitle || 'Unknown Post',
        content: comment.postContent || '',
        subreddit: comment.subreddit,
        postId: comment.postId,
        url: comment.postUrl || '',
      },

      // Comment information
      comment: {
        text: comment.commentText,
        parentId: comment.parentId,
      },

      // AI quality check results
      aiQualityCheck: {
        approved: aiCheck.approved,
        score: aiCheck.score,
        reason: aiCheck.reason,
      },

      // Lead context if available
      leadId: comment.leadId,
    };

    await db.collection('agent_inbox').add(inboxMessage);

    console.log(`📬 Sent comment to inbox for user ${userId}`);
  } catch (error) {
    console.error('Failed to send to inbox:', error);
    throw error;
  }
}

/**
 * Cloud Function: Triggered when a new pending_comments document is created
 * Performs AI quality check and sends to user inbox for approval
 */
export const onPendingCommentCreated = onDocumentCreated(
  {
    document: 'pending_comments/{commentId}',
    memory: '512MiB',
    timeoutSeconds: 120,
    maxInstances: 10,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log('No data in event');
      return;
    }

    const { commentId } = event.params;
    const comment = snapshot.data() as PendingComment;

    console.log(`🔍 Processing pending comment ${commentId} for user ${comment.userId}`);

    // Validate required fields
    if (!comment.userId || !comment.postId || !comment.commentText) {
      console.error(`Invalid pending comment ${commentId}: missing required fields`);
      await snapshot.ref.update({
        status: 'failed',
        error: 'Missing required fields (userId, postId, or commentText)',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    // Skip if not pending
    if (comment.status !== 'pending') {
      console.log(`Comment ${commentId} is not pending (status: ${comment.status}), skipping`);
      return;
    }

    try {
      // Update status to 'ai_reviewing'
      await snapshot.ref.update({
        status: 'ai_reviewing',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Fetch knowledge base
      const knowledgeBase = await fetchKnowledgeBase(comment.userId);

      // Perform AI quality check
      const aiCheck = await performAIQualityCheck(comment, knowledgeBase);

      console.log(`🤖 AI Quality Check: ${aiCheck.approved ? '✅ APPROVED' : '❌ REJECTED'} (score: ${aiCheck.score}) - ${aiCheck.reason}`);

      if (aiCheck.approved) {
        // AI approved - send to user inbox for manual approval
        await sendToInbox(comment.userId, comment, aiCheck);

        await snapshot.ref.update({
          status: 'ai_approved',
          aiQualityCheck: {
            approved: aiCheck.approved,
            score: aiCheck.score,
            reason: aiCheck.reason,
            checkedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`✅ Comment ${commentId} passed AI check and sent to inbox`);
      } else {
        // AI rejected - mark as rejected
        await snapshot.ref.update({
          status: 'ai_rejected',
          aiQualityCheck: {
            approved: aiCheck.approved,
            score: aiCheck.score,
            reason: aiCheck.reason,
            checkedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`❌ Comment ${commentId} rejected by AI: ${aiCheck.reason}`);
      }
    } catch (error) {
      console.error(`Error processing comment ${commentId}:`, error);

      await snapshot.ref.update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error during AI quality check',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  },
);
