/**
 * Knowledge Base Query Service
 * Retrieves relevant knowledge for Reddit posts
 */

import * as admin from 'firebase-admin';

const db = admin.firestore();

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  relevanceScore?: number;
}

class KnowledgeBaseQuery {
  /**
   * Find relevant knowledge items for a post
   */
  async findRelevantKnowledge(
    userId: string,
    postContent: string,
    subreddit: string,
  ): Promise<KnowledgeItem[]> {
    try {
      // Get all knowledge items for user from users/{userId}/knowledge/items
      const knowledgeSnapshot = await db
        .collection(`users/${userId}/knowledge/items`)
        .get();

      if (knowledgeSnapshot.empty) {
        console.log(`No knowledge items found for user ${userId}`);
        return [];
      }

      const knowledgeItems = knowledgeSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as KnowledgeItem));

      // Score each knowledge item by relevance
      const scoredItems = await this.scoreKnowledgeItems(
        knowledgeItems,
        postContent,
        subreddit,
      );

      // Return top 3 most relevant items
      return scoredItems
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
        .slice(0, 3);
    } catch (error) {
      console.error('Error finding relevant knowledge:', error);
      return [];
    }
  }

  /**
   * Score knowledge items by relevance to post
   */
  private async scoreKnowledgeItems(
    items: KnowledgeItem[],
    postContent: string,
    subreddit: string,
  ): Promise<KnowledgeItem[]> {
    const postLower = postContent.toLowerCase();
    const subredditLower = subreddit.toLowerCase();

    return items.map(item => {
      let score = 0;

      // Check for keyword matches in post
      const keywords = [
        ...item.tags,
        ...item.title.toLowerCase().split(' '),
        ...item.content.toLowerCase().split(' ').slice(0, 20), // First 20 words
      ];

      keywords.forEach(keyword => {
        if (keyword.length > 3 && postLower.includes(keyword.toLowerCase())) {
          score += 1;
        }
      });

      // Boost score if subreddit matches any tags
      if (item.tags.some(tag => tag.toLowerCase().includes(subredditLower))) {
        score += 2;
      }

      // Boost score for longer content (more detailed knowledge)
      if (item.content.length > 200) {
        score += 0.5;
      }

      return {
        ...item,
        relevanceScore: score,
      };
    });
  }

  /**
   * Get all knowledge for a user (for comprehensive context)
   */
  async getAllUserKnowledge(userId: string): Promise<KnowledgeItem[]> {
    try {
      const snapshot = await db
        .collection(`users/${userId}/knowledge/items`)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as KnowledgeItem));
    } catch (error) {
      console.error('Error getting all knowledge:', error);
      return [];
    }
  }

  /**
   * Get knowledge items by category
   */
  async getKnowledgeByCategory(
    userId: string,
    category: string,
  ): Promise<KnowledgeItem[]> {
    try {
      const snapshot = await db
        .collection(`users/${userId}/knowledge/items`)
        .where('category', '==', category)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as KnowledgeItem));
    } catch (error) {
      console.error('Error getting knowledge by category:', error);
      return [];
    }
  }
}

export const knowledgeBaseQuery = new KnowledgeBaseQuery();
