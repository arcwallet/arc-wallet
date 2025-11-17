export interface MagicUser {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface MagicSession {
  id: string;
  userId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
}

export interface MagicLinkPayload {
  userId: string;
  email: string;
  issuedAt: number;
  expiresAt: number;
}
