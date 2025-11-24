import { ethers } from 'ethers';
import { Database } from '../models/Database.js';
import { TokenMetadata } from '../contracts/ERC20.js';
export declare class TokenMetadataService {
    private provider;
    private db;
    constructor(provider: ethers.Provider, db: Database);
    /**
     * Get token metadata from cache or fetch from blockchain
     */
    getTokenMetadata(address: string): Promise<TokenMetadata | null>;
    /**
     * Fetch metadata from blockchain and cache it
     */
    fetchAndCacheMetadata(address: string): Promise<TokenMetadata>;
    /**
     * Format token amount with proper decimals
     */
    formatTokenAmount(value: string, decimals: number): string;
    /**
     * Get formatted amount for a token
     */
    getFormattedAmount(tokenAddress: string, rawValue: string): Promise<string>;
    /**
     * Pre-populate cache with common tokens
     */
    prePopulateCommonTokens(tokens: {
        address: string;
        symbol: string;
        name: string;
        decimals: number;
    }[]): Promise<void>;
    /**
     * Batch fetch metadata for multiple tokens
     */
    batchFetchMetadata(addresses: string[]): Promise<Map<string, TokenMetadata | null>>;
}
//# sourceMappingURL=tokenMetadataService.d.ts.map