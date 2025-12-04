/**
 * Multi-Sig On-Chain Execution Service
 * Uses ERC-4337 UserOperations for gasless transaction execution
 * No relayer private key needed - uses bundler + paymaster
 */
import { ethers, JsonRpcProvider, Contract, Interface } from 'ethers';
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
// EntryPoint ABI for UserOp submission
const ENTRYPOINT_ABI = [
    'function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address beneficiary)',
    'function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)',
];
export class MultiSigExecutionService {
    provider;
    chainId;
    entryPointAddress;
    bundlerUrl;
    paymasterUrl;
    constructor(rpcUrl, chainId = 5042002) {
        this.provider = new JsonRpcProvider(rpcUrl);
        this.chainId = chainId;
        // Arc Testnet EntryPoint (ERC-4337 v0.6)
        this.entryPointAddress = process.env.ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
        this.bundlerUrl = process.env.BUNDLER_URL || rpcUrl; // Use RPC if no bundler
        this.paymasterUrl = process.env.PAYMASTER_URL || null;
    }
    /**
     * Prepare a UserOperation for multi-sig transaction
     * Returns the UserOp that needs to be signed by passkeys
     */
    async prepareUserOperation(params) {
        try {
            const { accountAddress, targetAddress, value, tokenAddress, data } = params;
            // Build callData for execute function
            const callData = await this._buildCallData(targetAddress, value, tokenAddress, data);
            // Get nonce from account
            const arcAccount = new Contract(accountAddress, ARC_ACCOUNT_ABI, this.provider);
            const nonce = await arcAccount.getNonce();
            // Get gas prices
            const feeData = await this.provider.getFeeData();
            const maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('1', 'gwei');
            const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('1', 'gwei');
            // Build UserOp (without signature)
            const userOp = {
                sender: accountAddress,
                nonce: nonce.toString(),
                initCode: '0x', // Account already deployed
                callData,
                callGasLimit: '500000',
                verificationGasLimit: '500000',
                preVerificationGas: '50000',
                maxFeePerGas: maxFeePerGas.toString(),
                maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
                paymasterAndData: '0x', // Will be filled by paymaster or empty for self-pay
                signature: '0x',
            };
            // Get paymaster data if available
            if (this.paymasterUrl) {
                const paymasterData = await this._getPaymasterData(userOp);
                if (paymasterData) {
                    userOp.paymasterAndData = paymasterData;
                }
            }
            // Calculate userOpHash for signing
            const userOpHash = await this._getUserOpHash(userOp);
            return {
                ...userOp,
                userOpHash,
            };
        }
        catch (error) {
            console.error('Failed to prepare UserOperation:', error);
            return null;
        }
    }
    /**
     * Execute UserOperation with collected signatures
     * Called after all required passkey signatures are collected
     */
    async executeUserOperation(preparedOp, aggregatedSignature) {
        try {
            const userOp = {
                sender: preparedOp.sender,
                nonce: preparedOp.nonce,
                initCode: preparedOp.initCode,
                callData: preparedOp.callData,
                callGasLimit: preparedOp.callGasLimit,
                verificationGasLimit: preparedOp.verificationGasLimit,
                preVerificationGas: preparedOp.preVerificationGas,
                maxFeePerGas: preparedOp.maxFeePerGas,
                maxPriorityFeePerGas: preparedOp.maxPriorityFeePerGas,
                paymasterAndData: preparedOp.paymasterAndData,
                signature: aggregatedSignature,
            };
            // Send to bundler
            const txHash = await this._sendToBundler(userOp);
            return {
                success: true,
                txHash,
                userOpHash: preparedOp.userOpHash,
            };
        }
        catch (error) {
            console.error('UserOperation execution failed:', error);
            return {
                success: false,
                error: error.message || 'Execution failed',
            };
        }
    }
    /**
     * Simple execution using backend's stored signatures
     * For when all signatures are already collected in DB
     */
    async executeTransaction(params, storedSignatures) {
        try {
            // Prepare the UserOp
            const preparedOp = await this.prepareUserOperation(params);
            if (!preparedOp) {
                return { success: false, error: 'Failed to prepare UserOperation' };
            }
            // Aggregate signatures into format expected by ArcAccount
            const aggregatedSignature = this._aggregateSignatures(storedSignatures);
            // Execute
            return this.executeUserOperation(preparedOp, aggregatedSignature);
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
     * Build callData for execute function
     */
    async _buildCallData(targetAddress, value, tokenAddress, data) {
        const arcAccountInterface = new Interface(ARC_ACCOUNT_ABI);
        if (tokenAddress && tokenAddress !== '0x0000000000000000000000000000000000000000') {
            // ERC20 token transfer
            const erc20Interface = new Interface(ERC20_ABI);
            const tokenContract = new Contract(tokenAddress, ERC20_ABI, this.provider);
            const decimals = await tokenContract.decimals();
            const tokenAmount = ethers.parseUnits(value, decimals);
            const transferData = erc20Interface.encodeFunctionData('transfer', [targetAddress, tokenAmount]);
            // execute(tokenAddress, 0, transferData)
            return arcAccountInterface.encodeFunctionData('execute', [tokenAddress, 0n, transferData]);
        }
        else {
            // Native ETH transfer
            const txValue = ethers.parseEther(value);
            const txData = data || '0x';
            return arcAccountInterface.encodeFunctionData('execute', [targetAddress, txValue, txData]);
        }
    }
    /**
     * Get paymaster sponsorship data
     */
    async _getPaymasterData(userOp) {
        if (!this.paymasterUrl)
            return null;
        try {
            const response = await fetch(this.paymasterUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'pm_sponsorUserOperation',
                    params: [userOp, this.entryPointAddress],
                }),
            });
            const result = await response.json();
            return result.result?.paymasterAndData || null;
        }
        catch {
            return null;
        }
    }
    /**
     * Calculate UserOp hash for signing
     */
    async _getUserOpHash(userOp) {
        // Pack UserOp fields and hash
        const packed = ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256', 'bytes32', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes32'], [
            userOp.sender,
            userOp.nonce,
            ethers.keccak256(userOp.initCode),
            ethers.keccak256(userOp.callData),
            userOp.callGasLimit,
            userOp.verificationGasLimit,
            userOp.preVerificationGas,
            userOp.maxFeePerGas,
            userOp.maxPriorityFeePerGas,
            ethers.keccak256(userOp.paymasterAndData),
        ]);
        const userOpHash = ethers.keccak256(packed);
        // Add EntryPoint and chainId
        const finalHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['bytes32', 'address', 'uint256'], [userOpHash, this.entryPointAddress, this.chainId]));
        return finalHash;
    }
    /**
     * Send UserOp to bundler
     */
    async _sendToBundler(userOp) {
        const response = await fetch(this.bundlerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_sendUserOperation',
                params: [userOp, this.entryPointAddress],
            }),
        });
        const result = await response.json();
        if (result.error) {
            throw new Error(result.error.message || 'Bundler rejected UserOp');
        }
        // Wait for receipt
        const userOpHash = result.result;
        const txHash = await this._waitForUserOpReceipt(userOpHash);
        return txHash;
    }
    /**
     * Wait for UserOp to be included in a block
     */
    async _waitForUserOpReceipt(userOpHash, timeout = 60000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            try {
                const response = await fetch(this.bundlerUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'eth_getUserOperationReceipt',
                        params: [userOpHash],
                    }),
                });
                const result = await response.json();
                if (result.result?.receipt?.transactionHash) {
                    return result.result.receipt.transactionHash;
                }
            }
            catch {
                // Continue waiting
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        throw new Error('UserOp confirmation timeout');
    }
    /**
     * Aggregate P256 signatures for multi-sig
     * Format: [keyIndex1][signature1][keyIndex2][signature2]...
     */
    _aggregateSignatures(signatures) {
        // Sort by public key to ensure deterministic ordering
        const sorted = [...signatures].sort((a, b) => a.publicKey.localeCompare(b.publicKey));
        // Concatenate signatures with key indices
        let aggregated = '0x';
        for (let i = 0; i < sorted.length; i++) {
            // Each signature entry: [1 byte keyIndex][64 bytes signature]
            const keyIndex = i.toString(16).padStart(2, '0');
            const sig = sorted[i].signature.replace('0x', '');
            aggregated += keyIndex + sig;
        }
        return aggregated;
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
            const callData = await this._buildCallData(params.targetAddress, params.value, params.tokenAddress, params.data);
            // Estimate using eth_estimateGas on callData
            const estimate = await this.provider.estimateGas({
                to: params.accountAddress,
                data: callData,
            });
            return estimate.toString();
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
    }
    return executionServiceInstance;
};
export default MultiSigExecutionService;
//# sourceMappingURL=MultiSigExecutionService.js.map