/**
 * Secure Logger Utility
 *
 * SECURITY FEATURES:
 * - PII redaction (emails, IPs, wallet addresses)
 * - Structured logging format
 * - Log level filtering
 * - Sensitive data masking
 * - Log injection prevention
 */
// PII patterns to redact
const PII_PATTERNS = {
    // Email: example@domain.com -> e***e@d***.com
    email: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+)\.([a-zA-Z]{2,})/g,
    // IP address: 192.168.1.100 -> 192.168.1.xxx
    ipv4: /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/g,
    // Ethereum address: 0x1234...5678 (show first 6 and last 4)
    ethAddress: /0x[a-fA-F0-9]{40}/g,
    // Private key (if accidentally logged)
    privateKey: /0x[a-fA-F0-9]{64}/g,
    // Session tokens (base64url format)
    sessionToken: /[A-Za-z0-9_-]{43}/g,
    // Credit card numbers
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    // Phone numbers
    phone: /\+?\d{1,3}[\s-]?\(?\d{2,3}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}/g,
    // JWT tokens
    jwt: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
};
/**
 * Mask email address for logging
 */
function maskEmail(email) {
    const [local, domain] = email.split('@');
    if (!domain)
        return '***@***';
    const [domainName, tld] = domain.split('.');
    const maskedLocal = local.length > 2
        ? `${local[0]}***${local[local.length - 1]}`
        : '***';
    const maskedDomain = domainName && domainName.length > 1
        ? `${domainName[0]}***`
        : '***';
    return `${maskedLocal}@${maskedDomain}.${tld || '***'}`;
}
/**
 * Mask Ethereum address
 */
function maskEthAddress(address) {
    if (address.length !== 42)
        return '0x***';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
/**
 * Mask IP address
 */
function maskIpAddress(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4)
        return 'xxx.xxx.xxx.xxx';
    return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
}
/**
 * Redact PII from a string
 */
export function redactPII(text) {
    let redacted = text;
    // Redact emails
    redacted = redacted.replace(PII_PATTERNS.email, (match) => maskEmail(match));
    // Redact IPv4 addresses
    redacted = redacted.replace(PII_PATTERNS.ipv4, (match) => maskIpAddress(match));
    // Redact Ethereum addresses
    redacted = redacted.replace(PII_PATTERNS.ethAddress, (match) => maskEthAddress(match));
    // Completely redact private keys
    redacted = redacted.replace(PII_PATTERNS.privateKey, '[REDACTED_PRIVATE_KEY]');
    // Redact session tokens
    redacted = redacted.replace(PII_PATTERNS.sessionToken, '[REDACTED_TOKEN]');
    // Redact credit card numbers
    redacted = redacted.replace(PII_PATTERNS.creditCard, '[REDACTED_CC]');
    // Redact phone numbers
    redacted = redacted.replace(PII_PATTERNS.phone, '[REDACTED_PHONE]');
    // Redact JWT tokens
    redacted = redacted.replace(PII_PATTERNS.jwt, '[REDACTED_JWT]');
    return redacted;
}
/**
 * Redact PII from an object recursively
 */
export function redactObjectPII(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (typeof obj === 'string') {
        return redactPII(obj);
    }
    if (Array.isArray(obj)) {
        return obj.map(item => redactObjectPII(item));
    }
    if (typeof obj === 'object') {
        const redacted = {};
        for (const [key, value] of Object.entries(obj)) {
            // Skip sensitive field names entirely
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('password') ||
                lowerKey.includes('secret') ||
                lowerKey.includes('privatekey') ||
                lowerKey.includes('apikey') ||
                lowerKey.includes('token') && !lowerKey.includes('tokenaddress')) {
                redacted[key] = '[REDACTED]';
                continue;
            }
            redacted[key] = redactObjectPII(value);
        }
        return redacted;
    }
    return obj;
}
/**
 * Prevent log injection by sanitizing input
 */
function sanitizeLogInput(input) {
    // Remove or escape newlines and control characters
    return input
        .replace(/[\r\n]/g, ' ')
        .replace(/[\x00-\x1F\x7F]/g, '')
        .slice(0, 10000); // Limit log message length
}
/**
 * Get current log level from environment
 */
function getLogLevel() {
    const level = process.env.LOG_LEVEL?.toLowerCase();
    if (['debug', 'info', 'warn', 'error'].includes(level)) {
        return level;
    }
    return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}
const LOG_LEVEL_PRIORITY = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
/**
 * Check if a log level should be output
 */
function shouldLog(level) {
    const currentLevel = getLogLevel();
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel];
}
/**
 * Format log entry
 */
function formatLogEntry(level, message, context) {
    const timestamp = new Date().toISOString();
    const sanitizedMessage = sanitizeLogInput(redactPII(message));
    const redactedContext = context ? redactObjectPII(context) : undefined;
    const entry = {
        timestamp,
        level,
        message: sanitizedMessage,
    };
    if (redactedContext) {
        entry.context = redactedContext;
    }
    // In production, use JSON format for log aggregation
    if (process.env.NODE_ENV === 'production') {
        return JSON.stringify(entry);
    }
    // In development, use readable format
    const contextStr = redactedContext
        ? ` ${JSON.stringify(redactedContext)}`
        : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${sanitizedMessage}${contextStr}`;
}
/**
 * Secure Logger Class
 */
class SecureLogger {
    prefix;
    constructor(prefix = '') {
        this.prefix = prefix;
    }
    /**
     * Create a child logger with a prefix
     */
    child(prefix) {
        const fullPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix;
        return new SecureLogger(fullPrefix);
    }
    log(level, message, context) {
        if (!shouldLog(level))
            return;
        const fullMessage = this.prefix ? `[${this.prefix}] ${message}` : message;
        const formatted = formatLogEntry(level, fullMessage, context);
        switch (level) {
            case 'debug':
                console.debug(formatted);
                break;
            case 'info':
                console.info(formatted);
                break;
            case 'warn':
                console.warn(formatted);
                break;
            case 'error':
                console.error(formatted);
                break;
        }
    }
    debug(message, context) {
        this.log('debug', message, context);
    }
    info(message, context) {
        this.log('info', message, context);
    }
    warn(message, context) {
        this.log('warn', message, context);
    }
    error(message, context) {
        this.log('error', message, context);
    }
    /**
     * Log an error with stack trace
     */
    errorWithStack(message, error, context) {
        this.error(message, {
            ...context,
            error: {
                name: error.name,
                message: error.message,
                // Only include stack in development
                ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
            },
        });
    }
}
// Default logger instance
export const logger = new SecureLogger();
// Create child loggers for different modules
export const otpLogger = logger.child('OTP');
export const authLogger = logger.child('Auth');
export const walletLogger = logger.child('Wallet');
export const bridgeLogger = logger.child('Bridge');
export const sessionLogger = logger.child('Session');
export const apiLogger = logger.child('API');
// Export for custom prefixes
export { SecureLogger };
//# sourceMappingURL=secureLogger.js.map