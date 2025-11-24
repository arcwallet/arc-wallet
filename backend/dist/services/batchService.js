import { Interface } from 'ethers';
export class BatchService {
    accountInterface;
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
    encodeBatchData(transactions) {
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
    decodeBatchData(data) {
        try {
            const decoded = this.accountInterface.decodeFunctionData('executeBatch', data);
            const dests = decoded[0];
            const values = decoded[1];
            const funcs = decoded[2];
            const transactions = [];
            for (let i = 0; i < dests.length; i++) {
                transactions.push({
                    to: dests[i],
                    value: values[i],
                    data: funcs[i]
                });
            }
            return transactions;
        }
        catch (error) {
            return null;
        }
    }
}
export const batchService = new BatchService();
//# sourceMappingURL=batchService.js.map