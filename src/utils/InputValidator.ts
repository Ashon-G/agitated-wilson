/**
 * Input Validation and Sanitization Utility
 *
 * Comprehensive input validation and sanitization for all user inputs
 * to prevent security vulnerabilities and data corruption.
 *
 * @version 1.0.0
 * @author AI Agent
 */

interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedValue?: unknown;
}

interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  type?: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'date';
  custom?: (value: unknown) => ValidationResult;
}

class InputValidator {
  private static instance: InputValidator;

  private constructor() {}

  static getInstance(): InputValidator {
    if (!InputValidator.instance) {
      InputValidator.instance = new InputValidator();
    }
    return InputValidator.instance;
  }

  /**
   * Validate and sanitize input based on rules
   */
  validateInput(value: unknown, rules: ValidationRule): ValidationResult {
    try {
      // Check if required
      if (rules.required && (value === null || value === undefined || value === '')) {
        return {
          isValid: false,
          error: 'This field is required',
        };
      }

      // Skip validation if value is empty and not required
      if (!rules.required && (value === null || value === undefined || value === '')) {
        return {
          isValid: true,
          sanitizedValue: value,
        };
      }

      // Type validation
      if (rules.type) {
        const typeResult = this.validateType(value, rules.type);
        if (!typeResult.isValid) {
          return typeResult;
        }
        value = typeResult.sanitizedValue;
      }

      // String-specific validations
      if (typeof value === 'string') {
        const stringResult = this.validateString(value, rules);
        if (!stringResult.isValid) {
          return stringResult;
        }
        value = stringResult.sanitizedValue;
      }

      // Custom validation
      if (rules.custom) {
        const customResult = rules.custom(value);
        if (!customResult.isValid) {
          return customResult;
        }
        value = customResult.sanitizedValue || value;
      }

      return {
        isValid: true,
        sanitizedValue: value,
      };
    } catch {
      return {
        isValid: false,
        error: 'Validation error occurred',
      };
    }
  }

  /**
   * Validate multiple inputs at once
   */
  validateMultiple(inputs: Record<string, { value: unknown; rules: ValidationRule }>): {
    isValid: boolean;
    errors: Record<string, string>;
    sanitizedValues: Record<string, unknown>;
  } {
    const errors: Record<string, string> = {};
    const sanitizedValues: Record<string, unknown> = {};
    let isValid = true;

    Object.entries(inputs).forEach(([key, { value, rules }]) => {
      const result = this.validateInput(value, rules);

      if (!result.isValid) {
        errors[key] = result.error || 'Invalid input';
        isValid = false;
      } else {
        sanitizedValues[key] = result.sanitizedValue;
      }
    });

    return {
      isValid,
      errors,
      sanitizedValues,
    };
  }

  /**
   * Validate type-specific inputs
   */
  private validateType(value: unknown, type: string): ValidationResult {
    switch (type) {
      case 'string':
        return {
          isValid: true,
          sanitizedValue: String(value),
        };

      case 'number':
        const numValue = Number(value);
        if (isNaN(numValue)) {
          return {
            isValid: false,
            error: 'Must be a valid number',
          };
        }
        return {
          isValid: true,
          sanitizedValue: numValue,
        };

      case 'boolean':
        if (typeof value === 'boolean') {
          return {
            isValid: true,
            sanitizedValue: value,
          };
        }
        if (typeof value === 'string') {
          const lowerValue = value.toLowerCase();
          if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
            return {
              isValid: true,
              sanitizedValue: true,
            };
          }
          if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
            return {
              isValid: true,
              sanitizedValue: false,
            };
          }
        }
        return {
          isValid: false,
          error: 'Must be a valid boolean value',
        };

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const emailValue = String(value).toLowerCase();
        if (!emailRegex.test(emailValue)) {
          return {
            isValid: false,
            error: 'Must be a valid email address',
          };
        }
        return {
          isValid: true,
          sanitizedValue: emailValue,
        };

      case 'url':
        try {
          const urlValue = String(value);
          new URL(urlValue);
          return {
            isValid: true,
            sanitizedValue: urlValue,
          };
        } catch {
          return {
            isValid: false,
            error: 'Must be a valid URL',
          };
        }

      case 'date':
        const dateValue = new Date(String(value));
        if (isNaN(dateValue.getTime())) {
          return {
            isValid: false,
            error: 'Must be a valid date',
          };
        }
        return {
          isValid: true,
          sanitizedValue: dateValue,
        };

      default:
        return {
          isValid: true,
          sanitizedValue: value,
        };
    }
  }

  /**
   * Validate string-specific rules
   */
  private validateString(value: string, rules: ValidationRule): ValidationResult {
    let sanitizedValue = value;

    // Length validation
    if (rules.minLength !== undefined && sanitizedValue.length < rules.minLength) {
      return {
        isValid: false,
        error: `Must be at least ${rules.minLength} characters long`,
      };
    }

    if (rules.maxLength !== undefined && sanitizedValue.length > rules.maxLength) {
      return {
        isValid: false,
        error: `Must be no more than ${rules.maxLength} characters long`,
      };
    }

    // Pattern validation
    if (rules.pattern && !rules.pattern.test(sanitizedValue)) {
      return {
        isValid: false,
        error: 'Invalid format',
      };
    }

    // Sanitize string
    sanitizedValue = this.sanitizeString(sanitizedValue);

    return {
      isValid: true,
      sanitizedValue,
    };
  }

  /**
   * Sanitize string input
   */
  private sanitizeString(value: string): string {
    return value
      .trim() // Remove leading/trailing whitespace
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/data:/gi, '') // Remove data: protocol
      .replace(/vbscript:/gi, '') // Remove vbscript: protocol
      .replace(/on\w+\s*=/gi, ''); // Remove event handlers
  }

  /**
   * Sanitize object input recursively
   */
  sanitizeObject(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: Record<string, unknown> = {};
      Object.keys(obj).forEach(key => {
        const sanitizedKey = this.sanitizeString(key);
        sanitized[sanitizedKey] = this.sanitizeObject((obj as Record<string, unknown>)[key]);
      });
      return sanitized;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    return obj;
  }

  /**
   * Validate document ID
   */
  validateDocumentId(documentId: unknown): ValidationResult {
    return this.validateInput(documentId, {
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: 100,
      pattern: /^[a-zA-Z0-9_-]+$/,
    });
  }

  /**
   * Validate collection name (supports subcollection paths like "users/uid/items")
   */
  validateCollectionName(collectionName: unknown): ValidationResult {
    return this.validateInput(collectionName, {
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: 200,
      pattern: /^[a-zA-Z0-9_\-/]+$/,
    });
  }

  /**
   * Validate user ID
   */
  validateUserId(userId: unknown): ValidationResult {
    return this.validateInput(userId, {
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: 100,
      pattern: /^[a-zA-Z0-9_-]+$/,
    });
  }

  /**
   * Validate email input
   */
  validateEmail(email: unknown): ValidationResult {
    return this.validateInput(email, {
      required: true,
      type: 'email',
      maxLength: 254,
    });
  }

  /**
   * Validate password input
   */
  validatePassword(password: unknown): ValidationResult {
    return this.validateInput(password, {
      required: true,
      type: 'string',
      minLength: 8,
      maxLength: 128,
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    });
  }

  /**
   * Validate URL input
   */
  validateUrl(url: unknown): ValidationResult {
    return this.validateInput(url, {
      required: true,
      type: 'url',
      maxLength: 2048,
    });
  }

  /**
   * Validate text input (general purpose)
   */
  validateText(text: unknown, options: { required?: boolean; maxLength?: number } = {}): ValidationResult {
    return this.validateInput(text, {
      required: options.required || false,
      type: 'string',
      maxLength: options.maxLength || 1000,
    });
  }

  /**
   * Validate number input
   */
  validateNumber(number: unknown, options: { required?: boolean; min?: number; max?: number } = {}): ValidationResult {
    const result = this.validateInput(number, {
      required: options.required || false,
      type: 'number',
    });

    if (!result.isValid) {
      return result;
    }

    const numValue = result.sanitizedValue as number;

    if (options.min !== undefined && numValue < options.min) {
      return {
        isValid: false,
        error: `Must be at least ${options.min}`,
      };
    }

    if (options.max !== undefined && numValue > options.max) {
      return {
        isValid: false,
        error: `Must be no more than ${options.max}`,
      };
    }

    return result;
  }

  /**
   * Validate boolean input
   */
  validateBoolean(value: unknown, required: boolean = false): ValidationResult {
    return this.validateInput(value, {
      required,
      type: 'boolean',
    });
  }

  /**
   * Validate date input
   */
  validateDate(date: unknown, options: { required?: boolean; min?: Date; max?: Date } = {}): ValidationResult {
    const result = this.validateInput(date, {
      required: options.required || false,
      type: 'date',
    });

    if (!result.isValid) {
      return result;
    }

    const dateValue = result.sanitizedValue as Date;

    if (options.min && dateValue < options.min) {
      return {
        isValid: false,
        error: `Date must be after ${options.min.toISOString()}`,
      };
    }

    if (options.max && dateValue > options.max) {
      return {
        isValid: false,
        error: `Date must be before ${options.max.toISOString()}`,
      };
    }

    return result;
  }
}

export default InputValidator.getInstance();
