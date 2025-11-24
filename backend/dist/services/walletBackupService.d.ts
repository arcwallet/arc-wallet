/**
 * Wallet Backup Service
 * Handles encrypted wallet backup and restore for multi-device support
 */
import { Database } from '../models/Database.js';
export declare class WalletBackupService {
    private db;
    constructor(db: Database);
    /**
     * Store encrypted wallet backup
     */
    backupWallet(email: string, encryptedWallet: string, deviceId?: string): Promise<void>;
    /**
     * Retrieve encrypted wallet backup
     */
    getWalletBackup(email: string): Promise<{
        encryptedWallet: string;
        deviceId: string;
        updatedAt: string;
    } | null>;
    /**
     * Delete wallet backup
     */
    deleteWalletBackup(email: string): Promise<void>;
}
//# sourceMappingURL=walletBackupService.d.ts.map