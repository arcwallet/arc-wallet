/**
 * Recovery Routes
 * API endpoints for wallet recovery operations
 */
import { Router } from 'express';
import { RecoveryService } from '../services/recoveryService.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimitMiddleware, validateRequestBody } from '../middleware/security.js';
export function createRecoveryRoutes(db, config, sessionStore) {
    const router = Router();
    const recoveryService = new RecoveryService(db, config);
    /**
     * GET /recovery/backup-keys/:walletAddress
     * Get backup keys for a wallet
     */
    router.get('/backup-keys/:walletAddress', authMiddleware(config.JWT_SECRET, sessionStore), rateLimitMiddleware('general'), async (req, res, next) => {
        try {
            const { walletAddress } = req.params;
            if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid wallet address',
                    code: 'INVALID_ADDRESS',
                });
            }
            const backupKeys = await recoveryService.getBackupKeys(walletAddress);
            res.json({
                success: true,
                data: {
                    walletAddress,
                    backupKeys,
                    count: backupKeys.length,
                    maxAllowed: 3,
                },
            });
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /recovery/backup-keys/add/calldata
     * Build calldata for adding a backup key
     */
    router.post('/backup-keys/add/calldata', authMiddleware(config.JWT_SECRET, sessionStore), rateLimitMiddleware('general'), validateRequestBody(['x', 'y', 'deviceName']), async (req, res, next) => {
        try {
            const { x, y, deviceName } = req.body;
            const calldata = recoveryService.buildAddBackupKeyCalldata(x, y, deviceName);
            res.json({
                success: true,
                data: { calldata },
            });
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /recovery/backup-keys/remove/calldata
     * Build calldata for removing a backup key
     */
    router.post('/backup-keys/remove/calldata', authMiddleware(config.JWT_SECRET, sessionStore), rateLimitMiddleware('general'), validateRequestBody(['x', 'y']), async (req, res, next) => {
        try {
            const { x, y } = req.body;
            const calldata = recoveryService.buildRemoveBackupKeyCalldata(x, y);
            res.json({
                success: true,
                data: { calldata },
            });
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /recovery/backup-keys/recover/calldata
     * Build calldata for recovery with backup key
     */
    router.post('/backup-keys/recover/calldata', rateLimitMiddleware('recovery'), validateRequestBody(['newPrimaryX', 'newPrimaryY', 'backupX', 'backupY', 'webAuthnSignature']), async (req, res, next) => {
        try {
            const { newPrimaryX, newPrimaryY, backupX, backupY, webAuthnSignature } = req.body;
            const calldata = recoveryService.buildRecoverWithBackupKeyCalldata(newPrimaryX, newPrimaryY, backupX, backupY, webAuthnSignature);
            res.json({
                success: true,
                data: { calldata },
            });
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * GET /recovery/guardian-status/:walletAddress
     * Get guardian recovery status for a wallet
     */
    router.get('/guardian-status/:walletAddress', authMiddleware(config.JWT_SECRET, sessionStore), rateLimitMiddleware('general'), async (req, res, next) => {
        try {
            const { walletAddress } = req.params;
            if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid wallet address',
                    code: 'INVALID_ADDRESS',
                });
            }
            const status = await recoveryService.getGuardianRecoveryStatus(walletAddress);
            res.json({
                success: true,
                data: {
                    walletAddress,
                    ...status,
                    timeRemaining: status.initiated && status.executeAfter > Date.now() / 1000
                        ? Math.ceil((status.executeAfter - Date.now() / 1000) / 3600) + ' hours'
                        : null,
                },
            });
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /recovery/guardian/add/calldata
     * Build calldata for adding a guardian
     */
    router.post('/guardian/add/calldata', authMiddleware(config.JWT_SECRET, sessionStore), rateLimitMiddleware('general'), validateRequestBody(['guardianAddress']), async (req, res, next) => {
        try {
            const { guardianAddress } = req.body;
            if (!/^0x[a-fA-F0-9]{40}$/.test(guardianAddress)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid guardian address',
                    code: 'INVALID_ADDRESS',
                });
            }
            const calldata = recoveryService.buildAddGuardianCalldata(guardianAddress);
            res.json({
                success: true,
                data: { calldata },
            });
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /recovery/guardian/remove/calldata
     * Build calldata for removing a guardian
     */
    router.post('/guardian/remove/calldata', authMiddleware(config.JWT_SECRET, sessionStore), rateLimitMiddleware('general'), validateRequestBody(['guardianAddress']), async (req, res, next) => {
        try {
            const { guardianAddress } = req.body;
            const calldata = recoveryService.buildRemoveGuardianCalldata(guardianAddress);
            res.json({
                success: true,
                data: { calldata },
            });
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /recovery/guardian/threshold/calldata
     * Build calldata for setting guardian threshold
     */
    router.post('/guardian/threshold/calldata', authMiddleware(config.JWT_SECRET, sessionStore), rateLimitMiddleware('general'), validateRequestBody(['threshold']), async (req, res, next) => {
        try {
            const { threshold } = req.body;
            if (typeof threshold !== 'number' || threshold < 1) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid threshold',
                    code: 'INVALID_THRESHOLD',
                });
            }
            const calldata = recoveryService.buildSetGuardianThresholdCalldata(threshold);
            res.json({
                success: true,
                data: { calldata },
            });
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /recovery/guardian/initiate/calldata
     * Build calldata for initiating recovery
     */
    router.post('/guardian/initiate/calldata', rateLimitMiddleware('recovery'), validateRequestBody(['newX', 'newY']), async (req, res, next) => {
        try {
            const { newX, newY } = req.body;
            const calldata = recoveryService.buildInitiateRecoveryCalldata(newX, newY);
            res.json({
                success: true,
                data: { calldata },
            });
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /recovery/guardian/approve/calldata
     * Build calldata for approving recovery
     */
    router.post('/guardian/approve/calldata', rateLimitMiddleware('recovery'), async (req, res, next) => {
        try {
            const calldata = recoveryService.buildApproveRecoveryCalldata();
            res.json({
                success: true,
                data: { calldata },
            });
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /recovery/guardian/execute/calldata
     * Build calldata for executing recovery
     */
    router.post('/guardian/execute/calldata', rateLimitMiddleware('recovery'), async (req, res, next) => {
        try {
            const calldata = recoveryService.buildExecuteRecoveryCalldata();
            res.json({
                success: true,
                data: { calldata },
            });
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /recovery/guardian/cancel/calldata
     * Build calldata for canceling recovery
     */
    router.post('/guardian/cancel/calldata', authMiddleware(config.JWT_SECRET, sessionStore), rateLimitMiddleware('general'), async (req, res, next) => {
        try {
            const calldata = recoveryService.buildCancelRecoveryCalldata();
            res.json({
                success: true,
                data: { calldata },
            });
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /recovery/verify-backup-key
     * Verify if a backup key is valid
     */
    router.post('/verify-backup-key', rateLimitMiddleware('general'), validateRequestBody(['walletAddress', 'x', 'y']), async (req, res, next) => {
        try {
            const { walletAddress, x, y } = req.body;
            if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid wallet address',
                    code: 'INVALID_ADDRESS',
                });
            }
            const isValid = await recoveryService.isValidBackupKey(walletAddress, x, y);
            res.json({
                success: true,
                data: { isValid },
            });
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /recovery/verify-guardian
     * Verify if an address is a guardian
     */
    router.post('/verify-guardian', rateLimitMiddleware('general'), validateRequestBody(['walletAddress', 'guardianAddress']), async (req, res, next) => {
        try {
            const { walletAddress, guardianAddress } = req.body;
            if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress) || !/^0x[a-fA-F0-9]{40}$/.test(guardianAddress)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid address',
                    code: 'INVALID_ADDRESS',
                });
            }
            const isGuardian = await recoveryService.isGuardian(walletAddress, guardianAddress);
            res.json({
                success: true,
                data: { isGuardian },
            });
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
//# sourceMappingURL=recovery.js.map