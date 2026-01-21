/**
 * Conversation Service
 *
 * Handles conversation management, lead interactions, and agent communication.
 * Separated from AgentInboxService for better maintainability.
 *
 * @version 1.0.0
 * @author PaynaAI Team
 */

import InboxService from './InboxService';
import { getOpenAITextResponse } from '../../api/chat-service';
import { AIMessage } from '../../types/ai';
import {
  AgentInboxItem,
  ConversationContext,
  Conversation,
  Lead,
} from '../../types/agent';

class ConversationService {
  /**
   * Create a conversation notification
   */
  async createConversationNotification(
    userId: string,
    agentId: string,
    conversation: Conversation,
    context?: ConversationContext,
  ): Promise<AgentInboxItem> {
    try {
      const inboxItem = await InboxService.createInboxItem({
        userId,
        agentId,
        type: 'update',
        status: 'pending',
        priority: this.determineConversationPriority(conversation),
        urgencyLevel: this.determineUrgencyLevel(conversation.priority),
        content: {
          title: '💬 New conversation with Lead',
          description: this.generateConversationSummary(conversation),
          context: {
            leadInfo: {
              name: 'Lead',
              qualification: null,
            },
            conversationHistory: conversation.messages,
            currentStage: conversation.context.stage,
            agentIntent: conversation.context.currentObjective,
            blockers: conversation.state.blockers,
            ...context,
          },
        },
      });

      console.log(`Conversation notification created for conversation ${conversation.id}`);
      return inboxItem;
    } catch (error) {
      console.error('Failed to create conversation notification:', error);
      throw error;
    }
  }

  /**
   * Create a lead notification
   */
  async createLeadNotification(
    userId: string,
    agentId: string,
    lead: Lead,
    context?: {
      source?: string;
      qualificationScore?: number;
      urgency?: 'low' | 'medium' | 'high';
    },
  ): Promise<AgentInboxItem> {
    try {
      const inboxItem = await InboxService.createInboxItem({
        userId,
        agentId,
        type: 'update',
        status: 'pending',
        priority: this.determineLeadPriority(lead, context),
        urgencyLevel: this.determineUrgencyLevel(context?.urgency || 'normal'),
        content: {
          title: `🎯 New lead: ${lead.contact.name || 'Unknown'}`,
          description: this.generateLeadSummary(lead),
          context: {
            leadInfo: {
              name: lead.contact.name || 'Unknown',
              company: lead.contact.company,
              qualification: lead.qualification,
            },
            conversationHistory: [],
            currentStage: 'introduction' as const,
            agentIntent: 'qualify_lead',
            blockers: [],
          },
        },
      });

      console.log(`Lead notification created: ${lead.contact.name || 'Unknown'}`);
      return inboxItem;
    } catch (error) {
      console.error('Failed to create lead notification:', error);
      throw error;
    }
  }

  /**
   * Create an agent action notification
   */
  async createAgentActionNotification(
    userId: string,
    agentId: string,
    action: {
      type: string;
      description: string;
      details?: any;
      success: boolean;
    },
  ): Promise<AgentInboxItem> {
    try {
      const inboxItem = await InboxService.createInboxItem({
        userId,
        agentId,
        type: 'update',
        status: 'pending',
        priority: action.success ? 'low' : 'normal',
        urgencyLevel: action.success ? 3 : 7,
        content: {
          title: action.success ? '✅ Agent action completed' : '⚠️ Agent action failed',
          description: action.description,
          context: {
            leadInfo: {
              name: 'Agent Action',
              qualification: null,
            },
            conversationHistory: [],
            currentStage: 'introduction' as const,
            agentIntent: action.type,
            blockers: action.success ? [] : ['Action failed'],
          },
        },
      });

      console.log(`Agent action notification created: ${action.type}`);
      return inboxItem;
    } catch (error) {
      console.error('Failed to create agent action notification:', error);
      throw error;
    }
  }

  /**
   * Generate AI response for conversation
   */
  async generateConversationResponse(
    conversation: Conversation,
    context?: ConversationContext,
  ): Promise<string> {
    try {
      const messages: AIMessage[] = [
        {
          role: 'system',
          content: 'You are a helpful sales assistant. Generate a natural, helpful response to continue this conversation with the lead.',
        },
      ];

      // Add conversation history
      conversation.messages.forEach(msg => {
        messages.push({
          role: msg.type === 'agent' ? 'assistant' : 'user',
          content: msg.content,
        });
      });

      // Add context if available
      if (context) {
        messages.push({
          role: 'system',
          content: `Context: ${JSON.stringify(context)}`,
        });
      }

      const response = await getOpenAITextResponse(messages);
      return response.content;
    } catch (error) {
      console.error('Failed to generate conversation response:', error);
      return 'I apologize, but I encountered an error generating a response. Please try again.';
    }
  }

  /**
   * Analyze conversation sentiment
   */
  async analyzeConversationSentiment(conversation: Conversation): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative';
    confidence: number;
    keyTopics: string[];
  }> {
    try {
      const conversationText = conversation.messages
        .map(msg => msg.content)
        .join(' ');

      const messages: AIMessage[] = [
        {
          role: 'system',
          content: 'Analyze the sentiment of this conversation and extract key topics. Respond with JSON format: {"sentiment": "positive|neutral|negative", "confidence": 0.0-1.0, "keyTopics": ["topic1", "topic2"]}',
        },
        {
          role: 'user',
          content: conversationText,
        },
      ];

      const response = await getOpenAITextResponse(messages);
      const analysis = JSON.parse(response.content);

      return {
        sentiment: analysis.sentiment || 'neutral',
        confidence: analysis.confidence || 0.5,
        keyTopics: analysis.keyTopics || [],
      };
    } catch (error) {
      console.error('Failed to analyze conversation sentiment:', error);
      return {
        sentiment: 'neutral',
        confidence: 0.5,
        keyTopics: [],
      };
    }
  }

  /**
   * Get conversation insights
   */
  async getConversationInsights(conversation: Conversation): Promise<{
    engagementLevel: 'low' | 'medium' | 'high';
    interestIndicators: string[];
    objections: string[];
    nextSteps: string[];
  }> {
    try {
      const conversationText = conversation.messages
        .map(msg => msg.content)
        .join(' ');

      const messages: AIMessage[] = [
        {
          role: 'system',
          content: 'Analyze this sales conversation and provide insights. Respond with JSON format: {"engagementLevel": "low|medium|high", "interestIndicators": ["indicator1"], "objections": ["objection1"], "nextSteps": ["step1"]}',
        },
        {
          role: 'user',
          content: conversationText,
        },
      ];

      const response = await getOpenAITextResponse(messages);
      const insights = JSON.parse(response.content);

      return {
        engagementLevel: insights.engagementLevel || 'medium',
        interestIndicators: insights.interestIndicators || [],
        objections: insights.objections || [],
        nextSteps: insights.nextSteps || [],
      };
    } catch (error) {
      console.error('Failed to get conversation insights:', error);
      return {
        engagementLevel: 'medium',
        interestIndicators: [],
        objections: [],
        nextSteps: [],
      };
    }
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(userId: string): Promise<{
    totalConversations: number;
    activeConversations: number;
    averageResponseTime: number;
    conversionRate: number;
  }> {
    try {
      const conversationItems = await InboxService.getUserInbox(userId, {
        limit: 1000,
      });

      const totalConversations = conversationItems.length;
      const activeConversations = conversationItems.filter(item => item.status === 'pending').length;

      // Calculate average response time (simplified)
      const respondedItems = conversationItems.filter(item => item.respondedAt);
      const averageResponseTime = respondedItems.length > 0
        ? respondedItems.reduce((sum, item) => {
          const created = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
          const responded = item.respondedAt instanceof Date ? item.respondedAt : new Date(item.respondedAt || Date.now());
          return sum + (responded.getTime() - created.getTime());
        }, 0) / respondedItems.length / (1000 * 60) // Convert to minutes
        : 0;

      // Calculate conversion rate (simplified)
      const convertedItems = conversationItems.filter(item =>
        item.status === 'resolved' && item.userResponse?.content?.includes('converted'),
      );
      const conversionRate = totalConversations > 0
        ? (convertedItems.length / totalConversations) * 100
        : 0;

      return {
        totalConversations,
        activeConversations,
        averageResponseTime,
        conversionRate,
      };
    } catch (error) {
      console.error('Failed to get conversation stats:', error);
      return {
        totalConversations: 0,
        activeConversations: 0,
        averageResponseTime: 0,
        conversionRate: 0,
      };
    }
  }

  // Private helper methods

  private determineConversationPriority(conversation: Conversation): 'low' | 'normal' | 'high' | 'urgent' {
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (!lastMessage) return 'normal';

    const content = lastMessage.content.toLowerCase();

    // High priority indicators
    if (content.includes('interested') || content.includes('buy') || content.includes('purchase')) {
      return 'high';
    }

    // Urgent indicators
    if (content.includes('urgent') || content.includes('asap') || content.includes('immediately')) {
      return 'urgent';
    }

    // Low priority indicators
    if (content.includes('maybe') || content.includes('later') || content.includes('not sure')) {
      return 'low';
    }

    return 'normal';
  }

  private determineLeadPriority(lead: Lead, context?: any): 'low' | 'normal' | 'high' | 'urgent' {
    if (context?.urgency) {
      return context.urgency === 'medium' ? 'normal' : context.urgency;
    }

    if (context?.qualificationScore && context.qualificationScore > 80) {
      return 'high';
    }

    if (context?.qualificationScore && context.qualificationScore < 40) {
      return 'low';
    }

    return 'normal';
  }

  private generateConversationSummary(conversation: Conversation): string {
    const messageCount = conversation.messages.length;
    const lastMessage = conversation.messages[conversation.messages.length - 1];

    if (!lastMessage) {
      return 'New conversation started with Lead';
    }

    const preview = lastMessage.content.length > 100
      ? `${lastMessage.content.substring(0, 100)  }...`
      : lastMessage.content;

    return `${messageCount} messages exchanged. Latest: "${preview}"`;
  }

  private generateLeadSummary(lead: Lead): string {
    const company = lead.contact.company || 'Unknown company';
    const name = lead.contact.name || 'Unknown';

    return `${name} from ${company}. Qualification score: ${lead.qualification.score}`;
  }

  private determineUrgencyLevel(priority: string): number {
    switch (priority) {
      case 'urgent':
        return 9;
      case 'high':
        return 7;
      case 'normal':
        return 5;
      case 'low':
        return 3;
      default:
        return 5;
    }
  }
}

export default new ConversationService();
