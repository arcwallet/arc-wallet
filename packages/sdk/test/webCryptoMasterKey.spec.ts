/**
 * WebCrypto Master Key Manager Tests
 *
 * Tests the deterministic key derivation and encryption/decryption
 * functionality used for securing wallet private keys.
 *
 * @module tests/webCryptoMasterKey
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock crypto.subtle for Node.js environment
const mockCryptoSubtle = {
  importKey: vi.fn(),
  deriveKey: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  generateKey: vi.fn(),
};

// Mock global crypto
vi.stubGlobal('crypto', {
  subtle: mockCryptoSubtle,
  getRandomValues: (arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
});

// Import after mocking
import { WebCryptoMasterKeyManager } from '../src/core/webCryptoMasterKey';

describe('WebCryptoMasterKeyManager', () => {
  let manager: WebCryptoMasterKeyManager;
  const testCredentialId = 'test-credential-id-12345';

  beforeEach(() => {
    manager = new WebCryptoMasterKeyManager();
    vi.clearAllMocks();
  });

  describe('generateMasterKey', () => {
    it('should derive key using PBKDF2 with credential ID', async () => {
      const mockKeyMaterial = { type: 'raw' };
      const mockDerivedKey = { type: 'derived' };

      mockCryptoSubtle.importKey.mockResolvedValue(mockKeyMaterial);
      mockCryptoSubtle.deriveKey.mockResolvedValue(mockDerivedKey);

      await manager.generateMasterKey(testCredentialId);

      // Verify importKey was called with credential ID
      expect(mockCryptoSubtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );

      // Verify deriveKey was called with correct parameters
      expect(mockCryptoSubtle.deriveKey).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'PBKDF2',
          iterations: 100000,
          hash: 'SHA-256',
        }),
        mockKeyMaterial,
        expect.objectContaining({
          name: 'AES-GCM',
          length: 256,
        }),
        false, // Non-extractable
        ['encrypt', 'decrypt']
      );
    });

    it('should generate deterministic key for same credential ID', async () => {
      const mockKeyMaterial = { type: 'raw' };
      const mockDerivedKey = { type: 'derived', id: 'key1' };

      mockCryptoSubtle.importKey.mockResolvedValue(mockKeyMaterial);
      mockCryptoSubtle.deriveKey.mockResolvedValue(mockDerivedKey);

      await manager.generateMasterKey(testCredentialId);
      const firstCallArgs = mockCryptoSubtle.deriveKey.mock.calls[0];

      await manager.generateMasterKey(testCredentialId);
      const secondCallArgs = mockCryptoSubtle.deriveKey.mock.calls[1];

      // Salt should be the same (fixed)
      expect(firstCallArgs[0].salt).toEqual(secondCallArgs[0].salt);
    });

    it('should set isInitialized to true after key generation', async () => {
      mockCryptoSubtle.importKey.mockResolvedValue({});
      mockCryptoSubtle.deriveKey.mockResolvedValue({});

      expect(manager.isInitialized()).toBe(false);
      await manager.generateMasterKey(testCredentialId);
      expect(manager.isInitialized()).toBe(true);
    });

    it('should set keyId after key generation', async () => {
      mockCryptoSubtle.importKey.mockResolvedValue({});
      mockCryptoSubtle.deriveKey.mockResolvedValue({});

      expect(manager.getKeyId()).toBeNull();
      await manager.generateMasterKey(testCredentialId);
      expect(manager.getKeyId()).toBe(testCredentialId);
    });

    it('should throw error if key derivation fails', async () => {
      mockCryptoSubtle.importKey.mockRejectedValue(new Error('Import failed'));

      await expect(manager.generateMasterKey(testCredentialId))
        .rejects.toThrow('Failed to derive master key');
    });
  });

  describe('encrypt', () => {
    beforeEach(async () => {
      mockCryptoSubtle.importKey.mockResolvedValue({});
      mockCryptoSubtle.deriveKey.mockResolvedValue({ type: 'key' });
      await manager.generateMasterKey(testCredentialId);
    });

    it('should encrypt data with AES-GCM', async () => {
      const testData = 'private-key-data';
      const mockEncrypted = new ArrayBuffer(32);

      mockCryptoSubtle.encrypt.mockResolvedValue(mockEncrypted);

      const result = await manager.encrypt(testData);

      expect(mockCryptoSubtle.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AES-GCM',
        }),
        expect.anything(),
        expect.any(Uint8Array)
      );

      expect(result.encrypted).toBeInstanceOf(Uint8Array);
      expect(result.iv).toBeInstanceOf(Uint8Array);
      expect(result.iv.length).toBe(12); // IV length for AES-GCM
    });

    it('should throw error if master key not initialized', async () => {
      const uninitializedManager = new WebCryptoMasterKeyManager();

      await expect(uninitializedManager.encrypt('data'))
        .rejects.toThrow('Master key not initialized');
    });

    it('should throw error if encryption fails', async () => {
      mockCryptoSubtle.encrypt.mockRejectedValue(new Error('Encryption failed'));

      await expect(manager.encrypt('data'))
        .rejects.toThrow('Encryption failed');
    });
  });

  describe('decrypt', () => {
    beforeEach(async () => {
      mockCryptoSubtle.importKey.mockResolvedValue({});
      mockCryptoSubtle.deriveKey.mockResolvedValue({ type: 'key' });
      await manager.generateMasterKey(testCredentialId);
    });

    it('should decrypt data with AES-GCM', async () => {
      const testDecrypted = new TextEncoder().encode('decrypted-data');
      const mockEncrypted = new Uint8Array(32);
      const mockIv = new Uint8Array(12);

      mockCryptoSubtle.decrypt.mockResolvedValue(testDecrypted);

      const result = await manager.decrypt(mockEncrypted, mockIv);

      expect(mockCryptoSubtle.decrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AES-GCM',
          iv: mockIv,
        }),
        expect.anything(),
        mockEncrypted
      );

      expect(result).toBe('decrypted-data');
    });

    it('should throw error if master key not initialized', async () => {
      const uninitializedManager = new WebCryptoMasterKeyManager();

      await expect(uninitializedManager.decrypt(new Uint8Array(32), new Uint8Array(12)))
        .rejects.toThrow('Master key not initialized');
    });

    it('should throw error if decryption fails', async () => {
      mockCryptoSubtle.decrypt.mockRejectedValue(new Error('Decryption failed'));

      await expect(manager.decrypt(new Uint8Array(32), new Uint8Array(12)))
        .rejects.toThrow('Decryption failed');
    });
  });

  describe('clear', () => {
    it('should clear master key and keyId', async () => {
      mockCryptoSubtle.importKey.mockResolvedValue({});
      mockCryptoSubtle.deriveKey.mockResolvedValue({ type: 'key' });

      await manager.generateMasterKey(testCredentialId);
      expect(manager.isInitialized()).toBe(true);
      expect(manager.getKeyId()).toBe(testCredentialId);

      manager.clear();

      expect(manager.isInitialized()).toBe(false);
      expect(manager.getKeyId()).toBeNull();
    });
  });

  describe('deriveKeyFromPasskey (backward compatibility)', () => {
    it('should derive key from credential ID and salt', async () => {
      const mockKeyMaterial = { type: 'raw' };
      const mockDerivedKey = { type: 'derived' };
      const salt = new Uint8Array(16);

      mockCryptoSubtle.importKey.mockResolvedValue(mockKeyMaterial);
      mockCryptoSubtle.deriveKey.mockResolvedValue(mockDerivedKey);

      const result = await manager.deriveKeyFromPasskey(testCredentialId, salt);

      expect(result).toBe(mockDerivedKey);
      expect(mockCryptoSubtle.deriveKey).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256',
        }),
        mockKeyMaterial,
        expect.objectContaining({
          name: 'AES-GCM',
          length: 256,
        }),
        false,
        ['encrypt', 'decrypt']
      );
    });
  });
});

describe('Deterministic Key Derivation', () => {
  it('should produce same key for same input across instances', async () => {
    const manager1 = new WebCryptoMasterKeyManager();
    const manager2 = new WebCryptoMasterKeyManager();
    const credentialId = 'shared-credential-id';

    // Track the salt used in deriveKey calls
    const salts: Uint8Array[] = [];
    mockCryptoSubtle.importKey.mockResolvedValue({});
    mockCryptoSubtle.deriveKey.mockImplementation((params) => {
      salts.push(params.salt);
      return Promise.resolve({ type: 'key' });
    });

    await manager1.generateMasterKey(credentialId);
    await manager2.generateMasterKey(credentialId);

    // Both should use the same fixed salt
    expect(salts[0]).toEqual(salts[1]);
  });
});
