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
  backendUrl: string;
  rpId: string;
  rpName: string;
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

    if (!optionsResponse.ok) {
      throw new Error('Failed to get registration options');
    }

    const responseData = await optionsResponse.json();
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

    // 1. Get authentication options from backend
    // Send username if provided to get user's specific credentials
    const optionsResponse = await fetch(`${this.config.backendUrl}/passkeys/auth/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username }),
    });

    if (!optionsResponse.ok) {
      throw new Error('Failed to get authentication options');
    }

    const responseData = await optionsResponse.json();
    const options: PublicKeyCredentialRequestOptionsJSON = responseData.data?.options || responseData;

    // 2. Authenticate with WebAuthn
    const credential: AuthenticationResponseJSON = await startAuthentication({ optionsJSON: options });

    // 3. Verify with backend
    const verifyResponse = await fetch(`${this.config.backendUrl}/passkeys/auth/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ credential }),
    });

    if (!verifyResponse.ok) {
      throw new Error('Failed to verify authentication');
    }

    const verifyData = await verifyResponse.json();

    // 4. Get public key from backend response (allows reconnection even without local storage)
    const publicKey = verifyData.data?.publicKey;
    const userId = verifyData.data?.user?.username || verifyData.data?.user?.id;

    if (!publicKey?.x || !publicKey?.y) {
      // Fallback to local storage
      const storedCredential = this.loadCredential(credential.id);
      if (!storedCredential) {
        throw new Error('Credential not found. Server did not return public key coordinates.');
      }
      this.currentCredential = storedCredential;
    } else {
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
   * Check if account is deployed
   */
  async isAccountDeployed(): Promise<boolean> {
    if (!this.accountAddress) return false;
    const code = await this.provider.getCode(this.accountAddress);
    return code !== '0x';
  }

  /**
   * Get account nonce
   */
  async getAccountNonce(): Promise<bigint> {
    if (!this.accountAddress) throw new Error('No account connected');

    const isDeployed = await this.isAccountDeployed();
    if (!isDeployed) return 0n;

    const account = new Contract(this.accountAddress, ACCOUNT_ABI, this.provider);
    return await account.getUserOpNonce();
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

    // Build UserOperation (without signature - will be added after signing)
    const userOp = {
      sender: this.accountAddress,
      nonce,
      initCode: isDeployed ? '0x' : this.getInitCode(),
      callData,
      callGasLimit: 500000n, // Conservative estimate
      verificationGasLimit: isDeployed ? 150000n : 500000n, // Higher for deployment
      preVerificationGas: 50000n,
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

    // Submit UserOperation
    // Try eth_sendUserOperation first (bundler), fallback to direct execution
    try {
      const result = await this.submitUserOperation(signedUserOp);
      return { hash: result.hash, userOpHash: result.userOpHash };
    } catch (bundlerError) {
      logger.warn('Bundler submission failed, trying direct execution', {
        component: 'PasskeyAccountManager',
        error: bundlerError
      });

      // Fallback: Direct contract call (requires gas from sender)
      // This won't work for undeployed accounts without gas
      throw new Error('Transaction submission failed. Please ensure your account has gas for transactions.');
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
    const chainId = 5042002n; // Arc Testnet
    const finalPacked = abiCoder.encode(
      ['bytes32', 'address', 'uint256'],
      [userOpHashInner, this.config.entryPointAddress, chainId]
    );

    return keccak256(finalPacked);
  }

  /**
   * Submit UserOperation to bundler or RPC
   */
  private async submitUserOperation(userOp: UserOperation): Promise<{ hash: string; userOpHash: string }> {
    // Try eth_sendUserOperation (ERC-4337 bundler RPC)
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

    try {
      // Send to bundler
      const response = await fetch(this.config.rpcUrl, {
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
        throw new Error(result.error.message || 'Bundler rejected UserOperation');
      }

      const userOpHash = result.result;

      // Wait for transaction to be mined
      const txHash = await this.waitForUserOperation(userOpHash);

      return { hash: txHash, userOpHash };
    } catch (error) {
      logger.error('Failed to submit UserOperation', error instanceof Error ? error : undefined, { component: 'PasskeyAccountManager' });
      throw error;
    }
  }

  /**
   * Wait for UserOperation to be included in a transaction
   */
  private async waitForUserOperation(userOpHash: string, timeout: number = 60000): Promise<string> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(this.config.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getUserOperationReceipt',
            params: [userOpHash],
            id: Date.now(),
          }),
        });

        const result = await response.json();

        if (result.result?.receipt?.transactionHash) {
          return result.result.receipt.transactionHash;
        }
      } catch {
        // Continue polling
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // If timeout, return userOpHash as hash (transaction may still be pending)
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
}
