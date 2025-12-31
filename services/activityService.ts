import { formatUnits, Interface } from 'ethers';
import { getProvider } from './rpcProvider';
import type { Transaction } from '../types';
import { TransactionStatus, TransactionType } from '../types';
import { API_ENDPOINTS, BLOCKSCOUT_API_URL } from '../config/app.config';
import { getTokenByAddress, getAllSupportedTokens } from '../config/tokens';

const provider = getProvider();

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
 * Fetch ERC-20 Transfer events directly from RPC using eth_getLogs
 */
async function fetchTransferLogs(address: string, maxBlocks: number = 50000): Promise<any[]> {
  try {
    const normalizedAddress = address.toLowerCase();
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - maxBlocks);

    console.log(`[Activity] Fetching logs from block ${fromBlock} to ${latestBlock}`);

    const paddedAddress = '0x000000000000000000000000' + normalizedAddress.slice(2);

    const [sentLogs, receivedLogs] = await Promise.all([
      provider.getLogs({
        fromBlock,
        toBlock: latestBlock,
        topics: [ERC20_TRANSFER_TOPIC, paddedAddress, null],
      }),
      provider.getLogs({
        fromBlock,
        toBlock: latestBlock,
        topics: [ERC20_TRANSFER_TOPIC, null, paddedAddress],
      }),
    ]);

    console.log(`[Activity] Found ${sentLogs.length} sent + ${receivedLogs.length} received logs`);

    const allLogs = [...sentLogs, ...receivedLogs];
    const transactions: any[] = [];

    for (const log of allLogs) {
      try {
        const parsed = ERC20_INTERFACE.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });

        if (!parsed) continue;

        const from = parsed.args[0].toLowerCase();
        const to = parsed.args[1].toLowerCase();
        const value = parsed.args[2];

        const tokenAddress = log.address.toLowerCase();
        const token = getTokenByAddress(tokenAddress);
        const decimals = token?.decimals ?? 18;
        const symbol = token?.symbol ?? 'TOKEN';

        const block = await provider.getBlock(log.blockNumber);
        const timestamp = block?.timestamp ?? Math.floor(Date.now() / 1000);

        transactions.push({
          hash: log.transactionHash,
          block_number: log.blockNumber,
          from_address: from,
          to_address: to,
          value: value.toString(),
          timestamp,
          status: 1,
          token_address: tokenAddress,
          token_symbol: symbol,
          token_decimals: decimals,
          log_index: log.index,
        });
      } catch (parseError) {
        console.warn('[Activity] Failed to parse log:', parseError);
      }
    }

    const seen = new Set<string>();
    const unique = transactions.filter(tx => {
      const key = `${tx.hash}-${tx.log_index}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('[Activity] Error fetching transfer logs:', error);
    return [];
  }
}

/**
 * Fetch from ArcScan Blockscout API
 */
async function fetchFromBlockscout(address: string, limit: number = 50): Promise<any[]> {
  try {
    const normalizedAddress = address.toLowerCase();
    const blockscoutUrl = `${BLOCKSCOUT_API_URL}/addresses/${normalizedAddress}/transactions`;
    console.log('[Activity] Fetching from ArcScan:', blockscoutUrl);

    const response = await fetch(blockscoutUrl, {
      headers: { 'Accept': 'application/json' },
    });

    if (response.status === 429) {
      throw new RateLimitError('Rate limit exceeded');
    }

    if (!response.ok) {
      console.warn('[Activity] ArcScan API returned:', response.status);
      return [];
    }

    const json = await response.json();
    const items = json.items || json.result || json.data || [];
    if (items.length === 0) return [];

    return items.slice(0, limit).map((tx: any) => ({
      hash: tx.hash || tx.tx_hash,
      block_number: tx.block_number || tx.blockNumber,
      from_address: (tx.from?.hash || tx.from || '').toLowerCase(),
      to_address: (tx.to?.hash || tx.to || '').toLowerCase(),
      value: tx.value || '0',
      timestamp: tx.timestamp
        ? (typeof tx.timestamp === 'number' ? tx.timestamp : Math.floor(new Date(tx.timestamp).getTime() / 1000))
        : Math.floor(Date.now() / 1000),
      status: tx.status === 'ok' || tx.status === 1 || tx.txreceipt_status === '1' ? 1 : 0,
      token_address: null,
      method: tx.method || tx.input?.slice(0, 10) || '',
    }));
  } catch (error) {
    console.error('[Activity] Error fetching from ArcScan:', error);
    return [];
  }
}

/**
 * Fetch token transfers from ArcScan
 */
async function fetchTokenTransfers(address: string, limit: number = 100): Promise<any[]> {
  try {
    const normalizedAddress = address.toLowerCase();
    const blockscoutUrl = `${BLOCKSCOUT_API_URL}/addresses/${normalizedAddress}/token-transfers`;

    console.log('[Activity] Fetching token transfers from:', blockscoutUrl);

    const response = await fetch(blockscoutUrl, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.warn('[Activity] Token transfers API returned:', response.status);
      return [];
    }

    const json = await response.json();
    const items = json.items || json.result || [];

    console.log('[Activity] Token transfers found:', items.length);

    if (items.length === 0) return [];

    return items.slice(0, limit).map((transfer: any) => ({
      hash: transfer.transaction_hash || transfer.tx_hash || transfer.hash,
      block_number: transfer.block_number || transfer.blockNumber,
      from_address: (transfer.from?.hash || transfer.from || '').toLowerCase(),
      to_address: (transfer.to?.hash || transfer.to || '').toLowerCase(),
      value: transfer.total?.value || transfer.value || '0',
      timestamp: transfer.timestamp
        ? (typeof transfer.timestamp === 'number' ? transfer.timestamp : Math.floor(new Date(transfer.timestamp).getTime() / 1000))
        : Math.floor(Date.now() / 1000),
      status: 1,
      token_address: (transfer.token?.address_hash || transfer.token?.address || transfer.contractAddress || '').toLowerCase(),
      token_symbol: transfer.token?.symbol || transfer.tokenSymbol || 'USDC',
      token_decimals: parseInt(transfer.total?.decimals || transfer.token?.decimals || '18', 10),
      log_index: transfer.log_index || 0,
      method: transfer.method || '',
    }));
  } catch (error) {
    console.error('[Activity] Error fetching token transfers:', error);
    return [];
  }
}

function determineTransactionType(tx: any, userAddress: string): { type: TransactionType; description: string } {
  const method = (tx.method || '').toLowerCase();
  const isSent = tx.from_address === userAddress;
  const symbol = tx.token_symbol || 'USDC';

  if (method.includes('subscribe') || method.includes('mint')) {
    return { type: TransactionType.Subscribe, description: 'Subscribe to USYC' };
  }
  if (method.includes('redeem') || method.includes('withdraw')) {
    return { type: TransactionType.Redeem, description: 'Redeem USYC' };
  }
  if (method.includes('swap') || method.includes('exchange')) {
    return { type: TransactionType.Swap, description: 'Token Swap' };
  }
  if (method.includes('bridge') || method.includes('cctp') || method.includes('depositforburn')) {
    return { type: TransactionType.Bridge, description: 'Cross-chain Bridge' };
  }
  if (method.includes('approve')) {
    return { type: TransactionType.Contract, description: 'Token Approval' };
  }

  if (isSent) {
    return { type: TransactionType.Sent, description: `Sent ${symbol}` };
  } else {
    return { type: TransactionType.Received, description: `Received ${symbol}` };
  }
}

/**
 * Main function to fetch recent transactions
 */
export async function fetchRecentTransactions(
  address: string,
  options: FetchOptions = {}
): Promise<Transaction[]> {
  const normalizedAddress = address?.toLowerCase();
  if (!normalizedAddress) return [];

  try {
    const limit = options.maxTransactions ?? 100;
    const maxBlocks = options.maxBlocks ?? 50000;

    console.log('[Activity] Starting transaction fetch for:', normalizedAddress.slice(0, 10) + '...');

    const [logTransactions, blockscoutNative, blockscoutTokens] = await Promise.all([
      fetchTransferLogs(normalizedAddress, maxBlocks),
      fetchFromBlockscout(normalizedAddress, limit),
      fetchTokenTransfers(normalizedAddress, limit),
    ]);

    const allTransactions = [...logTransactions, ...blockscoutNative, ...blockscoutTokens];

    const seen = new Map<string, any>();
    for (const tx of allTransactions) {
      const key = tx.hash;
      if (!seen.has(key) || tx.token_address) {
        seen.set(key, tx);
      }
    }

    const uniqueTransactions = Array.from(seen.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    console.log(`[Activity] Total unique transactions: ${uniqueTransactions.length}`);

    return uniqueTransactions.map((tx: any) => {
      const isSent = tx.from_address === normalizedAddress;
      const decimals = tx.token_decimals || 18;
      const symbol = tx.token_symbol || 'USDC';
      const amount = parseFloat(formatUnits(tx.value || '0', decimals));
      const { type, description } = determineTransactionType(tx, normalizedAddress);

      return {
        id: `${tx.hash}-${tx.log_index ?? 0}`,
        type,
        description,
        timestamp: formatRelativeTime(tx.timestamp * 1000),
        date: new Date(tx.timestamp * 1000),
        amount: isSent ? -amount : amount,
        currency: symbol,
        usdValue: amount * 1,
        status: tx.status === 1 ? TransactionStatus.Completed : TransactionStatus.Failed,
        hash: tx.hash,
        from: tx.from_address,
        to: tx.to_address,
        networkFee: 0,
        approvals: { required: 0, list: [] },
      };
    });
  } catch (error) {
    console.error('[Activity] Error fetching transactions:', error);
    if (error instanceof RateLimitError) throw error;
    return [];
  }
}

/**
 * Refresh transactions manually
 */
export async function refreshTransactions(address: string): Promise<Transaction[]> {
  console.log('[Activity] Manual refresh triggered');
  return fetchRecentTransactions(address, { maxTransactions: 100, maxBlocks: 100000 });
}
