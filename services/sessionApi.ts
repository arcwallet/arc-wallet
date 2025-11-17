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
  async sendLink(email: string) {
    const response = await fetch(resolveUrl('/api/send-link'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return handleResponse<ApiResponse>(response);
  },

  async verify(token: string) {
    const response = await fetch(resolveUrl('/api/verify'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return handleResponse<ApiResponse>(response);
  },

  async getSession(): Promise<{ email: string } | null> {
    const response = await fetch(resolveUrl('/api/session'), { credentials: 'include' });
    if (response.status === 401) {
      return null;
    }
    const body = await handleResponse<ApiResponse<{ email: string }>>(response);
    return body?.data ?? null;
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
