/**
 * Reddit API Service
 *
 * Handles direct integration with Reddit API for fetching:
 * - Comment replies
 * - Direct messages (DMs)
 * - Post comments
 *
 * This service uses the authenticated Reddit OAuth connection
 * to fetch data directly from Reddit's API endpoints.
 */

import RedditOAuthService from '../integrations/RedditOAuthService';
import { RedditComment, RedditPost } from '../types/reddit';

export interface RedditMessage {
  id: string;
  type: 'comment_reply' | 'post_reply' | 'username_mention' | 'private_message';
  author: string;
  subject?: string; // For DMs
  body: string;
  created: number; // Unix timestamp
  context?: string; // Link to parent context
  subreddit?: string; // For comment replies
  postTitle?: string; // For post/comment replies
  new: boolean; // Unread status
  parentId?: string; // ID of parent comment/post
  linkId?: string; // ID of the post
}

export interface RedditAPIResponse {
  success: boolean;
  data?: RedditMessage[];
  error?: string;
}

class RedditAPIService {
  private readonly USER_AGENT = 'Vibecode:com.vibecode.app:v1.0.0 (by /u/vibecode)';
  private readonly BASE_URL = 'https://oauth.reddit.com';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch with automatic retry for transient errors (5xx)
   */
  private async fetchWithRetry(
    url: string,
    options: globalThis.RequestInit,
    retries: number = this.MAX_RETRIES,
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, options);

        // If successful or client error (4xx), return immediately
        if (response.ok || (response.status >= 400 && response.status < 500)) {
          return response;
        }

        // For server errors (5xx), retry
        if (response.status >= 500 && attempt < retries) {
          console.log(`⚠️ [RedditAPI] Server error ${response.status}, retrying (${attempt}/${retries})...`);
          await this.delay(this.RETRY_DELAY_MS * attempt); // Exponential backoff
          continue;
        }

        return response;
      } catch (error: any) {
        lastError = error;
        if (attempt < retries) {
          console.log(`⚠️ [RedditAPI] Network error, retrying (${attempt}/${retries})...`);
          await this.delay(this.RETRY_DELAY_MS * attempt);
          continue;
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Fetch unread messages (replies and DMs) from Reddit
   */
  async fetchUnreadMessages(): Promise<RedditAPIResponse> {
    try {
      const accessToken = await RedditOAuthService.getValidAccessToken();

      if (!accessToken) {
        console.error('🔴 [RedditAPI] No valid access token available');
        return {
          success: false,
          error: 'Not authenticated with Reddit',
        };
      }

      console.log('📨 [RedditAPI] Fetching unread messages...');

      // Fetch unread messages from Reddit inbox
      const response = await this.fetchWithRetry(`${this.BASE_URL}/message/unread`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': this.USER_AGENT,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 [RedditAPI] Failed to fetch unread messages:', response.status, errorText);
        return {
          success: false,
          error: `Reddit API error: ${response.status}`,
        };
      }

      const data = await response.json();

      if (!data?.data?.children) {
        console.log('📭 [RedditAPI] No unread messages');
        return {
          success: true,
          data: [],
        };
      }

      // Parse messages
      const messages: RedditMessage[] = data.data.children.map((child: any) => {
        const msg = child.data;

        return {
          id: msg.id,
          type: this.determineMessageType(msg),
          author: msg.author,
          subject: msg.subject,
          body: msg.body,
          created: msg.created_utc,
          context: msg.context,
          subreddit: msg.subreddit,
          postTitle: msg.link_title,
          new: msg.new,
          parentId: msg.parent_id,
          linkId: msg.link_id,
        };
      });

      console.log(`✅ [RedditAPI] Fetched ${messages.length} unread messages`);

      return {
        success: true,
        data: messages,
      };
    } catch (error: any) {
      console.error('🔴 [RedditAPI] Error fetching unread messages:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch messages',
      };
    }
  }

  /**
   * Fetch all messages (read and unread) from Reddit inbox
   */
  async fetchAllMessages(limit: number = 25): Promise<RedditAPIResponse> {
    try {
      const accessToken = await RedditOAuthService.getValidAccessToken();

      if (!accessToken) {
        console.error('🔴 [RedditAPI] No valid access token available');
        return {
          success: false,
          error: 'Not authenticated with Reddit',
        };
      }

      console.log(`📨 [RedditAPI] Fetching ${limit} recent messages...`);

      const response = await this.fetchWithRetry(`${this.BASE_URL}/message/inbox?limit=${limit}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': this.USER_AGENT,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 [RedditAPI] Failed to fetch messages:', response.status, errorText);
        return {
          success: false,
          error: `Reddit API error: ${response.status}`,
        };
      }

      const data = await response.json();

      if (!data?.data?.children) {
        console.log('📭 [RedditAPI] No messages found');
        return {
          success: true,
          data: [],
        };
      }

      const messages: RedditMessage[] = data.data.children.map((child: any) => {
        const msg = child.data;

        return {
          id: msg.id,
          type: this.determineMessageType(msg),
          author: msg.author,
          subject: msg.subject,
          body: msg.body,
          created: msg.created_utc,
          context: msg.context,
          subreddit: msg.subreddit,
          postTitle: msg.link_title,
          new: msg.new,
          parentId: msg.parent_id,
          linkId: msg.link_id,
        };
      });

      console.log(`✅ [RedditAPI] Fetched ${messages.length} messages`);

      return {
        success: true,
        data: messages,
      };
    } catch (error: any) {
      console.error('🔴 [RedditAPI] Error fetching messages:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch messages',
      };
    }
  }

  /**
   * Mark a message as read
   */
  async markMessageAsRead(messageId: string): Promise<boolean> {
    try {
      const accessToken = await RedditOAuthService.getValidAccessToken();

      if (!accessToken) {
        console.error('🔴 [RedditAPI] No valid access token available');
        return false;
      }

      console.log(`✉️ [RedditAPI] Marking message ${messageId} as read...`);

      const response = await this.fetchWithRetry(`${this.BASE_URL}/api/read_message`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': this.USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          id: messageId.startsWith('t4_') ? messageId : `t4_${messageId}`,
        }).toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 [RedditAPI] Failed to mark message as read:', response.status, errorText);
        return false;
      }

      console.log(`✅ [RedditAPI] Message ${messageId} marked as read`);
      return true;
    } catch (error: any) {
      console.error('🔴 [RedditAPI] Error marking message as read:', error);
      return false;
    }
  }

  /**
   * Send a reply to a message or comment
   * For private messages (t4_), uses /api/compose
   * For comments (t1_) and posts (t3_), uses /api/comment
   */
  async sendReply(thingId: string, text: string): Promise<{ success: boolean; error?: string }> {
    try {
      const accessToken = await RedditOAuthService.getValidAccessToken();

      if (!accessToken) {
        console.error('🔴 [RedditAPI] No valid access token available');
        return {
          success: false,
          error: 'Not authenticated with Reddit',
        };
      }

      console.log(`💬 [RedditAPI] Sending reply to ${thingId}...`);

      // Ensure thingId has proper prefix
      let fullThingId = thingId;
      if (!thingId.startsWith('t1_') && !thingId.startsWith('t3_') && !thingId.startsWith('t4_')) {
        fullThingId = `t4_${thingId}`; // Default to private message prefix for DMs
      }

      // Check if this is a private message (t4_) - use /api/compose endpoint
      if (fullThingId.startsWith('t4_')) {
        console.log(`📧 [RedditAPI] Replying to private message ${fullThingId}...`);

        const response = await this.fetchWithRetry(`${this.BASE_URL}/api/comment`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': this.USER_AGENT,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            thing_id: fullThingId,
            text,
            api_type: 'json',
          }).toString(),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('🔴 [RedditAPI] Failed to send DM reply:', response.status, errorText);
          return {
            success: false,
            error: `Failed to send DM reply: ${response.status}`,
          };
        }

        const result = await response.json();

        // Check for errors in the response
        if (result.json?.errors?.length > 0) {
          const errors = result.json.errors.map((e: string[]) => e[1] || e[0]).join(', ');
          console.error('🔴 [RedditAPI] Reddit returned errors:', errors);
          return {
            success: false,
            error: errors,
          };
        }

        console.log('✅ [RedditAPI] DM reply sent successfully');
        return { success: true };
      }

      // For comments and posts, use /api/comment endpoint
      const response = await this.fetchWithRetry(`${this.BASE_URL}/api/comment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': this.USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          thing_id: fullThingId,
          text,
          api_type: 'json',
        }).toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 [RedditAPI] Failed to send reply:', response.status, errorText);
        return {
          success: false,
          error: `Failed to send reply: ${response.status}`,
        };
      }

      const result = await response.json();

      // Check for errors in the response
      if (result.json?.errors?.length > 0) {
        const errors = result.json.errors.map((e: string[]) => e[1] || e[0]).join(', ');
        console.error('🔴 [RedditAPI] Reddit returned errors:', errors);
        return {
          success: false,
          error: errors,
        };
      }

      console.log('✅ [RedditAPI] Reply sent successfully');

      return {
        success: true,
      };
    } catch (error: any) {
      console.error('🔴 [RedditAPI] Error sending reply:', error);
      return {
        success: false,
        error: error.message || 'Failed to send reply',
      };
    }
  }

  /**
   * Get comment replies for a specific comment
   */
  async getCommentReplies(commentId: string): Promise<RedditAPIResponse> {
    try {
      const accessToken = await RedditOAuthService.getValidAccessToken();

      if (!accessToken) {
        console.error('🔴 [RedditAPI] No valid access token available');
        return {
          success: false,
          error: 'Not authenticated with Reddit',
        };
      }

      console.log(`💬 [RedditAPI] Fetching replies for comment ${commentId}...`);

      // Remove t1_ prefix if present
      const cleanCommentId = commentId.replace('t1_', '');

      const response = await this.fetchWithRetry(`${this.BASE_URL}/api/morechildren?link_id=t3_${cleanCommentId}&children=${cleanCommentId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': this.USER_AGENT,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 [RedditAPI] Failed to fetch comment replies:', response.status, errorText);
        return {
          success: false,
          error: `Reddit API error: ${response.status}`,
        };
      }

      const data = await response.json();

      // Parse replies from the response
      // Note: This is a simplified version - full implementation would need to parse the nested structure

      console.log(`✅ [RedditAPI] Fetched replies for comment ${commentId}`);

      return {
        success: true,
        data: [],
      };
    } catch (error: any) {
      console.error('🔴 [RedditAPI] Error fetching comment replies:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch replies',
      };
    }
  }

  /**
   * Determine the type of message based on Reddit API data
   */
  private determineMessageType(msg: any): RedditMessage['type'] {
    if (msg.was_comment) {
      if (msg.type === 'username_mention') {
        return 'username_mention';
      }
      // Check if it's a reply to our comment or a reply to our post
      return msg.context?.includes('/comments/') ? 'comment_reply' : 'post_reply';
    }

    return 'private_message';
  }

  /**
   * Fetch user's sent messages
   */
  async fetchSentMessages(limit: number = 25): Promise<RedditAPIResponse> {
    try {
      const accessToken = await RedditOAuthService.getValidAccessToken();

      if (!accessToken) {
        return {
          success: false,
          error: 'Not authenticated with Reddit',
        };
      }

      const response = await this.fetchWithRetry(`${this.BASE_URL}/message/sent?limit=${limit}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': this.USER_AGENT,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Reddit API error: ${response.status}`,
        };
      }

      const data = await response.json();

      if (!data?.data?.children) {
        return {
          success: true,
          data: [],
        };
      }

      const messages: RedditMessage[] = data.data.children.map((child: any) => {
        const msg = child.data;

        return {
          id: msg.id,
          type: this.determineMessageType(msg),
          author: msg.dest, // For sent messages, 'dest' is the recipient
          subject: msg.subject,
          body: msg.body,
          created: msg.created_utc,
          context: msg.context,
          subreddit: msg.subreddit,
          postTitle: msg.link_title,
          new: false, // Sent messages are always "read"
          parentId: msg.parent_id,
          linkId: msg.link_id,
        };
      });

      return {
        success: true,
        data: messages,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch sent messages',
      };
    }
  }
}

export default new RedditAPIService();
