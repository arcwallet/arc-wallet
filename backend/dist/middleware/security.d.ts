import { Request, Response, NextFunction } from 'express';
/**
 * General rate limiting middleware
 */
export declare const rateLimitMiddleware: (type?: "general" | "auth" | "registration" | "bridge" | "recovery") => (req: Request, res: Response, next: NextFunction) => Promise<void>;
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