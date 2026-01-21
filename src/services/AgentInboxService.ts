/**
 * Agent Inbox Service
 *
 * Main inbox service that orchestrates agent-user communication.
 * Uses smaller, focused services for better maintainability and separation of concerns.
 *
 * @version 2.0.0
 * @author PaynaAI Team
 */

import InboxService from './inbox/InboxService';
import QuestionService from './inbox/QuestionService';
import ConversationService from './inbox/ConversationService';
import {
  AgentInboxItem,
  ConversationContext,
  Conversation,
  Lead,
} from '../types/agent';
interface InboxEvent {
  type: 'inbox_item_created' | 'inbox_item_answered' | 'inbox_item_resolved' | 'inbox_item_updated';
  inboxItem: AgentInboxItem;
  userId: string;
  userResponse?: string;
  shouldLearn?: boolean;
}

class AgentInboxService {
  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      console.log('✅ AgentInboxService initialized');
    } catch (error) {
      console.error('❌ Failed to initialize AgentInboxService:', error);
    }
  }

  /**
   * Create new inbox item for user attention
   */
  async createInboxItem(
    itemData: Omit<AgentInboxItem, 'id' | 'createdAt'>,
  ): Promise<AgentInboxItem> {
    return InboxService.createInboxItem(itemData);
  }

  /**
   * Get all inbox items for a user
   */
  async getUserInbox(userId: string, filters?: {
    status?: AgentInboxItem['status'];
    type?: AgentInboxItem['type'];
    priority?: AgentInboxItem['priority'];
    limit?: number;
  }): Promise<AgentInboxItem[]> {
    return InboxService.getUserInbox(userId, filters);
  }

  /**
   * Get specific inbox item
   */
  async getInboxItem(itemId: string): Promise<AgentInboxItem | null> {
    return InboxService.getInboxItem(itemId);
  }

  /**
   * Mark inbox item as answered by user
   */
  async markAsAnswered(
    itemId: string,
    userResponse: string,
    shouldLearn: boolean = true,
  ): Promise<void> {
    const item = await InboxService.getInboxItem(itemId);
    if (!item) throw new Error('Inbox item not found');

    await InboxService.updateInboxItem(itemId, {
      status: 'answered',
      userResponse: {
        content: userResponse,
        action: 'answered',
        shouldLearn,
        timestamp: new Date(),
      },
      respondedAt: new Date(),
    });
  }

  /**
   * Answer a proactive question and optionally create knowledge item
   */
  async answerProactiveQuestion(
    userId: string,
    itemId: string,
    answer: string,
    shouldLearn: boolean = true,
  ): Promise<void> {
    return QuestionService.answerProactiveQuestion(userId, itemId, answer, shouldLearn);
  }

  /**
   * Skip a proactive question (user chooses not to answer)
   */
  async skipProactiveQuestion(itemId: string): Promise<void> {
    return QuestionService.skipProactiveQuestion(itemId);
  }

  /**
   * Create a proactive question for user
   */
  async createProactiveQuestion(
    userId: string,
    agentId: string,
    question: string,
    context?: {
      questionTopic?: string;
      questionType?: string;
      scheduledQuestionId?: string;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      title?: string;
    },
  ): Promise<AgentInboxItem> {
    return QuestionService.createProactiveQuestion(userId, agentId, question, context);
  }

  /**
   * Create a knowledge gap question
   */
  async createKnowledgeGapQuestion(
    userId: string,
    agentId: string,
    gaps: Array<{
      field: string;
      description: string;
      critical: boolean;
    }>,
  ): Promise<AgentInboxItem> {
    return QuestionService.createKnowledgeGapQuestion(userId, agentId, gaps);
  }

  /**
   * Create a conversation notification
   */
  async createConversationNotification(
    userId: string,
    agentId: string,
    conversation: Conversation,
    context?: ConversationContext,
  ): Promise<AgentInboxItem> {
    return ConversationService.createConversationNotification(userId, agentId, conversation, context);
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
    return ConversationService.createLeadNotification(userId, agentId, lead, context);
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
      details?: unknown;
      success: boolean;
    },
  ): Promise<AgentInboxItem> {
    return ConversationService.createAgentActionNotification(userId, agentId, action);
  }

  /**
   * Generate AI response for conversation
   */
  async generateConversationResponse(
    conversation: Conversation,
    context?: ConversationContext,
  ): Promise<string> {
    return ConversationService.generateConversationResponse(conversation, context);
  }

  /**
   * Analyze conversation sentiment
   */
  async analyzeConversationSentiment(conversation: Conversation): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative';
    confidence: number;
    keyTopics: string[];
  }> {
    return ConversationService.analyzeConversationSentiment(conversation);
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
    return ConversationService.getConversationInsights(conversation);
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
    return ConversationService.getConversationStats(userId);
  }

  /**
   * Get question statistics
   */
  async getQuestionStats(userId: string): Promise<{
    total: number;
    answered: number;
    skipped: number;
    pending: number;
    answeredRate: number;
  }> {
    return QuestionService.getQuestionStats(userId);
  }

  /**
   * Get pending questions for a user
   */
  async getPendingQuestions(userId: string): Promise<AgentInboxItem[]> {
    return InboxService.getUserInbox(userId, {
      type: 'proactive_question',
      status: 'pending',
      limit: 50,
    });
  }

  /**
   * Subscribe to inbox events
   */
  onInboxEvent(callback: (event: InboxEvent) => void): () => void {
    return InboxService.onInboxEvent(callback);
  }

  /**
   * Setup real-time listener for user inbox
   */
  setupRealtimeListener(userId: string, callback: (items: AgentInboxItem[]) => void): string {
    return InboxService.setupRealtimeListener(userId, callback);
  }

  /**
   * Remove real-time listener
   */
  removeRealtimeListener(userId: string): void {
    InboxService.removeRealtimeListener(userId);
  }

  /**
   * Clear inbox cache for user
   */
  clearUserCache(userId: string): void {
    InboxService.clearUserCache(userId);
  }

  /**
   * Clear all inbox cache
   */
  clearAllCache(): void {
    InboxService.clearAllCache();
  }
}

export default new AgentInboxService();