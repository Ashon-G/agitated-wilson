/**
 * Validation Helpers
 *
 * Centralized validation utilities for forms and user inputs.
 * Provides consistent validation logic across the application.
 *
 * @version 1.0.0
 * @author PaynaAI Team
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates email address format
 *
 * @param email - Email address to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateEmail('user@example.com');
 * if (result.isValid) {
 *   console.log('Valid email');
 * } else {
 *   console.log(result.error);
 * }
 * ```
 */
export function validateEmail(email: string): ValidationResult {
  if (!email) {
    return { isValid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  if (email.length > 254) {
    return { isValid: false, error: 'Email address is too long' };
  }

  return { isValid: true };
}

/**
 * Validates password strength
 *
 * @param password - Password to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validatePassword('MySecure123!');
 * if (!result.isValid) {
 *   setPasswordError(result.error);
 * }
 * ```
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters long' };
  }

  if (password.length > 128) {
    return { isValid: false, error: 'Password is too long' };
  }

  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one uppercase letter' };
  }

  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one lowercase letter' };
  }

  if (!/\d/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one number' };
  }

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one special character' };
  }

  return { isValid: true };
}

/**
 * Validates password confirmation matches original password
 *
 * @param password - Original password
 * @param confirmation - Password confirmation
 * @returns Validation result
 */
export function validatePasswordConfirmation(password: string, confirmation: string): ValidationResult {
  if (!confirmation) {
    return { isValid: false, error: 'Please confirm your password' };
  }

  if (password !== confirmation) {
    return { isValid: false, error: 'Passwords do not match' };
  }

  return { isValid: true };
}

/**
 * Validates required text input
 *
 * @param value - Value to validate
 * @param fieldName - Name of the field for error messages
 * @param minLength - Minimum required length
 * @param maxLength - Maximum allowed length
 * @returns Validation result
 */
export function validateRequired(
  value: string,
  fieldName: string = 'Field',
  minLength: number = 1,
  maxLength: number = 1000,
): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  if (value.length < minLength) {
    return { isValid: false, error: `${fieldName} must be at least ${minLength} characters long` };
  }

  if (value.length > maxLength) {
    return { isValid: false, error: `${fieldName} is too long (max ${maxLength} characters)` };
  }

  return { isValid: true };
}

/**
 * Validates phone number format
 *
 * @param phone - Phone number to validate
 * @returns Validation result
 */
export function validatePhoneNumber(phone: string): ValidationResult {
  if (!phone) {
    return { isValid: false, error: 'Phone number is required' };
  }

  // Remove all non-digit characters for validation
  const digitsOnly = phone.replace(/\D/g, '');

  if (digitsOnly.length < 10) {
    return { isValid: false, error: 'Phone number must be at least 10 digits' };
  }

  if (digitsOnly.length > 15) {
    return { isValid: false, error: 'Phone number is too long' };
  }

  return { isValid: true };
}

/**
 * Validates URL format
 *
 * @param url - URL to validate
 * @returns Validation result
 */
export function validateUrl(url: string): ValidationResult {
  if (!url) {
    return { isValid: false, error: 'URL is required' };
  }

  try {
    new URL(url);
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Please enter a valid URL' };
  }
}

/**
 * Validates username format
 *
 * @param username - Username to validate
 * @returns Validation result
 */
export function validateUsername(username: string): ValidationResult {
  if (!username) {
    return { isValid: false, error: 'Username is required' };
  }

  if (username.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters long' };
  }

  if (username.length > 30) {
    return { isValid: false, error: 'Username is too long (max 30 characters)' };
  }

  // Only allow alphanumeric characters, underscores, and hyphens
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
  }

  // Must start with a letter or number
  if (!/^[a-zA-Z0-9]/.test(username)) {
    return { isValid: false, error: 'Username must start with a letter or number' };
  }

  return { isValid: true };
}

/**
 * Validates age (must be 13 or older)
 *
 * @param birthDate - Birth date to validate
 * @returns Validation result
 */
export function validateAge(birthDate: Date): ValidationResult {
  if (!birthDate) {
    return { isValid: false, error: 'Birth date is required' };
  }

  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ? age - 1
    : age;

  if (actualAge < 13) {
    return { isValid: false, error: 'You must be at least 13 years old' };
  }

  if (actualAge > 120) {
    return { isValid: false, error: 'Please enter a valid birth date' };
  }

  return { isValid: true };
}

/**
 * Validates file size
 *
 * @param fileSize - File size in bytes
 * @param maxSizeMB - Maximum allowed size in MB
 * @returns Validation result
 */
export function validateFileSize(fileSize: number, maxSizeMB: number = 10): ValidationResult {
  if (!fileSize || fileSize <= 0) {
    return { isValid: false, error: 'File size is required' };
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (fileSize > maxSizeBytes) {
    return { isValid: false, error: `File size must be less than ${maxSizeMB}MB` };
  }

  return { isValid: true };
}

/**
 * Validates file type
 *
 * @param fileName - Name of the file
 * @param allowedTypes - Array of allowed file extensions
 * @returns Validation result
 */
export function validateFileType(fileName: string, allowedTypes: string[] = ['jpg', 'jpeg', 'png', 'pdf']): ValidationResult {
  if (!fileName) {
    return { isValid: false, error: 'File name is required' };
  }

  const extension = fileName.split('.').pop()?.toLowerCase();

  if (!extension) {
    return { isValid: false, error: 'File must have an extension' };
  }

  if (!allowedTypes.includes(extension)) {
    return { isValid: false, error: `File type must be one of: ${allowedTypes.join(', ')}` };
  }

  return { isValid: true };
}

/**
 * Validates credit card number (basic Luhn algorithm)
 *
 * @param cardNumber - Credit card number to validate
 * @returns Validation result
 */
export function validateCreditCard(cardNumber: string): ValidationResult {
  if (!cardNumber) {
    return { isValid: false, error: 'Card number is required' };
  }

  // Remove spaces and non-digits
  const cleanNumber = cardNumber.replace(/\D/g, '');

  if (cleanNumber.length < 13 || cleanNumber.length > 19) {
    return { isValid: false, error: 'Card number must be between 13 and 19 digits' };
  }

  // Luhn algorithm
  let sum = 0;
  let isEven = false;

  for (let i = cleanNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanNumber.charAt(i), 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  if (sum % 10 !== 0) {
    return { isValid: false, error: 'Invalid card number' };
  }

  return { isValid: true };
}

/**
 * Validates multiple fields at once
 *
 * @param validations - Object with field names and validation functions
 * @returns Object with validation results for each field
 */
export function validateFields<T extends Record<string, any>>(
  validations: {
    [K in keyof T]: (value: T[K]) => ValidationResult;
  },
  values: T,
): Record<keyof T, ValidationResult> {
  const results = {} as Record<keyof T, ValidationResult>;

  for (const [field, validator] of Object.entries(validations)) {
    results[field as keyof T] = validator(values[field]);
  }

  return results;
}

/**
 * Checks if all validations pass
 *
 * @param results - Validation results object
 * @returns True if all validations pass
 */
export function allValidationsPass(results: Record<string, ValidationResult>): boolean {
  return Object.values(results).every(result => result.isValid);
}

/**
 * Gets first error message from validation results
 *
 * @param results - Validation results object
 * @returns First error message or undefined if all valid
 */
export function getFirstError(results: Record<string, ValidationResult>): string | undefined {
  for (const result of Object.values(results)) {
    if (!result.isValid && result.error) {
      return result.error;
    }
  }
  return undefined;
}
