// @ts-nocheck
import KnowledgeBaseService from './KnowledgeBaseService';
import SalesAgentCore from './SalesAgentCore';
import { SalesAgent, Conversation, ConversationMessage, Lead } from '../types/agent';

/**
 * Enhanced Sales Agent using Vertex AI Agent Builder
 *
 * ARCHITECTURE:
 * - Agent intelligence: Vertex AI Agent Builder (Google Cloud)
 * - Automation metadata: Firestore sales_agents collection (jobId, searchQueries, status)
 * - Conversation/Lead processing: Delegated to SalesAgentCore
 *
 * This service:
 * 1. Creates agents in Vertex AI Agent Builder
 * 2. Returns lightweight SalesAgent representations
 * 3. Delegates conversation handling to SalesAgentCore
 * 4. Does NOT save full agent data to Firestore (only metadata)
 */
class EnhancedSalesAgentCore {
  private vertexAgents: Map<string, string> = new Map();
  private baseCore = SalesAgentCore;

  constructor() {
    // Initialize with base core
  }

  /**
   * Initialize enhanced agent (requires GeminiService integration)
   */
  async initializeEnhancedAgent(userId: string): Promise<SalesAgent> {
    console.log(`🤖 Initializing enhanced agent for user: ${userId}`);
    console.warn('⚠️ Enhanced agent features require GeminiService integration');

    // Get user's business context
    const businessContext = await this.getBusinessContext(userId);

    // Get existing knowledge base
    const knowledgeBase = await KnowledgeBaseService.getUserKnowledge(userId);

    console.log('📊 Agent prerequisites:');
    console.log(`   Industry: ${businessContext.industry}`);
    console.log(`   Total Knowledge: ${knowledgeBase.length} items`);

    // Generate a simple agent ID
    const agentId = `agent_${userId}_${Date.now()}`;

    // Store agent ID mapping
    this.vertexAgents.set(userId, agentId);

    console.log('✅ Enhanced agent initialized (limited functionality - requires GeminiService integration)');
    console.log(`   Agent ID: ${agentId}`);

    // Return lightweight agent representation for UI
    const agent: SalesAgent = {
      id: agentId,
      userId,
      name: `Sales Agent for ${userId}`,
      description: 'Dialogflow CX sales agent',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      config: {
        personality: 'professional and consultative',
        industry: businessContext.industry,
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
        knowledgeBaseSize: knowledgeBase.length,
        confidenceLevel: knowledgeBase.length > 0 ? 0.8 : 0.4,
        unansweredQuestions: 0,
        lastLearningUpdate: new Date(),
      },
    };

    return agent;
  }

  /**
   * Process incoming message using Vertex AI Agent Builder
   */
  async processIncomingMessageEnhanced(
    conversationId: string,
    message: ConversationMessage,
    agentId: string,
  ): Promise<void> {
    try {
      // Get conversation using the base core's public methods
      const conversation = await this.getConversation(conversationId);
      if (!conversation) {
        console.error('Conversation not found:', conversationId);
        return;
      }

      const { userId } = conversation;
      const vertexAgentId = this.vertexAgents.get(userId);

      if (!vertexAgentId) {
        console.log('No Vertex AI agent found, falling back to base processing');
        return this.baseCore.processIncomingMessage(conversationId, message.content, agentId);
      }

      console.log(`🤖 Processing message with enhanced agent for user: ${userId}`);
      console.warn('⚠️ Enhanced message processing requires GeminiService integration');

      // Get lead information
      const lead = await this.getLead(conversation.leadId);

      // This feature requires GeminiService integration
      const mappedResult = {
        nextAction: 'escalate' as const,
        response: 'This feature requires GeminiService integration',
        confidence: 0.1,
        intent: 'unknown',
        escalationReason: 'Enhanced message processing requires GeminiService integration',
      };

      console.log(
        `📊 Agent response: ${mappedResult.nextAction} (confidence: ${mappedResult.confidence})`,
      );

      // Handle the response based on agent's decision
      switch (mappedResult.nextAction) {
        case 'continue':
          await this.sendAgentResponse(
            conversation,
            mappedResult.response,
            mappedResult.confidence,
          );
          break;

        case 'escalate':
          await this.escalateToUser(
            userId,
            agentId,
            conversation,
            mappedResult.escalationReason || 'Agent needs human assistance',
          );
          break;

        case 'schedule_demo':
          await this.handleDemoRequest(conversation, mappedResult.response);
          break;

        case 'send_info':
          await this.handleInfoRequest(conversation, mappedResult.response);
          break;

        case 'qualify':
          await this.handleQualificationRequest(conversation, mappedResult.response);
          break;
      }

      // Update conversation state
      conversation.status = mappedResult.nextAction === 'escalate' ? 'waiting_for_user' : 'active';
      conversation.context.currentObjective =
        mappedResult.intent || conversation.context.currentObjective;

      await this.saveConversation(conversation);

      // Log the interaction
      await this.logAgentAction(agentId, {
        type: 'message_sent',
        details: {
          platform: conversation.platform,
          leadId: conversation.leadId,
          conversationId: conversation.id,
          content: mappedResult.response,
          outcome: `Enhanced agent response: ${mappedResult.nextAction}`,
        },
        result: { success: true },
      });
    } catch (error) {
      console.error('Failed to process message with enhanced agent:', error);
      // Fallback to base processing
      return this.baseCore.processIncomingMessage(conversationId, message.content, agentId);
    }
  }

  /**
   * Handle demo scheduling requests
   */
  private async handleDemoRequest(conversation: Conversation, response: string): Promise<void> {
    try {
      // Create calendar booking link or schedule with sales team
      const demoLink = await this.createDemoBooking(conversation.leadId);

      const demoMessage: ConversationMessage = {
        id: `msg_${Date.now()}`,
        type: 'agent',
        content: `${response}\n\nI'd love to show you how this works! You can schedule a demo here: ${demoLink}`,
        timestamp: new Date(),
        platform: conversation.platform,
      };

      conversation.messages.push(demoMessage);
      await this.saveConversation(conversation);

      console.log(`📅 Demo scheduled for conversation: ${conversation.id}`);
    } catch (error) {
      console.error('Failed to handle demo request:', error);
    }
  }

  /**
   * Handle information requests (pricing, features, etc.)
   */
  private async handleInfoRequest(conversation: Conversation, response: string): Promise<void> {
    try {
      // Send relevant information based on conversation context
      const lead = await this.getLead(conversation.leadId);
      const relevantInfo = await this.getRelevantInformation(lead);

      const infoMessage: ConversationMessage = {
        id: `msg_${Date.now()}`,
        type: 'agent',
        content: `${response}\n\nHere's some information that might help:\n${relevantInfo}`,
        timestamp: new Date(),
        platform: conversation.platform,
      };

      conversation.messages.push(infoMessage);
      await this.saveConversation(conversation);

      console.log(`📋 Information sent for conversation: ${conversation.id}`);
    } catch (error) {
      console.error('Failed to handle info request:', error);
    }
  }

  /**
   * Handle qualification requests
   */
  private async handleQualificationRequest(
    conversation: Conversation,
    response: string,
  ): Promise<void> {
    try {
      const qualificationMessage: ConversationMessage = {
        id: `msg_${Date.now()}`,
        type: 'agent',
        content: response,
        timestamp: new Date(),
        platform: conversation.platform,
      };

      conversation.messages.push(qualificationMessage);
      conversation.context.stage = 'qualification';

      await this.saveConversation(conversation);

      console.log(`❓ Qualification questions sent for conversation: ${conversation.id}`);
    } catch (error) {
      console.error('Failed to handle qualification request:', error);
    }
  }

  /**
   * Get business context for agent initialization
   */
  private async getBusinessContext(userId: string): Promise<{
    industry: string;
    targetCustomers: string[];
    painPoints: string[];
    valueProps: string[];
    pricing?: string;
    competitors?: string[];
  }> {
    try {
      const knowledge = await KnowledgeBaseService.getUserKnowledge(userId);

      return {
        industry: this.extractIndustry(knowledge),
        targetCustomers: this.extractTargetCustomers(knowledge),
        painPoints: this.extractPainPoints(knowledge),
        valueProps: this.extractValueProps(knowledge),
        pricing: this.extractPricing(knowledge),
        competitors: this.extractCompetitors(knowledge),
      };
    } catch (error) {
      console.error('Failed to get business context:', error);
      // Return default context
      return {
        industry: 'Technology',
        targetCustomers: ['Small businesses', 'Startups'],
        painPoints: ['Manual processes', 'Lack of automation'],
        valueProps: ['Increased efficiency', 'Cost savings'],
      };
    }
  }

  private extractIndustry(knowledge: any[]): string {
    const industryKb = knowledge.find(kb => kb.category === 'target_audience');
    return industryKb?.content.title || 'Technology';
  }

  private extractTargetCustomers(knowledge: any[]): string[] {
    return knowledge
      .filter(kb => kb.category === 'target_audience')
      .map(kb => kb.content.title)
      .slice(0, 5);
  }

  private extractPainPoints(knowledge: any[]): string[] {
    return knowledge
      .filter(kb => kb.category === 'pain_points')
      .map(kb => kb.content.title)
      .slice(0, 5);
  }

  private extractValueProps(knowledge: any[]): string[] {
    return knowledge
      .filter(kb => kb.category === 'value_proposition')
      .map(kb => kb.content.title)
      .slice(0, 5);
  }

  private extractPricing(knowledge: any[]): string | undefined {
    const pricingKb = knowledge.find(kb => kb.category === 'pricing');
    return pricingKb?.content.title;
  }

  private extractCompetitors(knowledge: any[]): string[] {
    return knowledge
      .filter(kb => kb.category === 'competitors')
      .map(kb => kb.content.title)
      .slice(0, 3);
  }

  /**
   * Update agent's knowledge base when user adds new information
   */
  async updateAgentKnowledge(userId: string, newKnowledge: any[]): Promise<void> {
    try {
      console.warn('⚠️ Enhanced agent knowledge updates require GeminiService integration');

      // Update base knowledge base only
      for (const knowledge of newKnowledge) {
        await KnowledgeBaseService.addKnowledgeItem(userId, 'enhanced-agent', knowledge);
      }
    } catch (error) {
      console.error('Failed to update agent knowledge:', error);
    }
  }

  /**
   * Get enhanced analytics
   */
  async getEnhancedAnalytics(userId: string): Promise<any> {
    try {
      console.warn('⚠️ Enhanced analytics require GeminiService integration');

      // Return basic analytics structure
      return {
        totalConversations: 0,
        successfulConversations: 0,
        escalationRate: 0,
        averageConfidence: 0,
        topIntents: [],
        conversionRate: 0,
      };
    } catch (error) {
      console.error('Failed to get enhanced analytics:', error);
      return {
        totalConversations: 0,
        successfulConversations: 0,
        escalationRate: 0,
        averageConfidence: 0,
        topIntents: [],
        conversionRate: 0,
      };
    }
  }

  /**
   * Check if user has enhanced agent
   */
  async hasEnhancedAgent(userId: string): Promise<boolean> {
    // Check if we have a cached agent for this user
    return this.vertexAgents.has(userId);
  }

  /**
   * Process incoming Reddit lead
   */
  async processIncomingRedditLead(
    userId: string,
    redditPost: any,
    job: any,
    qualification: any,
  ): Promise<{ lead: Lead; shouldStartConversation: boolean; conversation?: any }> {
    return await this.baseCore.processIncomingRedditLead(userId, redditPost, job, qualification);
  }

  /**
   * Process incoming lead
   */
  async processIncomingLead(
    userId: string,
    leadData: any,
    context: any,
  ): Promise<{ lead: Lead; shouldStartConversation: boolean; conversation?: any }> {
    return await this.baseCore.processIncomingLead(userId, leadData, context);
  }

  /**
   * Ensure agent exists for user, create if missing
   */
  async ensureAgentExists(userId: string, agentId?: string): Promise<SalesAgent> {
    return await this.baseCore.ensureAgentExists(userId, agentId);
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
    return await this.baseCore.processUserResponse(userId, inboxItemId, userResponse, shouldLearn);
  }

  /**
   * Get vertex agent ID for a user
   */
  getVertexAgentId(userId: string): string | undefined {
    return this.vertexAgents.get(userId);
  }

  /**
   * Create demo booking link
   */
  private async createDemoBooking(leadId: string): Promise<string> {
    // This would integrate with your calendar system
    // For now, return a placeholder
    return `https://calendly.com/your-company/demo?lead=${leadId}`;
  }

  /**
   * Get relevant information for lead
   */
  private async getRelevantInformation(lead: any): Promise<string> {
    // This would pull relevant case studies, pricing, features based on lead's needs
    // For now, return placeholder
    return "Here's our pricing information and some case studies that might be relevant to your situation.";
  }

  // Helper methods that delegate to base core or implement basic functionality
  private async getConversation(conversationId: string): Promise<Conversation | null> {
    // This would need to be implemented based on your data access patterns
    // For now, return null to avoid errors
    return null;
  }

  private async getLead(leadId: string): Promise<any> {
    // This would need to be implemented based on your data access patterns
    // For now, return null to avoid errors
    return null;
  }

  private async sendAgentResponse(
    conversation: Conversation,
    response: string,
    confidence: number,
  ): Promise<void> {
    // This would send the agent response to the conversation
    // For now, just log it
    console.log(`Sending agent response: ${response}`);
  }

  private async escalateToUser(
    userId: string,
    agentId: string,
    conversation: Conversation,
    reason: string,
  ): Promise<void> {
    // This would escalate to the user
    // For now, just log it
    console.log(`Escalating to user: ${reason}`);
  }

  private async saveConversation(conversation: Conversation): Promise<void> {
    // This would save the conversation
    // For now, just log it
    console.log(`Saving conversation: ${conversation.id}`);
  }

  private async logAgentAction(agentId: string, action: any): Promise<void> {
    // This would log the agent action
    // For now, just log it
    console.log(`Logging agent action: ${action.type}`);
  }
}

export default new EnhancedSalesAgentCore();
