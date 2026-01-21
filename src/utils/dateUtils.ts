/**
 * Date serialization utilities for Zustand persistence
 * Handles conversion between Date objects and ISO strings for AsyncStorage
 */

export type DateOrString = Date | string;

/**
 * Converts a Date object to ISO string for serialization
 */
export function serializeDate(date: Date): string {
  return date.toISOString();
}

/**
 * Converts an ISO string back to Date object for deserialization
 */
export function deserializeDate(dateString: string): Date {
  return new Date(dateString);
}

/**
 * Checks if a value is a valid Date object
 */
export function isValidDate(date: any): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Checks if a value is a Firestore Timestamp
 */
export function isFirestoreTimestamp(value: any): boolean {
  return value && typeof value === 'object' && typeof value.toDate === 'function';
}

/**
 * Checks if a value is a valid ISO date string
 */
export function isValidDateString(dateString: any): dateString is string {
  if (typeof dateString !== 'string') return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Ensures a DateOrString value is converted to a Date object
 * Also handles Firestore Timestamps
 */
export function ensureDate(value: DateOrString | undefined | any): Date | undefined {
  if (!value) return undefined;

  // Handle Firestore Timestamp
  if (isFirestoreTimestamp(value)) {
    return value.toDate();
  }

  if (isValidDate(value)) {
    return value;
  }

  if (isValidDateString(value)) {
    return deserializeDate(value);
  }

  // Handle numeric timestamp (seconds or milliseconds)
  if (typeof value === 'number') {
    // If it looks like seconds (before year 3000), convert to milliseconds
    const ms = value < 4102444800 ? value * 1000 : value;
    const date = new Date(ms);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Handle Firestore Timestamp-like objects with seconds/nanoseconds
  if (value && typeof value === 'object' && typeof value.seconds === 'number') {
    const ms = value.seconds * 1000 + (value.nanoseconds || 0) / 1000000;
    const date = new Date(ms);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return undefined;
}

/**
 * Safe wrapper for Date methods that handles both Date objects and ISO strings
 */
export function safeDateMethod<T>(
  dateValue: DateOrString | undefined,
  method: keyof Date,
  ...args: any[]
): T | undefined {
  const date = ensureDate(dateValue);
  if (!date) return undefined;

  const dateMethod = date[method] as any;
  if (typeof dateMethod === 'function') {
    return dateMethod.apply(date, args);
  }

  return undefined;
}

/**
 * Safe toLocaleDateString wrapper
 */
export function safeToLocaleDateString(
  dateValue: DateOrString | undefined,
  locales?: string | string[],
  options?: Intl.DateTimeFormatOptions,
): string {
  const result = safeDateMethod<string>(dateValue, 'toLocaleDateString', locales, options);
  return result || 'Invalid Date';
}

/**
 * Safe getTime wrapper
 */
export function safeGetTime(dateValue: DateOrString | undefined): number {
  const result = safeDateMethod<number>(dateValue, 'getTime');
  return result || 0;
}

/**
 * Safe toISOString wrapper
 */
export function safeToISOString(dateValue: DateOrString | undefined): string {
  const result = safeDateMethod<string>(dateValue, 'toISOString');
  return result || '';
}

/**
 * Recursively converts Date objects to ISO strings in an object
 */
export function serializeDates(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (isValidDate(obj)) {
    return serializeDate(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeDates);
  }

  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        serialized[key] = serializeDates(obj[key]);
      }
    }
    return serialized;
  }

  return obj;
}

/**
 * Recursively converts ISO strings back to Date objects in an object
 */
export function deserializeDates(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (isValidDateString(obj)) {
    return deserializeDate(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(deserializeDates);
  }

  if (typeof obj === 'object') {
    const deserialized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        deserialized[key] = deserializeDates(obj[key]);
      }
    }
    return deserialized;
  }

  return obj;
}

/**
 * Format a date as relative time (e.g., "2 min ago", "3 hours ago", "yesterday")
 * Handles Date objects, ISO strings, Firestore Timestamps, and timestamp objects
 */
export function formatRelativeTime(date: DateOrString | undefined | any): string {
  if (!date) return 'Never';

  const dateObj = ensureDate(date);
  if (!dateObj) {
    // Try to extract any readable date from the value
    try {
      if (typeof date === 'string') {
        return date;
      }
      if (typeof date === 'object' && date !== null) {
        // Try common date property names
        const possibleDate = date._seconds || date.seconds || date.value;
        if (possibleDate) {
          const fallbackDate = new Date(possibleDate * 1000);
          if (!isNaN(fallbackDate.getTime())) {
            return fallbackDate.toLocaleDateString();
          }
        }
      }
    } catch {
      // Ignore errors
    }
    console.warn('[formatRelativeTime] Could not parse date:', date);
    return new Date().toLocaleDateString();
  }

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'Just now';
  } else if (diffMin < 60) {
    return `${diffMin} min ago`;
  } else if (diffHour < 24) {
    return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffDay === 1) {
    return 'Yesterday';
  } else if (diffDay < 7) {
    return `${diffDay} days ago`;
  } else if (diffDay < 30) {
    const weeks = Math.floor(diffDay / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  } else if (diffDay < 365) {
    const months = Math.floor(diffDay / 30);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  } else {
    const years = Math.floor(diffDay / 365);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  }
}

/**
 * Custom storage implementation for Zustand that handles Date serialization
 */
export function createDateAwareStorage(storage: any) {
  return {
    getItem: async (name: string) => {
      const item = await storage.getItem(name);
      if (!item) return null;

      try {
        const parsed = JSON.parse(item);
        return JSON.stringify(deserializeDates(parsed));
      } catch (error) {
        console.error('Error deserializing dates:', error);
        return item;
      }
    },
    setItem: async (name: string, value: string) => {
      try {
        const parsed = JSON.parse(value);
        const serialized = serializeDates(parsed);
        return await storage.setItem(name, JSON.stringify(serialized));
      } catch (error) {
        console.error('Error serializing dates:', error);
        return await storage.setItem(name, value);
      }
    },
    removeItem: async (name: string) => {
      return await storage.removeItem(name);
    },
  };
}