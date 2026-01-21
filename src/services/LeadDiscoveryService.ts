import { Lead, RedditPost, HuntingConfig } from '../types/lead';
import { getOpenAIClient } from '../api/openai';

/**
 * LeadDiscoveryService
 *
 * AI-powered service that searches Reddit posts and comments for potential leads.
 * Uses OpenAI to analyze content and determine relevance.
 */

// Helper to generate text using OpenAI
async function generateText(
  prompt: string,
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: 'gpt-4o-2024-11-20',
    messages: [{ role: 'user', content: prompt }],
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 500,
  });

  return response.choices[0]?.message?.content || '';
}

interface DiscoveryResult {
  leads: Lead[];
  postsAnalyzed: number;
  error?: string;
}

interface RedditSearchResult {
  kind: string;
  data: {
    children: Array<{
      kind: string;
      data: {
        id: string;
        title: string;
        selftext: string;
        subreddit: string;
        author: string;
        permalink: string;
        created_utc: number;
        score: number;
        num_comments: number;
      };
    }>;
  };
}

/**
 * Search Reddit for posts matching keywords
 */
async function searchReddit(
  keywords: string[],
  subreddits: string[],
  limit: number = 25,
): Promise<RedditPost[]> {
  const posts: RedditPost[] = [];

  try {
    // Search each subreddit for keyword matches
    for (const subreddit of subreddits.slice(0, 3)) {
      for (const keyword of keywords.slice(0, 3)) {
        const query = encodeURIComponent(keyword);
        const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${query}&restrict_sr=1&sort=new&limit=${Math.min(limit, 10)}`;

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'LeadHunter/1.0',
          },
        });

        if (!response.ok) {
          console.log(`[LeadDiscovery] Reddit search failed for r/${subreddit}: ${response.status}`);
          continue;
        }

        const data: RedditSearchResult = await response.json();

        if (data.data?.children) {
          for (const child of data.data.children) {
            const post = child.data;

            // Skip if already added
            if (posts.some(p => p.id === post.id)) continue;

            posts.push({
              id: post.id,
              title: post.title,
              content: post.selftext || '',
              subreddit: post.subreddit,
              author: post.author,
              url: `https://reddit.com${post.permalink}`,
              createdAt: new Date(post.created_utc * 1000),
              score: post.score,
              numComments: post.num_comments,
            });
          }
        }

        // Rate limit between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return posts;
  } catch (error) {
    console.error('[LeadDiscovery] Error searching Reddit:', error);
    return posts;
  }
}

/**
 * Use AI to analyze a post and determine if it's a potential lead
 */
async function analyzePostForLead(
  post: RedditPost,
  config: HuntingConfig,
): Promise<{
  isLead: boolean;
  relevanceScore: number;
  reason: string;
  matchedKeywords: string[];
} | null> {
  try {
    const prompt = `You are a lead qualification AI. Analyze this Reddit post to determine if the author might be a potential customer for the following business:

BUSINESS DESCRIPTION:
${config.businessDescription}

TARGET CUSTOMER:
${config.targetCustomer}

KEYWORDS WE'RE LOOKING FOR:
${config.keywords.join(', ')}

REDDIT POST:
Title: ${post.title}
Subreddit: r/${post.subreddit}
Content: ${post.content.slice(0, 1000)}

Analyze this post and respond with a JSON object (no markdown, just raw JSON):
{
  "isLead": true/false,
  "relevanceScore": 1-10,
  "reason": "Brief explanation of why this is or isn't a good lead",
  "matchedKeywords": ["keyword1", "keyword2"]
}

Only mark as a lead (isLead: true) if:
1. The person is actively seeking a solution our business provides
2. They show buying intent or express a clear need
3. The relevance score is 7 or higher

Be conservative - we want quality leads, not quantity.`;

    const response = await generateText(prompt, { temperature: 0.3, maxTokens: 300 });

    // Parse the JSON response
    const cleanResponse = response.trim().replace(/```json\n?|\n?```/g, '');
    const result = JSON.parse(cleanResponse);

    return {
      isLead: result.isLead === true,
      relevanceScore: Math.min(10, Math.max(1, Number(result.relevanceScore) || 1)),
      reason: String(result.reason || ''),
      matchedKeywords: Array.isArray(result.matchedKeywords) ? result.matchedKeywords : [],
    };
  } catch (error) {
    console.error('[LeadDiscovery] Error analyzing post:', error);
    return null;
  }
}

/**
 * Main function to discover leads from Reddit
 */
export async function discoverLeads(
  userId: string,
  config: HuntingConfig,
  maxPosts: number = 15,
): Promise<DiscoveryResult> {
  console.log('[LeadDiscovery] Starting lead discovery...');
  console.log('[LeadDiscovery] Config:', {
    keywords: config.keywords,
    subreddits: config.subreddits,
    minScore: config.minRelevanceScore,
  });

  const leads: Lead[] = [];
  let postsAnalyzed = 0;

  try {
    // Step 1: Search Reddit for posts
    const posts = await searchReddit(config.keywords, config.subreddits, maxPosts);
    console.log(`[LeadDiscovery] Found ${posts.length} posts to analyze`);

    if (posts.length === 0) {
      return {
        leads: [],
        postsAnalyzed: 0,
        error: 'No posts found matching your keywords and subreddits',
      };
    }

    // Step 2: Analyze each post with AI
    for (const post of posts.slice(0, maxPosts)) {
      postsAnalyzed++;

      // Skip posts from deleted users or AutoModerator
      if (post.author === '[deleted]' || post.author === 'AutoModerator') {
        continue;
      }

      const analysis = await analyzePostForLead(post, config);

      if (analysis && analysis.isLead && analysis.relevanceScore >= config.minRelevanceScore) {
        const lead: Lead = {
          id: `lead_${post.id}_${Date.now()}`,
          userId,
          platform: 'reddit',
          post,
          matchedKeywords: analysis.matchedKeywords,
          relevanceScore: analysis.relevanceScore,
          aiReason: analysis.reason,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        leads.push(lead);
        console.log(`[LeadDiscovery] Found lead: ${post.title.slice(0, 50)}... (score: ${analysis.relevanceScore})`);
      }

      // Rate limit between AI calls
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`[LeadDiscovery] Discovery complete. Found ${leads.length} leads from ${postsAnalyzed} posts`);

    return {
      leads,
      postsAnalyzed,
    };
  } catch (error) {
    console.error('[LeadDiscovery] Discovery failed:', error);
    return {
      leads,
      postsAnalyzed,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Generate a personalized DM for a lead
 */
export async function generateDMForLead(
  lead: Lead,
  businessDescription: string,
): Promise<string> {
  try {
    const prompt = `You are a friendly sales assistant. Write a short, personalized Reddit DM to this person who might be interested in our product/service.

THEIR POST:
Title: ${lead.post.title}
Content: ${lead.post.content.slice(0, 500)}

OUR BUSINESS:
${businessDescription}

WHY THEY MIGHT BE INTERESTED:
${lead.aiReason}

Write a short, friendly DM (2-3 sentences max) that:
1. References their specific post/problem
2. Briefly mentions how we can help
3. Asks if they'd like to chat more
4. Is NOT salesy or pushy

Just write the message text, no greeting headers or signatures.`;

    const response = await generateText(prompt, { temperature: 0.7, maxTokens: 200 });
    return response.trim();
  } catch (error) {
    console.error('[LeadDiscovery] Error generating DM:', error);
    return 'Hey! I saw your post and thought I might be able to help. Would you be interested in chatting more?';
  }
}

export default {
  discoverLeads,
  generateDMForLead,
};
