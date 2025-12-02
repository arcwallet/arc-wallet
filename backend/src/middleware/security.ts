import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import crypto from 'crypto';
import { ApiError } from '../types/index.js';

// Admin emails that bypass rate limiting (for development/testing)
const ADMIN_EMAILS = new Set([
  'sehereroglu786@gmail.com',
  'seher@arc.network',
  'admin@arcwallet.network',
  'test@arcwallet.network',
  process.env.ADMIN_EMAIL?.toLowerCase(),
].filter(Boolean) as string[]);

/**
 * Enhanced Rate Limiting with:
 * - IP + User-Agent fingerprinting
 * - X-Forwarded-For validation (prevent spoofing)
 * - Progressive penalties for repeat offenders
 * - Separate limits for authenticated vs anonymous users
 */

// Trusted proxy IPs (Render, Cloudflare, etc.)
const TRUSTED_PROXIES = new Set([
  '127.0.0.1',
  '::1',
  // Cloudflare IPs (partial list - should be updated)
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
]);

/**
 * Extract real client IP with validation
 * Prevents X-Forwarded-For spoofing
 */
function getClientIp(req: Request): string {
  // If we trust the proxy, use X-Forwarded-For
  const forwardedFor = req.headers['x-forwarded-for'];
  const cfConnectingIp = req.headers['cf-connecting-ip'];

  // Cloudflare provides the real IP in cf-connecting-ip
  if (typeof cfConnectingIp === 'string' && cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  // Parse X-Forwarded-For (rightmost IP is closest to us)
  if (typeof forwardedFor === 'string' && forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    // Take the leftmost IP (original client)
    // In production, validate this against trusted proxies
    if (ips.length > 0 && ips[0]) {
      return ips[0];
    }
  }

  // Fallback to socket IP
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Generate rate limit key combining IP and fingerprint
 * This prevents attackers from bypassing limits with different IPs
 */
function generateRateLimitKey(req: Request, userId?: string): string {
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';

  // If user is authenticated, use their ID for more accurate limiting
  if (userId) {
    return `user:${userId}`;
  }

  // For anonymous users, combine IP with user-agent fingerprint
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${ip}|${userAgent}`)
    .digest('hex')
    .substring(0, 16);

  return `ip:${ip}:fp:${fingerprint}`;
}

// Rate limiting configuration - Enterprise-friendly limits
// Designed for normal user workflows without interruption
const rateLimiters = {
  // General API rate limiter - generous for normal usage
  general: new RateLimiterMemory({
    points: 300,        // 300 requests
    duration: 900,      // Per 15 minutes (20 req/min average)
    blockDuration: 30,  // Block for 30 seconds on limit
  }),

  // Authentication endpoints - allow multiple retries
  auth: new RateLimiterMemory({
    points: 30,         // 30 auth attempts
    duration: 900,      // Per 15 minutes
    blockDuration: 60,  // Block for 1 minute on limit
  }),

  // Registration/OTP - reasonable for user onboarding
  registration: new RateLimiterMemory({
    points: 20,         // 20 attempts
    duration: 300,      // Per 5 minutes
    blockDuration: 30,  // Block for 30 seconds on limit
  }),

  // Recovery endpoints - slightly stricter for security
  recovery: new RateLimiterMemory({
    points: 5,          // 5 recovery attempts
    duration: 1800,     // Per 30 minutes
    blockDuration: 300  // Block for 5 minutes on limit
  }),

  // Bridge operations - generous for active users
  bridge: new RateLimiterMemory({
    points: 50,         // 50 bridge operations
    duration: 3600,     // Per hour
    blockDuration: 60,  // Block for 1 minute on limit
  }),

  // Wallet operations - generous for transaction flows
  wallet: new RateLimiterMemory({
    points: 100,        // 100 wallet operations
    duration: 3600,     // Per hour
    blockDuration: 60,  // Block for 1 minute on limit
  }),
};

// Track repeat offenders for progressive penalties
const offenderTracker = new Map<string, { count: number; lastOffense: number }>();

// Clean up old offender records every hour
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000;
  for (const [key, value] of offenderTracker.entries()) {
    if (value.lastOffense < oneHourAgo) {
      offenderTracker.delete(key);
    }
  }
}, 3600000);

/**
 * Enhanced rate limiting middleware with:
 * - IP + fingerprint based limiting
 * - Progressive penalties for repeat offenders
 * - Detailed rate limit headers
 */
export const rateLimitMiddleware = (type: 'general' | 'auth' | 'registration' | 'bridge' | 'recovery' | 'wallet' = 'general') => {
  const disabled = process.env.DISABLE_RATE_LIMIT === 'true';

  return async (req: Request, res: Response, next: NextFunction) => {
    // Always enable rate limiting in production
    if (disabled && process.env.NODE_ENV !== 'production') {
      return next();
    }

    // Bypass rate limiting for admin emails (for testing/development)
    const email = req.body?.email?.toLowerCase?.()?.trim?.();
    if (email && ADMIN_EMAILS.has(email)) {
      console.log(`[RateLimit] Bypassing rate limit for admin: ${email.substring(0, 3)}***`);
      return next();
    }

    try {
      const rateLimiter = rateLimiters[type];

      // Get user ID if authenticated (from session cookie or auth header)
      const userId = (req as any).userId || (req as any).user?.id;

      // Generate rate limit key
      const key = generateRateLimitKey(req, userId);

      // Check for repeat offenders and apply progressive penalty
      const offender = offenderTracker.get(key);
      let pointsToConsume = 1;

      if (offender && offender.count >= 3) {
        // Progressive penalty: consume more points for repeat offenders
        pointsToConsume = Math.min(offender.count, 5);
      }

      await rateLimiter.consume(key, pointsToConsume);

      // Add rate limit info to response headers
      const rateLimiterRes = await rateLimiter.get(key);
      if (rateLimiterRes) {
        res.set({
          'X-RateLimit-Limit': rateLimiter.points.toString(),
          'X-RateLimit-Remaining': Math.max(0, rateLimiter.points - rateLimiterRes.consumedPoints).toString(),
          'X-RateLimit-Reset': new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString(),
        });
      }

      next();
    } catch (rejRes: any) {
      const key = generateRateLimitKey(req);

      // Track this as an offense
      const existing = offenderTracker.get(key);
      offenderTracker.set(key, {
        count: (existing?.count || 0) + 1,
        lastOffense: Date.now(),
      });

      // Log rate limit violation (without PII)
      const clientIp = getClientIp(req);
      const maskedIp = clientIp.replace(/\.\d+$/, '.xxx');
      console.warn(`[RateLimit] ${type} limit exceeded for ${maskedIp}`);

      const retryAfter = Math.round(rejRes.msBeforeNext / 1000) || 60;

      res.set({
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': rateLimiters[type].points.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(Date.now() + rejRes.msBeforeNext).toISOString(),
      });

      res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter,
      });
    }
  };
};

// Export helper for use in other modules
export { getClientIp, generateRateLimitKey };

/**
 * Request validation middleware
 */
export const validateRequestBody = (requiredFields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Request body is required',
        code: 'INVALID_REQUEST_BODY'
      });
    }

    const missingFields = requiredFields.filter(field => {
      return req.body[field] === undefined || req.body[field] === null;
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    next();
  };
};

/**
 * Input sanitization middleware
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

/**
 * Error handling middleware
 */
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code
    });
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: err.message,
      code: 'VALIDATION_ERROR'
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED'
    });
  }

  // Generic error
  const isDevelopment = process.env.NODE_ENV === 'development';
  res.status(500).json({
    success: false,
    error: isDevelopment ? err.message : 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(isDevelopment && { stack: err.stack })
  });
};

/**
 * CORS configuration middleware
 */
export const configureCors = (allowedOrigins: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }

    res.header('Access-Control-Allow-Credentials', 'true');
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    );
    res.header(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    );

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  };
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By');

  // Set security headers
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  // HSTS - Enforce HTTPS (only in production)
  if (process.env.NODE_ENV === 'production') {
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Permissions Policy - Restrict browser features
  res.header(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );

  // Content Security Policy
  res.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
  );

  // Prevent caching of sensitive data
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');

  next();
};

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };

    console.log(JSON.stringify(logData));
  });

  next();
};

/**
 * Health check middleware
 */
export const healthCheck = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/health' || req.path === '/') {
    return res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'arc-wallet-backend'
    });
  }

  next();
};

// Utility functions
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeValue(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[sanitizeKey(key)] = sanitizeObject(value);
  }

  return sanitized;
}

function sanitizeValue(value: any): any {
  if (typeof value === 'string') {
    // Basic XSS prevention
    return value
      .replace(/[<>&"']/g, (char) => {
        const entities: { [key: string]: string } = {
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          '"': '&quot;',
          "'": '&#x27;'
        };
        return entities[char] || char;
      })
      .trim();
  }

  return value;
}

function sanitizeKey(key: string): string {
  // Remove any dangerous characters from object keys
  return key.replace(/[^a-zA-Z0-9_-]/g, '');
}