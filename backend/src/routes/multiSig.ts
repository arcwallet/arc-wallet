import { Router } from 'express';
import { multiSigController } from '../controllers/MultiSigController';

const router = Router();

// Account routes
router.post('/accounts', (req, res, next) => multiSigController.createAccount(req, res, next));
router.get('/accounts/user/:userId', (req, res, next) => multiSigController.getAccounts(req, res, next));
router.get('/accounts/:accountId', (req, res, next) => multiSigController.getAccount(req, res, next));
router.put('/accounts/:accountId', (req, res, next) => multiSigController.updateAccount(req, res, next));
router.post('/accounts/:accountId/deploy', (req, res, next) => multiSigController.deployContract(req, res, next));

// Member routes
router.post('/accounts/:accountId/members', (req, res, next) => multiSigController.addMember(req, res, next));
router.delete('/accounts/:accountId/members/:memberId', (req, res, next) => multiSigController.removeMember(req, res, next));

// Transaction routes
router.post('/transactions', (req, res, next) => multiSigController.createTransaction(req, res, next));
router.get('/transactions/:transactionId', (req, res, next) => multiSigController.getTransaction(req, res, next));
router.get('/accounts/:accountId/transactions', (req, res, next) => multiSigController.getTransactions(req, res, next));
router.post('/transactions/:transactionId/approve', (req, res, next) => multiSigController.approveTransaction(req, res, next));
router.post('/transactions/:transactionId/reject', (req, res, next) => multiSigController.rejectTransaction(req, res, next));

export default router;
