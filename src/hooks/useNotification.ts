import { useCallback } from 'react';
import { toastManager } from '../utils/toastManager';
import { hapticFeedback } from '../utils/hapticFeedback';

/**
 * Hook for showing notifications with consistent haptic feedback
 * Wraps toastManager with additional convenience methods
 *
 * Usage:
 * const { notify, success, error, withLoading } = useNotification();
 *
 * // Simple notifications
 * success('Saved!');
 * error('Something went wrong');
 *
 * // Async operations with loading state
 * await withLoading(async () => {
 *   await saveData();
 * }, { success: 'Saved!', error: 'Failed to save' });
 */
export function useNotification() {
  const success = useCallback((message: string, duration?: number) => {
    return toastManager.success(message, duration);
  }, []);

  const error = useCallback((message: string, duration?: number) => {
    return toastManager.error(message, duration);
  }, []);

  const info = useCallback((message: string, duration?: number) => {
    return toastManager.info(message, duration);
  }, []);

  const warning = useCallback((message: string, duration?: number) => {
    return toastManager.warning(message, duration);
  }, []);

  /**
   * Execute an async operation with automatic toast notifications
   * Shows success message on completion, error message on failure
   */
  const withLoading = useCallback(
    async <T>(
      operation: () => Promise<T>,
      messages: {
        success?: string;
        error?: string;
        loading?: string;
      } = {},
    ): Promise<T | null> => {
      let loadingToastId: string | undefined;

      try {
        if (messages.loading) {
          loadingToastId = toastManager.info(messages.loading, undefined);
        }

        const result = await operation();

        if (loadingToastId) {
          toastManager.dismiss(loadingToastId);
        }

        if (messages.success) {
          toastManager.success(messages.success);
        }

        return result;
      } catch (err) {
        if (loadingToastId) {
          toastManager.dismiss(loadingToastId);
        }

        const errorMessage =
          messages.error ||
          (err instanceof Error ? err.message : 'Something went wrong');
        toastManager.error(errorMessage);

        return null;
      }
    },
    [],
  );

  /**
   * Trigger haptic feedback without a toast
   */
  const haptic = useCallback(
    (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' | 'selection' = 'light') => {
      hapticFeedback[type]();
    },
    [],
  );

  return {
    success,
    error,
    info,
    warning,
    withLoading,
    haptic,
    // Direct access to toast manager for advanced usage
    toast: toastManager,
  };
}
