/**
 * Link Detection Utility
 * Enforces no-links policy in Reddit comments
 * Links should only be sent via private messages
 */

/**
 * Detect all URLs in text
 * Matches http://, https://, www., and common TLDs
 */
export function detectLinks(text: string): string[] {
  const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(com|org|net|io|ai|co|app|dev|tech|me|tv|fm|xyz|info|biz)[^\s]*)/gi;
  const matches = text.match(urlPattern);
  return matches || [];
}

/**
 * Check if text contains any links
 */
export function hasLinks(text: string): boolean {
  return detectLinks(text).length > 0;
}

/**
 * Remove all links from text
 * Replaces URLs with [link removed] to maintain context
 */
export function stripLinks(text: string): string {
  const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(com|org|net|io|ai|co|app|dev|tech|me|tv|fm|xyz|info|biz)[^\s]*)/gi;
  return text.replace(urlPattern, '[link removed]');
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string | null {
  try {
    // Add protocol if missing
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
    const urlObj = new URL(urlWithProtocol);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

/**
 * Validate if text is safe for Reddit comment (no links)
 */
export function validateRedditComment(text: string): {
  isValid: boolean;
  links: string[];
  cleanedText: string;
} {
  const links = detectLinks(text);
  const isValid = links.length === 0;
  const cleanedText = isValid ? text : stripLinks(text);

  return {
    isValid,
    links,
    cleanedText,
  };
}

/**
 * Check if text contains email addresses
 */
export function hasEmailAddresses(text: string): boolean {
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return emailPattern.test(text);
}

/**
 * Remove email addresses from text
 */
export function stripEmailAddresses(text: string): string {
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return text.replace(emailPattern, '[email removed]');
}

/**
 * Comprehensive sanitization for Reddit comments
 * Removes links and emails to comply with Reddit policies
 */
export function sanitizeForReddit(text: string): {
  sanitized: string;
  removedLinks: string[];
  hadEmails: boolean;
} {
  const links = detectLinks(text);
  const hadEmails = hasEmailAddresses(text);

  let sanitized = text;
  if (links.length > 0) {
    sanitized = stripLinks(sanitized);
  }
  if (hadEmails) {
    sanitized = stripEmailAddresses(sanitized);
  }

  return {
    sanitized,
    removedLinks: links,
    hadEmails,
  };
}
