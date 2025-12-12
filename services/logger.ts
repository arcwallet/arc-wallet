/**
 * Structured Logger for Arc Wallet SDK
 * 
 * Provides consistent logging across the SDK with support for:
 * - Multiple log levels (debug, info, warn, error)
 * - Context-aware logging
 * - Optional Sentry integration for production
 * - Environment-based configuration
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    SILENT = 4,
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

class Logger {
    private config: LoggerConfig;
    private sentryInitialized = false;

    constructor(config?: Partial<LoggerConfig>) {
        this.config = {
            level: LogLevel.INFO,
            enableConsole: typeof window !== 'undefined',
            enableSentry: false,
            environment: 'development',
            ...config,
        };

        if (this.config.enableSentry && this.config.sentryDsn) {
            this.initSentry();
        }
    }

    private initSentry(): void {
        if (typeof window === 'undefined' || this.sentryInitialized) {
            return;
        }

        // Lazy load Sentry only if needed
        // Note: This requires @sentry/browser to be installed by the user
        // We don't bundle it to keep SDK size small
        if (this.config.sentryDsn) {
            // Dynamic import wrapped in try-catch to avoid build errors
            // @ts-ignore - Sentry is optional dependency
            import('@sentry/browser')
                .then((Sentry: any) => {
                    Sentry.init({
                        dsn: this.config.sentryDsn,
                        environment: this.config.environment,
                        beforeSend(event: any) {
                            // Filter out sensitive data
                            if (event.extra) {
                                delete event.extra.privateKey;
                                delete event.extra.mnemonic;
                                delete event.extra.seed;
                            }
                            return event;
                        },
                    });
                    this.sentryInitialized = true;
                })
                .catch(() => {
                    // Sentry not installed, silently continue
                });
        }
    }

    private shouldLog(level: LogLevel): boolean {
        return level >= this.config.level;
    }

    private formatMessage(level: string, message: string, context?: LogContext): string {
        const timestamp = new Date().toISOString();
        const component = context?.component || 'SDK';
        return `[${timestamp}] [${level}] [${component}] ${message}`;
    }

    private sanitizeContext(context?: LogContext): LogContext | undefined {
        if (!context) return undefined;

        const sanitized = { ...context };

        // Remove sensitive fields
        const sensitiveKeys = ['privateKey', 'mnemonic', 'seed', 'password', 'secret'];
        sensitiveKeys.forEach(key => {
            if (key in sanitized) {
                delete sanitized[key];
            }
        });

        return sanitized;
    }

    debug(message: string, context?: LogContext): void {
        if (!this.shouldLog(LogLevel.DEBUG)) return;

        const sanitized = this.sanitizeContext(context);

        if (this.config.enableConsole) {
            console.debug(this.formatMessage('DEBUG', message, sanitized), sanitized || '');
        }
    }

    info(message: string, context?: LogContext): void {
        if (!this.shouldLog(LogLevel.INFO)) return;

        const sanitized = this.sanitizeContext(context);

        if (this.config.enableConsole) {
            console.info(this.formatMessage('INFO', message, sanitized), sanitized || '');
        }
    }

    warn(message: string, context?: LogContext): void {
        if (!this.shouldLog(LogLevel.WARN)) return;

        const sanitized = this.sanitizeContext(context);

        if (this.config.enableConsole) {
            console.warn(this.formatMessage('WARN', message, sanitized), sanitized || '');
        }

        if (this.config.enableSentry && this.sentryInitialized) {
            // @ts-ignore - Sentry is optional dependency
            import('@sentry/browser')
                .then(Sentry => {
                    Sentry.captureMessage(message, {
                        level: 'warning',
                        extra: sanitized,
                    });
                })
                .catch(() => { });
        }
    }

    error(message: string, errorOrContext?: Error | LogContext, context?: LogContext): void {
        if (!this.shouldLog(LogLevel.ERROR)) return;

        // Handle both signatures: error(msg, Error, ctx) and error(msg, ctx)
        let error: Error | undefined;
        let ctx: LogContext | undefined;

        if (errorOrContext instanceof Error) {
            error = errorOrContext;
            ctx = context;
        } else if (errorOrContext) {
            ctx = errorOrContext as LogContext;
        }

        const sanitized = this.sanitizeContext(ctx);

        if (this.config.enableConsole) {
            console.error(this.formatMessage('ERROR', message, sanitized), error || '', sanitized || '');
        }

        if (this.config.enableSentry && this.sentryInitialized) {
            // @ts-ignore - Sentry is optional dependency
            import('@sentry/browser')
                .then(Sentry => {
                    if (error) {
                        Sentry.captureException(error, {
                            extra: { message, ...sanitized },
                        });
                    } else {
                        Sentry.captureMessage(message, {
                            level: 'error',
                            extra: sanitized,
                        });
                    }
                })
                .catch(() => { });
        }
    }

    setLevel(level: LogLevel): void {
        this.config.level = level;
    }

    setContext(_context: LogContext): void {
        // This could be used to set global context for all logs
        // For now, we'll pass context per-log
    }
}

// Singleton logger instance
export const logger = new Logger({
    level: process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG,
    enableConsole: true,
    enableSentry: process.env.NODE_ENV === 'production',
    sentryDsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
});

// Export createLogger for custom instances
export function createLogger(config?: Partial<LoggerConfig>): Logger {
    return new Logger(config);
}
