import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Database } from '../models/Database.js';
import { rateLimitMiddleware } from '../middleware/security.js';
import { BridgeKit } from '@circle-fin/bridge-kit';
import { createAdapterFromPrivateKey } from '@circle-fin/adapter-viem-v2';
import { createPublicClient, http, defineChain } from 'viem';
import { sepolia } from 'viem/chains';

export interface BridgeConfig {
  NODE_ENV: string;
  ARC_RPC_URL: string;
  SEPOLIA_RPC_URL: string;
}

// Define Arc Testnet chain
const arcTestnet = defineChain({
  id: 1025,
  name: 'Arc Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.arc.network'],
    },
    public: {
      http: ['https://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arc Explorer',
      url: 'https://explorer.testnet.arc.network',
    },
  },
  testnet: true,
});

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
 * Execute bridge operation asynchronously using Circle Bridge Kit SDK
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
    console.log(`   Direction: ${direction}`);
    console.log(`   Amount: ${amount} ${token}`);

    // Initialize Circle Bridge Kit
    const kit = new BridgeKit();

    // Setup event listeners for progress tracking
    kit.on('*', async (event) => {
      console.log(`🌉 [BRIDGE ${transactionId}] ${event.method} event:`, event.values);
    });

    kit.on('approve', async (event) => {
      console.log(`✅ [BRIDGE ${transactionId}] Token approved:`, event.values.txHash);
    });

    kit.on('burn', async (event) => {
      console.log(`🔥 [BRIDGE ${transactionId}] USDC burned on source chain:`, event.values.txHash);
      await db.updateBridgeTransaction(transactionId, {
        status: 'burn_complete',
        sourceTxHash: event.values.txHash
      });
    });

    kit.on('fetchAttestation', async (event) => {
      console.log(`📝 [BRIDGE ${transactionId}] Attestation fetched from Circle`);
      await db.updateBridgeTransaction(transactionId, {
        status: 'attestation_fetched',
        attestation: JSON.stringify(event.values.data)
      });
    });

    kit.on('mint', async (event) => {
      console.log(`💰 [BRIDGE ${transactionId}] USDC minted on destination chain:`, event.values.txHash);
      await db.updateBridgeTransaction(transactionId, {
        status: 'mint_complete',
        destinationTxHash: event.values.txHash
      });
    });

    // Determine source and destination chains based on direction
    const isArcToSepolia = direction === 'arc-to-sepolia';
    const sourceChain = isArcToSepolia ? arcTestnet : sepolia;
    const destChain = isArcToSepolia ? sepolia : arcTestnet;
    const sourceRpcUrl = isArcToSepolia ? config.ARC_RPC_URL : config.SEPOLIA_RPC_URL;
    const destRpcUrl = isArcToSepolia ? config.SEPOLIA_RPC_URL : config.ARC_RPC_URL;

    // Create adapter for source chain with custom RPC
    const sourceAdapter = createAdapterFromPrivateKey({
      privateKey: privateKey as `0x${string}`,
      capabilities: {
        addressContext: 'user-controlled',
      },
      getPublicClient: ({ chain }) =>
        createPublicClient({
          chain: chain || sourceChain,
          transport: http(sourceRpcUrl, {
            retryCount: 3,
            timeout: 30000,
          }),
        }),
    });

    // Create adapter for destination chain with custom RPC
    const destAdapter = createAdapterFromPrivateKey({
      privateKey: privateKey as `0x${string}`,
      capabilities: {
        addressContext: 'user-controlled',
      },
      getPublicClient: ({ chain }) =>
        createPublicClient({
          chain: chain || destChain,
          transport: http(destRpcUrl, {
            retryCount: 3,
            timeout: 30000,
          }),
        }),
    });

    // Execute the bridge transfer
    console.log(`🌉 [BRIDGE ${transactionId}] Starting bridge transfer...`);

    // Note: Circle CCTP uses chain names like 'Ethereum_Sepolia' for testnet
    // Arc Testnet may not be supported by Circle CCTP yet
    // Using 'Ethereum_Sepolia' and 'Base_Sepolia' as an example for now
    const result = await kit.bridge({
      from: {
        adapter: sourceAdapter,
        chain: isArcToSepolia ? 'Arc_Testnet' as any : 'Ethereum_Sepolia',
      },
      to: {
        adapter: destAdapter,
        chain: isArcToSepolia ? 'Ethereum_Sepolia' : 'Arc_Testnet' as any,
      },
      amount: amount,
      token: 'USDC',
      config: {
        transferSpeed: 'FAST',
      },
    });

    console.log(`🌉 [BRIDGE ${transactionId}] Bridge result:`, result.state);
    console.log(`🌉 [BRIDGE ${transactionId}] Steps:`, result.steps);

    if (result.state === 'success') {
      // Extract transaction hashes from steps
      const burnStep = result.steps.find(s => s.name === 'depositForBurn' || s.name === 'burn');
      const mintStep = result.steps.find(s => s.name === 'mint');

      await db.updateBridgeTransaction(transactionId, {
        status: 'completed',
        sourceTxHash: burnStep?.txHash || undefined,
        destinationTxHash: mintStep?.txHash || undefined,
      });

      console.log(`✅ [BRIDGE ${transactionId}] Bridge completed successfully`);
    } else {
      // Handle partial success or failure
      const errorStep = result.steps.find(s => s.state === 'error');
      const errorMessage = errorStep
        ? `Bridge failed at step: ${errorStep.name}`
        : 'Bridge failed with unknown error';

      await db.updateBridgeTransaction(transactionId, {
        status: 'failed',
        errorMessage: errorMessage,
      });

      console.error(`❌ [BRIDGE ${transactionId}] ${errorMessage}`);
    }

  } catch (error: any) {
    console.error(`❌ [BRIDGE ${transactionId}] Bridge execution error:`, error);

    // Check if it's a route not supported error
    if (error.message?.includes('Route not supported') || error.message?.includes('not available')) {
      await db.updateBridgeTransaction(transactionId, {
        status: 'failed',
        errorMessage: 'Arc Testnet is not yet supported by Circle CCTP. Please use supported testnets like Ethereum Sepolia ↔ Base Sepolia.'
      });
    } else {
      await db.updateBridgeTransaction(transactionId, {
        status: 'failed',
        errorMessage: error.message || 'Unknown error occurred during bridge operation'
      });
    }
  }
}
