/**
 * Passkey Utility Functions
 * Handles COSE public key extraction and Ethereum address derivation
 */
import { keccak256 } from 'ethers';
import cbor from 'cbor';
/**
 * DER-encoded public key prefix for P-256 (secp256r1) EC public keys
 * ASN.1 SubjectPublicKeyInfo structure
 */
const DER_ECPUBKEY_PREFIX = '0x3059301306072a8648ce3d020106082a8648ce3d03010703420004';
/**
 * Decodes CBOR data that may contain WebAuthn extensions after the main structure.
 *
 * Hardware authenticators (YubiKeys, etc.) may append extension data after the primary
 * COSE public key structure. This function handles that by attempting to decode
 * progressively shorter slices until it finds the main CBOR structure.
 *
 * @param buffer - The CBOR encoded data (may include extensions)
 * @returns The decoded main structure
 */
export function decodeCBORWithExtensions(buffer) {
    try {
        // Try normal decode first (handles standard data without extensions)
        return cbor.decode(buffer);
    }
    catch (e) {
        if (e.message && e.message.includes('Extra data')) {
            // Try common COSE key lengths first for performance
            const commonLengths = [77, 78, 80, 85];
            for (const len of commonLengths) {
                if (buffer.length > len) {
                    try {
                        const mainData = cbor.decode(buffer.slice(0, len));
                        console.log(`[PasskeyUtils] Decoded CBOR with ${buffer.length - len} bytes of extensions`);
                        return mainData;
                    }
                    catch {
                        // This length didn't work, try next
                    }
                }
            }
            // Fallback: progressively try shorter lengths
            for (let len = buffer.length - 1; len > 50; len--) {
                try {
                    const mainData = cbor.decode(buffer.slice(0, len));
                    console.warn(`[PasskeyUtils] Found CBOR boundary at ${len} bytes via search`);
                    return mainData;
                }
                catch {
                    // Continue searching
                }
            }
        }
        // Re-throw if we can't handle it
        throw e;
    }
}
/**
 * Extracts X and Y coordinates from COSE-encoded public key
 * COSE structure: Map with keys -2 (x) and -3 (y)
 *
 * @param cosePublicKey - COSE-encoded public key (Uint8Array)
 * @returns [x, y] coordinates as hex strings
 */
export function COSEECDHAtoXY(cosePublicKey) {
    const coseStruct = decodeCBORWithExtensions(cosePublicKey);
    const x = coseStruct.get(-2);
    const y = coseStruct.get(-3);
    if (!x || !y) {
        throw new Error('Invalid COSE public key: missing x or y coordinates');
    }
    const xHex = `0x${Buffer.from(x).toString('hex')}`;
    const yHex = `0x${Buffer.from(y).toString('hex')}`;
    return [xHex, yHex];
}
/**
 * Converts COSE public key to DER format
 *
 * @param cosePublicKey - COSE-encoded public key
 * @returns DER-encoded public key as hex string
 */
export function COSEECDHAtoDER(cosePublicKey) {
    const [x, y] = COSEECDHAtoXY(cosePublicKey);
    // Remove '0x' prefix and concatenate
    const publicKeyHex = x.substring(2) + y.substring(2);
    // Add DER prefix
    return DER_ECPUBKEY_PREFIX + publicKeyHex;
}
/**
 * Derives Ethereum address from DER-encoded public key
 *
 * For P-256 (secp256r1) keys used in WebAuthn:
 * 1. Extract the 64-byte uncompressed public key (x || y)
 * 2. Hash with keccak256
 * 3. Take last 20 bytes as address
 *
 * @param derPublicKey - DER-encoded public key
 * @returns Ethereum address (0x-prefixed)
 */
export function deriveAddressFromPublicKey(derPublicKey) {
    // Remove DER prefix to get raw public key (64 bytes = 128 hex chars)
    const publicKeyHex = derPublicKey.substring(DER_ECPUBKEY_PREFIX.length);
    if (publicKeyHex.length !== 128) {
        throw new Error(`Invalid public key length: expected 128 hex chars, got ${publicKeyHex.length}`);
    }
    // Hash the public key
    const hash = keccak256('0x' + publicKeyHex);
    // Take last 20 bytes (40 hex chars) as address
    const address = '0x' + hash.substring(hash.length - 40);
    return address.toLowerCase();
}
/**
 * Derives Ethereum address directly from COSE public key
 *
 * @param cosePublicKey - COSE-encoded public key
 * @returns Ethereum address (0x-prefixed)
 */
export function deriveAddressFromCOSE(cosePublicKey) {
    const derPublicKey = COSEECDHAtoDER(cosePublicKey);
    return deriveAddressFromPublicKey(derPublicKey);
}
//# sourceMappingURL=passkeyUtils.js.map