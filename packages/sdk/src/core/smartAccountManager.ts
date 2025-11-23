/**
 * Smart Account Manager - Handles ERC-4337 Account Abstraction
 */

import { Contract, Interface, keccak256, AbiCoder, toBeHex, getBytes } from 'ethers';
import type { JsonRpcProvider, Wallet } from 'ethers';
import type {
    UserOperation,
    UserOperationRequest,
    UserOperationResult,
    BatchTransaction,
    SmartAccountConfig,
    PaymasterConfig,
    PaymasterData,
} from '../types/account-abstraction';
import { logger } from '../utils/logger';
import { DEFAULT_AA_CONFIG } from '../types/account-abstraction';

const abiCoder = new AbiCoder();

// Simple Smart Account ABI (execute function)
const SMART_ACCOUNT_ABI = [
    'function execute(address dest, uint256 value, bytes calldata func)',
    'function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func)',
    'function getNonce() view returns (uint256)',
];

export class SmartAccountManager {
    private config: SmartAccountConfig;
    private provider: JsonRpcProvider;
    private paymasterConfig?: PaymasterConfig;
    private accountAddress: string | null = null;

    constructor(
        provider: JsonRpcProvider,
        config?: Partial<SmartAccountConfig>,
        paymasterConfig?: PaymasterConfig
    ) {
        this.provider = provider;
        this.config = { ...DEFAULT_AA_CONFIG, ...config };
        this.paymasterConfig = paymasterConfig;
    }

    /**
     * Get counterfactual Smart Account address
     */
    getAccountAddress(owner: string): string {
        // Simple deterministic address calculation
        // In production, this should match the factory's getAddress() logic
        const salt = keccak256(getBytes(owner));
        const initCodeHash = keccak256(
            abiCoder.encode(
                ['address', 'address'],
                [this.config.accountImplementation, owner]
            )
        );

        // CREATE2 address calculation
        const hash = keccak256(
            abiCoder.encode(
                ['bytes1', 'address', 'bytes32', 'bytes32'],
                ['0xff', this.config.factoryAddress, salt, initCodeHash]
            )
        );

        return '0x' + hash.slice(-40);
    }

    /**
     * Check if Smart Account is deployed
     */
    async isDeployed(address: string): Promise<boolean> {
        const code = await this.provider.getCode(address);
        return code !== '0x';
    }

    /**
     * Build UserOperation for single transaction
     */
    async buildUserOperation(
        wallet: Wallet,
        request: UserOperationRequest
    ): Promise<UserOperation> {
        const accountAddress = this.accountAddress || this.getAccountAddress(wallet.address);
        this.accountAddress = accountAddress;

        // Check if account is deployed
        const isDeployed = await this.isDeployed(accountAddress);

        // Build callData (execute function)
        const accountInterface = new Interface(SMART_ACCOUNT_ABI);
        const callData = accountInterface.encodeFunctionData('execute', [
            request.to,
            BigInt(request.value || '0'),
            request.data || '0x',
        ]);

        // Get nonce
        let nonce = 0n;
        if (isDeployed) {
            const account = new Contract(accountAddress, SMART_ACCOUNT_ABI, this.provider);
            nonce = await account.getNonce();
        }

        // Build initCode (for deployment)
        const initCode = isDeployed
            ? '0x'
            : this.buildInitCode(wallet.address);

        // Get gas parameters
        const feeData = await this.provider.getFeeData();

        // Build UserOperation
        const userOp: UserOperation = {
            sender: accountAddress,
            nonce,
            initCode,
            callData,
            callGasLimit: 100000n, // Estimate
            verificationGasLimit: 200000n,
            preVerificationGas: 50000n,
            maxFeePerGas: feeData.maxFeePerGas || 0n,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || 0n,
            paymasterAndData: '0x',
            signature: '0x',
        };

        // Get paymaster sponsorship if requested
        if (request.sponsored && this.paymasterConfig?.enabled) {
            const paymasterData = await this.getPaymasterData(userOp);
            if (paymasterData) {
                userOp.paymasterAndData = paymasterData.paymasterAndData;
                if (paymasterData.callGasLimit) userOp.callGasLimit = paymasterData.callGasLimit;
                if (paymasterData.verificationGasLimit)
                    userOp.verificationGasLimit = paymasterData.verificationGasLimit;
                if (paymasterData.preVerificationGas)
                    userOp.preVerificationGas = paymasterData.preVerificationGas;
            }
        }

        // Sign UserOperation
        const signature = await this.signUserOperation(wallet, userOp);
        userOp.signature = signature;

        return userOp;
    }

    /**
     * Build UserOperation for batch transactions
     */
    async buildBatchUserOperation(
        wallet: Wallet,
        transactions: BatchTransaction[],
        sponsored = false
    ): Promise<UserOperation> {
        const accountAddress = this.accountAddress || this.getAccountAddress(wallet.address);
        this.accountAddress = accountAddress;

        const isDeployed = await this.isDeployed(accountAddress);

        // Build callData (executeBatch function)
        const accountInterface = new Interface(SMART_ACCOUNT_ABI);
        const destinations = transactions.map((tx) => tx.to);
        const values = transactions.map((tx) => BigInt(tx.value || '0'));
        const datas = transactions.map((tx) => tx.data || '0x');

        const callData = accountInterface.encodeFunctionData('executeBatch', [
            destinations,
            values,
            datas,
        ]);

        // Get nonce
        let nonce = 0n;
        if (isDeployed) {
            const account = new Contract(accountAddress, SMART_ACCOUNT_ABI, this.provider);
            nonce = await account.getNonce();
        }

        const initCode = isDeployed ? '0x' : this.buildInitCode(wallet.address);
        const feeData = await this.provider.getFeeData();

        const userOp: UserOperation = {
            sender: accountAddress,
            nonce,
            initCode,
            callData,
            callGasLimit: 150000n * BigInt(transactions.length), // Scale with batch size
            verificationGasLimit: 200000n,
            preVerificationGas: 50000n,
            maxFeePerGas: feeData.maxFeePerGas || 0n,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || 0n,
            paymasterAndData: '0x',
            signature: '0x',
        };

        // Get paymaster sponsorship if requested
        if (sponsored && this.paymasterConfig?.enabled) {
            const paymasterData = await this.getPaymasterData(userOp);
            if (paymasterData) {
                userOp.paymasterAndData = paymasterData.paymasterAndData;
            }
        }

        const signature = await this.signUserOperation(wallet, userOp);
        userOp.signature = signature;

        return userOp;
    }

    /**
     * Send UserOperation to bundler
     */
    async sendUserOperation(userOp: UserOperation): Promise<UserOperationResult> {
        try {
            logger.info('Sending UserOperation to bundler', { component: 'SmartAccount' });

            const response = await fetch(this.config.bundlerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'eth_sendUserOperation',
                    params: [this.serializeUserOp(userOp), this.config.entryPoint],
                }),
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error.message || 'Bundler error');
            }

            const userOpHash = data.result;
            logger.info('UserOperation sent', { component: 'SmartAccount', userOpHash });

            return {
                userOpHash,
                status: 'pending',
            };
        } catch (error: any) {
            console.error('[SmartAccount] Send UserOperation failed:', error);
            throw new Error(`Failed to send UserOperation: ${error.message}`);
        }
    }

    /**
     * Build initCode for account deployment
     */
    private buildInitCode(owner: string): string {
        // Factory address + createAccount calldata
        const factoryInterface = new Interface([
            'function createAccount(address owner, uint256 salt) returns (address)',
        ]);

        const salt = 0; // Use 0 for deterministic address
        const createAccountData = factoryInterface.encodeFunctionData('createAccount', [
            owner,
            salt,
        ]);

        return this.config.factoryAddress + createAccountData.slice(2);
    }

    /**
     * Sign UserOperation
     */
    private async signUserOperation(
        wallet: Wallet,
        userOp: UserOperation
    ): Promise<string> {
        const userOpHash = this.getUserOpHash(userOp);
        const signature = await wallet.signMessage(getBytes(userOpHash));
        return signature;
    }

    /**
     * Get UserOperation hash
     */
    private getUserOpHash(userOp: UserOperation): string {
        const packed = this.packUserOp(userOp);
        const userOpPackHash = keccak256(packed);

        const chainId = this.provider._network?.chainId || 1n;

        return keccak256(
            abiCoder.encode(
                ['bytes32', 'address', 'uint256'],
                [userOpPackHash, this.config.entryPoint, chainId]
            )
        );
    }

    /**
     * Pack UserOperation for hashing
     */
    private packUserOp(op: UserOperation): string {
        return abiCoder.encode(
            [
                'address',
                'uint256',
                'bytes32',
                'bytes32',
                'uint256',
                'uint256',
                'uint256',
                'uint256',
                'uint256',
                'bytes32',
            ],
            [
                op.sender,
                op.nonce,
                keccak256(op.initCode === '0x' ? new Uint8Array() : getBytes(op.initCode)),
                keccak256(op.callData === '0x' ? new Uint8Array() : getBytes(op.callData)),
                op.callGasLimit,
                op.verificationGasLimit,
                op.preVerificationGas,
                op.maxFeePerGas,
                op.maxPriorityFeePerGas,
                keccak256(
                    op.paymasterAndData === '0x' ? new Uint8Array() : getBytes(op.paymasterAndData)
                ),
            ]
        );
    }

    /**
     * Serialize UserOperation for JSON-RPC
     */
    private serializeUserOp(op: UserOperation) {
        return {
            sender: op.sender,
            nonce: toBeHex(op.nonce),
            initCode: op.initCode,
            callData: op.callData,
            callGasLimit: toBeHex(op.callGasLimit),
            verificationGasLimit: toBeHex(op.verificationGasLimit),
            preVerificationGas: toBeHex(op.preVerificationGas),
            maxFeePerGas: toBeHex(op.maxFeePerGas),
            maxPriorityFeePerGas: toBeHex(op.maxPriorityFeePerGas),
            paymasterAndData: op.paymasterAndData,
            signature: op.signature,
        };
    }

    /**
     * Get paymaster sponsorship data
     */
    private async getPaymasterData(userOp: UserOperation): Promise<PaymasterData | null> {
        if (!this.paymasterConfig?.url) {
            return null;
        }

        try {
            const response = await fetch(`${this.paymasterConfig.url}/sponsor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userOperation: this.serializeUserOp(userOp),
                    entryPoint: this.config.entryPoint,
                }),
            });

            const data = await response.json();

            if (!data.success) {
                console.warn('[Paymaster] Sponsorship denied:', data.error);
                return null;
            }

            return {
                paymasterAndData: data.paymasterAndData,
                callGasLimit: data.callGasLimit ? BigInt(data.callGasLimit) : undefined,
                verificationGasLimit: data.verificationGasLimit
                    ? BigInt(data.verificationGasLimit)
                    : undefined,
                preVerificationGas: data.preVerificationGas
                    ? BigInt(data.preVerificationGas)
                    : undefined,
            };
        } catch (error) {
            console.error('[Paymaster] Failed to get sponsorship:', error);
            return null;
        }
    }
}
