/**
 * Arc Wallet SDK - Main Class
 * Provides a simple API for integrating passkey-based wallets
 */

import { JsonRpcProvider } from 'ethers';
import { WebAuthnManager } from '../core/webauthn';
import { SecureStorage } from '../core/secureStorage';
import { KeyManager } from '../core/keyManager';
import type {
  WalletSDKConfig,
  WalletAccount,
  TransactionRequest,
  SignedTransaction,
  WalletEvent,
  WalletEventPayload,
} from '../types';

export class WalletSDK {
  private config: WalletSDKConfig;
  private webauthn: WebAuthnManager;
  private storage: SecureStorage;
  private keyManager: KeyManager;
  private provider: JsonRpcProvider;
  private eventListeners: Map<WalletEvent, Set<(payload: any) => void>>;
  private currentAccount: WalletAccount | null = null;

  constructor(config: WalletSDKConfig) {
    this.config = config;

    // Initialize core components
    this.webauthn = new WebAuthnManager({
      rpId: config.rpId,
      rpName: config.appName,
      backendUrl: config.backendUrl,
    });

    this.storage = new SecureStorage();
    this.keyManager = new KeyManager(this.webauthn, this.storage);
    this.provider = new JsonRpcProvider(config.rpcUrl);
    this.eventListeners = new Map();

    console.log('[WalletSDK] Initialized with config:', {
      appName: config.appName,
      rpId: config.rpId,
      rpcUrl: config.rpcUrl,
    });
  }

  /**
   * Create new wallet with passkey
   */
  async createWallet(userId: string, userName: string): Promise<WalletAccount> {
    try {
      console.log('[WalletSDK] Creating new wallet...');

      const account = await this.keyManager.createWallet(userId, userName);
      this.currentAccount = account;

      this.emit('connect', { address: account.address });

      console.log('[WalletSDK] Wallet created:', account.address);

      return account;
    } catch (error: any) {
      this.emit('error', {
        message: error.message,
        code: 'CREATE_WALLET_FAILED',
      });
      throw error;
    }
  }

  /**
   * Connect to existing wallet (unlock with passkey)
   */
  async connect(credentialId?: string): Promise<WalletAccount> {
    try {
      console.log('[WalletSDK] Connecting wallet...');

      const account = await this.keyManager.unlockWallet(credentialId);
      this.currentAccount = account;

      this.emit('connect', { address: account.address });

      console.log('[WalletSDK] Connected:', account.address);

      return account;
    } catch (error: any) {
      this.emit('error', {
        message: error.message,
        code: 'CONNECT_FAILED',
      });
      throw error;
    }
  }

  /**
   * Disconnect wallet (lock)
   */
  disconnect(): void {
    const address = this.currentAccount?.address;

    this.keyManager.lock();
    this.currentAccount = null;

    this.emit('disconnect', { reason: 'User disconnected' });

    console.log('[WalletSDK] Disconnected');
  }

  /**
   * Sign and send transaction
   */
  async signTransaction(txRequest: TransactionRequest): Promise<SignedTransaction> {
    if (!this.currentAccount) {
      throw new Error('No wallet connected. Please connect first.');
    }

    try {
      console.log('[WalletSDK] Signing transaction...');

      // Prepare transaction
      const tx = {
        to: txRequest.to,
        value: txRequest.value,
        data: txRequest.data || '0x',
        gasLimit: txRequest.gasLimit,
        maxFeePerGas: txRequest.maxFeePerGas,
        maxPriorityFeePerGas: txRequest.maxPriorityFeePerGas,
      };

      // Fill in gas parameters if not provided
      if (!tx.gasLimit) {
        const estimated = await this.provider.estimateGas({
          to: tx.to,
          value: tx.value,
          data: tx.data,
        });
        tx.gasLimit = estimated;
      }

      if (!tx.maxFeePerGas || !tx.maxPriorityFeePerGas) {
        const feeData = await this.provider.getFeeData();
        tx.maxFeePerGas = tx.maxFeePerGas || feeData.maxFeePerGas || undefined;
        tx.maxPriorityFeePerGas =
          tx.maxPriorityFeePerGas || feeData.maxPriorityFeePerGas || undefined;
      }

      // Sign transaction
      const signedTx = await this.keyManager.signTransaction(tx);

      // Send transaction
      const response = await this.provider.broadcastTransaction(signedTx);
      const receipt = await response.wait();

      const result: SignedTransaction = {
        hash: receipt!.hash,
        signedTx,
        from: this.currentAccount.address,
        to: txRequest.to,
        value: txRequest.value,
      };

      this.emit('transactionSigned', { hash: receipt!.hash });

      console.log('[WalletSDK] Transaction sent:', receipt!.hash);

      return result;
    } catch (error: any) {
      this.emit('error', {
        message: error.message,
        code: 'TRANSACTION_FAILED',
      });
      throw error;
    }
  }

  /**
   * Sign message
   */
  async signMessage(message: string): Promise<string> {
    if (!this.currentAccount) {
      throw new Error('No wallet connected. Please connect first.');
    }

    try {
      console.log('[WalletSDK] Signing message...');
      const signature = await this.keyManager.signMessage(message);
      console.log('[WalletSDK] Message signed');
      return signature;
    } catch (error: any) {
      this.emit('error', {
        message: error.message,
        code: 'SIGN_MESSAGE_FAILED',
      });
      throw error;
    }
  }

  /**
   * Get current account
   */
  getAccount(): WalletAccount | null {
    return this.currentAccount;
  }

  /**
   * Get current address
   */
  getAddress(): string | null {
    return this.currentAccount?.address || null;
  }

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return this.currentAccount !== null;
  }

  /**
   * Get provider for advanced usage
   */
  getProvider(): JsonRpcProvider {
    return this.provider;
  }

  /**
   * Subscribe to events
   */
  on<E extends WalletEvent>(
    event: E,
    listener: (payload: WalletEventPayload[E]) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * Unsubscribe from events
   */
  off<E extends WalletEvent>(
    event: E,
    listener: (payload: WalletEventPayload[E]) => void
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emit event
   */
  private emit<E extends WalletEvent>(event: E, payload: WalletEventPayload[E]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => listener(payload));
    }
  }

  /**
   * Delete wallet permanently
   */
  async deleteWallet(): Promise<void> {
    if (!this.currentAccount) {
      throw new Error('No wallet connected');
    }

    const credentialId = this.currentAccount.credentialId;
    await this.keyManager.deleteWallet(credentialId);

    this.disconnect();

    console.log('[WalletSDK] Wallet deleted permanently');
  }
}
