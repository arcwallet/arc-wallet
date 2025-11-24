import { MagicLinkPayload, MagicUser } from './types.js';
export declare class MagicLinkService {
    private secret;
    constructor(secret: string);
    generateToken(user: MagicUser, ttlMs?: number): string;
    verifyToken(token: string): MagicLinkPayload | null;
    private sign;
}
//# sourceMappingURL=MagicLinkService.d.ts.map