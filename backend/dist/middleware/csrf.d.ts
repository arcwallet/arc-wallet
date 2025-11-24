import { Request, Response, NextFunction } from 'express';
/**
 * Generates a CSRF token and sets it as a cookie on the response.
 * This should be readable by client-side JavaScript.
 */
export declare const setCsrfCookie: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Validates the CSRF token for state-changing methods (POST, PUT, DELETE, PATCH).
 * The client must send the token from the cookie in the X-CSRF-Token header.
 */
export declare const validateCsrfToken: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=csrf.d.ts.map