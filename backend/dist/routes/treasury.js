import { Router } from 'express';
import { TreasuryController } from '../controllers/TreasuryController.js';
import { authMiddleware } from '../middleware/auth.js';
export function createTreasuryRoutes(db, config, sessionStore) {
    const router = Router();
    const controller = new TreasuryController(db);
    // Apply auth middleware to all treasury routes
    router.use(authMiddleware(config.JWT_SECRET, sessionStore));
    const asyncHandler = (fn) => (req, res, next) => {
        fn(req, res, next, req.user?.id).catch(next);
    };
    // ==================== Policy Routes ====================
    // Get policy for a wallet
    router.get('/policy/:walletAddress', asyncHandler((req, res, next, authUserId) => controller.getPolicy(req, res, next, authUserId)));
    // Create or update policy
    router.put('/policy/:walletAddress', asyncHandler((req, res, next, authUserId) => controller.createOrUpdatePolicy(req, res, next, authUserId)));
    // ==================== Transaction Routes ====================
    // Create a new treasury transaction
    router.post('/transactions', asyncHandler((req, res, next, authUserId) => controller.createTransaction(req, res, next, authUserId)));
    // Get transactions for a wallet
    router.get('/transactions/:walletAddress', asyncHandler((req, res, next, authUserId) => controller.getTransactions(req, res, next, authUserId)));
    // Get single transaction
    router.get('/transaction/:transactionId', asyncHandler((req, res, next, authUserId) => controller.getTransaction(req, res, next, authUserId)));
    // Sign/approve a transaction
    router.post('/transactions/:transactionId/sign', asyncHandler((req, res, next, authUserId) => controller.signTransaction(req, res, next, authUserId)));
    // Execute an approved transaction
    router.post('/transactions/:transactionId/execute', asyncHandler((req, res, next, authUserId) => controller.executeTransaction(req, res, next, authUserId)));
    // ==================== Audit & Statistics Routes ====================
    // Get audit logs
    router.get('/audit/:walletAddress', asyncHandler((req, res, next, authUserId) => controller.getAuditLogs(req, res, next, authUserId)));
    // Get statistics
    router.get('/stats/:walletAddress', asyncHandler((req, res, next, authUserId) => controller.getStatistics(req, res, next, authUserId)));
    return router;
}
//# sourceMappingURL=treasury.js.map