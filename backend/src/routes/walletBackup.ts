/**
 * Wallet Backup Routes
 * Handles encrypted wallet backup and restore for multi-device support
 */

import { Router, Request, Response } from 'express';
import { WalletBackupService } from '../services/walletBackupService.js';

export function createWalletBackupRouter(backupService: WalletBackupService) {
    const router = Router();

    /**
     * POST /api/wallet-backup
     * Store encrypted wallet backup
     */
    router.post('/', async (req: Request, res: Response) => {
        try {
            const { email, encryptedWallet, deviceId } = req.body;

            // Validation
            if (!email || !encryptedWallet) {
                return res.status(400).json({
                    success: false,
                    error: 'Email and encrypted wallet data are required',
                    code: 'MISSING_FIELDS'
                });
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid email format',
                    code: 'INVALID_EMAIL'
                });
            }

            // Store encrypted wallet
            await backupService.backupWallet(email, encryptedWallet, deviceId);

            res.json({
                success: true,
                message: 'Wallet backup stored successfully'
            });

        } catch (error: any) {
            console.error('[WalletBackup] Backup error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to store wallet backup',
                code: 'BACKUP_FAILED',
                details: error.message
            });
        }
    });

    /**
     * GET /api/wallet-backup
     * Retrieve encrypted wallet backup
     */
    router.get('/', async (req: Request, res: Response) => {
        try {
            const { email } = req.query;

            if (!email || typeof email !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: 'Email is required',
                    code: 'MISSING_EMAIL'
                });
            }

            // Fetch encrypted wallet
            const backup = await backupService.getWalletBackup(email);

            if (!backup) {
                return res.status(404).json({
                    success: false,
                    error: 'No wallet backup found for this email',
                    code: 'BACKUP_NOT_FOUND'
                });
            }

            res.json({
                success: true,
                encryptedWallet: backup.encryptedWallet,
                deviceId: backup.deviceId,
                updatedAt: backup.updatedAt
            });

        } catch (error: any) {
            console.error('[WalletBackup] Fetch error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve wallet backup',
                code: 'FETCH_FAILED',
                details: error.message
            });
        }
    });

    /**
     * DELETE /api/wallet-backup
     * Delete wallet backup (for account deletion)
     */
    router.delete('/', async (req: Request, res: Response) => {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Email is required',
                    code: 'MISSING_EMAIL'
                });
            }

            await backupService.deleteWalletBackup(email);

            res.json({
                success: true,
                message: 'Wallet backup deleted successfully'
            });

        } catch (error: any) {
            console.error('[WalletBackup] Delete error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete wallet backup',
                code: 'DELETE_FAILED',
                details: error.message
            });
        }
    });

    return router;
}
