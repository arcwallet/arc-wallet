import { randomBytes } from 'crypto';
const CSRF_HEADER = 'X-CSRF-Token';
const CSRF_COOKIE_NAME = '_csrf';
/**
 * Generates a CSRF token and sets it as a cookie on the response.
 * This should be readable by client-side JavaScript.
 */
export const setCsrfCookie = (req, res, next) => {
    const csrfToken = req.cookies[CSRF_COOKIE_NAME];
    if (!csrfToken) {
        const newCsrfToken = randomBytes(16).toString('hex');
        res.cookie(CSRF_COOKIE_NAME, newCsrfToken, {
            httpOnly: false, // Client-side script needs to read this
            sameSite: 'lax',
            secure: false, // Allow HTTP in development
            path: '/',
        });
    }
    next();
};
// Routes that don't require CSRF validation (public endpoints)
// OTP/Circle endpoints are exempt because email verification provides security
// Passkey endpoints are exempt because WebAuthn provides cryptographic security
const CSRF_EXEMPT_ROUTES = [
    '/api/send-link',
    '/api/verify',
    '/api/otp', // Simple OTP routes
    '/api/circle', // Circle OTP routes (email verification provides security)
    '/health',
    '/passkeys', // All passkey routes exempt (WebAuthn provides cryptographic security)
];
/**
 * Validates the CSRF token for state-changing methods (POST, PUT, DELETE, PATCH).
 * The client must send the token from the cookie in the X-CSRF-Token header.
 */
export const validateCsrfToken = (req, res, next) => {
    const isStateChangingMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    // Skip CSRF validation for exempt routes
    const isExempt = CSRF_EXEMPT_ROUTES.some(route => req.path === route || req.path.startsWith(route));
    if (isStateChangingMethod && !isExempt) {
        const csrfTokenFromHeader = req.header(CSRF_HEADER);
        const csrfTokenFromCookie = req.cookies[CSRF_COOKIE_NAME];
        if (!csrfTokenFromHeader || !csrfTokenFromCookie || csrfTokenFromHeader !== csrfTokenFromCookie) {
            console.warn('CSRF token validation failed.', {
                url: req.url,
                ip: req.ip,
                header: csrfTokenFromHeader,
                cookie: csrfTokenFromCookie,
            });
            return res.status(403).json({
                success: false,
                error: 'Invalid CSRF token',
                code: 'CSRF_VALIDATION_FAILED'
            });
        }
    }
    next();
};
//# sourceMappingURL=csrf.js.map