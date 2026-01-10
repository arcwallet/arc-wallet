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
import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
/**
 * Ethereum address validation
 */
export declare const ethereumAddressSchema: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
/**
 * Transaction hash validation
 */
export declare const txHashSchema: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
/**
 * Email validation (RFC 5322 simplified)
 */
export declare const emailSchema: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
/**
 * UUID validation
 */
export declare const uuidSchema: z.ZodString;
/**
 * Safe string - no SQL injection or XSS characters
 */
export declare const safeStringSchema: z.ZodString;
/**
 * Token amount validation (positive number string)
 */
export declare const tokenAmountSchema: z.ZodString;
/**
 * OTP code validation
 */
export declare const otpCodeSchema: z.ZodString;
/**
 * Pagination validation
 */
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
/**
 * Path parameter - prevent traversal
 */
export declare const safePathSchema: z.ZodString;
export declare const schemas: {
    otpRequest: z.ZodObject<{
        email: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    }, z.core.$strip>;
    otpVerify: z.ZodObject<{
        email: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        otpCode: z.ZodString;
    }, z.core.$strip>;
    walletCreate: z.ZodObject<{
        userId: z.ZodString;
        email: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    }, z.core.$strip>;
    walletTransaction: z.ZodObject<{
        from: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        to: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        amount: z.ZodString;
        token: z.ZodOptional<z.ZodEnum<{
            USDC: "USDC";
            ETH: "ETH";
            EURC: "EURC";
            ARC: "ARC";
        }>>;
    }, z.core.$strip>;
    bridgeStart: z.ZodObject<{
        sourceChain: z.ZodEnum<{
            arc: "arc";
            ethereum: "ethereum";
            sepolia: "sepolia";
        }>;
        destinationChain: z.ZodEnum<{
            arc: "arc";
            ethereum: "ethereum";
            sepolia: "sepolia";
        }>;
        amount: z.ZodString;
        token: z.ZodString;
        recipient: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    }, z.core.$strip>;
    multiSigCreate: z.ZodObject<{
        name: z.ZodString;
        owners: z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
        threshold: z.ZodNumber;
    }, z.core.$strip>;
    multiSigApprove: z.ZodObject<{
        transactionId: z.ZodString;
        signature: z.ZodString;
    }, z.core.$strip>;
    passkeyRegisterStart: z.ZodObject<{
        username: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        displayName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    passkeyRegisterFinish: z.ZodObject<{
        userId: z.ZodString;
        response: z.ZodObject<{
            id: z.ZodString;
            rawId: z.ZodString;
            type: z.ZodLiteral<"public-key">;
            response: z.ZodObject<{
                clientDataJSON: z.ZodString;
                attestationObject: z.ZodString;
            }, z.core.$strip>;
        }, z.core.$strip>;
    }, z.core.$strip>;
    agentChat: z.ZodObject<{
        message: z.ZodString;
        sessionId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
};
/**
 * Validate request body against a schema
 */
export declare function validateBody<T>(schema: ZodSchema<T>): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Validate query parameters against a schema
 */
export declare function validateQuery<T>(schema: ZodSchema<T>): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Validate URL parameters against a schema
 */
export declare function validateParams<T>(schema: ZodSchema<T>): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Combined validation for body, query, and params
 */
export declare function validate(options: {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
}): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Validate Ethereum address
 */
export declare function isValidEthereumAddress(address: string): boolean;
/**
 * Validate transaction hash
 */
export declare function isValidTxHash(hash: string): boolean;
/**
 * Sanitize string to prevent XSS
 */
export declare function sanitizeHtml(input: string): string;
/**
 * Check for potential SQL injection
 */
export declare function hasSqlInjection(input: string): boolean;
/**
 * Validate and sanitize file path
 */
export declare function sanitizePath(path: string): string | null;
/**
 * Validate redirect URL to prevent open redirect attacks
 * Based on security patterns from SendApp
 */
export declare function validateRedirectUrl(redirectUri: string | undefined | null, defaultPath?: string): string;
/**
 * Validate webhook URL to prevent SSRF attacks
 */
export declare function validateWebhookUrl(url: string | undefined | null): boolean;
/**
 * URL schema for Zod validation
 */
export declare const urlSchema: z.ZodString;
/**
 * Webhook URL schema
 */
export declare const webhookUrlSchema: z.ZodString;
//# sourceMappingURL=validation.d.ts.map