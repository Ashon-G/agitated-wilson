/**
 * Rate Limiting Middleware
 *
 * Implements rate limiting to prevent abuse and DoS attacks.
 * Supports different rate limits for different types of operations.
 *
 * @version 1.0.0
 * @author PaynaAI Team
 */

import { useState, useEffect } from 'react';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: any) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
  statusCode?: number;
}

export interface RateLimitRule {
  path: string;
  method?: string;
  config: RateLimitConfig;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  info?: RateLimitInfo;
  error?: string;
}

export class RateLimiter {
  private rules: Map<string, RateLimitRule> = new Map();
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();
  private blockedIPs: Map<string, number> = new Map();

  constructor() {
    // Clean up expired entries every minute
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60 * 1000);
  }

  /**
   * Adds a rate limit rule
   *
   * @param rule - Rate limit rule configuration
   */
  addRule(rule: RateLimitRule): void {
    const key = this.getRuleKey(rule.path, rule.method);
    this.rules.set(key, rule);
  }

  /**
   * Checks if a request is allowed based on rate limits
   *
   * @param req - Request object
   * @returns Rate limit result
   */
  checkLimit(req: any): RateLimitResult {
    const rule = this.findMatchingRule(req);

    if (!rule) {
      return { allowed: true };
    }

    const key = this.getRequestKey(req, rule);
    const now = Date.now();
    const windowStart = now - rule.config.windowMs;

    // Check if IP is blocked
    const clientIP = this.getClientIP(req);
    if (this.isIPBlocked(clientIP)) {
      return {
        allowed: false,
        error: 'IP address is temporarily blocked due to excessive requests',
      };
    }

    // Get or create request count entry
    let entry = this.requestCounts.get(key);

    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + rule.config.windowMs,
      };
      this.requestCounts.set(key, entry);
    }

    // Check if limit is exceeded
    if (entry.count >= rule.config.maxRequests) {
      // Block IP if too many violations
      this.recordViolation(clientIP);

      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

      return {
        allowed: false,
        info: {
          limit: rule.config.maxRequests,
          remaining: 0,
          resetTime: new Date(entry.resetTime),
          retryAfter,
        },
        error: rule.config.message || 'Rate limit exceeded',
      };
    }

    // Increment request count
    entry.count++;

    const remaining = rule.config.maxRequests - entry.count;
    const resetTime = new Date(entry.resetTime);

    return {
      allowed: true,
      info: {
        limit: rule.config.maxRequests,
        remaining,
        resetTime,
      },
    };
  }

  /**
   * Middleware function for Express.js
   *
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next function
   */
  middleware(req: any, res: any, next: any): void {
    const result = this.checkLimit(req);

    // Set rate limit headers
    if (result.info) {
      res.set({
        'X-RateLimit-Limit': result.info.limit.toString(),
        'X-RateLimit-Remaining': result.info.remaining.toString(),
        'X-RateLimit-Reset': result.info.resetTime.getTime().toString(),
      });

      if (result.info.retryAfter) {
        res.set('Retry-After', result.info.retryAfter.toString());
      }
    }

    if (!result.allowed) {
      const statusCode = this.findMatchingRule(req)?.config.statusCode || 429;
      return res.status(statusCode).json({
        error: 'Rate limit exceeded',
        message: result.error,
        retryAfter: result.info?.retryAfter,
      });
    }

    next();
  }

  /**
   * Gets rate limit information for a request
   *
   * @param req - Request object
   * @returns Rate limit information
   */
  getInfo(req: any): RateLimitInfo | null {
    const rule = this.findMatchingRule(req);

    if (!rule) {
      return null;
    }

    const key = this.getRequestKey(req, rule);
    const entry = this.requestCounts.get(key);

    if (!entry) {
      return {
        limit: rule.config.maxRequests,
        remaining: rule.config.maxRequests,
        resetTime: new Date(Date.now() + rule.config.windowMs),
      };
    }

    const remaining = Math.max(0, rule.config.maxRequests - entry.count);

    return {
      limit: rule.config.maxRequests,
      remaining,
      resetTime: new Date(entry.resetTime),
    };
  }

  /**
   * Resets rate limit for a specific key
   *
   * @param key - Rate limit key to reset
   */
  resetLimit(key: string): void {
    this.requestCounts.delete(key);
  }

  /**
   * Resets rate limit for a specific IP
   *
   * @param ip - IP address to reset
   */
  resetIPLimit(ip: string): void {
    for (const [key, entry] of this.requestCounts.entries()) {
      if (key.startsWith(`ip:${ip}:`)) {
        this.requestCounts.delete(key);
      }
    }
    this.blockedIPs.delete(ip);
  }

  /**
   * Gets statistics about rate limiting
   *
   * @returns Rate limiter statistics
   */
  getStats(): {
    totalRules: number;
    activeEntries: number;
    blockedIPs: number;
    totalRequests: number;
    } {
    let totalRequests = 0;

    for (const entry of this.requestCounts.values()) {
      totalRequests += entry.count;
    }

    return {
      totalRules: this.rules.size,
      activeEntries: this.requestCounts.size,
      blockedIPs: this.blockedIPs.size,
      totalRequests,
    };
  }

  /**
   * Finds matching rule for a request
   *
   * @param req - Request object
   * @returns Matching rule or null
   */
  private findMatchingRule(req: any): RateLimitRule | null {
    const path = req.path || req.url;
    const { method } = req;

    // Try exact match first
    const exactKey = this.getRuleKey(path, method);
    const exactRule = this.rules.get(exactKey);

    if (exactRule) {
      return exactRule;
    }

    // Try path-only match
    const pathKey = this.getRuleKey(path);
    const pathRule = this.rules.get(pathKey);

    if (pathRule) {
      return pathRule;
    }

    // Try wildcard matches
    for (const [key, rule] of this.rules.entries()) {
      if (this.matchesPattern(path, rule.path)) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Generates a key for a rule
   *
   * @param path - Request path
   * @param method - HTTP method
   * @returns Rule key
   */
  private getRuleKey(path: string, method?: string): string {
    return method ? `${method}:${path}` : path;
  }

  /**
   * Generates a key for a request
   *
   * @param req - Request object
   * @param rule - Rate limit rule
   * @returns Request key
   */
  private getRequestKey(req: any, rule: RateLimitRule): string {
    const clientIP = this.getClientIP(req);
    const userId = req.user?.id || req.auth?.uid;

    if (rule.config.keyGenerator) {
      return rule.config.keyGenerator(req);
    }

    if (userId) {
      return `user:${userId}:${rule.path}`;
    }

    return `ip:${clientIP}:${rule.path}`;
  }

  /**
   * Gets client IP address
   *
   * @param req - Request object
   * @returns Client IP address
   */
  private getClientIP(req: any): string {
    return req.ip ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           'unknown';
  }

  /**
   * Checks if IP is blocked
   *
   * @param ip - IP address to check
   * @returns True if IP is blocked
   */
  private isIPBlocked(ip: string): boolean {
    const blockTime = this.blockedIPs.get(ip);

    if (!blockTime) {
      return false;
    }

    if (blockTime < Date.now()) {
      this.blockedIPs.delete(ip);
      return false;
    }

    return true;
  }

  /**
   * Records a violation for an IP
   *
   * @param ip - IP address that violated rate limit
   */
  private recordViolation(ip: string): void {
    const violations = this.getViolationCount(ip);

    if (violations >= 5) {
      // Block IP for 1 hour after 5 violations
      this.blockedIPs.set(ip, Date.now() + 60 * 60 * 1000);
    }
  }

  /**
   * Gets violation count for an IP
   *
   * @param ip - IP address
   * @returns Violation count
   */
  private getViolationCount(ip: string): number {
    let count = 0;

    for (const [key, entry] of this.requestCounts.entries()) {
      if (key.startsWith(`ip:${ip}:`) && entry.count >= 100) {
        count++;
      }
    }

    return count;
  }

  /**
   * Checks if a path matches a pattern
   *
   * @param path - Path to check
   * @param pattern - Pattern to match against
   * @returns True if path matches pattern
   */
  private matchesPattern(path: string, pattern: string): boolean {
    if (pattern === '*') {
      return true;
    }

    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(path);
    }

    return path === pattern;
  }

  /**
   * Cleans up expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();

    for (const [key, entry] of this.requestCounts.entries()) {
      if (entry.resetTime < now) {
        this.requestCounts.delete(key);
      }
    }

    for (const [ip, blockTime] of this.blockedIPs.entries()) {
      if (blockTime < now) {
        this.blockedIPs.delete(ip);
      }
    }
  }
}

// Singleton instance for global use
export const rateLimiter = new RateLimiter();

// Default rate limit rules
rateLimiter.addRule({
  path: '/api/auth/*',
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts. Please try again later.',
    statusCode: 429,
  },
});

rateLimiter.addRule({
  path: '/api/*',
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Too many requests. Please slow down.',
    statusCode: 429,
  },
});

rateLimiter.addRule({
  path: '/api/upload/*',
  config: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: 'Too many upload requests. Please wait before uploading again.',
    statusCode: 429,
  },
});

/**
 * React hook for rate limit information
 */
export function useRateLimit(path: string) {
  const [info, setInfo] = useState<RateLimitInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkLimit = async (): Promise<void> => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/rate-limit/info?path=${encodeURIComponent(path)}`);

      if (response.ok) {
        const data = await response.json();
        setInfo(data);
      }
    } catch (error) {
      console.error('Failed to check rate limit:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkLimit();
  }, [path]);

  return {
    info,
    isLoading,
    checkLimit,
  };
}
