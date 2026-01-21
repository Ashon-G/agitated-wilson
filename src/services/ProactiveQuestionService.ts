/**
 * Proactive Question Service
 * AI agent asks users 2+ questions daily to maintain and expand knowledge base
 * Creates ongoing learning relationship with intelligent, context-aware questions
 */

import BackendService from './BackendService';
import KnowledgeBaseService from './KnowledgeBaseService';
// NOTE: AgentInboxService is imported dynamically to break require cycle
// AgentInboxService -> QuestionService -> ProactiveQuestionService -> AgentInboxService
import AuthenticationService from './AuthenticationService';
import { getOpenAITextResponse } from '../api/chat-service';
import { AIMessage } from '../types/ai';
import { COLLECTIONS } from '../config/firebase';
import { KnowledgeItem } from '../types/agent';

interface SalesAgent {
  id: string;
  userId: string;
  name?: string;
  [key: string]: unknown;
}

interface InboxItemWithQuestionData {
  questionData?: {
    questionTopic?: string;
  };
  content?: string;
  [key: string]: unknown;
}

export type QuestionType =
  | 'knowledge_gap'      // Missing information agent needs
  | 'clarification'      // Unclear or conflicting knowledge
  | 'expansion'          // Deepening existing knowledge
  | 'verification'       // Confirming old info is still accurate
  | 'context';           // Understanding business context better

export interface ScheduledQuestion {
  id: string;
  userId: string;
  agentId: string;
  scheduledFor: Date;
  questionType: QuestionType;
  questionTopic: string;
  status: 'scheduled' | 'sent' | 'answered' | 'expired' | 'skipped';
  priority: number; // 1-10
  generatedQuestion?: string;
  generatedContext?: string;
  exampleAnswer?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionMetadata {
  questionType: QuestionType;
  questionTopic: string;
  askedAt: Date;
  answeredAt?: Date;
  answer?: string;
  relatedKnowledgeIds: string[];
  wasSkipped: boolean;
  scheduledQuestionId?: string;
}

export interface GeneratedQuestion {
  question: string;
  context: string;
  exampleAnswer: string;
  topic: string;
  type: QuestionType;
  priority: number;
}

export interface UserQuestionPreferences {
  userId: string;
  dailyQuestionCount: 2 | 3 | 4 | 'off';
  preferredTimeRange: {
    start: string; // HH:MM format
    end: string;
  };
  questionTypes: {
    knowledge_gap: boolean;
    clarification: boolean;
    expansion: boolean;
    verification: boolean;
    context: boolean;
  };
  enablePushNotifications: boolean;
  timezone?: string;
  createdAt: Date;
  updatedAt: Date;
}

class ProactiveQuestionService {
  private questionTemplates: Map<string, string[]> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Initialize question templates for different categories
   */
  private initializeTemplates(): void {
    this.questionTemplates.set('target_market', [
      "What's the typical company size of your ideal customer?",
      'Which industries respond best to your product?',
      'What job titles make buying decisions for your product?',
      'What geographic markets do you focus on?',
      "What's the typical budget range of your ideal customers?",
    ]);

    this.questionTemplates.set('product', [
      "What's your main competitive advantage?",
      "What's the #1 problem your product solves?",
      'What results do customers see in the first 30 days?',
      'What makes your solution different from alternatives?',
      'What features do customers love most?',
    ]);

    this.questionTemplates.set('pain_points', [
      'What pain points do customers mention most often?',
      'What symptoms indicate someone needs your solution?',
      "What happens if they don't solve this problem?",
      'What workarounds do people use before finding you?',
      'What frustrates customers most about current solutions?',
    ]);

    this.questionTemplates.set('pricing', [
      "What's your pricing model? (monthly/annual/one-time)",
      'What ROI can customers expect?',
      'How do you compare to cheaper alternatives?',
      "What's included in your base plan vs add-ons?",
      'Do you offer trials or demos?',
    ]);

    this.questionTemplates.set('process', [
      'How long does implementation take?',
      'What does your sales process look like?',
      'Who needs to approve purchases?',
      'What onboarding support do you provide?',
      "What's the typical timeline from first contact to close?",
    ]);

    this.questionTemplates.set('objections', [
      'What objections do you hear most often?',
      'How do you handle price concerns?',
      'What makes customers hesitate before buying?',
      'What competitive alternatives do prospects mention?',
      'What questions do prospects ask during evaluation?',
    ]);
  }

  /**
   * Initialize proactive questions for a user
   */
  async initialize(userId: string): Promise<void> {
    try {
      console.log(`🤖 Initializing proactive questions for user ${userId}`);

      // Check if already scheduled for today
      const todaySchedule = await this.getTodaySchedule(userId);

      if (todaySchedule.length === 0) {
        console.log('📅 No questions scheduled for today, creating schedule...');
        await this.scheduleDailyQuestions(userId);
      } else {
        console.log(`✅ Already have ${todaySchedule.length} questions scheduled for today`);
      }
    } catch (error) {
      console.error('Failed to initialize proactive questions:', error);
    }
  }

  /**
   * Schedule 2-4 questions for the day at random times
   */
  async scheduleDailyQuestions(userId: string): Promise<void> {
    try {
      console.log('📅 Scheduling daily questions...');

      // Get user preferences
      const prefs = await this.getUserPreferences(userId);

      if (prefs.dailyQuestionCount === 'off') {
        console.log('⏸️ Daily questions disabled by user preference');
        return;
      }

      const questionCount = typeof prefs.dailyQuestionCount === 'number'
        ? prefs.dailyQuestionCount
        : 2;

      // Get agent ID
      const agents = await BackendService.queryCollection(
        COLLECTIONS.SALES_AGENTS,
        {
          where: [{ field: 'userId', operator: '==', value: userId }],
          limit: 1,
        },
      );

      if (agents.length === 0) {
        console.log('⚠️ No agent found for user, skipping question scheduling');
        return;
      }

      const agentId = (agents[0] as SalesAgent).id;

      // Analyze knowledge base to identify question topics
      const questionTopics = await this.identifyQuestionTopics(userId);

      if (questionTopics.length === 0) {
        console.log('ℹ️ No question topics identified yet');
        return;
      }

      // Generate random times within preferred range
      const scheduleTimes = this.generateRandomTimes(
        questionCount,
        prefs.preferredTimeRange.start,
        prefs.preferredTimeRange.end,
      );

      // Create scheduled questions
      for (let i = 0; i < questionCount; i++) {
        const topic = questionTopics[i % questionTopics.length];
        const scheduledFor = scheduleTimes[i];

        const scheduledQuestion: Omit<ScheduledQuestion, 'id'> & { userId: string } = {
          userId,
          agentId,
          scheduledFor,
          questionType: topic.type,
          questionTopic: topic.topic,
          status: 'scheduled',
          priority: topic.priority,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        try {
          await BackendService.createDocument(
            COLLECTIONS.SCHEDULED_QUESTIONS,
            scheduledQuestion,
          );
          console.log(`📌 Scheduled ${topic.type} question about "${topic.topic}" for ${scheduledFor.toLocaleTimeString()}`);
        } catch (createError) {
          // Safe error logging for React Native
          const errorMessage = createError instanceof Error ? createError.message : String(createError);
          const errorStack = createError instanceof Error ? createError.stack : 'No stack trace available';

          if (errorMessage.includes('permission') || errorMessage.includes('insufficient')) {
            console.error('❌ Firestore rules not deployed for proactive questions');
            console.error('📋 Run: firebase deploy --only firestore:rules');
            console.error('   This is a one-time setup step required for proactive questions');
            // Don't throw - continue with other questions or silently fail
          } else {
            console.error('Failed to schedule question:', errorMessage);
            console.error('Error details:', errorStack);
          }
        }
      }

      console.log(`✅ Scheduled ${questionCount} questions for today`);
    } catch (error) {
      // Safe error logging for React Native
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
      console.error('Failed to schedule daily questions:', errorMessage);
      console.error('Error details:', errorStack);
    }
  }

  /**
   * Generate random times within time range, at least 2 hours apart
   */
  private generateRandomTimes(
    count: number,
    startTime: string,
    endTime: string,
  ): Date[] {
    const times: Date[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Parse start and end times
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMs = today.getTime() + (startHour * 60 + startMin) * 60 * 1000;
    const endMs = today.getTime() + (endHour * 60 + endMin) * 60 * 1000;

    const rangeMs = endMs - startMs;
    const minGapMs = 2 * 60 * 60 * 1000; // 2 hours

    // Generate times with minimum gap
    for (let i = 0; i < count; i++) {
      let attempts = 0;
      let newTime: Date;

      do {
        const randomMs = Math.random() * rangeMs;
        newTime = new Date(startMs + randomMs);
        attempts++;

        // Break if too many attempts
        if (attempts > 50) break;
      } while (
        times.some(t => Math.abs(t.getTime() - newTime.getTime()) < minGapMs) &&
        attempts < 50
      );

      times.push(newTime);
    }

    // Sort chronologically
    return times.sort((a, b) => a.getTime() - b.getTime());
  }

  /**
   * Identify question topics based on knowledge gaps and priorities
   */
  private async identifyQuestionTopics(userId: string): Promise<Array<{
    topic: string;
    type: QuestionType;
    priority: number;
  }>> {
    try {
      const topics: Array<{ topic: string; type: QuestionType; priority: number }> = [];

      // Get existing knowledge
      const knowledge = await KnowledgeBaseService.getUserKnowledge(userId);

      // Check for critical gaps
      const hasWebsite = knowledge.some(kb =>
        kb.content.answer?.toLowerCase().includes('http') ||
        kb.content.answer?.toLowerCase().includes('www'),
      );

      const hasProduct = knowledge.some(kb =>
        kb.category === 'product' ||
        (kb.content.answer?.length || 0) > 100,
      );

      const hasTarget = knowledge.some(kb =>
        kb.category === 'target_market' || kb.category === 'customer_profile',
      );

      // Add critical gaps first
      if (!hasWebsite) {
        topics.push({ topic: 'website', type: 'knowledge_gap', priority: 10 });
      }

      if (!hasProduct) {
        topics.push({ topic: 'product', type: 'knowledge_gap', priority: 9 });
      }

      if (!hasTarget) {
        topics.push({ topic: 'target_market', type: 'knowledge_gap', priority: 9 });
      }

      // Check for knowledge needing verification (>90 days old)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const oldKnowledge = knowledge.filter(kb =>
        new Date(kb.timestamps.updatedAt) < ninetyDaysAgo &&
        kb.usage.timesUsed > 5,
      );

      oldKnowledge.slice(0, 2).forEach(kb => {
        topics.push({
          topic: kb.category || kb.content.title,
          type: 'verification',
          priority: 7,
        });
      });

      // Add expansion topics for shallow knowledge
      const shallowKnowledge = knowledge.filter(kb =>
        (kb.content.answer?.length || 0) < 100,
      );

      shallowKnowledge.slice(0, 2).forEach(kb => {
        topics.push({
          topic: kb.category || kb.content.title,
          type: 'expansion',
          priority: 5,
        });
      });

      // Add context questions
      if (knowledge.length > 3) {
        topics.push({ topic: 'pricing', type: 'context', priority: 6 });
        topics.push({ topic: 'objections', type: 'context', priority: 6 });
        topics.push({ topic: 'process', type: 'context', priority: 5 });
      }

      // Sort by priority
      return topics.sort((a, b) => b.priority - a.priority);
    } catch (error) {
      console.error('Failed to identify question topics:', error);
      return [];
    }
  }

  /**
   * Generate a specific question using AI
   */
  async generateQuestion(
    userId: string,
    scheduledQuestion: ScheduledQuestion,
  ): Promise<GeneratedQuestion | null> {
    try {
      console.log(`🤔 Generating ${scheduledQuestion.questionType} question about "${scheduledQuestion.questionTopic}"`);

      // Get existing knowledge for context
      const knowledge = await KnowledgeBaseService.getUserKnowledge(userId);
      const knowledgeSummary = knowledge.slice(0, 10).map(kb =>
        `- ${kb.content.title}: ${(kb.content.answer || '').substring(0, 100)}`,
      ).join('\n');

      const prompt = `You are an AI sales agent chatting with your user to learn about their business. Generate ONE short, natural question that sounds like it's from a real person texting.

Current knowledge:
${knowledgeSummary || 'Empty - just starting to learn'}

Question type: ${scheduledQuestion.questionType}
Topic: ${scheduledQuestion.questionTopic}

Requirements:
- Write like you're texting a friend - casual and natural
- Keep it to ONE sentence (max 15 words)
- No emojis, no formal language, no corporate speak
- Sound genuinely curious, not robotic
- Ask something that helps you find leads for them
- Don't ask about things already in the knowledge base

Good examples:
- "What problem does your product actually solve?"
- "Who usually buys your stuff?"
- "What makes someone a bad fit for your product?"
- "What do people say when they don't want to buy?"

Bad examples (too formal):
- "Could you provide details about your target customer profile?"
- "What's the biggest challenge your customers face before they buy from you?"
- "I'd like to understand your ideal customer better"

Respond with ONLY valid JSON (no markdown):
{
  "question": "one short natural question (max 15 words)",
  "title": "2-4 word casual title for the question",
  "topic": "${scheduledQuestion.questionTopic}"
}`;

      // This feature requires GeminiService integration for AI question generation
      console.warn('AI question generation requires GeminiService integration');
      return this.getTemplateQuestion(scheduledQuestion.questionTopic);
    } catch (error) {
      console.error('Failed to generate question:', error);

      // Fallback to template question
      return this.getTemplateQuestion(scheduledQuestion.questionTopic);
    }
  }

  /**
   * Get a template question as fallback
   */
  private getTemplateQuestion(topic: string): GeneratedQuestion | null {
    const templates = this.questionTemplates.get(topic);
    if (!templates || templates.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * templates.length);
    const question = templates[randomIndex];

    // Generate a short, natural title from the topic
    let title = 'Quick question';
    if (topic === 'target_market') title = 'Your customers';
    else if (topic === 'product') title = 'Your product';
    else if (topic === 'pain_points') title = 'Customer problems';
    else if (topic === 'pricing') title = 'Pricing';
    else if (topic === 'process') title = 'Your process';
    else if (topic === 'objections') title = 'Objections';

    return {
      question,
      context: title,
      exampleAnswer: '',
      topic,
      type: 'context',
      priority: 5,
    };
  }

  /**
   * Check if a question on this topic was asked recently
   */
  async hasAskedRecently(
    userId: string,
    questionTopic: string,
    daysAgo: number = 30,
  ): Promise<boolean> {
    try {
      const cutoffDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      const recentQuestions = await BackendService.queryCollection(
        COLLECTIONS.AGENT_INBOX,
        {
          where: [
            { field: 'userId', operator: '==', value: userId },
            { field: 'type', operator: '==', value: 'proactive_question' },
            { field: 'createdAt', operator: '>=', value: cutoffDate },
          ],
          limit: 50,
        },
      );

      // Check if any match the topic
      return recentQuestions.some((item: unknown) => {
        const typedItem = item as InboxItemWithQuestionData;
        return typedItem.questionData?.questionTopic === questionTopic ||
               typedItem.content?.toLowerCase().includes(questionTopic.toLowerCase());
      });
    } catch (error) {
      console.error('Failed to check recent questions:', error);
      return false;
    }
  }

  /**
   * Get today's scheduled questions
   */
  async getTodaySchedule(userId: string): Promise<ScheduledQuestion[]> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Query with only userId to avoid index requirement
      // Filter by scheduledFor client-side
      const allQuestions = await BackendService.queryCollection<ScheduledQuestion>(
        COLLECTIONS.SCHEDULED_QUESTIONS,
        {
          where: [
            { field: 'userId', operator: '==', value: userId },
          ],
        },
      );

      // Filter and sort client-side
      const questions = allQuestions.filter(q => {
        const scheduledDate = q.scheduledFor instanceof Date
          ? q.scheduledFor
          : new Date(q.scheduledFor);
        return scheduledDate >= today && scheduledDate < tomorrow;
      });

      // Sort by scheduledFor time
      return questions.sort((a, b) => {
        const aTime = a.scheduledFor instanceof Date ? a.scheduledFor.getTime() : new Date(a.scheduledFor).getTime();
        const bTime = b.scheduledFor instanceof Date ? b.scheduledFor.getTime() : new Date(b.scheduledFor).getTime();
        return aTime - bTime;
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errorMsg.includes('permission') || errorMsg.includes('insufficient')) {
        console.error('❌ Firestore rules not deployed - cannot get today\'s schedule');
        console.error('📋 Run: firebase deploy --only firestore:rules');
      } else {
        console.error('Failed to get today schedule:', error);
      }
      return []; // Return empty array for graceful degradation
    }
  }

  /**
   * Get user preferences or return defaults
   */
  async getUserPreferences(userId: string): Promise<UserQuestionPreferences> {
    try {
      const prefs = await BackendService.queryCollection<UserQuestionPreferences>(
        COLLECTIONS.USER_PREFERENCES,
        {
          where: [{ field: 'userId', operator: '==', value: userId }],
          limit: 1,
        },
      );

      if (prefs.length > 0) {
        return prefs[0];
      }

      // Return defaults
      return {
        userId,
        dailyQuestionCount: 2,
        preferredTimeRange: {
          start: '09:00',
          end: '20:00',
        },
        questionTypes: {
          knowledge_gap: true,
          clarification: true,
          expansion: true,
          verification: true,
          context: true,
        },
        enablePushNotifications: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      // Return defaults
      return {
        userId,
        dailyQuestionCount: 2,
        preferredTimeRange: {
          start: '09:00',
          end: '20:00',
        },
        questionTypes: {
          knowledge_gap: true,
          clarification: true,
          expansion: true,
          verification: true,
          context: true,
        },
        enablePushNotifications: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Send due questions (called by background service)
   */
  async sendDueQuestions(): Promise<void> {
    try {
      const now = new Date();

      // Get all scheduled questions (only by status to avoid index requirement)
      // Filter by scheduledFor client-side
      const allScheduledQuestions = await BackendService.queryCollection<ScheduledQuestion>(
        COLLECTIONS.SCHEDULED_QUESTIONS,
        {
          where: [
            { field: 'status', operator: '==', value: 'scheduled' },
          ],
          limit: 100,
        },
      );

      // Filter client-side for due questions
      const dueQuestions = allScheduledQuestions.filter(q => {
        const scheduledDate = q.scheduledFor instanceof Date
          ? q.scheduledFor
          : new Date(q.scheduledFor);
        return scheduledDate <= now;
      });

      console.log(`📬 Found ${dueQuestions.length} due questions to send`);

      for (const scheduled of dueQuestions) {
        await this.sendQuestion(scheduled);
      }
    } catch (error) {
      console.error('Failed to send due questions:', error);
    }
  }

  /**
   * Send a single question to inbox
   */
  private async sendQuestion(scheduled: ScheduledQuestion): Promise<void> {
    try {
      console.log(`📤 Sending question: ${scheduled.questionTopic}`);

      // Generate the actual question
      const generated = await this.generateQuestion(scheduled.userId, scheduled);

      if (!generated) {
        console.error('Failed to generate question, skipping');
        await BackendService.updateDocument(
          COLLECTIONS.SCHEDULED_QUESTIONS,
          scheduled.id,
          { status: 'expired', updatedAt: new Date() },
        );
        return;
      }

      // Create inbox item with custom title
      // Dynamic import to break require cycle
      const { default: AgentInboxService } = await import('./AgentInboxService');
      await AgentInboxService.createProactiveQuestion(
        scheduled.userId,
        scheduled.agentId,
        generated.question,
        {
          questionType: generated.type,
          questionTopic: generated.topic,
          scheduledQuestionId: scheduled.id,
          priority: 'normal',
          title: generated.context, // Pass the title from AI
        },
      );

      // Update scheduled question
      await BackendService.updateDocument(
        COLLECTIONS.SCHEDULED_QUESTIONS,
        scheduled.id,
        {
          status: 'sent',
          generatedQuestion: generated.question,
          generatedContext: generated.context,
          exampleAnswer: generated.exampleAnswer,
          updatedAt: new Date(),
        },
      );

      console.log('✅ Question sent to inbox');
    } catch (error) {
      console.error('Failed to send question:', error);
    }
  }

  /**
   * Mark question as answered
   */
  async markQuestionAnswered(
    scheduledQuestionId: string,
    answer: string,
  ): Promise<void> {
    try {
      await BackendService.updateDocument(
        COLLECTIONS.SCHEDULED_QUESTIONS,
        scheduledQuestionId,
        {
          status: 'answered',
          updatedAt: new Date(),
        },
      );

      console.log(`✅ Marked question ${scheduledQuestionId} as answered`);
    } catch (error) {
      console.error('Failed to mark question as answered:', error);
    }
  }

  /**
   * Expire old unanswered questions (>3 days)
   */
  async expireOldQuestions(): Promise<void> {
    try {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      // Get all sent questions (only by status to avoid index requirement)
      // Filter by scheduledFor client-side
      const allSentQuestions = await BackendService.queryCollection<ScheduledQuestion>(
        COLLECTIONS.SCHEDULED_QUESTIONS,
        {
          where: [
            { field: 'status', operator: '==', value: 'sent' },
          ],
          limit: 100,
        },
      );

      // Filter client-side for old questions
      const oldQuestions = allSentQuestions.filter(q => {
        const scheduledDate = q.scheduledFor instanceof Date
          ? q.scheduledFor
          : new Date(q.scheduledFor);
        return scheduledDate < threeDaysAgo;
      });

      for (const question of oldQuestions) {
        await BackendService.updateDocument(
          COLLECTIONS.SCHEDULED_QUESTIONS,
          question.id,
          { status: 'expired', updatedAt: new Date() },
        );
      }

      if (oldQuestions.length > 0) {
        console.log(`🗑️ Expired ${oldQuestions.length} old questions`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errorMsg.includes('permission') || errorMsg.includes('insufficient')) {
        console.error('❌ Firestore rules not deployed for proactive questions');
        console.error('📋 To fix: firebase deploy --only firestore:rules');
        console.error('   This is a one-time setup step');
      } else {
        console.error('Failed to expire old questions:', error);
      }
      // Don't throw - graceful degradation
    }
  }
}

export default new ProactiveQuestionService();
