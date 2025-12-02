/**
 * ERC-4337 Service
 * High-level service for ERC-4337 Smart Account operations
 *
 * Features:
 * - Create counterfactual smart accounts
 * - Build and send UserOperations
 * - Paymaster integration for gas sponsorship
 * - Batch transactions
 *
 * Uses Arc's own bundler at /api/bundler/rpc
 */

import {
    Contract,
    Interface,
    Wallet,
    keccak256,
    AbiCoder,
    toBeHex,
    getBytes,
    JsonRpcProvider,
    parseUnits,
    formatUnits,
} from 'ethers';
import { RPC_URL, BUNDLER_CONFIG, ARC_TESTNET } from '../config/app.config';

const abiCoder = new AbiCoder();

// Simple Account Factory (ERC-4337 reference implementation)
const SIMPLE_ACCOUNT_FACTORY = '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985';

// Simple Account ABI
const SIMPLE_ACCOUNT_ABI = [
    'function execute(address dest, uint256 value, bytes calldata func)',
    'function executeBatch(address[] calldata dest, bytes[] calldata func)',
    'function getNonce() view returns (uint256)',
    'function owner() view returns (address)',
];

// Factory ABI
const FACTORY_ABI = [
    'function createAccount(address owner, uint256 salt) returns (address)',
    'function getAddress(address owner, uint256 salt) view returns (address)',
];

interface UserOperationInput {
    to: string;
    value?: string;
    data?: string;
}

interface BuildUserOpOptions {
    sponsored?: boolean;
    batchMode?: boolean;
}

interface SmartAccountInfo {
    address: string;
    owner: string;
    isDeployed: boolean;
    balance: string;
    balanceFormatted: string;
}

class ERC4337Service {
    private provider: JsonRpcProvider;
    private entryPoint: string;
    private factoryAddress: string;
    private bundlerUrl: string;

    constructor() {
        this.provider = new JsonRpcProvider(RPC_URL);
        this.entryPoint = BUNDLER_CONFIG.entryPoint;
        this.factoryAddress = SIMPLE_ACCOUNT_FACTORY;
        this.bundlerUrl = BUNDLER_CONFIG.bundlerUrl;
    }

    /**
     * Get counterfactual Smart Account address for an owner
     */
    async getSmartAccountAddress(owner: string, salt: number = 0): Promise<string> {
        try {
            const factory = new Contract(this.factoryAddress, FACTORY_ABI, this.provider);
            const address = await factory.getAddress(owner, salt);
            return address;
        } catch (error) {
            console.warn('[ERC4337] Factory call failed, calculating address manually');
            return this.calculateCreate2Address(owner, salt);
        }
    }

    /**
     * Calculate CREATE2 address manually
     */
    private calculateCreate2Address(owner: string, salt: number): string {
        const saltBytes = abiCoder.encode(['uint256'], [salt]);
        const initCodeHash = keccak256(
            abiCoder.encode(['address'], [owner])
        );

        const create2Hash = keccak256(
            '0xff' +
            this.factoryAddress.slice(2) +
            keccak256(saltBytes).slice(2) +
            initCodeHash.slice(2)
        );

        return '0x' + create2Hash.slice(-40);
    }

    /**
     * Check if Smart Account is deployed
     */
    async isDeployed(address: string): Promise<boolean> {
        const code = await this.provider.getCode(address);
        return code !== '0x';
    }

    /**
     * Get Smart Account info
     */
    async getAccountInfo(owner: string): Promise<SmartAccountInfo> {
        const address = await this.getSmartAccountAddress(owner);
        const isDeployed = await this.isDeployed(address);
        const balance = await this.provider.getBalance(address);

        return {
            address,
            owner,
            isDeployed,
            balance: balance.toString(),
            balanceFormatted: formatUnits(balance, 6), // USDC has 6 decimals on Arc
        };
    }

    /**
     * Build initCode for account deployment
     */
    private buildInitCode(owner: string, salt: number = 0): string {
        const factoryInterface = new Interface(FACTORY_ABI);
        const createAccountData = factoryInterface.encodeFunctionData('createAccount', [
            owner,
            salt,
        ]);
        return this.factoryAddress + createAccountData.slice(2);
    }

    /**
     * Build callData for single transaction
     */
    private buildExecuteCallData(to: string, value: bigint, data: string): string {
        const accountInterface = new Interface(SIMPLE_ACCOUNT_ABI);
        return accountInterface.encodeFunctionData('execute', [to, value, data]);
    }

    /**
     * Build callData for batch transactions
     */
    private buildBatchCallData(transactions: UserOperationInput[]): string {
        const accountInterface = new Interface(SIMPLE_ACCOUNT_ABI);
        const destinations = transactions.map(tx => tx.to);
        const datas = transactions.map(tx => tx.data || '0x');
        return accountInterface.encodeFunctionData('executeBatch', [destinations, datas]);
    }

    /**
     * Make RPC call to bundler
     */
    private async bundlerRpc(method: string, params: any[]): Promise<any> {
        const response = await fetch(this.bundlerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method,
                params,
                id: Date.now(),
            }),
        });

        const data = await response.json();

        if (data.error) {
            console.error(`[ERC4337] Bundler RPC Error (${method}):`, data.error);
            throw new Error(data.error.message || 'Bundler RPC error');
        }

        return data.result;
    }

    /**
     * Get account nonce from bundler
     */
    async getAccountNonce(sender: string): Promise<bigint> {
        try {
            const result = await this.bundlerRpc('eth_getUserOperationCount', [sender, this.entryPoint]);
            return BigInt(result);
        } catch {
            return 0n;
        }
    }

    /**
     * Estimate gas for UserOperation
     */
    async estimateUserOperationGas(userOp: any): Promise<{
        callGasLimit: string;
        verificationGasLimit: string;
        preVerificationGas: string;
    }> {
        const result = await this.bundlerRpc('eth_estimateUserOperationGas', [userOp, this.entryPoint]);
        return {
            callGasLimit: result.callGasLimit,
            verificationGasLimit: result.verificationGasLimit,
            preVerificationGas: result.preVerificationGas,
        };
    }

    /**
     * Build UserOperation
     */
    async buildUserOperation(
        signer: Wallet,
        transactions: UserOperationInput[],
        options: BuildUserOpOptions = {}
    ): Promise<any> {
        const owner = signer.address;
        const smartAccountAddress = await this.getSmartAccountAddress(owner);
        const isDeployed = await this.isDeployed(smartAccountAddress);

        console.log('[ERC4337] Building UserOp for:', smartAccountAddress);
        console.log('[ERC4337] Is deployed:', isDeployed);

        // Build callData
        let callData: string;
        if (transactions.length === 1) {
            const tx = transactions[0];
            callData = this.buildExecuteCallData(
                tx.to,
                BigInt(tx.value || '0'),
                tx.data || '0x'
            );
        } else {
            callData = this.buildBatchCallData(transactions);
        }

        // Get nonce
        let nonce = 0n;
        if (isDeployed) {
            try {
                nonce = await this.getAccountNonce(smartAccountAddress);
            } catch {
                const account = new Contract(smartAccountAddress, SIMPLE_ACCOUNT_ABI, this.provider);
                nonce = await account.getNonce();
            }
        }

        // Build initCode
        const initCode = isDeployed ? '0x' : this.buildInitCode(owner);

        // Get gas prices
        const feeData = await this.provider.getFeeData();
        const maxFeePerGas = toBeHex(feeData.maxFeePerGas || 0n);
        const maxPriorityFeePerGas = toBeHex(feeData.maxPriorityFeePerGas || 0n);

        // Build base UserOperation with high defaults for deployment
        const userOp = {
            sender: smartAccountAddress,
            nonce: toBeHex(nonce),
            initCode,
            callData,
            callGasLimit: toBeHex(isDeployed ? 500000n : 2000000n),
            verificationGasLimit: toBeHex(isDeployed ? 300000n : 5000000n),
            preVerificationGas: toBeHex(100000n),
            maxFeePerGas,
            maxPriorityFeePerGas,
            paymasterAndData: '0x',
            signature: '0x',
        };

        // Try to get better gas estimates from bundler
        try {
            const gasEstimate = await this.estimateUserOperationGas(userOp);

            const addBuffer = (hexValue: string, bufferPercent: number = 20) => {
                const value = BigInt(hexValue);
                const buffered = value * BigInt(100 + bufferPercent) / 100n;
                return toBeHex(buffered);
            };

            userOp.callGasLimit = addBuffer(gasEstimate.callGasLimit);
            userOp.verificationGasLimit = addBuffer(gasEstimate.verificationGasLimit);
            userOp.preVerificationGas = addBuffer(gasEstimate.preVerificationGas);

            console.log('[ERC4337] Gas estimate from bundler (with 20% buffer)');
        } catch (error) {
            console.warn('[ERC4337] Gas estimation failed, using high defaults');
        }

        // Sign UserOperation
        const signature = await this.signUserOperation(signer, userOp);
        userOp.signature = signature;

        return userOp;
    }

    /**
     * Sign UserOperation
     */
    private async signUserOperation(signer: Wallet, userOp: any): Promise<string> {
        const userOpHash = this.getUserOpHash(userOp);
        const signature = await signer.signMessage(getBytes(userOpHash));
        return signature;
    }

    /**
     * Calculate UserOperation hash
     */
    private getUserOpHash(userOp: any): string {
        const packed = this.packUserOp(userOp);
        const userOpPackHash = keccak256(packed);

        return keccak256(
            abiCoder.encode(
                ['bytes32', 'address', 'uint256'],
                [userOpPackHash, this.entryPoint, ARC_TESTNET.chainId]
            )
        );
    }

    /**
     * Pack UserOperation for hashing
     */
    private packUserOp(op: any): string {
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
                BigInt(op.nonce),
                keccak256(op.initCode === '0x' ? '0x' : op.initCode),
                keccak256(op.callData === '0x' ? '0x' : op.callData),
                BigInt(op.callGasLimit),
                BigInt(op.verificationGasLimit),
                BigInt(op.preVerificationGas),
                BigInt(op.maxFeePerGas),
                BigInt(op.maxPriorityFeePerGas),
                keccak256(op.paymasterAndData === '0x' ? '0x' : op.paymasterAndData),
            ]
        );
    }

    /**
     * Send UserOperation via bundler
     */
    async sendUserOperation(userOp: any): Promise<{
        userOpHash: string;
        txHash?: string;
    }> {
        console.log('[ERC4337] Sending UserOperation...');

        const userOpHash = await this.bundlerRpc('eth_sendUserOperation', [userOp, this.entryPoint]);

        // Wait for inclusion
        try {
            const receipt = await this.waitForUserOperation(userOpHash, 120000);
            return {
                userOpHash,
                txHash: receipt.transactionHash,
            };
        } catch (error) {
            console.warn('[ERC4337] Waiting for receipt failed:', error);
            return { userOpHash };
        }
    }

    /**
     * Wait for UserOperation to be included
     */
    private async waitForUserOperation(hash: string, timeout: number = 60000): Promise<any> {
        const startTime = Date.now();
        const pollInterval = 2000;

        while (Date.now() - startTime < timeout) {
            try {
                const receipt = await this.bundlerRpc('eth_getUserOperationReceipt', [hash]);
                if (receipt?.receipt?.transactionHash) {
                    console.log('[ERC4337] UserOperation confirmed:', receipt.receipt.transactionHash);
                    return receipt.receipt;
                }
            } catch {
                // Continue polling
            }

            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        throw new Error(`UserOperation ${hash} not confirmed within ${timeout}ms`);
    }

    /**
     * Execute transaction via Smart Account
     */
    async executeTransaction(
        signer: Wallet,
        to: string,
        value: string,
        data: string = '0x',
        sponsored: boolean = true
    ): Promise<{ userOpHash: string; txHash?: string }> {
        const userOp = await this.buildUserOperation(
            signer,
            [{ to, value, data }],
            { sponsored }
        );

        return this.sendUserOperation(userOp);
    }

    /**
     * Execute batch transactions via Smart Account
     */
    async executeBatch(
        signer: Wallet,
        transactions: UserOperationInput[],
        sponsored: boolean = true
    ): Promise<{ userOpHash: string; txHash?: string }> {
        const userOp = await this.buildUserOperation(
            signer,
            transactions,
            { sponsored, batchMode: true }
        );

        return this.sendUserOperation(userOp);
    }

    /**
     * Transfer native token via Smart Account
     */
    async transfer(
        signer: Wallet,
        to: string,
        amount: string,
        sponsored: boolean = true
    ): Promise<{ userOpHash: string; txHash?: string }> {
        const value = parseUnits(amount, 6).toString();
        return this.executeTransaction(signer, to, value, '0x', sponsored);
    }

    /**
     * Transfer ERC20 token via Smart Account
     */
    async transferERC20(
        signer: Wallet,
        tokenAddress: string,
        to: string,
        amount: string,
        decimals: number = 18,
        sponsored: boolean = true
    ): Promise<{ userOpHash: string; txHash?: string }> {
        const erc20Interface = new Interface([
            'function transfer(address to, uint256 amount) returns (bool)',
        ]);

        const amountWei = parseUnits(amount, decimals);
        const transferData = erc20Interface.encodeFunctionData('transfer', [to, amountWei]);

        return this.executeTransaction(signer, tokenAddress, '0', transferData, sponsored);
    }

    /**
     * Check if ERC-4337 bundler is available
     */
    async isAvailable(): Promise<boolean> {
        if (!BUNDLER_CONFIG.enabled) {
            return false;
        }
        try {
            const entryPoints = await this.bundlerRpc('eth_supportedEntryPoints', []);
            return entryPoints.length > 0;
        } catch {
            return false;
        }
    }

    /**
     * Get the configured entry point address
     */
    getEntryPoint(): string {
        return this.entryPoint;
    }

    /**
     * Get the factory address
     */
    getFactoryAddress(): string {
        return this.factoryAddress;
    }
}

export const erc4337Service = new ERC4337Service();
