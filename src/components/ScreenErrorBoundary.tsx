/**
 * Screen Error Boundary Component
 *
 * Provides error boundary functionality specifically for screen components.
 * Offers retry mechanisms and graceful error handling for screen-level failures.
 *
 * @version 1.0.0
 * @author PaynaAI Team
 */

import React, { Component, ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatErrorMessage } from '../utils/errorMessageFormatter';

export interface ScreenErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
  retryCount: number;
}

export interface ScreenErrorBoundaryProps {
  children: ReactNode;
  screenName: string;
  fallbackMessage?: string;
  showRetryButton?: boolean;
  maxRetries?: number;
  onError?: (error: Error, errorInfo: any, screenName: string) => void;
  onRetry?: (retryCount: number) => void;
}

export class ScreenErrorBoundary extends Component<
  ScreenErrorBoundaryProps,
  ScreenErrorBoundaryState
> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ScreenErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ScreenErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    const { screenName, onError } = this.props;

    // Log error with context (using console.log to avoid recursive error loop)
    console.log(`[ScreenErrorBoundary] Error in ${screenName}:`, error.message, error.stack);

    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    if (onError) {
      onError(error, errorInfo, screenName);
    }

    // Report to error tracking service in production
    if (!__DEV__) {
      // TODO: Send to error tracking service
      // Example: Sentry.captureException(error, {
      //   tags: { screen: screenName },
      //   extra: errorInfo
      // });
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleRetry = () => {
    const { maxRetries = 3, onRetry } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      console.warn(
        `[ScreenErrorBoundary] Max retries (${maxRetries}) exceeded for ${this.props.screenName}`,
      );
      return;
    }

    // Call optional retry handler
    if (onRetry) {
      onRetry(retryCount + 1);
    }

    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: retryCount + 1,
    });
  };

  handleGoBack = () => {
    // This would typically use navigation to go back
    // For now, we'll just reset the error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });
  };

  render() {
    const { hasError, error, retryCount } = this.state;
    const {
      children,
      screenName,
      fallbackMessage,
      showRetryButton = true,
      maxRetries = 3,
    } = this.props;

    if (hasError) {
      const isMaxRetriesReached = retryCount >= maxRetries;
      const userMessage = formatErrorMessage(error || 'Unknown error occurred', {
        component: screenName,
        operation: 'render',
      });

      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.errorContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name='warning-outline' size={48} color='#FF6B6B' />
            </View>

            <Text style={styles.title}>
              {isMaxRetriesReached ? 'Unable to Load Screen' : 'Something Went Wrong'}
            </Text>

            <Text style={styles.message}>{fallbackMessage || userMessage}</Text>

            {__DEV__ && error && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Debug Info:</Text>
                <Text style={styles.debugText}>Screen: {screenName}</Text>
                <Text style={styles.debugText}>Error: {error.message}</Text>
                <Text style={styles.debugText}>
                  Retry Count: {retryCount}/{maxRetries}
                </Text>
              </View>
            )}

            <View style={styles.buttonContainer}>
              {showRetryButton && !isMaxRetriesReached && (
                <Pressable style={[styles.button, styles.retryButton]} onPress={this.handleRetry}>
                  <Ionicons name='refresh' size={20} color='#FFFFFF' />
                  <Text style={styles.buttonText}>
                    Try Again ({retryCount + 1}/{maxRetries})
                  </Text>
                </Pressable>
              )}

              <Pressable style={[styles.button, styles.backButton]} onPress={this.handleGoBack}>
                <Ionicons name='arrow-back' size={20} color='#007AFF' />
                <Text style={[styles.buttonText, styles.backButtonText]}>Go Back</Text>
              </Pressable>
            </View>

            {isMaxRetriesReached && (
              <View style={styles.maxRetriesContainer}>
                <Text style={styles.maxRetriesText}>
                  Maximum retry attempts reached. Please restart the app.
                </Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      );
    }

    return children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFE6E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  debugContainer: {
    backgroundColor: '#F0F0F0',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    width: '100%',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  retryButton: {
    backgroundColor: '#007AFF',
  },
  backButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  backButtonText: {
    color: '#007AFF',
  },
  maxRetriesContainer: {
    backgroundColor: '#FFF3CD',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFEAA7',
  },
  maxRetriesText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
});

/**
 * Higher-order component for wrapping screens with error boundaries
 *
 * @param screenName - Name of the screen for error context
 * @param options - Error boundary options
 * @returns HOC that wraps components with error boundary
 */
export function withScreenErrorBoundary<P extends object>(
  screenName: string,
  options: Partial<Omit<ScreenErrorBoundaryProps, 'children' | 'screenName'>> = {},
) {
  return function <T extends React.ComponentType<P>> (WrappedComponent: T): React.ComponentType<P> {
    const WithErrorBoundary = (props: P) => (
      <ScreenErrorBoundary screenName={screenName} {...options}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- HOC pattern requires any for LibraryManagedAttributes compatibility */}
        <WrappedComponent {...(props as any)} />
      </ScreenErrorBoundary>
    );

    WithErrorBoundary.displayName = `withScreenErrorBoundary(${screenName})`;
    return WithErrorBoundary;
  };
}

/**
 * Hook for error boundary functionality in functional components
 *
 * @param screenName - Name of the screen
 * @returns Error boundary utilities
 */
export function useScreenErrorBoundary(screenName: string) {
  const [error, setError] = React.useState<Error | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);

  const resetError = React.useCallback(() => {
    setError(null);
    setRetryCount(0);
  }, []);

  const handleError = React.useCallback(
    (error: Error) => {
      console.log(`[useScreenErrorBoundary] Error in ${screenName}:`, error.message);
      setError(error);

      // Report to error tracking service
      if (!__DEV__) {
        // TODO: Send to error tracking service
      }
    },
    [screenName],
  );

  const retry = React.useCallback(() => {
    setRetryCount(prev => prev + 1);
    setError(null);
  }, []);

  return {
    error,
    retryCount,
    resetError,
    handleError,
    retry,
    hasError: error !== null,
  };
}

export default ScreenErrorBoundary;
