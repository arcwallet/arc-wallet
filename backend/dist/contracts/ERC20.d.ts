/**
 * ERC20 Token Interface
 * Standard ABI for fetching token metadata
 */
export declare const ERC20_ABI: string[];
export interface TokenMetadata {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    chainId?: number;
    lastUpdated?: Date;
    createdAt?: Date;
}
export interface TokenMetadataRow {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    chain_id: number;
    last_updated: string;
    created_at: string;
}
//# sourceMappingURL=ERC20.d.ts.map