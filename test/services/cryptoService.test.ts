// @vitest-environment node
import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
    generateWallet,
    encryptWallet,
    decryptWallet,
    saveEncryptedWallet,
    loadEncryptedWallet,
    EncryptedWallet
} from '../../services/cryptoService';

// Mock localStorage for Node environment
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value.toString();
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        },
    };
})();

global.localStorage = localStorageMock as any;

describe('cryptoService', () => {
    describe('generateWallet', () => {
        it('should generate a valid wallet with address, private key, and mnemonic', () => {
            const wallet = generateWallet();

            expect(wallet).toBeDefined();
            expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
            expect(wallet.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
            expect(wallet.mnemonic).toBeDefined();
            expect(wallet.mnemonic!.split(' ').length).toBeGreaterThanOrEqual(12);
        });
    });

    describe('Encryption Flow', () => {
        it('should encrypt and decrypt a wallet correctly', async () => {
            const password = 'TestPassword123!';
            const walletData = generateWallet();

            // Encrypt
            const encrypted = await encryptWallet(walletData, password);

            expect(encrypted).toBeDefined();
            expect(encrypted.ciphertext).toBeDefined();
            expect(encrypted.iv).toBeDefined();
            expect(encrypted.salt).toBeDefined();
            expect(encrypted.version).toBeDefined();

            // Decrypt
            const decrypted = await decryptWallet(encrypted, password);

            expect(decrypted.address).toBe(walletData.address);
            expect(decrypted.privateKey).toBe(walletData.privateKey);
            expect(decrypted.mnemonic).toBe(walletData.mnemonic);
        });

        it('should fail to decrypt with wrong password', async () => {
            const password = 'CorrectPassword';
            const wrongPassword = 'WrongPassword';
            const walletData = generateWallet();

            const encrypted = await encryptWallet(walletData, password);

            await expect(decryptWallet(encrypted, wrongPassword)).rejects.toThrow();
        });
    });

    describe('Local Storage Persistence', () => {
        it('should save and load encrypted wallet from localStorage', () => {
            const mockEncryptedWallet: EncryptedWallet = {
                ciphertext: 'test-cipher',
                iv: 'test-iv',
                salt: 'test-salt',
                version: 1
            };

            saveEncryptedWallet(mockEncryptedWallet);

            const loaded = loadEncryptedWallet();
            expect(loaded).toEqual(mockEncryptedWallet);
        });

        it('should return null if no wallet in localStorage', () => {
            localStorage.clear();
            const loaded = loadEncryptedWallet();
            expect(loaded).toBeNull();
        });
    });
});
