/**
 * Centralized Input Validation Middleware
 *
 * SECURITY FEATURES:
 * - Type validation with strict schemas
 * - SQL injection prevention
 * - XSS prevention
 * - Path traversal prevention
 * - Size limits
 * - Ethereum address validation
 * - Email validation (RFC 5322)
 */
import { z } from 'zod';
// ============================================
// VALIDATION SCHEMAS
// ============================================
/**
 * Ethereum address validation
 */
export const ethereumAddressSchema = z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format')
    .transform(val => val.toLowerCase());
/**
 * Transaction hash validation
 */
export const txHashSchema = z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash format')
    .transform(val => val.toLowerCase());
/**
 * Email validation (RFC 5322 simplified)
 */
export const emailSchema = z
    .string()
    .min(5, 'Email too short')
    .max(254, 'Email too long')
    .email('Invalid email format')
    .transform(val => val.toLowerCase().trim());
/**
 * UUID validation
 */
export const uuidSchema = z
    .string()
    .uuid('Invalid UUID format');
/**
 * Safe string - no SQL injection or XSS characters
 */
export const safeStringSchema = z
    .string()
    .max(1000, 'String too long')
    .refine(val => !/<script|javascript:|on\w+=/i.test(val), 'Potentially malicious content detected')
    .refine(val => !/['";]|--|\/\*|\*\/|union\s+select|drop\s+table/i.test(val), 'Potentially malicious SQL detected');
/**
 * Token amount validation (positive number string)
 */
export const tokenAmountSchema = z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'Invalid amount format')
    .refine(val => {
    const num = parseFloat(val);
    return num > 0 && num < Number.MAX_SAFE_INTEGER;
}, 'Amount must be positive and within safe range');
/**
 * OTP code validation
 */
export const otpCodeSchema = z
    .string()
    .length(6, 'OTP must be 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only digits');
/**
 * Pagination validation
 */
export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
/**
 * Path parameter - prevent traversal
 */
export const safePathSchema = z
    .string()
    .max(255)
    .refine(val => !/\.\.\/|\.\.\\|%2e%2e/i.test(val), 'Path traversal detected');
// ============================================
// COMMON REQUEST SCHEMAS
// ============================================
export const schemas = {
    // OTP Routes
    otpRequest: z.object({
        email: emailSchema,
    }),
    otpVerify: z.object({
        email: emailSchema,
        otpCode: otpCodeSchema,
    }),
    // Wallet Routes
    walletCreate: z.object({
        userId: uuidSchema,
        email: emailSchema.optional(),
    }),
    walletTransaction: z.object({
        from: ethereumAddressSchema,
        to: ethereumAddressSchema,
        amount: tokenAmountSchema,
        token: z.enum(['ARC', 'USDC', 'EURC', 'ETH']).optional(),
    }),
    // Bridge Routes
    bridgeStart: z.object({
        sourceChain: z.enum(['arc', 'sepolia', 'ethereum']),
        destinationChain: z.enum(['arc', 'sepolia', 'ethereum']),
        amount: tokenAmountSchema,
        token: z.string().max(10),
        recipient: ethereumAddressSchema.optional(),
    }),
    // MultiSig Routes
    multiSigCreate: z.object({
        name: safeStringSchema.max(100),
        owners: z.array(ethereumAddressSchema).min(1).max(10),
        threshold: z.number().int().min(1).max(10),
    }),
    multiSigApprove: z.object({
        transactionId: uuidSchema,
        signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
    }),
    // Passkey Routes
    passkeyRegisterStart: z.object({
        username: emailSchema,
        displayName: safeStringSchema.max(100).optional(),
    }),
    passkeyRegisterFinish: z.object({
        userId: uuidSchema,
        response: z.object({
            id: z.string(),
            rawId: z.string(),
            type: z.literal('public-key'),
            response: z.object({
                clientDataJSON: z.string(),
                attestationObject: z.string(),
            }),
        }),
    }),
    // Agent Routes
    agentChat: z.object({
        message: safeStringSchema.max(2000),
        sessionId: uuidSchema.optional(),
    }),
};
// ============================================
// VALIDATION MIDDLEWARE
// ============================================
/**
 * Validate request body against a schema
 */
export function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const errors = result.error.issues.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
            }));
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: errors,
            });
        }
        req.body = result.data;
        next();
    };
}
/**
 * Validate query parameters against a schema
 */
export function validateQuery(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            const errors = result.error.issues.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
            }));
            return res.status(400).json({
                success: false,
                error: 'Invalid query parameters',
                code: 'INVALID_QUERY',
                details: errors,
            });
        }
        req.query = result.data;
        next();
    };
}
/**
 * Validate URL parameters against a schema
 */
export function validateParams(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.params);
        if (!result.success) {
            const errors = result.error.issues.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
            }));
            return res.status(400).json({
                success: false,
                error: 'Invalid URL parameters',
                code: 'INVALID_PARAMS',
                details: errors,
            });
        }
        req.params = result.data;
        next();
    };
}
/**
 * Combined validation for body, query, and params
 */
export function validate(options) {
    return (req, res, next) => {
        const errors = [];
        // Validate body
        if (options.body) {
            const result = options.body.safeParse(req.body);
            if (!result.success) {
                result.error.issues.forEach((e) => {
                    errors.push({
                        location: 'body',
                        field: e.path.join('.'),
                        message: e.message,
                    });
                });
            }
            else {
                req.body = result.data;
            }
        }
        // Validate query
        if (options.query) {
            const result = options.query.safeParse(req.query);
            if (!result.success) {
                result.error.issues.forEach((e) => {
                    errors.push({
                        location: 'query',
                        field: e.path.join('.'),
                        message: e.message,
                    });
                });
            }
            else {
                req.query = result.data;
            }
        }
        // Validate params
        if (options.params) {
            const result = options.params.safeParse(req.params);
            if (!result.success) {
                result.error.issues.forEach((e) => {
                    errors.push({
                        location: 'params',
                        field: e.path.join('.'),
                        message: e.message,
                    });
                });
            }
            else {
                req.params = result.data;
            }
        }
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: errors,
            });
        }
        next();
    };
}
// ============================================
// HELPER VALIDATORS
// ============================================
/**
 * Validate Ethereum address
 */
export function isValidEthereumAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}
/**
 * Validate transaction hash
 */
export function isValidTxHash(hash) {
    return /^0x[a-fA-F0-9]{64}$/.test(hash);
}
/**
 * Sanitize string to prevent XSS
 */
export function sanitizeHtml(input) {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}
/**
 * Check for potential SQL injection
 */
export function hasSqlInjection(input) {
    const patterns = [
        /('|"|\s)OR\s+('|"|\d)/i,
        /('|"|\s)AND\s+('|"|\d)/i,
        /union\s+select/i,
        /insert\s+into/i,
        /drop\s+table/i,
        /delete\s+from/i,
        /update\s+\w+\s+set/i,
        /--\s*$/,
        /\/\*.*\*\//,
        /;\s*(drop|delete|update|insert)/i,
    ];
    return patterns.some(pattern => pattern.test(input));
}
/**
 * Validate and sanitize file path
 */
export function sanitizePath(path) {
    // Check for path traversal
    if (/\.\.\/|\.\.\\|%2e%2e/i.test(path)) {
        return null;
    }
    // Remove any null bytes
    const sanitized = path.replace(/\0/g, '');
    // Only allow alphanumeric, dash, underscore, dot, and forward slash
    if (!/^[a-zA-Z0-9\-_./]+$/.test(sanitized)) {
        return null;
    }
    return sanitized;
}
// ============================================
// URL VALIDATION (Inspired by SendApp)
// ============================================
// Allowed origins for redirects
const ALLOWED_ORIGINS = [
    'https://app.arcwallet.network',
    'https://arcwallet.network',
    'http://localhost:5173',
    'http://localhost:3000',
];
/**
 * Validate redirect URL to prevent open redirect attacks
 * Based on security patterns from SendApp
 */
export function validateRedirectUrl(redirectUri, defaultPath = '/') {
    if (!redirectUri || typeof redirectUri !== 'string') {
        return defaultPath;
    }
    try {
        const decodedUri = decodeURIComponent(redirectUri);
        // Allow relative paths (must start with / but not //)
        if (decodedUri.startsWith('/') && !decodedUri.startsWith('//')) {
            return decodedUri;
        }
        // Check absolute URLs against allowed origins
        if (decodedUri.startsWith('http://') || decodedUri.startsWith('https://')) {
            const url = new URL(decodedUri);
            if (ALLOWED_ORIGINS.includes(url.origin)) {
                return url.pathname + url.search + url.hash;
            }
            console.warn(`[Security] Blocked redirect to unauthorized origin: ${url.origin}`);
        }
    }
    catch (error) {
        console.warn(`[Security] Invalid redirect URI: ${redirectUri}`);
    }
    return defaultPath;
}
/**
 * Validate webhook URL to prevent SSRF attacks
 */
export function validateWebhookUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }
    try {
        const parsed = new URL(url);
        // Only allow HTTPS in production
        if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
            return false;
        }
        // Block localhost and private IPs
        const hostname = parsed.hostname.toLowerCase();
        const blockedPatterns = [
            'localhost', '127.0.0.1', '0.0.0.0', '::1',
            '10.', '172.16.', '172.17.', '172.18.', '172.19.',
            '172.20.', '172.21.', '172.22.', '172.23.',
            '172.24.', '172.25.', '172.26.', '172.27.',
            '172.28.', '172.29.', '172.30.', '172.31.',
            '192.168.', '169.254.', 'metadata.google', '169.254.169.254',
        ];
        for (const pattern of blockedPatterns) {
            if (hostname.includes(pattern)) {
                console.warn(`[Security] Blocked webhook URL with internal hostname: ${hostname}`);
                return false;
            }
        }
        return true;
    }
    catch {
        return false;
    }
}
/**
 * URL schema for Zod validation
 */
export const urlSchema = z
    .string()
    .url('Invalid URL format')
    .refine((val) => {
    try {
        const url = new URL(val);
        return ['http:', 'https:'].includes(url.protocol);
    }
    catch {
        return false;
    }
}, 'URL must use HTTP or HTTPS protocol');
/**
 * Webhook URL schema
 */
export const webhookUrlSchema = z
    .string()
    .url('Invalid webhook URL')
    .refine(validateWebhookUrl, 'Invalid or blocked webhook URL');
//# sourceMappingURL=validation.js.map