/**
 * PasskeyAccountManager - Manages Passkey-based Smart Contract Wallets
 *
 * Architecture:
 * - Passkey (P256) IS the signing key
 * - No separate private key stored anywhere
 * - Smart contract verifies P256 signatures on-chain
 */

import { Contract, JsonRpcProvider, AbiCoder, keccak256 } from 'ethers';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import { logger } from '../utils/logger';

// Browser-compatible Buffer alternatives
const uint8ArrayToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
};

const hexToUint8Array = (hex: string): Uint8Array => {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
};

const uint8ArrayToUtf8 = (bytes: Uint8Array): string => {
  return new TextDecoder().decode(bytes);
};

// Contract ABIs
const FACTORY_ABI = [
  'function getAddress(uint256 x, uint256 y, uint256 salt) view returns (address)',
  'function createAccount(uint256 x, uint256 y, uint256 salt) returns (address)',
];

const ACCOUNT_ABI = [
  'function execute(address target, uint256 value, bytes data) returns (bytes)',
  'function executeBatch(address[] dest, uint256[] value, bytes[] func)',
  'function validateUserOp(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash, uint256 missingFunds) returns (uint256)',
  'function getUserOpNonce() view returns (uint256)',
  'function getOwnerPublicKey() view returns (uint256 x, uint256 y)',
];

export interface PasskeyAccountConfig {
  factoryAddress: string;
  entryPointAddress: string;
  rpcUrl: string;
  bundlerUrl?: string; // Pimlico bundler URL (optional, falls back to rpcUrl)
  backendUrl: string;
  rpId: string;
  rpName: string;
  chainId?: number; // Chain ID (default: 5042002 for Arc Testnet)
}

export interface PasskeyCredential {
  credentialId: string;
  publicKeyX: string; // hex string
  publicKeyY: string; // hex string
  userId: string;
}

export interface UserOperation {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FactoryContract = Contract & {
  getAddress: (x: bigint, y: bigint, salt: bigint) => Promise<string>;
  createAccount: (x: bigint, y: bigint, salt: bigint) => Promise<string>;
};

export class PasskeyAccountManager {
  private provider: JsonRpcProvider;
  private factory: FactoryContract;
  private config: PasskeyAccountConfig;
  private currentCredential: PasskeyCredential | null = null;
  private accountAddress: string | null = null;

  constructor(config: PasskeyAccountConfig) {
    this.config = config;
    this.provider = new JsonRpcProvider(config.rpcUrl);
    this.factory = new Contract(config.factoryAddress, FACTORY_ABI, this.provider) as FactoryContract;
  }

  /**
   * Create new passkey and get account address
   */
  async createAccount(userId: string, userName: string): Promise<{ address: string; credential: PasskeyCredential }> {
    logger.info('Creating passkey account', { component: 'PasskeyAccountManager', userId });

    // 1. Get registration options from backend
    const optionsResponse = await fetch(`${this.config.backendUrl}/passkeys/register/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username: userId, displayName: userName }),
    });

    const responseData = await optionsResponse.json();

    // Check for specific error codes from backend
    if (!optionsResponse.ok) {
      // Handle "passkey already exists" error specifically
      if (responseData.code === 'PASSKEY_ALREADY_EXISTS') {
        throw new Error('You already have a passkey registered for this email. Please use "Connect with Passkey" instead of creating a new one. Creating a new passkey would generate a different wallet address.');
      }
      throw new Error(responseData.error || responseData.message || 'Failed to get registration options');
    }
    const options: PublicKeyCredentialCreationOptionsJSON = responseData.data?.options || responseData;

    // 2. Create credential using WebAuthn
    const credential: RegistrationResponseJSON = await startRegistration({ optionsJSON: options });

    // 3. Verify with backend and get public key
    const verifyResponse = await fetch(`${this.config.backendUrl}/passkeys/register/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username: userId, credential }),
    });

    if (!verifyResponse.ok) {
      throw new Error('Failed to verify credential');
    }

    const verifyData = await verifyResponse.json();

    // 4. Get P256 public key coordinates from backend response
    // Backend extracts these from COSE using proper CBOR library
    const publicKey = verifyData.data?.publicKey;
    if (!publicKey?.x || !publicKey?.y) {
      throw new Error('Server did not return public key coordinates');
    }

    const { x, y } = publicKey;

    const passkeyCredential: PasskeyCredential = {
      credentialId: credential.id,
      publicKeyX: x,
      publicKeyY: y,
      userId,
    };

    // 5. Get counterfactual account address
    // Note: Use getFunction() because Ethers v6 Contract has its own getAddress() method from Addressable interface
    const salt = BigInt(keccak256(new TextEncoder().encode(userId)));
    const getAddressFunc = this.factory.getFunction('getAddress');
    const accountAddress = await getAddressFunc(BigInt(x), BigInt(y), salt);

    this.currentCredential = passkeyCredential;
    this.accountAddress = accountAddress;

    // Store credential locally (just the ID and public key, no private data)
    this.storeCredential(passkeyCredential);

    logger.info('Passkey account created', {
      component: 'PasskeyAccountManager',
      address: accountAddress,
      credentialId: credential.id.substring(0, 20) + '...'
    });

    return { address: accountAddress, credential: passkeyCredential };
  }

  /**
   * Connect with existing passkey
   * @param username Optional username/email to find specific credentials
   */
  async connect(username?: string): Promise<{ address: string; credential: PasskeyCredential }> {
    logger.info('Connecting with existing passkey', { component: 'PasskeyAccountManager', username });

    // Check if we have a stored credential ID in localStorage
    // This helps when passkey wasn't created as "discoverable" (resident key)
    const storedCredentialId = localStorage.getItem('arcwallet:passkey:current');

    // 1. Get authentication options from backend
    // If we have a stored credential, send it to get specific allowCredentials
    // Otherwise send username if provided, or empty for discoverable credentials
    const requestBody: { username?: string; credentialId?: string } = {};
    if (storedCredentialId) {
      requestBody.credentialId = storedCredentialId;
      logger.info('Using stored credential ID for authentication', {
        component: 'PasskeyAccountManager',
        credentialId: storedCredentialId.substring(0, 20) + '...'
      });
    } else if (username) {
      requestBody.username = username;
    }

    const optionsResponse = await fetch(`${this.config.backendUrl}/passkeys/auth/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(requestBody),
    });

    if (!optionsResponse.ok) {
      throw new Error('Failed to get authentication options');
    }

    const responseData = await optionsResponse.json();
    const options: PublicKeyCredentialRequestOptionsJSON = responseData.data?.options || responseData;

    // If we have a stored credential ID, add it to allowCredentials
    // This helps Google Password Manager and other authenticators find the right passkey
    if (storedCredentialId && (!options.allowCredentials || options.allowCredentials.length === 0)) {
      options.allowCredentials = [{
        id: storedCredentialId,
        type: 'public-key',
        transports: ['internal', 'hybrid'] as AuthenticatorTransport[],
      }];
      logger.info('Added stored credential to allowCredentials', {
        component: 'PasskeyAccountManager',
        credentialId: storedCredentialId.substring(0, 20) + '...'
      });
    }

    // 2. Authenticate with WebAuthn
    const credential: AuthenticationResponseJSON = await startAuthentication({ optionsJSON: options });

    // 3. Try to verify with backend, but fallback to localStorage if server doesn't have credential
    let verifyData: any = null;
    try {
      const verifyResponse = await fetch(`${this.config.backendUrl}/passkeys/auth/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential }),
      });

      if (verifyResponse.ok) {
        verifyData = await verifyResponse.json();
      } else {
        logger.warn('Backend verification failed, will try localStorage fallback', {
          component: 'PasskeyAccountManager',
          status: verifyResponse.status
        });
      }
    } catch (e) {
      logger.warn('Backend verification request failed, will try localStorage fallback', {
        component: 'PasskeyAccountManager'
      });
    }

    // 4. Get public key - prefer backend response, fallback to localStorage
    const publicKey = verifyData?.data?.publicKey;
    const userId = verifyData?.data?.user?.username || verifyData?.data?.user?.id;

    if (publicKey?.x && publicKey?.y) {
      // Use public key from backend
      const passkeyCredential: PasskeyCredential = {
        credentialId: credential.id,
        publicKeyX: publicKey.x,
        publicKeyY: publicKey.y,
        userId,
      };
      this.currentCredential = passkeyCredential;
      // Update local storage with fresh data from backend
      this.storeCredential(passkeyCredential);
    } else {
      // Fallback to local storage - this allows recovery when server doesn't have credential
      const storedCredential = this.loadCredential(credential.id);
      if (!storedCredential) {
        throw new Error('Credential not found in server or localStorage. Please create a new passkey.');
      }
      logger.info('Using localStorage credential (server did not have it)', {
        component: 'PasskeyAccountManager',
        credentialId: credential.id.substring(0, 20) + '...'
      });
      this.currentCredential = storedCredential;

      // Try to sync credential to backend for future protection
      // This is a best-effort operation - don't fail if it doesn't work
      this.syncCredentialToBackend(storedCredential).catch(err => {
        logger.warn('Failed to sync credential to backend (non-critical)', {
          component: 'PasskeyAccountManager',
          error: err.message
        });
      });
    }

    // 5. Get account address
    // Note: Use getFunction() because Ethers v6 Contract has its own getAddress() method from Addressable interface
    const salt = BigInt(keccak256(new TextEncoder().encode(this.currentCredential.userId)));
    const getAddressFunc = this.factory.getFunction('getAddress');
    this.accountAddress = await getAddressFunc(
      BigInt(this.currentCredential.publicKeyX),
      BigInt(this.currentCredential.publicKeyY),
      salt
    );

    logger.info('Connected with passkey', {
      component: 'PasskeyAccountManager',
      address: this.accountAddress
    });

    return { address: this.accountAddress!, credential: this.currentCredential! };
  }

  /**
   * Sign UserOperation with passkey
   */
  async signUserOperation(_userOp: Omit<UserOperation, 'signature'>, userOpHash: string): Promise<string> {
    if (!this.currentCredential) {
      throw new Error('No passkey connected. Please connect first.');
    }

    logger.info('Signing UserOperation with passkey', { component: 'PasskeyAccountManager' });

    // 1. Get authentication options (with userOpHash as challenge)
    const optionsResponse = await fetch(`${this.config.backendUrl}/passkeys/auth/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        credentialId: this.currentCredential.credentialId,
        challenge: userOpHash // Use userOpHash as challenge
      }),
    });

    if (!optionsResponse.ok) {
      throw new Error('Failed to get signing options');
    }

    const responseData = await optionsResponse.json();
    const options: PublicKeyCredentialRequestOptionsJSON = responseData.data?.options || responseData;

    // Override challenge with userOpHash (base64url encoded)
    options.challenge = this.toBase64Url(userOpHash);

    // 2. Sign with WebAuthn
    const authResponse: AuthenticationResponseJSON = await startAuthentication({ optionsJSON: options });

    // 3. Extract signature components
    const { r, s, authenticatorData, clientDataJSON, challengeIndex, typeIndex } =
      await this.extractSignatureComponents(authResponse);

    // 4. Encode signature for smart contract
    const abiCoder = AbiCoder.defaultAbiCoder();
    const signature = abiCoder.encode(
      ['bytes', 'string', 'uint256', 'uint256', 'uint256', 'uint256'],
      [authenticatorData, clientDataJSON, challengeIndex, typeIndex, r, s]
    );

    logger.info('UserOperation signed', { component: 'PasskeyAccountManager' });

    return signature;
  }

  /**
   * Get current account address
   */
  getAccountAddress(): string | null {
    return this.accountAddress;
  }

  /**
   * Get current credential
   */
  getCurrentCredential(): PasskeyCredential | null {
    return this.currentCredential;
  }

  /**
   * Restore state from a stored credential (without WebAuthn interaction)
   * Use this when restoring from localStorage
   */
  async restoreFromCredential(credential: PasskeyCredential): Promise<string> {
    const { keccak256 } = await import('ethers');

    this.currentCredential = credential;

    // Calculate account address from credential
    const salt = BigInt(keccak256(new TextEncoder().encode(credential.userId)));
    const getAddressFunc = this.factory.getFunction('getAddress');
    this.accountAddress = await getAddressFunc(
      BigInt(credential.publicKeyX),
      BigInt(credential.publicKeyY),
      salt
    );

    logger.info('Restored from credential', {
      component: 'PasskeyAccountManager',
      address: this.accountAddress
    });

    return this.accountAddress!;
  }

  /**
   * Check if account is deployed
   */
  async isAccountDeployed(): Promise<boolean> {
    if (!this.accountAddress) return false;
    const code = await this.provider.getCode(this.accountAddress);
    return code !== '0x';
  }

  /**
   * Get account nonce from EntryPoint
   * IMPORTANT: Nonce must be retrieved from EntryPoint, not from smart wallet
   * Each EntryPoint tracks nonces independently
   */
  async getAccountNonce(): Promise<bigint> {
    if (!this.accountAddress) throw new Error('No account connected');

    // Get nonce from EntryPoint using getNonce(address sender, uint192 key)
    // key = 0 for default nonce sequence
    const ENTRY_POINT_ABI = [
      'function getNonce(address sender, uint192 key) view returns (uint256)',
    ];
    const entryPoint = new Contract(this.config.entryPointAddress, ENTRY_POINT_ABI, this.provider);

    try {
      const nonce = await entryPoint.getNonce(this.accountAddress, 0);
      logger.info('Got nonce from EntryPoint', {
        component: 'PasskeyAccountManager',
        nonce: nonce.toString(),
        entryPoint: this.config.entryPointAddress,
      });
      return nonce;
    } catch (error) {
      // Fallback to 0 if EntryPoint call fails (e.g., not deployed yet)
      logger.warn('Failed to get nonce from EntryPoint, using 0', {
        component: 'PasskeyAccountManager',
      });
      return 0n;
    }
  }

  /**
   * Build init code for account deployment
   */
  getInitCode(): string {
    if (!this.currentCredential) throw new Error('No credential connected');

    const salt = BigInt(keccak256(new TextEncoder().encode(this.currentCredential.userId)));
    const createAccountData = this.factory.interface.encodeFunctionData('createAccount', [
      BigInt(this.currentCredential.publicKeyX),
      BigInt(this.currentCredential.publicKeyY),
      salt
    ]);

    return this.config.factoryAddress + createAccountData.slice(2);
  }

  /**
   * Execute a transaction via the smart account
   * This handles the full ERC-4337 UserOperation flow:
   * 1. Build UserOperation with callData
   * 2. Get gas estimates
   * 3. Sign with passkey
   * 4. Submit to bundler/RPC
   */
  async executeTransaction(
    to: string,
    value: bigint,
    data: string = '0x'
  ): Promise<{ hash: string; userOpHash?: string }> {
    if (!this.accountAddress) {
      throw new Error('No account connected. Please connect first.');
    }

    logger.info('Executing transaction via passkey account', {
      component: 'PasskeyAccountManager',
      to,
      value: value.toString()
    });

    // Check if account is deployed
    const isDeployed = await this.isAccountDeployed();

    // Build callData for the execute function
    const accountInterface = new Contract(this.accountAddress, ACCOUNT_ABI, this.provider).interface;
    const callData = accountInterface.encodeFunctionData('execute', [to, value, data]);

    // Get current gas prices
    const feeData = await this.provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice || 1000000000n;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || 100000000n;

    // Get nonce
    const nonce = await this.getAccountNonce();

    // Get gas estimates from bundler (if available) or use defaults
    // Account deployment + P256 verification requires significant gas
    const initCode = isDeployed ? '0x' : this.getInitCode();
    let gasEstimates = {
      preVerificationGas: 100000n,
      // Deployment needs ~1.4M for initCode + ~300K for P256 verify
      // EntryPoint reserves ~10%, so we need more buffer
      verificationGasLimit: isDeployed ? 500000n : 3000000n,
      // callGasLimit is for the actual execution AFTER verification
      // For deployment + transfer, we need enough for both
      callGasLimit: isDeployed ? 500000n : 1000000n,
    };

    // Try to get better estimates from bundler
    try {
      const bundlerUrl = this.config.bundlerUrl || this.config.rpcUrl;
      const estimateResponse = await fetch(bundlerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_estimateUserOperationGas',
          params: [{
            sender: this.accountAddress,
            nonce: '0x' + nonce.toString(16),
            initCode,
            callData,
            paymasterAndData: '0x',
          }, this.config.entryPointAddress],
          id: Date.now(),
        }),
      });
      const estimateResult = await estimateResponse.json();
      if (estimateResult.result) {
        gasEstimates = {
          preVerificationGas: BigInt(estimateResult.result.preVerificationGas),
          verificationGasLimit: BigInt(estimateResult.result.verificationGasLimit),
          callGasLimit: BigInt(estimateResult.result.callGasLimit),
        };
        logger.info('Got gas estimates from bundler', {
          component: 'PasskeyAccountManager',
          estimates: estimateResult.result,
        });
      }
    } catch (e) {
      logger.warn('Could not get gas estimates from bundler, using defaults', {
        component: 'PasskeyAccountManager',
      });
    }

    // Build UserOperation (without signature - will be added after signing)
    const userOp = {
      sender: this.accountAddress,
      nonce,
      initCode,
      callData,
      ...gasEstimates,
      maxFeePerGas,
      maxPriorityFeePerGas,
      paymasterAndData: '0x', // No paymaster for now
    };

    // Calculate userOpHash
    const userOpHash = this.calculateUserOpHash(userOp);

    // Sign with passkey
    const signature = await this.signUserOperation(userOp, userOpHash);

    // Create signed UserOperation
    const signedUserOp = { ...userOp, signature };

    // Try to submit via bundler (eth_sendUserOperation)
    try {
      const result = await this.submitUserOperation(signedUserOp);
      return { hash: result.hash, userOpHash: result.userOpHash };
    } catch (bundlerError: any) {
      logger.error('Bundler submission failed', bundlerError instanceof Error ? bundlerError : undefined, {
        component: 'PasskeyAccountManager',
        error: bundlerError?.message || 'Unknown error'
      });

      // Re-throw the actual error from bundler for better debugging
      const errorMessage = bundlerError?.message || 'Bundler submission failed';
      throw new Error(`Transaction failed: ${errorMessage}`);
    }
  }

  /**
   * Execute multiple transactions in a single UserOperation (batch)
   * This allows approve + transfer in one passkey signature
   */
  async executeBatchTransaction(
    transactions: Array<{ to: string; value: bigint; data: string }>
  ): Promise<{ hash: string; userOpHash?: string }> {
    if (!this.accountAddress) {
      throw new Error('No account connected. Please connect first.');
    }

    if (transactions.length === 0) {
      throw new Error('No transactions provided');
    }

    logger.info('Executing batch transaction via passkey account', {
      component: 'PasskeyAccountManager',
      count: transactions.length,
    });

    // Check if account is deployed
    const isDeployed = await this.isAccountDeployed();

    // Build callData for the executeBatch function
    const accountInterface = new Contract(this.accountAddress, ACCOUNT_ABI, this.provider).interface;
    const destinations = transactions.map(tx => tx.to);
    const values = transactions.map(tx => tx.value);
    const datas = transactions.map(tx => tx.data);
    const callData = accountInterface.encodeFunctionData('executeBatch', [destinations, values, datas]);

    // Get current gas prices
    const feeData = await this.provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice || 1000000000n;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || 100000000n;

    // Get nonce
    const nonce = await this.getAccountNonce();

    // Get gas estimates - batch needs more gas
    const initCode = isDeployed ? '0x' : this.getInitCode();
    let gasEstimates = {
      preVerificationGas: 150000n,
      verificationGasLimit: isDeployed ? 500000n : 3000000n,
      // More gas for batch execution
      callGasLimit: isDeployed ? 800000n : 1500000n,
    };

    // Try to get better estimates from bundler
    try {
      const bundlerUrl = this.config.bundlerUrl || this.config.rpcUrl;
      const estimateResponse = await fetch(bundlerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_estimateUserOperationGas',
          params: [{
            sender: this.accountAddress,
            nonce: '0x' + nonce.toString(16),
            initCode,
            callData,
            paymasterAndData: '0x',
          }, this.config.entryPointAddress],
          id: Date.now(),
        }),
      });
      const estimateResult = await estimateResponse.json();
      if (estimateResult.result) {
        gasEstimates = {
          preVerificationGas: BigInt(estimateResult.result.preVerificationGas),
          verificationGasLimit: BigInt(estimateResult.result.verificationGasLimit),
          callGasLimit: BigInt(estimateResult.result.callGasLimit),
        };
        logger.info('Got batch gas estimates from bundler', {
          component: 'PasskeyAccountManager',
          estimates: estimateResult.result,
        });
      }
    } catch (e) {
      logger.warn('Could not get batch gas estimates from bundler, using defaults', {
        component: 'PasskeyAccountManager',
      });
    }

    // Build UserOperation
    const userOp = {
      sender: this.accountAddress,
      nonce,
      initCode,
      callData,
      ...gasEstimates,
      maxFeePerGas,
      maxPriorityFeePerGas,
      paymasterAndData: '0x',
    };

    // Calculate userOpHash
    const userOpHash = this.calculateUserOpHash(userOp);

    // Sign with passkey
    const signature = await this.signUserOperation(userOp, userOpHash);

    // Create signed UserOperation
    const signedUserOp = { ...userOp, signature };

    // Submit via bundler
    try {
      const result = await this.submitUserOperation(signedUserOp);
      return { hash: result.hash, userOpHash: result.userOpHash };
    } catch (bundlerError: any) {
      logger.error('Batch bundler submission failed', bundlerError instanceof Error ? bundlerError : undefined, {
        component: 'PasskeyAccountManager',
        error: bundlerError?.message || 'Unknown error'
      });
      const errorMessage = bundlerError?.message || 'Bundler submission failed';
      throw new Error(`Batch transaction failed: ${errorMessage}`);
    }
  }

  /**
   * Calculate UserOperation hash for signing
   */
  private calculateUserOpHash(userOp: Omit<UserOperation, 'signature'>): string {
    const abiCoder = AbiCoder.defaultAbiCoder();

    // Pack UserOperation (without signature)
    const packed = abiCoder.encode(
      ['address', 'uint256', 'bytes32', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes32'],
      [
        userOp.sender,
        userOp.nonce,
        keccak256(userOp.initCode),
        keccak256(userOp.callData),
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        keccak256(userOp.paymasterAndData),
      ]
    );

    const userOpHashInner = keccak256(packed);

    // Final hash includes entryPoint and chainId
    const chainId = BigInt(this.config.chainId || 5042002); // Default to Arc Testnet
    const finalPacked = abiCoder.encode(
      ['bytes32', 'address', 'uint256'],
      [userOpHashInner, this.config.entryPointAddress, chainId]
    );

    return keccak256(finalPacked);
  }

  /**
   * Submit UserOperation to Pimlico bundler
   */
  private async submitUserOperation(userOp: UserOperation): Promise<{ hash: string; userOpHash: string }> {
    // Use bundlerUrl if provided, otherwise fall back to rpcUrl
    const bundlerUrl = this.config.bundlerUrl || this.config.rpcUrl;

    // Format UserOperation for JSON-RPC
    const userOpForRpc = {
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

    logger.info('Submitting UserOperation to bundler', {
      component: 'PasskeyAccountManager',
      bundlerUrl: bundlerUrl.replace(/apikey=.*/, 'apikey=***'),
      sender: userOp.sender,
    });

    try {
      // Send to Pimlico bundler
      const response = await fetch(bundlerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_sendUserOperation',
          params: [userOpForRpc, this.config.entryPointAddress],
          id: Date.now(),
        }),
      });

      const result = await response.json();

      if (result.error) {
        const errorDetail = result.error.data
          ? `${result.error.message}: ${result.error.data}`
          : result.error.message;
        logger.error('Bundler rejected UserOperation', undefined, {
          component: 'PasskeyAccountManager',
          error: result.error,
          errorCode: result.error.code,
          errorData: result.error.data,
        });
        throw new Error(errorDetail || 'Bundler rejected UserOperation');
      }

      const userOpHash = result.result;
      logger.info('UserOperation submitted successfully', {
        component: 'PasskeyAccountManager',
        userOpHash,
      });

      // Wait for transaction to be mined
      const txHash = await this.waitForUserOperation(userOpHash, bundlerUrl);

      return { hash: txHash, userOpHash };
    } catch (error) {
      logger.error('Failed to submit UserOperation', error instanceof Error ? error : undefined, {
        component: 'PasskeyAccountManager',
      });
      throw error;
    }
  }

  /**
   * Wait for UserOperation to be included in a transaction
   */
  private async waitForUserOperation(userOpHash: string, bundlerUrl?: string, timeout: number = 120000): Promise<string> {
    const url = bundlerUrl || this.config.bundlerUrl || this.config.rpcUrl;
    const startTime = Date.now();
    let pollInterval = 5000; // Start with 5 seconds
    const maxPollInterval = 15000; // Max 15 seconds between polls

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getUserOperationReceipt',
            params: [userOpHash],
            id: Date.now(),
          }),
        });

        // Handle rate limiting with exponential backoff
        if (response.status === 429) {
          pollInterval = Math.min(pollInterval * 1.5, maxPollInterval);
          logger.warn('Rate limited, backing off', {
            component: 'PasskeyAccountManager',
            nextPollIn: pollInterval,
          });
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }

        const result = await response.json();

        if (result.result?.receipt?.transactionHash) {
          logger.info('UserOperation confirmed', {
            component: 'PasskeyAccountManager',
            txHash: result.result.receipt.transactionHash,
          });
          return result.result.receipt.transactionHash;
        }
      } catch {
        // Continue polling
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // If timeout, return userOpHash as hash (transaction may still be pending)
    logger.warn('UserOperation polling timeout, returning userOpHash', {
      component: 'PasskeyAccountManager',
      userOpHash,
    });
    return userOpHash;
  }

  // ============ Private Methods ============

  private async extractSignatureComponents(auth: AuthenticationResponseJSON): Promise<{
    r: bigint;
    s: bigint;
    authenticatorData: string;
    clientDataJSON: string;
    challengeIndex: number;
    typeIndex: number;
  }> {
    const authenticatorData = '0x' + uint8ArrayToHex(this.fromBase64Url(auth.response.authenticatorData));
    const clientDataJSON = uint8ArrayToUtf8(this.fromBase64Url(auth.response.clientDataJSON));

    // Find indices in clientDataJSON
    const challengeIndex = clientDataJSON.indexOf('"challenge"');
    const typeIndex = clientDataJSON.indexOf('"type"');

    // Parse DER signature to get r and s
    const signature = this.fromBase64Url(auth.response.signature);
    const { r, s } = this.parseDERSignature(signature);

    return {
      r: BigInt('0x' + uint8ArrayToHex(r)),
      s: BigInt('0x' + uint8ArrayToHex(s)),
      authenticatorData,
      clientDataJSON,
      challengeIndex,
      typeIndex,
    };
  }

  private parseDERSignature(signature: Uint8Array): { r: Uint8Array; s: Uint8Array } {
    // DER signature format:
    // 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]

    let offset = 0;
    if (signature[offset++] !== 0x30) throw new Error('Invalid DER signature');
    offset++; // Skip total length

    if (signature[offset++] !== 0x02) throw new Error('Invalid DER signature');
    const rLength = signature[offset++];
    const r = signature.slice(offset, offset + rLength);
    offset += rLength;

    if (signature[offset++] !== 0x02) throw new Error('Invalid DER signature');
    const sLength = signature[offset++];
    const s = signature.slice(offset, offset + sLength);

    // Remove leading zeros if present (DER encoding adds them for positive numbers)
    const rNormalized = r[0] === 0 ? r.slice(1) : r;
    const sNormalized = s[0] === 0 ? s.slice(1) : s;

    // Pad to 32 bytes
    const rPadded = new Uint8Array(32);
    const sPadded = new Uint8Array(32);
    rPadded.set(rNormalized, 32 - rNormalized.length);
    sPadded.set(sNormalized, 32 - sNormalized.length);

    return { r: rPadded, s: sPadded };
  }

  private toBase64Url(hex: string): string {
    const bytes = hexToUint8Array(hex);
    // Convert to base64url
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private fromBase64Url(base64url: string): Uint8Array {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    const binary = atob(base64 + padding);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private storeCredential(credential: PasskeyCredential): void {
    const key = `arcwallet:passkey:${credential.credentialId}`;
    localStorage.setItem(key, JSON.stringify(credential));

    // Also store as the "current" credential
    localStorage.setItem('arcwallet:passkey:current', credential.credentialId);
  }

  private loadCredential(credentialId: string): PasskeyCredential | null {
    const key = `arcwallet:passkey:${credentialId}`;
    const data = localStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data);
  }

  /**
   * Sync credential to backend for future protection
   * This registers the credential in backend DB so user can't accidentally create a new passkey
   */
  private async syncCredentialToBackend(credential: PasskeyCredential): Promise<void> {
    // Calculate wallet address from credential
    const salt = BigInt(keccak256(new TextEncoder().encode(credential.userId)));
    const getAddressFunc = this.factory.getFunction('getAddress');
    const walletAddress = await getAddressFunc(
      BigInt(credential.publicKeyX),
      BigInt(credential.publicKeyY),
      salt
    );

    logger.info('Syncing credential to backend', {
      component: 'PasskeyAccountManager',
      credentialId: credential.credentialId.substring(0, 20) + '...',
      email: credential.userId
    });

    const response = await fetch(`${this.config.backendUrl}/passkeys/admin/register-credential`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        adminSecret: 'arc-admin-2024-secret', // This is the default secret
        email: credential.userId,
        credentialId: credential.credentialId,
        publicKeyX: credential.publicKeyX,
        publicKeyY: credential.publicKeyY,
        walletAddress
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to sync credential');
    }

    const result = await response.json();
    logger.info('Credential synced to backend', {
      component: 'PasskeyAccountManager',
      result: result.data?.message
    });
  }
}
