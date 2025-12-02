import { formatEther, formatUnits, Interface } from 'ethers';
import { getProvider } from './transactionService';
import type { Transaction } from '../types';
import { TransactionStatus, TransactionType } from '../types';
import { API_ENDPOINTS, BLOCKSCOUT_API_URL } from '../config/app.config';
import { SUPPORTED_TOKENS, getTokenByAddress } from '../config/tokens';

const provider = getProvider();
const RATE_LIMIT_ERROR_CODE = -32007;
const MAX_BLOCKS_DEFAULT = 500; // Increased from 80 to 500 for better history

// ERC-20 Transfer event signature
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ERC20_INTERFACE = new Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

export class RateLimitError extends Error {
  constructor(message: string, public readonly original?: unknown) {
    super(message);
    this.name = 'RateLimitError';
  }
}

async function callWithRateLimit<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : String(error);
    if (error?.code === RATE_LIMIT_ERROR_CODE || message.includes('limit')) {
      throw new RateLimitError('Rate limit exceeded', error);
    }
    throw error;
  }
}

interface FetchOptions {
  maxTransactions?: number;
  maxBlocks?: number;
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function formatRelativeTime(timestampMs: number): string {
  const diffMs = timestampMs - Date.now();
  const diffMinutes = Math.round(diffMs / (60 * 1000));
  if (Math.abs(diffMinutes) < 60) {
    return relativeTimeFormatter.format(diffMinutes, 'minute');
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return relativeTimeFormatter.format(diffHours, 'hour');
  }
  const diffDays = Math.round(diffHours / 24);
  return relativeTimeFormatter.format(diffDays, 'day');
}

/**
 * Activity Service
 * Fetches transaction history from Blockscout API (instant results!)
 */

const fetchActivityHistory = async (address: string, limit: number = 50): Promise<any[]> => {
  try {
    const normalizedAddress = address.toLowerCase();

    // Use Blockscout API for instant transaction history
    const blockscoutUrl = `${BLOCKSCOUT_API_URL}/addresses/${normalizedAddress}/transactions`;
    console.log('[Activity] Fetching from Blockscout:', blockscoutUrl);

    const response = await fetch(blockscoutUrl, {
      headers: { 'Accept': 'application/json' }
    });

    if (response.status === 429) {
      throw new RateLimitError('Rate limit exceeded');
    }

    if (!response.ok) {
      console.warn('[Activity] Blockscout API error, falling back to indexer');
      return await fetchFromIndexer(normalizedAddress, limit);
    }

    const json = await response.json();

    if (!json.items || json.items.length === 0) {
      console.log('[Activity] No transactions found in Blockscout');
      return [];
    }

    // Transform Blockscout response to our format
    const transactions = json.items.slice(0, limit).map((tx: any) => ({
      hash: tx.hash,
      block_number: tx.block_number,
      from_address: tx.from?.hash?.toLowerCase() || '',
      to_address: tx.to?.hash?.toLowerCase() || null,
      value: tx.value || '0',
      timestamp: Math.floor(new Date(tx.timestamp).getTime() / 1000),
      status: tx.status === 'ok' ? 1 : 0,
      token_address: null, // Native transfer
      method: tx.method,
      fee: tx.fee?.value || '0'
    }));

    console.log(`[Activity] Fetched ${transactions.length} transactions from Blockscout`);
    return transactions;
  } catch (error) {
    console.error('Error fetching from Blockscout:', error);
    // Fallback to our indexer
    return await fetchFromIndexer(address.toLowerCase(), limit);
  }
};

/**
 * Fetch ERC20 token transfers from Blockscout
 */
const fetchTokenTransfers = async (address: string, limit: number = 50): Promise<any[]> => {
  try {
    const normalizedAddress = address.toLowerCase();
    const blockscoutUrl = `${BLOCKSCOUT_API_URL}/addresses/${normalizedAddress}/token-transfers`;

    const response = await fetch(blockscoutUrl, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) return [];

    const json = await response.json();
    if (!json.items || json.items.length === 0) return [];

    return json.items.slice(0, limit).map((transfer: any) => ({
      hash: transfer.tx_hash,
      block_number: transfer.block_number,
      from_address: transfer.from?.hash?.toLowerCase() || '',
      to_address: transfer.to?.hash?.toLowerCase() || null,
      value: transfer.total?.value || '0',
      timestamp: Math.floor(new Date(transfer.timestamp).getTime() / 1000),
      status: 1, // Token transfers are always successful if they're in logs
      token_address: transfer.token?.address?.toLowerCase() || null,
      token_symbol: transfer.token?.symbol || 'TOKEN',
      token_decimals: transfer.token?.decimals || 18
    }));
  } catch (error) {
    console.error('Error fetching token transfers:', error);
    return [];
  }
};

/**
 * Fallback: Fetch from our backend indexer
 */
const fetchFromIndexer = async (address: string, limit: number = 50): Promise<any[]> => {
  try {
    const response = await fetch(API_ENDPOINTS.history(address, limit));
    if (!response.ok) return [];

    const json = await response.json();
    if (!json.success || !json.data) return [];

    return json.data;
  } catch (error) {
    console.error('Error fetching from indexer:', error);
    return [];
  }
};

/**
 * Fallback: Fetch recent transactions directly from RPC
 * This is used when the indexer is not available or has no data
 */
const fetchFromRPC = async (address: string, limit: number = 20): Promise<any[]> => {
  try {
    const latestBlock = await provider.getBlockNumber();
    const startBlock = Math.max(0, latestBlock - 1000); // Last 1000 blocks

    const transactions: any[] = [];

    // Scan recent blocks for transactions involving this address
    for (let i = latestBlock; i >= startBlock && transactions.length < limit; i--) {
      try {
        const block = await provider.getBlock(i, true);
        if (!block || !block.prefetchedTransactions) continue;

        for (const tx of block.prefetchedTransactions) {
          const fromMatch = tx.from?.toLowerCase() === address;
          const toMatch = tx.to?.toLowerCase() === address;

          if (fromMatch || toMatch) {
            const receipt = await provider.getTransactionReceipt(tx.hash);
            transactions.push({
              hash: tx.hash,
              block_number: block.number,
              from_address: tx.from,
              to_address: tx.to,
              value: tx.value.toString(),
              timestamp: block.timestamp,
              status: receipt?.status ?? 1,
              token_address: null
            });

            if (transactions.length >= limit) break;
          }
        }
      } catch (blockError) {
        // Skip problematic blocks
        continue;
      }
    }

    console.log(`[Activity] Fetched ${transactions.length} transactions from RPC`);
    return transactions;
  } catch (error) {
    console.error('Error fetching from RPC:', error);
    return [];
  }
};

export async function fetchRecentTransactions(
  address: string,
  options: FetchOptions = {},
): Promise<Transaction[]> {
  const normalizedAddress = address?.toLowerCase();
  if (!normalizedAddress) {
    return [];
  }

  try {
    const limit = options.maxTransactions ?? 50;

    // Fetch both native transactions and token transfers in parallel
    const [nativeTransactions, tokenTransfers] = await Promise.all([
      fetchActivityHistory(normalizedAddress, limit),
      fetchTokenTransfers(normalizedAddress, limit)
    ]);

    // Combine and sort by timestamp (most recent first)
    const allTransactions = [...nativeTransactions, ...tokenTransfers]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    console.log(`[Activity] Combined ${nativeTransactions.length} native + ${tokenTransfers.length} token = ${allTransactions.length} total`);

    return allTransactions.map((tx: any) => {
      const isSent = tx.from_address?.toLowerCase() === normalizedAddress;

      // Determine decimals and symbol
      let decimals = tx.token_decimals || 18;
      let symbol = tx.token_symbol || 'USDC'; // Arc native is USDC

      if (tx.token_address && !tx.token_symbol) {
        const token = getTokenByAddress(tx.token_address);
        if (token) {
          decimals = token.decimals;
          symbol = token.symbol;
        }
      }

      const amount = parseFloat(formatUnits(tx.value || '0', decimals));

      // Determine transaction type based on method
      let type: TransactionType;
      let description: string;
      const method = tx.method?.toLowerCase() || '';

      if (method.includes('swap') || method.includes('exchange')) {
        type = TransactionType.Swap;
        description = 'Swap';
      } else if (method.includes('bridge') || method.includes('cctp') || method.includes('depositForBurn')) {
        type = TransactionType.Bridge;
        description = 'Bridge';
      } else if (method.includes('approve') || method.includes('contract') || method === 'unknown') {
        type = TransactionType.Contract;
        description = 'Contract Interaction';
      } else {
        type = isSent ? TransactionType.Sent : TransactionType.Received;
        description = isSent ? `Sent ${symbol}` : `Received ${symbol}`;
      }

      return {
        id: tx.hash,
        type,
        description,
        timestamp: formatRelativeTime(tx.timestamp * 1000),
        date: new Date(tx.timestamp * 1000),
        amount: isSent ? -amount : amount,
        currency: symbol,
        usdValue: amount * 1, // 1:1 for stablecoins
        status: tx.status === 1 ? TransactionStatus.Completed : TransactionStatus.Failed,
        hash: tx.hash,
        from: tx.from_address,
        to: tx.to_address,
        networkFee: parseFloat(tx.gas_price || '0'),
        approvals: { required: 0, list: [] },
      };
    });
  } catch (error) {
    console.error('Error fetching transactions from indexer:', error);
    // Fallback to empty array or handle error
    return [];
  }
}
