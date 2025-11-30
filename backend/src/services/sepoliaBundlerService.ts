/**
 * Sepolia ERC-4337 Bundler Service
 *
 * A lightweight bundler implementation for Sepolia testnet.
 * Handles UserOperation validation, bundling, and submission to EntryPoint.
 *
 * This is a separate instance from Arc bundler to handle Sepolia chain
 * with its own RPC, wallet, and configuration.
 */

import { ethers } from 'ethers';

// ERC-4337 UserOperation structure
export interface UserOperation {
    sender: string;
    nonce: string | bigint;
    initCode: string;
    callData: string;
    callGasLimit: string | bigint;
    verificationGasLimit: string | bigint;
    preVerificationGas: string | bigint;
    maxFeePerGas: string | bigint;
    maxPriorityFeePerGas: string | bigint;
    paymasterAndData: string;
    signature: string;
}

// Packed UserOperation for EntryPoint v0.6
interface PackedUserOperation {
    sender: string;
    nonce: bigint;
    initCode: string;
    callData: string;
    callGasLimit: bigint;
    verificationGasLimit: bigint;
    preVerificationGas: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    paymasterAndData: string;
    signature: string;
}

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

// Mempool for pending UserOperations
interface MempoolEntry {
    userOp: PackedUserOperation;
    userOpHash: string;
    addedAt: number;
    status: 'pending' | 'submitted' | 'included' | 'failed';
    txHash?: string;
    error?: string;
}

export class SepoliaBundlerService {
    private provider: ethers.JsonRpcProvider;
    private bundlerWallet: ethers.Wallet;
    private entryPoint: ethers.Contract;
    private entryPointAddress: string;
    private chainId: number;
    private mempool: Map<string, MempoolEntry> = new Map();
    private isRunning: boolean = false;
    private bundleInterval: NodeJS.Timeout | null = null;

    // Configuration
    private readonly BUNDLE_INTERVAL = 5000; // Bundle every 5 seconds
    private readonly MAX_BUNDLE_SIZE = 10; // Max ops per bundle
    private readonly MEMPOOL_EXPIRY = 300000; // 5 minutes

    constructor() {
        // Sepolia RPC URL - use public RPC or configured one
        const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

        // Same bundler private key can be used (different wallets on different chains)
        const bundlerPrivateKey = process.env.BUNDLER_PRIVATE_KEY;

        // v0.6 EntryPoint (same address on all chains)
        this.entryPointAddress = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

        if (!bundlerPrivateKey) {
            throw new Error('BUNDLER_PRIVATE_KEY not configured');
        }

        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.bundlerWallet = new ethers.Wallet(bundlerPrivateKey, this.provider);
        this.entryPoint = new ethers.Contract(this.entryPointAddress, ENTRY_POINT_ABI, this.bundlerWallet);
        this.chainId = 11155111; // Sepolia

        console.log(`🔗 Sepolia Bundler initialized:`);
        console.log(`   Address: ${this.bundlerWallet.address}`);
        console.log(`   EntryPoint: ${this.entryPointAddress}`);
        console.log(`   Chain: Sepolia (${this.chainId})`);
    }

    /**
     * Start the bundler service
     */
    async start(): Promise<void> {
        if (this.isRunning) return;

        // Verify bundler has funds
        const balance = await this.provider.getBalance(this.bundlerWallet.address);
        console.log(`💰 Sepolia Bundler balance: ${ethers.formatEther(balance)} ETH`);

        if (balance === 0n) {
            console.warn('⚠️ Sepolia Bundler wallet has no funds! Please fund it for gas.');
        }

        this.isRunning = true;
        this.bundleInterval = setInterval(() => this.processBundle(), this.BUNDLE_INTERVAL);
        console.log('🚀 Sepolia Bundler service started');
    }

    /**
     * Stop the bundler service
     */
    stop(): void {
        this.isRunning = false;
        if (this.bundleInterval) {
            clearInterval(this.bundleInterval);
            this.bundleInterval = null;
        }
        console.log('🛑 Sepolia Bundler service stopped');
    }

    /**
     * eth_sendUserOperation - Submit a UserOperation to the mempool
     */
    async sendUserOperation(userOp: UserOperation, entryPointAddr: string): Promise<string> {
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

        console.log(`📥 [Sepolia] UserOp added to mempool: ${userOpHash.slice(0, 18)}...`);
        console.log(`   Sender: ${packedOp.sender}`);
        console.log(`   Nonce: ${packedOp.nonce}`);

        return userOpHash;
    }

    /**
     * eth_getUserOperationByHash - Get UserOperation status
     */
    async getUserOperationByHash(userOpHash: string): Promise<any> {
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
    async getUserOperationReceipt(userOpHash: string): Promise<any> {
        const entry = this.mempool.get(userOpHash);
        if (!entry || !entry.txHash) {
            return null;
        }

        try {
            const receipt = await this.provider.getTransactionReceipt(entry.txHash);
            if (!receipt) return null;

            // Parse UserOperationEvent from logs
            const iface = new ethers.Interface(ENTRY_POINT_ABI);
            let success = false;
            let actualGasCost = 0n;
            let actualGasUsed = 0n;

            for (const log of receipt.logs) {
                try {
                    const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
                    if (parsed?.name === 'UserOperationEvent' && parsed.args.userOpHash === userOpHash) {
                        success = parsed.args.success;
                        actualGasCost = parsed.args.actualGasCost;
                        actualGasUsed = parsed.args.actualGasUsed;
                        break;
                    }
                } catch {
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
        } catch (error) {
            console.error('[Sepolia] Error getting receipt:', error);
            return null;
        }
    }

    /**
     * eth_estimateUserOperationGas - Estimate gas for UserOperation
     */
    async estimateUserOperationGas(userOp: Partial<UserOperation>, entryPointAddr: string): Promise<{
        preVerificationGas: string;
        verificationGasLimit: string;
        callGasLimit: string;
    }> {
        // Default gas estimates for Sepolia
        const preVerificationGas = 100000n;

        // verificationGasLimit needs to be high for P256 signature verification
        const hasInitCode = userOp.initCode && userOp.initCode !== '0x';
        const verificationGasLimit = hasInitCode ? 3000000n : 500000n;

        // Estimate callGasLimit
        let callGasLimit = 500000n;

        if (hasInitCode) {
            callGasLimit = 1000000n;
        }

        if (userOp.callData && userOp.callData.length > 2) {
            callGasLimit += BigInt(userOp.callData.length) * 16n;
        }

        console.log(`📊 [Sepolia] Gas estimation: preVerification=${preVerificationGas}, verification=${verificationGasLimit}, call=${callGasLimit}, hasInitCode=${hasInitCode}`);

        return {
            preVerificationGas: preVerificationGas.toString(),
            verificationGasLimit: verificationGasLimit.toString(),
            callGasLimit: callGasLimit.toString(),
        };
    }

    /**
     * eth_supportedEntryPoints - Return supported EntryPoints
     */
    getSupportedEntryPoints(): string[] {
        return [this.entryPointAddress];
    }

    /**
     * eth_chainId - Return chain ID
     */
    getChainId(): string {
        return `0x${this.chainId.toString(16)}`;
    }

    /**
     * Process pending UserOperations into a bundle
     */
    private async processBundle(): Promise<void> {
        if (!this.isRunning) return;

        // Clean up expired entries
        this.cleanupMempool();

        // Get pending operations
        const pendingOps = Array.from(this.mempool.entries())
            .filter(([_, entry]) => entry.status === 'pending')
            .slice(0, this.MAX_BUNDLE_SIZE);

        if (pendingOps.length === 0) return;

        console.log(`📦 [Sepolia] Processing bundle with ${pendingOps.length} operations...`);

        try {
            // Prepare operations for handleOps
            const ops = pendingOps.map(([_, entry]) => entry.userOp);

            // Check and ensure sufficient deposits for all senders
            for (const op of ops) {
                await this.ensureSufficientDeposit(op.sender, op);
            }

            // Estimate gas for the bundle
            const gasEstimate = await this.entryPoint.handleOps.estimateGas(
                ops,
                this.bundlerWallet.address
            );

            // Get current gas price
            const feeData = await this.provider.getFeeData();
            const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice || ethers.parseUnits('20', 'gwei');
            const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei');

            // Send the bundle transaction
            const tx = await this.entryPoint.handleOps(
                ops,
                this.bundlerWallet.address,
                {
                    gasLimit: gasEstimate * 120n / 100n, // 20% buffer
                    maxFeePerGas,
                    maxPriorityFeePerGas,
                }
            );

            console.log(`📤 [Sepolia] Bundle submitted: ${tx.hash}`);

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
            console.log(`✅ [Sepolia] Bundle confirmed in block ${receipt?.blockNumber}`);

            // Update status to included
            for (const [hash, _] of pendingOps) {
                const entry = this.mempool.get(hash);
                if (entry) {
                    entry.status = 'included';
                }
            }

        } catch (error: any) {
            console.error('❌ [Sepolia] Bundle failed:', error.message);

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
                    const errorData = error.data as string;
                    if (errorData.startsWith('0x220266b6')) {
                        // FailedOp(uint256 opIndex, string reason)
                        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
                            ['uint256', 'string'],
                            '0x' + errorData.slice(10)
                        );
                        console.error('[Sepolia] Revert reason:', `FailedOp at index ${decoded[0]}: ${decoded[1]}`);
                    }
                } catch (decodeErr) {
                    console.error('[Sepolia] Could not decode revert reason:', error.data);
                }
            }
        }
    }

    /**
     * Validate a UserOperation
     */
    private async validateUserOperation(userOp: PackedUserOperation): Promise<void> {
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

        console.log('✅ [Sepolia] UserOperation validated');
    }

    /**
     * Calculate required prefund for UserOperation
     */
    private calculateRequiredPrefund(userOp: PackedUserOperation): bigint {
        const gasLimit = userOp.callGasLimit + userOp.verificationGasLimit + userOp.preVerificationGas;
        return gasLimit * userOp.maxFeePerGas;
    }

    /**
     * Calculate userOpHash
     */
    private async getUserOpHash(userOp: PackedUserOperation): Promise<string> {
        try {
            return await this.entryPoint.getUserOpHash(userOp);
        } catch {
            // Fallback: calculate locally
            return this.calculateUserOpHashLocally(userOp);
        }
    }

    /**
     * Calculate userOpHash locally (fallback)
     */
    private calculateUserOpHashLocally(userOp: PackedUserOperation): string {
        const packed = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256', 'bytes32', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes32'],
            [
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
            ]
        );

        const userOpHash = ethers.keccak256(packed);

        const finalHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ['bytes32', 'address', 'uint256'],
                [userOpHash, this.entryPointAddress, this.chainId]
            )
        );

        return finalHash;
    }

    /**
     * Pack UserOperation for contract call
     */
    private packUserOperation(userOp: UserOperation): PackedUserOperation {
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
    private unpackUserOperation(userOp: PackedUserOperation): UserOperation {
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
    private extractPaymaster(paymasterAndData: string): string | null {
        if (!paymasterAndData || paymasterAndData === '0x' || paymasterAndData.length < 42) {
            return null;
        }
        return paymasterAndData.slice(0, 42);
    }

    /**
     * Clean up expired mempool entries
     */
    private cleanupMempool(): void {
        const now = Date.now();
        for (const [hash, entry] of this.mempool.entries()) {
            if (now - entry.addedAt > this.MEMPOOL_EXPIRY) {
                this.mempool.delete(hash);
            }
        }
    }

    /**
     * Ensure sufficient deposit in EntryPoint for a sender
     */
    private async ensureSufficientDeposit(sender: string, userOp: PackedUserOperation): Promise<void> {
        // Skip if paymaster is being used
        if (userOp.paymasterAndData && userOp.paymasterAndData !== '0x') {
            return;
        }

        // Calculate required prefund
        const requiredPrefund = this.calculateRequiredPrefund(userOp);

        // Check current deposit
        const currentDeposit = await this.entryPoint.balanceOf(sender);

        console.log(`💰 [Sepolia] Deposit check for ${sender.slice(0, 10)}...:`);
        console.log(`   Current deposit: ${ethers.formatEther(currentDeposit)} ETH`);
        console.log(`   Required prefund: ${ethers.formatEther(requiredPrefund)} ETH`);

        if (currentDeposit >= requiredPrefund) {
            console.log(`   ✅ Sufficient deposit`);
            return;
        }

        // Calculate how much to deposit (with 50% buffer)
        const depositAmount = (requiredPrefund - currentDeposit) * 150n / 100n;

        console.log(`   ⚠️ Insufficient deposit, sponsoring ${ethers.formatEther(depositAmount)} ETH...`);

        // Check bundler has enough ETH
        const bundlerBalance = await this.provider.getBalance(this.bundlerWallet.address);
        if (bundlerBalance < depositAmount) {
            throw new Error(`Sepolia Bundler has insufficient ETH to sponsor. Needed: ${ethers.formatEther(depositAmount)}, Has: ${ethers.formatEther(bundlerBalance)}`);
        }

        // Deposit to EntryPoint for the sender
        try {
            const tx = await this.entryPoint.depositTo(sender, {
                value: depositAmount,
            });
            console.log(`   📤 [Sepolia] Deposit tx submitted: ${tx.hash}`);

            const receipt = await tx.wait();
            console.log(`   ✅ [Sepolia] Deposit confirmed in block ${receipt?.blockNumber}`);
        } catch (error: any) {
            console.error(`   ❌ [Sepolia] Deposit failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get bundler status
     */
    getStatus(): {
        isRunning: boolean;
        address: string;
        entryPoint: string;
        chainId: number;
        mempoolSize: number;
        pendingCount: number;
    } {
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
    async getBalance(): Promise<string> {
        const balance = await this.provider.getBalance(this.bundlerWallet.address);
        return ethers.formatEther(balance);
    }
}

// Singleton instance
let sepoliaBundlerInstance: SepoliaBundlerService | null = null;

export function getSepoliaBundlerService(): SepoliaBundlerService {
    if (!sepoliaBundlerInstance) {
        sepoliaBundlerInstance = new SepoliaBundlerService();
    }
    return sepoliaBundlerInstance;
}

export default SepoliaBundlerService;
