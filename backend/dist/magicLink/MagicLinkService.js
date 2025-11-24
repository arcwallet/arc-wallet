import crypto from 'crypto';
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const toBase64Url = (input) => Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
const fromBase64Url = (input) => {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4;
    const padded = normalized + (pad ? '='.repeat(4 - pad) : '');
    return Buffer.from(padded, 'base64').toString();
};
export class MagicLinkService {
    secret;
    constructor(secret) {
        this.secret = secret;
    }
    generateToken(user, ttlMs = MAGIC_LINK_TTL_MS) {
        const payload = {
            userId: user.id,
            email: user.email,
            issuedAt: Date.now(),
            expiresAt: Date.now() + ttlMs,
        };
        const encodedPayload = toBase64Url(JSON.stringify(payload));
        const signature = this.sign(encodedPayload);
        return `${encodedPayload}.${signature}`;
    }
    verifyToken(token) {
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
            const payload = JSON.parse(fromBase64Url(encodedPayload));
            if (Date.now() > payload.expiresAt) {
                return null;
            }
            return payload;
        }
        catch {
            return null;
        }
    }
    sign(payload) {
        return crypto.createHmac('sha256', this.secret).update(payload).digest('base64url');
    }
}
//# sourceMappingURL=MagicLinkService.js.map