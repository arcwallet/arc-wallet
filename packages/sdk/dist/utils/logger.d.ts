/**
 * Structured Logger for Arc Wallet SDK
 *
 * Provides consistent logging across the SDK with support for:
 * - Multiple log levels (debug, info, warn, error)
 * - Context-aware logging
 * - Optional Sentry integration for production
 * - Environment-based configuration
 */
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    SILENT = 4
}
export interface LogContext {
    component?: string;
    userId?: string;
    action?: string;
    [key: string]: any;
}
export interface LoggerConfig {
    level: LogLevel;
    enableConsole: boolean;
    enableSentry: boolean;
    sentryDsn?: string;
    environment?: string;
}
declare class Logger {
    private config;
    private sentryInitialized;
    constructor(config?: Partial<LoggerConfig>);
    private initSentry;
    private shouldLog;
    private formatMessage;
    private sanitizeContext;
    debug(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, error?: Error, context?: LogContext): void;
    setLevel(level: LogLevel): void;
    setContext(_context: LogContext): void;
}
export declare const logger: Logger;
export declare function createLogger(config?: Partial<LoggerConfig>): Logger;
export {};
