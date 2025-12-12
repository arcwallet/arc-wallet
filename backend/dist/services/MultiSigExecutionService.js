/**
 * Multi-Sig On-Chain Execution Service
 *
 * NOTE: This legacy service used the old backend bundler.
 * Now using Circle Modular Wallet SDK with ERC-6900 multi-sig on frontend.
 * This file is kept for backwards compatibility but execution methods are disabled.
 * Use ERC6900MultiSigContext and Circle SDK for multi-sig operations.
 */
import { ethers, JsonRpcProvider, Contract } from 'ethers';
// ArcAccount ABI for execution
const ARC_ACCOUNT_ABI = [
    'function execute(address target, uint256 value, bytes data) returns (bytes)',
    'function executeBatch(address[] targets, uint256[] values, bytes[] datas) returns (bytes[])',
    'function signatureThreshold() view returns (uint8)',
    'function activeKeyCount() view returns (uint8)',
    'function getNonce() view returns (uint256)',
];
// ERC20 ABI for token transfers
const ERC20_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)',
];
export class MultiSigExecutionService {
    provider;
    chainId;
    entryPointAddress;
    constructor(rpcUrl, chainId = 5042002) {
        this.provider = new JsonRpcProvider(rpcUrl);
        this.chainId = chainId;
        this.entryPointAddress = process.env.ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
    }
    /**
     * Prepare a UserOperation for multi-sig transaction
     * @deprecated Use Circle Modular Wallet SDK (ERC6900MultiSigContext) instead
     */
    async prepareUserOperation(_params) {
        console.warn('prepareUserOperation is deprecated. Use Circle SDK with ERC6900MultiSigContext.');
        // Legacy bundler removed - use Circle SDK on frontend
        return null;
    }
    /**
     * Execute UserOperation via existing BundlerService
     * @deprecated Use Circle Modular Wallet SDK (ERC6900MultiSigContext) instead
     */
    async executeUserOperation(_preparedOp, _aggregatedSignature) {
        console.warn('executeUserOperation is deprecated. Use Circle SDK with ERC6900MultiSigContext.');
        return {
            success: false,
            error: 'Legacy bundler removed. Use Circle SDK on frontend for multi-sig execution.',
        };
    }
    /**
     * Simple execution for when signatures are ready
     * @deprecated Use Circle Modular Wallet SDK (ERC6900MultiSigContext) instead
     */
    async executeTransaction(_params, _aggregatedSignature) {
        console.warn('executeTransaction is deprecated. Use Circle SDK with ERC6900MultiSigContext.');
        return {
            success: false,
            error: 'Legacy bundler removed. Use Circle SDK on frontend for multi-sig execution.',
        };
    }
    // Legacy helper methods removed - use Circle SDK on frontend
    /**
     * Wait for UserOp receipt via bundler
     * @deprecated Legacy bundler removed
     */
    async _waitForReceipt(_userOpHash, _timeout = 60000) {
        // Legacy bundler removed - use Circle SDK on frontend
        return null;
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
}
// Singleton instance
let executionServiceInstance = null;
export const getExecutionService = () => {
    if (!executionServiceInstance) {
        const rpcUrl = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
        const chainId = parseInt(process.env.ARC_CHAIN_ID || '5042002');
        executionServiceInstance = new MultiSigExecutionService(rpcUrl, chainId);
    }
    return executionServiceInstance;
};
export default MultiSigExecutionService;
//# sourceMappingURL=MultiSigExecutionService.js.map