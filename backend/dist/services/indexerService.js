import { ethers } from 'ethers';
import db from '../db/indexer.js';
import { webhookService } from './webhookService.js';
import { pushService } from './pushService.js';
import { TokenMetadataService } from './tokenMetadataService.js';
/**
 * Indexer Service
 * Listens to the blockchain and indexes transactions/events ONLY for registered wallet addresses.
 * This is a targeted indexer - it doesn't process all network activity, only what matters to users.
 */
class IndexerService {
    provider;
    database;
    isRunning = false;
    pollingInterval = null;
    currentPollingDelay;
    BASE_POLLING_DELAY = 30000; // 30 seconds (very conservative for free tier)
    MAX_POLLING_DELAY = 600000; // 10 minutes max backoff
    BLOCK_BATCH_SIZE = 3; // Process max 3 blocks per cycle (very reduced)
    BLOCK_DELAY = 2000; // 2s delay between blocks
    REQUEST_DELAY = 500; // 500ms between RPC requests (stay under 2 req/sec)
    rateLimitHits = 0;
    tokenMetadataService;
    watchedAddresses = new Set();
    lastAddressRefresh = 0;
    ADDRESS_REFRESH_INTERVAL = 60000; // Refresh addresses every minute
    constructor(database) {
        const rpcUrl = process.env.ARC_RPC_URL || 'http://localhost:8545';
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.database = database;
        this.tokenMetadataService = new TokenMetadataService(this.provider, database);
        this.currentPollingDelay = this.BASE_POLLING_DELAY;
    }
    /**
     * Refresh the list of watched addresses from the database
     */
    async refreshWatchedAddresses() {
        const now = Date.now();
        if (now - this.lastAddressRefresh < this.ADDRESS_REFRESH_INTERVAL && this.watchedAddresses.size > 0) {
            return; // Skip refresh if not enough time has passed
        }
        try {
            // Get all users with wallet addresses from the database
            const query = 'SELECT wallet_address FROM users WHERE wallet_address IS NOT NULL';
            const rows = await new Promise((resolve, reject) => {
                this.database.db.all(query, [], (err, rows) => {
                    if (err)
                        reject(err);
                    else
                        resolve(rows || []);
                });
            });
            this.watchedAddresses.clear();
            for (const row of rows) {
                if (row.wallet_address) {
                    this.watchedAddresses.add(row.wallet_address.toLowerCase());
                }
            }
            this.lastAddressRefresh = now;
            console.log(`📋 Indexer watching ${this.watchedAddresses.size} registered wallet addresses`);
        }
        catch (error) {
            console.error('Failed to refresh watched addresses:', error);
        }
    }
    /**
     * Check if an address should be watched (is registered user)
     */
    isWatchedAddress(address) {
        if (!address)
            return false;
        return this.watchedAddresses.has(address.toLowerCase());
    }
    /**
     * Start the indexer
     */
    start() {
        if (this.isRunning)
            return;
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
    async poll() {
        if (!this.isRunning)
            return;
        try {
            // Refresh watched addresses before processing
            await this.refreshWatchedAddresses();
            // If no addresses to watch, skip processing
            if (this.watchedAddresses.size === 0) {
                console.log('⏸️ No registered wallets to watch, skipping block processing');
                this.pollingInterval = setTimeout(() => this.poll(), this.currentPollingDelay);
                return;
            }
            const latestBlock = await this.provider.getBlockNumber();
            await this.delay(this.REQUEST_DELAY); // Rate limit protection
            const lastIndexedBlock = await this.getStartingBlock();
            if (latestBlock > lastIndexedBlock) {
                // Calculate how many blocks to process (max BLOCK_BATCH_SIZE)
                const blocksToProcess = Math.min(latestBlock - lastIndexedBlock, this.BLOCK_BATCH_SIZE);
                console.log(`📦 Processing ${blocksToProcess} blocks (${lastIndexedBlock + 1} to ${lastIndexedBlock + blocksToProcess}) for ${this.watchedAddresses.size} wallets`);
                // Process blocks sequentially with delay
                for (let i = lastIndexedBlock + 1; i <= lastIndexedBlock + blocksToProcess; i++) {
                    await this.processBlock(i);
                    // Add delay between blocks to avoid rate limiting
                    if (i < lastIndexedBlock + blocksToProcess) {
                        await this.delay(this.BLOCK_DELAY);
                    }
                }
                // Successful processing - reset backoff
                this.rateLimitHits = 0;
                this.currentPollingDelay = this.BASE_POLLING_DELAY;
            }
        }
        catch (error) {
            const errorMessage = error?.message || error?.toString() || '';
            // Check for rate limit errors (including QuickNode specific error)
            if (errorMessage.includes('rate limit') ||
                errorMessage.includes('request limit reached') ||
                errorMessage.includes('daily request limit') ||
                errorMessage.includes('429') ||
                errorMessage.includes('Too Many Requests') ||
                errorMessage.includes('-32007')) {
                this.rateLimitHits++;
                // Exponential backoff: double the delay each time, up to max
                this.currentPollingDelay = Math.min(this.BASE_POLLING_DELAY * Math.pow(2, this.rateLimitHits), this.MAX_POLLING_DELAY);
                console.warn(`⚠️ Rate limit hit (${this.rateLimitHits}x). Backing off to ${this.currentPollingDelay / 1000}s`);
            }
            else {
                console.error('Error in indexer poll loop:', error);
            }
        }
        // Schedule next poll with current delay
        this.pollingInterval = setTimeout(() => this.poll(), this.currentPollingDelay);
    }
    /**
     * Helper to add delay between operations
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Get the last indexed block number from DB
     * If no blocks indexed yet, start from recent blocks (not from 0)
     */
    getLastIndexedBlock() {
        const stmt = db.prepare('SELECT MAX(number) as lastBlock FROM blocks');
        const result = stmt.get();
        // If no blocks indexed, return -1 to trigger smart start
        if (!result.lastBlock) {
            return -1; // Signal to start from recent blocks
        }
        return result.lastBlock;
    }
    /**
     * Get starting block - either last indexed or recent if fresh start
     */
    async getStartingBlock() {
        const lastIndexed = this.getLastIndexedBlock();
        if (lastIndexed === -1) {
            // Fresh start: begin from recent blocks (last 1000)
            try {
                const latestBlock = await this.provider.getBlockNumber();
                const startFrom = Math.max(0, latestBlock - 1000);
                console.log(`🚀 Fresh start: Beginning indexer from block ${startFrom} (latest: ${latestBlock})`);
                return startFrom;
            }
            catch (error) {
                console.error('Failed to get latest block, starting from 0:', error);
                return 0;
            }
        }
        return lastIndexed;
    }
    /**
     * Process a single block - ONLY for watched addresses
     */
    async processBlock(blockNumber) {
        try {
            const block = await this.provider.getBlock(blockNumber, true); // true to include transactions
            if (!block)
                return;
            await this.delay(this.REQUEST_DELAY); // Rate limit protection
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
            // Filter transactions that involve watched addresses
            const relevantTxs = block.prefetchedTransactions.filter(tx => {
                const fromWatched = this.isWatchedAddress(tx.from);
                const toWatched = tx.to ? this.isWatchedAddress(tx.to) : false;
                return fromWatched || toWatched;
            });
            // If no relevant transactions, just record the block and skip
            if (relevantTxs.length === 0) {
                db.prepare(`
                    INSERT OR IGNORE INTO blocks (number, hash, parent_hash, timestamp, processed_at)
                    VALUES (?, ?, ?, ?, ?)
                `).run(block.number, block.hash, block.parentHash, block.timestamp, Date.now());
                return;
            }
            console.log(`🔍 Found ${relevantTxs.length} relevant transactions in block ${blockNumber}`);
            // Fetch receipts ONLY for relevant transactions (with rate limiting)
            const receiptMap = new Map();
            for (const tx of relevantTxs) {
                try {
                    await this.delay(this.REQUEST_DELAY); // Rate limit between each request
                    const receipt = await this.provider.getTransactionReceipt(tx.hash);
                    if (receipt)
                        receiptMap.set(receipt.hash, receipt);
                }
                catch (error) {
                    // If rate limited, stop and let the poll loop handle backoff
                    if (error?.message?.includes('rate limit') || error?.message?.includes('-32007')) {
                        throw error;
                    }
                    console.error(`Failed to get receipt for ${tx.hash}:`, error);
                }
            }
            db.transaction(() => {
                // Insert Block
                insertBlock.run(block.number, block.hash, block.parentHash, block.timestamp, Date.now());
                // Process only relevant transactions
                for (const tx of relevantTxs) {
                    const receipt = receiptMap.get(tx.hash);
                    const status = receipt ? receipt.status : 0; // 0 = failed, 1 = success
                    insertTx.run(tx.hash, block.number, tx.from.toLowerCase(), tx.to?.toLowerCase() || null, tx.value.toString(), tx.data, tx.nonce, tx.gasLimit.toString(), tx.gasPrice?.toString() || '0', block.timestamp, status);
                    // Detect Native Transfers (only if involves watched address)
                    if (tx.value > 0 && status === 1) {
                        const fromWatched = this.isWatchedAddress(tx.from);
                        const toWatched = tx.to ? this.isWatchedAddress(tx.to) : false;
                        if (fromWatched || toWatched) {
                            insertEvent.run(tx.hash, block.number, 'Transfer', tx.from.toLowerCase(), tx.to?.toLowerCase() || null, tx.value.toString(), 'NATIVE', // Native token
                            null, block.timestamp);
                            // Trigger Webhooks only for watched addresses
                            const payload = {
                                type: 'Transfer',
                                hash: tx.hash,
                                from: tx.from,
                                to: tx.to,
                                value: tx.value.toString(),
                                token: 'NATIVE',
                                timestamp: block.timestamp
                            };
                            if (fromWatched)
                                webhookService.trigger(tx.from, 'Transfer', payload);
                            if (toWatched && tx.to) {
                                webhookService.trigger(tx.to, 'Transfer', payload);
                                // Push notification for incoming transfer
                                const amount = parseFloat(ethers.formatEther(tx.value));
                                pushService.sendNotification(tx.to, {
                                    title: 'Incoming Transfer',
                                    body: `You received ${amount} ARC from ${tx.from.slice(0, 6)}...${tx.from.slice(-4)}`,
                                    icon: '/icon-192x192.png'
                                });
                                console.log(`📨 Native notification sent: ${amount} ARC to ${tx.to.slice(0, 6)}...`);
                            }
                        }
                    }
                    // Parse ERC20 Transfers from logs - ONLY for watched addresses
                    if (receipt && status === 1) {
                        for (const log of receipt.logs) {
                            // Transfer(address from, address to, uint256 value)
                            if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' && log.topics.length === 3) {
                                try {
                                    const from = ethers.getAddress('0x' + log.topics[1].slice(26)).toLowerCase();
                                    const to = ethers.getAddress('0x' + log.topics[2].slice(26)).toLowerCase();
                                    // CRITICAL: Only process if from or to is a watched address
                                    const fromWatched = this.isWatchedAddress(from);
                                    const toWatched = this.isWatchedAddress(to);
                                    if (!fromWatched && !toWatched) {
                                        continue; // Skip this ERC20 transfer - not for our users
                                    }
                                    const value = BigInt(log.data).toString();
                                    const tokenAddress = log.address.toLowerCase();
                                    insertEvent.run(tx.hash, block.number, 'Transfer', from, to, value, tokenAddress, null, block.timestamp);
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
                                    if (fromWatched)
                                        webhookService.trigger(from, 'Transfer', payload);
                                    if (toWatched)
                                        webhookService.trigger(to, 'Transfer', payload);
                                    // Push Notification for ERC20 (async, only for receiver if watched)
                                    if (toWatched) {
                                        (async () => {
                                            try {
                                                const metadata = await this.tokenMetadataService.getTokenMetadata(tokenAddress);
                                                const formattedAmount = metadata
                                                    ? this.tokenMetadataService.formatTokenAmount(value, metadata.decimals)
                                                    : value;
                                                const tokenSymbol = metadata?.symbol || 'tokens';
                                                pushService.sendNotification(to, {
                                                    title: 'Incoming Token Transfer',
                                                    body: `You received ${formattedAmount} ${tokenSymbol} from ${from.slice(0, 6)}...${from.slice(-4)}`,
                                                    icon: '/icon-192x192.png',
                                                    data: {
                                                        type: 'erc20_transfer',
                                                        from,
                                                        to,
                                                        value: formattedAmount,
                                                        tokenAddress,
                                                        tokenSymbol,
                                                        txHash: tx.hash
                                                    }
                                                });
                                                console.log(`📨 ERC20 notification sent: ${formattedAmount} ${tokenSymbol} to ${to.slice(0, 6)}...`);
                                            }
                                            catch (notifError) {
                                                console.error('Error sending ERC20 notification:', notifError);
                                            }
                                        })();
                                    }
                                }
                                catch (e) {
                                    console.error('Error parsing ERC20 log:', e);
                                }
                            }
                        }
                    }
                }
            })();
        }
        catch (error) {
            console.error(`Failed to process block ${blockNumber}:`, error);
            throw error; // Re-throw to let poll() handle backoff
        }
    }
    /**
     * Get transaction history for an address
     */
    getHistory(address, limit = 20, offset = 0) {
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
//# sourceMappingURL=indexerService.js.map