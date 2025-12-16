/**
 * Circle Modular Wallet Service
 *
 * This service handles all Circle Modular Wallet operations including:
 * - Passkey registration and authentication
 * - Smart account creation and management
 * - Transaction signing and sending
 *
 * Uses Circle's ERC-4337 + ERC-6900 compliant smart accounts.
 */

import { createPublicClient, http, type PublicClient, encodeFunctionData, parseUnits } from 'viem';
import {
  createBundlerClient,
  type BundlerClient,
} from 'viem/account-abstraction';
import {
  toCircleSmartAccount,
  toModularTransport,
  toPasskeyTransport,
  toWebAuthnCredential,
  WebAuthnMode,
  type ToCircleSmartAccountReturnType,
  type WebAuthnCredential,
} from '@circle-fin/modular-wallets-core';
import { toWebAuthnAccount } from 'viem/account-abstraction';
import { arcTestnet } from '../config/chains/arcTestnet';
import { baseSepolia } from 'viem/chains';
import { CIRCLE_CONFIG, validateCircleConfig } from '../config/circle';
import { logger } from './logger';

// Supported chains for Circle Modular Wallet
const SUPPORTED_CHAINS = {
  arcTestnet: {
    chain: arcTestnet,
    chainId: 5042002,
    sdkPath: '/arcTestnet',
  },
  baseSepolia: {
    chain: baseSepolia,
    chainId: 84532,
    sdkPath: '/baseSepolia',
  },
} as const;

// Types
export interface CircleWalletState {
  isConnected: boolean;
  address: string | null;
  username: string | null;
}

export interface TransactionParams {
  to: string;
  value?: bigint;
  data?: `0x${string}`;
}

export interface TokenTransferParams {
  tokenAddress: string;
  to: string;
  amount: string;
  decimals: number;
}

// Constants
const DEFAULT_TIMEOUT = 60000; // 60 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

/**
 * Utility: Timeout wrapper for promises
 */
function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Utility: Retry with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    operation?: string;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = MAX_RETRIES,
    delay = RETRY_DELAY,
    operation = 'Operation',
    shouldRetry = () => true,
  } = options;

  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry user cancellations or validation errors
      if (
        error.name === 'AbortError' ||
        error.message?.includes('User rejected') ||
        error.message?.includes('cancelled') ||
        error.message?.includes('Invalid') ||
        !shouldRetry(error)
      ) {
        throw error;
      }

      if (attempt < maxRetries) {
        const waitTime = delay * Math.pow(2, attempt - 1); // Exponential backoff
        logger.info(`${operation} failed, retrying (${attempt}/${maxRetries})...`, {
          component: 'CircleWalletService',
          errorMsg: error.message,
          waitTime,
        });
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError;
}

// ERC20 ABI for transfers
const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// Chain client configuration
interface ChainClient {
  publicClient: PublicClient;
  bundlerClient: BundlerClient;
  modularTransport: ReturnType<typeof toModularTransport>;
  account: ToCircleSmartAccountReturnType; // Chain-specific account
}

/**
 * Circle Modular Wallet Service
 * Supports multi-chain operations via Circle's bundler infrastructure
 */
class CircleWalletServiceImpl {
  private publicClient: PublicClient | null = null;
  private bundlerClient: BundlerClient | null = null;
  private account: ToCircleSmartAccountReturnType | null = null;
  private credential: WebAuthnCredential | null = null;
  private username: string | null = null;
  private modularTransport: ReturnType<typeof toModularTransport> | null = null;
  private passkeyTransport: ReturnType<typeof toPasskeyTransport> | null = null;
  private initialized: boolean = false;

  // Multi-chain support: chain-specific clients
  private chainClients: Map<number, ChainClient> = new Map();

  /**
   * Initialize the service with Circle SDK transports
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Validate configuration
    const configValidation = validateCircleConfig();
    if (!configValidation.valid) {
      throw new Error(`Circle configuration invalid: ${configValidation.errors.join(', ')}`);
    }

    const sdkUrl = `${CIRCLE_CONFIG.clientUrl}${CIRCLE_CONFIG.arcTestnet.sdkPath}`;

    logger.info('Initializing Circle Wallet Service', {
      component: 'CircleWalletService',
      clientUrl: CIRCLE_CONFIG.clientUrl,
      sdkUrl,
      chain: arcTestnet.name,
      chainId: arcTestnet.id,
    });

    try {
      // Initialize passkey transport for registration/login
      this.passkeyTransport = toPasskeyTransport(
        CIRCLE_CONFIG.clientUrl,
        CIRCLE_CONFIG.clientKey
      );

      // Initialize modular transport for on-chain operations
      // Arc Testnet is listed in Circle's supported chains
      this.modularTransport = toModularTransport(
        sdkUrl,
        CIRCLE_CONFIG.clientKey
      );

      // Initialize public client
      // @ts-ignore - viem type inference issues with Circle modular transport
      this.publicClient = createPublicClient({
        chain: arcTestnet,
        transport: this.modularTransport,
      }) as PublicClient;

      // Test connection by getting chain ID
      try {
        const chainId = await this.publicClient.getChainId();
        logger.info('Circle SDK connected successfully', {
          component: 'CircleWalletService',
          chainId,
          expectedChainId: arcTestnet.id,
        });

        if (chainId !== arcTestnet.id) {
          logger.warn('Chain ID mismatch - SDK may be connecting to wrong network', {
            component: 'CircleWalletService',
            expected: arcTestnet.id,
            actual: chainId,
          });
        }
      } catch (connErr: any) {
        logger.warn('Could not verify Circle SDK connection - will attempt operations anyway', {
          component: 'CircleWalletService',
          errorMsg: connErr.message,
        });
      }

      this.initialized = true;

      logger.info('Circle Wallet Service initialized successfully', {
        component: 'CircleWalletService',
      });
    } catch (err: any) {
      logger.error('Failed to initialize Circle Wallet Service', {
        component: 'CircleWalletService',
        errorMsg: err.message,
        sdkUrl,
      });
      throw new Error(`Circle SDK initialization failed: ${err.message}. Check if Arc Testnet is properly configured.`);
    }
  }

  /**
   * Get current wallet state
   */
  getState(): CircleWalletState {
    return {
      isConnected: !!this.account,
      address: this.account?.address || null,
      username: this.username,
    };
  }

  /**
   * Create a new wallet with passkey
   */
  async createWallet(username: string): Promise<{ address: string }> {
    await this.initialize();

    if (!this.passkeyTransport || !this.publicClient) {
      throw new Error('Service not initialized');
    }

    logger.info('Creating new wallet with passkey', {
      component: 'CircleWalletService',
      username,
    });

    try {
      // 1. Register new passkey credential
      this.credential = await toWebAuthnCredential({
        transport: this.passkeyTransport,
        mode: WebAuthnMode.Register,
        username,
      });

      logger.info('Passkey credential registered', {
        component: 'CircleWalletService',
      });

      // 2. Create WebAuthn account from credential
      const webAuthnAccount = toWebAuthnAccount({
        credential: this.credential,
      });

      // 3. Create Circle Smart Account
      this.account = await toCircleSmartAccount({
        // @ts-expect-error - viem type inference issues with Circle SDK
        client: this.publicClient,
        owner: webAuthnAccount,
        name: username,
      });

      this.username = username;

      // 4. Initialize bundler client for transactions
      // @ts-ignore - viem type inference issues with custom chains
      this.bundlerClient = createBundlerClient({
        chain: arcTestnet,
        transport: this.modularTransport!,
        account: this.account,
      });

      logger.info('Wallet created successfully', {
        component: 'CircleWalletService',
        address: this.account.address,
      });

      // Store session info in localStorage for reconnection
      this.saveSessionToStorage();

      return { address: this.account.address };
    } catch (err: any) {
      logger.error('Failed to create wallet', {
        component: 'CircleWalletService',
        errorMsg: err.message,
      });
      throw err;
    }
  }

  /**
   * Login with existing passkey
   */
  async login(): Promise<{ address: string }> {
    await this.initialize();

    if (!this.passkeyTransport || !this.publicClient) {
      throw new Error('Service not initialized');
    }

    logger.info('Logging in with existing passkey', {
      component: 'CircleWalletService',
    });

    try {
      // 1. Login with existing passkey
      this.credential = await toWebAuthnCredential({
        transport: this.passkeyTransport,
        mode: WebAuthnMode.Login,
      });

      logger.info('Passkey credential retrieved', {
        component: 'CircleWalletService',
      });

      // 2. Create WebAuthn account from credential
      const webAuthnAccount = toWebAuthnAccount({
        credential: this.credential,
      });

      // 3. Recreate Circle Smart Account
      this.account = await toCircleSmartAccount({
        // @ts-expect-error - viem type inference issues with Circle SDK
        client: this.publicClient,
        owner: webAuthnAccount,
      });

      // 4. Initialize bundler client
      // @ts-ignore - viem type inference issues with custom chains
      this.bundlerClient = createBundlerClient({
        chain: arcTestnet,
        transport: this.modularTransport!,
        account: this.account,
      });

      // Store session for future reconnection
      this.saveSessionToStorage();

      logger.info('Login successful', {
        component: 'CircleWalletService',
        address: this.account.address,
      });

      return { address: this.account.address };
    } catch (err: any) {
      logger.error('Login failed', {
        component: 'CircleWalletService',
        errorMsg: err.message,
      });
      throw err;
    }
  }

  /**
   * Disconnect wallet
   */
  disconnect(): void {
    this.account = null;
    this.bundlerClient = null;
    this.credential = null;
    this.username = null;
    this.clearSessionFromStorage();

    logger.info('Wallet disconnected', {
      component: 'CircleWalletService',
    });
  }

  /**
   * Send a native token (USDC on Arc) transaction
   * Includes retry logic and timeout handling
   */
  async sendTransaction(params: TransactionParams): Promise<string> {
    if (!this.bundlerClient || !this.account) {
      throw new Error('Wallet not connected');
    }

    logger.info('Sending transaction', {
      component: 'CircleWalletService',
      to: params.to,
      value: params.value?.toString(),
    });

    try {
      // Send UserOperation with retry
      const hash = await withRetry(
        () =>
          withTimeout(
            this.bundlerClient!.sendUserOperation({
              account: this.account!,
              calls: [
                {
                  to: params.to as `0x${string}`,
                  value: params.value || 0n,
                  data: params.data || '0x',
                },
              ],
            }),
            DEFAULT_TIMEOUT,
            'Send UserOperation'
          ),
        {
          operation: 'Send UserOperation',
          maxRetries: 2,
          shouldRetry: (err) => !err.message?.includes('insufficient funds'),
        }
      );

      logger.info('UserOperation sent', {
        component: 'CircleWalletService',
        hash,
      });

      // Wait for receipt with timeout (longer timeout for confirmation)
      const receipt = await withTimeout(
        this.bundlerClient.waitForUserOperationReceipt({ hash }),
        120000, // 2 minutes for confirmation
        'Wait for receipt'
      );

      logger.info('Transaction confirmed', {
        component: 'CircleWalletService',
        txHash: receipt.receipt.transactionHash,
      });

      // Refresh session timestamp on successful transaction
      this.refreshSessionTimestamp();

      return receipt.receipt.transactionHash;
    } catch (err: any) {
      logger.error('Transaction failed', {
        component: 'CircleWalletService',
        errorMsg: err.message,
      });
      throw err;
    }
  }

  /**
   * Send ERC20 token transfer
   * Includes retry logic and timeout handling
   */
  async sendTokenTransfer(params: TokenTransferParams): Promise<string> {
    if (!this.bundlerClient || !this.account) {
      throw new Error('Wallet not connected');
    }

    // Validate amount format
    let amount: bigint;
    try {
      amount = parseUnits(params.amount, params.decimals);
    } catch (err) {
      throw new Error(`Invalid amount format: ${params.amount}`);
    }

    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [params.to as `0x${string}`, amount],
    });

    logger.info('Sending token transfer', {
      component: 'CircleWalletService',
      token: params.tokenAddress,
      to: params.to,
      amount: params.amount,
    });

    try {
      // Send with retry
      const hash = await withRetry(
        () =>
          withTimeout(
            this.bundlerClient!.sendUserOperation({
              account: this.account!,
              calls: [
                {
                  to: params.tokenAddress as `0x${string}`,
                  data,
                },
              ],
            }),
            DEFAULT_TIMEOUT,
            'Send token transfer'
          ),
        {
          operation: 'Token transfer',
          maxRetries: 2,
          shouldRetry: (err) =>
            !err.message?.includes('insufficient') &&
            !err.message?.includes('allowance'),
        }
      );

      // Wait for receipt with timeout
      const receipt = await withTimeout(
        this.bundlerClient.waitForUserOperationReceipt({ hash }),
        120000,
        'Wait for token transfer receipt'
      );

      logger.info('Token transfer confirmed', {
        component: 'CircleWalletService',
        txHash: receipt.receipt.transactionHash,
      });

      // Refresh session timestamp on successful transaction
      this.refreshSessionTimestamp();

      return receipt.receipt.transactionHash;
    } catch (err: any) {
      logger.error('Token transfer failed', {
        component: 'CircleWalletService',
        errorMsg: err.message,
      });
      throw err;
    }
  }

  /**
   * Send batch transactions (multiple calls in one UserOp)
   */
  async sendBatchTransactions(
    calls: Array<{
      to: string;
      value?: bigint;
      data?: `0x${string}`;
    }>
  ): Promise<string> {
    if (!this.bundlerClient || !this.account) {
      throw new Error('Wallet not connected');
    }

    logger.info('Sending batch transaction', {
      component: 'CircleWalletService',
      callCount: calls.length,
    });

    try {
      const formattedCalls = calls.map((call) => ({
        to: call.to as `0x${string}`,
        value: call.value || 0n,
        data: call.data || ('0x' as `0x${string}`),
      }));

      const hash = await this.bundlerClient.sendUserOperation({
        account: this.account,
        calls: formattedCalls,
      });

      const receipt = await this.bundlerClient.waitForUserOperationReceipt({
        hash,
      });

      logger.info('Batch transaction confirmed', {
        component: 'CircleWalletService',
        txHash: receipt.receipt.transactionHash,
      });

      // Refresh session timestamp on successful transaction
      this.refreshSessionTimestamp();

      return receipt.receipt.transactionHash;
    } catch (err: any) {
      logger.error('Batch transaction failed', {
        component: 'CircleWalletService',
        errorMsg: err.message,
      });
      throw err;
    }
  }

  /**
   * Get or initialize a chain-specific bundler client
   * Enables multi-chain operations (Sepolia, Base Sepolia, etc.)
   *
   * For Sepolia: Uses Pimlico bundler (Circle bundler doesn't support Sepolia)
   * For other chains: Uses Circle's modular transport
   */
  private async getChainClient(chainId: number): Promise<ChainClient> {
    // Return cached client if exists
    if (this.chainClients.has(chainId)) {
      return this.chainClients.get(chainId)!;
    }

    if (!this.account || !this.credential) {
      throw new Error('Wallet not connected');
    }

    // Find chain config
    const chainConfig = Object.values(SUPPORTED_CHAINS).find(c => c.chainId === chainId);
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    logger.info('Initializing chain client', {
      component: 'CircleWalletService',
      chainId,
      sdkPath: chainConfig.sdkPath,
    });

    try {
      let publicClient: PublicClient;
      let bundlerClient: BundlerClient;
      let modularTransport: ReturnType<typeof toModularTransport>;

      // Use Circle's modular transport for all supported chains
      // Note: Ethereum Sepolia is NOT supported by Circle Modular Wallets SDK
      // Use Base Sepolia instead (chainId: 84532)
      const sdkUrl = `${CIRCLE_CONFIG.clientUrl}${chainConfig.sdkPath}`;
      modularTransport = toModularTransport(sdkUrl, CIRCLE_CONFIG.clientKey);

      // Create public client for this chain
      // @ts-ignore - viem type inference issues
      publicClient = createPublicClient({
        chain: chainConfig.chain,
        transport: modularTransport,
      }) as PublicClient;

      // CRITICAL: Create a chain-specific Circle smart account
      // The same passkey credential works across all chains, but the account
      // must be created with the chain-specific public client
      const webAuthnAccount = toWebAuthnAccount({
        credential: this.credential,
      });

      const chainAccount = await toCircleSmartAccount({
        // @ts-expect-error - viem type inference issues with Circle SDK
        client: publicClient,
        owner: webAuthnAccount,
      });

      logger.info('Chain-specific account created', {
        component: 'CircleWalletService',
        chainId,
        accountAddress: chainAccount.address,
        expectedAddress: this.account.address,
      });

      // Verify addresses match (counterfactual address should be the same)
      if (chainAccount.address.toLowerCase() !== this.account.address.toLowerCase()) {
        logger.warn('Chain account address mismatch - this should not happen', {
          component: 'CircleWalletService',
          chainId,
          chainAccountAddress: chainAccount.address,
          mainAccountAddress: this.account.address,
        });
      }

      // Create bundler client with chain-specific account
      // @ts-ignore - viem type inference issues
      bundlerClient = createBundlerClient({
        chain: chainConfig.chain,
        transport: modularTransport,
        account: chainAccount,
      });

      const client: ChainClient = {
        publicClient,
        bundlerClient,
        modularTransport,
        account: chainAccount,
      };

      // Cache for future use
      this.chainClients.set(chainId, client);

      logger.info('Chain client initialized', {
        component: 'CircleWalletService',
        chainId,
        chainName: chainConfig.chain.name,
      });

      return client;
    } catch (err: any) {
      logger.error('Failed to initialize chain client', {
        component: 'CircleWalletService',
        chainId,
        errorMsg: err.message,
      });
      throw new Error(`Failed to connect to chain ${chainId}: ${err.message}`);
    }
  }

  /**
   * Send batch transactions on a specific chain
   * Used for cross-chain operations (bridge from Sepolia/Base to Arc)
   */
  async sendBatchTransactionsOnChain(
    chainId: number,
    calls: Array<{
      to: string;
      value?: bigint;
      data?: `0x${string}`;
    }>
  ): Promise<string> {
    if (!this.account) {
      throw new Error('Wallet not connected');
    }

    // For Arc Testnet, use the default bundler
    if (chainId === 5042002) {
      return this.sendBatchTransactions(calls);
    }

    logger.info('Sending batch transaction on chain', {
      component: 'CircleWalletService',
      chainId,
      callCount: calls.length,
    });

    try {
      const chainClient = await this.getChainClient(chainId);

      const formattedCalls = calls.map((call) => ({
        to: call.to as `0x${string}`,
        value: call.value || 0n,
        data: call.data || ('0x' as `0x${string}`),
      }));

      // CRITICAL: Use the chain-specific account, not this.account
      // The chain-specific account was created with the correct chain's client
      const hash = await chainClient.bundlerClient.sendUserOperation({
        account: chainClient.account,
        calls: formattedCalls,
      });

      const receipt = await chainClient.bundlerClient.waitForUserOperationReceipt({
        hash,
      });

      logger.info('Cross-chain batch transaction confirmed', {
        component: 'CircleWalletService',
        chainId,
        txHash: receipt.receipt.transactionHash,
      });

      return receipt.receipt.transactionHash;
    } catch (err: any) {
      logger.error('Cross-chain batch transaction failed', {
        component: 'CircleWalletService',
        chainId,
        errorMsg: err.message,
      });
      throw err;
    }
  }

  /**
   * Get token balance on a specific chain
   */
  async getTokenBalanceOnChain(chainId: number, tokenAddress: string): Promise<bigint> {
    if (!this.account) {
      throw new Error('Wallet not connected');
    }

    // For Arc Testnet, use the default client
    if (chainId === 5042002) {
      return this.getTokenBalance(tokenAddress);
    }

    try {
      // For Base Sepolia, use direct HTTP client
      // Circle's modular transport doesn't support standard RPC calls properly
      if (chainId === 84532) {
        const baseSepoliaClient = createPublicClient({
          chain: baseSepolia,
          transport: http('https://sepolia.base.org'),
        });

        const balance = await baseSepoliaClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [this.account.address],
        });

        return balance as bigint;
      }

      // For other chains, use Circle's chain client
      const chainClient = await this.getChainClient(chainId);

      // @ts-ignore - viem type inference issues
      const balance = await chainClient.publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [this.account.address],
      });

      return balance as bigint;
    } catch (err: any) {
      logger.warn('Failed to get token balance on chain', {
        component: 'CircleWalletService',
        chainId,
        tokenAddress,
        errorMsg: err.message,
      });
      return 0n;
    }
  }

  /**
   * Check if wallet is deployed on a specific chain
   */
  async isDeployedOnChain(chainId: number): Promise<boolean> {
    if (!this.account) {
      return false;
    }

    // For Arc Testnet, use the default client
    if (chainId === 5042002) {
      return this.isDeployed();
    }

    try {
      const chainClient = await this.getChainClient(chainId);
      const code = await chainClient.publicClient.getCode({
        address: this.account.address,
      });
      return code !== undefined && code !== '0x';
    } catch {
      return false;
    }
  }

  /**
   * Get native balance (USDC on Arc)
   */
  async getBalance(): Promise<bigint> {
    if (!this.account || !this.publicClient) {
      throw new Error('Wallet not connected');
    }

    return this.publicClient.getBalance({
      address: this.account.address,
    });
  }

  /**
   * Get ERC20 token balance
   */
  async getTokenBalance(tokenAddress: string): Promise<bigint> {
    if (!this.account || !this.publicClient) {
      throw new Error('Wallet not connected');
    }

    // @ts-ignore - viem type inference issues
    const balance = await this.publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [this.account.address],
    });

    return balance as bigint;
  }

  /**
   * Check if wallet is deployed on-chain
   */
  async isDeployed(): Promise<boolean> {
    if (!this.account || !this.publicClient) {
      return false;
    }

    const code = await this.publicClient.getCode({
      address: this.account.address,
    });

    return code !== undefined && code !== '0x';
  }

  /**
   * Get the smart account address (even before deployment)
   */
  getAddress(): string | null {
    return this.account?.address || null;
  }

  // Storage helpers for session persistence
  private saveSessionToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const data = {
        username: this.username,
        address: this.account?.address,
        timestamp: Date.now(),
        hasWallet: true,
      };
      localStorage.setItem('circle_wallet_state', JSON.stringify(data));
      logger.info('Session saved to storage', {
        component: 'CircleWalletService',
        address: this.account?.address,
      });
    } catch (e) {
      logger.error('Failed to save session to storage', {
        component: 'CircleWalletService',
        errorMsg: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  }

  private loadSessionFromStorage(): { username: string | null; address: string | null; hasWallet: boolean } | null {
    if (typeof window === 'undefined') return null;

    try {
      const stored = localStorage.getItem('circle_wallet_state');
      if (stored) {
        const data = JSON.parse(stored);
        // Check if session is not too old (10 minutes)
        const maxAge = 10 * 60 * 1000; // 10 minutes
        if (data.timestamp && Date.now() - data.timestamp < maxAge) {
          return {
            username: data.username || null,
            address: data.address || null,
            hasWallet: data.hasWallet || false,
          };
        }
        // Session expired, clear it
        this.clearSessionFromStorage();
      }
    } catch (e) {
      // Ignore storage errors
    }
    return null;
  }

  private clearSessionFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem('circle_wallet_state');
    } catch (e) {
      // Ignore storage errors
    }
  }

  // Refresh session timestamp to extend the 10-minute window
  private refreshSessionTimestamp(): void {
    if (typeof window === 'undefined' || !this.account) return;

    try {
      const stored = localStorage.getItem('circle_wallet_state');
      if (stored) {
        const data = JSON.parse(stored);
        data.timestamp = Date.now();
        localStorage.setItem('circle_wallet_state', JSON.stringify(data));
      }
    } catch (e) {
      // Ignore storage errors
    }
  }

  /**
   * Check if user has a stored wallet session
   */
  hasStoredSession(): boolean {
    const session = this.loadSessionFromStorage();
    return session?.hasWallet === true;
  }

  /**
   * Get stored session info without connecting
   */
  getStoredSession(): { username: string | null; address: string | null } | null {
    const session = this.loadSessionFromStorage();
    if (session?.hasWallet) {
      return {
        username: session.username,
        address: session.address,
      };
    }
    return null;
  }

  /**
   * Try to auto-reconnect using stored session
   * Returns true if reconnection was successful
   */
  async tryAutoReconnect(): Promise<boolean> {
    const session = this.loadSessionFromStorage();
    if (!session?.hasWallet) {
      return false;
    }

    try {
      logger.info('Attempting auto-reconnect', {
        component: 'CircleWalletService',
        storedAddress: session.address,
      });

      await this.login();

      // Verify address matches
      if (this.account?.address && session.address &&
          this.account.address.toLowerCase() !== session.address.toLowerCase()) {
        logger.warn('Auto-reconnect address mismatch', {
          component: 'CircleWalletService',
          expected: session.address,
          got: this.account.address,
        });
      }

      return true;
    } catch (err: any) {
      logger.info('Auto-reconnect failed, user needs to login manually', {
        component: 'CircleWalletService',
        errorMsg: err.message,
      });
      // Don't clear session - user might want to try again
      return false;
    }
  }
}

// Singleton instance
export const circleWalletService = new CircleWalletServiceImpl();

export default circleWalletService;
