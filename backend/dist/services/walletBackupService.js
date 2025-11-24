/**
 * Wallet Backup Service
 * Handles encrypted wallet backup and restore for multi-device support
 */
import { promisify } from 'util';
export class WalletBackupService {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Store encrypted wallet backup
     */
    async backupWallet(email, encryptedWallet, deviceId) {
        await this.db.waitForReady();
        // Use the internal db property to access run method
        const run = promisify(this.db.db.run.bind(this.db.db));
        await run(`INSERT OR REPLACE INTO wallet_backups (email, encrypted_wallet, device_id, updated_at)
       VALUES (?, ?, ?, datetime('now'))`, [email.toLowerCase(), encryptedWallet, deviceId || 'unknown']);
        console.log(`[WalletBackup] Stored encrypted wallet for ${email}`);
    }
    /**
     * Retrieve encrypted wallet backup
     */
    async getWalletBackup(email) {
        await this.db.waitForReady();
        const get = promisify(this.db.db.get.bind(this.db.db));
        const backup = await get(`SELECT encrypted_wallet, device_id, updated_at 
       FROM wallet_backups 
       WHERE email = ?`, [email.toLowerCase()]);
        if (!backup) {
            return null;
        }
        return {
            encryptedWallet: backup.encrypted_wallet,
            deviceId: backup.device_id,
            updatedAt: backup.updated_at
        };
    }
    /**
     * Delete wallet backup
     */
    async deleteWalletBackup(email) {
        await this.db.waitForReady();
        const run = promisify(this.db.db.run.bind(this.db.db));
        await run(`DELETE FROM wallet_backups WHERE email = ?`, [email.toLowerCase()]);
        console.log(`[WalletBackup] Deleted wallet backup for ${email}`);
    }
}
//# sourceMappingURL=walletBackupService.js.map