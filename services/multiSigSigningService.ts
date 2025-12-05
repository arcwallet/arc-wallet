/**
 * Multi-Sig Passkey Signing Service
 * Handles passkey-based signing for multi-sig transaction approval
 */

import { createAuthenticationCredential } from '../utils/webauthn';
import { passkeyClient } from './passkeyClient';

const API_BASE = (import.meta as any).env.VITE_PASSKEY_API_URL || 'https://arcwallet-backend.onrender.com';

export interface SignatureData {
  signature: string;
  authenticatorData: string;
  clientDataJSON: string;
  credentialId: string;
  publicKeyX: string;  // P256 public key X coordinate (required for multi-sig)
  publicKeyY: string;  // P256 public key Y coordinate (required for multi-sig)
  challengeIndex?: number;
  typeIndex?: number;
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

/**
 * Sign a userOpHash with passkey
 * Returns WebAuthn signature data for on-chain verification
 * SECURITY: Now includes public key for multi-sig aggregation
 */
export async function signWithPasskey(
  userOpHash: string,
  username?: string
): Promise<SignatureData> {
  // Start authentication to get challenge from server
  const authStart = await passkeyClient.beginAuthentication(username);

  if (!authStart.data?.options) {
    throw new Error('Failed to get authentication options');
  }

  // Override the challenge with our userOpHash
  // The server sends a random challenge, but we need to sign the userOpHash
  const options = {
    ...authStart.data.options,
    challenge: bufferToBase64Url(hexToBytes(userOpHash)),
  };

  // Get passkey signature
  const credential = await createAuthenticationCredential(options);

  // Get public key from stored passkey data
  // This is needed for multi-sig aggregation on contract
  const storedPasskey = await getStoredPasskeyPublicKey(credential.id);

  // Find challenge and type indices in clientDataJSON
  const clientDataStr = base64UrlToString(credential.response.clientDataJSON);
  const challengeIndex = clientDataStr.indexOf('"challenge"');
  const typeIndex = clientDataStr.indexOf('"type"');

  return {
    signature: credential.response.signature,
    authenticatorData: credential.response.authenticatorData,
    clientDataJSON: credential.response.clientDataJSON,
    credentialId: credential.id,
    publicKeyX: storedPasskey?.publicKeyX || '0',
    publicKeyY: storedPasskey?.publicKeyY || '0',
    challengeIndex: challengeIndex >= 0 ? challengeIndex : 0,
    typeIndex: typeIndex >= 0 ? typeIndex : 0,
  };
}

/**
 * Prepare transaction for multi-sig execution
 * Gets userOpHash from backend for signing
 */
export async function prepareMultiSigTransaction(
  transactionId: string
): Promise<PreparedUserOp> {
  const response = await fetch(`${API_BASE}/multisig/transactions/${transactionId}/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Failed to prepare transaction');
  }

  return result.data.userOp;
}

/**
 * Submit signature for multi-sig transaction
 * SECURITY: Now sends publicKeyX/Y for on-chain aggregation
 */
export async function submitMultiSigSignature(
  transactionId: string,
  signatureData: SignatureData,
  userId: string
): Promise<{ approvalCount: number; requiredSignatures: number; readyToExecute: boolean }> {
  const response = await fetch(`${API_BASE}/multisig/transactions/${transactionId}/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      userId,
      signature: signatureData.signature,
      authenticatorData: signatureData.authenticatorData,
      clientDataJSON: signatureData.clientDataJSON,
      credentialId: signatureData.credentialId,
      // SECURITY: Include public key for multi-sig aggregation
      publicKeyX: signatureData.publicKeyX,
      publicKeyY: signatureData.publicKeyY,
      challengeIndex: signatureData.challengeIndex,
      typeIndex: signatureData.typeIndex,
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Failed to submit signature');
  }

  return result.data;
}

/**
 * Execute multi-sig transaction with collected signatures
 */
export async function executeMultiSigTransaction(
  transactionId: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const response = await fetch(`${API_BASE}/multisig/transactions/${transactionId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Execution failed');
  }

  return result.data;
}

/**
 * Full approve flow: sign and submit in one call
 */
export async function approveWithPasskey(
  transactionId: string,
  userId: string,
  username?: string
): Promise<{ approvalCount: number; requiredSignatures: number; readyToExecute: boolean }> {
  // 1. Prepare transaction to get userOpHash
  const preparedOp = await prepareMultiSigTransaction(transactionId);

  // 2. Sign with passkey
  const signatureData = await signWithPasskey(preparedOp.userOpHash, username);

  // 3. Submit signature
  return submitMultiSigSignature(transactionId, signatureData, userId);
}

// Utility functions
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bufferToBase64Url(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToString(base64url: string): string {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = base64 + (pad ? '='.repeat(4 - pad) : '');
  return atob(padded);
}

/**
 * Get stored passkey public key from localStorage
 * The public key is stored during passkey registration
 */
async function getStoredPasskeyPublicKey(credentialId: string): Promise<{ publicKeyX: string; publicKeyY: string } | null> {
  try {
    // Try to get from localStorage (stored during registration)
    const storedPasskeys = localStorage.getItem('arcwallet_passkeys');
    if (storedPasskeys) {
      const passkeys = JSON.parse(storedPasskeys);
      const passkey = passkeys.find((p: any) => p.credentialId === credentialId);
      if (passkey?.publicKeyX && passkey?.publicKeyY) {
        return {
          publicKeyX: passkey.publicKeyX,
          publicKeyY: passkey.publicKeyY,
        };
      }
    }

    // Try to fetch from backend
    const response = await fetch(`${API_BASE}/passkey/credential/${credentialId}`, {
      credentials: 'include',
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data?.publicKeyX) {
        return {
          publicKeyX: result.data.publicKeyX,
          publicKeyY: result.data.publicKeyY,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to get stored passkey public key:', error);
    return null;
  }
}

export const multiSigSigningService = {
  signWithPasskey,
  prepareMultiSigTransaction,
  submitMultiSigSignature,
  executeMultiSigTransaction,
  approveWithPasskey,
};

export default multiSigSigningService;
