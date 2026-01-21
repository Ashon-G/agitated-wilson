/**
 * CSRF Protection Middleware
 *
 * Provides CSRF (Cross-Site Request Forgery) protection for state-changing operations
 * to prevent unauthorized actions on behalf of authenticated users.
 *
 * @version 1.0.0
 * @author PaynaAI Team
 */

import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { useState, useEffect, useCallback } from 'react';

interface CSRFConfig {
  secret: string;
  cookieName?: string;
  headerName?: string;
  cookieOptions?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    maxAge?: number;
  };
}

interface CSRFToken {
  token: string;
  secret: string;
  timestamp: number;
}

class CSRFProtection {
  private config: Required<CSRFConfig>;
  private tokenStore: Map<string, CSRFToken> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: CSRFConfig) {
    this.config = {
      secret: config.secret,
      cookieName: config.cookieName || 'csrf-token',
      headerName: config.headerName || 'x-csrf-token',
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        ...config.cookieOptions,
      },
    };

    // Clean up expired tokens every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  /**
   * Generate a new CSRF token
   */
  generateToken(sessionId: string): string {
    const secret = randomBytes(32).toString('hex');
    const timestamp = Date.now();

    // Create token by hashing secret + timestamp + sessionId
    const tokenData = `${secret}:${timestamp}:${sessionId}`;
    const token = createHash('sha256')
      .update(tokenData + this.config.secret)
      .digest('hex');

    // Store token data
    this.tokenStore.set(sessionId, {
      token,
      secret,
      timestamp,
    });

    return token;
  }

  /**
   * Verify a CSRF token
   */
  verifyToken(sessionId: string, providedToken: string): boolean {
    const storedToken = this.tokenStore.get(sessionId);

    if (!storedToken) {
      return false;
    }

    // Check if token has expired (24 hours)
    const now = Date.now();
    const tokenAge = now - storedToken.timestamp;
    if (tokenAge > (this.config.cookieOptions.maxAge || 24 * 60 * 60 * 1000)) {
      this.tokenStore.delete(sessionId);
      return false;
    }

    // Recreate expected token
    const tokenData = `${storedToken.secret}:${storedToken.timestamp}:${sessionId}`;
    const expectedToken = createHash('sha256')
      .update(tokenData + this.config.secret)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    return timingSafeEqual(
      Buffer.from(providedToken, 'hex'),
      Buffer.from(expectedToken, 'hex'),
    );
  }

  /**
   * Invalidate a CSRF token
   */
  invalidateToken(sessionId: string): void {
    this.tokenStore.delete(sessionId);
  }

  /**
   * Get token for a session (without generating new one)
   */
  getToken(sessionId: string): string | null {
    const storedToken = this.tokenStore.get(sessionId);
    return storedToken ? storedToken.token : null;
  }

  /**
   * Clean up expired tokens
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [sessionId, token] of this.tokenStore.entries()) {
      const tokenAge = now - token.timestamp;
      if (tokenAge > (this.config.cookieOptions.maxAge || 24 * 60 * 60 * 1000)) {
        this.tokenStore.delete(sessionId);
      }
    }
  }

  /**
   * Destroy the CSRF protection instance
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.tokenStore.clear();
  }
}

// Get CSRF secret from environment variable
// SECURITY: In production, this MUST be set. Never use default values.
function getCSRFSecret(): string {
  const secret = process.env.CSRF_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CRITICAL: CSRF_SECRET environment variable is required in production. ' +
        'Set a strong, randomly generated secret (minimum 32 characters).',
      );
    }
    // Only allow default in development
    console.warn(
      '⚠️ WARNING: Using default CSRF secret. This is insecure and should only be used in development. ' +
      'Set CSRF_SECRET environment variable for production.',
    );
    return 'default-csrf-secret-change-in-production';
  }

  // Validate secret strength in production
  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error(
      'CSRF_SECRET must be at least 32 characters long in production for security.',
    );
  }

  return secret;
}

// Global CSRF protection instance
export const csrfProtection = new CSRFProtection({
  secret: getCSRFSecret(),
});

/**
 * CSRF middleware for Express-like applications
 */
export function csrfMiddleware(req: any, res: any, next: any) {
  const sessionId = req.session?.id || req.user?.id || req.ip;

  if (!sessionId) {
    return res.status(401).json({ error: 'Session required for CSRF protection' });
  }

  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Get token from header or body
  const providedToken = req.headers[csrfProtection['config'].headerName] ||
                       req.body._csrf ||
                       req.query._csrf;

  if (!providedToken) {
    return res.status(403).json({ error: 'CSRF token required' });
  }

  // Verify token
  if (!csrfProtection.verifyToken(sessionId, providedToken)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
}

/**
 * React hook for CSRF token management
 */
export function useCSRFToken(sessionId: string) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionId) {
      // Get existing token or generate new one
      let currentToken = csrfProtection.getToken(sessionId);
      if (!currentToken) {
        currentToken = csrfProtection.generateToken(sessionId);
      }
      setToken(currentToken);
      setLoading(false);
    }
  }, [sessionId]);

  const refreshToken = useCallback(() => {
    if (sessionId) {
      const newToken = csrfProtection.generateToken(sessionId);
      setToken(newToken);
      return newToken;
    }
    return null;
  }, [sessionId]);

  const invalidateToken = useCallback(() => {
    if (sessionId) {
      csrfProtection.invalidateToken(sessionId);
      setToken(null);
    }
  }, [sessionId]);

  return {
    token,
    loading,
    refreshToken,
    invalidateToken,
  };
}

/**
 * Utility to add CSRF token to requests
 */
export function addCSRFTokenToRequest(
  requestConfig: any,
  token: string,
  headerName: string = 'x-csrf-token',
): any {
  return {
    ...requestConfig,
    headers: {
      ...requestConfig.headers,
      [headerName]: token,
    },
  };
}

/**
 * CSRF token utility for React Native forms
 */
export function getCSRFTokenProps(token: string) {
  return {
    name: '_csrf',
    value: token,
  };
}