import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Database } from '../models/Database.js';
import { rateLimitMiddleware } from '../middleware/security.js';

export interface BridgeConfig {
  NODE_ENV: string;
  ARC_RPC_URL: string;
  SEPOLIA_RPC_URL: string;
}

/**
 * Bridge Routes
 * Handles cross-chain USDC transfers via Circle CCTP
 */
export function createBridgeRoutes(db: Database, config: BridgeConfig): Router {
  const router = Router();

  // Apply rate limiting to all bridge routes
  router.use(rateLimitMiddleware('bridge'));

  /**
   * POST /bridge/start
   * Initiate a bridge transaction
   */
  router.post(
    '/bridge/start',
    [
      body('userId').isString().notEmpty().withMessage('userId is required'),
      body('sessionKeyAddress').isString().notEmpty().withMessage('sessionKeyAddress is required'),
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

      const { userId, sessionKeyAddress, amount, direction, token } = req.body;

      try {
        // Verify session key exists and is active
        const sessionKeys = await db.getActiveSessionKeysByUserId(userId);
        const sessionKey = sessionKeys.find(sk => sk.address.toLowerCase() === sessionKeyAddress.toLowerCase());

        if (!sessionKey) {
          return res.status(404).json({
            success: false,
            error: 'Session key not found or expired',
            code: 'SESSION_KEY_NOT_FOUND'
          });
        }

        // Create bridge transaction record
        const bridgeTransaction = await db.createBridgeTransaction({
          userId,
          sessionKeyAddress,
          amount,
          direction,
          token,
          status: 'pending'
        });

        console.log(`🌉 [BRIDGE ${bridgeTransaction.id}] Starting bridge operation`);
        console.log(`   Direction: ${direction}`);
        console.log(`   Amount: ${amount} ${token}`);
        console.log(`   Session Key: ${sessionKeyAddress}`);

        // Execute bridge operation in background
        executeBridgeOperation(
          db,
          config,
          bridgeTransaction.id,
          sessionKey.privateKey,
          amount,
          direction,
          token
        ).catch((error) => {
          console.error(`❌ [BRIDGE ${bridgeTransaction.id}] Bridge failed:`, error);
        });

        // Return immediately with transaction ID
        return res.status(202).json({
          success: true,
          data: {
            transactionId: bridgeTransaction.id,
            status: 'pending',
            message: 'Bridge transaction initiated. Check status for updates.'
          }
        });

      } catch (error: any) {
        console.error('Bridge start error:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to start bridge transaction',
          code: 'BRIDGE_START_ERROR'
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

      try {
        const transaction = await db.getBridgeTransaction(transactionId);

        if (!transaction) {
          return res.status(404).json({
            success: false,
            error: 'Transaction not found',
            code: 'TRANSACTION_NOT_FOUND'
          });
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
    [
      param('userId').isString().notEmpty().withMessage('Invalid user ID'),
      query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
      query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be >= 0')
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

/**
 * Execute bridge operation asynchronously
 * This function runs in the background after returning 202 Accepted
 */
async function executeBridgeOperation(
  db: Database,
  config: BridgeConfig,
  transactionId: number,
  privateKey: string,
  amount: string,
  direction: 'arc-to-sepolia' | 'sepolia-to-arc',
  token: string
): Promise<void> {
  try {
    console.log(`🌉 [BRIDGE ${transactionId}] Executing bridge operation`);

    // TODO: Implement Circle Bridge Kit integration
    // For now, this is a placeholder that simulates the bridge process

    // Step 1: Update status to indicate we're processing
    await db.updateBridgeTransaction(transactionId, {
      status: 'pending'
    });

    // NOTE: The actual implementation would use Circle's Bridge Kit SDK:
    // 1. Initialize adapters for source and destination chains
    // 2. Create Circle Bridge Kit client
    // 3. Execute burn on source chain
    // 4. Wait for attestation from Circle
    // 5. Execute mint on destination chain

    // For now, mark as failed with a helpful message
    await db.updateBridgeTransaction(transactionId, {
      status: 'failed',
      errorMessage: 'Bridge implementation pending: Circle Bridge Kit SDK needs to be integrated. Please install @circle-fin/bridge-kit and @circle-fin/adapter-viem-v2 dependencies.'
    });

    console.log(`⚠️  [BRIDGE ${transactionId}] Bridge SDK not yet integrated`);

  } catch (error: any) {
    console.error(`❌ [BRIDGE ${transactionId}] Bridge execution error:`, error);

    await db.updateBridgeTransaction(transactionId, {
      status: 'failed',
      errorMessage: error.message || 'Unknown error occurred during bridge operation'
    });
  }
}
