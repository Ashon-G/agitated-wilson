// Lead Discovery MVP Types

export type LeadStatus =
  | 'pending' // Found by agent, awaiting user review
  | 'approved' // User approved, ready to write DM
  | 'dm_ready' // User has written DM, ready to send
  | 'dm_sent' // DM sent, awaiting comment
  | 'contacted' // DM sent + "check DMs" comment posted
  | 'responded' // Lead has responded to DM
  | 'rejected'; // User rejected this lead

export interface RedditPost {
  id: string;
  title: string;
  content: string;
  subreddit: string;
  author: string;
  url: string;
  createdAt: Date;
  score: number;
  numComments: number;
}

export interface Lead {
  id: string;
  userId: string;

  // Source info
  platform: 'reddit';
  post: RedditPost;
  matchedKeywords: string[];
  relevanceScore: number; // 1-10
  aiReason: string; // Why the AI thinks this is a lead

  // Status
  status: LeadStatus;
  createdAt: Date;
  updatedAt: Date;

  // Action tracking
  approvedAt?: Date;
  rejectedAt?: Date;
  dmSentAt?: Date;
  commentPostedAt?: Date;

  // DM content (user writes this)
  dmMessage?: string;
  commentMessage?: string; // "Check your DMs" message posted on their post
  commentId?: string; // ID of the comment we posted
}

export interface Conversation {
  id: string;
  leadId: string;
  userId: string;

  // Recipient info
  recipientUsername: string;
  platform: 'reddit';

  // Messages
  messages: ConversationMessage[];

  // Status
  hasUnread: boolean;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;

  // Content
  content: string;
  isFromUser: boolean; // true = sent by app user, false = received from lead

  // Timestamps
  createdAt: Date;
  readAt?: Date;

  // Delivery status (for sent messages)
  status?: 'sending' | 'sent' | 'failed';
}

export interface HuntingConfig {
  id: string;
  userId: string;

  // What to search for
  keywords: string[];
  subreddits: string[];

  // AI context
  businessDescription: string;
  targetCustomer: string;

  // Settings
  isActive: boolean;
  minRelevanceScore: number; // 1-10, default 7

  createdAt: Date;
  updatedAt: Date;
}
