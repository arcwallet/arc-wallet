import { ethers } from 'ethers';
import { ERC20_ABI } from '../contracts/ERC20.js';
export class TokenMetadataService {
    provider;
    db;
    constructor(provider, db) {
        this.provider = provider;
        this.db = db;
    }
    /**
     * Get token metadata from cache or fetch from blockchain
     */
    async getTokenMetadata(address) {
        const normalized = address.toLowerCase();
        // Check cache first
        const cached = await this.db.getTokenMetadata(normalized);
        if (cached) {
            return cached;
        }
        // Fetch from blockchain
        try {
            return await this.fetchAndCacheMetadata(normalized);
        }
        catch (error) {
            console.error(`Failed to fetch metadata for ${address}:`, error);
            return null;
        }
    }
    /**
     * Fetch metadata from blockchain and cache it
     */
    async fetchAndCacheMetadata(address) {
        const contract = new ethers.Contract(address, ERC20_ABI, this.provider);
        try {
            // Fetch all metadata in parallel
            const [decimals, symbol, name] = await Promise.all([
                contract.decimals(),
                contract.symbol(),
                contract.name(),
            ]);
            const metadata = {
                address: address.toLowerCase(),
                symbol,
                name,
                decimals: Number(decimals),
            };
            // Cache in database
            await this.db.saveTokenMetadata(metadata);
            console.log(`✅ Cached metadata for ${symbol} (${address})`);
            return metadata;
        }
        catch (error) {
            // Handle non-standard ERC20 tokens
            console.warn(`Token ${address} may not be a standard ERC20:`, error.message);
            // Try to get partial metadata
            let symbol = 'UNKNOWN';
            let name = 'Unknown Token';
            let decimals = 18; // Default to 18 decimals
            try {
                symbol = await contract.symbol();
            }
            catch (e) {
                console.warn(`Failed to get symbol for ${address}`);
            }
            try {
                name = await contract.name();
            }
            catch (e) {
                console.warn(`Failed to get name for ${address}`);
            }
            try {
                decimals = Number(await contract.decimals());
            }
            catch (e) {
                console.warn(`Failed to get decimals for ${address}, using default 18`);
            }
            const metadata = {
                address: address.toLowerCase(),
                symbol,
                name,
                decimals,
            };
            // Cache even partial metadata
            await this.db.saveTokenMetadata(metadata);
            return metadata;
        }
    }
    /**
     * Format token amount with proper decimals
     */
    formatTokenAmount(value, decimals) {
        try {
            const amount = ethers.formatUnits(value, decimals);
            const num = parseFloat(amount);
            // Format with appropriate precision
            if (num === 0)
                return '0';
            if (num >= 1000000)
                return num.toFixed(2); // Millions
            if (num >= 1000)
                return num.toFixed(2); // Thousands
            if (num >= 1)
                return num.toFixed(4); // Regular amounts
            if (num >= 0.0001)
                return num.toFixed(6); // Small amounts
            return num.toExponential(2); // Very small amounts
        }
        catch (error) {
            console.error('Error formatting token amount:', error);
            return value; // Return raw value on error
        }
    }
    /**
     * Get formatted amount for a token
     */
    async getFormattedAmount(tokenAddress, rawValue) {
        const metadata = await this.getTokenMetadata(tokenAddress);
        if (!metadata) {
            return rawValue; // Return raw value if metadata not available
        }
        return this.formatTokenAmount(rawValue, metadata.decimals);
    }
    /**
     * Pre-populate cache with common tokens
     */
    async prePopulateCommonTokens(tokens) {
        console.log(`Pre-populating ${tokens.length} common tokens...`);
        for (const token of tokens) {
            try {
                await this.db.saveTokenMetadata(token);
                console.log(`✅ Pre-populated ${token.symbol}`);
            }
            catch (error) {
                console.error(`Failed to pre-populate ${token.symbol}:`, error);
            }
        }
        console.log('✅ Common tokens pre-populated');
    }
    /**
     * Batch fetch metadata for multiple tokens
     */
    async batchFetchMetadata(addresses) {
        const results = new Map();
        // Fetch in parallel with error handling for each
        const promises = addresses.map(async (address) => {
            try {
                const metadata = await this.getTokenMetadata(address);
                results.set(address.toLowerCase(), metadata);
            }
            catch (error) {
                console.error(`Failed to fetch metadata for ${address}:`, error);
                results.set(address.toLowerCase(), null);
            }
        });
        await Promise.all(promises);
        return results;
    }
}
//# sourceMappingURL=tokenMetadataService.js.map