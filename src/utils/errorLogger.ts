/**
 * Safe error logging utilities that avoid React Native console.error circular dependencies
 */

interface ErrorDetails {
  error: Error;
  context?: string;
  errorInfo?: any;
  extra?: Record<string, any>;
}

/**
 * Safely log errors without triggering React Native's ExceptionsManager
 * This prevents the circular dependency that can cause stack overflow in ErrorBoundary
 */
export const safeErrorLog = ({ error, context, errorInfo, extra }: ErrorDetails) => {
  if (!__DEV__) return;

  // Use setTimeout to break synchronous error cycle
  setTimeout(() => {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}] ` : '';
    const errorMessage = `🔴 ${contextStr}${error.name}: ${error.message}`;

    // Log basic error info using console.log to avoid ExceptionsManager
    console.log(`${timestamp} ${errorMessage}`);

    // Log stack trace (truncated to avoid overwhelming output)
    if (error.stack) {
      console.log(`Stack: ${error.stack.slice(0, 500)}${error.stack.length > 500 ? '...' : ''}`);
    }

    // Log component stack if available (from React error boundaries)
    if (errorInfo?.componentStack) {
      console.log(`Component Stack: ${errorInfo.componentStack.slice(0, 300)}${errorInfo.componentStack.length > 300 ? '...' : ''}`);
    }

    // Log any extra context
    if (extra && Object.keys(extra).length > 0) {
      console.log('Additional context:', JSON.stringify(extra, null, 2));
    }

    console.log('---'); // Separator for readability
  }, 0);
};

/**
 * Safe warning logger
 */
export const safeWarnLog = (message: string, context?: string, extra?: Record<string, any>) => {
  if (!__DEV__) return;

  setTimeout(() => {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}] ` : '';
    console.log(`${timestamp} 🟡 ${contextStr}${message}`);

    if (extra && Object.keys(extra).length > 0) {
      console.log('Context:', JSON.stringify(extra, null, 2));
    }
  }, 0);
};

/**
 * Safe info logger for debugging
 */
export const safeInfoLog = (message: string, context?: string, data?: any) => {
  if (!__DEV__) return;

  setTimeout(() => {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}] ` : '';
    console.log(`${timestamp} ℹ️ ${contextStr}${message}`);

    if (data !== undefined) {
      console.log('Data:', typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
    }
  }, 0);
};