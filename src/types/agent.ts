// Multi-tenant AI Sales Agent Types
//
// Standardized ID fields used across all types:
// - agentId: Unique agent identifier (same as id)
// - userId: User who owns this entity
// - leadId: Lead identifier
// - conversationId: Conversation identifier
// - messageId: Message identifier
// - postId: Reddit post identifier
// - commentId: Reddit comment identifier
//

// Standard types for consistency
export interface StandardId {
  id: string;
}

export interface StandardTimestamps {
  createdAt: Date;
  updatedAt: Date;
}

export interface SalesAgent {
  id: string;
  agentId?: string; // STANDARDIZED: Same as id, added for explicit cross-references
  userId: string; // Tenant isolation - each agent belongs to one user
  name: string;
  description: string;
  status: 'active' | 'paused' | 'training' | 'error';
  createdAt: Date;
  updatedAt: Date;

  // Agent Configuration
  config: {
    personality: string; // Sales personality and approach
    industry: string; // Target industry
    products: ProductInfo[];
    territory: string; // Geographic or market territory
    goals: SalesGoals;
    communication: CommunicationStyle;
  };

  // Performance Metrics
  metrics: {
    leadsGenerated: number;
    conversationsStarted: number;
    dealsInProgress: number;
    closedDeals: number;
    totalRevenue: number;
    conversionRate: number;
    avgDealSize: number;
    avgTimeToClose: number;
  };

  // Platform Connections
  connectedPlatforms: ConnectedPlatform[];

  // Learning State
  learningState: {
    knowledgeBaseSize: number;
    confidenceLevel: number;
    unansweredQuestions: number;
    lastLearningUpdate: Date;
  };

  // Reddit Automation Status (for autonomous agent)
  redditAutomation?: {
    enabled: boolean;
    jobId: string | null;
    lastCommentAt: Date | null;
    searchQueries: string[];
  };
}

export interface ProductInfo {
  id: string;
  productId?: string; // STANDARDIZED: Same as id, added for explicit cross-references
  name: string;
  description: string;
  price: number | string;
  features: string[];
  targetMarket: string;
  valueProposition: string;
  competitorComparison?: string;
  objectionHandling: { [objection: string]: string };
}

export interface SalesGoals {
  monthlyLeadTarget: number;
  monthlyDealTarget: number;
  revenueTarget: number;
  territories: string[];
  priorities: string[];
}

export interface CommunicationStyle {
  tone: 'professional' | 'casual' | 'friendly' | 'authoritative';
  approach: 'consultative' | 'direct' | 'educational' | 'relationship-focused';
  followUpCadence: 'aggressive' | 'moderate' | 'patient';
  personalization: 'high' | 'medium' | 'low';
}

export interface ConnectedPlatform {
  platform: 'reddit' | 'linkedin' | 'twitter' | 'email' | 'crm';
  status: 'connected' | 'disconnected' | 'error';
  credentials: any; // Encrypted platform credentials
  config: PlatformConfig;
  lastSync: Date;
  metrics: PlatformMetrics;
}

export interface PlatformConfig {
  searchTerms: string[];
  targetSubreddits?: string[];
  engagementRules: EngagementRule[];
  scheduledActions: ScheduledAction[];
}

export interface EngagementRule {
  id?: string; // STANDARDIZED: Added unique ID for rules
  ruleId?: string; // STANDARDIZED: Same as id, added for explicit cross-references
  trigger: string; // What triggers this rule
  action: 'comment' | 'message' | 'upvote' | 'save' | 'escalate';
  template?: string; // Response template
  conditions: string[]; // Conditions that must be met
}

export interface ScheduledAction {
  id: string;
  actionId?: string; // STANDARDIZED: Same as id, added for explicit cross-references
  type: 'scan' | 'follow_up' | 'report';
  frequency: string; // Cron expression
  lastRun: Date;
  lastRunAt?: Date; // STANDARDIZED: Alias for lastRun
  nextRun: Date;
  nextRunAt?: Date; // STANDARDIZED: Alias for nextRun
}

export interface PlatformMetrics {
  postsScanned: number;
  engagements: number;
  leadsGenerated: number;
  responseRate: number;
}

// Lead Management Types
export interface Lead {
  id: string;
  leadId?: string; // STANDARDIZED: Same as id, added for explicit cross-references
  userId: string; // Tenant isolation
  agentId: string;

  // Lead Information
  contact: {
    name?: string;
    username: string;
    platform: string;
    profileUrl: string;
    email?: string;
    phone?: string;
    company?: string;
    title?: string;
    location?: string;
  };

  // Lead Qualification
  qualification: {
    score: number; // 0-100 qualification score
    stage: LeadStage;
    budget?: number;
    timeline?: string;
    authority?: string;
    need?: string;
    pain?: string;
    interests: string[];
    buyingSignals: string[];
  };

  // Source Information
  source: {
    platform: string;
    originalPost?: string;
    originalPostId?: string; // STANDARDIZED: Explicit post ID reference
    originalCommentId?: string; // STANDARDIZED: Explicit comment ID reference (if from comment)
    context: string;
    discoveredAt: Date;
    referenceUrl?: string;
    sourceUrl?: string; // STANDARDIZED: Alias for referenceUrl
    sourceId?: string; // STANDARDIZED: Platform-specific source ID
  };

  // Conversation History
  conversations: Conversation[];
  conversationIds?: string[]; // STANDARDIZED: Array of conversation IDs for easier querying

  // Lead Management
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost' | 'nurturing';
  priority: 'hot' | 'warm' | 'cold';
  assignedProducts: string[];
  assignedProductIds?: string[]; // STANDARDIZED: Alias for assignedProducts
  estimatedValue: number;

  // Timestamps
  createdAt: Date;
  updatedAt?: Date; // STANDARDIZED: Added update timestamp
  lastContact: Date;
  lastContactAt?: Date; // STANDARDIZED: Alias for lastContact
  nextFollowUp?: Date;
  nextFollowUpAt?: Date; // STANDARDIZED: Alias for nextFollowUp
  closedAt?: Date;

  // AI Analysis
  aiInsights: {
    buyingIntent: number; // 0-1 probability
    bestApproach: string;
    riskFactors: string[];
    opportunities: string[];
    competitorMentions: string[];
  };

  // Backward compatibility - flat properties (optional, duplicate nested data)
  name?: string; // Duplicate of contact.name
  company?: string; // Duplicate of contact.company
  title?: string; // Duplicate of contact.title
  stage?: LeadStage; // Duplicate of qualification.stage
  qualificationScore?: number; // Duplicate of qualification.score
  notes?: string;
  tags?: string[];
  customFields?: Record<string, any>;
  timestamps?: {
    createdAt: Date;
    updatedAt: Date;
    firstContact?: Date;
    lastActivity?: Date;
    qualifiedAt?: Date;
  };
}

export type LeadStage =
  | 'suspect' // Initial discovery
  | 'prospect' // Basic qualification
  | 'qualified' // Meets basic criteria
  | 'opportunity' // Active sales process
  | 'proposal' // Formal proposal stage
  | 'negotiation' // Price/terms discussion
  | 'verbal' // Verbal commitment
  | 'closed_won' // Deal won
  | 'closed_lost' // Deal lost
  | 'nurturing'; // Long-term relationship building

// Conversation Management
export interface Conversation {
  id: string;
  conversationId?: string; // STANDARDIZED: Same as id, added for explicit cross-references
  userId: string; // Tenant isolation
  agentId: string;
  leadId: string;
  platform: string;

  // Conversation Metadata
  status: 'active' | 'paused' | 'waiting_for_user' | 'completed' | 'escalated';
  priority: 'urgent' | 'high' | 'normal' | 'low';

  // Messages
  messages: ConversationMessage[];
  messageIds?: string[]; // STANDARDIZED: Array of message IDs for easier querying

  // Context
  context: {
    originalTopic: string;
    currentObjective: string;
    stage: ConversationStage;
    nextAction?: string;
    agentConfidence: number; // 0-1, how confident agent is
  };

  // State Management
  state: {
    requiresUserInput: boolean;
    blockers: string[]; // What's preventing progress
    opportunities: string[]; // Identified opportunities
    sentiment: 'positive' | 'neutral' | 'negative';
    engagement: 'high' | 'medium' | 'low';
  };

  // Timestamps
  createdAt: Date;
  updatedAt?: Date; // STANDARDIZED: Added update timestamp
  lastMessage: Date;
  lastMessageAt?: Date; // STANDARDIZED: Alias for lastMessage
  lastAgentAction: Date;
  lastAgentActionAt?: Date; // STANDARDIZED: Alias for lastAgentAction
  userResponseDeadline?: Date;
}

export type ConversationStage =
  | 'introduction' // First contact
  | 'discovery' // Learning about their needs
  | 'qualification' // Qualifying the opportunity
  | 'presentation' // Presenting solution
  | 'objection_handling' // Handling concerns
  | 'closing' // Attempting to close
  | 'follow_up' // Post-pitch follow-up
  | 'nurturing'; // Long-term relationship

export interface ConversationMessage {
  id: string;
  messageId?: string; // STANDARDIZED: Can be same as id OR platform-specific ID
  conversationId?: string; // STANDARDIZED: Reference to parent conversation
  leadId?: string; // STANDARDIZED: Reference to lead
  agentId?: string; // STANDARDIZED: Reference to agent
  type: 'agent' | 'lead' | 'user' | 'system';
  content: string;
  timestamp: Date;
  createdAt?: Date; // STANDARDIZED: Alias for timestamp

  // Message Metadata
  platform: string;
  platformMessageId?: string; // STANDARDIZED: Explicit platform-specific message ID

  // AI Analysis
  intent?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  confidence?: number;
  entities?: ExtractedEntity[];

  // User Feedback (for learning)
  userFeedback?: {
    rating: 'good' | 'bad';
    correction?: string;
    notes?: string;
  };
}

export interface ExtractedEntity {
  type: 'product' | 'competitor' | 'budget' | 'timeline' | 'pain_point' | 'objection';
  value: string;
  confidence: number;
}

// Knowledge Base Types
export interface KnowledgeItem {
  id: string;
  knowledgeId?: string; // STANDARDIZED: Same as id, added for explicit cross-references
  userId: string; // Tenant isolation
  agentId: string;

  type: 'faq' | 'objection_handling' | 'product_info' | 'competitor_info' | 'case_study' | 'sales_script';
  category: string;

  content: {
    title: string;
    question?: string;
    answer: string;
    context?: string;
    examples?: string[];
    relatedQuestions?: string[];
  };

  // Learning Metadata
  source: 'user_taught' | 'conversation_learned' | 'imported' | 'system_default';
  confidence: number; // How confident we are in this knowledge
  usage: {
    timesUsed: number;
    lastUsed: Date;
    lastUsedAt?: Date; // STANDARDIZED: Alias for lastUsed
    effectiveness: number; // 0-1, based on outcomes
  };

  // Versioning
  version: number;
  parentId?: string; // For updates/revisions
  parentKnowledgeId?: string; // STANDARDIZED: Alias for parentId

  timestamps: {
    createdAt: Date;
    updatedAt: Date;
    lastValidated?: Date;
    lastValidatedAt?: Date; // STANDARDIZED: Alias for lastValidated
  };

  // Tags for better retrieval
  tags: string[];
  embedding?: number[]; // Vector embedding for semantic search

  // NEW: Category reference for hierarchical organization
  categoryId?: string; // Reference to KnowledgeCategory
}

// Knowledge Category Types
export interface KnowledgeCategory {
  id: string;
  categoryId?: string; // STANDARDIZED: Same as id, added for explicit cross-references
  userId: string; // Tenant isolation
  name: string; // e.g., "Product Info", "Sales Strategies", "Objection Handling"
  description: string;
  icon: string; // Emoji or icon name
  color: string; // Hex color for UI
  itemCount: number; // Number of items in this category
  order: number; // Display order
  isDefault: boolean; // System default categories vs user-created
  createdAt: Date;
  updatedAt: Date;
}

// Default Knowledge Categories
export const DEFAULT_KNOWLEDGE_CATEGORIES: Omit<KnowledgeCategory, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Product Information',
    description: 'Product features, pricing, and benefits',
    icon: '🎯',
    color: '#3B82F6', // blue
    itemCount: 0,
    order: 1,
    isDefault: true,
  },
  {
    name: 'Sales Strategies',
    description: 'Effective sales techniques and approaches',
    icon: '📈',
    color: '#10B981', // green
    itemCount: 0,
    order: 2,
    isDefault: true,
  },
  {
    name: 'Objection Handling',
    description: 'Common objections and how to respond',
    icon: '🛡️',
    color: '#F59E0B', // amber
    itemCount: 0,
    order: 3,
    isDefault: true,
  },
  {
    name: 'Customer Insights',
    description: 'Target audience, pain points, and needs',
    icon: '👥',
    color: '#8B5CF6', // purple
    itemCount: 0,
    order: 4,
    isDefault: true,
  },
  {
    name: 'Company Information',
    description: 'About the company, values, and mission',
    icon: '🏢',
    color: '#6366F1', // indigo
    itemCount: 0,
    order: 5,
    isDefault: true,
  },
  {
    name: 'Competitor Analysis',
    description: 'Competitor comparisons and differentiators',
    icon: '⚔️',
    color: '#EF4444', // red
    itemCount: 0,
    order: 6,
    isDefault: true,
  },
  {
    name: 'CRM Insights',
    description: 'Knowledge learned from HubSpot CRM data',
    icon: '🔄',
    color: '#06B6D4', // cyan
    itemCount: 0,
    order: 7,
    isDefault: true,
  },
];

// Inbox System Types
export interface AgentInboxItem {
  id: string;
  inboxItemId?: string; // STANDARDIZED: Same as id, added for explicit cross-references
  userId: string; // Tenant isolation
  agentId: string;

  type: 'question' | 'approval_request' | 'escalation' | 'update' | 'error' | 'proactive_question';
  priority: 'urgent' | 'high' | 'normal' | 'low';

  content: {
    title: string;
    description: string;
    context?: ConversationContext;
    suggestedActions?: string[];
    relatedLeadId?: string;
    conversationId?: string;
  };

  status: 'pending' | 'answered' | 'approved' | 'denied' | 'resolved';

  // User Response
  userResponse?: {
    content: string;
    action: string;
    shouldLearn: boolean; // Whether to add to knowledge base
    timestamp: Date;
  };

  // Timestamps
  createdAt: Date;
  updatedAt?: Date; // STANDARDIZED: Added update timestamp
  respondedAt?: Date;
  resolvedAt?: Date;

  // Auto-resolution
  autoResolveAt?: Date; // When to auto-resolve if no response
  urgencyLevel: number; // 1-10, affects notification frequency
}

export interface ConversationContext {
  conversationId?: string; // STANDARDIZED: Added conversation ID reference
  leadId?: string; // STANDARDIZED: Added lead ID reference
  leadInfo: {
    name: string;
    company?: string;
    qualification: any;
  };
  conversationHistory: ConversationMessage[];
  currentStage: ConversationStage;
  agentIntent: string;
  blockers: string[];
}

// Agent Action Types
export interface AgentAction {
  id: string;
  actionId?: string; // STANDARDIZED: Same as id, added for explicit cross-references
  userId: string; // Tenant isolation
  agentId: string;

  type: 'message_sent' | 'lead_qualified' | 'follow_up_scheduled' | 'escalated' | 'knowledge_learned';

  details: {
    platform?: string;
    leadId?: string;
    conversationId?: string;
    messageId?: string; // STANDARDIZED: Added message ID reference
    postId?: string; // STANDARDIZED: Added post ID reference (for Reddit actions)
    commentId?: string; // STANDARDIZED: Added comment ID reference (for Reddit actions)
    content?: string;
    outcome?: string;
  };

  result: {
    success: boolean;
    error?: string;
    metrics?: { [key: string]: any };
  };

  timestamp: Date;
  createdAt?: Date; // STANDARDIZED: Alias for timestamp
}

// Vertex AI Integration Types
export interface VertexAIRequest {
  userId: string;
  agentId: string;
  type: 'qualify_lead' | 'generate_response' | 'extract_entities' | 'suggest_action';

  context: {
    conversation?: Conversation;
    lead?: Lead;
    knowledgeBase?: KnowledgeItem[];
    userPreferences?: any;
  };

  parameters: {
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    tools?: string[];
  };
}

export interface VertexAIResponse {
  success: boolean;
  response: string;
  confidence: number;
  reasoning?: string;
  suggestedActions?: string[];
  extractedEntities?: ExtractedEntity[];
  shouldEscalate?: boolean;
  error?: string;
}

// Firebase Security Types
export interface TenantContext {
  userId: string;
  agentId?: string;
  permissions: string[];
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
}

export interface SecurityLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  success: boolean;
  details?: any;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

// Platform Integration Types
export interface PlatformEngagement {
  id: string;
  leadId: string;
  platform: string;
  type: 'comment' | 'message' | 'post' | 'mention';
  content: string;
  timestamp: Date;
  success: boolean;
  response?: {
    platform: string;
    responseId: string;
    responseUrl: string;
  };
}

export interface LeadSource {
  platform: string;
  originalPost?: string;
  context: string;
  discoveredAt: Date;
  referenceUrl?: string;
  sourceId?: string;
  sourceUrl?: string;
}

export interface AgentConfig {
  personality: string;
  industry: string;
  products: ProductInfo[];
  territory: string;
  goals: SalesGoals;
  communication: CommunicationStyle;
}

// Extended Lead interface for platform integration
export interface ExtendedLead extends Omit<Lead, 'stage'> {
  stage?: LeadStage | string; // Make it compatible with both types
  customFields?: Record<string, any>;
  name?: string;
  company?: string;
  title?: string;
  notes?: string;
  tags?: string[];
  qualificationScore?: number;
  timestamps?: {
    createdAt: Date;
    updatedAt: Date;
    firstContact?: Date;
    lastActivity?: Date;
    qualifiedAt?: Date;
  };
}

// Extended ConversationContext for platform integration
export interface ExtendedConversationContext extends ConversationContext {
  conversationId?: string;
}

// Training and Learning Types
export interface TrainingData {
  id: string;
  type: 'conversation_analysis' | 'lead_hunting' | 'closing_techniques' | 'objection_handling' | 'knowledge_retrieval';
  data: any;
  effectiveness: number;
  createdAt: Date;
}

export interface AgentPersonality {
  communicationStyle: 'professional' | 'casual' | 'friendly' | 'authoritative';
  responseLength: 'brief' | 'moderate' | 'detailed';
  empathyLevel: 'low' | 'medium' | 'high';
  assertiveness: 'passive' | 'balanced' | 'assertive';
  humor: boolean;
  formality: 'casual' | 'business_casual' | 'formal';
}

export interface LearningMetrics {
  successRate: number;
  avgResponseTime: number;
  userSatisfactionScore: number;
  knowledgeUtilization: number;
  learningVelocity: number;
  lastUpdated: Date;
}

export interface TrainingSession {
  id: string;
  userId: string;
  agentId: string;
  config: any;
  startedAt: Date;
  endedAt?: Date;
  status: 'active' | 'paused' | 'completed' | 'failed';
  learningObjectives: string[];
  progressMetrics: {
    conversationsAnalyzed: number;
    patternsIdentified: number;
    knowledgeItemsCreated: number;
    capabilitiesImproved: number;
    confidenceGain: number;
  };
}

export interface AgentCapability {
  id: string;
  type: 'lead_generation' | 'conversation' | 'knowledge_retrieval' | 'objection_handling' | 'deal_closing' | 'follow_up';
  name: string;
  description: string;
  confidence: number;
  trainingData: any;
  createdAt: Date;
  lastUsed?: Date;
  effectiveness?: number;
}

export interface ConversationFlow {
  currentTemplate: string;
  currentStep: string;
  completedSteps: string[];
  nextSteps: string[];
  flowData: Record<string, any>;
}

export interface ConversationState {
  status: 'active' | 'paused' | 'waiting' | 'ended';
  currentStep: string;
  waitingFor: 'lead_response' | 'agent_response' | 'user_input';
  lastUpdate: Date;
  messageCount: number;
  responseTime: number[];
  sentimentHistory: Array<{
    timestamp: Date;
    sentiment: 'positive' | 'negative' | 'neutral';
    score: number;
  }>;
  blockers: string[];
  opportunities: string[];
  nextActions: string[];
}

export interface ConversationMetrics {
  startedAt: Date;
  messagesSent: number;
  messagesReceived: number;
  averageResponseTime: number;
  engagementScore: number;
  conversionProbability: number;
  totalConversations: number;
  activeConversations: number;
  conversionRate: number;
  platformBreakdown: Record<string, number>;
  stageBreakdown: Record<string, number>;
  lastUpdated: Date;
}
// Additional types for LeadManagementService
export type LeadQualification = Lead['qualification'];
export type DealStage = LeadStage;

export interface DealPipeline {
  id: string;
  userId: string;
  name: string;
  stages: DealStage[];
  deals: Lead[];
  metrics: {
    totalValue: number;
    averageDealSize: number;
    conversionRate: number;
    averageTimeToClose: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineMetrics {
  totalLeads: number;
  qualifiedLeads: number;
  conversionRate: number;
  averageDealValue: number;
  totalRevenue: number;
  stageBreakdown: Record<LeadStage, number>;
  sourceBreakdown: Record<string, number>;
  timeMetrics: {
    averageTimeToQualify: number;
    averageTimeToClose: number;
  };
}

export interface LeadActivity {
  id: string;
  leadId: string;
  userId: string;
  type: 'status_change' | 'note_added' | 'message_sent' | 'follow_up_scheduled' | 'deal_updated';
  description: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  performedBy: 'agent' | 'user' | 'system';
}

export interface LeadScoring {
  overallScore: number;
  factors: {
    engagement: number;
    budget: number;
    timeline: number;
    authority: number;
    need: number;
  };
  buyingSignals: string[];
  riskFactors: string[];
  recommendations: string[];
  lastCalculated: Date;
}
