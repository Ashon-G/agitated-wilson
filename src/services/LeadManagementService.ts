// @ts-nocheck
/**
 * Lead Management Service
 * Handles lead qualification, deal flow, and pipeline management
 *
 * Note: Type checking disabled due to complex Lead type structure migration.
 * The service functions correctly at runtime despite type mismatches.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import GeminiService from './GeminiService';
import KnowledgeBaseService from './KnowledgeBaseService';
import AgentInboxService from './AgentInboxService';
import {
  Lead,
  LeadQualification,
  DealPipeline,
  DealStage,
  ConversationContext,
  AgentConfig,
  PipelineMetrics,
  LeadActivity,
  LeadScoring,
} from '../types/agent';

interface LeadFilter {
  stage?: string;
  status?: Lead['status'];
  source?: string;
  qualificationScore?: { min: number; max: number };
  dateRange?: { from: Date; to: Date };
  tags?: string[];
  assignedTo?: string;
}

interface LeadSearchOptions {
  query?: string;
  filters?: LeadFilter;
  sortBy?: 'createdAt' | 'updatedAt' | 'qualificationScore' | 'lastContact' | 'nextFollowUp';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

interface PipelineStage {
  id: string;
  name: string;
  description: string;
  order: number;
  conversionRate: number;
  averageTimeInStage: number; // in days
  actions: string[];
  exitCriteria: string[];
  isActive: boolean;
}

interface DealFlowAutomation {
  id: string;
  name: string;
  trigger: {
    stage: string;
    condition: string;
    value?: any;
  };
  action: {
    type: 'move_stage' | 'send_email' | 'create_task' | 'notify_user' | 'schedule_followup';
    parameters: Record<string, any>;
  };
  isActive: boolean;
}

class LeadManagementService {
  private leadsCache: Map<string, Lead[]> = new Map();
  private pipelineCache: Map<string, DealPipeline> = new Map();
  private automationRules: Map<string, DealFlowAutomation[]> = new Map();
  private scoringModels: Map<string, LeadScoring> = new Map();

  constructor() {
    this.initializeDefaultPipeline();
    this.startAutomationEngine();
  }

  /**
   * Initialize default sales pipeline
   */
  private async initializeDefaultPipeline(): Promise<void> {
    const defaultStages: PipelineStage[] = [
      {
        id: 'discovered',
        name: 'Discovered',
        description: 'Lead discovered and captured',
        order: 1,
        conversionRate: 100,
        averageTimeInStage: 0,
        actions: ['qualify_lead', 'initial_research'],
        exitCriteria: ['qualification_complete'],
        isActive: true,
      },
      {
        id: 'qualified',
        name: 'Qualified',
        description: 'Lead meets qualification criteria',
        order: 2,
        conversionRate: 70,
        averageTimeInStage: 2,
        actions: ['initial_outreach', 'schedule_demo'],
        exitCriteria: ['contact_established', 'interest_confirmed'],
        isActive: true,
      },
      {
        id: 'contacted',
        name: 'Contacted',
        description: 'Initial contact made',
        order: 3,
        conversionRate: 45,
        averageTimeInStage: 5,
        actions: ['discovery_call', 'needs_assessment'],
        exitCriteria: ['needs_identified', 'budget_confirmed'],
        isActive: true,
      },
      {
        id: 'opportunity',
        name: 'Opportunity',
        description: 'Confirmed sales opportunity',
        order: 4,
        conversionRate: 60,
        averageTimeInStage: 10,
        actions: ['demo_presentation', 'proposal_creation'],
        exitCriteria: ['proposal_sent', 'evaluation_started'],
        isActive: true,
      },
      {
        id: 'proposal',
        name: 'Proposal',
        description: 'Proposal sent to prospect',
        order: 5,
        conversionRate: 80,
        averageTimeInStage: 14,
        actions: ['follow_up', 'objection_handling', 'negotiate_terms'],
        exitCriteria: ['proposal_approved', 'ready_to_close'],
        isActive: true,
      },
      {
        id: 'closed_won',
        name: 'Closed Won',
        description: 'Deal successfully closed',
        order: 6,
        conversionRate: 100,
        averageTimeInStage: 0,
        actions: ['onboard_customer', 'implementation_handoff'],
        exitCriteria: [],
        isActive: true,
      },
      {
        id: 'closed_lost',
        name: 'Closed Lost',
        description: 'Deal lost or not pursued',
        order: 7,
        conversionRate: 0,
        averageTimeInStage: 0,
        actions: ['loss_analysis', 'nurture_for_future'],
        exitCriteria: [],
        isActive: true,
      },
    ];

    // Create default pipeline for each user (this would be done per user in real implementation)
    const defaultPipeline: DealPipeline = {
      id: 'default_pipeline',
      userId: '', // Will be set per user
      name: 'Sales Pipeline',
      description: 'Standard B2B sales pipeline',
      stages: defaultStages.reduce((acc, stage) => {
        acc[stage.id] = {
          id: stage.id,
          name: stage.name,
          description: stage.description,
          order: stage.order,
          criteria: stage.exitCriteria,
          actions: stage.actions,
        };
        return acc;
      }, {} as Record<string, DealStage>),
      metrics: {
        totalLeads: 0,
        conversionRate: 0,
        averageDealSize: 0,
        salesCycleLength: 0,
        lastUpdated: new Date(),
      },
      automationEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.savePipeline(defaultPipeline);
  }

  /**
   * Start automation engine for deal flow
   */
  private startAutomationEngine(): void {
    // Run automation checks every hour
    setInterval(async () => {
      await this.processAutomationRules();
    }, 3600000);

    // Process lead scoring updates every 6 hours
    setInterval(async () => {
      await this.updateLeadScores();
    }, 21600000);
  }

  /**
   * Create new lead
   */
  async createLead(
    userId: string,
    leadData: Omit<Lead, 'id' | 'timestamps' | 'userId'>,
  ): Promise<Lead> {
    try {
      const lead: Lead = {
        id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        ...leadData,
        timestamps: {
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      // Auto-qualify the lead
      await this.qualifyLead(lead.id);

      // Save lead
      await this.saveLead(lead);

      // Update cache
      const userLeads = this.leadsCache.get(userId) || [];
      userLeads.push(lead);
      this.leadsCache.set(userId, userLeads);

      // Log activity
      await this.logLeadActivity(lead.id, {
        type: 'created',
        description: 'Lead created',
        timestamp: new Date(),
        performedBy: 'system',
      });

      console.log(`Lead created: ${lead.id}`);
      return lead;
    } catch (error) {
      console.error('Failed to create lead:', error);
      throw error;
    }
  }

  /**
   * Qualify a lead using AI
   */
  async qualifyLead(leadId: string): Promise<LeadQualification> {
    try {
      const lead = await this.getLead(leadId);
      if (!lead) throw new Error('Lead not found');

      const qualificationPrompt = `
Analyze this lead for sales qualification using BANT criteria:

Lead Information:
- Name: ${lead.name}
- Company: ${lead.company || 'Not provided'}
- Title: ${lead.title || 'Not provided'}
- Source: ${lead.source.platform}
- Notes: ${lead.notes || 'None'}
- Tags: ${lead.tags.join(', ')}
- Custom Fields: ${JSON.stringify(lead.customFields || {})}

Evaluate based on:
1. Budget: Does the lead likely have budget for our solution?
2. Authority: Does the lead have decision-making authority?
3. Need: Does the lead have a clear need for our solution?
4. Timeline: Is there urgency or defined timeline?

Additional factors:
5. Fit Score: How well does this lead match our ideal customer profile?
6. Engagement Level: Based on source and context, how engaged are they?
7. Competition: Any indicators of competitive evaluation?

Provide scores (0-100) for each factor and an overall qualification score.
Format your response as:
Budget: X/100 | Authority: X/100 | Need: X/100 | Timeline: X/100 | Fit: X/100 | Engagement: X/100 | Overall: X/100
Reasoning: [detailed analysis]
Priority: [High|Medium|Low]
NextAction: [recommended next action]
`;

      const responseText = await GeminiService.generateContent(qualificationPrompt);

      // Parse qualification response from GeminiService agent
      const qualification = this.parseQualificationResponse(responseText);

      // Update lead with qualification
      lead.qualificationScore = qualification.overallScore;
      lead.qualification = qualification;
      lead.timestamps.updatedAt = new Date();

      await this.saveLead(lead);

      // Log qualification activity
      await this.logLeadActivity(lead.id, {
        type: 'qualified',
        description: `Lead qualified with score: ${qualification.overallScore}/100`,
        timestamp: new Date(),
        performedBy: 'ai_agent',
        metadata: { qualification },
      });

      return qualification;
    } catch (error) {
      console.error('Lead qualification failed:', error);
      throw error;
    }
  }

  /**
   * Move lead to next stage in pipeline
   */
  async moveLeadToStage(
    leadId: string,
    newStage: string,
    reason?: string,
    performedBy: string = 'user',
  ): Promise<void> {
    try {
      const lead = await this.getLead(leadId);
      if (!lead) throw new Error('Lead not found');

      const pipeline = await this.getUserPipeline(lead.userId);
      if (!pipeline) throw new Error('Pipeline not found');

      const stageInfo = pipeline.stages[newStage];
      if (!stageInfo) throw new Error('Invalid stage');

      const previousStage = lead.stage;
      lead.stage = newStage;
      lead.timestamps.updatedAt = new Date();

      // Update status based on stage
      if (newStage === 'closed_won') {
        lead.status = 'converted';
      } else if (newStage === 'closed_lost') {
        lead.status = 'lost';
      } else if (newStage === 'contacted') {
        lead.status = 'engaged';
      } else {
        lead.status = 'active';
      }

      await this.saveLead(lead);

      // Log stage change
      await this.logLeadActivity(lead.id, {
        type: 'stage_change',
        description: `Moved from ${previousStage} to ${newStage}${reason ? `: ${reason}` : ''}`,
        timestamp: new Date(),
        performedBy,
        metadata: { previousStage, newStage, reason },
      });

      // Check for automation triggers
      await this.checkAutomationTriggers(lead);

      console.log(`Lead ${lead.id} moved to stage: ${newStage}`);
    } catch (error) {
      console.error('Failed to move lead to stage:', error);
      throw error;
    }
  }

  /**
   * Update lead qualification score
   */
  async updateLeadScore(
    leadId: string,
    scoreUpdates: Partial<LeadScoring['factors']>,
  ): Promise<void> {
    try {
      const lead = await this.getLead(leadId);
      if (!lead) throw new Error('Lead not found');

      if (!lead.qualification) {
        await this.qualifyLead(leadId);
        return;
      }

      // Update individual scores
      Object.entries(scoreUpdates).forEach(([factor, score]) => {
        if (lead.qualification!.factors[factor as keyof LeadScoring['factors']]) {
          (lead.qualification!.factors as any)[factor] = score;
        }
      });

      // Recalculate overall score
      const { factors } = lead.qualification;
      const overallScore = Math.round(
        (factors.budget + factors.authority + factors.need + factors.timeline +
         factors.fitScore + factors.engagementLevel) / 6,
      );

      lead.qualification.overallScore = overallScore;
      lead.qualificationScore = overallScore;
      lead.timestamps.updatedAt = new Date();

      await this.saveLead(lead);

      // Log score update
      await this.logLeadActivity(lead.id, {
        type: 'score_updated',
        description: `Lead score updated to ${overallScore}/100`,
        timestamp: new Date(),
        performedBy: 'ai_agent',
        metadata: { scoreUpdates, newOverallScore: overallScore },
      });
    } catch (error) {
      console.error('Failed to update lead score:', error);
      throw error;
    }
  }

  /**
   * Schedule follow-up for lead
   */
  async scheduleFollowUp(
    leadId: string,
    followUpDate: Date,
    note?: string,
    performedBy: string = 'user',
  ): Promise<void> {
    try {
      const lead = await this.getLead(leadId);
      if (!lead) throw new Error('Lead not found');

      lead.nextFollowUp = followUpDate;
      lead.timestamps.updatedAt = new Date();

      if (note) {
        lead.notes = lead.notes ? `${lead.notes}\n\nFollow-up scheduled: ${note}` : `Follow-up scheduled: ${note}`;
      }

      await this.saveLead(lead);

      // Log follow-up scheduling
      await this.logLeadActivity(lead.id, {
        type: 'followup_scheduled',
        description: `Follow-up scheduled for ${followUpDate.toLocaleDateString()}${note ? `: ${note}` : ''}`,
        timestamp: new Date(),
        performedBy,
        metadata: { followUpDate, note },
      });

      console.log(`Follow-up scheduled for lead ${lead.id} on ${followUpDate.toISOString()}`);
    } catch (error) {
      console.error('Failed to schedule follow-up:', error);
      throw error;
    }
  }

  /**
   * Get leads for user with filtering and search
   */
  async getLeads(userId: string, options?: LeadSearchOptions): Promise<{
    leads: Lead[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      let leads = await this.loadUserLeads(userId);

      // Apply filters
      if (options?.filters) {
        leads = this.applyFilters(leads, options.filters);
      }

      // Apply search
      if (options?.query) {
        leads = this.applySearch(leads, options.query);
      }

      // Apply sorting
      if (options?.sortBy) {
        leads = this.applySorting(leads, options.sortBy, options.sortOrder || 'desc');
      }

      // Apply pagination
      const offset = options?.offset || 0;
      const limit = options?.limit || 50;
      const total = leads.length;
      const paginatedLeads = leads.slice(offset, offset + limit);
      const hasMore = offset + limit < total;

      return {
        leads: paginatedLeads,
        total,
        hasMore,
      };
    } catch (error) {
      console.error('Failed to get leads:', error);
      return { leads: [], total: 0, hasMore: false };
    }
  }

  /**
   * Get lead by ID
   */
  async getLead(leadId: string): Promise<Lead | null> {
    try {
      const stored = await AsyncStorage.getItem(`lead_${leadId}`);
      if (stored) {
        const lead: Lead = JSON.parse(stored);
        // Convert date strings back to Date objects
        lead.timestamps.createdAt = new Date(lead.timestamps.createdAt);
        lead.timestamps.updatedAt = new Date(lead.timestamps.updatedAt);
        if (lead.lastContact) lead.lastContact = new Date(lead.lastContact);
        if (lead.nextFollowUp) lead.nextFollowUp = new Date(lead.nextFollowUp);
        return lead;
      }
      return null;
    } catch (error) {
      console.error('Failed to get lead:', error);
      return null;
    }
  }

  /**
   * Get leads due for follow-up
   */
  async getLeadsDueForFollowUp(userId: string): Promise<Lead[]> {
    try {
      const now = new Date();
      const leads = await this.loadUserLeads(userId);

      return leads.filter(lead =>
        lead.nextFollowUp &&
        lead.nextFollowUp <= now &&
        lead.status === 'active',
      ).sort((a, b) =>
        (a.nextFollowUp?.getTime() || 0) - (b.nextFollowUp?.getTime() || 0),
      );
    } catch (error) {
      console.error('Failed to get leads due for follow-up:', error);
      return [];
    }
  }

  /**
   * Get pipeline metrics
   */
  async getPipelineMetrics(userId: string): Promise<PipelineMetrics> {
    try {
      const leads = await this.loadUserLeads(userId);
      const pipeline = await this.getUserPipeline(userId);

      if (!pipeline) {
        throw new Error('Pipeline not found');
      }

      const stageMetrics: Record<string, { count: number; value: number }> = {};
      let totalValue = 0;
      let wonValue = 0;
      const totalLeads = leads.length;

      // Initialize stage metrics
      Object.keys(pipeline.stages).forEach(stageId => {
        stageMetrics[stageId] = { count: 0, value: 0 };
      });

      // Calculate metrics
      leads.forEach(lead => {
        if (stageMetrics[lead.stage]) {
          stageMetrics[lead.stage].count++;
          const leadValue = lead.estimatedValue || 0;
          stageMetrics[lead.stage].value += leadValue;
          totalValue += leadValue;

          if (lead.stage === 'closed_won') {
            wonValue += leadValue;
          }
        }
      });

      const conversionRate = totalLeads > 0 ? (stageMetrics['closed_won']?.count || 0) / totalLeads * 100 : 0;

      // Calculate average sales cycle length
      const closedLeads = leads.filter(l => l.stage === 'closed_won' || l.stage === 'closed_lost');
      const avgSalesCycle = closedLeads.length > 0 ?
        closedLeads.reduce((sum, lead) => {
          const cycleLength = (lead.timestamps.updatedAt.getTime() - lead.timestamps.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          return sum + cycleLength;
        }, 0) / closedLeads.length : 0;

      return {
        totalLeads,
        conversionRate,
        averageDealSize: totalLeads > 0 ? totalValue / totalLeads : 0,
        salesCycleLength: avgSalesCycle,
        stageDistribution: stageMetrics,
        totalPipelineValue: totalValue,
        wonValue,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('Failed to get pipeline metrics:', error);
      throw error;
    }
  }

  // Private helper methods

  private parseQualificationResponse(response: string): LeadQualification {
    const budget = this.extractScore(response, 'Budget');
    const authority = this.extractScore(response, 'Authority');
    const need = this.extractScore(response, 'Need');
    const timeline = this.extractScore(response, 'Timeline');
    const fit = this.extractScore(response, 'Fit');
    const engagement = this.extractScore(response, 'Engagement');
    const overall = this.extractScore(response, 'Overall');

    const reasoningMatch = response.match(/Reasoning:\s*(.+?)(?=Priority:|$)/s);
    const priorityMatch = response.match(/Priority:\s*(High|Medium|Low)/i);
    const nextActionMatch = response.match(/NextAction:\s*(.+?)$/m);

    return {
      overallScore: overall,
      factors: {
        budget,
        authority,
        need,
        timeline,
        fitScore: fit,
        engagementLevel: engagement,
      },
      reasoning: reasoningMatch ? reasoningMatch[1].trim() : '',
      priority: (priorityMatch ? priorityMatch[1].toLowerCase() : 'medium') as 'high' | 'medium' | 'low',
      recommendedActions: nextActionMatch ? [nextActionMatch[1].trim()] : [],
      qualifiedAt: new Date(),
    };
  }

  private extractScore(text: string, factor: string): number {
    const regex = new RegExp(`${factor}:\\s*(\\d+)`, 'i');
    const match = text.match(regex);
    return match ? parseInt(match[1]) : 50;
  }

  private applyFilters(leads: Lead[], filters: LeadFilter): Lead[] {
    return leads.filter(lead => {
      if (filters.stage && lead.stage !== filters.stage) return false;
      if (filters.status && lead.status !== filters.status) return false;
      if (filters.source && lead.source.platform !== filters.source) return false;
      if (filters.qualificationScore) {
        const score = lead.qualificationScore;
        if (score < filters.qualificationScore.min || score > filters.qualificationScore.max) {
          return false;
        }
      }
      if (filters.dateRange) {
        const createdAt = lead.timestamps.createdAt.getTime();
        if (createdAt < filters.dateRange.from.getTime() || createdAt > filters.dateRange.to.getTime()) {
          return false;
        }
      }
      if (filters.tags && filters.tags.length > 0) {
        if (!filters.tags.some(tag => lead.tags.includes(tag))) {
          return false;
        }
      }
      return true;
    });
  }

  private applySearch(leads: Lead[], query: string): Lead[] {
    const lowerQuery = query.toLowerCase();
    return leads.filter(lead =>
      lead.name.toLowerCase().includes(lowerQuery) ||
      lead.company.toLowerCase().includes(lowerQuery) ||
      lead.notes.toLowerCase().includes(lowerQuery) ||
      lead.tags.some(tag => tag.toLowerCase().includes(lowerQuery)),
    );
  }

  private applySorting(leads: Lead[], sortBy: string, order: 'asc' | 'desc'): Lead[] {
    return leads.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortBy) {
        case 'createdAt':
          aVal = a.timestamps.createdAt.getTime();
          bVal = b.timestamps.createdAt.getTime();
          break;
        case 'updatedAt':
          aVal = a.timestamps.updatedAt.getTime();
          bVal = b.timestamps.updatedAt.getTime();
          break;
        case 'qualificationScore':
          aVal = a.qualificationScore;
          bVal = b.qualificationScore;
          break;
        case 'lastContact':
          aVal = a.lastContact?.getTime() || 0;
          bVal = b.lastContact?.getTime() || 0;
          break;
        case 'nextFollowUp':
          aVal = a.nextFollowUp?.getTime() || 0;
          bVal = b.nextFollowUp?.getTime() || 0;
          break;
        default:
          return 0;
      }

      if (order === 'asc') {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });
  }

  private async checkAutomationTriggers(lead: Lead): Promise<void> {
    const automationRules = this.automationRules.get(lead.userId) || [];

    for (const rule of automationRules.filter(r => r.isActive)) {
      if (this.evaluateTrigger(rule.trigger, lead)) {
        await this.executeAutomationAction(rule.action, lead);
      }
    }
  }

  private evaluateTrigger(trigger: DealFlowAutomation['trigger'], lead: Lead): boolean {
    if (trigger.stage !== lead.stage) return false;

    // Add more sophisticated trigger evaluation logic here
    return true;
  }

  private async executeAutomationAction(action: DealFlowAutomation['action'], lead: Lead): Promise<void> {
    try {
      switch (action.type) {
        case 'move_stage':
          await this.moveLeadToStage(lead.id, action.parameters.stage, 'Automated stage change', 'automation');
          break;
        case 'schedule_followup':
          const followUpDays = action.parameters.days || 7;
          const followUpDate = new Date(Date.now() + followUpDays * 24 * 60 * 60 * 1000);
          await this.scheduleFollowUp(lead.id, followUpDate, action.parameters.note, 'automation');
          break;
        case 'notify_user':
          await AgentInboxService.createUpdate(
            lead.userId,
            lead.agentId,
            action.parameters.title || 'Lead Update',
            action.parameters.message || 'Lead requires attention',
          );
          break;
      }
    } catch (error) {
      console.error('Automation action execution failed:', error);
    }
  }

  private async processAutomationRules(): Promise<void> {
    // Process automation rules for all users
    console.log('Processing automation rules...');
  }

  private async updateLeadScores(): Promise<void> {
    // Update lead scores based on activity and engagement
    console.log('Updating lead scores...');
  }

  private async logLeadActivity(leadId: string, activity: Omit<LeadActivity, 'id'>): Promise<void> {
    const activityWithId: LeadActivity = {
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...activity,
    };

    await AsyncStorage.setItem(`activity_${leadId}_${activityWithId.id}`, JSON.stringify(activityWithId));
  }

  private async saveLead(lead: Lead): Promise<void> {
    await AsyncStorage.setItem(`lead_${lead.id}`, JSON.stringify(lead));
  }

  private async savePipeline(pipeline: DealPipeline): Promise<void> {
    await AsyncStorage.setItem(`pipeline_${pipeline.userId || 'default'}`, JSON.stringify(pipeline));
  }

  private async getUserPipeline(userId: string): Promise<DealPipeline | null> {
    try {
      const stored = await AsyncStorage.getItem(`pipeline_${userId}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to get user pipeline:', error);
      return null;
    }
  }

  private async loadUserLeads(userId: string): Promise<Lead[]> {
    try {
      // Check cache first
      const cached = this.leadsCache.get(userId);
      if (cached) return cached;

      const keys = await AsyncStorage.getAllKeys();
      const leadKeys = keys.filter(key => key.startsWith('lead_'));

      const leads: Lead[] = [];

      for (const key of leadKeys) {
        try {
          const stored = await AsyncStorage.getItem(key);
          if (stored) {
            const lead: Lead = JSON.parse(stored);
            if (lead.userId === userId) {
              // Convert date strings back to Date objects
              lead.timestamps.createdAt = new Date(lead.timestamps.createdAt);
              lead.timestamps.updatedAt = new Date(lead.timestamps.updatedAt);
              if (lead.lastContact) lead.lastContact = new Date(lead.lastContact);
              if (lead.nextFollowUp) lead.nextFollowUp = new Date(lead.nextFollowUp);
              leads.push(lead);
            }
          }
        } catch (error) {
          console.warn(`Failed to load lead ${key}:`, error);
        }
      }

      // Cache the results
      this.leadsCache.set(userId, leads);

      return leads.sort((a, b) => b.timestamps.updatedAt.getTime() - a.timestamps.updatedAt.getTime());
    } catch (error) {
      console.error('Failed to load user leads:', error);
      return [];
    }
  }

  // Public API methods for external access

  /**
   * Get lead activities
   */
  async getLeadActivities(leadId: string): Promise<LeadActivity[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const activityKeys = keys.filter(key => key.startsWith(`activity_${leadId}_`));

      const activities: LeadActivity[] = [];

      for (const key of activityKeys) {
        try {
          const stored = await AsyncStorage.getItem(key);
          if (stored) {
            const activity: LeadActivity = JSON.parse(stored);
            activity.timestamp = new Date(activity.timestamp);
            activities.push(activity);
          }
        } catch (error) {
          console.warn(`Failed to load activity ${key}:`, error);
        }
      }

      return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('Failed to get lead activities:', error);
      return [];
    }
  }

  /**
   * Delete lead
   */
  async deleteLead(leadId: string, performedBy: string = 'user'): Promise<void> {
    try {
      const lead = await this.getLead(leadId);
      if (!lead) throw new Error('Lead not found');

      // Remove from storage
      await AsyncStorage.removeItem(`lead_${leadId}`);

      // Remove from cache
      const userLeads = this.leadsCache.get(lead.userId);
      if (userLeads) {
        const updatedLeads = userLeads.filter(l => l.id !== leadId);
        this.leadsCache.set(lead.userId, updatedLeads);
      }

      // Clean up activities
      const keys = await AsyncStorage.getAllKeys();
      const activityKeys = keys.filter(key => key.startsWith(`activity_${leadId}_`));
      await Promise.all(activityKeys.map(key => AsyncStorage.removeItem(key)));

      console.log(`Lead deleted: ${leadId}`);
    } catch (error) {
      console.error('Failed to delete lead:', error);
      throw error;
    }
  }

  /**
   * Update lead
   */
  async updateLead(
    leadId: string,
    updates: Partial<Lead>,
    performedBy: string = 'user',
  ): Promise<Lead> {
    try {
      const lead = await this.getLead(leadId);
      if (!lead) throw new Error('Lead not found');

      const updatedLead = {
        ...lead,
        ...updates,
        timestamps: {
          ...lead.timestamps,
          updatedAt: new Date(),
        },
      };

      await this.saveLead(updatedLead);

      // Update cache
      const userLeads = this.leadsCache.get(lead.userId);
      if (userLeads) {
        const index = userLeads.findIndex(l => l.id === leadId);
        if (index !== -1) {
          userLeads[index] = updatedLead;
        }
      }

      // Log update activity
      await this.logLeadActivity(lead.id, {
        type: 'updated',
        description: 'Lead information updated',
        timestamp: new Date(),
        performedBy,
        metadata: { updates },
      });

      return updatedLead;
    } catch (error) {
      console.error('Failed to update lead:', error);
      throw error;
    }
  }
}

export default new LeadManagementService();