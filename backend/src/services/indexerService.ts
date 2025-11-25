import { ethers } from 'ethers';
import db from '../db/indexer.js';
import { webhookService } from './webhookService.js';
import { pushService } from './pushService.js';
import { TokenMetadataService } from './tokenMetadataService.js';
import { Database } from '../models/Database.js';

/**
 * Indexer Service
 * Listens to the blockchain and indexes transactions/events to a local SQLite database.
 */
class IndexerService {
    private provider: ethers.Provider;
    private isRunning: boolean = false;
    private pollingInterval: NodeJS.Timeout | null = null;
    private currentPollingDelay: number;
    private readonly BASE_POLLING_DELAY = 30000; // 30 seconds (was 2s - too aggressive)
    private readonly MAX_POLLING_DELAY = 300000; // 5 minutes max backoff
    private readonly BLOCK_BATCH_SIZE = 2; // Process max 2 blocks per cycle (was 5)
    private readonly BLOCK_DELAY = 1000; // 1s delay between blocks (was 200ms)
    private rateLimitHits: number = 0;
    private tokenMetadataService: TokenMetadataService;

    constructor(database: Database) {
        const rpcUrl = process.env.ARC_RPC_URL || 'http://localhost:8545';
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.tokenMetadataService = new TokenMetadataService(this.provider, database);
        this.currentPollingDelay = this.BASE_POLLING_DELAY;
    }

    /**
     * Start the indexer
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('🚀 Indexer service started');
        this.poll();
    }

    /**
     * Stop the indexer
     */
    stop() {
        this.isRunning = false;
        if (this.pollingInterval) {
            clearTimeout(this.pollingInterval);
            this.pollingInterval = null;
        }
        console.log('🛑 Indexer service stopped');
    }

    /**
     * Poll for new blocks
     */
    private async poll() {
        if (!this.isRunning) return;

        try {
            const latestBlock = await this.provider.getBlockNumber();
            const lastIndexedBlock = this.getLastIndexedBlock();

            if (latestBlock > lastIndexedBlock) {
                // Calculate how many blocks to process (max BLOCK_BATCH_SIZE)
                const blocksToProcess = Math.min(
                    latestBlock - lastIndexedBlock,
                    this.BLOCK_BATCH_SIZE
                );

                console.log(`📦 Processing ${blocksToProcess} blocks (${lastIndexedBlock + 1} to ${lastIndexedBlock + blocksToProcess})`);

                // Process blocks sequentially with delay
                for (let i = lastIndexedBlock + 1; i <= lastIndexedBlock + blocksToProcess; i++) {
                    await this.processBlock(i);

                    // Add delay between blocks to avoid rate limiting
                    if (i < lastIndexedBlock + blocksToProcess) {
                        await new Promise(resolve => setTimeout(resolve, this.BLOCK_DELAY));
                    }
                }

                // Successful processing - reset backoff
                this.rateLimitHits = 0;
                this.currentPollingDelay = this.BASE_POLLING_DELAY;
            }
        } catch (error: any) {
            const errorMessage = error?.message || error?.toString() || '';

            // Check for rate limit errors
            if (errorMessage.includes('rate limit') ||
                errorMessage.includes('daily request limit') ||
                errorMessage.includes('429') ||
                errorMessage.includes('Too Many Requests')) {

                this.rateLimitHits++;
                // Exponential backoff: double the delay each time, up to max
                this.currentPollingDelay = Math.min(
                    this.BASE_POLLING_DELAY * Math.pow(2, this.rateLimitHits),
                    this.MAX_POLLING_DELAY
                );
                console.warn(`⚠️ Rate limit hit (${this.rateLimitHits}x). Backing off to ${this.currentPollingDelay / 1000}s`);
            } else {
                console.error('Error in indexer poll loop:', error);
            }
        }

        // Schedule next poll with current delay
        this.pollingInterval = setTimeout(() => this.poll(), this.currentPollingDelay);
    }

    /**
     * Get the last indexed block number from DB
     */
    private getLastIndexedBlock(): number {
        const stmt = db.prepare('SELECT MAX(number) as lastBlock FROM blocks');
        const result = stmt.get() as { lastBlock: number };
        return result.lastBlock || 0;
    }

    /**
     * Process a single block
     */
    private async processBlock(blockNumber: number) {
        try {
            const block = await this.provider.getBlock(blockNumber, true); // true to include transactions
            if (!block) return;



            const insertBlock = db.prepare(`
        INSERT OR IGNORE INTO blocks (number, hash, parent_hash, timestamp, processed_at)
        VALUES (?, ?, ?, ?, ?)
      `);

            const insertTx = db.prepare(`
        INSERT OR IGNORE INTO transactions (
          hash, block_number, from_address, to_address, value, data, nonce, gas_limit, gas_price, timestamp, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

            const insertEvent = db.prepare(`
        INSERT INTO events (
          transaction_hash, block_number, event_type, from_address, to_address, amount, token_address, data, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

            // Fetch receipts in smaller batches to avoid rate limiting
            const RECEIPT_BATCH_SIZE = 10;
            const receiptMap = new Map();

            for (let i = 0; i < block.prefetchedTransactions.length; i += RECEIPT_BATCH_SIZE) {
                const batch = block.prefetchedTransactions.slice(i, i + RECEIPT_BATCH_SIZE);
                const batchReceipts = await Promise.all(
                    batch.map(tx => this.provider.getTransactionReceipt(tx.hash))
                );
                batchReceipts.forEach((r, idx) => {
                    if (r) receiptMap.set(r.hash, r);
                });

                // Small delay between batches
                if (i + RECEIPT_BATCH_SIZE < block.prefetchedTransactions.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            db.transaction(() => {
                // Insert Block
                insertBlock.run(
                    block.number,
                    block.hash,
                    block.parentHash,
                    block.timestamp,
                    Date.now()
                );

                // Process Transactions
                for (const tx of block.prefetchedTransactions) {
                    const receipt = receiptMap.get(tx.hash);
                    const status = receipt ? receipt.status : 0; // 0 = failed, 1 = success

                    insertTx.run(
                        tx.hash,
                        block.number,
                        tx.from,
                        tx.to,
                        tx.value.toString(),
                        tx.data,
                        tx.nonce,
                        tx.gasLimit.toString(),
                        tx.gasPrice?.toString() || '0',
                        block.timestamp,
                        status
                    );

                    // Detect Native Transfers
                    if (tx.value > 0 && status === 1) {
                        insertEvent.run(
                            tx.hash,
                            block.number,
                            'Transfer',
                            tx.from,
                            tx.to,
                            tx.value.toString(),
                            'NATIVE', // Native token
                            null,
                            block.timestamp
                        );

                        // Trigger Webhooks
                        const payload = {
                            type: 'Transfer',
                            hash: tx.hash,
                            from: tx.from,
                            to: tx.to,
                            value: tx.value.toString(),
                            token: 'NATIVE',
                            timestamp: block.timestamp
                        };

                        // Notify sender and receiver
                        webhookService.trigger(tx.from, 'Transfer', payload);
                        if (tx.to) {
                            webhookService.trigger(tx.to, 'Transfer', payload);

                            // Trigger Push Notifications
                            const amount = parseFloat(ethers.formatEther(tx.value));
                            pushService.sendNotification(tx.to, {
                                title: 'Incoming Transfer',
                                body: `You received ${amount} ARC from ${tx.from.slice(0, 6)}...${tx.from.slice(-4)}`,
                                icon: '/icon-192x192.png'
                            });
                        }
                    }

                    // Parse ERC20 Transfers from logs
                    if (receipt && status === 1) {
                        for (const log of receipt.logs) {
                            // Transfer(address from, address to, uint256 value)
                            // Topic0: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
                            if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' && log.topics.length === 3) {
                                try {
                                    const from = ethers.getAddress('0x' + log.topics[1].slice(26));
                                    const to = ethers.getAddress('0x' + log.topics[2].slice(26));
                                    const value = BigInt(log.data).toString();
                                    const tokenAddress = log.address;

                                    insertEvent.run(
                                        tx.hash,
                                        block.number,
                                        'Transfer',
                                        from,
                                        to,
                                        value,
                                        tokenAddress, // ERC20 Token Address
                                        null,
                                        block.timestamp
                                    );

                                    // Trigger Webhooks for ERC20
                                    const payload = {
                                        type: 'Transfer',
                                        hash: tx.hash,
                                        from: from,
                                        to: to,
                                        value: value,
                                        token: tokenAddress,
                                        timestamp: block.timestamp
                                    };

                                    webhookService.trigger(from, 'Transfer', payload);
                                    webhookService.trigger(to, 'Transfer', payload);

                                    // Trigger Push Notifications for ERC20 with formatted amounts (async)
                                    (async () => {
                                        try {
                                            const metadata = await this.tokenMetadataService.getTokenMetadata(tokenAddress);
                                            const formattedAmount = metadata
                                                ? this.tokenMetadataService.formatTokenAmount(value, metadata.decimals)
                                                : value;

                                            const tokenSymbol = metadata?.symbol || 'tokens';
                                            const tokenName = metadata?.name || 'Unknown Token';

                                            pushService.sendNotification(to, {
                                                title: 'Incoming Token Transfer',
                                                body: `You received ${formattedAmount} ${tokenSymbol} from ${from.slice(0, 6)}...${from.slice(-4)}`,
                                                icon: '/icon-192x192.png',
                                                data: {
                                                    type: 'erc20_transfer',
                                                    from,
                                                    to,
                                                    value: formattedAmount,
                                                    rawValue: value,
                                                    tokenAddress,
                                                    tokenSymbol,
                                                    tokenName,
                                                    txHash: tx.hash
                                                }
                                            });

                                            console.log(`📨 ERC20 notification sent: ${formattedAmount} ${tokenSymbol} to ${to.slice(0, 6)}...`);
                                        } catch (notifError) {
                                            console.error('Error sending ERC20 notification:', notifError);
                                            // Fallback to basic notification
                                            pushService.sendNotification(to, {
                                                title: 'Incoming Token Transfer',
                                                body: `You received tokens from ${from.slice(0, 6)}...${from.slice(-4)}`,
                                                icon: '/icon-192x192.png'
                                            });
                                        }
                                    })();

                                } catch (e) {
                                    console.error('Error parsing ERC20 log:', e);
                                }
                            }
                        }
                    }
                }
            })();

        } catch (error) {
            console.error(`Failed to process block ${blockNumber}:`, error);
        }
    }

    /**
     * Get transaction history for an address
     */
    getHistory(address: string, limit: number = 20, offset: number = 0) {
        const stmt = db.prepare(`
      SELECT * FROM transactions 
      WHERE from_address = ? OR to_address = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);
        return stmt.all(address, address, limit, offset);
    }
}

// Note: IndexerService will be initialized in index.ts with database instance
export { IndexerService };
