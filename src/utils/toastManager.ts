/**
 * Toast Manager
 * Event-based toast notification system with haptic feedback
 */

import { hapticFeedback } from './hapticFeedback';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastConfig {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // ms, undefined = persistent
  action?: {
    label: string;
    onPress: () => void;
  };
}

type ToastListener = (toast: ToastConfig) => void;
type DismissListener = (id: string) => void;

class ToastManager {
  private listeners: ToastListener[] = [];
  private dismissListeners: DismissListener[] = [];
  private toastCounter = 0;

  /**
   * Subscribe to toast events
   */
  subscribe(listener: ToastListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Subscribe to dismiss events
   */
  subscribeToDismiss(listener: DismissListener): () => void {
    this.dismissListeners.push(listener);
    return () => {
      this.dismissListeners = this.dismissListeners.filter(l => l !== listener);
    };
  }

  /**
   * Show a toast notification
   */
  show(config: Omit<ToastConfig, 'id'>): string {
    const id = `toast-${Date.now()}-${this.toastCounter++}`;
    const toast: ToastConfig = {
      id,
      duration: 3000, // Default 3 seconds
      ...config,
    };

    this.listeners.forEach(listener => listener(toast));
    return id;
  }

  /**
   * Dismiss a toast by ID
   */
  dismiss(id: string): void {
    this.dismissListeners.forEach(listener => listener(id));
  }

  /**
   * Convenience methods with haptic feedback
   */
  success(message: string, duration?: number): string {
    hapticFeedback.success();
    return this.show({ message, type: 'success', duration });
  }

  error(message: string, duration?: number): string {
    hapticFeedback.error();
    return this.show({ message, type: 'error', duration });
  }

  info(message: string, duration?: number): string {
    hapticFeedback.warning();
    return this.show({ message, type: 'info', duration });
  }

  warning(message: string, duration?: number): string {
    hapticFeedback.warning();
    return this.show({ message, type: 'warning', duration });
  }
}

// Singleton instance
export const toastManager = new ToastManager();

// Export convenience functions
export const showToast = toastManager.show.bind(toastManager);
export const dismissToast = toastManager.dismiss.bind(toastManager);
