/**
 * Lead Hunting Service
 *
 * Handles searching Reddit for potential leads and scoring them using Gemini AI.
 * This replaces the HuntingEngine workflow with direct in-app functionality.
 *
 * Features:
 * - Search multiple subreddits for posts matching keywords
 * - Score leads using Gemini AI based on buying intent
 * - Generate and post comments to engage with leads
 * - Monitor for replies and handle DM conversations
 */

import RedditOAuthService from '../integrations/RedditOAuthService';
import GeminiService from './GeminiService';
import BackendService from './BackendService';
import { auth } from '../config/firebase';
import {
  SUBSCRIPTION_TIERS,
  ENTITLEMENTS,
  DEFAULT_TIER,
  isUnlimited,
  type SubscriptionTier,
  type TierLimits,
} from '../config/subscriptionTiers';
import { hasEntitlement } from '../lib/revenuecatClient';
import useWorkspaceStore from '../state/workspaceStore';
import useInboxStore from '../state/inboxStore';

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  url: string;
  permalink: string;
  score: number;
  numComments: number;
  created: number;
  isNsfw: boolean;
}

export interface ScoredLead {
  post: RedditPost;
  score: number;
  reasoning: string;
  buyingIntent: 'high' | 'medium' | 'low' | 'none';
  shouldEngage: boolean;
}

export interface HuntingConfig {
  subreddits: string[];
  keywords: string[];
  minLeadScore: number;
  maxPostAge: number; // in hours
  commentStyle: 'friendly' | 'professional' | 'expert';
  requireApproval: boolean;
}

export interface SavedLead {
  id?: string;
  userId: string;
  postId: string;
  postTitle: string;
  postContent: string;
  postUrl: string;
  author: string;
  subreddit: string;
  score: number;
  reasoning: string;
  buyingIntent: 'high' | 'medium' | 'low' | 'none';
  status: 'found' | 'commented' | 'engaged' | 'converted' | 'lost';
  createdAt: Date;
  updatedAt: Date;
}

class LeadHuntingService {
  private readonly USER_AGENT = 'Vibecode:com.vibecode.app:v1.0.0 (by /u/vibecode)';
  private readonly BASE_URL = 'https://oauth.reddit.com';

  /**
   * Search a subreddit for posts matching keywords
   */
  async searchSubreddit(
    subreddit: string,
    keywords: string[],
    options: { limit?: number; timeFilter?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' } = {},
  ): Promise<RedditPost[]> {
    const { limit = 25, timeFilter = 'week' } = options;

    try {
      const accessToken = await RedditOAuthService.getValidAccessToken();

      if (!accessToken) {
        console.error('🔴 [LeadHunting] No valid access token available');
        return [];
      }

      // Build search query from keywords
      const query = keywords.join(' OR ');

      console.log(`🔍 [LeadHunting] Searching r/${subreddit} for: ${query}`);

      const response = await fetch(
        `${this.BASE_URL}/r/${subreddit}/search?q=${encodeURIComponent(query)}&restrict_sr=on&sort=new&t=${timeFilter}&limit=${limit}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': this.USER_AGENT,
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`🔴 [LeadHunting] Failed to search r/${subreddit}:`, response.status, errorText);
        return [];
      }

      const data = await response.json();

      if (!data?.data?.children) {
        return [];
      }

      const posts: RedditPost[] = data.data.children
        .filter((child: any) => child.kind === 't3') // Only posts
        .map((child: any) => {
          const post = child.data;
          return {
            id: post.id,
            title: post.title,
            selftext: post.selftext || '',
            author: post.author,
            subreddit: post.subreddit,
            url: post.url,
            permalink: `https://reddit.com${post.permalink}`,
            score: post.score,
            numComments: post.num_comments,
            created: post.created_utc,
            isNsfw: post.over_18,
          };
        })
        .filter((post: RedditPost) => !post.isNsfw); // Filter out NSFW posts

      console.log(`✅ [LeadHunting] Found ${posts.length} posts in r/${subreddit}`);

      return posts;
    } catch (error) {
      console.error(`🔴 [LeadHunting] Error searching r/${subreddit}:`, error);
      return [];
    }
  }

  /**
   * Get new posts from a subreddit (without search)
   */
  async getNewPosts(subreddit: string, limit = 25): Promise<RedditPost[]> {
    try {
      const accessToken = await RedditOAuthService.getValidAccessToken();

      if (!accessToken) {
        console.error('🔴 [LeadHunting] No valid access token available');
        return [];
      }

      console.log(`📰 [LeadHunting] Fetching new posts from r/${subreddit}`);

      const response = await fetch(`${this.BASE_URL}/r/${subreddit}/new?limit=${limit}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': this.USER_AGENT,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`🔴 [LeadHunting] Failed to fetch new posts from r/${subreddit}:`, response.status, errorText);
        return [];
      }

      const data = await response.json();

      if (!data?.data?.children) {
        return [];
      }

      const posts: RedditPost[] = data.data.children
        .filter((child: any) => child.kind === 't3')
        .map((child: any) => {
          const post = child.data;
          return {
            id: post.id,
            title: post.title,
            selftext: post.selftext || '',
            author: post.author,
            subreddit: post.subreddit,
            url: post.url,
            permalink: `https://reddit.com${post.permalink}`,
            score: post.score,
            numComments: post.num_comments,
            created: post.created_utc,
            isNsfw: post.over_18,
          };
        })
        .filter((post: RedditPost) => !post.isNsfw);

      console.log(`✅ [LeadHunting] Fetched ${posts.length} new posts from r/${subreddit}`);

      return posts;
    } catch (error) {
      console.error(`🔴 [LeadHunting] Error fetching new posts from r/${subreddit}:`, error);
      return [];
    }
  }

  /**
   * Score a post using Gemini AI
   */
  async scorePost(post: RedditPost, knowledgeContext: string): Promise<ScoredLead> {
    try {
      const result = await GeminiService.scoreLeadQuality(
        {
          title: post.title,
          content: post.selftext,
          subreddit: post.subreddit,
          author: post.author,
          upvotes: post.score,
          commentCount: post.numComments,
        },
        knowledgeContext,
      );

      return {
        post,
        score: result.score,
        reasoning: result.reasoning,
        buyingIntent: result.buyingIntent,
        shouldEngage: result.shouldEngage,
      };
    } catch (error) {
      console.error('🔴 [LeadHunting] Error scoring post:', error);
      return {
        post,
        score: 0,
        reasoning: 'Error scoring post',
        buyingIntent: 'none',
        shouldEngage: false,
      };
    }
  }

  /**
   * Get the user's subscription tier
   */
  private async getSubscriptionTier(): Promise<SubscriptionTier> {
    const proResult = await hasEntitlement(ENTITLEMENTS.pro);
    if (proResult.ok && proResult.data) return 'pro';

    const plusResult = await hasEntitlement(ENTITLEMENTS.plus);
    if (plusResult.ok && plusResult.data) return 'plus';

    const basicResult = await hasEntitlement(ENTITLEMENTS.basic);
    if (basicResult.ok && basicResult.data) return 'basic';

    return DEFAULT_TIER;
  }

  /**
   * Pre-filter posts using keyword matching before expensive AI scoring
   * This reduces API calls significantly
   */
  private preFilterPosts(posts: RedditPost[], keywords: string[]): RedditPost[] {
    if (keywords.length === 0) return posts;

    const keywordsLower = keywords.map(k => k.toLowerCase().trim());

    return posts.filter(post => {
      const titleLower = post.title.toLowerCase();
      const contentLower = post.selftext.toLowerCase();
      const combinedText = `${titleLower} ${contentLower}`;

      // Check if any keyword appears in title or content
      return keywordsLower.some(keyword => combinedText.includes(keyword));
    });
  }

  /**
   * Hunt for leads across multiple subreddits
   * Returns scored leads sorted by score
   * Enforces subscription limits
   */
  async huntLeads(
    config: HuntingConfig,
    knowledgeContext: string,
    onProgress?: (message: string, progress: number) => void,
  ): Promise<ScoredLead[]> {
    const allLeads: ScoredLead[] = [];

    // Get subscription tier and limits
    const tier = await this.getSubscriptionTier();
    const { limits } = SUBSCRIPTION_TIERS[tier];

    console.log(`🔒 [LeadHunting] User tier: ${tier}, limits:`, limits);

    // Enforce subreddit limit
    const maxSubreddits = limits.subreddits;
    const subredditsToSearch = config.subreddits.slice(0, maxSubreddits);

    if (config.subreddits.length > maxSubreddits) {
      console.log(`⚠️ [LeadHunting] Limiting subreddits from ${config.subreddits.length} to ${maxSubreddits} (${tier} tier)`);
      onProgress?.(`Limited to ${maxSubreddits} subreddits on ${tier} plan`, 0);
    }

    // Enforce posts scanned limit
    const maxPostsPerDay = limits.postsScannedPerDay;
    let totalPostsScanned = 0;
    let totalPostsScored = 0;

    // Enforce lead score threshold from subscription
    const minLeadScore = Math.max(config.minLeadScore, limits.leadScoreThreshold);

    const totalSubreddits = subredditsToSearch.length;

    for (let i = 0; i < totalSubreddits; i++) {
      // Check if we've hit the daily limit
      if (!isUnlimited(maxPostsPerDay) && totalPostsScanned >= maxPostsPerDay) {
        console.log(`🛑 [LeadHunting] Daily scan limit reached (${maxPostsPerDay} posts)`);
        onProgress?.(`Daily limit reached (${maxPostsPerDay} posts on ${tier} plan)`, 100);
        break;
      }

      const subreddit = subredditsToSearch[i];
      const progress = ((i + 1) / totalSubreddits) * 100;

      onProgress?.(`Searching r/${subreddit}...`, progress);

      // Calculate remaining posts we can scan
      const remainingPosts = isUnlimited(maxPostsPerDay)
        ? 10
        : Math.min(10, maxPostsPerDay - totalPostsScanned);

      // Search with keywords
      const posts = config.keywords.length > 0
        ? await this.searchSubreddit(subreddit, config.keywords, { limit: remainingPosts })
        : await this.getNewPosts(subreddit, remainingPosts);

      totalPostsScanned += posts.length;

      // Filter by post age
      const maxAgeMs = config.maxPostAge * 60 * 60 * 1000;
      const now = Date.now();
      const recentPosts = posts.filter(post => {
        const postAge = now - (post.created * 1000);
        return postAge <= maxAgeMs;
      });

      // PRE-FILTER: Use keyword matching to reduce AI scoring calls
      // This is critical for staying within API quotas
      const preFilteredPosts = this.preFilterPosts(recentPosts, config.keywords);

      console.log(`🔍 [LeadHunting] r/${subreddit}: ${posts.length} fetched → ${recentPosts.length} recent → ${preFilteredPosts.length} keyword-matched`);

      onProgress?.(`Scoring ${preFilteredPosts.length} posts from r/${subreddit}...`, progress);

      // Score only pre-filtered posts (saves API calls!)
      for (const post of preFilteredPosts) {
        const scoredLead = await this.scorePost(post, knowledgeContext);
        totalPostsScored++;

        // Apply subscription's minimum score threshold
        if (scoredLead.score >= minLeadScore) {
          allLeads.push(scoredLead);
        }

        // Small delay between AI calls to help with rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Small delay between subreddits to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Sort by score (highest first)
    allLeads.sort((a, b) => b.score - a.score);

    console.log(`✅ [LeadHunting] Scanned ${totalPostsScanned} posts, scored ${totalPostsScored}, found ${allLeads.length} qualified leads (tier: ${tier})`);

    return allLeads;
  }

  /**
   * Post a comment on a Reddit post
   */
  async postComment(postId: string, comment: string): Promise<{ success: boolean; commentId?: string; error?: string }> {
    try {
      const accessToken = await RedditOAuthService.getValidAccessToken();

      if (!accessToken) {
        return { success: false, error: 'Not authenticated with Reddit' };
      }

      console.log(`💬 [LeadHunting] Posting comment on ${postId}...`);

      const fullPostId = postId.startsWith('t3_') ? postId : `t3_${postId}`;

      const response = await fetch(`${this.BASE_URL}/api/comment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': this.USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          thing_id: fullPostId,
          text: comment,
        }).toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 [LeadHunting] Failed to post comment:', response.status, errorText);
        return { success: false, error: `Reddit API error: ${response.status}` };
      }

      const data = await response.json();

      // Extract comment ID from response
      const commentId = data?.json?.data?.things?.[0]?.data?.id;

      console.log('✅ [LeadHunting] Comment posted successfully:', commentId);

      return { success: true, commentId };
    } catch (error: any) {
      console.error('🔴 [LeadHunting] Error posting comment:', error);
      return { success: false, error: error.message || 'Failed to post comment' };
    }
  }

  /**
   * Send a DM to a Reddit user
   */
  async sendDM(username: string, subject: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
      const accessToken = await RedditOAuthService.getValidAccessToken();

      if (!accessToken) {
        return { success: false, error: 'Not authenticated with Reddit' };
      }

      console.log(`📨 [LeadHunting] Sending DM to u/${username}...`);

      const response = await fetch(`${this.BASE_URL}/api/compose`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': this.USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          to: username,
          subject,
          text: message,
        }).toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 [LeadHunting] Failed to send DM:', response.status, errorText);
        return { success: false, error: `Reddit API error: ${response.status}` };
      }

      console.log(`✅ [LeadHunting] DM sent to u/${username}`);

      return { success: true };
    } catch (error: any) {
      console.error('🔴 [LeadHunting] Error sending DM:', error);
      return { success: false, error: error.message || 'Failed to send DM' };
    }
  }

  /**
   * Save a lead to Firestore for tracking
   * Also creates an inbox item for approval when requireApproval is true
   */
  async saveLead(lead: ScoredLead, userId: string, createInboxItem: boolean = true): Promise<string | null> {
    try {
      console.log(`📥 [LeadHunting] Saving lead for user ${userId}: ${lead.post.title.substring(0, 50)}...`);

      const leadDoc: Omit<SavedLead, 'id'> = {
        userId,
        postId: lead.post.id,
        postTitle: lead.post.title,
        postContent: lead.post.selftext,
        postUrl: lead.post.permalink,
        author: lead.post.author,
        subreddit: lead.post.subreddit,
        score: lead.score,
        reasoning: lead.reasoning,
        buyingIntent: lead.buyingIntent,
        status: 'found',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await BackendService.createDocument<SavedLead>('reddit_leads', leadDoc);

      console.log(`✅ [LeadHunting] Lead saved with ID: ${result.id}`);

      // Create an inbox item for approval if requested
      if (createInboxItem && result.id) {
        try {
          // Get the current workspace ID from store
          let workspaceId = useWorkspaceStore.getState().currentWorkspace?.id;

          // If no workspace in store, try to find one for this user
          if (!workspaceId) {
            console.log('🔍 [LeadHunting] No workspace in store, querying for user workspaces...');
            const workspaces = await BackendService.queryCollection<{ id: string }>('workspaces', {
              where: [{ field: 'ownerId', operator: '==', value: userId }],
              limit: 1,
            });

            if (workspaces.length > 0) {
              workspaceId = workspaces[0].id;
              console.log(`✅ [LeadHunting] Found workspace: ${workspaceId}`);
            }
          }

          if (workspaceId) {
            const inboxStore = useInboxStore.getState();
            await inboxStore.addInboxItem({
              type: 'approval_request',
              userId,
              title: `New Reddit Lead: ${lead.post.title.substring(0, 100)}${lead.post.title.length > 100 ? '...' : ''}`,
              content: `Found a lead in r/${lead.post.subreddit} with score ${lead.score}/100.\n\nReasoning: ${lead.reasoning}\n\nBuying Intent: ${lead.buyingIntent}`,
              agentName: 'Lead Hunter',
              status: 'pending',
              priority: lead.buyingIntent === 'high' ? 'urgent' : lead.buyingIntent === 'medium' ? 'high' : 'medium',
              workspaceId,
              tags: ['lead', 'reddit', lead.post.subreddit, lead.buyingIntent],
              completed: false,
              relatedLeadId: result.id,
              post: {
                title: lead.post.title,
                content: lead.post.selftext,
                subreddit: lead.post.subreddit,
                postId: lead.post.id,
                url: lead.post.permalink,
              },
            });
            console.log('✅ [LeadHunting] Inbox item created for lead approval');
          } else {
            console.warn('⚠️ [LeadHunting] No workspace ID found for user, skipping inbox item creation');
          }
        } catch (inboxError) {
          console.error('🔴 [LeadHunting] Error creating inbox item:', inboxError);
          // Don't fail the entire save operation if inbox creation fails
        }
      }

      return result.id ?? null;
    } catch (error) {
      console.error('🔴 [LeadHunting] Error saving lead:', error);
      return null;
    }
  }

  /**
   * Get user's hunting configuration from Firestore
   */
  async getHuntingConfig(userId: string): Promise<HuntingConfig | null> {
    try {
      const config = await BackendService.getDocument<HuntingConfig>(`users/${userId}/huntingConfig`, 'default');
      return config;
    } catch (error) {
      console.error('🔴 [LeadHunting] Error getting hunting config:', error);
      return null;
    }
  }

  /**
   * Save hunting configuration to Firestore
   */
  async saveHuntingConfig(userId: string, config: HuntingConfig): Promise<boolean> {
    try {
      await BackendService.setDocument(`users/${userId}/huntingConfig`, 'default', {
        ...config,
        updatedAt: new Date(),
      });

      console.log('✅ [LeadHunting] Hunting config saved');

      return true;
    } catch (error) {
      console.error('🔴 [LeadHunting] Error saving hunting config:', error);
      return false;
    }
  }
}

export default new LeadHuntingService();
