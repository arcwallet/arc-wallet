const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const resolveUrl = (path: string) => `${API_BASE}${path}`;

// Get CSRF token from cookie
const getCsrfToken = (): string | null => {
  const match = document.cookie.match(/(?:^|; )_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
};

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
  async sendLink(email: string, timeoutMs = 30000) {
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

  async verify(token: string, timeoutMs = 15000) {
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

  async getSession(timeoutMs = 3000): Promise<{ email: string } | null> {
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
      const body = await handleResponse<ApiResponse<{ email: string }>>(response);
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

  async logout() {
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
    return handleResponse<ApiResponse>(response);
  },
};
