/**
 * Wallet Backup Service
 * Handles encrypted wallet backup and restore for multi-device support
 */

import { Database } from '../models/Database.js';
import { promisify } from 'util';

export class WalletBackupService {
    constructor(private db: Database) { }

    /**
     * Store encrypted wallet backup
     */
    async backupWallet(email: string, encryptedWallet: string, deviceId?: string): Promise<void> {
        await this.db.waitForReady();

        // Use the internal db property to access run method
        const run: any = promisify((this.db as any).db.run.bind((this.db as any).db));

        await run(
            `INSERT OR REPLACE INTO wallet_backups (email, encrypted_wallet, device_id, updated_at)
       VALUES (?, ?, ?, datetime('now'))`,
            [email.toLowerCase(), encryptedWallet, deviceId || 'unknown']
        );

        console.log(`[WalletBackup] Stored encrypted wallet for ${email}`);
    }

    /**
     * Retrieve encrypted wallet backup
     */
    async getWalletBackup(email: string): Promise<{ encryptedWallet: string; deviceId: string; updatedAt: string } | null> {
        await this.db.waitForReady();

        const get: any = promisify((this.db as any).db.get.bind((this.db as any).db));

        const backup = await get(
            `SELECT encrypted_wallet, device_id, updated_at 
       FROM wallet_backups 
       WHERE email = ?`,
            [email.toLowerCase()]
        );

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
    async deleteWalletBackup(email: string): Promise<void> {
        await this.db.waitForReady();

        const run: any = promisify((this.db as any).db.run.bind((this.db as any).db));

        await run(
            `DELETE FROM wallet_backups WHERE email = ?`,
            [email.toLowerCase()]
        );

        console.log(`[WalletBackup] Deleted wallet backup for ${email}`);
    }
}
