import { Interface, ethers } from 'ethers';

export interface Transaction {
    to: string;
    value: bigint;
    data: string;
}

export class BatchService {
    private accountInterface: Interface;

    constructor() {
        // Minimal ABI for executeBatch
        const abi = [
            'function executeBatch(address[] dest, uint256[] value, bytes[] func)'
        ];
        this.accountInterface = new Interface(abi);
    }

    /**
     * Encode multiple transactions into a single executeBatch call
     */
    encodeBatchData(transactions: Transaction[]): string {
        const dests = transactions.map(tx => tx.to);
        const values = transactions.map(tx => tx.value);
        const funcs = transactions.map(tx => tx.data);

        return this.accountInterface.encodeFunctionData('executeBatch', [
            dests,
            values,
            funcs
        ]);
    }

    /**
     * Decode a batch transaction data (useful for displaying details)
     */
    decodeBatchData(data: string): Transaction[] | null {
        try {
            const decoded = this.accountInterface.decodeFunctionData('executeBatch', data);
            const dests = decoded[0];
            const values = decoded[1];
            const funcs = decoded[2];

            const transactions: Transaction[] = [];
            for (let i = 0; i < dests.length; i++) {
                transactions.push({
                    to: dests[i],
                    value: values[i],
                    data: funcs[i]
                });
            }
            return transactions;
        } catch (error) {
            return null;
        }
    }
}

export const batchService = new BatchService();
