const API_BASE = import.meta.env.VITE_PASSKEY_API_URL ?? 'http://localhost:4000';

class PasskeyClientError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new PasskeyClientError(text || response.statusText, response.status);
  }

  return text ? (JSON.parse(text) as T) : ({} as T);
}

export interface SessionKey {
  address: string;
  privateKey: string;
  expiresAt: string;
}

interface AuthenticationFinishResponse {
  success: boolean;
  sessionKey: SessionKey;
}

export const passkeyClient = {
  beginRegistration: (userId: string, username: string) =>
    postJSON('/passkeys/register/start', { userId, username }),

  finishRegistration: (userId: string, credential: unknown) =>
    postJSON('/passkeys/register/finish', { userId, credential }),

  beginAuthentication: (userId: string) => postJSON('/passkeys/auth/start', { userId }),

  finishAuthentication: (userId: string, credential: unknown) =>
    postJSON<AuthenticationFinishResponse>('/passkeys/auth/finish', { userId, credential }),

  PasskeyClientError,
};

export { PasskeyClientError };
