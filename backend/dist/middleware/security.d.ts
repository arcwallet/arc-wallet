import { Request, Response, NextFunction } from 'express';
/**
 * Extract real client IP with validation
 * Prevents X-Forwarded-For spoofing
 */
declare function getClientIp(req: Request): string;
/**
 * Generate rate limit key combining IP and fingerprint
 * This prevents attackers from bypassing limits with different IPs
 */
declare function generateRateLimitKey(req: Request, userId?: string): string;
/**
 * Enhanced rate limiting middleware with:
 * - IP + fingerprint based limiting
 * - Progressive penalties for repeat offenders
 * - Detailed rate limit headers
 */
export declare const rateLimitMiddleware: (type?: "general" | "auth" | "registration" | "bridge" | "recovery" | "wallet") => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export { getClientIp, generateRateLimitKey };
/**
 * Request validation middleware
 */
export declare const validateRequestBody: (requiredFields: string[]) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Input sanitization middleware
 */
export declare const sanitizeInput: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Error handling middleware
 */
export declare const errorHandler: (err: Error, req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * CORS configuration middleware
 */
export declare const configureCors: (allowedOrigins: string[]) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Security headers middleware
 */
export declare const securityHeaders: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Request logging middleware
 */
export declare const requestLogger: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Health check middleware
 */
export declare const healthCheck: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=security.d.ts.map