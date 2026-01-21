/**
 * Learning Service
 *
 * Handles learning from user responses, conversations, and external sources.
 * Separated from KnowledgeBaseService for better maintainability.
 *
 * @version 1.0.0
 * @author PaynaAI Team
 */

import KnowledgeService from './KnowledgeService';
import BackendService from '../BackendService';
import {
  KnowledgeItem,
  ConversationContext,
  ConversationMessage,
} from '../../types/agent';

class LearningService {
  /**
   * Learn from user response to agent question
   */
  async learnFromUserResponse(
    userId: string,
    question: string,
    userResponse: string,
    context?: ConversationContext,
  ): Promise<KnowledgeItem> {
    try {
      // Determine the best knowledge type and category
      const knowledgeType = this.categorizeUserResponse(userResponse);
      const category = this.extractCategory(question, context);

      // Create knowledge item from user teaching
      const knowledgeData = {
        type: knowledgeType as 'faq' | 'product_info' | 'objection_handling' | 'sales_script' | 'case_study' | 'competitor_info',
        category,
        content: {
          title: this.generateKnowledgeTitle(question, userResponse),
          question,
          answer: userResponse,
          context: context ? this.summarizeContext(context) : undefined,
          examples: this.extractExamples(userResponse),
          relatedQuestions: this.generateRelatedQuestions(question, userResponse),
        },
        source: 'user_taught' as const,
        confidence: 0.95, // High confidence for direct user teaching
        tags: this.extractTags(question, userResponse, context),
      };

      const agentId = await this.getAgentId(userId);
      return await KnowledgeService.addKnowledgeItem(userId, agentId, knowledgeData);
    } catch (error) {
      console.error('Failed to learn from user response:', error);
      throw error;
    }
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
    try {
      const learnedItems: KnowledgeItem[] = [];

      // Extract successful patterns from the conversation
      if (outcome === 'success') {
        const successfulResponses = conversationMessages.filter(
          msg => msg.type === 'agent' && msg.userFeedback?.rating === 'good',
        );

        for (const response of successfulResponses) {
          if (response.intent) {
            const knowledgeData = {
              type: 'sales_script' as const,
              category: response.intent,
              content: {
                title: `Successful ${response.intent} response`,
                question: `How to handle ${response.intent}?`,
                answer: response.content,
                context: 'Used successfully in conversation',
                examples: [response.content],
              },
              source: 'conversation_learned' as const,
              confidence: 0.8,
              tags: [response.intent, 'successful', 'tested'],
            };

            const agentId = await this.getAgentId(userId);
            const learned = await KnowledgeService.addKnowledgeItem(userId, agentId, knowledgeData);
            learnedItems.push(learned);
          }
        }
      }

      // Learn from objections and how they were handled
      const objections = this.extractObjections(conversationMessages);
      for (const objection of objections) {
        const handling = this.findObjectionHandling(conversationMessages, objection);
        if (handling) {
          const knowledgeData = {
            type: 'objection_handling' as const,
            category: 'objections',
            content: {
              title: `Handle: ${objection.objection}`,
              question: objection.objection,
              answer: handling.response,
              context: 'Learned from conversation',
              examples: [handling.response],
            },
            source: 'conversation_learned' as const,
            confidence: outcome === 'success' ? 0.8 : 0.6,
            tags: ['objection', 'handling', objection.type],
          };

          const agentId = await this.getAgentId(userId);
          const learned = await KnowledgeService.addKnowledgeItem(userId, agentId, knowledgeData);
          learnedItems.push(learned);
        }
      }

      return learnedItems;
    } catch (error) {
      console.error('Failed to learn from conversation:', error);
      return [];
    }
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
    try {
      const imported: KnowledgeItem[] = [];

      for (const data of knowledgeData) {
        const knowledgeItem = {
          type: (data.type || 'faq') as 'faq' | 'product_info' | 'objection_handling' | 'sales_script' | 'case_study' | 'competitor_info',
          category: data.category || 'general',
          content: {
            title: data.title,
            question: data.question,
            answer: data.answer,
            context: `Imported from ${source}`,
            examples: data.examples || [],
            relatedQuestions: data.relatedQuestions || [],
          },
          source: 'imported' as const,
          confidence: data.confidence || 0.7,
          tags: [...(data.tags || []), source, 'imported'],
        };

        const importedItem = await KnowledgeService.addKnowledgeItem(userId, agentId, knowledgeItem);
        imported.push(importedItem);
      }

      return imported;
    } catch (error) {
      console.error('Failed to import knowledge:', error);
      return [];
    }
  }

  /**
   * Sync knowledge from UI knowledge base items to agent knowledge base
   * This is now a NO-OP to prevent duplicate creation.
   * The UI knowledge items (users/{userId}/knowledge) are already the source of truth.
   * There's no need to sync them to a separate "agent knowledge base".
   */
  async syncFromUserKnowledge(userId: string): Promise<void> {
    // NO-OP: This function was causing infinite loops and duplicate creation.
    // The UI knowledge items are already accessible to the agent via KnowledgeService.getUserKnowledge()
    // No syncing to a separate location is needed.
    console.log(`syncFromUserKnowledge: Skipping sync for user ${userId} (disabled to prevent duplicates)`);
  }

  // Helper methods for learning and categorization

  private categorizeUserResponse(response: string): string {
    const lowerResponse = response.toLowerCase();

    if (lowerResponse.includes('price') || lowerResponse.includes('cost') || lowerResponse.includes('$')) {
      return 'pricing';
    }
    if (lowerResponse.includes('feature') || lowerResponse.includes('functionality')) {
      return 'features';
    }
    if (lowerResponse.includes('competitor') || lowerResponse.includes('alternative')) {
      return 'competitive';
    }
    if (lowerResponse.includes('industry') || lowerResponse.includes('market')) {
      return 'market';
    }

    return 'general';
  }

  private extractCategory(question: string, context?: ConversationContext): string {
    if (context && context.agentIntent) {
      return context.agentIntent;
    }

    const lowerQuestion = question.toLowerCase();
    if (lowerQuestion.includes('what') || lowerQuestion.includes('how')) {
      return 'faq';
    }
    if (lowerQuestion.includes('why')) {
      return 'value_proposition';
    }

    return 'general';
  }

  private generateKnowledgeTitle(question: string, response: string): string {
    const words = question.split(' ').slice(0, 4).join(' ');
    return `${words}...`;
  }

  private summarizeContext(context: ConversationContext): string {
    return `Context: ${context.agentIntent || 'general'} conversation`;
  }

  private extractExamples(response: string): string[] {
    // Simple extraction - look for quoted text or examples
    const examples: string[] = [];
    const quotedMatches = response.match(/"([^"]+)"/g);
    if (quotedMatches) {
      examples.push(...quotedMatches.map(match => match.replace(/"/g, '')));
    }
    return examples;
  }

  private generateRelatedQuestions(question: string, response: string): string[] {
    // Generate related questions based on the original question
    const related: string[] = [];
    const lowerQuestion = question.toLowerCase();

    if (lowerQuestion.includes('what')) {
      related.push(question.replace('what', 'how'));
      related.push(question.replace('what', 'why'));
    }

    return related.slice(0, 3); // Limit to 3 related questions
  }

  private extractTags(question: string, response: string, context?: ConversationContext): string[] {
    const tags: string[] = [];

    // Extract from question
    const questionWords = question.toLowerCase().split(' ');
    tags.push(...questionWords.filter(word => word.length > 3).slice(0, 3));

    // Extract from response
    const responseWords = response.toLowerCase().split(' ');
    tags.push(...responseWords.filter(word => word.length > 4).slice(0, 2));

    // Add context tags
    if (context && context.agentIntent) {
      tags.push(context.agentIntent);
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  private extractObjections(messages: ConversationMessage[]): Array<{ objection: string; type: string }> {
    const objections: Array<{ objection: string; type: string }> = [];

    for (const message of messages) {
      if (message.type === 'user' && message.content.toLowerCase().includes('but')) {
        objections.push({
          objection: message.content,
          type: 'concern',
        });
      }
    }

    return objections;
  }

  private findObjectionHandling(
    messages: ConversationMessage[],
    objection: { objection: string; type: string },
  ): { response: string } | null {
    const objectionIndex = messages.findIndex(msg => msg.content === objection.objection);
    if (objectionIndex !== -1 && objectionIndex < messages.length - 1) {
      const nextMessage = messages[objectionIndex + 1];
      if (nextMessage.type === 'agent') {
        return { response: nextMessage.content };
      }
    }
    return null;
  }

  private mapUITypeToAgentType(uiType: string): 'faq' | 'objection_handling' | 'product_info' | 'competitor_info' | 'case_study' | 'sales_script' {
    const mapping: Record<string, 'faq' | 'objection_handling' | 'product_info' | 'competitor_info' | 'case_study' | 'sales_script'> = {
      website: 'product_info',
      product: 'product_info',
      pricing: 'product_info',
      faq: 'faq',
      testimonial: 'case_study',
    };

    return mapping[uiType] || 'product_info';
  }

  private categorizeUIContent(uiItem: any): string {
    if (uiItem.url) return 'external_resource';
    if (uiItem.description && uiItem.description.length > 100) return 'detailed_info';
    return 'general';
  }

  private generateQuestionFromUIItem(uiItem: any): string {
    if (uiItem.question) return uiItem.question;
    return `What is ${uiItem.title}?`;
  }

  private extractAnswerFromUIItem(uiItem: any): string {
    if (uiItem.answer) return uiItem.answer;
    if (uiItem.description) return uiItem.description;
    if (uiItem.content) return uiItem.content;
    return uiItem.title;
  }

  private async getAgentId(userId: string): Promise<string> {
    // This would typically fetch the user's agent ID
    // For now, return a default agent ID
    return `agent_${userId}`;
  }
}

export default new LearningService();
