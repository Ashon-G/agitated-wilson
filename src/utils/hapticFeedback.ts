/**
 * Haptic Feedback Utility
 * Provides consistent haptic feedback patterns throughout the application
 */

import * as Haptics from 'expo-haptics';

export const hapticFeedback = {
  /**
   * Light impact - Basic UI interactions (taps, selections, toggles)
   */
  light: () => Haptics.selectionAsync(),

  /**
   * Medium impact - Important actions (save, pause, confirm)
   */
  medium: () => Haptics.selectionAsync(),

  /**
   * Heavy impact - Critical/destructive actions (delete, stop, clear all)
   */
  heavy: () => Haptics.selectionAsync(),

  /**
   * Selection - Subtle feedback for picker/tab changes
   */
  selection: () => Haptics.selectionAsync(),

  /**
   * Success notification - Successful operations
   */
  success: () => Haptics.selectionAsync(),

  /**
   * Warning notification - Alerts and informational messages
   */
  warning: () => Haptics.selectionAsync(),

  /**
   * Error notification - Failed operations
   */
  error: () => Haptics.selectionAsync(),
};
