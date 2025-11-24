export interface Transaction {
    to: string;
    value: bigint;
    data: string;
}
export declare class BatchService {
    private accountInterface;
    constructor();
    /**
     * Encode multiple transactions into a single executeBatch call
     */
    encodeBatchData(transactions: Transaction[]): string;
    /**
     * Decode a batch transaction data (useful for displaying details)
     */
    decodeBatchData(data: string): Transaction[] | null;
}
export declare const batchService: BatchService;
//# sourceMappingURL=batchService.d.ts.map