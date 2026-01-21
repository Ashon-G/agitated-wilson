/**
 * Conversation Agent Service
 *
 * Handles automated DM conversations with Reddit leads.
 * Uses Gemini AI to generate natural responses and collect emails when HubSpot is connected.
 *
 * Features:
 * - Automated DM response generation
 * - Email collection workflow (when HubSpot is connected)
 * - Conversation state tracking
 * - Sentiment analysis
 */

import GeminiService from './GeminiService';
import RedditAPIService from './RedditAPIService';
import BackendService from './BackendService';
import LeadHuntingService from './LeadHuntingService';
import { auth } from '../config/firebase';

export type ConversationStage =
  | 'not_started'
  | 'building_rapport'
  | 'ready_to_ask'
  | 'asked'
  | 'collected'
  | 'not_interested';

export interface ConversationMessage {
  id: string;
  sender: 'user' | 'lead';
  text: string;
  timestamp: Date;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface LeadConversation {
  id?: string;
  leadId: string;
  userId: string;
  leadUsername: string;
  stage: ConversationStage;
  messages: ConversationMessage[];
  originalPost?: {
    title: string;
    subreddit: string;
    url: string;
  };
  collectedEmail?: string;
  hubspotContactId?: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
}

class ConversationAgentService {
  /**
   * Process an incoming DM from a lead and generate a response
   */
  async processIncomingMessage(
    conversationId: string,
    incomingMessage: string,
    knowledgeContext: string,
    options: { collectEmail: boolean },
  ): Promise<{ response: string; newStage: ConversationStage; extractedEmail?: string }> {
    try {
      // Get the conversation
      const conversation = await this.getConversation(conversationId);

      if (!conversation) {
        console.error('🔴 [ConversationAgent] Conversation not found:', conversationId);
        return { response: '', newStage: 'building_rapport' };
      }

      // Analyze incoming message
      const analysis = await GeminiService.analyzeMessage(incomingMessage);

      // Add incoming message to conversation
      const newMessage: ConversationMessage = {
        id: `msg_${Date.now()}`,
        sender: 'lead',
        text: incomingMessage,
        timestamp: new Date(),
        sentiment: analysis.sentiment,
      };

      conversation.messages.push(newMessage);

      // Check if email was in the message
      if (analysis.hasEmail && analysis.extractedEmail) {
        await this.updateConversation(conversationId, {
          messages: conversation.messages,
          collectedEmail: analysis.extractedEmail,
          stage: 'collected',
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        });

        return {
          response: "Thanks for sharing your email! I'll send you some helpful information shortly.",
          newStage: 'collected',
          extractedEmail: analysis.extractedEmail,
        };
      }

      // Check if lead is not interested
      if (analysis.intent === 'not_interested') {
        await this.updateConversation(conversationId, {
          messages: conversation.messages,
          stage: 'not_interested',
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        });

        return {
          response: 'No problem at all! Feel free to reach out if you ever have questions. Best of luck!',
          newStage: 'not_interested',
        };
      }

      // Map stage for email collection (exclude 'not_interested' which isn't valid for email collection)
      const emailStage = conversation.stage === 'not_interested' ? 'not_started' : conversation.stage;

      // Generate AI response
      const aiResponse = await GeminiService.generateDMResponse(
        {
          messages: conversation.messages.map(m => ({
            sender: m.sender,
            text: m.text,
          })),
          leadContext: {
            username: conversation.leadUsername,
            originalPost: conversation.originalPost?.title,
            previousInteractions: conversation.messages.length,
          },
        },
        knowledgeContext,
        {
          collectEmail: options.collectEmail,
          emailCollectionStage: emailStage,
        },
      );

      // Add response to messages
      const responseMessage: ConversationMessage = {
        id: `msg_${Date.now() + 1}`,
        sender: 'user',
        text: aiResponse.response,
        timestamp: new Date(),
      };

      conversation.messages.push(responseMessage);

      // Update conversation
      await this.updateConversation(conversationId, {
        messages: conversation.messages,
        stage: aiResponse.nextStage,
        collectedEmail: aiResponse.extractedEmail || conversation.collectedEmail,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        response: aiResponse.response,
        newStage: aiResponse.nextStage,
        extractedEmail: aiResponse.extractedEmail,
      };
    } catch (error) {
      console.error('🔴 [ConversationAgent] Error processing message:', error);
      return { response: '', newStage: 'building_rapport' };
    }
  }

  /**
   * Start a new conversation with a lead
   */
  async startConversation(
    userId: string,
    leadUsername: string,
    initialMessage: string,
    context?: {
      leadId?: string;
      originalPost?: { title: string; subreddit: string; url: string };
    },
  ): Promise<string | null> {
    try {
      // Send the DM
      const result = await LeadHuntingService.sendDM(
        leadUsername,
        'Quick question',
        initialMessage,
      );

      if (!result.success) {
        console.error('🔴 [ConversationAgent] Failed to send initial DM:', result.error);
        return null;
      }

      // Create conversation record
      const conversation: Omit<LeadConversation, 'id'> = {
        leadId: context?.leadId || '',
        userId,
        leadUsername,
        stage: 'building_rapport',
        messages: [
          {
            id: `msg_${Date.now()}`,
            sender: 'user',
            text: initialMessage,
            timestamp: new Date(),
          },
        ],
        originalPost: context?.originalPost,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastMessageAt: new Date(),
      };

      const result2 = await BackendService.createDocument<LeadConversation>(
        'lead_conversations',
        conversation,
      );

      console.log(`✅ [ConversationAgent] Started conversation with u/${leadUsername}`);

      return result2.id ?? null;
    } catch (error) {
      console.error('🔴 [ConversationAgent] Error starting conversation:', error);
      return null;
    }
  }

  /**
   * Send a response in an existing conversation
   */
  async sendResponse(
    conversationId: string,
    responseText: string,
  ): Promise<boolean> {
    try {
      const conversation = await this.getConversation(conversationId);

      if (!conversation) {
        console.error('🔴 [ConversationAgent] Conversation not found');
        return false;
      }

      // Get the last message from lead to reply to
      const leadMessages = conversation.messages.filter(m => m.sender === 'lead');
      if (leadMessages.length === 0) {
        // This is a new outbound message, use sendDM
        const result = await LeadHuntingService.sendDM(
          conversation.leadUsername,
          'Re: Quick question',
          responseText,
        );
        return result.success;
      }

      // Send reply via Reddit API
      const result = await RedditAPIService.sendReply(
        `t4_${leadMessages[leadMessages.length - 1].id}`,
        responseText,
      );

      if (!result.success) {
        console.error('🔴 [ConversationAgent] Failed to send response:', result.error);
        return false;
      }

      // Add message to conversation
      const newMessage: ConversationMessage = {
        id: `msg_${Date.now()}`,
        sender: 'user',
        text: responseText,
        timestamp: new Date(),
      };

      await this.updateConversation(conversationId, {
        messages: [...conversation.messages, newMessage],
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      });

      return true;
    } catch (error) {
      console.error('🔴 [ConversationAgent] Error sending response:', error);
      return false;
    }
  }

  /**
   * Get a conversation by ID
   */
  async getConversation(conversationId: string): Promise<LeadConversation | null> {
    try {
      return await BackendService.getDocument<LeadConversation>('lead_conversations', conversationId);
    } catch (error) {
      console.error('🔴 [ConversationAgent] Error getting conversation:', error);
      return null;
    }
  }

  /**
   * Update a conversation
   */
  async updateConversation(
    conversationId: string,
    updates: Partial<LeadConversation>,
  ): Promise<boolean> {
    try {
      await BackendService.updateDocument('lead_conversations', conversationId, updates);
      return true;
    } catch (error) {
      console.error('🔴 [ConversationAgent] Error updating conversation:', error);
      return false;
    }
  }

  /**
   * Get all active conversations for a user
   */
  async getActiveConversations(userId: string): Promise<LeadConversation[]> {
    try {
      const conversations = await BackendService.queryCollection<LeadConversation>(
        'lead_conversations',
        {
          where: [
            { field: 'userId', operator: '==', value: userId },
          ],
          orderBy: { field: 'lastMessageAt', direction: 'desc' },
          limit: 50,
        },
      );

      // Filter out completed/not_interested conversations
      return conversations.filter(
        c => c.stage !== 'collected' && c.stage !== 'not_interested',
      );
    } catch (error) {
      console.error('🔴 [ConversationAgent] Error getting active conversations:', error);
      return [];
    }
  }

  /**
   * Check for new messages and process them automatically
   */
  async checkAndProcessNewMessages(
    userId: string,
    knowledgeContext: string,
    options: { collectEmail: boolean },
  ): Promise<number> {
    try {
      // Get unread messages from Reddit
      const result = await RedditAPIService.fetchUnreadMessages();

      if (!result.success || !result.data) {
        return 0;
      }

      let processedCount = 0;

      for (const message of result.data) {
        // Only process private messages (DMs)
        if (message.type !== 'private_message') {
          continue;
        }

        // Find existing conversation with this user
        const conversations = await BackendService.queryCollection<LeadConversation>(
          'lead_conversations',
          {
            where: [
              { field: 'userId', operator: '==', value: userId },
              { field: 'leadUsername', operator: '==', value: message.author },
            ],
            limit: 1,
          },
        );

        if (conversations.length > 0) {
          const conversation = conversations[0];

          // Skip if conversation is complete
          if (conversation.stage === 'collected' || conversation.stage === 'not_interested') {
            continue;
          }

          // Process the message
          const response = await this.processIncomingMessage(
            conversation.id!,
            message.body,
            knowledgeContext,
            options,
          );

          // Send the response
          if (response.response) {
            await this.sendResponse(conversation.id!, response.response);
          }

          // Mark as read
          await RedditAPIService.markMessageAsRead(message.id);

          processedCount++;
        }
      }

      return processedCount;
    } catch (error) {
      console.error('🔴 [ConversationAgent] Error processing new messages:', error);
      return 0;
    }
  }

  /**
   * Generate an initial outreach message for a lead
   */
  async generateInitialMessage(
    post: { title: string; content: string; subreddit: string },
    knowledgeContext: string,
  ): Promise<string> {
    const prompt = `Generate a friendly initial DM to send to someone who posted on Reddit.
The goal is to start a helpful conversation, NOT to sell.

Their post:
Subreddit: r/${post.subreddit}
Title: ${post.title}
Content: ${post.content}

Your knowledge (use subtly):
${knowledgeContext}

Rules:
1. Reference their specific post/question
2. Offer genuine help or insight
3. Be conversational and friendly
4. Keep it short (2-3 sentences)
5. Don't mention any products or services
6. Don't be salesy at all
7. End with an open question to encourage response

Generate only the message text, no JSON or formatting.`;

    try {
      const response = await GeminiService.generateContent(prompt);
      return response.trim();
    } catch (error) {
      console.error('🔴 [ConversationAgent] Error generating initial message:', error);
      return '';
    }
  }
}

export default new ConversationAgentService();
