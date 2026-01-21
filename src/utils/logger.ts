/**
 * Centralized Logger Utility
 *
 * Provides consistent logging across the application with:
 * - Environment-aware logging (dev vs production)
 * - Log levels (debug, info, warn, error)
 * - Component/module tagging for easier filtering
 * - Consistent formatting
 *
 * @example
 * import { logger } from '../utils/logger';
 *
 * logger.debug('AuthStore', 'User signed in', { userId: user.uid });
 * logger.info('InboxStore', 'Loaded 10 items');
 * logger.warn('NetworkService', 'Request timed out, retrying...');
 * logger.error('PaymentService', 'Transaction failed', error);
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  /** Whether to include timestamps in logs */
  includeTimestamp?: boolean;
  /** Minimum log level to output */
  minLevel?: LogLevel;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Default options
const defaultOptions: LoggerOptions = {
  includeTimestamp: false,
  minLevel: __DEV__ ? 'debug' : 'warn',
};

/**
 * Format a log message with optional component tag
 */
function formatMessage(component: string, message: string): string {
  return `[${component}] ${message}`;
}

/**
 * Check if a log level should be output based on minimum level
 */
function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

/**
 * Create the logger instance
 */
function createLogger(options: LoggerOptions = defaultOptions) {
  const opts = { ...defaultOptions, ...options };

  return {
    /**
     * Debug level logging - only in development
     * Use for detailed diagnostic information
     */
    debug: (component: string, message: string, data?: unknown) => {
      if (!shouldLog('debug', opts.minLevel!)) return;
      const formattedMsg = formatMessage(component, message);
      if (data !== undefined) {
        console.log(`🔍 ${formattedMsg}`, data);
      } else {
        console.log(`🔍 ${formattedMsg}`);
      }
    },

    /**
     * Info level logging
     * Use for general operational information
     */
    info: (component: string, message: string, data?: unknown) => {
      if (!shouldLog('info', opts.minLevel!)) return;
      const formattedMsg = formatMessage(component, message);
      if (data !== undefined) {
        console.log(`ℹ️ ${formattedMsg}`, data);
      } else {
        console.log(`ℹ️ ${formattedMsg}`);
      }
    },

    /**
     * Warning level logging
     * Use for potentially problematic situations
     */
    warn: (component: string, message: string, data?: unknown) => {
      if (!shouldLog('warn', opts.minLevel!)) return;
      const formattedMsg = formatMessage(component, message);
      if (data !== undefined) {
        console.warn(`⚠️ ${formattedMsg}`, data);
      } else {
        console.warn(`⚠️ ${formattedMsg}`);
      }
    },

    /**
     * Error level logging
     * Use for error conditions
     */
    error: (component: string, message: string, error?: unknown) => {
      if (!shouldLog('error', opts.minLevel!)) return;
      const formattedMsg = formatMessage(component, message);
      if (error !== undefined) {
        console.error(`❌ ${formattedMsg}`, error);
      } else {
        console.error(`❌ ${formattedMsg}`);
      }
    },

    /**
     * Success logging - uses info level
     * Use for successful operations
     */
    success: (component: string, message: string, data?: unknown) => {
      if (!shouldLog('info', opts.minLevel!)) return;
      const formattedMsg = formatMessage(component, message);
      if (data !== undefined) {
        console.log(`✅ ${formattedMsg}`, data);
      } else {
        console.log(`✅ ${formattedMsg}`);
      }
    },

    /**
     * Create a scoped logger for a specific component
     * Reduces repetition when logging from the same component
     */
    scope: (component: string) => ({
      debug: (message: string, data?: unknown) => {
        if (!shouldLog('debug', opts.minLevel!)) return;
        const formattedMsg = formatMessage(component, message);
        if (data !== undefined) {
          console.log(`🔍 ${formattedMsg}`, data);
        } else {
          console.log(`🔍 ${formattedMsg}`);
        }
      },
      info: (message: string, data?: unknown) => {
        if (!shouldLog('info', opts.minLevel!)) return;
        const formattedMsg = formatMessage(component, message);
        if (data !== undefined) {
          console.log(`ℹ️ ${formattedMsg}`, data);
        } else {
          console.log(`ℹ️ ${formattedMsg}`);
        }
      },
      warn: (message: string, data?: unknown) => {
        if (!shouldLog('warn', opts.minLevel!)) return;
        const formattedMsg = formatMessage(component, message);
        if (data !== undefined) {
          console.warn(`⚠️ ${formattedMsg}`, data);
        } else {
          console.warn(`⚠️ ${formattedMsg}`);
        }
      },
      error: (message: string, error?: unknown) => {
        if (!shouldLog('error', opts.minLevel!)) return;
        const formattedMsg = formatMessage(component, message);
        if (error !== undefined) {
          console.error(`❌ ${formattedMsg}`, error);
        } else {
          console.error(`❌ ${formattedMsg}`);
        }
      },
      success: (message: string, data?: unknown) => {
        if (!shouldLog('info', opts.minLevel!)) return;
        const formattedMsg = formatMessage(component, message);
        if (data !== undefined) {
          console.log(`✅ ${formattedMsg}`, data);
        } else {
          console.log(`✅ ${formattedMsg}`);
        }
      },
    }),
  };
}

// Export the default logger instance
export const logger = createLogger();

// Export the factory for custom loggers
export { createLogger };

// Export types
export type { LogLevel, LoggerOptions };
