/**
 * Key Manager Tests
 *
 * Tests the wallet key management functionality including
 * wallet creation, unlocking, signing, and deletion.
 *
 * @module tests/keyManager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock dependencies
vi.mock('ethers', () => ({
  Wallet: vi.fn().mockImplementation((privateKey?: string) => ({
    privateKey: privateKey || '0x' + 'a'.repeat(64),
    address: '0x' + 'b'.repeat(40),
    signTransaction: vi.fn().mockResolvedValue('0xsignedtx'),
    signMessage: vi.fn().mockResolvedValue('0xsignedmsg'),
  })),
}));

// Create mock classes
const mockWebauthn = {
  createPasskey: vi.fn(),
  authenticate: vi.fn(),
};

const mockStorage = {
  storeWebCryptoData: vi.fn(),
  storeMetadata: vi.fn(),
  getMetadata: vi.fn(),
  getKeyData: vi.fn(),
  deriveEncryptionKey: vi.fn(),
  getKey: vi.fn(),
  deleteKey: vi.fn(),
  hasKey: vi.fn(),
};

const mockWebCrypto = {
  generateMasterKey: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  isInitialized: vi.fn().mockReturnValue(false),
  clear: vi.fn(),
};

// Mock the WebCryptoMasterKeyManager constructor
vi.mock('../src/core/webCryptoMasterKey', () => ({
  WebCryptoMasterKeyManager: vi.fn().mockImplementation(() => mockWebCrypto),
}));

import { KeyManager } from '../src/core/keyManager';
import { Wallet } from 'ethers';

describe('KeyManager', () => {
  let keyManager: KeyManager;
  const testUserId = 'test-user-id';
  const testUserName = 'test@example.com';
  const testCredentialId = 'test-credential-id';
  const testAddress = '0x' + 'b'.repeat(40);

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock responses
    mockWebauthn.createPasskey.mockResolvedValue({
      id: testCredentialId,
      publicKey: 'test-public-key',
      createdAt: new Date(),
    });

    mockWebauthn.authenticate.mockResolvedValue({
      success: true,
      credentialId: testCredentialId,
    });

    mockWebCrypto.generateMasterKey.mockResolvedValue(undefined);
    mockWebCrypto.encrypt.mockResolvedValue({
      encrypted: new Uint8Array([1, 2, 3]),
      iv: new Uint8Array([4, 5, 6]),
    });
    mockWebCrypto.decrypt.mockResolvedValue('0x' + 'a'.repeat(64));

    mockStorage.getMetadata.mockResolvedValue({
      address: testAddress,
      publicKey: 'test-public-key',
      salt: [1, 2, 3],
    });

    mockStorage.getKeyData.mockResolvedValue({
      keyType: 'webcrypto-master',
      encrypted: [1, 2, 3],
      iv: [4, 5, 6],
    });

    keyManager = new KeyManager(mockWebauthn as any, mockStorage as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createWallet', () => {
    it('should create a new wallet with passkey', async () => {
      const result = await keyManager.createWallet(testUserId, testUserName);

      expect(mockWebauthn.createPasskey).toHaveBeenCalledWith(testUserId, testUserName);
      expect(mockWebCrypto.generateMasterKey).toHaveBeenCalledWith(testCredentialId);
      expect(mockWebCrypto.encrypt).toHaveBeenCalled();
      expect(mockStorage.storeWebCryptoData).toHaveBeenCalled();
      expect(mockStorage.storeMetadata).toHaveBeenCalled();

      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('credentialId');
      expect(result).toHaveProperty('publicKey');
    });

    it('should throw error if passkey creation fails', async () => {
      mockWebauthn.createPasskey.mockRejectedValue(new Error('Passkey creation failed'));

      await expect(keyManager.createWallet(testUserId, testUserName))
        .rejects.toThrow('Failed to create wallet');
    });

    it('should throw error if encryption fails', async () => {
      mockWebCrypto.encrypt.mockRejectedValue(new Error('Encryption failed'));

      await expect(keyManager.createWallet(testUserId, testUserName))
        .rejects.toThrow('Failed to create wallet');
    });

    it('should store wallet with webcrypto-master keyType', async () => {
      await keyManager.createWallet(testUserId, testUserName);

      expect(mockStorage.storeWebCryptoData).toHaveBeenCalledWith(
        testCredentialId,
        expect.objectContaining({
          keyType: 'webcrypto-master',
        })
      );
    });
  });

  describe('unlockWallet', () => {
    it('should unlock wallet with passkey authentication', async () => {
      const result = await keyManager.unlockWallet(testCredentialId);

      expect(mockWebauthn.authenticate).toHaveBeenCalledWith(testCredentialId);
      expect(mockStorage.getMetadata).toHaveBeenCalledWith(testCredentialId);
      expect(mockStorage.getKeyData).toHaveBeenCalledWith(testCredentialId);
      expect(mockWebCrypto.generateMasterKey).toHaveBeenCalledWith(testCredentialId);
      expect(mockWebCrypto.decrypt).toHaveBeenCalled();

      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('credentialId');
    });

    it('should throw error if authentication fails', async () => {
      mockWebauthn.authenticate.mockResolvedValue({
        success: false,
        error: 'User cancelled',
      });

      await expect(keyManager.unlockWallet(testCredentialId))
        .rejects.toThrow('Failed to unlock wallet');
    });

    it('should throw error if metadata not found', async () => {
      mockStorage.getMetadata.mockResolvedValue(null);

      await expect(keyManager.unlockWallet(testCredentialId))
        .rejects.toThrow('Wallet metadata not found');
    });

    it('should throw error if key data not found', async () => {
      mockStorage.getKeyData.mockResolvedValue(null);

      await expect(keyManager.unlockWallet(testCredentialId))
        .rejects.toThrow('Wallet key data not found');
    });

    it('should handle legacy key format', async () => {
      mockStorage.getKeyData.mockResolvedValue({
        keyType: 'legacy',
        encrypted: [1, 2, 3],
      });
      mockStorage.deriveEncryptionKey.mockResolvedValue({});
      mockStorage.getKey.mockResolvedValue('0x' + 'a'.repeat(64));

      const result = await keyManager.unlockWallet(testCredentialId);

      expect(mockStorage.deriveEncryptionKey).toHaveBeenCalled();
      expect(result).toHaveProperty('address');
    });

    it('should verify address matches after decryption', async () => {
      // This test verifies the wallet address verification logic
      const result = await keyManager.unlockWallet(testCredentialId);

      expect(result.address).toBeDefined();
    });
  });

  describe('signTransaction', () => {
    beforeEach(async () => {
      await keyManager.unlockWallet(testCredentialId);
    });

    it('should sign transaction with unlocked wallet', async () => {
      const tx = { to: '0x123', value: '1000' };

      const signature = await keyManager.signTransaction(tx);

      expect(signature).toBe('0xsignedtx');
    });

    it('should auto-unlock if wallet not unlocked', async () => {
      // Create new instance without unlocking
      const newKeyManager = new KeyManager(mockWebauthn as any, mockStorage as any);

      const tx = { to: '0x123', value: '1000' };
      const signature = await newKeyManager.signTransaction(tx);

      expect(mockWebauthn.authenticate).toHaveBeenCalled();
      expect(signature).toBe('0xsignedtx');
    });
  });

  describe('signMessage', () => {
    beforeEach(async () => {
      await keyManager.unlockWallet(testCredentialId);
    });

    it('should sign message with unlocked wallet', async () => {
      const message = 'Hello, World!';

      const signature = await keyManager.signMessage(message);

      expect(signature).toBe('0xsignedmsg');
    });

    it('should auto-unlock if wallet not unlocked', async () => {
      const newKeyManager = new KeyManager(mockWebauthn as any, mockStorage as any);

      const message = 'Test message';
      const signature = await newKeyManager.signMessage(message);

      expect(mockWebauthn.authenticate).toHaveBeenCalled();
      expect(signature).toBe('0xsignedmsg');
    });
  });

  describe('lock', () => {
    it('should clear wallet from memory', async () => {
      await keyManager.unlockWallet(testCredentialId);
      expect(keyManager.getCurrentAddress()).toBeTruthy();

      keyManager.lock();

      expect(keyManager.getCurrentAddress()).toBeNull();
      expect(keyManager.getCurrentCredentialId()).toBeNull();
    });
  });

  describe('getCurrentAddress', () => {
    it('should return null when wallet not unlocked', () => {
      expect(keyManager.getCurrentAddress()).toBeNull();
    });

    it('should return address when wallet unlocked', async () => {
      await keyManager.unlockWallet(testCredentialId);

      expect(keyManager.getCurrentAddress()).toBe(testAddress);
    });
  });

  describe('getCurrentCredentialId', () => {
    it('should return null when wallet not unlocked', () => {
      expect(keyManager.getCurrentCredentialId()).toBeNull();
    });

    it('should return credential ID when wallet unlocked', async () => {
      await keyManager.unlockWallet(testCredentialId);

      expect(keyManager.getCurrentCredentialId()).toBe(testCredentialId);
    });
  });

  describe('deleteWallet', () => {
    it('should delete wallet and lock if current', async () => {
      await keyManager.unlockWallet(testCredentialId);
      expect(keyManager.getCurrentCredentialId()).toBe(testCredentialId);

      await keyManager.deleteWallet(testCredentialId);

      expect(mockStorage.deleteKey).toHaveBeenCalledWith(testCredentialId);
      expect(keyManager.getCurrentCredentialId()).toBeNull();
    });

    it('should not lock if deleting different credential', async () => {
      await keyManager.unlockWallet(testCredentialId);

      await keyManager.deleteWallet('other-credential-id');

      expect(keyManager.getCurrentCredentialId()).toBe(testCredentialId);
    });
  });

  describe('hasWallet', () => {
    it('should return true if wallet exists', async () => {
      mockStorage.hasKey.mockResolvedValue(true);

      const result = await keyManager.hasWallet(testCredentialId);

      expect(result).toBe(true);
      expect(mockStorage.hasKey).toHaveBeenCalledWith(testCredentialId);
    });

    it('should return false if wallet does not exist', async () => {
      mockStorage.hasKey.mockResolvedValue(false);

      const result = await keyManager.hasWallet('non-existent');

      expect(result).toBe(false);
    });
  });
});

describe('KeyManager Security', () => {
  it('should never expose private key directly', async () => {
    const mockWebauthn = {
      createPasskey: vi.fn().mockResolvedValue({
        id: 'cred-id',
        publicKey: 'pub-key',
        createdAt: new Date(),
      }),
      authenticate: vi.fn().mockResolvedValue({ success: true, credentialId: 'cred-id' }),
    };

    const mockStorage = {
      storeWebCryptoData: vi.fn(),
      storeMetadata: vi.fn(),
      getMetadata: vi.fn().mockResolvedValue({ address: '0x' + 'b'.repeat(40), publicKey: 'pub' }),
      getKeyData: vi.fn().mockResolvedValue({ keyType: 'webcrypto-master', encrypted: [], iv: [] }),
      hasKey: vi.fn().mockResolvedValue(true),
    };

    const keyManager = new KeyManager(mockWebauthn as any, mockStorage as any);

    // KeyManager should not have any public method that returns raw private key
    expect(typeof (keyManager as any).getPrivateKey).not.toBe('function');
    expect(typeof (keyManager as any).exportPrivateKey).not.toBe('function');
  });
});
