import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { Database } from '../models/Database.js';
import { BridgeKit, Blockchain } from '@circle-fin/bridge-kit';
import { createAdapterFromPrivateKey } from '@circle-fin/adapter-viem-v2';
import { ethers } from 'ethers';

export interface BridgeConfig {
  NODE_ENV: string;
  ARC_RPC_URL: string;
  SEPOLIA_RPC_URL: string;
}

interface BridgeRequest {
  userId: string;
  sessionKeyAddress: string;
  amount: string; // Decimal string (e.g., "10.50")
  direction: 'arc-to-sepolia' | 'sepolia-to-arc';
  token: 'USDC'; // Only USDC supported for now
}

interface BridgeTransaction {
  id: number;
  user_id: string;
  session_key_address: string;
  amount: string;
  direction: string;
  token: string;
  status: 'pending' | 'burn_complete' | 'attestation_fetched' | 'mint_complete' | 'completed' | 'failed';
  source_tx_hash?: string;
  destination_tx_hash?: string;
  attestation?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

const CHAIN_CONFIG = {
  'arc-to-sepolia': {
    fromChain: Blockchain.Arc_Testnet,
    toChain: Blockchain.Ethereum_Sepolia,
    fromRpcKey: 'ARC_RPC_URL',
    toRpcKey: 'SEPOLIA_RPC_URL',
  },
  'sepolia-to-arc': {
    fromChain: Blockchain.Ethereum_Sepolia,
    toChain: Blockchain.Arc_Testnet,
    fromRpcKey: 'SEPOLIA_RPC_URL',
    toRpcKey: 'ARC_RPC_URL',
  },
};

export function createBridgeRoutes(db: Database, config: BridgeConfig): Router {
  const router = Router();

  // Initialize bridge transactions table
  initializeBridgeTable(db);

  /**
   * POST /bridge/start
   * Initiate a bridge transaction
   */
  router.post(
    '/bridge/start',
    [
      body('userId').isString().notEmpty().withMessage('userId is required'),
      body('sessionKeyAddress').isEthereumAddress().withMessage('Valid session key address required'),
      body('amount').isString().matches(/^\d+\.?\d*$/).withMessage('Amount must be a positive decimal number'),
      body('direction').isIn(['arc-to-sepolia', 'sepolia-to-arc']).withMessage('Invalid bridge direction'),
      body('token').equals('USDC').withMessage('Only USDC is supported'),
    ],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { userId, sessionKeyAddress, amount, direction, token }: BridgeRequest = req.body;

      try {
        // Get user's active session key from database
        const sessionKey = await getUserSessionKey(db, userId, sessionKeyAddress);
        if (!sessionKey) {
          return res.status(404).json({
            success: false,
            error: 'Session key not found or expired',
            code: 'SESSION_KEY_NOT_FOUND',
          });
        }

        // Validate amount
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Invalid amount',
            code: 'INVALID_AMOUNT',
          });
        }

        // Create bridge transaction record
        const bridgeTxId = await createBridgeTransaction(db, {
          user_id: userId,
          session_key_address: sessionKeyAddress,
          amount,
          direction,
          token,
          status: 'pending',
        });

        // Start bridge operation in background
        executeBridgeOperation(db, config, bridgeTxId, sessionKey.private_key, amount, direction)
          .catch((error) => {
            console.error(`Bridge transaction ${bridgeTxId} failed:`, error);
            updateBridgeTransaction(db, bridgeTxId, {
              status: 'failed',
              error_message: error.message || 'Unknown error',
            });
          });

        return res.status(202).json({
          success: true,
          data: {
            transactionId: bridgeTxId,
            status: 'pending',
            message: 'Bridge transaction initiated. Check status for updates.',
          },
        });
      } catch (error: any) {
        console.error('Bridge start error:', error);
        return res.status(500).json({
          success: false,
          error: error.message || 'Internal server error',
          code: 'BRIDGE_START_ERROR',
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
    [param('transactionId').isInt({ gt: 0 }).withMessage('Valid transaction ID required')],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const transactionId = parseInt(req.params.transactionId);

      try {
        const transaction = await getBridgeTransaction(db, transactionId);
        if (!transaction) {
          return res.status(404).json({
            success: false,
            error: 'Transaction not found',
            code: 'TRANSACTION_NOT_FOUND',
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
            sourceTxHash: transaction.source_tx_hash,
            destinationTxHash: transaction.destination_tx_hash,
            errorMessage: transaction.error_message,
            createdAt: transaction.created_at,
            updatedAt: transaction.updated_at,
          },
        });
      } catch (error: any) {
        console.error('Bridge status error:', error);
        return res.status(500).json({
          success: false,
          error: error.message || 'Internal server error',
          code: 'BRIDGE_STATUS_ERROR',
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
    [param('userId').isString().notEmpty().withMessage('Valid user ID required')],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      try {
        const transactions = await getBridgeHistory(db, userId, limit, offset);
        return res.json({
          success: true,
          data: {
            transactions: transactions.map((tx) => ({
              id: tx.id,
              status: tx.status,
              amount: tx.amount,
              direction: tx.direction,
              token: tx.token,
              sourceTxHash: tx.source_tx_hash,
              destinationTxHash: tx.destination_tx_hash,
              errorMessage: tx.error_message,
              createdAt: tx.created_at,
            })),
            limit,
            offset,
          },
        });
      } catch (error: any) {
        console.error('Bridge history error:', error);
        return res.status(500).json({
          success: false,
          error: error.message || 'Internal server error',
          code: 'BRIDGE_HISTORY_ERROR',
        });
      }
    }
  );

  return router;
}

// Database helper functions
function initializeBridgeTable(db: Database): void {
  const sql = `
    CREATE TABLE IF NOT EXISTS bridge_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      session_key_address TEXT NOT NULL,
      amount TEXT NOT NULL,
      direction TEXT NOT NULL,
      token TEXT NOT NULL,
      status TEXT NOT NULL,
      source_tx_hash TEXT,
      destination_tx_hash TEXT,
      attestation TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_bridge_user_id ON bridge_transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_bridge_status ON bridge_transactions(status);
    CREATE INDEX IF NOT EXISTS idx_bridge_created_at ON bridge_transactions(created_at DESC);
  `;

  db.db.exec(sql);
  console.log('✅ Bridge transactions table initialized');
}

async function createBridgeTransaction(
  db: Database,
  data: {
    user_id: string;
    session_key_address: string;
    amount: string;
    direction: string;
    token: string;
    status: string;
  }
): Promise<number> {
  const sql = `
    INSERT INTO bridge_transactions (user_id, session_key_address, amount, direction, token, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const result = db.db.prepare(sql).run(
    data.user_id,
    data.session_key_address,
    data.amount,
    data.direction,
    data.token,
    data.status
  );

  return result.lastInsertRowid as number;
}

async function updateBridgeTransaction(
  db: Database,
  id: number,
  updates: Partial<{
    status: string;
    source_tx_hash: string;
    destination_tx_hash: string;
    attestation: string;
    error_message: string;
  }>
): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];

  Object.entries(updates).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });

  if (fields.length === 0) return;

  fields.push('updated_at = datetime(\'now\')');
  values.push(id);

  const sql = `UPDATE bridge_transactions SET ${fields.join(', ')} WHERE id = ?`;
  db.db.prepare(sql).run(...values);
}

async function getBridgeTransaction(db: Database, id: number): Promise<BridgeTransaction | null> {
  const sql = 'SELECT * FROM bridge_transactions WHERE id = ?';
  return db.db.prepare(sql).get(id) as BridgeTransaction | null;
}

async function getBridgeHistory(
  db: Database,
  userId: string,
  limit: number,
  offset: number
): Promise<BridgeTransaction[]> {
  const sql = `
    SELECT * FROM bridge_transactions
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;

  return db.db.prepare(sql).all(userId, limit, offset) as BridgeTransaction[];
}

async function getUserSessionKey(
  db: Database,
  userId: string,
  address: string
): Promise<{ private_key: string; address: string } | null> {
  const sql = `
    SELECT private_key, address FROM session_keys
    WHERE user_id = ? AND address = ? AND datetime(expires_at) > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `;

  return db.db.prepare(sql).get(userId, address) as { private_key: string; address: string } | null;
}

// Bridge execution function
async function executeBridgeOperation(
  db: Database,
  config: BridgeConfig,
  transactionId: number,
  privateKey: string,
  amount: string,
  direction: 'arc-to-sepolia' | 'sepolia-to-arc'
): Promise<void> {
  console.log(`🌉 [BRIDGE ${transactionId}] Starting bridge operation`);

  const chainConfig = CHAIN_CONFIG[direction];
  const fromRpcUrl = config[chainConfig.fromRpcKey as keyof BridgeConfig] as string;
  const toRpcUrl = config[chainConfig.toRpcKey as keyof BridgeConfig] as string;

  try {
    // Create Bridge Kit instance
    const kit = new BridgeKit();

    // Create adapters
    const adapterFrom = await createAdapterFromPrivateKey({ privateKey, rpcUrl: fromRpcUrl });
    const adapterTo = await createAdapterFromPrivateKey({ privateKey, rpcUrl: toRpcUrl });

    console.log(`🌉 [BRIDGE ${transactionId}] Adapters created`);

    // Execute bridge with progress tracking
    const result = await kit.bridge({
      from: {
        adapter: adapterFrom,
        chain: chainConfig.fromChain,
      },
      to: {
        adapter: adapterTo,
        chain: chainConfig.toChain,
      },
      amount: parseFloat(amount).toFixed(2),
    });

    console.log(`🌉 [BRIDGE ${transactionId}] Bridge completed:`, result);

    // Extract transaction hashes
    const sourceTxHash = extractSourceTxHash(result);
    const destinationTxHash = extractDestinationTxHash(result);

    // Update database
    await updateBridgeTransaction(db, transactionId, {
      status: 'completed',
      source_tx_hash: sourceTxHash,
      destination_tx_hash: destinationTxHash,
    });

    console.log(`✅ [BRIDGE ${transactionId}] Transaction completed successfully`);
  } catch (error: any) {
    console.error(`❌ [BRIDGE ${transactionId}] Bridge failed:`, error);

    await updateBridgeTransaction(db, transactionId, {
      status: 'failed',
      error_message: error.message || 'Unknown bridge error',
    });

    throw error;
  }
}

function extractSourceTxHash(result: any): string | undefined {
  const steps = result?.steps;
  if (!Array.isArray(steps)) return result?.sourceTxHash;

  for (const step of steps) {
    if (step?.name === 'burn' && step?.txHash) return step.txHash;
    if (step?.name === 'approve' && step?.txHash) return step.txHash;
  }

  return undefined;
}

function extractDestinationTxHash(result: any): string | undefined {
  const steps = result?.steps;
  if (!Array.isArray(steps)) return result?.receiveTxHash;

  for (const step of steps) {
    if (step?.name === 'mint' && step?.txHash) return step.txHash;
  }

  return undefined;
}
