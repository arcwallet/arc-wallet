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

    await verifyResponse.json(); // Verify succeeded

    // 4. Extract P256 public key coordinates from credential
    const { x, y } = await this.extractPublicKeyCoordinates(credential);

    const passkeyCredential: PasskeyCredential = {
      credentialId: credential.id,
      publicKeyX: x,
      publicKeyY: y,
      userId,
    };

    // 5. Get counterfactual account address
    const salt = BigInt(keccak256(new TextEncoder().encode(userId)));
    const accountAddress = await this.factory.getAddress(BigInt(x), BigInt(y), salt);

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
   */
  async connect(): Promise<{ address: string; credential: PasskeyCredential }> {
    logger.info('Connecting with existing passkey', { component: 'PasskeyAccountManager' });

    // 1. Get authentication options from backend
    const optionsResponse = await fetch(`${this.config.backendUrl}/passkeys/auth/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
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

    await verifyResponse.json(); // Verify succeeded

    // 4. Load stored credential
    const storedCredential = this.loadCredential(credential.id);
    if (!storedCredential) {
      throw new Error('Credential not found locally. Please create a new account.');
    }

    this.currentCredential = storedCredential;

    // 5. Get account address
    const salt = BigInt(keccak256(new TextEncoder().encode(storedCredential.userId)));
    this.accountAddress = await this.factory.getAddress(
      BigInt(storedCredential.publicKeyX),
      BigInt(storedCredential.publicKeyY),
      salt
    );

    logger.info('Connected with passkey', {
      component: 'PasskeyAccountManager',
      address: this.accountAddress
    });

    return { address: this.accountAddress, credential: storedCredential };
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

  // ============ Private Methods ============

  private async extractPublicKeyCoordinates(credential: RegistrationResponseJSON): Promise<{ x: string; y: string }> {
    // Decode the attestation object to get the public key
    const attestationObject = this.fromBase64Url(credential.response.attestationObject);

    // Parse CBOR to get authData
    // For simplicity, we'll use a basic parser - in production use a proper CBOR library
    const authData = this.parseAuthenticatorData(attestationObject);

    // The public key is in COSE format in authData
    // For P-256, the x and y coordinates are 32 bytes each
    const { x, y } = this.parseCOSEPublicKey(authData.credentialPublicKey);

    return {
      x: '0x' + Buffer.from(x).toString('hex'),
      y: '0x' + Buffer.from(y).toString('hex'),
    };
  }

  private async extractSignatureComponents(auth: AuthenticationResponseJSON): Promise<{
    r: bigint;
    s: bigint;
    authenticatorData: string;
    clientDataJSON: string;
    challengeIndex: number;
    typeIndex: number;
  }> {
    const authenticatorData = '0x' + Buffer.from(this.fromBase64Url(auth.response.authenticatorData)).toString('hex');
    const clientDataJSON = Buffer.from(this.fromBase64Url(auth.response.clientDataJSON)).toString('utf8');

    // Find indices in clientDataJSON
    const challengeIndex = clientDataJSON.indexOf('"challenge"');
    const typeIndex = clientDataJSON.indexOf('"type"');

    // Parse DER signature to get r and s
    const signature = this.fromBase64Url(auth.response.signature);
    const { r, s } = this.parseDERSignature(signature);

    return {
      r: BigInt('0x' + Buffer.from(r).toString('hex')),
      s: BigInt('0x' + Buffer.from(s).toString('hex')),
      authenticatorData,
      clientDataJSON,
      challengeIndex,
      typeIndex,
    };
  }

  private parseAuthenticatorData(attestationObject: Uint8Array): { credentialPublicKey: Uint8Array } {
    // Basic CBOR parsing for attestation object
    // This is simplified - in production use a proper CBOR library

    // Find authData in the CBOR structure
    // authData starts after the format string and includes:
    // - rpIdHash (32 bytes)
    // - flags (1 byte)
    // - signCount (4 bytes)
    // - attestedCredentialData (if present)

    // For now, return a placeholder - this needs proper CBOR parsing
    // The actual implementation would decode the CBOR and extract authData

    // Simplified: look for the public key pattern in the attestation
    // Skip rpIdHash (32) + flags (1) + signCount (4) = 37 bytes
    const credIdLen = (attestationObject[53] << 8) | attestationObject[54];
    const publicKeyStart = 55 + credIdLen;

    return {
      credentialPublicKey: attestationObject.slice(publicKeyStart, publicKeyStart + 77) // COSE key is ~77 bytes for P-256
    };
  }

  private parseCOSEPublicKey(coseKey: Uint8Array): { x: Uint8Array; y: Uint8Array } {
    // COSE P-256 public key format:
    // Map with keys: 1 (kty), 3 (alg), -1 (crv), -2 (x), -3 (y)
    // x and y are 32 bytes each for P-256

    // Simplified parsing - in production use proper COSE/CBOR library
    // Look for the x and y coordinates (32 bytes each, usually after specific markers)

    // For P-256, x starts around offset 10 and y around offset 45 in typical COSE encoding
    const x = coseKey.slice(10, 42);
    const y = coseKey.slice(45, 77);

    return { x, y };
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
    const bytes = hex.startsWith('0x') ? hex.slice(2) : hex;
    const buffer = Buffer.from(bytes, 'hex');
    return buffer.toString('base64url');
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
