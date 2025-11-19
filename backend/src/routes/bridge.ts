import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Database } from '../models/Database.js';
import { rateLimitMiddleware } from '../middleware/security.js';
import { authMiddleware } from '../middleware/auth.js';
// Note: Bridge execution moved to client-side for self-custodial architecture
// BridgeKit and signing now happens in frontend/services/bridgeService.ts

export interface BridgeConfig {
  NODE_ENV: string;
  ARC_RPC_URL: string;
  SEPOLIA_RPC_URL: string;
}

/**
 * Bridge Routes
 * Status tracking for cross-chain USDC transfers
 *
 * SELF-CUSTODIAL ARCHITECTURE:
 * All transaction signing happens on the client-side.
 * Backend only tracks transaction status and history.
 * Private keys NEVER leave the browser.
 */
export function createBridgeRoutes(db: Database, config: BridgeConfig): Router {
  const router = Router();

  // Apply rate limiting to all bridge routes
  router.use(rateLimitMiddleware('bridge'));

  /**
   * POST /bridge/start
   * Register a bridge transaction for tracking
   *
   * SELF-CUSTODIAL: Client executes bridge locally, backend only tracks status
   */
  router.post(
    '/bridge/start',
    authMiddleware(config.JWT_SECRET),
    [
      body('walletAddress').isString().notEmpty().withMessage('walletAddress is required'),
      body('amount').isString().notEmpty().withMessage('amount is required'),
      body('direction').isIn(['arc-to-sepolia', 'sepolia-to-arc']).withMessage('Invalid direction'),
      body('token').equals('USDC').withMessage('Only USDC is supported'),
    ],
    async (req: Request, res: Response) => {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: errors.array()[0].msg,
          code: 'INVALID_REQUEST'
        });
      }

      const { walletAddress, amount, direction, token } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated', code: 'UNAUTHORIZED' });
      }

      try {
        // Create bridge transaction record for tracking
        const bridgeTransaction = await db.createBridgeTransaction({
          userId,
          sessionKeyAddress: walletAddress, // Using walletAddress instead of session key
          amount,
          direction,
          token,
          status: 'pending'
        });

        console.log(`🌉 [BRIDGE ${bridgeTransaction.id}] Registered bridge: ${amount} ${token} (${direction})`);

        // Return transaction ID - client will execute the bridge locally
        return res.status(202).json({
          success: true,
          data: {
            transactionId: bridgeTransaction.id,
            status: 'pending',
            message: 'Bridge transaction registered. Execute bridge on client side.'
          }
        });

      } catch (error: any) {
        console.error('Bridge start error:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to register bridge transaction',
          code: 'BRIDGE_START_ERROR'
        });
      }
    }
  );

  /**
   * PUT /bridge/update/:transactionId
   * Update bridge transaction status from client
   *
   * SELF-CUSTODIAL: Client reports progress after local execution
   */
  router.put(
    '/bridge/update/:transactionId',
    authMiddleware(config.JWT_SECRET),
    [
      param('transactionId').isInt({ min: 1 }).withMessage('Invalid transaction ID'),
      body('status').isIn(['pending', 'approving', 'burning', 'attestation', 'minting', 'completed', 'failed']).withMessage('Invalid status'),
      body('sourceTxHash').optional().isString(),
      body('destinationTxHash').optional().isString(),
      body('errorMessage').optional().isString(),
    ],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: errors.array()[0].msg,
          code: 'INVALID_REQUEST'
        });
      }

      const transactionId = parseInt(req.params.transactionId);
      const { status, sourceTxHash, destinationTxHash, errorMessage } = req.body;
      const authUserId = req.user?.id;

      try {
        // Ownership check
        const transaction = await db.getBridgeTransaction(transactionId);
        if (!transaction) {
          return res.status(404).json({ success: false, error: 'Transaction not found', code: 'NOT_FOUND' });
        }
        if (transaction.userId !== authUserId) {
          return res.status(403).json({ success: false, error: 'Forbidden', code: 'FORBIDDEN' });
        }

        await db.updateBridgeTransaction(transactionId, {
          status,
          sourceTxHash,
          destinationTxHash,
errorMessage
        });

        console.log(`🌉 [BRIDGE ${transactionId}] Status updated: ${status}`);

        return res.json({
          success: true,
          data: {
            transactionId,
            status,
            message: 'Bridge transaction status updated'
          }
        });

      } catch (error: any) {
        console.error('Bridge update error:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to update bridge transaction',
          code: 'BRIDGE_UPDATE_ERROR'
        });
      }
    }
  );

  /**
   * GET /bridge/status/:transactionId
   * Get bridge transaction status
   */
  router.get(
    '/bridge/status/:transactionId',
    authMiddleware(config.JWT_SECRET),
    [
      param('transactionId').isInt({ min: 1 }).withMessage('Invalid transaction ID')
    ],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: errors.array()[0].msg,
          code: 'INVALID_REQUEST'
        });
      }

      const transactionId = parseInt(req.params.transactionId);
      const authUserId = req.user?.id;

      try {
        const transaction = await db.getBridgeTransaction(transactionId);

        if (!transaction) {
          return res.status(404).json({
            success: false,
            error: 'Transaction not found',
            code: 'TRANSACTION_NOT_FOUND'
          });
        }
        
        // Ownership check
        if (transaction.userId !== authUserId) {
          return res.status(403).json({ success: false, error: 'Forbidden', code: 'FORBIDDEN' });
        }

        return res.json({
          success: true,
          data: {
            id: transaction.id,
            status: transaction.status,
            amount: transaction.amount,
            direction: transaction.direction,
            token: transaction.token,
            sourceTxHash: transaction.sourceTxHash,
            destinationTxHash: transaction.destinationTxHash,
            errorMessage: transaction.errorMessage,
            createdAt: transaction.createdAt,
            updatedAt: transaction.updatedAt
          }
        });

      } catch (error: any) {
        console.error('Bridge status error:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to get bridge status',
          code: 'BRIDGE_STATUS_ERROR'
        });
      }
    }
  );

  /**
   * GET /bridge/history/:userId
   * Get user's bridge transaction history
   */
  router.get(
    '/bridge/history/:userId',
    authMiddleware(config.JWT_SECRET),
    [
      param('userId').isString().notEmpty().withMessage('Invalid user ID'),
      query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
      query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be >= 0')
    ],
    async (req: Request, res: Response) => {
      // Ownership check
      if (req.user?.id !== req.params.userId) {
        return res.status(403).json({ success: false, error: 'Forbidden', code: 'FORBIDDEN' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: errors.array()[0].msg,
          code: 'INVALID_REQUEST'
        });
      }

      const userId = req.params.userId;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      try {
        const transactions = await db.getBridgeHistory(userId, limit, offset);

        return res.json({
          success: true,
          data: {
            transactions: transactions.map(t => ({
              id: t.id,
              status: t.status,
              amount: t.amount,
              direction: t.direction,
              token: t.token,
              sourceTxHash: t.sourceTxHash,
              destinationTxHash: t.destinationTxHash,
              errorMessage: t.errorMessage,
              createdAt: t.createdAt
            })),
            limit,
            offset
          }
        });

      } catch (error: any) {
        console.error('Bridge history error:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to get bridge history',
          code: 'BRIDGE_HISTORY_ERROR'
        });
      }
    }
  );

  return router;
}

// Note: Bridge execution (signing) moved to client-side
// See: frontend/services/bridgeService.ts
