/**
 * Private Knowledge Base Service
 *
 * Main knowledge base service that orchestrates knowledge operations.
 * Uses smaller, focused services for better maintainability and separation of concerns.
 *
 * @version 2.0.0
 * @author PaynaAI Team
 */

import KnowledgeService from './knowledge/KnowledgeService';
import LearningService from './knowledge/LearningService';
import EmbeddingService from './knowledge/EmbeddingService';
import {
  KnowledgeItem,
  ConversationContext,
  ConversationMessage,
  ExtractedEntity,
} from '../types/agent';

class KnowledgeBaseService {
  /**
   * Add new knowledge item to user's private knowledge base
   */
  async addKnowledgeItem(
    userId: string,
    agentId: string,
    knowledgeData: Omit<KnowledgeItem, 'id' | 'userId' | 'agentId' | 'timestamps' | 'usage' | 'version'>,
  ): Promise<KnowledgeItem> {
    // Generate embedding for semantic search
    if (knowledgeData.content.answer) {
      const embedding = await EmbeddingService.generateEmbedding(
        `${knowledgeData.content.title} ${knowledgeData.content.answer}`,
        userId,
      );
      knowledgeData.embedding = embedding;
    }

    return await KnowledgeService.addKnowledgeItem(userId, agentId, knowledgeData);
  }

  /**
   * Learn from user response to agent question
   */
  async learnFromUserResponse(
    userId: string,
    question: string,
    userResponse: string,
    context?: ConversationContext,
  ): Promise<KnowledgeItem> {
    return LearningService.learnFromUserResponse(userId, question, userResponse, context);
  }

  /**
   * Learn from successful conversation outcomes
   */
  async learnFromConversation(
    userId: string,
    conversationMessages: ConversationMessage[],
    outcome: 'success' | 'failure',
    outcomeDetails?: string,
  ): Promise<KnowledgeItem[]> {
    return LearningService.learnFromConversation(userId, conversationMessages, outcome, outcomeDetails);
  }

  /**
   * Search knowledge base with semantic similarity
   */
  async searchKnowledge(
    userId: string,
    query: string,
    filters?: {
      type?: string;
      category?: string;
      minConfidence?: number;
      tags?: string[];
    },
  ): Promise<KnowledgeItem[]> {
    return EmbeddingService.searchKnowledge(userId, query, filters);
  }

  /**
   * Get all knowledge for a user
   * Gets knowledge from users/{userId}/knowledge subcollection (includes onboarding data)
   */
  async getUserKnowledge(userId: string): Promise<KnowledgeItem[]> {
    try {
      // Get knowledge from user's knowledge subcollection
      const agentKnowledge = await KnowledgeService.getUserKnowledge(userId);

      console.log(`📚 Knowledge loaded: ${agentKnowledge.length} items from users/${userId}/knowledge`);
      return agentKnowledge;
    } catch (error) {
      console.error('Failed to get user knowledge:', error);
      // Fallback to empty array
      return [];
    }
  }

  /**
   * Update knowledge item
   */
  async updateKnowledgeItem(
    knowledgeId: string,
    updates: Partial<KnowledgeItem>,
  ): Promise<void> {
    // Regenerate embedding if content changed
    if (updates.content) {
      const item = await KnowledgeService.getKnowledgeItem(knowledgeId);
      if (item) {
        const embedding = await EmbeddingService.generateEmbedding(
          `${updates.content.title} ${updates.content.answer}`,
          item.userId,
        );
        updates.embedding = embedding;
      }
    }

    return KnowledgeService.updateKnowledgeItem(knowledgeId, updates);
  }

  /**
   * Mark knowledge as validated/effective
   */
  async markKnowledgeEffective(
    knowledgeId: string,
    effectiveness: number,
  ): Promise<void> {
    return KnowledgeService.markKnowledgeEffective(knowledgeId, effectiveness);
  }

  /**
   * Sync knowledge from UI knowledge base items to agent knowledge base
   */
  async syncFromUserKnowledge(userId: string): Promise<void> {
    return LearningService.syncFromUserKnowledge(userId);
  }

  /**
   * Import knowledge from external sources
   */
  async importKnowledge(
    userId: string,
    agentId: string,
    source: string,
    knowledgeData: any[],
  ): Promise<KnowledgeItem[]> {
    return LearningService.importKnowledge(userId, agentId, source, knowledgeData);
  }

  /**
   * Get a specific knowledge item by ID
   */
  async getKnowledgeItem(knowledgeId: string): Promise<KnowledgeItem | null> {
    return KnowledgeService.getKnowledgeItem(knowledgeId);
  }

  /**
   * Delete knowledge item
   */
  async deleteKnowledgeItem(knowledgeId: string): Promise<void> {
    return KnowledgeService.deleteKnowledgeItem(knowledgeId);
  }

  /**
   * Find similar knowledge items
   */
  async findSimilarKnowledge(
    knowledgeId: string,
    limit: number = 5,
  ): Promise<KnowledgeItem[]> {
    return EmbeddingService.findSimilarKnowledge(knowledgeId, limit);
  }

  /**
   * Clear knowledge cache for user
   */
  clearUserCache(userId: string): void {
    KnowledgeService.clearUserCache(userId);
    EmbeddingService.clearEmbeddingCache();
  }

  /**
   * Clear all knowledge cache
   */
  clearAllCache(): void {
    KnowledgeService.clearAllCache();
    EmbeddingService.clearEmbeddingCache();
  }
}

export default new KnowledgeBaseService();