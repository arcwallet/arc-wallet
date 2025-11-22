
/**
 * FHE (Fully Homomorphic Encryption) Service
 * 
 * Uses fhevmjs for real client-side encryption.
 */

import { createInstance, FhevmInstance } from 'fhevmjs';

export interface EncryptedAmount {
    handles: Uint8Array[];
    inputProof: string;
}

let instance: FhevmInstance | null = null;

/**
 * Initialize the FHE instance
 * @param chainId - The chain ID (e.g., 9000 for Arc Testnet)
 * @param publicKey - The public key of the FHE oracle/network (optional if fetched automatically)
 */
export async function initFHE(chainId: number, publicKey?: string): Promise<FhevmInstance> {
    if (instance) return instance;

    // Note: In a real app, you might fetch the public key from the blockchain if not provided
    // For Arc Testnet, we usually need the specific ACL address or Oracle public key
    instance = await createInstance({ chainId, publicKey });
    return instance;
}

/**
 * Encrypt an amount for a transaction
 * 
 * @param instance - The initialized FHE instance
 * @param contractAddress - The address of the contract (e.g., Confidential ERC20)
 * @param userAddress - The address of the user sending the transaction
 * @param amount - The amount to encrypt (bigint)
 * @returns Encrypted handles and proof
 */
export async function encryptAmount(
    instance: FhevmInstance,
    contractAddress: string,
    userAddress: string,
    amount: bigint
): Promise<EncryptedAmount> {
    // Create encrypted input for a uint64 (standard for amounts usually, or uint256 if supported)
    // Note: fhevmjs usually supports add64, add8, etc. Check specific version support.
    // We'll assume uint64 for this example as it's common for confidential amounts.

    const input = instance.createEncryptedInput(contractAddress, userAddress);

    // Add the amount as a 64-bit integer
    // If amount > 2^64, this would need handling, but for demo/standard tokens it's often sufficient or handled via multiple inputs
    input.add64(amount);

    // Encrypt and generate proof
    const encrypted = await input.encrypt();

    return {
        handles: encrypted.handles,
        inputProof: Buffer.from(encrypted.inputProof).toString('hex'),
    };
}

/**
 * Helper to format the encrypted input for contract calls
 * @param encrypted - The encrypted object
 * @returns Hex string representing the proof/handles
 */
export function formatEncryptedInput(encrypted: EncryptedAmount): string {
    // This depends on how the contract expects the input.
    // Often it's passed as bytes.
    return `0x${Buffer.from(encrypted.inputProof, 'hex').toString('hex')}`;
}
