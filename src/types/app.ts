import { FileUpload } from './knowledge';

export interface Workspace {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  stats: {
    files: number;
    media: number;
    snippets: number;
    webpages: number;
  };
  color: string;
  redditAccount?: RedditAccount;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  workspaceId: string;
}

export interface ChatConversation {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  summary?: string;
}

export interface KnowledgeItem {
  id: string;
  type: 'file' | 'media' | 'snippet' | 'webpage';
  title: string;
  content?: string | any; // Can be string or structured data
  url?: string;
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
  workspaceId?: string;
  createdAt: Date;
  updatedAt?: Date;
  tags: string[];
  description?: string;
  source?: string; // Source integration (e.g., 'box', 'manual')
  sourceId?: string; // ID from source system (e.g., Box file ID)
  userId?: string; // User ID for filtering
  metadata?: Record<string, any>; // Additional metadata from source

  // AI-generated fields (added by Gemini)
  aiGeneratedKeywords?: string[]; // Search keywords generated from this content
  aiGeneratedSubreddits?: string[]; // Target subreddits generated from this content
  aiMetadata?: {
    keywordsGeneratedAt?: string;
    geminiModel?: string;
    confidence?: number;
  };
}

export interface Integration {
  id: string;
  name: string;
  type: 'social' | 'productivity' | 'storage' | 'communication' | 'crm';
  icon: string;
  connected: boolean;
  description: string;
  connectedAt?: Date;
  settings?: Record<string, any>;
  // Enhanced status fields
  statusText?: string; // e.g., "Active", "Hunting 3 subreddits", "12 files synced"
  lastActivity?: Date; // Last action timestamp
  isActive?: boolean; // Currently performing actions
  actionText?: string; // e.g., "Start Hunting", "Select Files"
  fileCount?: number; // For storage integrations
  leadCount?: number; // For social integrations
}

export interface InboxItem {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: 'idea' | 'suggestion' | 'reminder' | 'agent_question' | 'approval_request' | 'proactive_question' | 'comment_approval' | 'reddit_message';
  workspaceId: string;
  createdAt: Date;
  expiresAt?: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  completed: boolean;
  // Character persona data for ideas
  characterName?: string;
  avatarColor?: string;
  initials?: string;
  // Agent-specific data
  agentId?: string;
  agentName?: string;
  // Activity data for agent actions
  activityData?: AgentActivityData;
  // Question data for knowledge gaps
  questionData?: AgentQuestionData;
  // User response for questions
  userResponse?: UserResponse;
  // Agent's follow-up response after user answers
  agentResponse?: {
    id: string;
    content: string;
    isUser: boolean;
    timestamp: Date;
    agentName?: string;
  };
  // Conversation history for multi-turn interactions (learning questions, etc.)
  conversationHistory?: Array<{
    id: string;
    content: string;
    isUser: boolean;
    timestamp: Date;
    agentName?: string;
  }>;
  // Learning state for dynamic conversations
  learningState?: {
    isLearning: boolean;
    questionsAsked: number;
  };
  // Learning questions for declined leads (deprecated - now using dynamic generation)
  learningQuestions?: string[];
  // Feedback answers from user
  feedbackAnswers?: Array<{
    question: string;
    answer: string;
    timestamp: Date;
  }>;
  // Related IDs for context
  relatedLeadId?: string;
  conversationId?: string;
  // Comment approval data (for comment_approval type)
  post?: {
    title: string;
    content: string;
    subreddit: string;
    postId: string;
    url: string;
  };
  comment?: {
    text: string;
    parentId?: string;
  };
  aiQualityCheck?: {
    approved: boolean;
    score: number;
    reason: string;
  };
  pendingCommentId?: string;
  // Generated comment for approval flow
  generatedComment?: string;
  // Status tracking
  status: 'pending' | 'answered' | 'approved' | 'denied' | 'resolved' | 'responded';
  respondedAt?: Date;
  resolvedAt?: Date;
}

export interface AgentActivityData {
  platform: string;
  action: 'comment' | 'message' | 'post' | 'lead_qualified' | 'follow_up_scheduled';
  targetUser?: string;
  targetPost?: string;
  activityUrl?: string;
  messageContent?: string;
  outcome?: 'success' | 'failed' | 'pending';
  metrics?: {
    engagement?: number;
    responses?: number;
    leadScore?: number;
  };
}

export interface AgentQuestionData {
  question: string;
  context: string;
  suggestedAnswer?: string;
  confidenceLevel: number; // 0-1, how confident agent is about the context
  category: 'product_info' | 'objection_handling' | 'pricing' | 'competitor' | 'process' | 'general';
  relatedConversation?: {
    leadName?: string;
    platform: string;
    conversationStage: string;
    lastMessages: string[];
  };
  urgencyReason?: string; // Why this needs immediate attention
}

export interface UserResponse {
  content: string;
  action: 'answered' | 'approved' | 'denied' | 'resolved';
  shouldLearnFromThis: boolean; // Whether to add to knowledge base
  timestamp: Date;
  additionalNotes?: string;
}

export interface RedditAccount {
  username: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  connectedAt: Date;
  scopes: string[];
  isActive: boolean;
  targetSubreddits?: string[];
}

export interface GoogleDriveAccount {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  connectedAt: Date;
  scopes: string[];
  isActive: boolean;
  driveStats?: {
    totalFiles: number;
    lastSyncedAt?: Date;
  };
}

export interface GoogleAnalyticsAccount {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  connectedAt: Date;
  scopes: string[];
  isActive: boolean;
  propertyId?: string;
  analyticsStats?: {
    lastSyncedAt?: Date;
  };
}

export interface GooglePlatformConnection {
  id: string;
  userId: string;
  platform: 'google_drive' | 'google_analytics';
  email: string;
  credentials: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    scopes: string[];
  };
  status: 'connected' | 'disconnected' | 'error';
  isActive: boolean;
  createdAt: Date;
  lastUsed: Date;
  metadata?: Record<string, any>;
}

export interface UserProfile {
  id: string;
  userId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  avatar?: string;
  language: string;
  timezone: string;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    autoSave: boolean;
  };
  redditAccount?: RedditAccount;
  googleDriveAccount?: GoogleDriveAccount;
  googleAnalyticsAccount?: GoogleAnalyticsAccount;

  // Onboarding and initialization flags
  isFirstTimeUser?: boolean;
  isOnboardingComplete?: boolean;
  onboardingCompletedAt?: Date;
  onboardingData?: OnboardingFormData;

  // Assigned sales agent
  assignedAgentId?: 'marcus' | 'sophia' | 'vashon';
  agentInstanceId?: string; // Unique instance ID per user (e.g., 'sophia_abc123_1234567890')

  // Business information from onboarding
  businessInfo?: BusinessInfo;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BusinessInfo {
  businessName: string;
  website?: string;
  targetMarket: string;
  productDescription: string;
  businessStartDate: Date;
  businessStage: 'idea' | 'startup' | 'growth' | 'established';
  industry?: string;
  teamSize?: '1' | '2-5' | '6-10' | '11-25' | '26-50' | '51-100' | '100+';
  createdAt: Date;
  updatedAt: Date;
}

export interface OnboardingProgress {
  userId: string;
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
  formData: OnboardingFormData;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnboardingFormData {
  // Step 1: Account creation
  email?: string;
  password?: string;

  // Welcome Screen: Name collection
  firstName?: string;
  lastName?: string;

  // Avatar Creation: 3D avatar (legacy - ReadyPlayerMe)
  avatarId?: string;

  // Assigned Agent (new - pre-made agents)
  assignedAgentId?: 'marcus' | 'sophia' | 'vashon';
  agentInstanceId?: string; // Unique instance ID per user (e.g., 'sophia_abc123_1234567890')
  agentAssignedAt?: Date;

  // Step 2: Personal information
  company?: string;

  // Step 3: Business basics
  businessName?: string;

  // Step 4: Target market
  targetMarket?: string;

  // Step 5: Product/service
  productDescription?: string;

  // Step 5: Business details
  businessStartDate?: Date;
  businessStage?: 'idea' | 'startup' | 'growth' | 'established';
  industry?: string;
  teamSize?: '1' | '2-5' | '6-10' | '11-25' | '26-50' | '51-100' | '100+';

  // Step 6: First workspace
  workspaceName?: string;
  workspaceDescription?: string;
  workspaceColor?: string;

  // Step 7: Knowledge setup introduction (optional steps start here)
  startKnowledgeSetup?: boolean;

  // Step 8: Website & brand assets
  websiteInfo?: {
    url?: string;
    logo?: FileUpload;
    brandColors?: string[];
    socialLinks?: Record<string, string>;
  };

  // Step 9: Sales materials
  salesMaterials?: FileUpload[];

  // Step 10: Pricing & product information
  pricingInfo?: PricingStructure;

  // Step 11: FAQ & objection handling
  faqs?: FAQPair[];
  objectionHandling?: ObjectionResponse[];

  // Step 12: Contact information & completion
  contactInfo?: ContactDetails;
  knowledgeSetupComplete?: boolean;

  // Step 13: Closing links configuration
  closingLinks?: {
    websiteUrl?: string;
    meetingCalendarUrl?: string;
    demoBookingUrl?: string;
    pricingPageUrl?: string;
    contactFormUrl?: string;
    customClosingMessage?: string;
  };

  // Reddit hunting configuration (set during onboarding)
  huntingKeywords?: string[];
  huntingSubreddits?: string[];
}

export interface Memory {
  id: string;
  userId: string;
  title: string;
  content: string;
  workspaceId: string;
  createdAt: Date;
  type: 'note' | 'task' | 'reminder';
  completed?: boolean;
  dueDate?: Date;
}

// Enhanced Onboarding Types

export interface PricingTier {
  id: string;
  name: string;
  price: string;
  features: string[];
  targetCustomer?: string;
  isPopular?: boolean;
}

export interface PricingStructure {
  currency: string;
  tiers: PricingTier[];
  coreFeatures: string[];
  competitiveAdvantages: string[];
  targetCustomerProfile: string;
}

export interface FAQPair {
  id: string;
  question: string;
  answer: string;
  category: 'general' | 'pricing' | 'features' | 'support' | 'implementation' | 'custom';
  isPreFilled?: boolean;
}

export interface ObjectionResponse {
  id: string;
  objection: string;
  response: string;
  context?: string;
  isCommon?: boolean;
}

export interface ContactDetails {
  salesContact: {
    name: string;
    email: string;
    phone?: string;
  };
  supportContact: {
    name: string;
    email: string;
    phone?: string;
  };
  businessHours: {
    timezone: string;
    hours: string;
  };
  preferredCommunication: string[];
  additionalInfo?: string;
}

export interface OnboardingKnowledgeStatus {
  website: boolean;
  salesMaterials: boolean;
  pricing: boolean;
  faqs: boolean;
  contact: boolean;
}

// Knowledge Setup Progress
export type KnowledgeSetupStatus = 'not_started' | 'in_progress' | 'partial' | 'complete' | 'skipped';

// Agent Settings (for AI agent customization)
export type CommentStyle = 'friendly' | 'professional' | 'expert';

export interface AgentSettings {
  id?: string;
  userId: string;

  // Targeting
  scoreThreshold: number; // 1-10, default 8

  // Volume
  maxPostsPerRun: number; // Hardcoded at 3 for rate limiting - NOT USER CONFIGURABLE
  postAgeLimitDays: number; // 7, 14, or 30

  // Voice
  commentStyle: CommentStyle;

  // Approval
  requireApproval: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_AGENT_SETTINGS: Omit<AgentSettings, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
  scoreThreshold: 8,
  maxPostsPerRun: 3, // Hardcoded rate limit - not user configurable
  postAgeLimitDays: 30,
  commentStyle: 'friendly',
  requireApproval: true,
};

// Quest System Types

export type QuestCategory =
  | 'website'       // Website & Brand
  | 'sales'         // Sales Materials
  | 'pricing'       // Pricing & Products
  | 'faq'           // FAQ & Objections
  | 'contact'       // Contact Info
  | 'closing'       // Closing Links
  | 'hunting';      // Lead Hunting Setup

export type QuestInputType =
  | 'text'          // Simple text input
  | 'url'           // URL input
  | 'multitext'     // Multiple text fields
  | 'fileupload'    // File picker
  | 'selection'     // Multiple choice
  | 'colorpicker'   // Brand colors
  | 'sociallinks'   // Social media links
  | 'keyvalue';     // Q&A or objection/response pairs

export interface Quest {
  id: string;
  title: string;              // Display title (e.g., "Quick Question")
  question: string;           // The question to ask
  placeholder?: string;       // Input placeholder text
  category: QuestCategory;
  inputType: QuestInputType;
  isCompleted: boolean;
  completedAt?: Date;
  answer?: any;              // User's response (type varies by inputType)
  priority: number;          // Order of importance (lower = higher priority)
  icon?: string;             // Ionicon name for the quest
  color?: string;            // Accent color for the quest
}

export interface QuestProgress {
  userId: string;
  quests: Quest[];
  totalQuests: number;
  completedQuests: number;
  lastUpdated: Date;
  createdAt: Date;
}