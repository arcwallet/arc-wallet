/**
 * Multi-Passkey Service
 * Manages multiple passkeys for corporate wallet recovery (2-of-3 multisig)
 *
 * Architecture:
 * - CEO, CFO, CTO each have their own passkey
 * - 2-of-3 signatures required for transactions
 * - Recovery: Any 2 passkeys can recover access
 */

import { Contract, JsonRpcProvider, keccak256 } from 'ethers';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import { logger } from './logger';

// Key roles for corporate wallet
export type KeyRole = 'primary' | 'ceo' | 'cfo' | 'cto' | 'backup';

export interface PasskeyInfo {
  keyHash: string;
  keyType: number; // 1 = ECDSA, 2 = WebAuthn
  isActive: boolean;
  addedAt: number;
  deviceName: string;
  role?: KeyRole;
  publicKeyX?: string;
  publicKeyY?: string;
}

export interface PendingOperation {
  opHash: string;
  signatureCount: number;
  requiredSignatures: number;
  createdAt: Date;
  expiresAt: Date;
  executed: boolean;
  signers: string[]; // keyHashes that have signed
}

export interface MultiPasskeyConfig {
  rpcUrl: string;
  backendUrl: string;
  rpId: string;
  rpName: string;
  chainId?: number;
}

// ArcAccount ABI for multi-key operations
const MULTI_KEY_ABI = [
  'function getSigningKeys() view returns (bytes32[] keyHashes, uint8[] keyTypes, bool[] isActive, uint40[] addedAt, string[] deviceNames)',
  'function addSigningKey(bytes32 keyHash, uint8 keyType, string deviceName)',
  'function removeSigningKey(bytes32 keyHash)',
  'function activeKeyCount() view returns (uint8)',
  'function signatureThreshold() view returns (uint8)',
  'function setSignatureThreshold(uint8 newThreshold)',
  'function isValidSigner(bytes32 keyHash) view returns (bool)',
  'function proposeOperation(bytes32 opHash, uint8 keySlot, bytes signature)',
  'function approveOperation(bytes32 opHash, uint8 keySlot, bytes signature)',
  'function canExecuteOperation(bytes32 opHash) view returns (bool)',
  'function getPendingOperation(bytes32 opHash) view returns (uint8 signatureCount, uint8 requiredSignatures, uint40 createdAt, uint40 expiresAt, bool executed)',
  'function hasKeySigned(bytes32 opHash, bytes32 keyHash) view returns (bool)',
  'function cancelOperation(bytes32 opHash)',
];

export class MultiPasskeyService {
  private provider: JsonRpcProvider;
  private config: MultiPasskeyConfig;
  private accountContract: Contract | null = null;
  private accountAddress: string | null = null;

  constructor(config: MultiPasskeyConfig) {
    this.config = config;
    this.provider = new JsonRpcProvider(config.rpcUrl);
  }

  /**
   * Connect to an existing account
   */
  connect(accountAddress: string): void {
    this.accountAddress = accountAddress;
    this.accountContract = new Contract(accountAddress, MULTI_KEY_ABI, this.provider);
    logger.info('MultiPasskeyService connected to account', {
      component: 'MultiPasskeyService',
      address: accountAddress,
    });
  }

  /**
   * Get all signing keys for the account
   */
  async getSigningKeys(): Promise<PasskeyInfo[]> {
    if (!this.accountContract) throw new Error('Not connected to account');

    try {
      const [keyHashes, keyTypes, isActive, addedAt, deviceNames] =
        await this.accountContract.getSigningKeys();

      const keys: PasskeyInfo[] = [];
      for (let i = 0; i < keyHashes.length; i++) {
        keys.push({
          keyHash: keyHashes[i],
          keyType: keyTypes[i],
          isActive: isActive[i],
          addedAt: Number(addedAt[i]),
          deviceName: deviceNames[i],
          role: this.inferRoleFromDeviceName(deviceNames[i]),
        });
      }

      return keys;
    } catch (error) {
      logger.error('Failed to get signing keys', error instanceof Error ? error : undefined, {
        component: 'MultiPasskeyService',
      });
      return [];
    }
  }

  /**
   * Get number of active keys
   */
  async getActiveKeyCount(): Promise<number> {
    if (!this.accountContract) throw new Error('Not connected to account');
    const count = await this.accountContract.activeKeyCount();
    return Number(count);
  }

  /**
   * Get current signature threshold
   */
  async getSignatureThreshold(): Promise<number> {
    if (!this.accountContract) throw new Error('Not connected to account');
    const threshold = await this.accountContract.signatureThreshold();
    return Number(threshold);
  }

  /**
   * Register a new passkey for this account
   * @param userId Email or identifier of the key owner
   * @param deviceName Human-readable name (e.g., "CEO's MacBook")
   * @param role Role of this passkey (ceo, cfo, cto, backup)
   */
  async registerNewPasskey(
    userId: string,
    deviceName: string,
    role: KeyRole
  ): Promise<{ keyHash: string; publicKeyX: string; publicKeyY: string }> {
    logger.info('Registering new passkey for multi-sig', {
      component: 'MultiPasskeyService',
      userId,
      role,
    });

    // 1. Get registration options from backend
    const optionsResponse = await fetch(`${this.config.backendUrl}/passkeys/register/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        username: `${userId}-${role}`, // Unique ID per role
        displayName: `${deviceName} (${role.toUpperCase()})`,
      }),
    });

    if (!optionsResponse.ok) {
      const error = await optionsResponse.json();
      throw new Error(error.error || 'Failed to get registration options');
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
      body: JSON.stringify({
        username: `${userId}-${role}`,
        credential,
      }),
    });

    if (!verifyResponse.ok) {
      throw new Error('Failed to verify credential');
    }

    const verifyData = await verifyResponse.json();
    const publicKey = verifyData.data?.publicKey;

    if (!publicKey?.x || !publicKey?.y) {
      throw new Error('Server did not return public key coordinates');
    }

    // 4. Calculate key hash (keccak256 of packed public key)
    const keyHash = keccak256(
      new Uint8Array([
        ...this.hexToBytes(publicKey.x),
        ...this.hexToBytes(publicKey.y),
      ])
    );

    // Store credential locally with role info
    this.storePasskeyCredential({
      credentialId: credential.id,
      publicKeyX: publicKey.x,
      publicKeyY: publicKey.y,
      keyHash,
      role,
      deviceName,
      userId,
    });

    logger.info('New passkey registered', {
      component: 'MultiPasskeyService',
      keyHash: keyHash.substring(0, 20) + '...',
      role,
    });

    return {
      keyHash,
      publicKeyX: publicKey.x,
      publicKeyY: publicKey.y,
    };
  }

  /**
   * Add a registered passkey to the smart contract
   * This requires signing a UserOp from an existing key
   */
  async addPasskeyToContract(
    keyHash: string,
    deviceName: string
  ): Promise<string> {
    if (!this.accountContract) throw new Error('Not connected to account');

    // Build calldata for addSigningKey
    const KEY_TYPE_WEBAUTHN = 2;
    const callData = this.accountContract.interface.encodeFunctionData('addSigningKey', [
      keyHash,
      KEY_TYPE_WEBAUTHN,
      deviceName,
    ]);

    logger.info('Adding passkey to contract', {
      component: 'MultiPasskeyService',
      keyHash: keyHash.substring(0, 20) + '...',
    });

    // Return the calldata - actual execution happens via UserOp
    return callData;
  }

  /**
   * Set the signature threshold (e.g., 2 for 2-of-3)
   */
  async setThreshold(newThreshold: number): Promise<string> {
    if (!this.accountContract) throw new Error('Not connected to account');

    const callData = this.accountContract.interface.encodeFunctionData('setSignatureThreshold', [
      newThreshold,
    ]);

    logger.info('Setting signature threshold', {
      component: 'MultiPasskeyService',
      threshold: newThreshold,
    });

    return callData;
  }

  /**
   * Remove a passkey from the contract
   */
  async removePasskey(keyHash: string): Promise<string> {
    if (!this.accountContract) throw new Error('Not connected to account');

    const callData = this.accountContract.interface.encodeFunctionData('removeSigningKey', [
      keyHash,
    ]);

    return callData;
  }

  /**
   * Get pending operation status
   */
  async getPendingOperation(opHash: string): Promise<PendingOperation | null> {
    if (!this.accountContract) throw new Error('Not connected to account');

    try {
      const [signatureCount, requiredSignatures, createdAt, expiresAt, executed] =
        await this.accountContract.getPendingOperation(opHash);

      if (Number(createdAt) === 0) return null;

      return {
        opHash,
        signatureCount: Number(signatureCount),
        requiredSignatures: Number(requiredSignatures),
        createdAt: new Date(Number(createdAt) * 1000),
        expiresAt: new Date(Number(expiresAt) * 1000),
        executed,
        signers: [], // Would need to query events to get this
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if operation can be executed
   */
  async canExecuteOperation(opHash: string): Promise<boolean> {
    if (!this.accountContract) throw new Error('Not connected to account');
    return await this.accountContract.canExecuteOperation(opHash);
  }

  /**
   * Check if a specific key has signed an operation
   */
  async hasKeySigned(opHash: string, keyHash: string): Promise<boolean> {
    if (!this.accountContract) throw new Error('Not connected to account');
    return await this.accountContract.hasKeySigned(opHash, keyHash);
  }

  /**
   * Get all stored passkey credentials for this account
   */
  getStoredPasskeys(): StoredPasskeyCredential[] {
    const stored = localStorage.getItem(`arcwallet:multipasskeys:${this.accountAddress}`);
    if (!stored) return [];
    return JSON.parse(stored);
  }

  // ============ Private Methods ============

  private inferRoleFromDeviceName(deviceName: string): KeyRole {
    const lower = deviceName.toLowerCase();
    if (lower.includes('ceo')) return 'ceo';
    if (lower.includes('cfo')) return 'cfo';
    if (lower.includes('cto')) return 'cto';
    if (lower.includes('backup')) return 'backup';
    return 'primary';
  }

  private storePasskeyCredential(credential: StoredPasskeyCredential): void {
    const existing = this.getStoredPasskeys();
    const updated = existing.filter(c => c.keyHash !== credential.keyHash);
    updated.push(credential);
    localStorage.setItem(
      `arcwallet:multipasskeys:${this.accountAddress}`,
      JSON.stringify(updated)
    );
  }

  private hexToBytes(hex: string): Uint8Array {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
    }
    return bytes;
  }
}

interface StoredPasskeyCredential {
  credentialId: string;
  publicKeyX: string;
  publicKeyY: string;
  keyHash: string;
  role: KeyRole;
  deviceName: string;
  userId: string;
}

// Singleton instance
let multiPasskeyServiceInstance: MultiPasskeyService | null = null;

export const getMultiPasskeyService = (config?: MultiPasskeyConfig): MultiPasskeyService => {
  if (!multiPasskeyServiceInstance && config) {
    multiPasskeyServiceInstance = new MultiPasskeyService(config);
  }
  if (!multiPasskeyServiceInstance) {
    throw new Error('MultiPasskeyService not initialized');
  }
  return multiPasskeyServiceInstance;
};

export const initMultiPasskeyService = (config: MultiPasskeyConfig): MultiPasskeyService => {
  multiPasskeyServiceInstance = new MultiPasskeyService(config);
  return multiPasskeyServiceInstance;
};
