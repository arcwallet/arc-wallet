import { ethers } from 'ethers';
import { randomUUID } from 'crypto';
export class SessionKeyManager {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Generate a new session key for a user
     */
    async generateSessionKey(userId, expirationHours = 24) {
        // Generate a new random private key
        const wallet = ethers.Wallet.createRandom();
        const privateKey = wallet.privateKey;
        const address = wallet.address;
        // Calculate expiration time
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + expirationHours);
        // Create session key in database
        const sessionKey = await this.db.createSessionKey({
            id: randomUUID(),
            userId,
            privateKey,
            address,
            expiresAt
        });
        return sessionKey;
    }
    /**
     * Get active session keys for a user
     */
    async getActiveSessionKeys(userId) {
        return this.db.getActiveSessionKeysByUserId(userId);
    }
    /**
     * Get the most recent active session key for a user
     */
    async getLatestSessionKey(userId) {
        const sessionKeys = await this.getActiveSessionKeys(userId);
        return sessionKeys.length > 0 ? sessionKeys[0] : null;
    }
    /**
     * Get a session key by its ID
     */
    async getSessionKeyById(sessionKeyId) {
        return this.db.getSessionKeyById(sessionKeyId);
    }
    /**
     * Revoke a specific session key
     */
    async revokeSessionKey(sessionKeyId) {
        await this.db.revokeSessionKey(sessionKeyId);
    }
    /**
     * Revoke all session keys for a user
     */
    async revokeAllSessionKeys(userId) {
        const sessionKeys = await this.getActiveSessionKeys(userId);
        for (const sessionKey of sessionKeys) {
            await this.revokeSessionKey(sessionKey.id);
        }
    }
    /**
     * Cleanup expired session keys
     */
    async cleanupExpiredKeys() {
        await this.db.cleanupExpiredSessionKeys();
    }
    /**
     * Validate if a session key is still active
     */
    async validateSessionKey(privateKey) {
        // Get wallet address from private key
        const wallet = new ethers.Wallet(privateKey);
        const address = wallet.address;
        // Query active session key directly by address and private key
        const sessionKey = await this.db.getActiveSessionKeyByAddressAndPrivateKey(address, privateKey);
        return sessionKey ?? null;
    }
    /**
     * Get all active session keys (for validation purposes)
     * Note: This is not efficient for large datasets, consider indexing in production
     */
    async getAllActiveSessionKeys() {
        // This is a simplified implementation
        // In production, you'd want a proper query
        const db = this.db;
        const { promisify } = await import('util');
        await db.waitForReady();
        const all = promisify(db.db.all.bind(db.db));
        const rows = await all('SELECT * FROM session_keys WHERE expires_at > ? ORDER BY created_at DESC', [new Date().toISOString()]);
        return rows.map((row) => ({
            id: row.id,
            userId: row.user_id,
            privateKey: row.private_key,
            address: row.address,
            expiresAt: new Date(row.expires_at),
            createdAt: new Date(row.created_at)
        }));
    }
    /**
     * Create a session key from an existing private key (for migration purposes)
     */
    async importSessionKey(userId, privateKey, expirationHours = 24) {
        const wallet = new ethers.Wallet(privateKey);
        const address = wallet.address;
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + expirationHours);
        const sessionKey = await this.db.createSessionKey({
            id: randomUUID(),
            userId,
            privateKey,
            address,
            expiresAt
        });
        return sessionKey;
    }
    /**
     * Extend session key expiration
     */
    async extendSessionKey(sessionKeyId, additionalHours = 24) {
        // Get current session key
        const sessionKeys = await this.getAllActiveSessionKeys();
        const sessionKey = sessionKeys.find(key => key.id === sessionKeyId);
        if (!sessionKey) {
            return null;
        }
        // Calculate new expiration
        const newExpiresAt = new Date();
        newExpiresAt.setHours(newExpiresAt.getHours() + additionalHours);
        // Update in database
        const db = this.db;
        const { promisify } = await import('util');
        await db.waitForReady();
        const run = promisify(db.db.run.bind(db.db));
        await run('UPDATE session_keys SET expires_at = ? WHERE id = ?', [newExpiresAt.toISOString(), sessionKeyId]);
        // Return updated session key
        return {
            ...sessionKey,
            expiresAt: newExpiresAt
        };
    }
    /**
     * Get session key statistics for a user
     */
    async getSessionKeyStats(userId) {
        const activeKeys = await this.getActiveSessionKeys(userId);
        const db = this.db;
        const { promisify } = await import('util');
        await db.waitForReady();
        const get = promisify(db.db.get.bind(db.db));
        const totalResult = await get('SELECT COUNT(*) as count FROM session_keys WHERE user_id = ?', [userId]);
        const stats = {
            totalActive: activeKeys.length,
            totalGenerated: totalResult.count,
            oldestActive: activeKeys.length > 0 ? activeKeys[activeKeys.length - 1].createdAt : undefined,
            newestActive: activeKeys.length > 0 ? activeKeys[0].createdAt : undefined
        };
        return stats;
    }
}
//# sourceMappingURL=SessionKeyManager.js.map