/**
 * User-Agent Communication Functions
 * Allow users to communicate directly with their AI agent
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { knowledgeBaseQuery } from './knowledgeBaseQuery';

const db = admin.firestore();

/**
 * User asks agent a question
 * POST /userAgentChat
 */
export const userAgentChat = onCall(
  {
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const userId = request.auth.uid;
    const { message, conversationId } = request.data;

    if (!message) {
      throw new HttpsError('invalid-argument', 'message is required');
    }

    try {
      // Create or get conversation
      let convId = conversationId;
      if (!convId) {
        const convRef = await db.collection('user_agent_conversations').add({
          userId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          messageCount: 0,
        });
        convId = convRef.id;
      }

      // Save user message
      await db
        .collection('user_agent_conversations')
        .doc(convId)
        .collection('messages')
        .add({
          role: 'user',
          content: message,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

      // Get conversation history
      const historySnapshot = await db
        .collection('user_agent_conversations')
        .doc(convId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .limit(20)
        .get();

      const history = historySnapshot.docs.map((doc) => ({
        role: doc.data().role,
        content: doc.data().content,
      }));

      // Get user's knowledge base for context
      const userDoc = await db.collection('users').doc(userId).get();
      const workspace = userDoc.data()?.workspace || {};

      // Build AI prompt
      const systemPrompt = buildAgentSystemPrompt(workspace);

      // Call AI service
      const aiResponse = await callAIService([
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: message },
      ]);

      // Save agent response
      await db
        .collection('user_agent_conversations')
        .doc(convId)
        .collection('messages')
        .add({
          role: 'assistant',
          content: aiResponse,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

      // Update conversation
      await db
        .collection('user_agent_conversations')
        .doc(convId)
        .update({
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          messageCount: admin.firestore.FieldValue.increment(2),
        });

      return {
        success: true,
        conversationId: convId,
        response: aiResponse,
      };
    } catch (error) {
      console.error('Error in userAgentChat:', error);
      throw new HttpsError('internal', 'Failed to process message');
    }
  },
);

/**
 * Get user-agent conversation history
 * GET /getUserAgentConversations
 */
export const getUserAgentConversations = onCall(
  {
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const userId = request.auth.uid;
    const { conversationId, limit = 50 } = request.data;

    try {
      if (conversationId) {
        // Get specific conversation
        const messagesSnapshot = await db
          .collection('user_agent_conversations')
          .doc(conversationId)
          .collection('messages')
          .orderBy('timestamp', 'asc')
          .limit(limit)
          .get();

        const messages = messagesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        return {
          success: true,
          conversationId,
          messages,
        };
      } else {
        // Get all conversations for user
        const conversationsSnapshot = await db
          .collection('user_agent_conversations')
          .where('userId', '==', userId)
          .orderBy('lastMessageAt', 'desc')
          .limit(10)
          .get();

        const conversations = await Promise.all(
          conversationsSnapshot.docs.map(async (doc) => {
            // Get last message for preview
            const lastMessageSnapshot = await db
              .collection('user_agent_conversations')
              .doc(doc.id)
              .collection('messages')
              .orderBy('timestamp', 'desc')
              .limit(1)
              .get();

            const lastMessage = lastMessageSnapshot.docs[0]?.data();

            return {
              id: doc.id,
              ...doc.data(),
              lastMessage: lastMessage?.content || '',
            };
          }),
        );

        return {
          success: true,
          conversations,
        };
      }
    } catch (error) {
      console.error('Error in getUserAgentConversations:', error);
      throw new HttpsError('internal', 'Failed to get conversations');
    }
  },
);

/**
 * Agent asks user a question (for knowledge gaps)
 * This is called when agent needs clarification
 */
export const agentAskUser = onCall(
  {
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const userId = request.auth.uid;
    const { question, context: questionContext, priority = 'medium' } = request.data;

    if (!question) {
      throw new HttpsError('invalid-argument', 'question is required');
    }

    try {
      // Create agent question record
      const questionRef = await db.collection('agent_questions').add({
        userId,
        question,
        context: questionContext || {},
        priority,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Send push notification to user
      const { pushNotificationService } = await import('./pushNotificationService');
      await pushNotificationService.sendVisibleNotification(userId, {
        title: 'Your Agent Has a Question',
        body: question,
        data: {
          type: 'agent_question',
          questionId: questionRef.id,
          priority,
        },
      });

      return {
        success: true,
        questionId: questionRef.id,
        message: 'Question sent to user',
      };
    } catch (error) {
      console.error('Error in agentAskUser:', error);
      throw new HttpsError('internal', 'Failed to send question');
    }
  },
);

/**
 * User responds to agent question
 */
export const respondToAgentQuestion = onCall(
  {
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const userId = request.auth.uid;
    const { questionId, answer, addToKnowledge = true } = request.data;

    if (!questionId || !answer) {
      throw new HttpsError('invalid-argument', 'questionId and answer required');
    }

    try {
      // Update question with answer
      await db.collection('agent_questions').doc(questionId).update({
        answer,
        status: 'answered',
        answeredAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Optionally add to knowledge base
      if (addToKnowledge) {
        const questionDoc = await db.collection('agent_questions').doc(questionId).get();
        const questionData = questionDoc.data();

        await db.collection(`users/${userId}/knowledge/items`).add({
          userId,
          title: questionData?.question || 'User Response',
          content: answer,
          type: 'text',
          category: 'agent_learned',
          tags: ['agent_question', 'user_input'],
          isActive: true,
          source: 'agent_question',
          sourceId: questionId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return {
        success: true,
        message: 'Answer recorded',
      };
    } catch (error) {
      console.error('Error in respondToAgentQuestion:', error);
      throw new HttpsError('internal', 'Failed to record answer');
    }
  },
);

/**
 * Get pending agent questions for user
 */
export const getPendingAgentQuestions = onCall(
  {
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const userId = request.auth.uid;

    try {
      const questionsSnapshot = await db
        .collection('agent_questions')
        .where('userId', '==', userId)
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();

      const questions = questionsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return {
        success: true,
        questions,
        count: questions.length,
      };
    } catch (error) {
      console.error('Error in getPendingAgentQuestions:', error);
      throw new HttpsError('internal', 'Failed to get questions');
    }
  },
);

/**
 * Webhook: Trigger when agent needs user input
 * This allows Cloud Function workflows to pause and wait for user response
 */
export const agentNeedsInput = onRequest(
  {
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (req, res) => {
    // Verify webhook token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token || token !== process.env.WEBHOOK_TOKEN) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const { userId, question, context: questionContext, webhookUrl } = req.body;

      if (!userId || !question) {
        res.status(400).json({ error: 'userId and question required' });
        return;
      }

      // Create agent question with webhook URL
      const questionRef = await db.collection('agent_questions').add({
        userId,
        question,
        context: questionContext || {},
        priority: 'high',
        status: 'pending',
        webhookUrl, // Cloud Function will be notified at this URL when answered
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Send push notification
      const { pushNotificationService } = await import('./pushNotificationService');
      await pushNotificationService.sendVisibleNotification(userId, {
        title: 'Your Agent Needs Your Help',
        body: question,
        data: {
          type: 'agent_question',
          questionId: questionRef.id,
          priority: 'high',
        },
      });

      res.json({
        success: true,
        questionId: questionRef.id,
        message: 'User will be notified',
      });
    } catch (error) {
      console.error('Error in Cloud FunctionAgentNeedsInput:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

/**
 * Helper: Build agent system prompt
 */
function buildAgentSystemPrompt(workspace: any): string {
  const productName = workspace.product_name || 'your product';
  const productDescription = workspace.product_description || '';
  const companyName = workspace.company_name || 'your company';

  return `You are an AI sales agent helping ${companyName} find and engage with potential customers on Reddit.

PRODUCT/SERVICE:
Name: ${productName}
${productDescription ? `Description: ${productDescription}` : ''}

YOUR ROLE:
- Help the user understand your activities and progress
- Answer questions about leads, conversations, and strategy
- Provide insights on what's working and what's not
- Ask for guidance when you need more information
- Be transparent about your capabilities and limitations

COMMUNICATION STYLE:
- Be professional but friendly
- Provide specific, actionable information
- Be honest about uncertainties
- Ask clarifying questions when needed
- Use data to support your insights`;
}

/**
 * Helper: Call AI service
 */
async function callAIService(messages: any[]): Promise<string> {
  try {
    const axios = (await import('axios')).default;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 1000,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('AI service error:', error);
    throw new Error('AI service unavailable');
  }
}
