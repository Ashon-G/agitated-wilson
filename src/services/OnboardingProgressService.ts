/**
 * Onboarding Progress Service
 * Handles saving and loading onboarding progress to/from Firestore
 * Allows users to resume onboarding from where they left off
 */

import BackendService from './BackendService';
import { OnboardingProgress } from '../types/app';

const COLLECTION = 'onboarding_progress';

export default class OnboardingProgressService {
  /**
   * Save onboarding progress to Firestore
   * Called after every step to ensure progress is persisted
   */
  static async saveProgress(progress: OnboardingProgress): Promise<void> {
    try {
      console.log('💾 Saving onboarding progress to Firestore:', {
        userId: progress.userId,
        currentStep: progress.currentStep,
        completedSteps: progress.completedSteps,
      });

      await BackendService.setDocument<OnboardingProgress>(
        COLLECTION,
        progress.userId,
        {
          ...progress,
          updatedAt: new Date(),
        },
      );

      console.log('✅ Onboarding progress saved successfully');
    } catch (error) {
      console.error('❌ Failed to save onboarding progress:', error);
      // Don't throw - we want onboarding to continue even if save fails
    }
  }

  /**
   * Load onboarding progress from Firestore
   * Returns null if no progress found or user hasn't started onboarding
   */
  static async loadProgress(userId: string): Promise<OnboardingProgress | null> {
    try {
      console.log('🔍 Loading onboarding progress for user:', userId);

      const progress = await BackendService.getDocument<OnboardingProgress>(
        COLLECTION,
        userId,
      );

      if (progress) {
        console.log('✅ Onboarding progress loaded:', {
          currentStep: progress.currentStep,
          completedSteps: progress.completedSteps,
          isCompleted: progress.isCompleted,
        });
        return progress;
      } else {
        console.log('ℹ️ No saved onboarding progress found');
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to load onboarding progress:', error);
      return null;
    }
  }

  /**
   * Delete onboarding progress from Firestore
   * Called after onboarding is completed
   */
  static async deleteProgress(userId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting onboarding progress for user:', userId);
      await BackendService.deleteDocument(COLLECTION, userId);
      console.log('✅ Onboarding progress deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete onboarding progress:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Check if user has incomplete onboarding
   */
  static async hasIncompleteOnboarding(userId: string): Promise<boolean> {
    try {
      const progress = await this.loadProgress(userId);
      return progress !== null && !progress.isCompleted;
    } catch (error) {
      console.error('❌ Failed to check onboarding status:', error);
      return false;
    }
  }
}
