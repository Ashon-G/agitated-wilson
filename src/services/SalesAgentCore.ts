// @ts-nocheck
/**
 * Core AI Sales Agent System
 * Orchestrates multi-turn conversations, lead qualification, and autonomous operation
 *
 * ARCHITECTURE NOTE:
 * - Agent intelligence is managed by Vertex AI Agent Builder (not stored here)
 * - This service handles: conversation flow, lead processing, and message orchestration
 * - Used by EnhancedSalesAgentCore via delegation pattern
 * - sales_agents Firestore collection stores automation metadata only (jobId, searchQueries, etc.)
 * - Legacy Reddit integration code removed
 */

import { COLLECTIONS } from '../config/firebase';
import BackendService from './BackendService';
import KnowledgeBaseService from './KnowledgeBaseService';
import AgentInboxService from './AgentInboxService';
import LeadQualificationTracker from './LeadQualificationTracker';
import {
  SalesAgent,
  Lead,
  Conversation,
  ConversationMessage,
  AgentAction,
  AgentInboxItem,
  ExtractedEntity,
} from '../types/agent';

class SalesAgentCore {
  private agents: Map<string, SalesAgent> = new Map();
  private activeConversations: Map<string, Conversation> = new Map();
  private processingQueue: Map<string, boolean> = new Map();

  // Event listeners for real-time updates
  private listeners: Map<string, (event: AgentEvent) => void> = new Map();

  // Initialize backend service
  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await BackendService.initialize();
      console.log('✅ SalesAgentCore initialized with backend service');
    } catch (error) {
      console.error('❌ Failed to initialize SalesAgentCore:', error);
    }
  }

  /**
   * Initialize agent for a user
   */
  async initializeAgent(userId: string, agentConfig?: Partial<SalesAgent>): Promise<SalesAgent> {
    try {
      // Check if user already has an agent
      const existingAgent = await this.getUserAgent(userId);
      if (existingAgent) {
        this.agents.set(existingAgent.id, existingAgent);
        return existingAgent;
      }

      // Create new agent
      const agent: SalesAgent = {
        id: `agent_${userId}_${Date.now()}`,
        userId,
        name: agentConfig?.name || 'AI Sales Assistant',
        description: agentConfig?.description || 'Personal AI sales representative',
        status: 'training',
        createdAt: new Date(),
        updatedAt: new Date(),

        config: {
          personality:
            agentConfig?.config?.personality ||
            'Professional, consultative sales expert focused on building relationships and understanding customer needs.',
          industry: agentConfig?.config?.industry || 'Technology',
          products: agentConfig?.config?.products || [],
          territory: agentConfig?.config?.territory || 'Global',
          goals: agentConfig?.config?.goals || {
            monthlyLeadTarget: 50,
            monthlyDealTarget: 10,
            revenueTarget: 100000,
            territories: ['Global'],
            priorities: ['Lead Generation', 'Qualification', 'Closing'],
          },
          communication: agentConfig?.config?.communication || {
            tone: 'professional',
            approach: 'consultative',
            followUpCadence: 'moderate',
            personalization: 'high',
          },
        },

        metrics: {
          leadsGenerated: 0,
          conversationsStarted: 0,
          dealsInProgress: 0,
          closedDeals: 0,
          totalRevenue: 0,
          conversionRate: 0,
          avgDealSize: 0,
          avgTimeToClose: 0,
        },

        connectedPlatforms: [],

        learningState: {
          knowledgeBaseSize: 0,
          confidenceLevel: 0.5,
          unansweredQuestions: 0,
          lastLearningUpdate: new Date(),
        },
      };

      // Save to storage
      await this.saveAgent(agent);
      this.agents.set(agent.id, agent);

      // Initialize knowledge base with default sales knowledge
      await this.initializeDefaultKnowledge(userId, agent.id);

      // Set status to active after initialization
      agent.status = 'active';
      await this.updateAgent(agent.id, { status: 'active' });

      this.emit('agent_initialized', { agent, userId });
      return agent;
    } catch (error: any) {
      // Handle permission errors gracefully - this is expected if Firestore rules aren't deployed
      const isPermissionError =
        error?.code === 'permission-denied' ||
        error?.message?.includes('permission') ||
        error?.message?.includes('Missing or insufficient permissions');

      if (isPermissionError) {
        console.warn(
          '⚠️ Agent initialization blocked by Firestore permissions. This is expected if rules are not deployed yet.',
        );

        // Create a minimal local-only agent that can still be used
        const localAgent: SalesAgent = {
          id: `local_${userId}_${Date.now()}`,
          userId,
          name: 'AI Sales Agent',
          description: 'Local sales agent (Firestore sync pending)',
          status: 'training',
          createdAt: new Date(),
          updatedAt: new Date(),
          config: {
            personality: 'professional and consultative',
            industry: 'general',
            products: [],
            territory: 'global',
            goals: {
              monthlyLeadTarget: 100,
              monthlyDealTarget: 20,
              revenueTarget: 50000,
              territories: [],
              priorities: [],
            },
            communication: {
              tone: 'professional',
              approach: 'consultative',
              followUpCadence: 'moderate',
              personalization: 'high',
            },
          },
          metrics: {
            leadsGenerated: 0,
            conversationsStarted: 0,
            dealsInProgress: 0,
            closedDeals: 0,
            totalRevenue: 0,
            conversionRate: 0,
            avgDealSize: 0,
            avgTimeToClose: 0,
          },
          connectedPlatforms: [],
          learningState: {
            knowledgeBaseSize: 0,
            confidenceLevel: 0.5,
            unansweredQuestions: 0,
            lastLearningUpdate: new Date(),
          },
        };

        // Store locally only
        this.agents.set(localAgent.id, localAgent);
        console.log('✅ Created local-only agent (will sync when Firestore permissions allow)');
        return localAgent;
      }

      // For other errors, log and throw
      console.error('Failed to initialize agent:', error);
      throw error;
    }
  }

  /**
   * Ensure agent exists for user, create if missing
   * Use this before agent-dependent operations to avoid "Agent not found" errors
   */
  async ensureAgentExists(userId: string, agentId?: string): Promise<SalesAgent> {
    try {
      console.log(
        `🔍 Ensuring agent exists for user ${userId}${agentId ? ` (agentId: ${agentId})` : ''}`,
      );

      // If agentId provided, try to get that specific agent
      if (agentId) {
        const agent = await BackendService.getDocument<SalesAgent>(
          COLLECTIONS.SALES_AGENTS,
          agentId,
        );
        if (agent && agent.userId === userId) {
          this.agents.set(agent.id, agent);
          console.log(`✅ Found agent ${agentId} in Firestore`);
          return agent;
        }
        console.warn(
          `⚠️ Agent ${agentId} not found or belongs to different user, creating new agent`,
        );
      }

      // Get or create agent for this user
      const existingAgent = await this.getUserAgent(userId);
      if (existingAgent) {
        this.agents.set(existingAgent.id, existingAgent);
        console.log(`✅ Found existing agent ${existingAgent.id} for user`);
        return existingAgent;
      }

      // Create new agent
      console.log(`➕ Creating default agent for user ${userId}`);
      const newAgent = await this.initializeAgent(userId);
      console.log(`✅ Created new agent ${newAgent.id}`);
      return newAgent;
    } catch (error) {
      console.error(`Failed to ensure agent exists for user ${userId}:`, error);
      throw new Error(
        `Unable to get or create agent for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Warm agent cache by preloading agent into memory
   * Call this during app initialization for faster subsequent operations
   */
  async warmAgentCache(userId: string): Promise<void> {
    try {
      console.log(`🔥 Warming agent cache for user ${userId}`);
      const agent = await this.getUserAgent(userId);
      if (agent) {
        this.agents.set(agent.id, agent);
        console.log(`✅ Agent ${agent.id} cache warmed successfully`);
      } else {
        console.log(
          `ℹ️ No agent found for user ${userId} during cache warming - will be created on demand`,
        );
      }
    } catch (error) {
      console.error(`Failed to warm agent cache for user ${userId}:`, error);
      // Don't throw - cache warming is optional optimization
    }
  }

  /**
   * Process incoming lead from Reddit ingestion pipeline
   * Legacy method - Reddit integration now managed by backend
   */
  async processIncomingRedditLead(
    userId: string,
    redditPost: any,
    job: any,
    qualification: any,
  ): Promise<{ lead: Lead; shouldStartConversation: boolean; conversation?: any }> {
    try {
      console.warn('⚠️ processIncomingRedditLead called but Reddit integration is now managed by backend');

      // Ensure agent exists before processing
      const agent = await this.ensureAgentExists(userId, job.agentId);
      this.agents.set(agent.id, agent);

      // Create a basic lead from Reddit post
      const leadData: Partial<Lead> = {
        contact: {
          username: redditPost.author || 'unknown',
          platform: 'reddit',
          profileUrl: `https://reddit.com/user/${redditPost.author}`,
        },
        source: {
          platform: 'reddit',
          context: `Reddit post: "${redditPost.title}" in r/${redditPost.subreddit}`,
          discoveredAt: new Date(),
        },
        qualification: {
          score: qualification.score || 50,
          stage: 'suspect',
          interests: [],
          buyingSignals: [],
        },
        priority: qualification.score >= 70 ? 'hot' : 'warm',
      };

      const lead = await this.createLead(userId, agent.id, leadData);

      // Determine if we should start a conversation
      const shouldStartConversation = qualification.score >= 60 && qualification.confidence > 0.7;

      // Update agent metrics
      agent.metrics.leadsGenerated++;
      await this.updateAgent(agent.id, { metrics: agent.metrics });

      return { lead, shouldStartConversation, conversation: null };
    } catch (error) {
      console.error('Failed to process Reddit lead:', error);
      throw error;
    }
  }

  /**
   * Process incoming lead from platform integrations (original method)
   */
  async processIncomingLead(
    userId: string,
    leadData: Partial<Lead>,
    context: any,
  ): Promise<{ lead: Lead; shouldStartConversation: boolean }> {
    try {
      console.log(`🔍 Processing incoming lead for user ${userId}`);

      // Ensure agent exists before processing
      const agent = await this.ensureAgentExists(userId);
      this.agents.set(agent.id, agent); // Cache in memory
      console.log(`✅ Agent ${agent.id} loaded for lead processing`);

      // Create lead record
      const lead = await this.createLead(userId, agent.id, leadData);

      // This feature requires GeminiService integration for AI lead qualification
      console.warn('AI lead qualification requires GeminiService integration');

      // Set default qualification
      lead.aiInsights = {
        buyingIntent: 0.5,
        bestApproach: 'Direct outreach',
        riskFactors: [],
        opportunities: [],
        competitorMentions: [],
      };

      await this.updateLead(lead.id, {
        qualification: lead.qualification,
        aiInsights: lead.aiInsights,
      });

      // Determine if we should start a conversation
      const shouldStartConversation =
        lead.qualification.score >= 60 && lead.priority !== 'cold';

      // Update agent metrics
      agent.metrics.leadsGenerated++;
      await this.updateAgent(agent.id, { metrics: agent.metrics });

      this.emit('lead_processed', { lead, agent, shouldStartConversation });

      return { lead, shouldStartConversation };
    } catch (error) {
      console.error('Failed to process incoming lead:', error);
      throw error;
    }
  }

  /**
   * Start a Reddit conversation with enhanced context
   */
  async startRedditConversation(
    userId: string,
    leadId: string,
    platform: string,
    redditPost: any,
    strategy: any,
  ): Promise<Conversation> {
    try {
      console.log(`🔍 Starting Reddit conversation for user ${userId}, lead ${leadId}`);

      // Ensure agent exists before starting conversation
      const agent = await this.ensureAgentExists(userId);
      this.agents.set(agent.id, agent); // Cache in memory
      console.log(`✅ Agent ${agent.id} loaded for Reddit conversation`);

      const lead = await this.getLead(leadId);
      if (!lead) throw new Error('Lead not found');

      // Import link detection utility
      const { sanitizeForReddit } = await import('../utils/linkDetection');

      // Enforce no-links policy: sanitize comment content
      const sanitized = sanitizeForReddit(strategy.content);
      const cleanContent = sanitized.sanitized;

      if (sanitized.removedLinks.length > 0) {
        console.warn(
          `⚠️ Links removed from Reddit comment per policy: ${sanitized.removedLinks.join(', ')}`,
        );
      }
      if (sanitized.hadEmails) {
        console.warn('⚠️ Email addresses removed from Reddit comment per policy');
      }

      // Create conversation with Reddit-specific context
      const conversation: Conversation = {
        id: `conv_reddit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        userId,
        agentId: agent.id,
        leadId,
        platform,
        status: 'active',
        priority: lead.priority === 'hot' ? 'high' : 'normal',
        messages: [],
        context: {
          originalTopic: `Reddit post: "${redditPost.title}" in r/${redditPost.subreddit}`,
          currentObjective: 'Reddit engagement and lead nurturing',
          stage: 'introduction',
          agentConfidence: strategy.confidence || 0.8,
        },
        state: {
          requiresUserInput: false,
          blockers: [],
          opportunities: lead.aiInsights?.opportunities || [],
          sentiment: 'neutral',
          engagement: 'medium',
        },
        createdAt: new Date(),
        lastMessage: new Date(),
        lastAgentAction: new Date(),
      };

      // Add the engagement message based on strategy (with cleaned content)
      const engagementMessage: ConversationMessage = {
        id: `msg_${Date.now()}`,
        type: 'agent',
        content: cleanContent, // Use sanitized content
        timestamp: new Date(),
        platform,
        intent: strategy.approach,
        sentiment: 'positive',
        confidence: strategy.confidence || 0.8,
      };

      conversation.messages.push(engagementMessage);

      // Save conversation
      await this.saveConversation(conversation);
      this.activeConversations.set(conversation.id, conversation);

      // Reddit conversation monitoring is now handled by backend
      console.log('ℹ️ Reddit conversation monitoring is managed by backend');

      // Log action
      await this.logAgentAction(agent.id, {
        type: 'message_sent',
        details: {
          platform,
          leadId,
          conversationId: conversation.id,
          content: cleanContent, // Use sanitized content
          outcome: `Reddit engagement in r/${redditPost.subreddit} on post ${redditPost.postId}`,
        },
        result: { success: true },
      });

      // Create inbox notification for user
      const AgentInboxService = (await import('./AgentInboxService')).default;
      await AgentInboxService.createAgentActionNotification(userId, agent.id, {
        type: 'reddit_comment',
        description: `Posted comment in r/${redditPost.subreddit}`,
        details: {
          subreddit: redditPost.subreddit,
          postTitle: redditPost.title,
          comment: cleanContent.substring(0, 150) + (cleanContent.length > 150 ? '...' : ''),
          redditUrl: `https://reddit.com${redditPost.permalink}`,
        },
        success: true,
      });

      this.emit('reddit_conversation_started', { conversation, lead, agent, strategy });

      return conversation;
    } catch (error) {
      console.error('Failed to start Reddit conversation:', error);
      throw error;
    }
  }

  /**
   * Start a conversation with a lead (original method)
   */
  async startConversation(
    userId: string,
    leadId: string,
    platform: string,
    initialContext?: string,
  ): Promise<Conversation> {
    try {
      console.log(`🔍 Starting conversation for user ${userId}, lead ${leadId}`);

      // Ensure agent exists before starting conversation
      const agent = await this.ensureAgentExists(userId);
      this.agents.set(agent.id, agent); // Cache in memory
      console.log(`✅ Agent ${agent.id} loaded for conversation`);

      const lead = await this.getLead(leadId);
      if (!lead) throw new Error('Lead not found');

      // Create conversation
      const conversation: Conversation = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        userId,
        agentId: agent.id,
        leadId,
        platform,
        status: 'active',
        priority: lead.priority === 'hot' ? 'high' : 'normal',
        messages: [],
        context: {
          originalTopic: initialContext || 'Initial outreach',
          currentObjective: 'Introduction and discovery',
          stage: 'introduction',
          agentConfidence: 0.8,
        },
        state: {
          requiresUserInput: false,
          blockers: [],
          opportunities: lead.aiInsights?.opportunities || [],
          sentiment: 'neutral',
          engagement: 'medium',
        },
        createdAt: new Date(),
        lastMessage: new Date(),
        lastAgentAction: new Date(),
      };

      // This feature requires GeminiService integration for AI message generation
      console.warn('AI message generation requires GeminiService integration');

      // Use a default initial message
      const aiResponse = {
        success: true,
        response: `Hi! I noticed your interest in ${initialContext || 'our services'}. I'd love to learn more about your needs and see how we can help. What brings you here today?`,
        confidence: 0.7,
      };

      if (aiResponse.success) {
        // Add agent's initial message
        const initialMessage: ConversationMessage = {
          id: `msg_${Date.now()}`,
          type: 'agent',
          content: aiResponse.response,
          timestamp: new Date(),
          platform,
          intent: 'introduction',
          sentiment: 'positive',
          confidence: aiResponse.confidence,
        };

        conversation.messages.push(initialMessage);
        conversation.context.agentConfidence = aiResponse.confidence || 0.8;

        // Save conversation
        await this.saveConversation(conversation);
        this.activeConversations.set(conversation.id, conversation);

        // Update agent metrics
        agent.metrics.conversationsStarted++;
        await this.updateAgent(agent.id, { metrics: agent.metrics });

        // Log action
        await this.logAgentAction(agent.id, {
          type: 'message_sent',
          details: {
            platform,
            leadId,
            conversationId: conversation.id,
            content: aiResponse.response,
          },
          result: { success: true },
        });

        this.emit('conversation_started', { conversation, lead, agent });
      } else {
        // Escalate to user if AI is not confident
        await this.escalateToUser(
          userId,
          agent.id,
          conversation,
          'I need help with the initial outreach message for this lead.',
        );
      }

      return conversation;
    } catch (error) {
      console.error('Failed to start conversation:', error);
      throw error;
    }
  }

  /**
   * Process incoming Reddit message or comment reply
   */
  async processIncomingRedditMessage(
    conversationId: string,
    messageContent: string,
    redditContext: {
      messageId?: string;
      postId: string;
      subreddit: string;
      author: string;
      parentId?: string;
    },
  ): Promise<void> {
    try {
      const conversation =
        this.activeConversations.get(conversationId) ||
        (await this.getConversation(conversationId));

      if (!conversation) {
        console.error(`❌ Conversation ${conversationId} not found in memory or storage`);
        console.error(`   Active conversations count: ${this.activeConversations.size}`);
        throw new Error('Conversation not found');
      }

      console.log(`📬 Processing Reddit message for conversation ${conversationId}`);
      console.log(`   Messages in conversation: ${conversation.messages?.length || 0}`);
      console.log(`   Conversation status: ${conversation.status}`);

      // Ensure agent exists and load into memory
      const agent = await this.ensureAgentExists(conversation.userId, conversation.agentId);
      this.agents.set(agent.id, agent); // Cache in memory
      console.log(`✅ Agent ${agent.id} loaded for Reddit message processing`);

      // Add incoming Reddit message with enhanced context
      const incomingMessage: ConversationMessage = {
        id: `msg_reddit_${Date.now()}`,
        type: 'lead',
        content: messageContent,
        timestamp: new Date(),
        platform: 'reddit',
        messageId: redditContext.messageId,
      };

      conversation.messages.push(incomingMessage);
      conversation.lastMessage = new Date();

      // Skip entity extraction if this is the first message or no messages exist
      if (conversation.messages.length > 1) {
        console.log(
          `🔍 Extracting entities from Reddit message (${conversation.messages.length} messages in history)`,
        );

        try {
          // This feature requires GeminiService integration for AI entity extraction
          console.warn('AI entity extraction requires GeminiService integration');
          incomingMessage.entities = [];
        } catch (entityError) {
          console.warn('⚠️ Entity extraction failed, continuing without entities:', entityError);
          // Don't throw - continue with message processing
        }
      } else {
        console.log('ℹ️ Skipping entity extraction for first message in conversation');
      }

      // This feature requires GeminiService integration for AI response generation
      console.warn('AI response generation requires GeminiService integration');

      // Use a default escalation approach for Reddit messages
      const aiResponse = {
        success: false,
        shouldEscalate: true,
        confidence: 0.3,
      };

      if (aiResponse.success && !aiResponse.shouldEscalate && aiResponse.confidence > 0.7) {
        // Agent is confident - prepare response for Reddit
        const responseMessage: ConversationMessage = {
          id: `msg_${Date.now() + 1}`,
          type: 'agent',
          content: aiResponse.response,
          timestamp: new Date(),
          platform: 'reddit',
          confidence: aiResponse.confidence,
        };

        conversation.messages.push(responseMessage);
        conversation.context.agentConfidence = aiResponse.confidence;
        conversation.lastAgentAction = new Date();

        // Update conversation state
        await this.updateConversationState(conversation);

        // Save conversation
        await this.saveConversation(conversation);
        this.activeConversations.set(conversationId, conversation);

        // Log Reddit-specific action
        await this.logAgentAction(agent.id, {
          type: 'message_sent',
          details: {
            platform: 'reddit',
            leadId: conversation.leadId,
            conversationId: conversation.id,
            content: aiResponse.response,
            outcome: `Reddit response in r/${redditContext.subreddit}`,
          },
          result: { success: true },
        });

        this.emit('reddit_message_sent', {
          conversation,
          message: responseMessage,
          agent,
          redditContext,
        });
      } else {
        // Escalate to user with Reddit context
        conversation.status = 'waiting_for_user';
        await this.escalateToUser(
          conversation.userId,
          conversation.agentId,
          conversation,
          aiResponse.shouldEscalate
            ? `I'm not confident about how to respond to this Reddit ${redditContext.parentId ? 'reply' : 'message'} in r/${redditContext.subreddit}.`
            : 'I need guidance on the best response approach for this Reddit interaction.',
        );
      }
    } catch (error) {
      console.error('Failed to process incoming Reddit message:', error);
    }
  }

  /**
   * Process incoming message from lead (original method)
   */
  async processIncomingMessage(
    conversationId: string,
    messageContent: string,
    messageId?: string,
  ): Promise<void> {
    try {
      const conversation =
        this.activeConversations.get(conversationId) ||
        (await this.getConversation(conversationId));

      if (!conversation) {
        console.error(`❌ Conversation ${conversationId} not found in memory or storage`);
        console.error(`   Active conversations count: ${this.activeConversations.size}`);
        throw new Error('Conversation not found');
      }

      console.log(`📬 Processing message for conversation ${conversationId}`);
      console.log(`   Messages in conversation: ${conversation.messages?.length || 0}`);
      console.log(`   Conversation status: ${conversation.status}`);

      // Ensure agent exists and load into memory
      const agent = await this.ensureAgentExists(conversation.userId, conversation.agentId);
      this.agents.set(agent.id, agent); // Cache in memory
      console.log(`✅ Agent ${agent.id} loaded for message processing`);

      // Add incoming message
      const incomingMessage: ConversationMessage = {
        id: `msg_${Date.now()}`,
        type: 'lead',
        content: messageContent,
        timestamp: new Date(),
        platform: conversation.platform,
        messageId,
      };

      conversation.messages.push(incomingMessage);
      conversation.lastMessage = new Date();

      // Track lead response for billing (first response qualifies as "expressed interest")
      await LeadQualificationTracker.trackLeadResponse(
        conversation.userId,
        conversation.leadId,
        conversation.agentId,
        conversationId,
      );

      // Skip entity extraction if this is the first message or no messages exist
      if (conversation.messages.length > 1) {
        console.log(
          `🔍 Extracting entities from message (${conversation.messages.length} messages in history)`,
        );

        try {
          // This feature requires GeminiService integration for AI entity extraction
          console.warn('AI entity extraction requires GeminiService integration');
          incomingMessage.entities = [];
        } catch (entityError) {
          console.warn('⚠️ Entity extraction failed, continuing without entities:', entityError);
          // Don't throw - continue with message processing
        }
      } else {
        console.log('ℹ️ Skipping entity extraction for first message in conversation');
      }

      // This feature requires GeminiService integration for AI response generation
      console.warn('AI response generation requires GeminiService integration');

      // Use a default escalation approach
      const aiResponse = {
        success: false,
        shouldEscalate: true,
        confidence: 0.3,
      };

      if (aiResponse.success && !aiResponse.shouldEscalate && aiResponse.confidence > 0.7) {
        // Agent is confident - send response
        const responseMessage: ConversationMessage = {
          id: `msg_${Date.now() + 1}`,
          type: 'agent',
          content: aiResponse.response,
          timestamp: new Date(),
          platform: conversation.platform,
          confidence: aiResponse.confidence,
        };

        conversation.messages.push(responseMessage);
        conversation.context.agentConfidence = aiResponse.confidence;
        conversation.lastAgentAction = new Date();

        // Update conversation state
        await this.updateConversationState(conversation);

        // Save conversation
        await this.saveConversation(conversation);
        this.activeConversations.set(conversationId, conversation);

        // Log action
        await this.logAgentAction(agent.id, {
          type: 'message_sent',
          details: {
            platform: conversation.platform,
            leadId: conversation.leadId,
            conversationId: conversation.id,
            content: aiResponse.response,
          },
          result: { success: true },
        });

        this.emit('message_sent', { conversation, message: responseMessage, agent });
      } else {
        // Escalate to user with more specific guidance
        conversation.status = 'waiting_for_user';
        const escalationReason = aiResponse.shouldEscalate
          ? `I'm not confident about how to respond to this message. The lead said: "${messageContent.substring(0, 100)}${messageContent.length > 100 ? '...' : ''}"`
          : `I need guidance on the best response approach. The lead said: "${messageContent.substring(0, 100)}${messageContent.length > 100 ? '...' : ''}"`;

        await this.escalateToUser(
          conversation.userId,
          conversation.agentId,
          conversation,
          escalationReason,
        );
      }
    } catch (error) {
      console.error('Failed to process incoming message:', error);
    }
  }

  /**
   * Update lead based on Reddit engagement results
   */
  async updateLeadFromRedditEngagement(
    leadId: string,
    engagementResult: any,
    conversationContext: any,
  ): Promise<void> {
    try {
      const lead = await this.getLead(leadId);
      if (!lead) throw new Error('Lead not found');

      const updates: Partial<Lead> = {
        lastContact: new Date(),
        status: engagementResult.success ? 'contacted' : lead.status,
      };

      // Update priority based on engagement success and response
      if (engagementResult.success) {
        if (lead.priority === 'cold') {
          updates.priority = 'warm';
        }
        // Add to next follow-up schedule
        updates.nextFollowUp = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      }

      // Update AI insights based on engagement
      if (lead.aiInsights) {
        updates.aiInsights = {
          ...lead.aiInsights,
          bestApproach: engagementResult.success
            ? 'Continue Reddit engagement'
            : 'Try alternative approach',
          opportunities: [
            ...lead.aiInsights.opportunities,
            engagementResult.success ? 'Active Reddit engagement' : 'Engagement challenges',
          ],
        };
      }

      await this.updateLead(leadId, updates);

      console.log(`Updated lead ${leadId} based on Reddit engagement result`);
    } catch (error) {
      console.error('Failed to update lead from Reddit engagement:', error);
    }
  }

  /**
   * Process user response to agent question
   */
  async processUserResponse(
    userId: string,
    inboxItemId: string,
    userResponse: string,
    shouldLearn: boolean = true,
  ): Promise<{ success: boolean; agentResponse?: string; error?: string }> {
    try {
      const inboxItem = await AgentInboxService.getInboxItem(inboxItemId);
      if (!inboxItem || inboxItem.userId !== userId) {
        throw new Error('Inbox item not found');
      }

      // Mark inbox item as answered
      await AgentInboxService.markAsAnswered(inboxItemId, userResponse, shouldLearn);

      // If it's related to a conversation, continue the conversation
      if (inboxItem.content.conversationId) {
        const conversation = await this.getConversation(inboxItem.content.conversationId);
        if (conversation) {
          // Add user guidance as a system message
          const guidanceMessage: ConversationMessage = {
            id: `msg_${Date.now()}`,
            type: 'user',
            content: userResponse,
            timestamp: new Date(),
            platform: conversation.platform,
          };

          conversation.messages.push(guidanceMessage);
          conversation.status = 'active';

          // This feature requires GeminiService integration for AI response generation
          console.warn('AI response generation requires GeminiService integration');

          // Use the user's response directly as the agent's response
          const aiResponse = {
            success: true,
            response: userResponse,
            confidence: 0.9,
          };

          if (aiResponse.success && !aiResponse.shouldEscalate) {
            // Generate agent response with user guidance
            const responseMessage: ConversationMessage = {
              id: `msg_${Date.now() + 1}`,
              type: 'agent',
              content: aiResponse.response,
              timestamp: new Date(),
              platform: conversation.platform,
              confidence: aiResponse.confidence,
            };

            conversation.messages.push(responseMessage);
            conversation.status = 'active';
            conversation.lastAgentAction = new Date();

            await this.saveConversation(conversation);
            this.activeConversations.set(conversation.id, conversation);

            // Log successful continuation
            await this.logAgentAction(conversation.agentId, {
              type: 'message_sent',
              details: {
                platform: conversation.platform,
                leadId: conversation.leadId,
                conversationId: conversation.id,
                content: aiResponse.response,
                outcome: `Continued conversation with user guidance: ${userResponse.substring(0, 100)}${userResponse.length > 100 ? '...' : ''}`,
              },
              result: { success: true },
            });

            this.emit('message_sent', {
              conversation,
              message: responseMessage,
              agent: { id: conversation.agentId },
            });

            // Return success with contextual agent response
            return {
              success: true,
              agentResponse: 'Perfect! I\'ve processed your guidance about how to respond. I\'ll use your instructions to craft a response that addresses their needs. Thanks for helping me learn!',
            };
          } else {
            // Still not confident, escalate again with more context
            const lastLeadMessage =
              conversation.messages.filter(msg => msg.type === 'lead').pop()?.content || 'Unknown';

            await this.escalateToUser(
              userId,
              conversation.agentId,
              conversation,
              `I still need more guidance. The lead said: "${lastLeadMessage.substring(0, 100)}${lastLeadMessage.length > 100 ? '...' : ''}" and you suggested: "${userResponse}". Can you provide more specific guidance on how to respond?`,
            );

            return {
              success: false,
              agentResponse: 'I\'ve noted your guidance, but I still need more specific instructions. I\'ve created a new question for you to help me better understand how to respond.',
            };
          }
        }
      }

      // Learn from user response if requested
      if (shouldLearn) {
        await KnowledgeBaseService.learnFromUserResponse(
          userId,
          inboxItem.content.title,
          userResponse,
          inboxItem.content.context,
        );
      }

      this.emit('user_response_processed', { inboxItem, userResponse, shouldLearn });

      // Return success for non-conversation items
      const questionTitle = inboxItem.content.title || 'this question';
      return {
        success: true,
        agentResponse: `Thanks for your response to "${questionTitle}"! I've processed your guidance and will use it to improve my future interactions. This will help me provide better assistance going forward.`,
      };
    } catch (error) {
      console.error('Failed to process user response:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Run autonomous agent operations
   */
  async runAutonomousOperations(userId: string): Promise<void> {
    try {
      console.log(`🔍 Running autonomous operations for user ${userId}`);

      // Ensure agent exists and get agentId
      const agent = await this.ensureAgentExists(userId);
      this.agents.set(agent.id, agent); // Cache in memory
      console.log(`✅ Agent ${agent.id} loaded for autonomous operations`);

      if (agent.status !== 'active') {
        console.log(
          `⚠️ Agent ${agent.id} is not active (status: ${agent.status}), skipping autonomous operations`,
        );
        return;
      }

      // Prevent multiple simultaneous operations
      if (this.processingQueue.get(agent.id)) return;
      this.processingQueue.set(agent.id, true);

      try {
        // 1. Check for follow-up conversations
        await this.processFollowUps(userId, agent.id);

        // 2. Scan platforms for new leads
        await this.scanForNewLeads(userId, agent.id);

        // 3. Update conversation states
        await this.updateActiveConversations(userId, agent.id);

        // 4. Generate performance metrics
        await this.updateAgentMetrics(agent.id);
      } finally {
        this.processingQueue.set(agent.id, false);
      }
    } catch (error) {
      console.error('Autonomous operation failed:', error);
    }
  }

  /**
   * Escalate conversation to user using Vertex AI for question generation
   */
  private async escalateToUser(
    userId: string,
    agentId: string,
    conversation: Conversation,
    reason: string,
  ): Promise<void> {
    const lead = await this.getLead(conversation.leadId);

    const lastLeadMessage =
      conversation.messages.filter(msg => msg.type === 'lead').pop()?.content ||
      'No recent message';

    // Generate AI-powered question using Vertex AI
    const aiQuestion = await this.generateEscalationQuestion(
      userId,
      agentId,
      conversation,
      reason,
      lastLeadMessage,
      lead,
    );

    const inboxItem: Omit<AgentInboxItem, 'id' | 'createdAt'> = {
      userId,
      agentId,
      type: 'question',
      priority: conversation.priority === 'urgent' ? 'urgent' : 'high',
      content: {
        title: `How should I respond to ${lead?.contact.name || 'this lead'}?`,
        description: aiQuestion,
        context: {
          leadInfo: {
            name: lead?.contact.name || lead?.contact.username || 'Unknown',
            company: lead?.contact.company,
            qualification: lead?.qualification,
          },
          conversationHistory: conversation.messages.slice(-5),
          currentStage: conversation.context.stage,
          agentIntent: conversation.context.currentObjective,
          blockers: conversation.state.blockers,
        },
        conversationId: conversation.id,
        relatedLeadId: conversation.leadId,
      },
      status: 'pending',
      urgencyLevel: conversation.priority === 'urgent' ? 9 : 7,
      autoResolveAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    await AgentInboxService.createInboxItem(inboxItem);

    conversation.status = 'waiting_for_user';
    await this.saveConversation(conversation);

    this.emit('escalated_to_user', { conversation, reason, inboxItem });
  }

  /**
   * Generate escalation question
   */
  private async generateEscalationQuestion(
    userId: string,
    agentId: string,
    conversation: Conversation,
    reason: string,
    lastLeadMessage: string,
    lead: any,
  ): Promise<string> {
    try {
      // This feature requires GeminiService integration for AI question generation
      console.warn('AI escalation question generation requires GeminiService integration');
      return this.generateFallbackEscalationQuestion(reason, lastLeadMessage, lead);
    } catch (error) {
      console.error('Failed to generate AI escalation question:', error);
      return this.generateFallbackEscalationQuestion(reason, lastLeadMessage, lead);
    }
  }

  /**
   * Fallback escalation question generation if AI fails
   */
  private generateFallbackEscalationQuestion(
    reason: string,
    lastLeadMessage: string,
    lead: any,
  ): string {
    return `**Lead said:** "${lastLeadMessage.substring(0, 150)}${lastLeadMessage.length > 150 ? '...' : ''}"\n\n**Issue:** ${reason}\n\n**What I need:** Please provide a specific response I should send to this lead.`;
  }

  /**
   * Helper methods for data management
   */
  private async getUserAgent(userId: string): Promise<SalesAgent | null> {
    try {
      const agents = await BackendService.queryDocuments<SalesAgent>(
        COLLECTIONS.SALES_AGENTS,
        { where: [{ field: 'userId', operator: '==', value: userId }], limit: 1 },
        { useCache: true, cacheKey: `agent_${userId}`, cacheTTL: 5 * 60 * 1000 },
      );
      return agents.length > 0 ? agents[0] : null;
    } catch (error) {
      console.error('Failed to get user agent:', error);
      return null;
    }
  }

  private async getAgentId(userId: string): Promise<string> {
    console.log(`🔍 Getting agent ID for user ${userId}`);
    let agent = await this.getUserAgent(userId);

    if (!agent) {
      console.warn(`⚠️ No agent found for user ${userId}, creating default agent`);
      agent = await this.initializeAgent(userId);
      console.log(`✅ Created agent ${agent.id} for user ${userId}`);
    }

    // Cache in memory
    this.agents.set(agent.id, agent);
    console.log(`💾 Agent ${agent.id} cached in memory`);

    return agent.id;
  }

  private async saveAgent(agent: SalesAgent): Promise<void> {
    try {
      if (agent.id && agent.id.startsWith('agent_')) {
        // Update existing agent
        await BackendService.updateDocument(COLLECTIONS.SALES_AGENTS, agent.id, agent);
      } else {
        // Create new agent
        await BackendService.createDocument(COLLECTIONS.SALES_AGENTS, agent);
      }
    } catch (error) {
      console.error('Failed to save agent:', error);
      throw error;
    }
  }

  private async updateAgent(agentId: string, updates: Partial<SalesAgent>): Promise<void> {
    try {
      let agent = this.agents.get(agentId);

      // If not in memory, try to load from Firestore
      if (!agent) {
        console.log(`⚠️ Agent ${agentId} not in memory, loading from Firestore`);
        const fetchedAgent = await BackendService.getDocument<SalesAgent>(
          COLLECTIONS.SALES_AGENTS,
          agentId,
        );
        if (fetchedAgent) {
          this.agents.set(agentId, fetchedAgent);
          agent = fetchedAgent;
          console.log(`✅ Agent ${agentId} loaded into memory`);
        }
      }

      if (agent) {
        Object.assign(agent, updates);
        agent.updatedAt = new Date();
        await BackendService.updateDocument(COLLECTIONS.SALES_AGENTS, agentId, {
          ...updates,
          updatedAt: new Date(),
        });
        this.agents.set(agentId, agent);
      }
    } catch (error) {
      console.error('Failed to update agent:', error);
      throw error;
    }
  }

  private async createLead(
    userId: string,
    agentId: string,
    leadData: Partial<Lead>,
  ): Promise<Lead> {
    const lead: Omit<Lead, 'id'> & { userId: string } = {
      userId,
      agentId,
      contact: {
        username: leadData.contact?.username || 'unknown',
        platform: leadData.contact?.platform || 'unknown',
        profileUrl: leadData.contact?.profileUrl || '',
        ...leadData.contact,
      },
      qualification: {
        score: 0,
        stage: 'suspect',
        interests: [],
        buyingSignals: [],
        ...leadData.qualification,
      },
      source: {
        platform: leadData.source?.platform || 'unknown',
        context: leadData.source?.context || 'Unknown source',
        discoveredAt: new Date(),
        ...leadData.source,
      },
      conversations: [],
      status: 'new',
      priority: 'warm',
      assignedProducts: [],
      estimatedValue: 0,
      createdAt: new Date(),
      lastContact: new Date(),
      aiInsights: {
        buyingIntent: 0.5,
        bestApproach: 'Direct outreach',
        riskFactors: [],
        opportunities: [],
        competitorMentions: [],
      },
      ...leadData,
    };

    return await BackendService.createDocument<Lead>(COLLECTIONS.LEADS, lead);
  }

  private async getLead(leadId: string): Promise<Lead | null> {
    try {
      return await BackendService.getDocument<Lead>(COLLECTIONS.LEADS, leadId, {
        useCache: true,
        cacheKey: `lead_${leadId}`,
        cacheTTL: 2 * 60 * 1000,
      });
    } catch (error) {
      console.error('Failed to get lead:', error);
      return null;
    }
  }

  private async updateLead(leadId: string, updates: Partial<Lead>): Promise<void> {
    try {
      await BackendService.updateDocument<Lead>(COLLECTIONS.LEADS, leadId, updates);
    } catch (error) {
      console.error('Failed to update lead:', error);
      throw error;
    }
  }

  private async saveConversation(conversation: Conversation): Promise<void> {
    try {
      if (conversation.id && conversation.id.startsWith('conv_')) {
        // Update existing conversation
        await BackendService.updateDocument(
          COLLECTIONS.CONVERSATIONS,
          conversation.id,
          conversation,
        );
      } else {
        // Create new conversation
        const conversationData: Omit<Conversation, 'id'> & { userId: string } = conversation;
        await BackendService.createDocument<Conversation>(
          COLLECTIONS.CONVERSATIONS,
          conversationData,
        );
      }
    } catch (error) {
      console.error('Failed to save conversation:', error);
      throw error;
    }
  }

  private async getConversation(conversationId: string): Promise<Conversation | null> {
    try {
      return await BackendService.getDocument<Conversation>(
        COLLECTIONS.CONVERSATIONS,
        conversationId,
        { useCache: true, cacheKey: `conv_${conversationId}`, cacheTTL: 2 * 60 * 1000 },
      );
    } catch (error) {
      console.error('Failed to get conversation:', error);
      return null;
    }
  }

  // Additional helper methods...
  private async initializeDefaultKnowledge(userId: string, agentId: string): Promise<void> {
    // Initialize with basic sales knowledge
    await KnowledgeBaseService.addKnowledgeItem(userId, agentId, {
      type: 'sales_script',
      category: 'introduction',
      content: {
        title: 'Professional Introduction',
        answer:
          'Hi [Name], I noticed your interest in [topic]. I help companies like yours achieve [specific benefit]. Would you be open to a brief conversation about your current challenges?',
        context: 'Initial outreach template',
      },
      source: 'system_default',
      confidence: 0.9,
      tags: ['introduction', 'outreach', 'template'],
    });
  }

  private async updateLeadFromEntities(leadId: string, entities: ExtractedEntity[]): Promise<void> {
    const lead = await this.getLead(leadId);
    if (!lead) return;

    entities.forEach(entity => {
      switch (entity.type) {
        case 'budget':
          lead.qualification.budget = parseFloat(entity.value.replace(/[^\d.]/g, ''));
          break;
        case 'timeline':
          lead.qualification.timeline = entity.value;
          break;
        case 'pain_point':
          if (!lead.qualification.pain) lead.qualification.pain = '';
          lead.qualification.pain += ` ${entity.value}`;
          break;
      }
    });

    await this.updateLead(leadId, { qualification: lead.qualification });
  }

  private async updateConversationState(conversation: Conversation): Promise<void> {
    // Analyze conversation progress and update state
    const messageCount = conversation.messages.length;
    const lastMessages = conversation.messages.slice(-3);

    // Update sentiment based on recent messages
    const positiveWords = ['yes', 'interested', 'sounds good', 'great', 'perfect'];
    const negativeWords = ['no', 'not interested', 'busy', 'expensive'];

    const recentContent = lastMessages
      .map(m => m.content)
      .join(' ')
      .toLowerCase();

    if (positiveWords.some(word => recentContent.includes(word))) {
      conversation.state.sentiment = 'positive';
      conversation.state.engagement = 'high';
    } else if (negativeWords.some(word => recentContent.includes(word))) {
      conversation.state.sentiment = 'negative';
      conversation.state.engagement = 'low';
    }

    // Progress conversation stage based on content
    if (messageCount > 10 && conversation.context.stage === 'introduction') {
      conversation.context.stage = 'discovery';
      conversation.context.currentObjective = 'Understanding needs and pain points';
    }
  }

  private async logAgentAction(
    agentId: string,
    action: Omit<AgentAction, 'id' | 'userId' | 'agentId' | 'timestamp'>,
  ): Promise<void> {
    let agent = this.agents.get(agentId);

    // If not in memory, try to load from Firestore
    if (!agent) {
      console.log(`⚠️ Agent ${agentId} not in memory for logging, loading from Firestore`);
      const fetchedAgent = await BackendService.getDocument<SalesAgent>(
        COLLECTIONS.SALES_AGENTS,
        agentId,
      );
      if (fetchedAgent) {
        this.agents.set(agentId, fetchedAgent);
        agent = fetchedAgent;
      }
    }

    if (!agent) {
      console.warn(`⚠️ Could not log agent action: Agent ${agentId} not found`);
      return;
    }

    const actionData: Omit<AgentAction, 'id'> & { userId: string } = {
      userId: agent.userId,
      agentId,
      timestamp: new Date(),
      ...action,
    };

    try {
      await BackendService.createDocument<AgentAction>(COLLECTIONS.AGENT_ACTIONS, actionData);
    } catch (error) {
      console.error('Failed to log agent action:', error);
    }
  }

  // Placeholder methods for autonomous operations
  private async processFollowUps(userId: string, agentId: string): Promise<void> {
    // Implementation for following up on conversations
  }

  private async scanForNewLeads(userId: string, agentId: string): Promise<void> {
    // Implementation for scanning connected platforms
  }

  private async updateActiveConversations(userId: string, agentId: string): Promise<void> {
    // Implementation for updating conversation states
  }

  private async updateAgentMetrics(agentId: string): Promise<void> {
    // Implementation for calculating and updating metrics
  }

  // Event system
  private emit(event: string, data: any): void {
    const listener = this.listeners.get(event);
    if (listener) {
      try {
        listener(data);
      } catch (error) {
        console.error(`Event listener error for ${event}:`, error);
      }
    }
  }

  public addEventListener(event: string, listener: (data: any) => void): void {
    this.listeners.set(event, listener);
  }

  public removeEventListener(event: string): void {
    this.listeners.delete(event);
  }
}

interface AgentEvent {
  type: string;
  data: any;
  timestamp: Date;
}

export default new SalesAgentCore();
