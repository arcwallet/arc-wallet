/**
 * Passkey Utility Functions
 * Handles COSE public key extraction and Ethereum address derivation
 */
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
export declare function decodeCBORWithExtensions<T>(buffer: Uint8Array): T;
/**
 * Extracts X and Y coordinates from COSE-encoded public key
 * COSE structure: Map with keys -2 (x) and -3 (y)
 *
 * @param cosePublicKey - COSE-encoded public key (Uint8Array)
 * @returns [x, y] coordinates as hex strings
 */
export declare function COSEECDHAtoXY(cosePublicKey: Uint8Array): [string, string];
/**
 * Converts COSE public key to DER format
 *
 * @param cosePublicKey - COSE-encoded public key
 * @returns DER-encoded public key as hex string
 */
export declare function COSEECDHAtoDER(cosePublicKey: Uint8Array): string;
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
export declare function deriveAddressFromPublicKey(derPublicKey: string): string;
/**
 * Derives Ethereum address directly from COSE public key
 *
 * @param cosePublicKey - COSE-encoded public key
 * @returns Ethereum address (0x-prefixed)
 */
export declare function deriveAddressFromCOSE(cosePublicKey: Uint8Array): string;
//# sourceMappingURL=passkeyUtils.d.ts.map