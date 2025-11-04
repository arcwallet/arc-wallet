import { JsonRpcProvider, formatEther, formatUnits } from 'ethers';
import { RPC_URL } from './transactionService';
import type { Transaction } from '../types';
import { TransactionStatus, TransactionType } from '../types';

const provider = new JsonRpcProvider(RPC_URL);
const RATE_LIMIT_ERROR_CODE = -32007;
const MAX_BLOCKS_DEFAULT = 80;

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

export async function fetchRecentTransactions(
  address: string,
  options: FetchOptions = {},
): Promise<Transaction[]> {
  const normalizedAddress = address?.toLowerCase();
  if (!normalizedAddress) {
    return [];
  }

  const maxTransactions = options.maxTransactions ?? 30;
  const maxBlocks = options.maxBlocks ?? MAX_BLOCKS_DEFAULT;

  const latestBlock = await callWithRateLimit(provider.getBlockNumber());
  const transactions: Transaction[] = [];

  let scannedBlocks = 0;
  let currentBlock = latestBlock;

  while (scannedBlocks < maxBlocks && transactions.length < maxTransactions && currentBlock >= 0) {
    let block;
    try {
      block = await callWithRateLimit(provider.getBlock(currentBlock, true));
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
      console.warn('Failed to load block', currentBlock, error);
      currentBlock -= 1;
      scannedBlocks += 1;
      continue;
    }

    currentBlock -= 1;
    scannedBlocks += 1;

    if (!block || !block.transactions) {
      continue;
    }

    for (const tx of block.transactions) {
      if (transactions.length >= maxTransactions) {
        break;
      }
      const from = tx.from?.toLowerCase();
      const to = tx.to?.toLowerCase();
      if (from !== normalizedAddress && to !== normalizedAddress) {
        continue;
      }

      const direction = from === normalizedAddress ? TransactionType.Sent : TransactionType.Received;
      const valueWei = tx.value ?? 0n;
      const amount = parseFloat(formatEther(valueWei));
      const feeWei = (tx.gasPrice ?? 0n) * (tx.gasLimit ?? 0n);
      const fee = parseFloat(formatUnits(feeWei, 18));
      const timestampMs = Number(block.timestamp) * 1000;

      transactions.push({
        id: tx.hash,
        type: direction,
        description:
          direction === TransactionType.Sent ? 'Native transfer' : 'Native transfer received',
        timestamp: formatRelativeTime(timestampMs),
        date: new Date(timestampMs),
        amount: direction === TransactionType.Sent ? -amount : amount,
        currency: 'ARC',
        usdValue: amount,
        status: TransactionStatus.Completed,
        hash: tx.hash,
        from: tx.from ?? '',
        to: tx.to ?? '',
        networkFee: fee,
        approvals: { required: 0, list: [] },
      });
    }
  }

  transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
  return transactions.slice(0, maxTransactions);
}
