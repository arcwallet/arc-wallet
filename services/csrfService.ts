/**
 * CSRF Service
 * Centralized management for CSRF tokens
 */

const API_BASE_URL = ((import.meta as any).env.VITE_PASSKEY_API_URL ?? ((import.meta as any).env.PROD ? `${window.location.origin}/api` : 'http://localhost:4000')).replace(/\/$/, '');
const resolveUrl = (path: string) => (API_BASE_URL ? `${API_BASE_URL}${path}` : path);

/**
 * Get CSRF token from cookie
 */
export const getCsrfToken = (): string | null => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|; )_csrf=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
};

/**
 * Refresh CSRF token by making a request to the session endpoint
 * This should set a new _csrf cookie
 */
export const refreshCsrfToken = async (): Promise<string | null> => {
    try {
        // We use /api/session as it's a safe GET request that should refresh the CSRF token
        // in the response headers/cookies
        await fetch(resolveUrl('/api/session'), {
            method: 'GET',
            credentials: 'include',
        });
        return getCsrfToken();
    } catch (error) {
        console.error('Failed to refresh CSRF token:', error);
        return null;
    }
};
