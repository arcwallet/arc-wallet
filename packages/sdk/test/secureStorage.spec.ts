/**
 * Secure Storage Tests
 *
 * Tests the encrypted key storage functionality using IndexedDB
 * with AES-GCM encryption via WebCrypto API.
 *
 * @module tests/secureStorage
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock idb-keyval
const mockStore: Map<string, any> = new Map();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(mockStore.get(key))),
  set: vi.fn((key: string, value: any) => {
    mockStore.set(key, value);
    return Promise.resolve();
  }),
  del: vi.fn((key: string) => {
    mockStore.delete(key);
    return Promise.resolve();
  }),
  clear: vi.fn(() => {
    mockStore.clear();
    return Promise.resolve();
  }),
}));

// Mock crypto.subtle
const mockCryptoSubtle = {
  importKey: vi.fn(),
  deriveKey: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
};

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
import { SecureStorage, secureStorage } from '../src/core/secureStorage';
import { get, set, del, clear } from 'idb-keyval';

describe('SecureStorage', () => {
  let storage: SecureStorage;
  const testCredentialId = 'test-credential-abc123';
  const testPrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  beforeEach(() => {
    storage = new SecureStorage();
    mockStore.clear();
    vi.clearAllMocks();
  });

  describe('deriveEncryptionKey', () => {
    it('should derive key using PBKDF2', async () => {
      const mockKeyMaterial = { type: 'raw' };
      const mockDerivedKey = { type: 'derived' };
      const salt = new Uint8Array(16);

      mockCryptoSubtle.importKey.mockResolvedValue(mockKeyMaterial);
      mockCryptoSubtle.deriveKey.mockResolvedValue(mockDerivedKey);

      const result = await storage.deriveEncryptionKey(testCredentialId, salt);

      expect(mockCryptoSubtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );

      expect(mockCryptoSubtle.deriveKey).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'PBKDF2',
          salt,
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

      expect(result).toBe(mockDerivedKey);
    });

    it('should use high iteration count for security', async () => {
      mockCryptoSubtle.importKey.mockResolvedValue({});
      mockCryptoSubtle.deriveKey.mockResolvedValue({});

      await storage.deriveEncryptionKey(testCredentialId, new Uint8Array(16));

      const deriveKeyCall = mockCryptoSubtle.deriveKey.mock.calls[0];
      expect(deriveKeyCall[0].iterations).toBe(100000);
    });
  });

  describe('storeKey', () => {
    it('should encrypt and store private key', async () => {
      const mockEncryptionKey = { type: 'key' };
      const mockCiphertext = new ArrayBuffer(64);

      mockCryptoSubtle.encrypt.mockResolvedValue(mockCiphertext);

      await storage.storeKey(testCredentialId, testPrivateKey, mockEncryptionKey as CryptoKey);

      expect(mockCryptoSubtle.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AES-GCM',
        }),
        mockEncryptionKey,
        expect.any(Uint8Array)
      );

      expect(set).toHaveBeenCalledWith(
        `wallet_key_${testCredentialId}`,
        expect.objectContaining({
          ciphertext: expect.any(ArrayBuffer),
          iv: expect.any(Uint8Array),
          salt: expect.any(Uint8Array),
        })
      );
    });

    it('should throw error if encryption fails', async () => {
      const mockEncryptionKey = { type: 'key' };
      mockCryptoSubtle.encrypt.mockRejectedValue(new Error('Encryption error'));

      await expect(storage.storeKey(testCredentialId, testPrivateKey, mockEncryptionKey as CryptoKey))
        .rejects.toThrow('Failed to store private key securely');
    });
  });

  describe('storeWebCryptoData', () => {
    it('should store WebCrypto encrypted data', async () => {
      const data = {
        encrypted: [1, 2, 3, 4],
        iv: [5, 6, 7, 8],
        address: '0x1234...',
        keyType: 'webcrypto-master',
      };

      await storage.storeWebCryptoData(testCredentialId, data);

      expect(set).toHaveBeenCalledWith(`wallet:${testCredentialId}`, data);
    });
  });

  describe('getKey', () => {
    it('should retrieve and decrypt private key', async () => {
      const mockEncryptionKey = { type: 'key' };
      const mockEncryptedData = {
        ciphertext: new ArrayBuffer(64),
        iv: new Uint8Array(12),
        salt: new Uint8Array(16),
      };
      const mockDecrypted = new TextEncoder().encode(testPrivateKey);

      mockStore.set(`wallet_key_${testCredentialId}`, mockEncryptedData);
      mockCryptoSubtle.decrypt.mockResolvedValue(mockDecrypted);

      const result = await storage.getKey(testCredentialId, mockEncryptionKey as CryptoKey);

      expect(mockCryptoSubtle.decrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AES-GCM',
          iv: mockEncryptedData.iv,
        }),
        mockEncryptionKey,
        mockEncryptedData.ciphertext
      );

      expect(result).toBe(testPrivateKey);
    });

    it('should return null if key not found', async () => {
      const mockEncryptionKey = { type: 'key' };

      const result = await storage.getKey('non-existent', mockEncryptionKey as CryptoKey);

      expect(result).toBeNull();
    });

    it('should return null if decryption fails', async () => {
      const mockEncryptionKey = { type: 'key' };
      const mockEncryptedData = {
        ciphertext: new ArrayBuffer(64),
        iv: new Uint8Array(12),
        salt: new Uint8Array(16),
      };

      mockStore.set(`wallet_key_${testCredentialId}`, mockEncryptedData);
      mockCryptoSubtle.decrypt.mockRejectedValue(new Error('Decryption failed'));

      const result = await storage.getKey(testCredentialId, mockEncryptionKey as CryptoKey);

      expect(result).toBeNull();
    });
  });

  describe('getKeyData', () => {
    it('should retrieve WebCrypto key data', async () => {
      const data = {
        encrypted: [1, 2, 3],
        iv: [4, 5, 6],
        address: '0xABC',
        keyType: 'webcrypto-master',
      };

      mockStore.set(`wallet:${testCredentialId}`, data);

      const result = await storage.getKeyData(testCredentialId);

      expect(result).toEqual(data);
    });

    it('should return undefined if not found', async () => {
      const result = await storage.getKeyData('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('deleteKey', () => {
    it('should delete stored key', async () => {
      await storage.deleteKey(testCredentialId);

      expect(del).toHaveBeenCalledWith(`wallet_key_${testCredentialId}`);
    });
  });

  describe('clearAll', () => {
    it('should clear all stored keys', async () => {
      await storage.clearAll();

      expect(clear).toHaveBeenCalled();
    });
  });

  describe('storeMetadata', () => {
    it('should store wallet metadata', async () => {
      const metadata = {
        address: '0x1234',
        publicKey: 'pubkey',
        userId: 'user-id',
        createdAt: '2024-01-01',
      };

      await storage.storeMetadata(testCredentialId, metadata);

      expect(set).toHaveBeenCalledWith(`wallet:${testCredentialId}:metadata`, metadata);
    });
  });

  describe('getMetadata', () => {
    it('should retrieve metadata from new format', async () => {
      const metadata = {
        address: '0x1234',
        publicKey: 'pubkey',
      };

      mockStore.set(`wallet:${testCredentialId}:metadata`, metadata);

      const result = await storage.getMetadata(testCredentialId);

      expect(result).toEqual(metadata);
    });

    it('should fall back to legacy format', async () => {
      const legacyMetadata = {
        address: '0xLEGACY',
        publicKey: 'legacy-pubkey',
      };

      mockStore.set(`wallet_meta_${testCredentialId}`, legacyMetadata);

      const result = await storage.getMetadata(testCredentialId);

      expect(result).toEqual(legacyMetadata);
    });

    it('should prefer new format over legacy', async () => {
      const newMetadata = { address: '0xNEW' };
      const legacyMetadata = { address: '0xLEGACY' };

      mockStore.set(`wallet:${testCredentialId}:metadata`, newMetadata);
      mockStore.set(`wallet_meta_${testCredentialId}`, legacyMetadata);

      const result = await storage.getMetadata(testCredentialId);

      expect(result).toEqual(newMetadata);
    });

    it('should return null if no metadata found', async () => {
      const result = await storage.getMetadata('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('hasKey', () => {
    it('should return true if key exists', async () => {
      mockStore.set(`wallet_key_${testCredentialId}`, { data: 'exists' });

      const result = await storage.hasKey(testCredentialId);

      expect(result).toBe(true);
    });

    it('should return false if key does not exist', async () => {
      const result = await storage.hasKey('non-existent');

      expect(result).toBe(false);
    });
  });
});

describe('SecureStorage Singleton', () => {
  it('should export a singleton instance', () => {
    expect(secureStorage).toBeInstanceOf(SecureStorage);
  });
});

describe('Encryption Constants', () => {
  it('should use secure algorithm parameters', () => {
    const storage = new SecureStorage();

    // Access private properties through any cast for testing
    const storageAny = storage as any;

    expect(storageAny.ALGORITHM).toBe('AES-GCM');
    expect(storageAny.KEY_LENGTH).toBe(256);
    expect(storageAny.IV_LENGTH).toBe(12);
    expect(storageAny.SALT_LENGTH).toBe(16);
  });
});
