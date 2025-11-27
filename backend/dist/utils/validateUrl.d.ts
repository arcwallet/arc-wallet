/**
 * URL Validation Utilities for Backend
 * Prevents open redirect and SSRF attacks
 */
/**
 * Validates a redirect URL to prevent open redirect attacks
 *
 * @param redirectUri - URL to validate
 * @param defaultPath - Default path if validation fails (default: '/')
 * @returns Safe redirect URL
 */
export declare function validateRedirectUrl(redirectUri: string | undefined | null, defaultPath?: string): string;
/**
 * Validates a webhook URL to prevent SSRF attacks
 *
 * @param url - Webhook URL to validate
 * @returns true if valid, false otherwise
 */
export declare function validateWebhookUrl(url: string | undefined | null): boolean;
/**
 * Sanitizes a URL by removing dangerous characters
 *
 * @param url - URL to sanitize
 * @returns Sanitized URL string
 */
export declare function sanitizeUrl(url: string | undefined | null): string;
/**
 * Validates an API callback URL
 *
 * @param url - URL to validate
 * @returns true if valid, false otherwise
 */
export declare function validateCallbackUrl(url: string | undefined | null): boolean;
declare const _default: {
    validateRedirectUrl: typeof validateRedirectUrl;
    validateWebhookUrl: typeof validateWebhookUrl;
    sanitizeUrl: typeof sanitizeUrl;
    validateCallbackUrl: typeof validateCallbackUrl;
};
export default _default;
//# sourceMappingURL=validateUrl.d.ts.map