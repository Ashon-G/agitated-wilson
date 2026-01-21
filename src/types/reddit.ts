/**
 * Reddit Integration Types
 */

// Standard types
export interface StandardId {
  id: string;
}

export interface StandardTimestamps {
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// REDDIT POST TYPES
// ============================================================================

/**
 * Reddit Post (Discovered or Processed)
 */
export interface RedditPost extends StandardTimestamps {
  id: string;
  postId: string; // Reddit's unique post ID (e.g., "t3_abc123" or "abc123")
  userId: string; // Our user who owns the agent that discovered this
  agentId?: string; // Agent that discovered/processed this post
  leadId?: string; // Lead created from this post
  conversationId?: string; // Conversation started from this post

  // Reddit-specific fields
  subreddit: string; // Without r/ prefix
  author: string; // Reddit username
  title: string;
  content: string; // Post body
  selftext?: string; // Alias for content (Reddit API compatibility)
  postUrl: string; // Full URL to the post
  permalink?: string; // Alias for postUrl

  // Engagement metrics
  upvotes: number;
  score?: number; // Alias for upvotes
  commentCount: number;
  num_comments?: number; // Alias for commentCount (Reddit API compatibility)

  // Post metadata
  flair?: string;
  isNsfw: boolean;
  over_18?: boolean; // Alias for isNsfw (Reddit API compatibility)
  isArchived: boolean;
  archived?: boolean; // Alias for isArchived (Reddit API compatibility)
  isLocked?: boolean;
  isSpoiler?: boolean;

  // Processing status
  status: 'discovered' | 'processing' | 'commented' | 'skipped' | 'error';
  processingError?: string;

  // AI qualification data
  qualificationScore?: number;
  qualificationReason?: string;
  relevanceScore?: number;

  // Timestamps (inherited from StandardTimestamps)
  // createdAt, updatedAt, lastActivityAt
  discoveredAt?: Date; // When our agent first found this post
  processedAt?: Date; // When our agent processed this post
  commentedAt?: Date; // When our agent commented on this post
}

/**
 * Reddit Post for Comment Generation
 * Used when passing post data to AI for comment generation
 */
export interface RedditPostForComment {
  postId: string;
  subreddit: string;
  author: string;
  title: string;
  selftext: string;
  content?: string; // Alias for selftext
  upvotes?: number;
  commentCount?: number;
  flair?: string;
  postUrl?: string;
}

// ============================================================================
// REDDIT COMMENT TYPES
// ============================================================================

/**
 * Reddit Comment
 */
export interface RedditComment extends StandardTimestamps {
  id: string;
  commentId: string; // Reddit's unique comment ID (e.g., "t1_def456" or "def456")
  postId: string; // Post this comment belongs to
  parentCommentId?: string; // Parent comment if this is a reply
  userId: string; // Our user who owns the agent
  agentId?: string; // Agent that made/processed this comment
  leadId?: string; // Lead associated with this comment
  conversationId?: string; // Conversation this comment is part of

  // Reddit-specific fields
  subreddit: string; // Without r/ prefix
  author: string; // Reddit username
  content: string; // Comment body
  body?: string; // Alias for content (Reddit API compatibility)
  commentUrl: string; // Full URL to the comment
  permalink?: string; // Alias for commentUrl

  // Engagement metrics
  upvotes: number;
  score?: number; // Alias for upvotes

  // Comment metadata
  isAgentComment: boolean; // Did our agent make this comment?
  isEdited?: boolean;
  isStickied?: boolean;
  depth?: number; // Comment depth in thread

  // Timestamps
  postedAt?: Date; // When this comment was posted
  editedAt?: Date; // When this comment was edited
}

/**
 * Comment Generation Request
 * Data needed to generate a comment via AI
 */
export interface CommentGenerationRequest {
  userId: string;
  agentId: string;
  post: RedditPostForComment;
  subreddit: string;
  knowledgeContext?: any[];
  conversationHistory?: any[];
  leadContext?: {
    leadId?: string;
    qualification?: any;
    previousInteractions?: any[];
  };
}

/**
 * Comment Generation Result
 */
export interface CommentGenerationResult {
  success: boolean;
  comment?: string;
  commentId?: string; // ID of the posted comment (if posted)
  postId?: string; // ID of the post commented on
  knowledgeItemsUsed?: string[];
  knowledgeIds?: string[]; // Standardized alias for knowledgeItemsUsed
  confidence?: number;
  error?: string;
  shouldEscalate?: boolean;
}

// ============================================================================
// REDDIT ACCOUNT TYPES
// ============================================================================

/**
 * Reddit Account/Connection
 */
export interface RedditAccount extends StandardTimestamps {
  id: string;
  userId: string; // Our user who owns this connection
  agentId?: string; // Agent using this account (if any)

  // Reddit account info
  username: string;
  redditUserId: string; // Reddit's user ID
  karma?: number;
  avatarUrl?: string;
  icon_img?: string; // Alias for avatarUrl (Reddit API compatibility)

  // OAuth tokens (encrypted)
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
  scope: string; // OAuth scopes
  scopes?: string[]; // Array version of scope

  // Connection status
  status: 'connected' | 'disconnected' | 'expired' | 'error';
  isActive: boolean;
  connectionError?: string;

  // Timestamps
  connectedAt: Date;
  lastSyncAt?: Date;
  lastUsedAt?: Date;
}

/**
 * Reddit OAuth Tokens
 */
export interface RedditTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
  scope: string;
}

/**
 * Reddit User Info
 */
export interface RedditUserInfo {
  username: string;
  id: string;
  redditUserId?: string; // Alias for id
  icon_img: string;
  avatarUrl?: string; // Alias for icon_img
  karma: number;
}

/**
 * Reddit Auth Result
 */
export interface RedditAuthResult {
  success: boolean;
  username?: string;
  userId?: string;
  redditUserId?: string; // Alias for userId (Reddit's ID)
  tokens?: RedditTokens;
  error?: string;
}

// ============================================================================
// REDDIT JOB/AUTOMATION TYPES
// ============================================================================

/**
 * Reddit Ingestion Job
 * Scheduled job for finding and processing Reddit posts
 */
export interface RedditIngestionJob extends StandardTimestamps {
  id: string;
  jobId?: string; // Alias for id
  userId: string;
  agentId: string;

  // Job configuration
  searchQueries: string[];
  targetSubreddits: string[];
  maxPostsPerRun: number;
  qualificationThreshold: number;

  // Job status
  status: 'active' | 'paused' | 'completed' | 'error';
  enabled: boolean;

  // Job schedule
  frequency: string; // Cron expression
  lastRunAt?: Date;
  nextRunAt?: Date;

  // Job statistics
  stats: {
    totalRuns: number;
    postsScanned: number;
    postsQualified: number;
    commentsPosted: number;
    leadsGenerated: number;
    errors: number;
  };

  // Error tracking
  lastError?: string;
  errorCount: number;
}

/**
 * Reddit Processing State
 * Tracks the state of Reddit processing for an agent
 */
export interface RedditProcessingState extends StandardTimestamps {
  id: string;
  userId: string;
  agentId: string;

  // Processing status
  isProcessing: boolean;
  lastProcessedPostId?: string;
  lastProcessedCommentId?: string;

  // Cursors for pagination
  afterCursor?: string; // Reddit's "after" parameter
  beforeCursor?: string; // Reddit's "before" parameter

  // Rate limiting
  requestCount: number;
  lastRequestAt?: Date;
  rateLimitResetAt?: Date;
  isRateLimited: boolean;

  // Processing statistics
  postsProcessedToday: number;
  commentsPostedToday: number;
  errorsToday: number;
}

/**
 * Reddit Lead Source
 * Standardized source information when a lead comes from Reddit
 */
export interface RedditLeadSource {
  platform: 'reddit';
  postId: string;
  commentId?: string; // If lead came from a specific comment
  subreddit: string;
  author: string;
  sourceUrl: string;
  context: string;
  discoveredAt: Date;
}

/**
 * Reddit Context for Conversations
 * Additional Reddit context attached to conversations
 */
export interface RedditConversationContext {
  postId: string;
  commentId?: string;
  subreddit: string;
  author: string;
  postTitle: string;
  postUrl: string;
  parentCommentId?: string; // If replying to a comment
  messageId?: string; // For Reddit DMs
}

/**
 * Reddit Engagement Metrics
 */
export interface RedditEngagementMetrics {
  postsScanned: number;
  postsQualified: number;
  commentsPosted: number;
  repliesReceived: number;
  upvotesReceived: number;
  leadsGenerated: number;
  conversationsStarted: number;
  responseRate: number;
  lastCalculatedAt: Date;
}

// ============================================================================
// HELPER FUNCTIONS TYPE
// ============================================================================

/**
 * Reddit ID Utilities
 * Helper types for working with Reddit IDs
 */
export interface RedditIdUtils {
  /**
   * Normalize Reddit ID by removing prefix if present
   * e.g., "t3_abc123" -> "abc123"
   */
  normalizePostId: (postId: string) => string;

  /**
   * Normalize Reddit comment ID by removing prefix if present
   * e.g., "t1_def456" -> "def456"
   */
  normalizeCommentId: (commentId: string) => string;

  /**
   * Add t3_ prefix to post ID if not present
   * e.g., "abc123" -> "t3_abc123"
   */
  prefixPostId: (postId: string) => string;

  /**
   * Add t1_ prefix to comment ID if not present
   * e.g., "def456" -> "t1_def456"
   */
  prefixCommentId: (commentId: string) => string;
}

/**
 * Field mapping for Reddit data
 */
export const REDDIT_FIELD_MAPPINGS = {
  // Post fields
  POST_ID: 'postId',
  POST_TITLE: 'title',
  POST_CONTENT: 'content',
  POST_SELFTEXT: 'selftext',
  POST_AUTHOR: 'author',
  POST_SUBREDDIT: 'subreddit',
  POST_URL: 'postUrl',
  POST_PERMALINK: 'permalink',
  POST_SCORE: 'upvotes',
  POST_UPVOTES: 'upvotes',
  POST_COMMENT_COUNT: 'commentCount',
  POST_NUM_COMMENTS: 'num_comments',

  // Comment fields
  COMMENT_ID: 'commentId',
  COMMENT_BODY: 'content',
  COMMENT_CONTENT: 'content',
  COMMENT_AUTHOR: 'author',
  COMMENT_URL: 'commentUrl',
  COMMENT_PERMALINK: 'permalink',

  // Account fields
  REDDIT_USER_ID: 'redditUserId',
  USERNAME: 'username',
  AVATAR_URL: 'avatarUrl',
  ICON_IMG: 'icon_img',

  // Standard fields
  USER_ID: 'userId',
  AGENT_ID: 'agentId',
  LEAD_ID: 'leadId',
  CONVERSATION_ID: 'conversationId',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
} as const;
