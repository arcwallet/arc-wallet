/**
 * Redirect URL Validation Utility
 * Prevents open redirect attacks by validating redirect URLs
 *
 * Based on security patterns from SendApp
 */

const BASE_URL = (import.meta as any).env.VITE_APP_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');

let BASE_ORIGIN: string;
try {
  BASE_ORIGIN = new URL(BASE_URL).origin;
} catch {
  BASE_ORIGIN = 'http://localhost:5173';
}

/**
 * Validates a redirect URL to prevent open redirect attacks
 *
 * Security checks:
 * - Rejects undefined or non-string inputs
 * - Only allows relative paths starting with single forward slash
 * - Blocks protocol-relative URLs (those with //)
 * - Verifies destination remains on same origin
 * - Returns sanitized pathname with query and hash
 * - Falls back to '/' on any errors
 *
 * @param redirectUri - The URL to validate
 * @returns Safe redirect path or '/' if invalid
 */
export function validateRedirectUrl(redirectUri: string | undefined | null): string {
  // Reject non-string or empty inputs
  if (!redirectUri || typeof redirectUri !== 'string') {
    return '/';
  }

  try {
    // Decode URI to catch obfuscated malicious URLs
    const decodedUri = decodeURIComponent(redirectUri);

    // Only allow relative paths starting with single forward slash
    // Block protocol-relative URLs (//evil.com)
    if (decodedUri.startsWith('/') && !decodedUri.startsWith('//')) {
      const url = new URL(decodedUri, BASE_URL);

      // Verify the destination remains on the same origin
      if (url.origin === BASE_ORIGIN) {
        // Return sanitized path with query and hash
        return url.pathname + url.search + url.hash;
      }
    }

    // Block absolute URLs to external domains
    if (decodedUri.startsWith('http://') || decodedUri.startsWith('https://')) {
      const url = new URL(decodedUri);
      if (url.origin === BASE_ORIGIN) {
        return url.pathname + url.search + url.hash;
      }
      console.warn(`[Security] Blocked redirect to external domain: ${url.origin}`);
      return '/';
    }

  } catch (error) {
    console.warn(`[Security] Invalid redirect URI provided: ${redirectUri}`, error);
  }

  return '/';
}

/**
 * Normalizes a URL for safe handling
 * Removes potentially dangerous characters and normalizes path
 *
 * @param url - URL to normalize
 * @returns Normalized URL string
 */
export function normalizeRedirectUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') {
    return '/';
  }

  try {
    // Remove null bytes and other dangerous characters
    const sanitized = url
      .replace(/\0/g, '') // Null bytes
      .replace(/[\x00-\x1F\x7F]/g, '') // Control characters
      .trim();

    // Validate the sanitized URL
    return validateRedirectUrl(sanitized);
  } catch {
    return '/';
  }
}

/**
 * Checks if a URL is safe to redirect to
 *
 * @param url - URL to check
 * @returns true if safe, false otherwise
 */
export function isSafeRedirectUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const validated = validateRedirectUrl(url);
  return validated !== '/' || url === '/';
}

export default validateRedirectUrl;
