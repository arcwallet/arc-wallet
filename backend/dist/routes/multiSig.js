import { Router } from 'express';
import { MultiSigController } from '../controllers/MultiSigController.js';
import { authMiddleware } from '../middleware/auth.js';
export function createMultiSigRoutes(db, config, sessionStore) {
    const router = Router();
    const controller = new MultiSigController(db);
    // Apply auth middleware to all multi-sig routes (supports both JWT and cookie session)
    router.use(authMiddleware(config.JWT_SECRET, sessionStore));
    const asyncHandler = (fn) => (req, res, next) => {
        fn(req, res, next, req.user?.id).catch(next);
    };
    // Account routes
    router.post('/accounts', asyncHandler((req, res, next, authUserId) => controller.createAccount(req, res, next, authUserId)));
    router.get('/accounts', asyncHandler((req, res, next, authUserId) => controller.getAccounts(req, res, next, authUserId))); // Changed from /user/:userId
    router.get('/accounts/:accountId', asyncHandler((req, res, next, authUserId) => controller.getAccount(req, res, next, authUserId)));
    router.put('/accounts/:accountId', asyncHandler((req, res, next, authUserId) => controller.updateAccount(req, res, next, authUserId)));
    router.post('/accounts/:accountId/deploy', asyncHandler((req, res, next, authUserId) => controller.deployContract(req, res, next, authUserId)));
    // Member routes
    router.post('/accounts/:accountId/members', asyncHandler((req, res, next, authUserId) => controller.addMember(req, res, next, authUserId)));
    router.delete('/accounts/:accountId/members/:memberId', asyncHandler((req, res, next, authUserId) => controller.removeMember(req, res, next, authUserId)));
    // Transaction routes
    router.post('/transactions', asyncHandler((req, res, next, authUserId) => controller.createTransaction(req, res, next, authUserId)));
    router.get('/transactions/:transactionId', asyncHandler((req, res, next, authUserId) => controller.getTransaction(req, res, next, authUserId)));
    router.get('/accounts/:accountId/transactions', asyncHandler((req, res, next, authUserId) => controller.getTransactions(req, res, next, authUserId)));
    router.post('/transactions/:transactionId/approve', asyncHandler((req, res, next, authUserId) => controller.approveTransaction(req, res, next, authUserId)));
    router.post('/transactions/:transactionId/reject', asyncHandler((req, res, next, authUserId) => controller.rejectTransaction(req, res, next, authUserId)));
    // Passkey signing & execution routes
    router.post('/transactions/:transactionId/prepare', asyncHandler((req, res, next, authUserId) => controller.prepareTransaction(req, res, next, authUserId)));
    router.post('/transactions/:transactionId/sign', asyncHandler((req, res, next, authUserId) => controller.signTransaction(req, res, next, authUserId)));
    router.post('/transactions/:transactionId/execute', asyncHandler((req, res, next, authUserId) => controller.executeTransaction(req, res, next, authUserId)));
    return router;
}
//# sourceMappingURL=multiSig.js.map