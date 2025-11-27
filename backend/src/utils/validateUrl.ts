/**
 * URL Validation Utilities for Backend
 * Prevents open redirect and SSRF attacks
 */

// Allowed origins for redirects
const ALLOWED_ORIGINS = new Set([
  'https://app.arcwallet.network',
  'https://arcwallet.network',
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || []),
]);

/**
 * Validates a redirect URL to prevent open redirect attacks
 *
 * @param redirectUri - URL to validate
 * @param defaultPath - Default path if validation fails (default: '/')
 * @returns Safe redirect URL
 */
export function validateRedirectUrl(redirectUri: string | undefined | null, defaultPath = '/'): string {
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
      if (ALLOWED_ORIGINS.has(url.origin)) {
        return url.pathname + url.search + url.hash;
      }
      console.warn(`[Security] Blocked redirect to unauthorized origin: ${url.origin}`);
    }

  } catch (error) {
    console.warn(`[Security] Invalid redirect URI: ${redirectUri}`);
  }

  return defaultPath;
}

/**
 * Validates a webhook URL to prevent SSRF attacks
 *
 * @param url - Webhook URL to validate
 * @returns true if valid, false otherwise
 */
export function validateWebhookUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);

    // Only allow HTTPS
    if (parsed.protocol !== 'https:') {
      console.warn(`[Security] Webhook URL must use HTTPS: ${url}`);
      return false;
    }

    // Block localhost and private IPs
    const hostname = parsed.hostname.toLowerCase();
    const blockedPatterns = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '10.',
      '172.16.', '172.17.', '172.18.', '172.19.',
      '172.20.', '172.21.', '172.22.', '172.23.',
      '172.24.', '172.25.', '172.26.', '172.27.',
      '172.28.', '172.29.', '172.30.', '172.31.',
      '192.168.',
      '169.254.',
      'metadata.google',
      '169.254.169.254', // AWS metadata
    ];

    for (const pattern of blockedPatterns) {
      if (hostname.includes(pattern)) {
        console.warn(`[Security] Blocked webhook URL with internal hostname: ${hostname}`);
        return false;
      }
    }

    // Check for suspicious ports
    const port = parsed.port ? parseInt(parsed.port, 10) : 443;
    if (port !== 443 && port !== 80) {
      console.warn(`[Security] Non-standard port in webhook URL: ${port}`);
      // Allow but log - some webhooks use custom ports
    }

    return true;

  } catch (error) {
    console.warn(`[Security] Invalid webhook URL: ${url}`);
    return false;
  }
}

/**
 * Sanitizes a URL by removing dangerous characters
 *
 * @param url - URL to sanitize
 * @returns Sanitized URL string
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  return url
    .replace(/\0/g, '') // Null bytes
    .replace(/[\x00-\x1F\x7F]/g, '') // Control characters
    .replace(/javascript:/gi, '') // JavaScript protocol
    .replace(/data:/gi, '') // Data URLs
    .replace(/vbscript:/gi, '') // VBScript
    .trim();
}

/**
 * Validates an API callback URL
 *
 * @param url - URL to validate
 * @returns true if valid, false otherwise
 */
export function validateCallbackUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);

    // Only allow HTTP(S)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    // In production, require HTTPS
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      return false;
    }

    return true;

  } catch {
    return false;
  }
}

export default {
  validateRedirectUrl,
  validateWebhookUrl,
  sanitizeUrl,
  validateCallbackUrl,
};
