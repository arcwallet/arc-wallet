/**
 * Circle API Client
 * Integration with Circle's Web3 Services APIs
 */
export interface CircleApiConfig {
    apiKey: string;
    baseUrl?: string;
}
export interface CircleTransaction {
    id: string;
    state: string;
    amount: string;
    sourceAddress: string;
    destinationAddress: string;
    txHash?: string;
    createDate: string;
}
export declare class CircleApiClient {
    private config;
    private baseUrl;
    constructor(config: CircleApiConfig);
    /**
     * Monitor USDC transactions via Circle API
     */
    getUSDCTransactions(address: string): Promise<CircleTransaction[]>;
    /**
     * Get real-time USDC balance from Circle API
     */
    getUSDCBalance(address: string, chainId: number): Promise<string>;
}
