/**
 * Question Service
 *
 * Handles proactive questions, user responses, and knowledge creation from answers.
 * Separated from AgentInboxService for better maintainability.
 *
 * @version 1.0.0
 * @author PaynaAI Team
 */

import InboxService from './InboxService';
import KnowledgeBaseService from '../KnowledgeBaseService';
import ProactiveQuestionService from '../ProactiveQuestionService';
import { AgentInboxItem } from '../../types/agent';

class QuestionService {
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
    try {
      const inboxItem = await InboxService.createInboxItem({
        userId,
        agentId,
        type: 'proactive_question',
        status: 'pending',
        priority: context?.priority || 'normal',
        urgencyLevel: this.determineUrgencyLevel(context?.priority || 'normal'),
        content: {
          title: context?.title || 'Quick question',
          description: question,
          context: {
            leadInfo: {
              name: 'Proactive Question',
              qualification: null,
            },
            conversationHistory: [],
            currentStage: 'introduction' as const,
            agentIntent: 'ask_question',
            blockers: [],
            questionTopic: context?.questionTopic,
            questionType: context?.questionType,
            scheduledQuestionId: context?.scheduledQuestionId,
          } as any,
        },
      });

      console.log(`Proactive question created: ${question}`);
      return inboxItem;
    } catch (error) {
      console.error('Failed to create proactive question:', error);
      throw error;
    }
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
    try {
      const item = await InboxService.getInboxItem(itemId);
      if (!item) throw new Error('Inbox item not found');

      if (item.type !== 'proactive_question') {
        throw new Error('Item is not a proactive question');
      }

      // Mark inbox item as answered
      await this.markAsAnswered(itemId, answer, shouldLearn);

      // If shouldLearn, create knowledge item
      if (shouldLearn && answer.trim().length > 0) {
        const context = item.content.context as any;
        const questionTopic = context?.questionTopic || 'general';
        const questionType = context?.questionType || 'context';

        // Create knowledge item from answer
        await KnowledgeBaseService.addKnowledgeItem(userId, item.agentId, {
          type: 'faq',
          category: questionTopic,
          content: {
            title: context?.question || item.content.description || 'User response',
            answer: answer,
            context: `Learned from proactive question on ${new Date().toLocaleDateString()}`,
            question: context?.question,
          },
          source: 'user_taught',
          confidence: 0.9,
          tags: [questionType, questionTopic, 'proactive_learning'],
        });

        console.log('✅ Created knowledge item from proactive question answer');
      }

      // Update scheduled question status if available
      const scheduledQuestionId = (item.content.context as any)?.scheduledQuestionId;
      if (scheduledQuestionId) {
        await ProactiveQuestionService.markQuestionAnswered(scheduledQuestionId, answer);
      }

      console.log('✅ Proactive question answered successfully');
    } catch (error) {
      console.error('Failed to answer proactive question:', error);
      throw error;
    }
  }

  /**
   * Skip a proactive question (user chooses not to answer)
   */
  async skipProactiveQuestion(itemId: string): Promise<void> {
    try {
      const item = await InboxService.getInboxItem(itemId);
      if (!item) throw new Error('Inbox item not found');

      if (item.type !== 'proactive_question') {
        throw new Error('Item is not a proactive question');
      }

      // Mark as resolved without learning
      await InboxService.markAsResolved(itemId, 'Skipped by user');

      // Update scheduled question status if available
      const scheduledQuestionId = (item.content.context as any)?.scheduledQuestionId;
      if (scheduledQuestionId) {
        console.log(`Scheduled question ${scheduledQuestionId} marked as skipped`);
        // Note: ProactiveQuestionService.markQuestionSkipped method needs to be implemented
      }

      console.log('✅ Proactive question skipped');
    } catch (error) {
      console.error('Failed to skip proactive question:', error);
      throw error;
    }
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
    try {
      console.log('📝 Creating knowledge gap question...');
      console.log(`   User ID: ${userId}`);
      console.log(`   Agent ID: ${agentId}`);
      console.log(`   Gaps: ${gaps.length} (${gaps.filter(g => g.critical).length} critical)`);
      console.log(`   Gap fields: ${gaps.map(g => g.field).join(', ')}`);

      const gapList = gaps.map(gap => `  • ${gap.description}`).join('\n');

      // Create a natural, conversational message asking ONE specific question
      // Tailor the question based on what information is missing
      let conversationalMessage = '';

      // Prioritize the most critical gap
      const criticalGaps = gaps.filter(g => g.critical);
      const gapToAsk = criticalGaps[0] || gaps[0];

      if (!gapToAsk) {
        // Fallback if no gaps provided
        conversationalMessage = 'Hey! I\'m ready to start finding leads for you on Reddit. To get started, could you tell me a bit more about what you\'re selling? Just a quick description would help me find the right conversations for you.';
      } else if (gapToAsk.field.toLowerCase().includes('product') || gapToAsk.field.toLowerCase().includes('service')) {
        conversationalMessage = 'Hey! I\'m getting ready to find leads for you on Reddit. Could you give me a quick rundown of what you\'re selling and who it\'s for? Just a sentence or two would be perfect.';
      } else if (gapToAsk.field.toLowerCase().includes('target') || gapToAsk.field.toLowerCase().includes('customer')) {
        conversationalMessage = 'Quick question - who\'s your ideal customer? Like what industry are they in, company size, or what problems are they dealing with? This will help me find the right conversations to jump into.';
      } else if (gapToAsk.field.toLowerCase().includes('website') || gapToAsk.field.toLowerCase().includes('url')) {
        conversationalMessage = 'Hey! Do you have a website I can check out? It\'ll help me understand your business better so I can find the right leads for you.';
      } else {
        // Generic but still conversational
        conversationalMessage = `Hey! To help me find the best leads for you, could you tell me more about ${gapToAsk.field.toLowerCase()}? Just need a quick overview.`;
      }

      const detailedMessage = conversationalMessage;

      // Create a short, natural title
      let conversationalTitle = 'Quick Question';
      if (gapToAsk) {
        if (gapToAsk.field.toLowerCase().includes('product') || gapToAsk.field.toLowerCase().includes('service')) {
          conversationalTitle = 'What are you selling?';
        } else if (gapToAsk.field.toLowerCase().includes('target') || gapToAsk.field.toLowerCase().includes('customer')) {
          conversationalTitle = "Who's your ideal customer?";
        } else if (gapToAsk.field.toLowerCase().includes('website') || gapToAsk.field.toLowerCase().includes('url')) {
          conversationalTitle = 'Got a website?';
        } else {
          conversationalTitle = `Quick question about ${gapToAsk.field.toLowerCase()}`;
        }
      }

      const inboxItem = await InboxService.createInboxItem({
        userId,
        agentId,
        type: 'proactive_question',
        status: 'pending',
        priority: 'urgent',
        urgencyLevel: 9, // High urgency for knowledge gaps
        content: {
          title: conversationalTitle,
          description: detailedMessage,
          context: {
            leadInfo: {
              name: 'Knowledge Gap',
              qualification: null,
            },
            conversationHistory: [],
            currentStage: 'introduction' as const,
            agentIntent: 'request_information',
            blockers: gaps.map(gap => gap.field),
          },
        },
      });

      console.log('✅ Knowledge gap question created successfully!');
      console.log(`   Inbox item ID: ${inboxItem.id}`);
      console.log(`   Type: ${inboxItem.type}`);
      console.log(`   Status: ${inboxItem.status}`);
      console.log(`   Priority: ${inboxItem.priority}`);
      console.log(`   Title: ${inboxItem.content.title}`);

      return inboxItem;
    } catch (error) {
      console.error('❌ Failed to create knowledge gap question:', error);
      console.error('   Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        userId,
        agentId,
        gapsCount: gaps.length,
      });
      throw error;
    }
  }

  /**
   * Create a follow-up question based on user response
   */
  async createFollowUpQuestion(
    userId: string,
    agentId: string,
    originalQuestionId: string,
    followUpQuestion: string,
    context?: any,
  ): Promise<AgentInboxItem> {
    try {
      const inboxItem = await InboxService.createInboxItem({
        userId,
        agentId,
        type: 'proactive_question',
        status: 'pending',
        priority: 'normal',
        urgencyLevel: 5,
        content: {
          title: '🤖 Follow-up question',
          description: followUpQuestion,
          context: {
            leadInfo: {
              name: 'Follow-up Question',
              qualification: null,
            },
            conversationHistory: [],
            currentStage: 'introduction' as const,
            agentIntent: 'clarify_information',
            blockers: [],
          },
        },
      });

      console.log(`Follow-up question created: ${followUpQuestion}`);
      return inboxItem;
    } catch (error) {
      console.error('Failed to create follow-up question:', error);
      throw error;
    }
  }

  /**
   * Get unanswered questions for user
   */
  async getUnansweredQuestions(userId: string): Promise<AgentInboxItem[]> {
    try {
      return await InboxService.getUserInbox(userId, {
        type: 'proactive_question',
        status: 'pending',
        limit: 50,
      });
    } catch (error) {
      console.error('Failed to get unanswered questions:', error);
      return [];
    }
  }

  /**
   * Get question statistics for user
   */
  async getQuestionStats(userId: string): Promise<{
    total: number;
    answered: number;
    skipped: number;
    pending: number;
    answeredRate: number;
  }> {
    try {
      const allQuestions = await InboxService.getUserInbox(userId, {
        type: 'proactive_question',
        limit: 1000,
      });

      const total = allQuestions.length;
      const answered = allQuestions.filter(q => q.status === 'answered').length;
      const skipped = allQuestions.filter(
        q => q.status === 'resolved' && q.userResponse?.content === 'Skipped by user',
      ).length;
      const pending = allQuestions.filter(q => q.status === 'pending').length;
      const answeredRate = total > 0 ? (answered / total) * 100 : 0;

      return {
        total,
        answered,
        skipped,
        pending,
        answeredRate,
      };
    } catch (error) {
      console.error('Failed to get question stats:', error);
      return {
        total: 0,
        answered: 0,
        skipped: 0,
        pending: 0,
        answeredRate: 0,
      };
    }
  }

  // Private helper methods

  private async markAsAnswered(
    itemId: string,
    userResponse: string,
    shouldLearn: boolean = true,
  ): Promise<void> {
    try {
      const item = await InboxService.getInboxItem(itemId);
      if (!item) throw new Error('Inbox item not found');

      // Update item with user response
      const updatedItem: AgentInboxItem = {
        ...item,
        status: 'answered',
        userResponse: {
          content: userResponse,
          action: 'answered',
          shouldLearn,
          timestamp: new Date(),
        },
        respondedAt: new Date(),
      };

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

      console.log(`Inbox item answered: ${item.content.title}`);
    } catch (error) {
      console.error('Failed to mark inbox item as answered:', error);
      throw error;
    }
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

export default new QuestionService();
