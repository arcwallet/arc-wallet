/**
 * ERC-4337 Bundler Service
 *
 * A lightweight bundler implementation for Arc Wallet.
 * Handles UserOperation validation, bundling, and submission to EntryPoint.
 *
 * Flow:
 * 1. User submits UserOperation via eth_sendUserOperation
 * 2. Bundler validates the UserOperation
 * 3. Bundler bundles it and calls EntryPoint.handleOps()
 * 4. Returns userOpHash for tracking
 */
import { ethers } from 'ethers';
// EntryPoint v0.6 ABI (minimal required functions)
const ENTRY_POINT_ABI = [
    'function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address payable beneficiary) external',
    'function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp) external view returns (bytes32)',
    'function getNonce(address sender, uint192 key) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)',
    'function depositTo(address account) external payable',
    'event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)',
    'event UserOperationRevertReason(bytes32 indexed userOpHash, address indexed sender, uint256 nonce, bytes revertReason)',
];
export class BundlerService {
    provider;
    bundlerWallet;
    entryPoint;
    entryPointAddress;
    chainId;
    mempool = new Map();
    isRunning = false;
    bundleInterval = null;
    // Configuration
    BUNDLE_INTERVAL = 5000; // Bundle every 5 seconds
    MAX_BUNDLE_SIZE = 10; // Max ops per bundle
    MEMPOOL_EXPIRY = 300000; // 5 minutes
    MIN_STAKE = 0; // No staking required for testnet
    constructor() {
        const rpcUrl = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
        const bundlerPrivateKey = process.env.BUNDLER_PRIVATE_KEY;
        this.entryPointAddress = process.env.ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
        if (!bundlerPrivateKey) {
            throw new Error('BUNDLER_PRIVATE_KEY not configured');
        }
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.bundlerWallet = new ethers.Wallet(bundlerPrivateKey, this.provider);
        this.entryPoint = new ethers.Contract(this.entryPointAddress, ENTRY_POINT_ABI, this.bundlerWallet);
        this.chainId = 5042002; // Arc Testnet
        console.log(`🔗 Bundler initialized:`);
        console.log(`   Address: ${this.bundlerWallet.address}`);
        console.log(`   EntryPoint: ${this.entryPointAddress}`);
        console.log(`   Chain: Arc Testnet (${this.chainId})`);
    }
    /**
     * Start the bundler service
     */
    async start() {
        if (this.isRunning)
            return;
        // Verify bundler has funds
        const balance = await this.provider.getBalance(this.bundlerWallet.address);
        console.log(`💰 Bundler balance: ${ethers.formatEther(balance)} ETH`);
        if (balance === 0n) {
            console.warn('⚠️ Bundler wallet has no funds! Please fund it for gas.');
        }
        this.isRunning = true;
        this.bundleInterval = setInterval(() => this.processBundle(), this.BUNDLE_INTERVAL);
        console.log('🚀 Bundler service started');
    }
    /**
     * Stop the bundler service
     */
    stop() {
        this.isRunning = false;
        if (this.bundleInterval) {
            clearInterval(this.bundleInterval);
            this.bundleInterval = null;
        }
        console.log('🛑 Bundler service stopped');
    }
    /**
     * eth_sendUserOperation - Submit a UserOperation to the mempool
     */
    async sendUserOperation(userOp, entryPointAddr) {
        // Validate entryPoint
        if (entryPointAddr.toLowerCase() !== this.entryPointAddress.toLowerCase()) {
            throw new Error(`Unsupported EntryPoint. Expected ${this.entryPointAddress}`);
        }
        // Pack the UserOperation
        const packedOp = this.packUserOperation(userOp);
        // Calculate userOpHash
        const userOpHash = await this.getUserOpHash(packedOp);
        // Validate the UserOperation
        await this.validateUserOperation(packedOp);
        // Add to mempool
        this.mempool.set(userOpHash, {
            userOp: packedOp,
            userOpHash,
            addedAt: Date.now(),
            status: 'pending',
        });
        console.log(`📥 UserOp added to mempool: ${userOpHash.slice(0, 18)}...`);
        console.log(`   Sender: ${packedOp.sender}`);
        console.log(`   Nonce: ${packedOp.nonce}`);
        return userOpHash;
    }
    /**
     * eth_getUserOperationByHash - Get UserOperation status
     */
    async getUserOperationByHash(userOpHash) {
        const entry = this.mempool.get(userOpHash);
        if (!entry) {
            return null;
        }
        return {
            userOperation: this.unpackUserOperation(entry.userOp),
            entryPoint: this.entryPointAddress,
            blockNumber: null,
            blockHash: null,
            transactionHash: entry.txHash || null,
        };
    }
    /**
     * eth_getUserOperationReceipt - Get UserOperation receipt
     */
    async getUserOperationReceipt(userOpHash) {
        const entry = this.mempool.get(userOpHash);
        if (!entry || !entry.txHash) {
            return null;
        }
        try {
            const receipt = await this.provider.getTransactionReceipt(entry.txHash);
            if (!receipt)
                return null;
            // Parse UserOperationEvent from logs
            const iface = new ethers.Interface(ENTRY_POINT_ABI);
            let success = false;
            let actualGasCost = 0n;
            let actualGasUsed = 0n;
            for (const log of receipt.logs) {
                try {
                    const parsed = iface.parseLog({ topics: log.topics, data: log.data });
                    if (parsed?.name === 'UserOperationEvent' && parsed.args.userOpHash === userOpHash) {
                        success = parsed.args.success;
                        actualGasCost = parsed.args.actualGasCost;
                        actualGasUsed = parsed.args.actualGasUsed;
                        break;
                    }
                }
                catch {
                    // Not our event
                }
            }
            return {
                userOpHash,
                entryPoint: this.entryPointAddress,
                sender: entry.userOp.sender,
                nonce: entry.userOp.nonce.toString(),
                paymaster: this.extractPaymaster(entry.userOp.paymasterAndData),
                actualGasCost: actualGasCost.toString(),
                actualGasUsed: actualGasUsed.toString(),
                success,
                logs: receipt.logs,
                receipt: {
                    transactionHash: receipt.hash,
                    transactionIndex: receipt.index,
                    blockHash: receipt.blockHash,
                    blockNumber: receipt.blockNumber,
                    from: receipt.from,
                    to: receipt.to,
                    cumulativeGasUsed: receipt.cumulativeGasUsed.toString(),
                    gasUsed: receipt.gasUsed.toString(),
                    status: receipt.status,
                },
            };
        }
        catch (error) {
            console.error('Error getting receipt:', error);
            return null;
        }
    }
    /**
     * eth_estimateUserOperationGas - Estimate gas for UserOperation
     */
    async estimateUserOperationGas(userOp, entryPointAddr) {
        // Default gas estimates for Arc Testnet
        // These are conservative estimates that should work for most operations
        const preVerificationGas = 50000n;
        const verificationGasLimit = 500000n; // High for P256 signature verification
        // Estimate callGasLimit based on callData
        let callGasLimit = 100000n;
        if (userOp.callData && userOp.callData.length > 2) {
            // Rough estimate: base + data length
            callGasLimit = 100000n + BigInt(userOp.callData.length) * 16n;
        }
        // If initCode is present, add deployment gas
        if (userOp.initCode && userOp.initCode !== '0x') {
            callGasLimit += 500000n; // Account deployment
        }
        return {
            preVerificationGas: preVerificationGas.toString(),
            verificationGasLimit: verificationGasLimit.toString(),
            callGasLimit: callGasLimit.toString(),
        };
    }
    /**
     * eth_supportedEntryPoints - Return supported EntryPoints
     */
    getSupportedEntryPoints() {
        return [this.entryPointAddress];
    }
    /**
     * eth_chainId - Return chain ID
     */
    getChainId() {
        return `0x${this.chainId.toString(16)}`;
    }
    /**
     * Process pending UserOperations into a bundle
     */
    async processBundle() {
        if (!this.isRunning)
            return;
        // Clean up expired entries
        this.cleanupMempool();
        // Get pending operations
        const pendingOps = Array.from(this.mempool.entries())
            .filter(([_, entry]) => entry.status === 'pending')
            .slice(0, this.MAX_BUNDLE_SIZE);
        if (pendingOps.length === 0)
            return;
        console.log(`📦 Processing bundle with ${pendingOps.length} operations...`);
        try {
            // Prepare operations for handleOps
            const ops = pendingOps.map(([_, entry]) => entry.userOp);
            // Estimate gas for the bundle
            const gasEstimate = await this.entryPoint.handleOps.estimateGas(ops, this.bundlerWallet.address);
            // Get current gas price
            const feeData = await this.provider.getFeeData();
            const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice || ethers.parseUnits('1', 'gwei');
            const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('0.1', 'gwei');
            // Send the bundle transaction
            const tx = await this.entryPoint.handleOps(ops, this.bundlerWallet.address, {
                gasLimit: gasEstimate * 120n / 100n, // 20% buffer
                maxFeePerGas,
                maxPriorityFeePerGas,
            });
            console.log(`📤 Bundle submitted: ${tx.hash}`);
            // Update mempool entries
            for (const [hash, _] of pendingOps) {
                const entry = this.mempool.get(hash);
                if (entry) {
                    entry.status = 'submitted';
                    entry.txHash = tx.hash;
                }
            }
            // Wait for confirmation
            const receipt = await tx.wait();
            console.log(`✅ Bundle confirmed in block ${receipt?.blockNumber}`);
            // Update status to included
            for (const [hash, _] of pendingOps) {
                const entry = this.mempool.get(hash);
                if (entry) {
                    entry.status = 'included';
                }
            }
        }
        catch (error) {
            console.error('❌ Bundle failed:', error.message);
            // Mark operations as failed
            for (const [hash, _] of pendingOps) {
                const entry = this.mempool.get(hash);
                if (entry) {
                    entry.status = 'failed';
                    entry.error = error.message;
                }
            }
            // Try to parse revert reason
            if (error.data) {
                try {
                    const iface = new ethers.Interface(ENTRY_POINT_ABI);
                    const decoded = iface.parseError(error.data);
                    console.error('Revert reason:', decoded);
                }
                catch {
                    // Couldn't decode
                }
            }
        }
    }
    /**
     * Validate a UserOperation
     */
    async validateUserOperation(userOp) {
        // Check sender address
        if (!ethers.isAddress(userOp.sender)) {
            throw new Error('Invalid sender address');
        }
        // Check signature is present
        if (!userOp.signature || userOp.signature === '0x') {
            throw new Error('Missing signature');
        }
        // Check gas limits are reasonable
        if (userOp.callGasLimit < 21000n) {
            throw new Error('callGasLimit too low');
        }
        if (userOp.verificationGasLimit < 10000n) {
            throw new Error('verificationGasLimit too low');
        }
        // Check max fee is reasonable
        if (userOp.maxFeePerGas === 0n) {
            throw new Error('maxFeePerGas cannot be zero');
        }
        // If initCode is present, verify it starts with factory address
        if (userOp.initCode && userOp.initCode !== '0x' && userOp.initCode.length >= 42) {
            const factoryAddress = userOp.initCode.slice(0, 42);
            if (!ethers.isAddress(factoryAddress)) {
                throw new Error('Invalid factory address in initCode');
            }
        }
        // Verify sender has funds or paymaster is present
        if (!userOp.paymasterAndData || userOp.paymasterAndData === '0x') {
            // No paymaster, check sender balance in EntryPoint
            const senderBalance = await this.entryPoint.balanceOf(userOp.sender);
            const requiredPrefund = this.calculateRequiredPrefund(userOp);
            if (senderBalance < requiredPrefund) {
                // Check if initCode will deploy and fund
                if (!userOp.initCode || userOp.initCode === '0x') {
                    console.warn(`⚠️ Sender ${userOp.sender} has insufficient prefund`);
                    // Don't throw - let EntryPoint handle it
                }
            }
        }
        console.log('✅ UserOperation validated');
    }
    /**
     * Calculate required prefund for UserOperation
     */
    calculateRequiredPrefund(userOp) {
        const gasLimit = userOp.callGasLimit + userOp.verificationGasLimit + userOp.preVerificationGas;
        return gasLimit * userOp.maxFeePerGas;
    }
    /**
     * Calculate userOpHash
     */
    async getUserOpHash(userOp) {
        try {
            return await this.entryPoint.getUserOpHash(userOp);
        }
        catch {
            // Fallback: calculate locally
            return this.calculateUserOpHashLocally(userOp);
        }
    }
    /**
     * Calculate userOpHash locally (fallback)
     */
    calculateUserOpHashLocally(userOp) {
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
        const finalHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['bytes32', 'address', 'uint256'], [userOpHash, this.entryPointAddress, this.chainId]));
        return finalHash;
    }
    /**
     * Pack UserOperation for contract call
     */
    packUserOperation(userOp) {
        return {
            sender: userOp.sender,
            nonce: BigInt(userOp.nonce),
            initCode: userOp.initCode || '0x',
            callData: userOp.callData || '0x',
            callGasLimit: BigInt(userOp.callGasLimit),
            verificationGasLimit: BigInt(userOp.verificationGasLimit),
            preVerificationGas: BigInt(userOp.preVerificationGas),
            maxFeePerGas: BigInt(userOp.maxFeePerGas),
            maxPriorityFeePerGas: BigInt(userOp.maxPriorityFeePerGas),
            paymasterAndData: userOp.paymasterAndData || '0x',
            signature: userOp.signature,
        };
    }
    /**
     * Unpack UserOperation for API response
     */
    unpackUserOperation(userOp) {
        return {
            sender: userOp.sender,
            nonce: '0x' + userOp.nonce.toString(16),
            initCode: userOp.initCode,
            callData: userOp.callData,
            callGasLimit: '0x' + userOp.callGasLimit.toString(16),
            verificationGasLimit: '0x' + userOp.verificationGasLimit.toString(16),
            preVerificationGas: '0x' + userOp.preVerificationGas.toString(16),
            maxFeePerGas: '0x' + userOp.maxFeePerGas.toString(16),
            maxPriorityFeePerGas: '0x' + userOp.maxPriorityFeePerGas.toString(16),
            paymasterAndData: userOp.paymasterAndData,
            signature: userOp.signature,
        };
    }
    /**
     * Extract paymaster address from paymasterAndData
     */
    extractPaymaster(paymasterAndData) {
        if (!paymasterAndData || paymasterAndData === '0x' || paymasterAndData.length < 42) {
            return null;
        }
        return paymasterAndData.slice(0, 42);
    }
    /**
     * Clean up expired mempool entries
     */
    cleanupMempool() {
        const now = Date.now();
        for (const [hash, entry] of this.mempool.entries()) {
            if (now - entry.addedAt > this.MEMPOOL_EXPIRY) {
                this.mempool.delete(hash);
            }
        }
    }
    /**
     * Get bundler status
     */
    getStatus() {
        const pendingCount = Array.from(this.mempool.values())
            .filter(e => e.status === 'pending').length;
        return {
            isRunning: this.isRunning,
            address: this.bundlerWallet.address,
            entryPoint: this.entryPointAddress,
            chainId: this.chainId,
            mempoolSize: this.mempool.size,
            pendingCount,
        };
    }
    /**
     * Get bundler wallet balance
     */
    async getBalance() {
        const balance = await this.provider.getBalance(this.bundlerWallet.address);
        return ethers.formatEther(balance);
    }
}
// Singleton instance
let bundlerInstance = null;
export function getBundlerService() {
    if (!bundlerInstance) {
        bundlerInstance = new BundlerService();
    }
    return bundlerInstance;
}
export default BundlerService;
//# sourceMappingURL=bundlerService.js.map