/**
 * Autonomous Reddit Agent
 *
 * Cloud Function that runs every 30 minutes to:
 * 1. Find users with active hunting sessions
 * 2. Search Reddit for leads matching their keywords
 * 3. Score leads using Gemini AI
 * 4. Create leads and trigger comment generation
 * 5. Log all activity to agent_activity_log for the History screen
 *
 * This runs in the background even when the app is closed.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

const db = admin.firestore();

// Initialize Gemini AI
const getGeminiAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    console.error('GEMINI_API_KEY not configured');
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
};

// Reddit API configuration
const REDDIT_USER_AGENT = 'LeadHunter:v1.0.0 (by /u/leadhunterapp)';

// Subscription tier limits
const TIER_LIMITS: Record<string, { subreddits: number; postsPerDay: number; minScore: number }> = {
  free: { subreddits: 1, postsPerDay: 10, minScore: 80 },
  basic: { subreddits: 3, postsPerDay: 25, minScore: 70 },
  plus: { subreddits: 9, postsPerDay: 100, minScore: 60 },
  pro: { subreddits: 15, postsPerDay: -1, minScore: 50 }, // -1 = unlimited
};

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  url: string;
  permalink: string;
  score: number;
  num_comments: number;
  created_utc: number;
  over_18: boolean;
}

interface HuntingSession {
  id: string;
  userId: string;
  status: string;
  config: {
    subreddits: string[];
    keywords: string[];
    minLeadScore: number;
    maxPostAge: number;
    commentStyle: string;
    requireApproval: boolean;
  };
  stats: {
    postsScanned: number;
    leadsFound: number;
    dmsStarted: number;
    emailsCollected: number;
  };
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

interface RedditConnection {
  userId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: admin.firestore.Timestamp;
  connected: boolean;
}

/**
 * Refresh Reddit access token if expired
 */
async function refreshRedditToken(
  userId: string,
  refreshToken: string,
): Promise<string | null> {
  try {
    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Reddit credentials not configured');
      return null;
    }

    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'User-Agent': REDDIT_USER_AGENT,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      console.error(`Failed to refresh token for ${userId}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Update stored tokens
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);
    await db.collection('reddit_connections').doc(userId).update({
      accessToken: data.access_token,
      tokenExpiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return data.access_token;
  } catch (error) {
    console.error(`Error refreshing token for ${userId}:`, error);
    return null;
  }
}

/**
 * Search a subreddit for posts matching keywords
 */
async function searchSubreddit(
  subreddit: string,
  keywords: string[],
  accessToken: string,
  limit: number = 10,
): Promise<RedditPost[]> {
  try {
    const query = keywords.length > 0 ? keywords.join(' OR ') : '';
    const url = query
      ? `https://oauth.reddit.com/r/${subreddit}/search?q=${encodeURIComponent(query)}&restrict_sr=on&sort=new&t=day&limit=${limit}`
      : `https://oauth.reddit.com/r/${subreddit}/new?limit=${limit}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': REDDIT_USER_AGENT,
      },
    });

    if (!response.ok) {
      console.error(`Reddit search failed for r/${subreddit}: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (!data?.data?.children) {
      return [];
    }

    return data.data.children
      .filter((child: { kind: string; data: { over_18: boolean } }) => child.kind === 't3' && !child.data.over_18)
      .map((child: { data: RedditPost }) => child.data as RedditPost);
  } catch (error) {
    console.error(`Error searching r/${subreddit}:`, error);
    return [];
  }
}

/**
 * Score a post using Gemini AI
 */
async function scorePost(
  post: RedditPost,
  knowledgeContext: string,
  genAI: GoogleGenerativeAI,
): Promise<{ score: number; reasoning: string; buyingIntent: string; shouldEngage: boolean }> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are a lead scoring AI. Analyze this Reddit post to determine if the author might be interested in products/services related to the business context below.

Business Context:
${knowledgeContext || 'General business services'}

Reddit Post:
Subreddit: r/${post.subreddit}
Title: ${post.title}
Content: ${post.selftext || '(no body text)'}
Author: u/${post.author}
Upvotes: ${post.score}
Comments: ${post.num_comments}

Score this post from 0-100 based on:
- Buying intent signals (asking for recommendations, comparing options, expressing frustration with current solution)
- Relevance to the business context
- Engagement potential (post activity, author history)

Respond in JSON format:
{
  "score": <number 0-100>,
  "reasoning": "<brief explanation>",
  "buyingIntent": "<high|medium|low|none>",
  "shouldEngage": <true|false>
}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return { score: 0, reasoning: 'Failed to parse response', buyingIntent: 'none', shouldEngage: false };
  } catch (error) {
    console.error('Error scoring post:', error);
    return { score: 0, reasoning: 'AI scoring failed', buyingIntent: 'none', shouldEngage: false };
  }
}

/**
 * Get knowledge context for a user
 */
async function getKnowledgeContext(userId: string, workspaceId?: string): Promise<string> {
  try {
    let query: admin.firestore.Query = db.collection('knowledge_items').where('userId', '==', userId);

    if (workspaceId) {
      query = query.where('workspaceId', '==', workspaceId);
    }

    const knowledgeSnap = await query.limit(10).get();

    if (knowledgeSnap.empty) {
      return '';
    }

    const items = knowledgeSnap.docs.map(doc => {
      const data = doc.data();
      return `${data.title}: ${data.content || data.description || ''}`;
    });

    return items.join('\n');
  } catch (error) {
    console.error(`Error getting knowledge context for ${userId}:`, error);
    return '';
  }
}

/**
 * Check if a lead already exists for this post
 */
async function leadExists(userId: string, postId: string): Promise<boolean> {
  const existingLeads = await db.collection('reddit_leads')
    .where('userId', '==', userId)
    .where('postId', '==', postId)
    .limit(1)
    .get();

  return !existingLeads.empty;
}

/**
 * Get user's subscription tier
 */
async function getUserTier(userId: string): Promise<string> {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    return userDoc.data()?.subscriptionTier || 'free';
  } catch {
    return 'free';
  }
}

/**
 * Process a single hunting session
 */
async function processSession(
  session: HuntingSession,
  connection: RedditConnection,
  genAI: GoogleGenerativeAI,
): Promise<void> {
  const { userId } = session;
  console.log(`\n🔄 Processing session for user ${userId}...`);

  const tier = await getUserTier(userId);

  // Skip free tier users - they must keep the app open
  if (tier === 'free') {
    console.log(`⏭️ Skipping free tier user ${userId} - background hunting requires paid subscription`);
    return;
  }

  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

  let { accessToken } = connection;

  // Check if token needs refresh
  const tokenExpiresAt = connection.tokenExpiresAt?.toDate() || new Date(0);
  if (tokenExpiresAt < new Date()) {
    console.log(`🔄 Refreshing token for ${userId}...`);
    const newToken = await refreshRedditToken(userId, connection.refreshToken);
    if (!newToken) {
      console.log(`Failed to refresh Reddit token for ${userId}`);
      return;
    }
    accessToken = newToken;
  }

  // Get knowledge context for scoring
  const knowledgeContext = await getKnowledgeContext(userId);

  // Get subreddits from session config
  const subredditsToSearch = session.config.subreddits.slice(0, limits.subreddits);

  if (subredditsToSearch.length === 0) {
    console.log(`⏭️ User ${userId} has no target subreddits configured`);
    return;
  }

  // Track metrics
  let totalPostsScanned = 0;
  let totalPostsScored = 0;
  let leadsFound = 0;

  for (const subreddit of subredditsToSearch) {
    // Check daily limit
    if (limits.postsPerDay !== -1 && totalPostsScanned >= limits.postsPerDay) {
      console.log(`⚠️ Daily limit reached for ${userId}`);
      break;
    }

    console.log(`🔍 Searching r/${subreddit} for ${userId}...`);

    const posts = await searchSubreddit(
      subreddit,
      session.config.keywords,
      accessToken,
      Math.min(10, limits.postsPerDay === -1 ? 10 : limits.postsPerDay - totalPostsScanned),
    );

    totalPostsScanned += posts.length;

    // Score and process posts
    for (const post of posts) {
      // Check if we already have this lead
      if (await leadExists(userId, post.id)) {
        console.log(`⏭️ Lead already exists for post ${post.id}`);
        continue;
      }

      // Score the post
      console.log(`📊 Scoring post: ${post.title.substring(0, 50)}...`);

      const scoreResult = await scorePost(post, knowledgeContext, genAI);
      totalPostsScored++;

      // Check against tier minimum score
      const minScore = Math.max(limits.minScore, session.config.minLeadScore);
      if (scoreResult.score < minScore) {
        console.log(`⏭️ Post score ${scoreResult.score} below minimum ${minScore}`);
        continue;
      }

      if (!scoreResult.shouldEngage) {
        console.log('⏭️ Post not recommended for engagement');
        continue;
      }

      // Create lead in Firestore
      const leadData = {
        userId,
        postId: post.id,
        postTitle: post.title,
        postContent: post.selftext,
        postUrl: `https://reddit.com${post.permalink}`,
        author: post.author,
        subreddit: post.subreddit,
        score: scoreResult.score,
        reasoning: scoreResult.reasoning,
        buyingIntent: scoreResult.buyingIntent,
        status: 'found',
        processed: false,
        commentGenerated: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection('reddit_leads').add(leadData);
      leadsFound++;

      console.log(`✅ Created lead for post ${post.id} with score ${scoreResult.score}`);

      // Small delay between AI calls
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Delay between subreddits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Update session stats
  await db.collection('hunting_sessions').doc(session.id).update({
    'stats.postsScanned': admin.firestore.FieldValue.increment(totalPostsScanned),
    'stats.leadsFound': admin.firestore.FieldValue.increment(leadsFound),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`✅ Completed processing for ${userId}: ${totalPostsScanned} scanned, ${leadsFound} leads`);
}

/**
 * Main scheduled function - runs every 30 minutes
 */
export const autonomousRedditAgent = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'America/Los_Angeles',
    memory: '512MiB',
    timeoutSeconds: 540, // 9 minutes
    retryCount: 3,
  },
  async () => {
    console.log('🚀 Autonomous Reddit Agent starting...');
    console.log(`Run time: ${new Date().toISOString()}`);

    const genAI = getGeminiAI();
    if (!genAI) {
      console.error('❌ Gemini AI not configured, aborting');
      return;
    }

    try {
      // Get all active hunting sessions (status = 'monitoring')
      const sessionsSnap = await db.collection('hunting_sessions')
        .where('status', 'in', ['monitoring', 'searching', 'scoring'])
        .get();

      if (sessionsSnap.empty) {
        console.log('No active hunting sessions to process');
        return;
      }

      console.log(`Found ${sessionsSnap.size} active hunting sessions`);

      // Process each session
      for (const sessionDoc of sessionsSnap.docs) {
        const session = { id: sessionDoc.id, ...sessionDoc.data() } as HuntingSession;

        // Get Reddit connection for this user
        const connectionDoc = await db.collection('reddit_connections').doc(session.userId).get();

        if (!connectionDoc.exists) {
          console.log(`⏭️ No Reddit connection for user ${session.userId}`);
          continue;
        }

        const connection = connectionDoc.data() as RedditConnection;

        if (!connection.connected) {
          console.log(`⏭️ Reddit not connected for user ${session.userId}`);
          continue;
        }

        try {
          await processSession(session, connection, genAI);
        } catch (error) {
          console.error(`Error processing session for ${session.userId}:`, error);
        }

        // Delay between users to be nice to Reddit API
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log('✅ Autonomous Reddit Agent completed successfully');
    } catch (error) {
      console.error('❌ Autonomous Reddit Agent failed:', error);
      throw error;
    }
  },
);
