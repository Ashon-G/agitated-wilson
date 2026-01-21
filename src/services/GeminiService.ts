/**
 * Gemini Service
 *
 * Provides AI capabilities using Google's Gemini model via Firebase AI SDK.
 * Used for:
 * - Lead scoring and qualification
 * - Comment generation
 * - Conversation handling in DMs
 * - Email collection strategies
 */

import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import app from '../config/firebase';

// Initialize the Gemini Developer API backend service
const ai = getAI(app, { backend: new GoogleAIBackend() });

// Create a GenerativeModel instance with gemini-2.5-flash
const model = getGenerativeModel(ai, { model: 'gemini-2.5-flash' });

// Rate limit tracking
const rateLimitState = {
  lastRateLimitHit: 0,
  retryAfterMs: 0,
};

class GeminiService {
  /**
   * Check if Gemini is configured
   */
  isConfigured(): boolean {
    // Firebase AI is configured if Firebase app is initialized
    return !!app;
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if we should wait due to rate limiting
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const waitUntil = rateLimitState.lastRateLimitHit + rateLimitState.retryAfterMs;

    if (now < waitUntil) {
      const waitTime = waitUntil - now;
      console.log(`⏳ [Gemini] Rate limited, waiting ${Math.ceil(waitTime / 1000)}s...`);
      await this.sleep(waitTime);
    }
  }

  /**
   * Handle rate limit error and extract retry delay
   */
  private handleRateLimitError(error: Error): number {
    const errorMessage = error.message || '';

    // Try to extract retry delay from error message
    const retryMatch = errorMessage.match(/retry in (\d+(?:\.\d+)?)/i);
    if (retryMatch) {
      return Math.ceil(parseFloat(retryMatch[1]) * 1000) + 1000; // Add 1s buffer
    }

    // Default backoff: 30 seconds
    return 30000;
  }

  /**
   * Generate text content using Gemini with retry logic
   */
  async generateContent(prompt: string, _useJsonResponse = false, maxRetries = 2): Promise<string> {
    // Check if we need to wait due to previous rate limit
    await this.checkRateLimit();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { response } = await model.generateContent(prompt);
        const text = response.text();

        if (!text) {
          throw new Error('No response from Gemini API');
        }

        return text;
      } catch (error: any) {
        const isRateLimit = error.message?.includes('429') ||
                          error.message?.includes('quota') ||
                          error.message?.includes('rate');

        if (isRateLimit && attempt < maxRetries) {
          const retryAfterMs = this.handleRateLimitError(error);
          rateLimitState.lastRateLimitHit = Date.now();
          rateLimitState.retryAfterMs = retryAfterMs;

          console.log(`⚠️ [Gemini] Rate limit hit, attempt ${attempt + 1}/${maxRetries + 1}, waiting ${retryAfterMs / 1000}s...`);
          await this.sleep(retryAfterMs);
          continue;
        }

        console.error('🔴 Gemini generateContent error:', error);
        throw error;
      }
    }

    throw new Error('Max retries exceeded for Gemini API');
  }

  /**
   * Score a Reddit post for lead quality (0-100)
   * Returns score and reasoning
   */
  async scoreLeadQuality(post: {
    title: string;
    content: string;
    subreddit: string;
    author: string;
    upvotes: number;
    commentCount: number;
  }, knowledgeContext: string): Promise<{
    score: number;
    reasoning: string;
    buyingIntent: 'high' | 'medium' | 'low' | 'none';
    shouldEngage: boolean;
  }> {
    const prompt = `You are a lead qualification AI for a sales team. Analyze this Reddit post and score the lead quality.

KNOWLEDGE ABOUT OUR PRODUCT/SERVICE:
${knowledgeContext}

REDDIT POST TO ANALYZE:
Subreddit: r/${post.subreddit}
Title: ${post.title}
Content: ${post.content}
Author: u/${post.author}
Upvotes: ${post.upvotes}
Comments: ${post.commentCount}

Score this lead from 0-100 based on:
1. Buying intent signals (asking for recommendations, budget mentions, urgency)
2. Relevance to our product/service
3. Engagement level (upvotes, comments indicate active discussion)
4. Author credibility (not spam, genuine question)

Respond in JSON format only:
{
  "score": <number 0-100>,
  "reasoning": "<brief explanation>",
  "buyingIntent": "<high|medium|low|none>",
  "shouldEngage": <true|false>
}`;

    try {
      const response = await this.generateContent(prompt, true);
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: Math.max(0, Math.min(100, parsed.score || 0)),
          reasoning: parsed.reasoning || 'Unable to analyze',
          buyingIntent: parsed.buyingIntent || 'none',
          shouldEngage: parsed.shouldEngage ?? false,
        };
      }
      throw new Error('Invalid JSON response from Gemini');
    } catch (error) {
      console.error('🔴 Error scoring lead:', error);
      return {
        score: 0,
        reasoning: 'Error analyzing post',
        buyingIntent: 'none',
        shouldEngage: false,
      };
    }
  }

  /**
   * Generate a natural, helpful Reddit comment
   */
  async generateComment(post: {
    title: string;
    content: string;
    subreddit: string;
  }, knowledgeContext: string, style: 'friendly' | 'professional' | 'expert' = 'friendly'): Promise<{
    comment: string;
    confidence: number;
  }> {
    const styleGuide = {
      friendly: 'Be warm, casual, and approachable. Use conversational language.',
      professional: 'Be helpful and informative. Maintain a professional but not stiff tone.',
      expert: 'Demonstrate deep expertise. Be authoritative but not condescending.',
    };

    const prompt = `You are writing a helpful Reddit comment. Your goal is to genuinely help the person, not to sell directly.

KNOWLEDGE ABOUT OUR PRODUCT/SERVICE (use subtly if relevant):
${knowledgeContext}

REDDIT POST:
Subreddit: r/${post.subreddit}
Title: ${post.title}
Content: ${post.content}

STYLE: ${styleGuide[style]}

RULES:
1. Be genuinely helpful first - provide value
2. Don't mention product names directly unless very relevant
3. Share insights or tips based on the knowledge
4. Sound like a real person, not a marketer
5. Keep it concise (2-4 sentences max)
6. Match the subreddit's tone
7. Never start with "I" - vary your openings
8. Don't use phrases like "I'd recommend" or "You should check out"

Generate a natural, helpful comment. Respond in JSON format:
{
  "comment": "<your comment>",
  "confidence": <0-1 how confident you are this is helpful and appropriate>
}`;

    try {
      const response = await this.generateContent(prompt, true);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          comment: parsed.comment || '',
          confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
        };
      }
      throw new Error('Invalid JSON response');
    } catch (error) {
      console.error('🔴 Error generating comment:', error);
      return {
        comment: '',
        confidence: 0,
      };
    }
  }

  /**
   * Generate a DM response for lead nurturing
   * Can optionally try to collect email if HubSpot is connected
   */
  async generateDMResponse(conversation: {
    messages: Array<{ sender: 'user' | 'lead'; text: string }>;
    leadContext: {
      username: string;
      originalPost?: string;
      previousInteractions: number;
    };
  }, knowledgeContext: string, options: {
    collectEmail: boolean;
    emailCollectionStage: 'not_started' | 'building_rapport' | 'ready_to_ask' | 'asked' | 'collected';
  }): Promise<{
    response: string;
    nextStage: 'building_rapport' | 'ready_to_ask' | 'asked' | 'collected' | 'not_interested';
    extractedEmail?: string;
  }> {
    const conversationHistory = conversation.messages
      .map(m => `${m.sender === 'user' ? 'You' : conversation.leadContext.username}: ${m.text}`)
      .join('\n');

    const emailStrategy = options.collectEmail ? `
EMAIL COLLECTION STRATEGY:
Current stage: ${options.emailCollectionStage}
- If building_rapport: Focus on being helpful, don't mention email yet
- If ready_to_ask: Naturally transition to offering valuable resource that requires email
- If asked: If they seem hesitant, offer alternative value; if positive, get the email
- Look for email addresses in their messages and extract them
` : '';

    const prompt = `You are having a DM conversation on Reddit with a potential lead. Be helpful and build genuine rapport.

KNOWLEDGE ABOUT OUR PRODUCT/SERVICE:
${knowledgeContext}

CONVERSATION HISTORY:
${conversationHistory}

LEAD CONTEXT:
Username: ${conversation.leadContext.username}
Previous interactions: ${conversation.leadContext.previousInteractions}
${conversation.leadContext.originalPost ? `Original post they made: ${conversation.leadContext.originalPost}` : ''}

${emailStrategy}

RULES:
1. Be conversational and genuine
2. Provide actual value in every message
3. Don't be pushy or salesy
4. Match their communication style
5. Keep responses concise (1-3 sentences)
${options.collectEmail ? '6. If appropriate, work towards getting their email for follow-up' : ''}

Generate your response. If you see an email in their last message, extract it.

Respond in JSON format:
{
  "response": "<your DM response>",
  "nextStage": "<building_rapport|ready_to_ask|asked|collected|not_interested>",
  "extractedEmail": "<email if found in conversation, null otherwise>"
}`;

    try {
      const response = await this.generateContent(prompt, true);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          response: parsed.response || '',
          nextStage: parsed.nextStage || 'building_rapport',
          extractedEmail: parsed.extractedEmail || undefined,
        };
      }
      throw new Error('Invalid JSON response');
    } catch (error) {
      console.error('🔴 Error generating DM response:', error);
      return {
        response: '',
        nextStage: 'building_rapport',
      };
    }
  }

  /**
   * Analyze a message for sentiment and intent
   */
  async analyzeMessage(message: string): Promise<{
    sentiment: 'positive' | 'negative' | 'neutral';
    intent: 'question' | 'interest' | 'objection' | 'not_interested' | 'other';
    hasEmail: boolean;
    extractedEmail?: string;
  }> {
    const prompt = `Analyze this message for sentiment and intent.

MESSAGE: "${message}"

Respond in JSON format only:
{
  "sentiment": "<positive|negative|neutral>",
  "intent": "<question|interest|objection|not_interested|other>",
  "hasEmail": <true|false>,
  "extractedEmail": "<email if found, null otherwise>"
}`;

    try {
      const response = await this.generateContent(prompt, true);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          sentiment: parsed.sentiment || 'neutral',
          intent: parsed.intent || 'other',
          hasEmail: parsed.hasEmail || false,
          extractedEmail: parsed.extractedEmail || undefined,
        };
      }
      throw new Error('Invalid JSON response');
    } catch (error) {
      console.error('🔴 Error analyzing message:', error);
      return {
        sentiment: 'neutral',
        intent: 'other',
        hasEmail: false,
      };
    }
  }

  /**
   * Generate keywords AND subreddits for Reddit search based on knowledge base
   * Returns both keywords and suggested subreddits
   */
  async generateKeywordsAndSubreddits(knowledgeContext: string): Promise<{
    keywords: string[];
    subreddits: string[];
    confidence: number;
    reasoning: string;
  }> {
    const prompt = `Analyze this knowledge base and generate Reddit search keywords AND relevant subreddits.

KNOWLEDGE:
${knowledgeContext}

Generate:
1. 8-12 relevant search keywords that would find posts from people who need this product/service
2. 6-10 relevant subreddits where the target audience is likely to post

Focus on:
- Keywords should be phrases people actually search for or problems they describe
- Subreddits should be active communities relevant to the business/product
- Be specific to the business domain shown in the knowledge base
- Include both broad and niche options

Respond in JSON format only:
{
  "keywords": ["keyword1", "keyword2", ...],
  "subreddits": ["subreddit1", "subreddit2", ...],
  "confidence": <number 0-100>,
  "reasoning": "<brief explanation of choices>"
}`;

    try {
      const response = await this.generateContent(prompt, true);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
          subreddits: Array.isArray(parsed.subreddits) ? parsed.subreddits : [],
          confidence: parsed.confidence || 0,
          reasoning: parsed.reasoning || '',
        };
      }
      return { keywords: [], subreddits: [], confidence: 0, reasoning: 'Failed to parse response' };
    } catch (error) {
      console.error('🔴 Error generating keywords and subreddits:', error);
      return { keywords: [], subreddits: [], confidence: 0, reasoning: 'Error generating content' };
    }
  }

  /**
   * Reword a quest question using business context
   * Transforms verbose context into catchy, concise labels
   */
  async rewordQuestQuestion(
    questionTemplate: string,
    context: {
      businessName?: string;
      targetMarket?: string;
      productDescription?: string;
    },
  ): Promise<string> {
    const prompt = `You are rewriting a question card for a mobile app. Transform any verbose business context into SHORT, CATCHY labels.

ORIGINAL QUESTION:
"${questionTemplate}"

RAW BUSINESS CONTEXT (needs to be transformed into catchy labels):
- Business Name: ${context.businessName || 'your company'}
- Target Market (raw): "${context.targetMarket || 'your ideal customers'}"
- Product/Service (raw): "${context.productDescription || 'what you offer'}"

YOUR TASK:
1. First, transform the raw target market into a CATCHY 2-3 WORD LABEL:
   - "anyone struggling to find customers" → "struggling founders" or "early-stage founders"
   - "small business owners who need help with marketing" → "small business owners" or "busy entrepreneurs"
   - "people looking for AI tools" → "AI enthusiasts" or "tech-forward teams"
   - "first time founders" → "first-time founders"

2. Transform the raw product description into a SHORT phrase:
   - "AI-powered sales assistant that helps find leads on social media" → "your AI sales tool" or "what you're building"
   - "software that helps track expenses and invoices" → "your accounting software"

3. Rewrite the question using these SHORT labels, keeping it friendly and casual.

CRITICAL RULES:
- NEVER use the raw target market verbatim if it's more than 3 words
- NEVER create awkward phrases like "Where can Anyone struggling to find..."
- The target market label must work grammatically in the sentence
- Keep the same friendly tone
- Return ONLY the final reworded question

Return ONLY the reworded question (no explanation):`;

    try {
      const response = await this.generateContent(prompt);
      // Clean up the response - remove quotes if present
      let cleaned = response.trim();
      if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.slice(1, -1);
      }
      if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
        cleaned = cleaned.slice(1, -1);
      }
      return cleaned || questionTemplate;
    } catch (error) {
      console.error('🔴 Error rewording question:', error);
      // Return simple fallback with just business name
      return questionTemplate.replace(/{businessName}/g, context.businessName || 'your company')
        .replace(/{targetMarket}/g, 'your target customers')
        .replace(/{productDescription}/g, 'your product');
    }
  }

  /**
   * Generate keywords for Reddit search based on knowledge base
   */
  async generateSearchKeywords(knowledgeContext: string): Promise<string[]> {
    const prompt = `Based on this product/service knowledge, generate Reddit search keywords that would find potential customers.

KNOWLEDGE:
${knowledgeContext}

Generate 10-15 search keywords/phrases that people looking for this type of product/service might use on Reddit.
Focus on:
- Problem-related keywords (what problems does this solve?)
- Solution-seeking keywords (what would someone search when looking for this?)
- Comparison keywords (vs, alternative, better than)
- Recommendation keywords (best, recommend, suggest)

Respond with a JSON array of strings only:
["keyword1", "keyword2", ...]`;

    try {
      const response = await this.generateContent(prompt, true);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const keywords = JSON.parse(jsonMatch[0]);
        return Array.isArray(keywords) ? keywords : [];
      }
      return [];
    } catch (error) {
      console.error('🔴 Error generating keywords:', error);
      return [];
    }
  }
}

export default new GeminiService();
