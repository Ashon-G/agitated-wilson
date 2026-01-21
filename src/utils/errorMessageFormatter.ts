/**
 * Error Message Formatter
 *
 * Provides consistent error message formatting across the application.
 * Handles Firebase errors, network errors, and custom application errors.
 *
 * @version 1.0.0
 * @author PaynaAI Team
 */

export interface ErrorContext {
  operation?: string;
  component?: string;
  userId?: string;
  timestamp?: Date;
}

/**
 * Formats error messages for user display
 *
 * @param error - Error object or string
 * @param context - Additional context about the error
 * @returns User-friendly error message
 *
 * @example
 * ```typescript
 * try {
 *   await signIn(email, password);
 * } catch {
 *   const message = formatErrorMessage(error, { operation: 'signIn' });
 *   toastManager.error(message);
 * }
 * ```
 */
export function formatErrorMessage(error: Error | string, context?: ErrorContext): string {
  const errorMessage = typeof error === 'string' ? error : error.message;

  // Handle Firebase Auth errors
  if (errorMessage.includes('auth/')) {
    return formatFirebaseError(errorMessage);
  }

  // Handle network errors
  if (errorMessage.includes('Network Error') || errorMessage.includes('fetch')) {
    return 'Network connection error. Please check your internet connection and try again.';
  }

  // Handle timeout errors
  if (errorMessage.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  // Handle generic errors
  if (errorMessage.includes('Error:')) {
    return errorMessage.replace('Error:', '').trim();
  }

  // Return original message if no specific formatting needed
  return errorMessage || 'An unexpected error occurred. Please try again.';
}

/**
 * Formats Firebase authentication errors
 *
 * @param errorCode - Firebase error code
 * @returns User-friendly error message
 */
export function formatFirebaseError(errorCode: string): string {
  const errorMap: Record<string, string> = {
    'auth/user-not-found': 'No account found with this email address.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled. Please contact support.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password is too weak. Please choose a stronger password.',
    'auth/invalid-credential': 'Invalid login credentials. Please check your email and password.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/requires-recent-login': 'Please sign in again to continue.',
    'auth/account-exists-with-different-credential': 'An account already exists with this email.',
    'auth/credential-already-in-use': 'This credential is already associated with another account.',
    'auth/invalid-verification-code': 'Invalid verification code.',
    'auth/invalid-verification-id': 'Invalid verification ID.',
    'auth/missing-verification-code': 'Verification code is required.',
    'auth/missing-verification-id': 'Verification ID is required.',
    'auth/quota-exceeded': 'Service quota exceeded. Please try again later.',
    'auth/captcha-check-failed': 'Captcha verification failed.',
    'auth/invalid-phone-number': 'Invalid phone number format.',
    'auth/missing-phone-number': 'Phone number is required.',
    'auth/operation-not-allowed': 'This operation is not allowed.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed.',
    'auth/popup-blocked': 'Sign-in popup was blocked by browser.',
    'auth/cancelled-popup-request': 'Sign-in request was cancelled.',
    'auth/invalid-user-token': 'Invalid user token. Please sign in again.',
    'auth/user-token-expired': 'Your session has expired. Please sign in again.',
    'auth/null-user': 'No user is currently signed in.',
    'auth/app-deleted': 'Firebase app has been deleted.',
    'auth/invalid-api-key': 'Invalid API key.',
    'auth/unauthorized-domain': 'This domain is not authorized.',
    'auth/operation-not-supported-in-this-environment': 'This operation is not supported.',
    'auth/missing-continue-uri': 'Missing continue URI.',
    'auth/missing-ios-bundle-id': 'Missing iOS bundle ID.',
    'auth/missing-android-pkg-name': 'Missing Android package name.',
    'auth/unauthorized-continue-uri': 'Unauthorized continue URI.',
    'auth/invalid-dynamic-link-domain': 'Invalid dynamic link domain.',
    'auth/argument-error': 'Invalid argument provided.',
    'auth/invalid-persistence-type': 'Invalid persistence type.',
    'auth/unsupported-persistence-type': 'Unsupported persistence type.',
    'auth/invalid-display-name': 'Invalid display name.',
    'auth/invalid-email-verified': 'Invalid email verified status.',
    'auth/invalid-id-token': 'Invalid ID token.',
    'auth/invalid-last-sign-in-time': 'Invalid last sign-in time.',
    'auth/invalid-page-token': 'Invalid page token.',
    'auth/invalid-password': 'Invalid password.',
    'auth/invalid-password-hash': 'Invalid password hash.',
    'auth/invalid-password-salt': 'Invalid password salt.',
    'auth/invalid-photo-url': 'Invalid photo URL.',
    'auth/invalid-provider-data': 'Invalid provider data.',
    'auth/invalid-session-cookie-duration': 'Invalid session cookie duration.',
    'auth/invalid-uid': 'Invalid user ID.',
    'auth/invalid-user-import': 'Invalid user import.',
    'auth/maximum-user-count-exceeded': 'Maximum user count exceeded.',
    'auth/missing-hash-algorithm': 'Missing hash algorithm.',
    'auth/project-not-found': 'Project not found.',
    'auth/insufficient-permission': 'Insufficient permission.',
    'auth/duplicate-email': 'Email address is already in use.',
    'auth/email-not-found': 'Email address not found.',
    'auth/reset-password-exceeded-limit': 'Password reset limit exceeded.',
    'auth/invalid-tenant-id': 'Invalid tenant ID.',
    'auth/missing-or-invalid-nonce': 'Missing or invalid nonce.',
    'auth/domain-config-required': 'Domain configuration required.',
    'auth/missing-app-credential': 'Missing app credential.',
    'auth/invalid-app-credential': 'Invalid app credential.',
    'auth/invalid-verification-proof': 'Invalid verification proof.',
    'auth/missing-verification-proof': 'Missing verification proof.',
    'auth/invalid-app-token': 'Invalid app token.',
    'auth/must-verify-email': 'Email must be verified.',
    'auth/email-already-exists': 'Email already exists.',
    'auth/phone-number-already-exists': 'Phone number already exists.',
  };

  return errorMap[errorCode] || 'An authentication error occurred. Please try again.';
}

/**
 * Formats Firestore errors
 *
 * @param error - Firestore error
 * @returns User-friendly error message
 */
export function formatFirestoreError(error: any): string {
  if (!error || !error.code) {
    return 'A database error occurred. Please try again.';
  }

  const errorMap: Record<string, string> = {
    'permission-denied': 'You do not have permission to perform this action.',
    'not-found': 'The requested data was not found.',
    'already-exists': 'This data already exists.',
    'failed-precondition': 'The operation failed due to a precondition.',
    aborted: 'The operation was aborted.',
    'out-of-range': 'The operation is out of range.',
    unimplemented: 'This operation is not implemented.',
    internal: 'An internal error occurred.',
    unavailable: 'The service is currently unavailable.',
    'data-loss': 'Data loss occurred.',
    unauthenticated: 'You must be signed in to perform this action.',
    'resource-exhausted': 'Resource limit exceeded.',
    cancelled: 'The operation was cancelled.',
    'deadline-exceeded': 'The operation timed out.',
    'invalid-argument': 'Invalid argument provided.',
  };

  return errorMap[error.code] || 'A database error occurred. Please try again.';
}

/**
 * Formats network errors
 *
 * @param error - Network error
 * @returns User-friendly error message
 */
export function formatNetworkError(error: any): string {
  if (!error) {
    return 'A network error occurred. Please try again.';
  }

  if (error.message?.includes('Network Error')) {
    return 'Network connection error. Please check your internet connection.';
  }

  if (error.message?.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  if (error.status === 404) {
    return 'The requested resource was not found.';
  }

  if (error.status === 403) {
    return 'You do not have permission to access this resource.';
  }

  if (error.status === 401) {
    return 'You must be signed in to access this resource.';
  }

  if (error.status >= 500) {
    return 'Server error. Please try again later.';
  }

  if (error.status >= 400) {
    return 'Request error. Please check your input and try again.';
  }

  return 'A network error occurred. Please try again.';
}

/**
 * Formats validation errors
 *
 * @param errors - Array of validation errors
 * @returns User-friendly error message
 */
export function formatValidationErrors(errors: string[]): string {
  if (!errors || errors.length === 0) {
    return 'Validation error occurred.';
  }

  if (errors.length === 1) {
    return errors[0];
  }

  return `Multiple errors: ${errors.join(', ')}`;
}

/**
 * Formats Stripe payment errors
 *
 * @param error - Stripe error
 * @returns User-friendly error message
 */
export function formatStripeError(error: any): string {
  if (!error || !error.type) {
    return 'A payment error occurred. Please try again.';
  }

  const errorMap: Record<string, string> = {
    card_error: 'There was an error with your card. Please check your card details.',
    rate_limit_error: 'Too many requests. Please try again later.',
    invalid_request_error: 'Invalid request. Please try again.',
    api_error: 'Payment service error. Please try again.',
    authentication_error: 'Payment authentication failed.',
    api_connection_error: 'Payment service connection error.',
  };

  return errorMap[error.type] || 'A payment error occurred. Please try again.';
}

/**
 * Gets error severity level
 *
 * @param error - Error object
 * @returns Severity level
 */
export function getErrorSeverity(error: Error | string): 'low' | 'medium' | 'high' | 'critical' {
  const errorMessage = typeof error === 'string' ? error : error.message;

  if (errorMessage.includes('auth/') || errorMessage.includes('permission')) {
    return 'high';
  }

  if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
    return 'medium';
  }

  if (errorMessage.includes('validation') || errorMessage.includes('format')) {
    return 'low';
  }

  return 'medium';
}

/**
 * Logs error with context
 *
 * @param error - Error to log
 * @param context - Additional context
 */
export function logError(error: Error | string, context?: ErrorContext): void {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const severity = getErrorSeverity(error);

  const logData = {
    message: errorMessage,
    severity,
    context,
    timestamp: new Date().toISOString(),
    stack: typeof error === 'object' ? error.stack : undefined,
  };

  // Log to console in development
  if (__DEV__) {
    console.error('[ERROR]', logData);
  }

  // TODO: Send to error tracking service in production
  // Example: Sentry.captureException(error, { extra: context });
}

/**
 * Creates a standardized error object
 *
 * @param message - Error message
 * @param code - Error code
 * @param context - Additional context
 * @returns Standardized error object
 */
export function createError(message: string, code?: string, context?: ErrorContext): Error {
  const error = new Error(message);
  (error as any).code = code;
  (error as any).context = context;
  (error as any).timestamp = new Date();
  return error;
}
