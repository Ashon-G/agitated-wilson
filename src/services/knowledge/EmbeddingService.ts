/**
 * Embedding Service
 *
 * Handles embedding generation, semantic search, and similarity calculations.
 * Separated from KnowledgeBaseService for better maintainability.
 *
 * @version 1.0.0
 * @author PaynaAI Team
 */

import KnowledgeService from './KnowledgeService';
import {
  KnowledgeItem,
} from '../../types/agent';

class EmbeddingService {
  private embeddingsCache: Map<string, number[]> = new Map();

  /**
   * Generate embedding for knowledge item
   */
  async generateEmbedding(
    text: string,
    userId: string,
  ): Promise<number[]> {
    try {
      // This feature requires GeminiService integration for embeddings generation
      console.warn('Embeddings generation requires GeminiService integration');

      // Return a placeholder embedding
      return new Array(768).fill(0).map(() => Math.random());
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
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
    try {
      let knowledge = await KnowledgeService.getUserKnowledge(userId);

      // Apply filters
      if (filters) {
        if (filters.type) {
          knowledge = knowledge.filter(item => item.type === filters.type);
        }
        if (filters.category) {
          knowledge = knowledge.filter(item => item.category === filters.category);
        }
        if (filters.minConfidence) {
          knowledge = knowledge.filter(item => item.confidence >= filters.minConfidence!);
        }
        if (filters.tags && filters.tags.length > 0) {
          knowledge = knowledge.filter(item =>
            filters.tags!.some(tag => item.tags.includes(tag)),
          );
        }
      }

      // This feature requires GeminiService integration for semantic search
      console.warn('Semantic search requires GeminiService integration');

      // Fallback to simple text matching
      const queryLower = query.toLowerCase();
      const results = knowledge.filter(item => {
        const content = `${item.content.title} ${item.content.answer || ''}`.toLowerCase();
        return content.includes(queryLower);
      });

      // Update usage statistics for returned items
      for (const item of results.slice(0, 5)) { // Top 5 results
        await KnowledgeService.updateKnowledgeUsage(item.id);
      }

      return results;
    } catch (error) {
      console.error('Knowledge search failed:', error);
      return [];
    }
  }

  /**
   * Find similar knowledge items
   */
  async findSimilarKnowledge(
    knowledgeId: string,
    limit: number = 5,
  ): Promise<KnowledgeItem[]> {
    try {
      const targetItem = await KnowledgeService.getKnowledgeItem(knowledgeId);
      if (!targetItem || !targetItem.embedding) {
        return [];
      }

      const allKnowledge = await KnowledgeService.getUserKnowledge(targetItem.userId);
      const similarItems: Array<{ item: KnowledgeItem; similarity: number }> = [];

      for (const item of allKnowledge) {
        if (item.id === knowledgeId || !item.embedding) continue;

        const similarity = this.calculateSimilarity(targetItem.embedding, item.embedding);
        if (similarity > 0.7) { // Only include highly similar items
          similarItems.push({ item, similarity });
        }
      }

      // Sort by similarity and return top results
      return similarItems
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(({ item }) => item);
    } catch (error) {
      console.error('Failed to find similar knowledge:', error);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Update embedding for a knowledge item
   */
  async updateKnowledgeEmbedding(
    knowledgeId: string,
    text: string,
  ): Promise<void> {
    try {
      const item = await KnowledgeService.getKnowledgeItem(knowledgeId);
      if (!item) return;

      const embedding = await this.generateEmbedding(text, item.userId);

      await KnowledgeService.updateKnowledgeItem(knowledgeId, {
        embedding,
      });
    } catch (error) {
      console.error('Failed to update knowledge embedding:', error);
    }
  }

  /**
   * Batch generate embeddings for multiple knowledge items
   */
  async batchGenerateEmbeddings(
    knowledgeItems: Array<{ id: string; text: string; userId: string }>,
  ): Promise<Map<string, number[]>> {
    const embeddings = new Map<string, number[]>();

    try {
      // Process in batches to avoid overwhelming the API
      const batchSize = 10;
      for (let i = 0; i < knowledgeItems.length; i += batchSize) {
        const batch = knowledgeItems.slice(i, i + batchSize);

        const batchPromises = batch.map(async ({ id, text, userId }) => {
          const embedding = await this.generateEmbedding(text, userId);
          embeddings.set(id, embedding);
        });

        await Promise.all(batchPromises);
      }
    } catch (error) {
      console.error('Failed to batch generate embeddings:', error);
    }

    return embeddings;
  }

  /**
   * Clear embedding cache
   */
  clearEmbeddingCache(): void {
    this.embeddingsCache.clear();
  }

  /**
   * Get embedding cache statistics
   */
  getEmbeddingCacheStats(): { size: number; memoryUsage: number } {
    const cacheEntries = Array.from(this.embeddingsCache.entries());
    const memoryUsage = JSON.stringify(cacheEntries).length;

    return {
      size: this.embeddingsCache.size,
      memoryUsage,
    };
  }
}

export default new EmbeddingService();
