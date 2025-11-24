const API_BASE = ((import.meta as any).env.VITE_PASSKEY_API_URL ?? ((import.meta as any).env.PROD ? `${window.location.origin}/api` : 'http://localhost:4000')).replace(/\/$/, '');
const resolveUrl = (path: string) => `${API_BASE}${path}`;

import { getCsrfToken, refreshCsrfToken } from './csrfService';

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  email?: string;
}

const handleResponse = async <T>(response: Response): Promise<T> => {
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  const body = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = body?.error || response.statusText;
    throw new Error(message);
  }

  return body as T;
};

export const sessionApi = {
  async sendLink(email: string, timeoutMs = 30000, isRetry = false) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      const response = await fetch(resolveUrl('/api/send-link'), {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ email }),
        signal: controller.signal,
      });

      // Handle CSRF token expiration
      if (response.status === 403 && !isRetry) {
        const clone = response.clone();
        try {
          const errorBody = await clone.json();
          if (errorBody.code === 'CSRF_VALIDATION_FAILED' || errorBody.error === 'Invalid CSRF token') {
            await refreshCsrfToken();
            return sessionApi.sendLink(email, timeoutMs, true);
          }
        } catch (e) {
          // Ignore JSON parse error
        }
      }

      return handleResponse<ApiResponse>(response);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Send link request timed out. Please try again.');
      }
      throw new Error(error instanceof Error ? error.message : 'Failed to send magic link. Please try again.');
    } finally {
      window.clearTimeout(timer);
    }
  },

  async verify(token: string, timeoutMs = 15000, isRetry = false) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      const response = await fetch(resolveUrl('/api/verify'), {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ token }),
        signal: controller.signal,
      });

      // Handle CSRF token expiration
      if (response.status === 403 && !isRetry) {
        const clone = response.clone();
        try {
          const errorBody = await clone.json();
          if (errorBody.code === 'CSRF_VALIDATION_FAILED' || errorBody.error === 'Invalid CSRF token') {
            await refreshCsrfToken();
            return sessionApi.verify(token, timeoutMs, true);
          }
        } catch (e) {
          // Ignore JSON parse error
        }
      }

      return handleResponse<ApiResponse>(response);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Verification timed out. Please try again.');
      }
      throw new Error(error instanceof Error ? error.message : 'Verification failed. Please try again.');
    } finally {
      window.clearTimeout(timer);
    }
  },

  async getSession(timeoutMs = 3000): Promise<{ email: string; hasWallet?: boolean; walletAddress?: string; userId?: string } | null> {
    // getSession is used for refreshing token, so no retry logic here to avoid loops
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(resolveUrl('/api/session'), {
        credentials: 'include',
        signal: controller.signal,
      });
      if (response.status === 401) {
        return null;
      }
      const body = await handleResponse<ApiResponse<{ email: string; hasWallet?: boolean; walletAddress?: string; userId?: string }>>(response);
      return body?.data ?? null;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.warn('Session request timed out');
        return null;
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  },

  async logout(isRetry = false) {
    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    const response = await fetch(resolveUrl('/api/logout'), {
      method: 'POST',
      credentials: 'include',
      headers,
    });

    // Handle CSRF token expiration
    if (response.status === 403 && !isRetry) {
      const clone = response.clone();
      try {
        const errorBody = await clone.json();
        if (errorBody.code === 'CSRF_VALIDATION_FAILED' || errorBody.error === 'Invalid CSRF token') {
          await refreshCsrfToken();
          return sessionApi.logout(true);
        }
      } catch (e) {
        // Ignore JSON parse error
      }
    }

    return handleResponse<ApiResponse>(response);
  },
};
