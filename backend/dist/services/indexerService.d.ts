import { Database } from '../models/Database.js';
/**
 * Indexer Service
 * Listens to the blockchain and indexes transactions/events ONLY for registered wallet addresses.
 * This is a targeted indexer - it doesn't process all network activity, only what matters to users.
 */
declare class IndexerService {
    private provider;
    private database;
    private isRunning;
    private pollingInterval;
    private currentPollingDelay;
    private readonly BASE_POLLING_DELAY;
    private readonly MAX_POLLING_DELAY;
    private readonly BLOCK_BATCH_SIZE;
    private readonly BLOCK_DELAY;
    private readonly REQUEST_DELAY;
    private rateLimitHits;
    private tokenMetadataService;
    private watchedAddresses;
    private lastAddressRefresh;
    private readonly ADDRESS_REFRESH_INTERVAL;
    constructor(database: Database);
    /**
     * Refresh the list of watched addresses from the database
     */
    private refreshWatchedAddresses;
    /**
     * Check if an address should be watched (is registered user)
     */
    private isWatchedAddress;
    /**
     * Start the indexer
     */
    start(): void;
    /**
     * Stop the indexer
     */
    stop(): void;
    /**
     * Poll for new blocks
     */
    private poll;
    /**
     * Helper to add delay between operations
     */
    private delay;
    /**
     * Get the last indexed block number from DB
     * If no blocks indexed yet, start from recent blocks (not from 0)
     */
    private getLastIndexedBlock;
    /**
     * Get starting block - either last indexed or recent if fresh start
     */
    private getStartingBlock;
    /**
     * Process a single block - ONLY for watched addresses
     */
    private processBlock;
    /**
     * Get transaction history for an address
     */
    getHistory(address: string, limit?: number, offset?: number): unknown[];
}
export { IndexerService };
//# sourceMappingURL=indexerService.d.ts.map