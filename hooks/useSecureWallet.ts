/**
 * Secure Wallet Hook
 * Manages self-custodial wallet with encrypted local storage
 *
 * SECURITY: Private keys are encrypted and never leave the browser
 */

import { useState, useCallback, useEffect } from 'react';
import {
  generateWallet,
  importFromPrivateKey,
  importFromMnemonic,
  encryptWallet,
  decryptWallet,
  saveEncryptedWallet,
  loadEncryptedWallet,
  hasStoredWallet,
  deleteStoredWallet,
  isValidMnemonic,
  isValidPrivateKey,
  WalletData,
  EncryptedWallet,
} from '../services/cryptoService';

export interface SecureWalletState {
  isUnlocked: boolean;
  address: string | null;
  hasWallet: boolean;
  isLoading: boolean;
  error: string | null;
  needsBackup: boolean;
}

export interface SecureWalletActions {
  // Wallet creation
  createWallet: (password: string) => Promise<{ address: string; mnemonic: string }>;
  importWallet: (input: string, password: string) => Promise<string>;

  // Wallet access
  unlockWallet: (password: string) => Promise<string>;
  lockWallet: () => void;

  // Get private key for signing (only when unlocked)
  getPrivateKey: () => string | null;

  // Wallet management
  deleteWallet: () => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  exportBackup: () => string | null;

  // State management
  clearError: () => void;
  markBackedUp: () => void;
}

export function useSecureWallet(): [SecureWalletState, SecureWalletActions] {
  // State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsBackup, setNeedsBackup] = useState(false);

  // Check for existing wallet on mount
  useEffect(() => {
    setHasWallet(hasStoredWallet());
    setIsLoading(false);
  }, []);

  // Create new wallet
  const createWallet = useCallback(async (password: string): Promise<{ address: string; mnemonic: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      // Generate wallet on client
      const walletData = generateWallet();

      if (!walletData.mnemonic) {
        throw new Error('Failed to generate mnemonic');
      }

      // Encrypt and save
      const encrypted = await encryptWallet(walletData, password);
      saveEncryptedWallet(encrypted);

      // Update state
      setAddress(walletData.address);
      setPrivateKey(walletData.privateKey);
      setMnemonic(walletData.mnemonic);
      setIsUnlocked(true);
      setHasWallet(true);
      setNeedsBackup(true);

      return {
        address: walletData.address,
        mnemonic: walletData.mnemonic,
      };
    } catch (err: any) {
      setError(err.message || 'Failed to create wallet');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Import wallet from private key or mnemonic
  const importWallet = useCallback(async (input: string, password: string): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      let walletData: WalletData;

      // Determine input type
      const trimmedInput = input.trim();

      if (isValidMnemonic(trimmedInput)) {
        walletData = importFromMnemonic(trimmedInput);
      } else if (isValidPrivateKey(trimmedInput)) {
        walletData = importFromPrivateKey(trimmedInput);
      } else {
        throw new Error('Invalid private key or mnemonic phrase');
      }

      // Encrypt and save
      const encrypted = await encryptWallet(walletData, password);
      saveEncryptedWallet(encrypted);

      // Update state
      setAddress(walletData.address);
      setPrivateKey(walletData.privateKey);
      setMnemonic(walletData.mnemonic || null);
      setIsUnlocked(true);
      setHasWallet(true);
      setNeedsBackup(false); // Imported wallets don't need backup prompt

      return walletData.address;
    } catch (err: any) {
      setError(err.message || 'Failed to import wallet');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Unlock wallet with password
  const unlockWallet = useCallback(async (password: string): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const encrypted = loadEncryptedWallet();

      if (!encrypted) {
        throw new Error('No wallet found');
      }

      // Decrypt wallet
      const walletData = await decryptWallet(encrypted, password);

      // Update state
      setAddress(walletData.address);
      setPrivateKey(walletData.privateKey);
      setMnemonic(walletData.mnemonic || null);
      setIsUnlocked(true);

      return walletData.address;
    } catch (err: any) {
      // Clear sensitive data on failure
      setPrivateKey(null);
      setMnemonic(null);
      setIsUnlocked(false);

      if (err.name === 'OperationError') {
        setError('Incorrect password');
      } else {
        setError(err.message || 'Failed to unlock wallet');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Lock wallet (clear sensitive data from memory)
  const lockWallet = useCallback(() => {
    setPrivateKey(null);
    setMnemonic(null);
    setIsUnlocked(false);
    setError(null);
  }, []);

  // Get private key for signing (only when unlocked)
  const getPrivateKey = useCallback((): string | null => {
    if (!isUnlocked) {
      return null;
    }
    return privateKey;
  }, [isUnlocked, privateKey]);

  // Delete wallet
  const deleteWallet = useCallback(() => {
    deleteStoredWallet();
    setAddress(null);
    setPrivateKey(null);
    setMnemonic(null);
    setIsUnlocked(false);
    setHasWallet(false);
    setError(null);
  }, []);

  // Change password
  const changePassword = useCallback(async (oldPassword: string, newPassword: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const encrypted = loadEncryptedWallet();

      if (!encrypted) {
        throw new Error('No wallet found');
      }

      // Decrypt with old password
      const walletData = await decryptWallet(encrypted, oldPassword);

      // Re-encrypt with new password
      const newEncrypted = await encryptWallet(walletData, newPassword);
      saveEncryptedWallet(newEncrypted);
    } catch (err: any) {
      if (err.name === 'OperationError') {
        setError('Incorrect current password');
      } else {
        setError(err.message || 'Failed to change password');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Export encrypted backup
  const exportBackup = useCallback((): string | null => {
    const encrypted = loadEncryptedWallet();
    if (!encrypted) return null;

    return JSON.stringify({
      type: 'arc-wallet-backup',
      version: 1,
      data: encrypted,
      exportedAt: new Date().toISOString(),
    });
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Mark as backed up
  const markBackedUp = useCallback(() => {
    setNeedsBackup(false);
  }, []);

  // Return state and actions
  const state: SecureWalletState = {
    isUnlocked,
    address,
    hasWallet,
    isLoading,
    error,
    needsBackup,
  };

  const actions: SecureWalletActions = {
    createWallet,
    importWallet,
    unlockWallet,
    lockWallet,
    getPrivateKey,
    deleteWallet,
    changePassword,
    exportBackup,
    clearError,
    markBackedUp,
  };

  return [state, actions];
}

export default useSecureWallet;
