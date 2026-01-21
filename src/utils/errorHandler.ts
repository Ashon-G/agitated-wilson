/**
 * Centralized error handling utility
 * Provides user-friendly error messages and logging
 */

import { toastManager } from './toastManager';

export type ErrorCategory =
  | 'network'
  | 'authentication'
  | 'permission'
  | 'validation'
  | 'storage'
  | 'integration'
  | 'unknown';

export interface ErrorContext {
  category: ErrorCategory;
  operation: string;
  userMessage?: string;
  technicalMessage?: string;
  showToast?: boolean;
  retryable?: boolean;
}

/**
 * Get user-friendly error message based on error type
 */
export function getUserFriendlyMessage(error: any, context: ErrorContext): string {
  if (context.userMessage) {
    return context.userMessage;
  }

  // Network errors
  if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
    return 'Unable to connect. Please check your internet connection.';
  }

  // Authentication errors
  if (error?.status === 401 || error?.status === 403) {
    return 'Session expired. Please sign in again.';
  }

  // Permission errors
  if (error?.message?.includes('permission') || error?.status === 403) {
    return 'Permission denied. Please check your account permissions.';
  }

  // Rate limiting
  if (error?.status === 429) {
    return 'Too many requests. Please try again in a moment.';
  }

  // Server errors
  if (error?.status >= 500) {
    return 'Server error. Please try again later.';
  }

  // Storage errors
  if (context.category === 'storage') {
    return 'Unable to save data. Please check storage permissions.';
  }

  // Integration errors
  if (context.category === 'integration') {
    return `Unable to connect to ${context.operation}. Please try reconnecting.`;
  }

  // Default messages by category
  const categoryMessages: Record<ErrorCategory, string> = {
    network: 'Connection failed. Please try again.',
    authentication: 'Authentication failed. Please sign in again.',
    permission: 'Permission denied. Please check your settings.',
    validation: 'Invalid input. Please check your data.',
    storage: 'Failed to save. Please try again.',
    integration: 'Integration failed. Please try reconnecting.',
    unknown: 'Something went wrong. Please try again.',
  };

  return categoryMessages[context.category] || categoryMessages.unknown;
}

/**
 * Handle errors with centralized logging and user feedback
 */
export function handleError(error: any, context: ErrorContext): void {
  const userMessage = getUserFriendlyMessage(error, context);

  // Log error for debugging (only in development, and only if it's a real error)
  if (__DEV__ && error) {
    // Use console.warn instead of console.error to reduce noise
    console.warn(`[${context.category}] ${context.operation}:`, {
      error: error?.message || error,
      technical: context.technicalMessage,
    });
    // Only log stack for unexpected errors
    if (context.category === 'unknown' && error?.stack) {
      console.debug('Stack trace:', error.stack);
    }
  }

  // Show feedback if enabled (default true)
  if (context.showToast !== false) {
    toastManager.error(userMessage, 5000);
  }
}

/**
 * Execute an operation with automatic error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    handleError(error, context);
    return null;
  }
}

/**
 * Parse Firebase/Firestore errors into user-friendly messages
 */
export function parseFirebaseError(error: any): string {
  const code = error?.code || '';

  const firebaseMessages: Record<string, string> = {
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'permission-denied': 'You do not have permission to perform this action.',
    'not-found': 'The requested resource was not found.',
    'already-exists': 'This resource already exists.',
    'resource-exhausted': 'Quota exceeded. Please try again later.',
    unauthenticated: 'Please sign in to continue.',
  };

  return firebaseMessages[code] || error?.message || 'An error occurred.';
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  // Network errors
  if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
    return true;
  }

  // Timeout errors
  if (error?.message?.includes('timeout')) {
    return true;
  }

  // Server errors (5xx)
  if (error?.status >= 500) {
    return true;
  }

  // Rate limiting
  if (error?.status === 429) {
    return true;
  }

  return false;
}
