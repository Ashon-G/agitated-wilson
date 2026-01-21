/**
 * AI Comment Generator
 * Generates natural, human-like Reddit comments using AI
 */

import * as admin from 'firebase-admin';

const db = admin.firestore();

interface CommentGenerationRequest {
  post: {
    title: string;
    selftext: string;
    subreddit: string;
    author: string;
    postId: string;
  };
  knowledgeContext: any[];
  subreddit: string;
  userId: string;
  conversationHistory?: any[];
}

interface CommentGenerationResult {
  success: boolean;
  comment?: string;
  knowledgeItemsUsed?: string[];
  confidence?: number;
  error?: string;
}

class AICommentGenerator {
  /**
   * Generate a natural, human-like comment for a Reddit post
   */
  async generateComment(
    request: CommentGenerationRequest,
  ): Promise<CommentGenerationResult> {
    try {
      const { post, knowledgeContext, userId, conversationHistory } = request;

      // Get user's workspace settings for persona
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      const workspace = userData?.workspace || {};

      // Build context for AI
      const contextMessages = [
        {
          role: 'system',
          content: this.buildSystemPrompt(workspace, knowledgeContext),
        },
        {
          role: 'user',
          content: this.buildPostContext(post, conversationHistory),
        },
      ];

      // Call AI service (using OpenAI via Firebase Function)
      const aiResponse = await this.callAIService(contextMessages, userId);

      if (!aiResponse.success) {
        return {
          success: false,
          error: 'AI service failed',
        };
      }

      // Extract comment and confidence from AI response
      const { comment, confidence } = this.parseAIResponse(aiResponse.text);

      return {
        success: true,
        comment,
        knowledgeItemsUsed: knowledgeContext.map((k) => k.id),
        confidence,
      };
    } catch (error) {
      console.error('Error generating comment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build system prompt for AI
   */
  private buildSystemPrompt(workspace: any, knowledgeContext: any[]): string {
    const productName = workspace.product_name || 'our product';
    const productDescription = workspace.product_description || '';
    const companyName = workspace.company_name || '';
    const sellingPoints = workspace.selling_points || [];

    let prompt = `You are a helpful Reddit user engaging in authentic conversations. Your goal is to naturally discuss problems and solutions.

CRITICAL RULES:
1. NEVER mention you're an AI, bot, or sales agent
2. NEVER use salesy language or obvious pitches
3. Sound like a regular person sharing their experience
4. Only mention ${productName} if it's genuinely relevant to the conversation
5. Keep responses conversational and casual (1-3 paragraphs max)
6. Use natural Reddit language (lowercase, casual tone, occasional slang)
7. Don't use exclamation points excessively
8. Don't force the product into every response

ABOUT THE PRODUCT/SERVICE:
Product: ${productName}
${productDescription ? `Description: ${productDescription}` : ''}
${companyName ? `Company: ${companyName}` : ''}
${sellingPoints.length > 0 ? `Key Benefits: ${sellingPoints.join(', ')}` : ''}

`;

    if (knowledgeContext.length > 0) {
      prompt += '\nRELEVANT KNOWLEDGE:\n';
      knowledgeContext.forEach((item, index) => {
        prompt += `${index + 1}. ${item.title}: ${item.content}\n`;
      });
    }

    prompt += `\nRESPOND FORMAT:
First line: CONFIDENCE: [0.0-1.0]
Then your natural, human-like Reddit comment.`;

    return prompt;
  }

  /**
   * Build post context for AI
   */
  private buildPostContext(post: any, conversationHistory?: any[]): string {
    let context = `Reddit Post in r/${post.subreddit}:\n`;
    context += `Title: ${post.title}\n`;
    if (post.selftext) {
      context += `Content: ${post.selftext}\n`;
    }

    if (conversationHistory && conversationHistory.length > 0) {
      context += '\nPREVIOUS CONVERSATION:\n';
      conversationHistory.forEach((msg) => {
        context += `${msg.author}: ${msg.body}\n`;
      });
    }

    context += '\nWrite a helpful, natural comment as a regular Reddit user:';

    return context;
  }

  /**
   * Call AI service to generate comment
   */
  private async callAIService(
    messages: any[],
    userId: string,
  ): Promise<{ success: boolean; text: string }> {
    try {
      // Import axios dynamically
      const axios = (await import('axios')).default;

      // Call OpenAI API
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages,
          max_tokens: 500,
          temperature: 0.8, // Higher temperature for more natural variation
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const text = response.data.choices[0]?.message?.content || '';

      return {
        success: true,
        text,
      };
    } catch (error) {
      console.error('AI service error:', error);
      return {
        success: false,
        text: '',
      };
    }
  }

  /**
   * Parse AI response to extract confidence and comment
   */
  private parseAIResponse(text: string): { comment: string; confidence: number } {
    const lines = text.split('\n');
    let confidence = 0.7; // Default confidence
    let comment = text;

    // Check if first line contains confidence
    if (lines[0].toLowerCase().includes('confidence:')) {
      const confidenceMatch = lines[0].match(/confidence:\s*([\d.]+)/i);
      if (confidenceMatch) {
        confidence = parseFloat(confidenceMatch[1]);
      }
      // Remove confidence line from comment
      comment = lines.slice(1).join('\n').trim();
    }

    return { comment, confidence };
  }

  /**
   * Generate a reply to a conversation
   */
  async generateReply(
    request: {
      originalComment: string;
      replies: any[];
      knowledgeContext: any[];
      userId: string;
    },
  ): Promise<CommentGenerationResult> {
    try {
      const { originalComment, replies, knowledgeContext, userId } = request;

      // Get user's workspace settings
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      const workspace = userData?.workspace || {};

      // Build conversation thread
      const conversationHistory = [
        { author: 'You', body: originalComment },
        ...replies,
      ];

      // Build context for AI
      const contextMessages = [
        {
          role: 'system',
          content: this.buildSystemPrompt(workspace, knowledgeContext),
        },
        {
          role: 'user',
          content: this.buildReplyContext(conversationHistory),
        },
      ];

      // Call AI service
      const aiResponse = await this.callAIService(contextMessages, userId);

      if (!aiResponse.success) {
        return {
          success: false,
          error: 'AI service failed',
        };
      }

      // Extract comment and confidence
      const { comment, confidence } = this.parseAIResponse(aiResponse.text);

      return {
        success: true,
        comment,
        knowledgeItemsUsed: knowledgeContext.map((k) => k.id),
        confidence,
      };
    } catch (error) {
      console.error('Error generating reply:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build context for reply generation
   */
  private buildReplyContext(conversationHistory: any[]): string {
    let context = 'CONVERSATION THREAD:\n\n';

    conversationHistory.forEach((msg) => {
      context += `${msg.author}: ${msg.body}\n\n`;
    });

    context += 'Write your natural, conversational reply:';

    return context;
  }
}

export const aiCommentGenerator = new AICommentGenerator();
