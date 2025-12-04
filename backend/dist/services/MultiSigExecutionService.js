/**
 * Multi-Sig On-Chain Execution Service
 * Executes approved multi-sig transactions on the blockchain
 */
import { ethers, JsonRpcProvider, Wallet, Contract, Interface } from 'ethers';
// ArcAccount ABI for execution
const ARC_ACCOUNT_ABI = [
    'function execute(address target, uint256 value, bytes data) returns (bytes)',
    'function executeBatch(address[] targets, uint256[] values, bytes[] datas) returns (bytes[])',
    'function signatureThreshold() view returns (uint8)',
    'function activeKeyCount() view returns (uint8)',
];
// ERC20 ABI for token transfers
const ERC20_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)',
];
export class MultiSigExecutionService {
    provider;
    relayerWallet = null;
    chainId;
    constructor(rpcUrl, chainId = 5042002) {
        this.provider = new JsonRpcProvider(rpcUrl);
        this.chainId = chainId;
    }
    /**
     * Initialize with a relayer private key for gas sponsorship
     */
    initRelayer(privateKey) {
        this.relayerWallet = new Wallet(privateKey, this.provider);
    }
    /**
     * Execute an approved multi-sig transaction
     */
    async executeTransaction(params) {
        try {
            if (!this.relayerWallet) {
                return { success: false, error: 'Relayer not initialized' };
            }
            const { accountAddress, targetAddress, value, tokenAddress, data } = params;
            // Connect to ArcAccount contract
            const arcAccount = new Contract(accountAddress, ARC_ACCOUNT_ABI, this.relayerWallet);
            let txData;
            let txValue;
            if (tokenAddress && tokenAddress !== '0x0000000000000000000000000000000000000000') {
                // ERC20 token transfer
                const erc20Interface = new Interface(ERC20_ABI);
                // Get token decimals
                const tokenContract = new Contract(tokenAddress, ERC20_ABI, this.provider);
                const decimals = await tokenContract.decimals();
                // Parse value with correct decimals
                const tokenAmount = ethers.parseUnits(value, decimals);
                // Encode transfer call
                txData = erc20Interface.encodeFunctionData('transfer', [targetAddress, tokenAmount]);
                txValue = 0n;
                // Execute on token contract
                const tx = await arcAccount.execute(tokenAddress, txValue, txData);
                const receipt = await tx.wait();
                return {
                    success: true,
                    txHash: receipt.hash,
                    gasUsed: receipt.gasUsed.toString(),
                };
            }
            else {
                // Native ETH transfer
                txData = data || '0x';
                txValue = ethers.parseEther(value);
                const tx = await arcAccount.execute(targetAddress, txValue, txData);
                const receipt = await tx.wait();
                return {
                    success: true,
                    txHash: receipt.hash,
                    gasUsed: receipt.gasUsed.toString(),
                };
            }
        }
        catch (error) {
            console.error('Transaction execution failed:', error);
            return {
                success: false,
                error: error.message || 'Execution failed',
            };
        }
    }
    /**
     * Execute batch transactions
     */
    async executeBatch(accountAddress, transactions) {
        try {
            if (!this.relayerWallet) {
                return { success: false, error: 'Relayer not initialized' };
            }
            const arcAccount = new Contract(accountAddress, ARC_ACCOUNT_ABI, this.relayerWallet);
            const targets = transactions.map(t => t.target);
            const values = transactions.map(t => ethers.parseEther(t.value));
            const datas = transactions.map(t => t.data || '0x');
            const tx = await arcAccount.executeBatch(targets, values, datas);
            const receipt = await tx.wait();
            return {
                success: true,
                txHash: receipt.hash,
                gasUsed: receipt.gasUsed.toString(),
            };
        }
        catch (error) {
            console.error('Batch execution failed:', error);
            return {
                success: false,
                error: error.message || 'Batch execution failed',
            };
        }
    }
    /**
     * Check if account has enough balance for transaction
     */
    async checkBalance(accountAddress, value, tokenAddress) {
        try {
            if (tokenAddress && tokenAddress !== '0x0000000000000000000000000000000000000000') {
                const tokenContract = new Contract(tokenAddress, ERC20_ABI, this.provider);
                const balance = await tokenContract.balanceOf(accountAddress);
                const decimals = await tokenContract.decimals();
                const requiredAmount = ethers.parseUnits(value, decimals);
                return balance >= requiredAmount;
            }
            else {
                const balance = await this.provider.getBalance(accountAddress);
                const requiredAmount = ethers.parseEther(value);
                return balance >= requiredAmount;
            }
        }
        catch {
            return false;
        }
    }
    /**
     * Get account contract info
     */
    async getAccountInfo(accountAddress) {
        try {
            const arcAccount = new Contract(accountAddress, ARC_ACCOUNT_ABI, this.provider);
            const [threshold, keyCount, balance] = await Promise.all([
                arcAccount.signatureThreshold(),
                arcAccount.activeKeyCount(),
                this.provider.getBalance(accountAddress),
            ]);
            return {
                threshold: Number(threshold),
                keyCount: Number(keyCount),
                balance: ethers.formatEther(balance),
            };
        }
        catch {
            return null;
        }
    }
    /**
     * Estimate gas for transaction
     */
    async estimateGas(params) {
        try {
            const { accountAddress, targetAddress, value, tokenAddress, data } = params;
            const arcAccount = new Contract(accountAddress, ARC_ACCOUNT_ABI, this.provider);
            let txData;
            let txValue;
            if (tokenAddress && tokenAddress !== '0x0000000000000000000000000000000000000000') {
                const erc20Interface = new Interface(ERC20_ABI);
                const tokenContract = new Contract(tokenAddress, ERC20_ABI, this.provider);
                const decimals = await tokenContract.decimals();
                const tokenAmount = ethers.parseUnits(value, decimals);
                txData = erc20Interface.encodeFunctionData('transfer', [targetAddress, tokenAmount]);
                txValue = 0n;
                const gasEstimate = await arcAccount.execute.estimateGas(tokenAddress, txValue, txData);
                return gasEstimate.toString();
            }
            else {
                txData = data || '0x';
                txValue = ethers.parseEther(value);
                const gasEstimate = await arcAccount.execute.estimateGas(targetAddress, txValue, txData);
                return gasEstimate.toString();
            }
        }
        catch {
            return null;
        }
    }
}
// Singleton instance
let executionServiceInstance = null;
export const getExecutionService = () => {
    if (!executionServiceInstance) {
        const rpcUrl = process.env.ARC_TESTNET_RPC || 'https://rpc.testnet.arc.network';
        const chainId = parseInt(process.env.ARC_CHAIN_ID || '5042002');
        executionServiceInstance = new MultiSigExecutionService(rpcUrl, chainId);
        // Initialize relayer if private key is available
        const relayerKey = process.env.RELAYER_PRIVATE_KEY;
        if (relayerKey) {
            executionServiceInstance.initRelayer(relayerKey);
        }
    }
    return executionServiceInstance;
};
export default MultiSigExecutionService;
//# sourceMappingURL=MultiSigExecutionService.js.map