import { formatEther, formatUnits, Interface } from 'ethers';
import { getProvider } from './transactionService';
import type { Transaction } from '../types';
import { TransactionStatus, TransactionType } from '../types';
import { API_ENDPOINTS } from '../config/app.config';
import { SUPPORTED_TOKENS } from '../config/tokens';

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
 * Fetches transaction history from the indexer backend
 */

const fetchActivityHistory = async (address: string, limit: number = 20): Promise<any[]> => {
  try {
    const normalizedAddress = address.toLowerCase();
    const response = await fetch(API_ENDPOINTS.history(normalizedAddress, limit));

    if (!response.ok) {
      throw new Error('Failed to fetch history');
    }

    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to fetch history');
    }
    return json.data;
  } catch (error) {
    console.error('Error fetching activity history from indexer:', error);
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
    const data = await fetchActivityHistory(normalizedAddress, limit);
    return data.map((tx: any) => {
      const isSent = tx.from_address.toLowerCase() === normalizedAddress;
      const amount = parseFloat(formatUnits(tx.value, 18)); // Assuming 18 decimals for now, TODO: Handle tokens

      return {
        id: tx.hash,
        type: isSent ? TransactionType.Sent : TransactionType.Received,
        description: isSent ? 'Sent' : 'Received', // Simplified description
        timestamp: formatRelativeTime(tx.timestamp * 1000),
        date: new Date(tx.timestamp * 1000),
        amount: isSent ? -amount : amount,
        currency: 'ARC', // Default to ARC for now
        usdValue: amount * 0.1, // Placeholder
        status: tx.status === 1 ? TransactionStatus.Completed : TransactionStatus.Failed,
        hash: tx.hash,
        from: tx.from_address,
        to: tx.to_address,
        networkFee: parseFloat(tx.gas_price || '0'), // Simplified
        approvals: { required: 0, list: [] },
      };
    });
  } catch (error) {
    console.error('Error fetching transactions from indexer:', error);
    // Fallback to empty array or handle error
    return [];
  }
}
