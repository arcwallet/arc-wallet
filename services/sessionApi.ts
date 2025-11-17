const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const resolveUrl = (path: string) => `${API_BASE}${path}`;

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
  async sendLink(email: string, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(resolveUrl('/api/send-link'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        signal: controller.signal,
      });
      return handleResponse<ApiResponse>(response);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Send link request timed out. Please try again.');
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  },

  async verify(token: string, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(resolveUrl('/api/verify'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        signal: controller.signal,
      });
      return handleResponse<ApiResponse>(response);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Verification timed out. Please try again.');
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  },

  async getSession(timeoutMs = 8000): Promise<{ email: string } | null> {
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
    const response = await fetch(resolveUrl('/api/logout'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<ApiResponse>(response);
  },
};
