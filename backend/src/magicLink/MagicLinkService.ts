import crypto from 'crypto';
import { MagicLinkPayload, MagicUser } from './types.js';

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

const toBase64Url = (input: string) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');

const fromBase64Url = (input: string) => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = normalized + (pad ? '='.repeat(4 - pad) : '');
  return Buffer.from(padded, 'base64').toString();
};

export class MagicLinkService {
  private secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  generateToken(user: MagicUser, ttlMs: number = MAGIC_LINK_TTL_MS): string {
    const payload: MagicLinkPayload = {
      userId: user.id,
      email: user.email,
      issuedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const signature = this.sign(encodedPayload);
    return `${encodedPayload}.${signature}`;
  }

  verifyToken(token: string): MagicLinkPayload | null {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) {
      return null;
    }

    const expectedSignature = this.sign(encodedPayload);
    const provided = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      return null;
    }

    try {
      const payload = JSON.parse(fromBase64Url(encodedPayload)) as MagicLinkPayload;
      if (Date.now() > payload.expiresAt) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  private sign(payload: string) {
    return crypto.createHmac('sha256', this.secret).update(payload).digest('base64url');
  }
}
