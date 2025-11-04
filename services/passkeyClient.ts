const API_BASE = import.meta.env.VITE_PASSKEY_API_URL ?? 'http://localhost:4000';

class PasskeyClientError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
};

async function postJSON<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
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

  return text ? (JSON.parse(text) as ApiResponse<T>) : ({ success: true } as ApiResponse<T>);
}

async function getJSON<T>(path: string): Promise<ApiResponse<T>> {
  const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
  const response = await fetch(`${base}${path}`, { method: 'GET' });
  const text = await response.text();
  if (!response.ok) {
    throw new PasskeyClientError(text || response.statusText, response.status);
  }
  return text ? (JSON.parse(text) as ApiResponse<T>) : ({ success: true } as ApiResponse<T>);
}

async function deleteJSON<T>(path: string): Promise<ApiResponse<T>> {
  const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
  const response = await fetch(`${base}${path}`, { method: 'DELETE' });
  const text = await response.text();
  if (!response.ok) {
    throw new PasskeyClientError(text || response.statusText, response.status);
  }
  return text ? (JSON.parse(text) as ApiResponse<T>) : ({ success: true } as ApiResponse<T>);
}

export interface SessionKey {
  address: string;
  privateKey: string;
  expiresAt: string;
}

interface RegistrationStartData {
  options: any;
}

interface AuthenticationStartData {
  options: any;
}

interface AuthenticationFinishData {
  sessionKey: SessionKey;
  user: { id: string; username: string; displayName: string };
}

export interface SessionKeySummary {
  id: string;
  address: string;
  createdAt: string;
  expiresAt: string;
}

interface GetSessionKeysData {
  sessionKeys: SessionKeySummary[];
  stats: {
    totalActive: number;
    totalGenerated: number;
    oldestActive?: string;
    newestActive?: string;
  };
}

export const passkeyClient = {
  beginRegistration: (username: string, displayName?: string) =>
    postJSON<RegistrationStartData>('/passkeys/register/start', { username, displayName: displayName ?? username }),

  finishRegistration: (username: string, credential: unknown) =>
    postJSON<unknown>('/passkeys/register/finish', { username, credential }),

  beginAuthentication: (username?: string) => postJSON<AuthenticationStartData>('/passkeys/auth/start', username ? { username } : {}),

  finishAuthentication: (credential: unknown) =>
    postJSON<AuthenticationFinishData>('/passkeys/auth/finish', { credential }),

  getSessionKeys: (userId: string) => getJSON<GetSessionKeysData>(`/passkeys/session-keys/${userId}`),

  revokeSessionKey: (sessionKeyId: string) => deleteJSON<unknown>(`/passkeys/session-keys/${sessionKeyId}`),

  // Devices (passkey credentials)
  getDevices: (userId: string) => getJSON<Array<{
    id: string;
    credentialID: string;
    transports?: AuthenticatorTransport[];
    createdAt: string;
    deviceType: string;
    backedUp: boolean;
    counter: number;
  }>>(`/passkeys/devices/${userId}`),

  deleteDevice: (credentialId: string) => deleteJSON(`/passkeys/devices/${credentialId}`),

  PasskeyClientError,
};

export { PasskeyClientError };
