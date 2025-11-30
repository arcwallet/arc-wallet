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

// ERC20 ABI for balance checks
const ERC20_ABI = [
    'function balanceOf(address account) external view returns (uint256)',
    'function transfer(address to, uint256 amount) external returns (bool)',
];

// Arc USDC contract address
const ARC_USDC_ADDRESS = '0x3600000000000000000000000000000000000000';

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

export class BundlerService {
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
    private readonly MIN_STAKE = 0; // No staking required for testnet

    constructor() {
        const rpcUrl = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
        const bundlerPrivateKey = process.env.BUNDLER_PRIVATE_KEY;
        this.entryPointAddress = process.env.ENTRYPOINT_ADDRESS || '0x0000000071727De22E5E9d8BAf0edAc6f37da032'; // v0.7 EntryPoint

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
    async start(): Promise<void> {
        if (this.isRunning) return;

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
    stop(): void {
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

        console.log(`📥 UserOp added to mempool: ${userOpHash.slice(0, 18)}...`);
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
            console.error('Error getting receipt:', error);
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
        // Default gas estimates for Arc Testnet
        // These are conservative estimates that should work for most operations
        const preVerificationGas = 100000n; // Increased for complex operations

        // verificationGasLimit needs to be VERY high for:
        // 1. P256 signature verification (expensive on-chain)
        // 2. Account deployment via initCode (needs ~1.4M gas)
        // EntryPoint reserves ~10% for other operations, so we need ~1.4M/0.9 ≈ 1.6M minimum
        const hasInitCode = userOp.initCode && userOp.initCode !== '0x';
        const verificationGasLimit = hasInitCode ? 3000000n : 500000n; // Increased to 3M for deployment

        // Estimate callGasLimit based on callData
        // For deployment + transfer operations, we need MUCH more gas
        // AA23 error often means callGasLimit is too low
        let callGasLimit = 500000n; // Base for account abstraction

        if (hasInitCode) {
            // First transaction includes deployment, needs more callGas
            // The actual transfer happens AFTER deployment within the same UserOp
            callGasLimit = 1000000n; // 1M for deployment + transfer
        }

        if (userOp.callData && userOp.callData.length > 2) {
            // Add extra gas based on data length
            callGasLimit += BigInt(userOp.callData.length) * 16n;
        }

        console.log(`📊 Gas estimation: preVerification=${preVerificationGas}, verification=${verificationGasLimit}, call=${callGasLimit}, hasInitCode=${hasInitCode}`);

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

        console.log(`📦 Processing bundle with ${pendingOps.length} operations...`);

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
            const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice || ethers.parseUnits('1', 'gwei');
            const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('0.1', 'gwei');

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

        } catch (error: any) {
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
                    // Try to decode AA error codes from the revert data
                    const errorData = error.data as string;
                    if (errorData.startsWith('0x220266b6')) {
                        // FailedOp(uint256 opIndex, string reason)
                        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
                            ['uint256', 'string'],
                            '0x' + errorData.slice(10)
                        );
                        console.error('Revert reason:', `FailedOp at index ${decoded[0]}: ${decoded[1]}`);
                    } else {
                        const iface = new ethers.Interface(ENTRY_POINT_ABI);
                        const decoded = iface.parseError(errorData);
                        console.error('Revert reason:', decoded);
                    }
                } catch (decodeErr) {
                    console.error('Could not decode revert reason:', error.data);
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

        // Detailed signature analysis for debugging AA23 errors
        this.analyzeSignature(userOp.signature);

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

        // Check if this is a token transfer and validate balance
        await this.validateTokenTransfer(userOp);

        console.log('✅ UserOperation validated');
    }

    /**
     * Validate token transfer has sufficient balance
     * Parses callData to detect ERC20 transfers and checks sender balance
     *
     * NOTE: For undeployed wallets (with initCode), we skip validation because:
     * 1. The wallet address is a counterfactual address (not yet deployed)
     * 2. Funds may be pre-deposited to the counterfactual address
     * 3. The EntryPoint will handle the actual validation during execution
     */
    private async validateTokenTransfer(userOp: PackedUserOperation): Promise<void> {
        try {
            // Skip validation for undeployed wallets (first transaction with deployment)
            // The wallet will be deployed first, then the transfer will execute
            const hasInitCode = userOp.initCode && userOp.initCode !== '0x' && userOp.initCode.length > 2;
            if (hasInitCode) {
                console.log('⏭️ Skipping token balance validation for undeployed wallet (initCode present)');
                return;
            }

            const callData = userOp.callData;
            if (!callData || callData === '0x' || callData.length < 10) {
                return;
            }

            // Smart wallet execute function selector: 0xb61d27f6 (execute(address,uint256,bytes))
            const executeSelector = '0xb61d27f6';
            if (!callData.toLowerCase().startsWith(executeSelector)) {
                return;
            }

            // Decode execute(address target, uint256 value, bytes data)
            const executeData = '0x' + callData.slice(10);
            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
                ['address', 'uint256', 'bytes'],
                executeData
            );

            const target = decoded[0] as string;
            const innerCallData = decoded[2] as string;

            // Check if target is USDC
            if (target.toLowerCase() !== ARC_USDC_ADDRESS.toLowerCase()) {
                return;
            }

            // Check if inner call is transfer(address,uint256) - selector 0xa9059cbb
            const transferSelector = '0xa9059cbb';
            if (!innerCallData.toLowerCase().startsWith(transferSelector)) {
                return;
            }

            // Decode transfer(address to, uint256 amount)
            const transferData = '0x' + innerCallData.slice(10);
            const transferDecoded = ethers.AbiCoder.defaultAbiCoder().decode(
                ['address', 'uint256'],
                transferData
            );

            const transferAmount = transferDecoded[1] as bigint;

            // Check sender's USDC balance
            const usdc = new ethers.Contract(ARC_USDC_ADDRESS, ERC20_ABI, this.provider);
            const senderBalance = await usdc.balanceOf(userOp.sender);

            if (senderBalance < transferAmount) {
                const formattedBalance = Number(senderBalance) / 1e6;
                const formattedAmount = Number(transferAmount) / 1e6;
                throw new Error(
                    `Insufficient USDC balance: wallet has ${formattedBalance.toFixed(2)} USDC but trying to send ${formattedAmount.toFixed(2)} USDC`
                );
            }

            console.log(`✅ Token transfer validated: ${Number(transferAmount) / 1e6} USDC (balance: ${Number(senderBalance) / 1e6} USDC)`);
        } catch (error: any) {
            if (error.message?.includes('Insufficient USDC')) {
                throw error;
            }
            // Log but don't throw for other decode errors - let EntryPoint handle
            console.warn('⚠️ Could not validate token transfer:', error.message);
        }
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
     * Analyze WebAuthn/Passkey signature for debugging
     * Expected format: abi.encode(bytes authenticatorData, string clientDataJSON, uint256 challengeIndex, uint256 typeIndex, uint256 r, uint256 s)
     */
    private analyzeSignature(signature: string): void {
        console.log('\n🔍 ═══════════════════════════════════════════════════════');
        console.log('   SIGNATURE ANALYSIS');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`📏 Signature length: ${(signature.length - 2) / 2} bytes`);
        console.log(`📝 First 66 chars: ${signature.slice(0, 66)}`);

        try {
            // Remove 0x prefix
            const sigData = signature.slice(2);

            // ABI encoding of dynamic types starts with offsets
            // bytes authenticatorData -> offset at position 0 (32 bytes)
            // string clientDataJSON -> offset at position 1 (32 bytes)
            // uint256 challengeIndex -> value at position 2
            // uint256 typeIndex -> value at position 3
            // uint256 r -> value at position 4
            // uint256 s -> value at position 5

            if (sigData.length < 384) { // Minimum 6 * 32 bytes = 192 bytes = 384 hex chars
                console.log('❌ Signature too short for WebAuthn format');
                return;
            }

            // Read the first 6 slots (32 bytes each)
            const slot0 = sigData.slice(0, 64);      // authenticatorData offset
            const slot1 = sigData.slice(64, 128);    // clientDataJSON offset
            const slot2 = sigData.slice(128, 192);   // challengeIndex
            const slot3 = sigData.slice(192, 256);   // typeIndex
            const slot4 = sigData.slice(256, 320);   // r
            const slot5 = sigData.slice(320, 384);   // s

            const offset0 = BigInt('0x' + slot0);
            const offset1 = BigInt('0x' + slot1);
            const challengeIndex = BigInt('0x' + slot2);
            const typeIndex = BigInt('0x' + slot3);
            const r = BigInt('0x' + slot4);
            const s = BigInt('0x' + slot5);

            console.log('\n📊 Slot values:');
            console.log(`   Slot 0 (authData offset): 0x${slot0} = ${offset0}`);
            console.log(`   Slot 1 (clientData offset): 0x${slot1} = ${offset1}`);
            console.log(`   Slot 2 (challengeIndex): ${challengeIndex}`);
            console.log(`   Slot 3 (typeIndex): ${typeIndex}`);
            console.log(`   Slot 4 (r): 0x${slot4.slice(0, 16)}...`);
            console.log(`   Slot 5 (s): 0x${slot5.slice(0, 16)}...`);

            // Check if offsets make sense (should be >= 192 = 0xc0 for 6 slots)
            if (offset0 < 192n) {
                console.log(`\n⚠️ WARNING: authenticatorData offset (${offset0}) is less than expected (192)`);
                console.log('   This suggests the signature might have wrong byte order or extra padding');
            }

            if (offset1 < 192n) {
                console.log(`\n⚠️ WARNING: clientDataJSON offset (${offset1}) is less than expected`);
            }

            // Try to extract authenticatorData
            if (offset0 >= 192n && offset0 < BigInt(sigData.length / 2)) {
                const authDataStart = Number(offset0) * 2;
                const authDataLenHex = sigData.slice(authDataStart, authDataStart + 64);
                const authDataLen = Number(BigInt('0x' + authDataLenHex));
                console.log(`\n📦 authenticatorData:`);
                console.log(`   Length: ${authDataLen} bytes`);
                if (authDataLen > 0 && authDataLen < 1000) {
                    const authDataHex = sigData.slice(authDataStart + 64, authDataStart + 64 + authDataLen * 2);
                    console.log(`   Data: 0x${authDataHex.slice(0, 40)}...`);
                }
            }

            // Try to extract clientDataJSON
            if (offset1 >= 192n && offset1 < BigInt(sigData.length / 2)) {
                const clientDataStart = Number(offset1) * 2;
                const clientDataLenHex = sigData.slice(clientDataStart, clientDataStart + 64);
                const clientDataLen = Number(BigInt('0x' + clientDataLenHex));
                console.log(`\n📦 clientDataJSON:`);
                console.log(`   Length: ${clientDataLen} bytes`);
                if (clientDataLen > 0 && clientDataLen < 2000) {
                    const clientDataHex = sigData.slice(clientDataStart + 64, clientDataStart + 64 + clientDataLen * 2);
                    try {
                        const clientDataStr = Buffer.from(clientDataHex, 'hex').toString('utf8');
                        console.log(`   Content: ${clientDataStr.slice(0, 100)}...`);

                        // Parse JSON to check challenge
                        const clientData = JSON.parse(clientDataStr);
                        if (clientData.challenge) {
                            console.log(`   Challenge (base64url): ${clientData.challenge}`);
                        }
                    } catch (e) {
                        console.log(`   Raw hex: 0x${clientDataHex.slice(0, 40)}...`);
                    }
                }
            }

            // Validate r and s are in valid P256 range
            const P256_ORDER = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
            if (r >= P256_ORDER || r === 0n) {
                console.log(`\n❌ ERROR: r value is invalid for P256 curve!`);
            }
            if (s >= P256_ORDER || s === 0n) {
                console.log(`\n❌ ERROR: s value is invalid for P256 curve!`);
            }

            console.log('\n═══════════════════════════════════════════════════════════\n');

        } catch (error: any) {
            console.log(`❌ Signature analysis error: ${error.message}`);
        }
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
     * Ensure sufficient deposit in EntryPoint for a sender
     * If deposit is insufficient, bundler will sponsor by depositing ETH
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

        console.log(`💰 Deposit check for ${sender.slice(0, 10)}...:`);
        console.log(`   Current deposit: ${ethers.formatEther(currentDeposit)} ETH`);
        console.log(`   Required prefund: ${ethers.formatEther(requiredPrefund)} ETH`);

        if (currentDeposit >= requiredPrefund) {
            console.log(`   ✅ Sufficient deposit`);
            return;
        }

        // Calculate how much to deposit (with 50% buffer for gas price fluctuations)
        const depositAmount = (requiredPrefund - currentDeposit) * 150n / 100n;

        console.log(`   ⚠️ Insufficient deposit, sponsoring ${ethers.formatEther(depositAmount)} ETH...`);

        // Check bundler has enough ETH
        const bundlerBalance = await this.provider.getBalance(this.bundlerWallet.address);
        if (bundlerBalance < depositAmount) {
            throw new Error(`Bundler has insufficient ETH to sponsor. Needed: ${ethers.formatEther(depositAmount)}, Has: ${ethers.formatEther(bundlerBalance)}`);
        }

        // Deposit to EntryPoint for the sender
        try {
            const tx = await this.entryPoint.depositTo(sender, {
                value: depositAmount,
            });
            console.log(`   📤 Deposit tx submitted: ${tx.hash}`);

            const receipt = await tx.wait();
            console.log(`   ✅ Deposit confirmed in block ${receipt?.blockNumber}`);
        } catch (error: any) {
            console.error(`   ❌ Deposit failed: ${error.message}`);
            throw error;
        }
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
let bundlerInstance: BundlerService | null = null;

export function getBundlerService(): BundlerService {
    if (!bundlerInstance) {
        bundlerInstance = new BundlerService();
    }
    return bundlerInstance;
}

export default BundlerService;
