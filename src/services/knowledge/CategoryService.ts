/**
 * Knowledge Category Service
 *
 * Manages knowledge categories for organizing knowledge items.
 * Categories provide a hierarchical structure for better organization and scalability.
 *
 * @version 1.0.0
 */

import BackendService from '../BackendService';
import { KnowledgeCategory, DEFAULT_KNOWLEDGE_CATEGORIES } from '../../types/agent';

class CategoryService {
  private categoryCache: Map<string, KnowledgeCategory[]> = new Map();

  /**
   * Initialize default categories for a new user
   */
  async initializeDefaultCategories(userId: string): Promise<KnowledgeCategory[]> {
    try {
      console.log(`Initializing default categories for user: ${userId}`);

      const categories: KnowledgeCategory[] = [];

      for (const defaultCategory of DEFAULT_KNOWLEDGE_CATEGORIES) {
        const category: KnowledgeCategory = {
          id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          ...defaultCategory,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await this.saveCategory(userId, category);
        categories.push(category);
      }

      // Update cache
      this.categoryCache.set(userId, categories);

      console.log(`✅ Initialized ${categories.length} default categories`);
      return categories;
    } catch (error) {
      console.error('Failed to initialize default categories:', error);
      throw error;
    }
  }

  /**
   * Get all categories for a user
   */
  async getUserCategories(userId: string): Promise<KnowledgeCategory[]> {
    try {
      // Check cache first
      const cached = this.categoryCache.get(userId);
      if (cached) {
        return cached;
      }

      // Load from Firestore
      const categories = await this.loadUserCategories(userId);

      // If no categories exist, initialize defaults
      if (categories.length === 0) {
        return await this.initializeDefaultCategories(userId);
      }

      // Update cache
      this.categoryCache.set(userId, categories);

      return categories;
    } catch (error) {
      console.error('Failed to get user categories:', error);
      return [];
    }
  }

  /**
   * Get a specific category by ID
   */
  async getCategory(userId: string, categoryId: string): Promise<KnowledgeCategory | null> {
    try {
      // Use users/{userId}/knowledgeCategories (3 segments = valid collection path)
      const path = `users/${userId}/knowledgeCategories`;
      return await BackendService.getDocument<KnowledgeCategory>(path, categoryId);
    } catch {
      return null;
    }
  }

  /**
   * Create a new category
   */
  async createCategory(
    userId: string,
    categoryData: Omit<KnowledgeCategory, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'itemCount'>,
  ): Promise<KnowledgeCategory> {
    try {
      const category: KnowledgeCategory = {
        id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        ...categoryData,
        itemCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.saveCategory(userId, category);

      // Update cache
      const userCategories = this.categoryCache.get(userId) || [];
      userCategories.push(category);
      this.categoryCache.set(userId, userCategories);

      console.log(`Category created: ${category.name}`);
      return category;
    } catch (error) {
      console.error('Failed to create category:', error);
      throw error;
    }
  }

  /**
   * Update a category
   */
  async updateCategory(
    userId: string,
    categoryId: string,
    updates: Partial<KnowledgeCategory>,
  ): Promise<void> {
    try {
      const category = await this.getCategory(userId, categoryId);
      if (!category) throw new Error('Category not found');

      const updatedCategory = {
        ...category,
        ...updates,
        updatedAt: new Date(),
      };

      await this.saveCategory(userId, updatedCategory);

      // Update cache
      const userCategories = this.categoryCache.get(userId);
      if (userCategories) {
        const index = userCategories.findIndex(c => c.id === categoryId);
        if (index !== -1) {
          userCategories[index] = updatedCategory;
        }
      }

      console.log(`Category updated: ${updatedCategory.name}`);
    } catch (error) {
      console.error('Failed to update category:', error);
      throw error;
    }
  }

  /**
   * Delete a category (only if empty or not default)
   */
  async deleteCategory(userId: string, categoryId: string): Promise<void> {
    try {
      const category = await this.getCategory(userId, categoryId);
      if (!category) return;

      // Prevent deleting default categories
      if (category.isDefault) {
        throw new Error('Cannot delete default categories');
      }

      // Prevent deleting categories with items
      if (category.itemCount > 0) {
        throw new Error('Cannot delete categories with items. Move or delete items first.');
      }

      // Use users/{userId}/knowledgeCategories (3 segments = valid collection path)
      const path = `users/${userId}/knowledgeCategories`;
      await BackendService.deleteDocument(path, categoryId);

      // Update cache
      const userCategories = this.categoryCache.get(userId);
      if (userCategories) {
        const filtered = userCategories.filter(c => c.id !== categoryId);
        this.categoryCache.set(userId, filtered);
      }

      console.log(`Category deleted: ${category.name}`);
    } catch (error) {
      console.error('Failed to delete category:', error);
      throw error;
    }
  }

  /**
   * Increment category item count
   */
  async incrementCategoryItemCount(userId: string, categoryId: string): Promise<void> {
    try {
      const category = await this.getCategory(userId, categoryId);
      if (!category) return;

      await this.updateCategory(userId, categoryId, {
        itemCount: category.itemCount + 1,
      });
    } catch (error) {
      console.error('Failed to increment category item count:', error);
    }
  }

  /**
   * Decrement category item count
   */
  async decrementCategoryItemCount(userId: string, categoryId: string): Promise<void> {
    try {
      const category = await this.getCategory(userId, categoryId);
      if (!category) return;

      await this.updateCategory(userId, categoryId, {
        itemCount: Math.max(0, category.itemCount - 1),
      });
    } catch (error) {
      console.error('Failed to decrement category item count:', error);
    }
  }

  /**
   * Get category by name (case-insensitive)
   */
  async getCategoryByName(userId: string, name: string): Promise<KnowledgeCategory | null> {
    try {
      const categories = await this.getUserCategories(userId);
      return categories.find(c => c.name.toLowerCase() === name.toLowerCase()) || null;
    } catch {
      return null;
    }
  }

  /**
   * Save category to Firestore
   */
  private async saveCategory(userId: string, category: KnowledgeCategory): Promise<void> {
    // Use users/{userId}/knowledgeCategories (3 segments = valid collection path)
    const path = `users/${userId}/knowledgeCategories`;
    await BackendService.setDocument(path, category.id, category);
  }

  /**
   * Load user categories from Firestore
   */
  private async loadUserCategories(userId: string): Promise<KnowledgeCategory[]> {
    try {
      // Use users/{userId}/knowledgeCategories (3 segments = valid collection path)
      const path = `users/${userId}/knowledgeCategories`;
      const categories = await BackendService.queryCollection<KnowledgeCategory>(path, {});

      // Sort by order
      return categories.sort((a, b) => a.order - b.order);
    } catch (error) {
      console.error('Failed to load user categories:', error);
      return [];
    }
  }

  /**
   * Clear category cache for user
   */
  clearUserCache(userId: string): void {
    this.categoryCache.delete(userId);
  }

  /**
   * Clear all category cache
   */
  clearAllCache(): void {
    this.categoryCache.clear();
  }
}

export default new CategoryService();
