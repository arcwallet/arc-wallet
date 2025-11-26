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
interface LogContext {
    [key: string]: unknown;
}
/**
 * Redact PII from a string
 */
export declare function redactPII(text: string): string;
/**
 * Redact PII from an object recursively
 */
export declare function redactObjectPII(obj: unknown): unknown;
/**
 * Secure Logger Class
 */
declare class SecureLogger {
    private prefix;
    constructor(prefix?: string);
    /**
     * Create a child logger with a prefix
     */
    child(prefix: string): SecureLogger;
    private log;
    debug(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, context?: LogContext): void;
    /**
     * Log an error with stack trace
     */
    errorWithStack(message: string, error: Error, context?: LogContext): void;
}
export declare const logger: SecureLogger;
export declare const otpLogger: SecureLogger;
export declare const authLogger: SecureLogger;
export declare const walletLogger: SecureLogger;
export declare const bridgeLogger: SecureLogger;
export declare const sessionLogger: SecureLogger;
export declare const apiLogger: SecureLogger;
export { SecureLogger };
//# sourceMappingURL=secureLogger.d.ts.map