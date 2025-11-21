/**
 * ERC20 Token Interface
 * Standard ABI for fetching token metadata
 */

export const ERC20_ABI = [
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function name() view returns (string)',
];

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
