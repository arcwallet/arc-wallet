/**
 * Self-Custodial Crypto Service
 * Client-side key generation, encryption, and management
 *
 * SECURITY: Private keys NEVER leave the browser
 */

import { ethers } from 'ethers';

// Constants
const STORAGE_KEY = 'arcwallet:encrypted-key';
const SALT_KEY = 'arcwallet:salt';
const PBKDF2_ITERATIONS = 100000;
const AES_ALGORITHM = 'AES-GCM';

export interface WalletData {
  address: string;
  privateKey: string;
  mnemonic?: string;
}

export interface EncryptedWallet {
  ciphertext: string;
  iv: string;
  salt: string;
  version: number;
}

/**
 * Generate a new wallet with mnemonic (seed phrase)
 * Key is generated entirely on client-side
 */
export function generateWallet(): WalletData {
  const wallet = ethers.Wallet.createRandom();

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic?.phrase,
  };
}

/**
 * Import wallet from private key
 */
export function importFromPrivateKey(privateKey: string): WalletData {
  const wallet = new ethers.Wallet(privateKey);

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

/**
 * Import wallet from mnemonic (seed phrase)
 */
export function importFromMnemonic(mnemonic: string): WalletData {
  const wallet = ethers.Wallet.fromPhrase(mnemonic);

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: mnemonic,
  };
}

/**
 * Derive encryption key from password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: AES_ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt wallet data with user password
 * Uses AES-256-GCM with PBKDF2 key derivation
 */
export async function encryptWallet(
  walletData: WalletData,
  password: string
): Promise<EncryptedWallet> {
  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derive encryption key from password
  const key = await deriveKey(password, salt);

  // Encrypt wallet data
  const encoder = new TextEncoder();
  const dataToEncrypt = encoder.encode(JSON.stringify(walletData));

  const ciphertext = await crypto.subtle.encrypt(
    { name: AES_ALGORITHM, iv: iv },
    key,
    dataToEncrypt
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt),
    version: 1,
  };
}

/**
 * Decrypt wallet data with user password
 */
export async function decryptWallet(
  encryptedWallet: EncryptedWallet,
  password: string
): Promise<WalletData> {
  const salt = base64ToArrayBuffer(encryptedWallet.salt);
  const iv = base64ToArrayBuffer(encryptedWallet.iv);
  const ciphertext = base64ToArrayBuffer(encryptedWallet.ciphertext);

  // Derive encryption key from password
  const key = await deriveKey(password, new Uint8Array(salt));

  // Decrypt wallet data
  const decrypted = await crypto.subtle.decrypt(
    { name: AES_ALGORITHM, iv: new Uint8Array(iv) },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  const jsonString = decoder.decode(decrypted);

  return JSON.parse(jsonString) as WalletData;
}

/**
 * Save encrypted wallet to localStorage
 */
export function saveEncryptedWallet(encryptedWallet: EncryptedWallet): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(encryptedWallet));
}

/**
 * Load encrypted wallet from localStorage
 */
export function loadEncryptedWallet(): EncryptedWallet | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as EncryptedWallet;
  } catch {
    return null;
  }
}

/**
 * Check if wallet exists in storage
 */
export function hasStoredWallet(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/**
 * Delete wallet from storage
 */
export function deleteStoredWallet(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SALT_KEY);
}

/**
 * Sign a message with the wallet
 */
export async function signMessage(
  privateKey: string,
  message: string
): Promise<string> {
  const wallet = new ethers.Wallet(privateKey);
  return wallet.signMessage(message);
}

/**
 * Sign a transaction with the wallet
 */
export async function signTransaction(
  privateKey: string,
  transaction: ethers.TransactionRequest
): Promise<string> {
  const wallet = new ethers.Wallet(privateKey);
  return wallet.signTransaction(transaction);
}

/**
 * Get address from private key
 */
export function getAddressFromPrivateKey(privateKey: string): string {
  const wallet = new ethers.Wallet(privateKey);
  return wallet.address;
}

/**
 * Validate mnemonic phrase
 */
export function isValidMnemonic(mnemonic: string): boolean {
  try {
    ethers.Mnemonic.fromPhrase(mnemonic);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate private key
 */
export function isValidPrivateKey(privateKey: string): boolean {
  try {
    new ethers.Wallet(privateKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a random password for auto-encryption
 * (used when passkey is available for biometric protection)
 */
export function generateSecurePassword(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return arrayBufferToBase64(array.buffer);
}

// Utility functions
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Export encrypted wallet for backup
 */
export function exportWalletBackup(encryptedWallet: EncryptedWallet): string {
  return JSON.stringify({
    type: 'arc-wallet-backup',
    version: 1,
    data: encryptedWallet,
    exportedAt: new Date().toISOString(),
  });
}

/**
 * Import wallet from backup file
 */
export function importWalletBackup(backupJson: string): EncryptedWallet {
  const backup = JSON.parse(backupJson);

  if (backup.type !== 'arc-wallet-backup') {
    throw new Error('Invalid backup file format');
  }

  return backup.data as EncryptedWallet;
}
