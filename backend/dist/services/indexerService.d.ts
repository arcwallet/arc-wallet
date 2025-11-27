import { Database } from '../models/Database.js';
/**
 * Indexer Service
 * Listens to the blockchain and indexes transactions/events to a local SQLite database.
 */
declare class IndexerService {
    private provider;
    private isRunning;
    private pollingInterval;
    private currentPollingDelay;
    private readonly BASE_POLLING_DELAY;
    private readonly MAX_POLLING_DELAY;
    private readonly BLOCK_BATCH_SIZE;
    private readonly BLOCK_DELAY;
    private rateLimitHits;
    private tokenMetadataService;
    constructor(database: Database);
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
     * Get the last indexed block number from DB
     * If no blocks indexed yet, start from recent blocks (not from 0)
     */
    private getLastIndexedBlock;
    /**
     * Get starting block - either last indexed or recent if fresh start
     */
    private getStartingBlock;
    /**
     * Process a single block
     */
    private processBlock;
    /**
     * Get transaction history for an address
     */
    getHistory(address: string, limit?: number, offset?: number): unknown[];
}
export { IndexerService };
//# sourceMappingURL=indexerService.d.ts.map