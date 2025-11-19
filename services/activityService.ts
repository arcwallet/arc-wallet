import { formatEther, formatUnits, Interface } from 'ethers';
import { getProvider } from './transactionService';
import type { Transaction } from '../types';
import { TransactionStatus, TransactionType } from '../types';
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

export async function fetchRecentTransactions(
  address: string,
  options: FetchOptions = {},
): Promise<Transaction[]> {
  const normalizedAddress = address?.toLowerCase();
  if (!normalizedAddress) {
    return [];
  }



  const maxTransactions = options.maxTransactions ?? 50; // Increased from 30
  const maxBlocks = options.maxBlocks ?? MAX_BLOCKS_DEFAULT;

  const latestBlock = await callWithRateLimit(provider.getBlockNumber());


  const transactions: Transaction[] = [];
  const seenTxHashes = new Set<string>();

  // Get all token contract addresses for filtering
  const tokenAddresses = Object.values(SUPPORTED_TOKENS)
    .flatMap(token => [
      token.networks.testnet?.arcTestnet?.toLowerCase(),
      token.networks.testnet?.sepolia?.toLowerCase(),
    ])
    .filter((addr): addr is string => Boolean(addr));

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

      if (seenTxHashes.has(tx.hash)) {
        continue;
      }

      const from = tx.from?.toLowerCase();
      const to = tx.to?.toLowerCase();
      const timestampMs = Number(block.timestamp) * 1000;

      // Check for native transfers
      if (from === normalizedAddress || to === normalizedAddress) {
        const valueWei = tx.value ?? 0n;
        if (valueWei > 0n) {
          const direction = from === normalizedAddress ? TransactionType.Sent : TransactionType.Received;
          const amount = parseFloat(formatEther(valueWei));
          const feeWei = (tx.gasPrice ?? 0n) * (tx.gasLimit ?? 0n);
          const fee = parseFloat(formatUnits(feeWei, 18));

          seenTxHashes.add(tx.hash);
          transactions.push({
            id: tx.hash,
            type: direction,
            description: direction === TransactionType.Sent ? 'ARC sent' : 'ARC received',
            timestamp: formatRelativeTime(timestampMs),
            date: new Date(timestampMs),
            amount: direction === TransactionType.Sent ? -amount : amount,
            currency: 'ARC',
            usdValue: amount * 0.1, // Placeholder price
            status: TransactionStatus.Completed,
            hash: tx.hash,
            from: tx.from ?? '',
            to: tx.to ?? '',
            networkFee: fee,
            approvals: { required: 0, list: [] },
          });
          continue;
        }
      }

      // Check for ERC-20 token transfers
      if (to && tokenAddresses.includes(to) && tx.data && tx.data.length > 10) {
        try {
          // Get transaction receipt to check logs
          const receipt = await callWithRateLimit(provider.getTransactionReceipt(tx.hash));
          if (!receipt) continue;

          for (const log of receipt.logs) {
            // Check if this is a Transfer event
            if (log.topics[0] !== ERC20_TRANSFER_TOPIC) continue;

            const parsedLog = ERC20_INTERFACE.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });

            if (!parsedLog) continue;

            const logFrom = parsedLog.args.from?.toLowerCase();
            const logTo = parsedLog.args.to?.toLowerCase();
            const value = parsedLog.args.value;

            // Check if this transfer involves our address
            if (logFrom !== normalizedAddress && logTo !== normalizedAddress) {
              continue;
            }

            // Find which token this is
            const token = Object.values(SUPPORTED_TOKENS).find(
              t => t.networks.testnet?.arcTestnet?.toLowerCase() === log.address.toLowerCase()
            );

            if (!token) continue;

            const direction = logFrom === normalizedAddress ? TransactionType.Sent : TransactionType.Received;
            const amount = parseFloat(formatUnits(value, token.decimals));
            const feeWei = receipt.gasUsed * (receipt.effectiveGasPrice ?? 0n);
            const fee = parseFloat(formatUnits(feeWei, 18));

            // Estimate USD value
            const usdPrice = token.symbol === 'USDC' ? 1.0 : token.symbol === 'EURC' ? 1.07 : 1.0;
            const usdValue = amount * usdPrice;

            seenTxHashes.add(tx.hash);
            transactions.push({
              id: `${tx.hash}-${log.index}`,
              type: direction,
              description: direction === TransactionType.Sent
                ? `${token.symbol} sent`
                : `${token.symbol} received`,
              timestamp: formatRelativeTime(timestampMs),
              date: new Date(timestampMs),
              amount: direction === TransactionType.Sent ? -amount : amount,
              currency: token.symbol,
              usdValue,
              status: TransactionStatus.Completed,
              hash: tx.hash,
              from: logFrom,
              to: logTo,
              networkFee: fee,
              approvals: { required: 0, list: [] },
            });
          }
        } catch (error) {
          // Silently skip if we can't parse this transaction
          console.warn('Failed to parse token transfer', tx.hash, error);
        }
      }
    }
  }



  transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
  return transactions.slice(0, maxTransactions);
}
