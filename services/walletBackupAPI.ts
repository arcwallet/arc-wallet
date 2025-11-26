/**
 * Wallet Backup API
 * Client-side API for encrypted wallet backup and restore
 */

const BACKEND_URL = (import.meta as any).env.VITE_BACKEND_URL || 'https://arcwallet-backend.onrender.com';

export interface WalletBackup {
    encryptedWallet: string;
    deviceId: string;
    updatedAt: string;
}

export class WalletBackupAPI {
    /**
     * Backup encrypted wallet to backend
     */
    static async backupWallet(email: string, encryptedWallet: string, deviceId?: string): Promise<void> {
        const response = await fetch(`${BACKEND_URL}/api/wallet-backup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                encryptedWallet,
                deviceId: deviceId || this.getDeviceId(),
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to backup wallet');
        }

        console.log('[WalletBackup] Wallet backed up successfully');
    }

    /**
     * Restore encrypted wallet from backend
     */
    static async restoreWallet(email: string): Promise<WalletBackup | null> {
        const response = await fetch(`${BACKEND_URL}/api/wallet-backup?email=${encodeURIComponent(email)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (response.status === 404) {
            // No backup found
            return null;
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to restore wallet');
        }

        const data = await response.json();
        console.log('[WalletBackup] Wallet restored successfully');

        return {
            encryptedWallet: data.encryptedWallet,
            deviceId: data.deviceId,
            updatedAt: data.updatedAt,
        };
    }

    /**
     * Delete wallet backup from backend
     */
    static async deleteWallet(email: string): Promise<void> {
        const response = await fetch(`${BACKEND_URL}/api/wallet-backup`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete wallet backup');
        }

        console.log('[WalletBackup] Wallet backup deleted successfully');
    }

    /**
     * Get unique device ID
     */
    private static getDeviceId(): string {
        let deviceId = localStorage.getItem('arcwallet:device-id');
        if (!deviceId) {
            deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('arcwallet:device-id', deviceId);
        }
        return deviceId;
    }
}
