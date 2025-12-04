/**
 * Multi-Sig On-Chain Execution Service
 * Uses existing BundlerService for ERC-4337 UserOperation execution
 * Integrates with Arc Wallet's passkey-based smart accounts
 */

import { ethers, JsonRpcProvider, Contract, Interface } from 'ethers';
import { getBundlerService, UserOperation } from './bundlerService.js';

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

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  userOpHash?: string;
  error?: string;
  gasUsed?: string;
}

export interface TransactionParams {
  accountAddress: string;
  targetAddress: string;
  value: string;
  tokenAddress?: string | null;
  tokenSymbol?: string;
  data?: string | null;
}

export interface PreparedUserOp {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  userOpHash: string;
}

export class MultiSigExecutionService {
  private provider: JsonRpcProvider;
  private chainId: number;
  private entryPointAddress: string;

  constructor(rpcUrl: string, chainId: number = 5042002) {
    this.provider = new JsonRpcProvider(rpcUrl);
    this.chainId = chainId;
    this.entryPointAddress = process.env.ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
  }

  /**
   * Prepare a UserOperation for multi-sig transaction
   * Returns the UserOp that needs to be signed by passkeys on frontend
   */
  async prepareUserOperation(params: TransactionParams): Promise<PreparedUserOp | null> {
    try {
      const { accountAddress, targetAddress, value, tokenAddress, data } = params;

      // Build callData for execute function
      const callData = await this._buildCallData(targetAddress, value, tokenAddress, data);

      // Get nonce from EntryPoint (standard ERC-4337 way)
      const entryPoint = new Contract(
        this.entryPointAddress,
        ['function getNonce(address sender, uint192 key) view returns (uint256)'],
        this.provider
      );
      const nonce = await entryPoint.getNonce(accountAddress, 0);

      // Get gas prices
      const feeData = await this.provider.getFeeData();
      const maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('1', 'gwei');
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('0.1', 'gwei');

      // Use bundler service for gas estimation
      const bundler = getBundlerService();
      const gasEstimates = await bundler.estimateUserOperationGas(
        { sender: accountAddress, callData, initCode: '0x' },
        this.entryPointAddress
      );

      // Build UserOp (without signature - frontend will sign with passkeys)
      const userOp = {
        sender: accountAddress,
        nonce: nonce.toString(),
        initCode: '0x', // Account already deployed for multi-sig
        callData,
        callGasLimit: gasEstimates.callGasLimit,
        verificationGasLimit: gasEstimates.verificationGasLimit,
        preVerificationGas: gasEstimates.preVerificationGas,
        maxFeePerGas: maxFeePerGas.toString(),
        maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
        paymasterAndData: '0x', // No paymaster for now
        signature: '0x',
      };

      // Calculate userOpHash for signing
      const userOpHash = this._calculateUserOpHash(userOp);

      return {
        ...userOp,
        userOpHash,
      };
    } catch (error) {
      console.error('Failed to prepare UserOperation:', error);
      return null;
    }
  }

  /**
   * Execute UserOperation via existing BundlerService
   * Called after all required passkey signatures are collected on frontend
   */
  async executeUserOperation(
    preparedOp: PreparedUserOp,
    aggregatedSignature: string
  ): Promise<ExecutionResult> {
    try {
      const bundler = getBundlerService();

      // Create full UserOperation with signature
      const userOp: UserOperation = {
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
      const userOpHash = await bundler.sendUserOperation(userOp, this.entryPointAddress);

      // Wait for receipt (with timeout)
      const receipt = await this._waitForReceipt(userOpHash, 60000);

      return {
        success: true,
        txHash: receipt?.receipt?.transactionHash,
        userOpHash,
      };
    } catch (error: any) {
      console.error('UserOperation execution failed:', error);
      return {
        success: false,
        error: error.message || 'Execution failed',
      };
    }
  }

  /**
   * Simple execution for when signatures are ready
   * Prepares and executes in one call
   */
  async executeTransaction(
    params: TransactionParams,
    aggregatedSignature: string
  ): Promise<ExecutionResult> {
    try {
      // Prepare the UserOp
      const preparedOp = await this.prepareUserOperation(params);
      if (!preparedOp) {
        return { success: false, error: 'Failed to prepare UserOperation' };
      }

      // Execute with signature
      return this.executeUserOperation(preparedOp, aggregatedSignature);
    } catch (error: any) {
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
  private async _buildCallData(
    targetAddress: string,
    value: string,
    tokenAddress?: string | null,
    data?: string | null
  ): Promise<string> {
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
    } else {
      // Native ETH transfer
      const txValue = ethers.parseEther(value);
      const txData = data || '0x';

      return arcAccountInterface.encodeFunctionData('execute', [targetAddress, txValue, txData]);
    }
  }

  /**
   * Calculate UserOp hash for signing
   */
  private _calculateUserOpHash(userOp: any): string {
    const packed = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256', 'bytes32', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes32'],
      [
        userOp.sender,
        userOp.nonce,
        ethers.keccak256(userOp.initCode || '0x'),
        ethers.keccak256(userOp.callData),
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        ethers.keccak256(userOp.paymasterAndData || '0x'),
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
   * Wait for UserOp receipt via bundler
   */
  private async _waitForReceipt(userOpHash: string, timeout: number = 60000): Promise<any> {
    const bundler = getBundlerService();
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const receipt = await bundler.getUserOperationReceipt(userOpHash);
      if (receipt && receipt.receipt) {
        return receipt;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return null;
  }

  /**
   * Check if account has enough balance for transaction
   */
  async checkBalance(accountAddress: string, value: string, tokenAddress?: string): Promise<boolean> {
    try {
      if (tokenAddress && tokenAddress !== '0x0000000000000000000000000000000000000000') {
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, this.provider);
        const balance = await tokenContract.balanceOf(accountAddress);
        const decimals = await tokenContract.decimals();
        const requiredAmount = ethers.parseUnits(value, decimals);
        return balance >= requiredAmount;
      } else {
        const balance = await this.provider.getBalance(accountAddress);
        const requiredAmount = ethers.parseEther(value);
        return balance >= requiredAmount;
      }
    } catch {
      return false;
    }
  }

  /**
   * Get account contract info
   */
  async getAccountInfo(accountAddress: string): Promise<{
    threshold: number;
    keyCount: number;
    balance: string;
  } | null> {
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
    } catch {
      return null;
    }
  }
}

// Singleton instance
let executionServiceInstance: MultiSigExecutionService | null = null;

export const getExecutionService = (): MultiSigExecutionService => {
  if (!executionServiceInstance) {
    const rpcUrl = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
    const chainId = parseInt(process.env.ARC_CHAIN_ID || '5042002');
    executionServiceInstance = new MultiSigExecutionService(rpcUrl, chainId);
  }
  return executionServiceInstance;
};

export default MultiSigExecutionService;
