import React, { useEffect, useState, useCallback } from 'react';
import { toastManager, ToastConfig } from '../utils/toastManager';
import Toast from './Toast';

/**
 * FeedbackContainer - Container that listens to toastManager events
 * and renders Toast components for feedback notifications
 */
export default function FeedbackContainer() {
  const [toasts, setToasts] = useState<ToastConfig[]>([]);

  useEffect(() => {
    // Subscribe to new toast events
    const unsubscribe = toastManager.subscribe((toast) => {
      setToasts((prev) => [...prev, toast]);
    });

    // Subscribe to dismiss events
    const unsubscribeDismiss = toastManager.subscribeToDismiss((id) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    });

    return () => {
      unsubscribe();
      unsubscribeDismiss();
    };
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Only show the most recent toast
  const currentToast = toasts[toasts.length - 1];

  if (!currentToast) {
    return null;
  }

  return <Toast toast={currentToast} onDismiss={handleDismiss} />;
}
