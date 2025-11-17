import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { ApiError } from '../types/index.js';

// Rate limiting configuration
const rateLimiters = {
  // General API rate limiter
  general: new RateLimiterMemory({
    points: 100, // Number of requests
    duration: 900, // Per 15 minutes
  }),

  // Strict rate limiter for authentication endpoints
  auth: new RateLimiterMemory({
    points: 10, // Number of requests
    duration: 900, // Per 15 minutes
  }),

  // Very strict rate limiter for registration
  registration: new RateLimiterMemory({
    points: 5, // Number of requests
    duration: 3600, // Per hour
  }),

  // Moderate rate limiter for bridge operations
  bridge: new RateLimiterMemory({
    points: 20, // Number of requests
    duration: 3600, // Per hour
  }),
};

/**
 * General rate limiting middleware
 */
export const rateLimitMiddleware = (type: 'general' | 'auth' | 'registration' | 'bridge' = 'general') => {
  const disabled = process.env.DISABLE_RATE_LIMIT === 'true' || process.env.NODE_ENV !== 'production';
  return async (req: Request, res: Response, next: NextFunction) => {
    if (disabled) {
      return next();
    }
    try {
      const rateLimiter = rateLimiters[type];
      const key = req.ip || 'unknown';
      await rateLimiter.consume(key);
      next();
    } catch (rejRes: any) {
      const headers = {
        'Retry-After': Math.round(rejRes.msBeforeNext / 1000) || 1,
        'X-RateLimit-Limit': rateLimiters[type].points,
        'X-RateLimit-Remaining': rejRes.remainingPoints || 0,
        'X-RateLimit-Reset': new Date(Date.now() + rejRes.msBeforeNext)
      };

      res.set(headers);
      res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }
  };
};

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

  // Content Security Policy
  res.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
  );

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