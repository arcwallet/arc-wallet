// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title P256Verifier
 * @notice WebAuthn P256/secp256r1 signature verification
 * @dev Implements RIP-7212 compatible P256 verification
 *
 * Based on security patterns from SendApp's SendVerifier
 */
contract P256Verifier {
    /// @notice The precompile address for P256 verification (RIP-7212)
    /// This is the standardized address for chains supporting RIP-7212
    address public constant P256_VERIFIER_PRECOMPILE = 0x0000000000000000000000000000000000000100;

    /// @notice WebAuthn signature structure
    struct WebAuthnSignature {
        bytes authenticatorData;
        bytes clientDataJSON;
        uint256 challengeIndex;
        uint256 typeIndex;
        uint256 r;
        uint256 s;
    }

    /// @notice P256 public key
    struct P256PublicKey {
        uint256 x;
        uint256 y;
    }

    // ============================================
    // ERRORS
    // ============================================

    error InvalidAuthenticatorData();
    error InvalidClientData();
    error UserNotPresent();
    error InvalidSignature();

    // ============================================
    // VERIFICATION
    // ============================================

    /**
     * @notice Verify a WebAuthn P256 signature
     * @param challenge The challenge that was signed
     * @param sig The WebAuthn signature data
     * @param pubKey The P256 public key
     * @return True if signature is valid
     */
    function verifyWebAuthnSignature(
        bytes32 challenge,
        WebAuthnSignature calldata sig,
        P256PublicKey calldata pubKey
    ) external view returns (bool) {
        // 1. Validate authenticator data
        // Must be at least 37 bytes (rpIdHash[32] + flags[1] + signCount[4])
        if (sig.authenticatorData.length < 37) {
            revert InvalidAuthenticatorData();
        }

        // 2. Check User Present (UP) flag - bit 0 of flags byte (index 32)
        uint8 flags = uint8(sig.authenticatorData[32]);
        if ((flags & 0x01) != 0x01) {
            revert UserNotPresent();
        }

        // 3. Validate clientDataJSON contains the challenge
        // The challenge should be base64url encoded in clientDataJSON
        bytes memory expectedChallenge = _base64UrlEncode(abi.encodePacked(challenge));

        // Verify challenge exists at the specified index
        if (!_containsAt(sig.clientDataJSON, expectedChallenge, sig.challengeIndex)) {
            revert InvalidClientData();
        }

        // Verify type is "webauthn.get" at the specified index
        bytes memory expectedType = bytes('"type":"webauthn.get"');
        if (!_containsAt(sig.clientDataJSON, expectedType, sig.typeIndex)) {
            revert InvalidClientData();
        }

        // 4. Compute the message hash
        bytes32 clientDataHash = sha256(sig.clientDataJSON);
        bytes32 message = sha256(abi.encodePacked(sig.authenticatorData, clientDataHash));

        // 5. Verify P256 signature
        return _verifyP256Signature(message, sig.r, sig.s, pubKey.x, pubKey.y);
    }

    /**
     * @notice Verify a raw P256 signature
     * @param message The message hash
     * @param r Signature r value
     * @param s Signature s value
     * @param x Public key x coordinate
     * @param y Public key y coordinate
     * @return True if signature is valid
     */
    function verifyP256Signature(
        bytes32 message,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) external view returns (bool) {
        return _verifyP256Signature(message, r, s, x, y);
    }

    /**
     * @notice Internal P256 verification using precompile or fallback
     */
    function _verifyP256Signature(
        bytes32 message,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) internal view returns (bool) {
        // Try RIP-7212 precompile first
        (bool success, bytes memory result) = P256_VERIFIER_PRECOMPILE.staticcall(
            abi.encode(message, r, s, x, y)
        );

        if (success && result.length == 32) {
            return abi.decode(result, (uint256)) == 1;
        }

        // Fallback to Daimo's P256Verifier if precompile not available
        // This would call an external verifier contract
        // For now, return false if precompile fails
        return false;
    }

    // ============================================
    // HELPERS
    // ============================================

    /**
     * @notice Check if data contains expected bytes at index
     */
    function _containsAt(
        bytes memory data,
        bytes memory expected,
        uint256 index
    ) internal pure returns (bool) {
        if (index + expected.length > data.length) {
            return false;
        }

        for (uint256 i = 0; i < expected.length; i++) {
            if (data[index + i] != expected[i]) {
                return false;
            }
        }

        return true;
    }

    /**
     * @notice Base64URL encode (without padding)
     */
    function _base64UrlEncode(bytes memory data) internal pure returns (bytes memory) {
        bytes memory TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

        uint256 len = data.length;
        if (len == 0) return "";

        uint256 encodedLen = 4 * ((len + 2) / 3);
        bytes memory result = new bytes(encodedLen);

        uint256 i = 0;
        uint256 j = 0;

        while (i < len) {
            uint256 a = i < len ? uint8(data[i++]) : 0;
            uint256 b = i < len ? uint8(data[i++]) : 0;
            uint256 c = i < len ? uint8(data[i++]) : 0;

            uint256 triple = (a << 16) | (b << 8) | c;

            result[j++] = TABLE[(triple >> 18) & 0x3F];
            result[j++] = TABLE[(triple >> 12) & 0x3F];
            result[j++] = TABLE[(triple >> 6) & 0x3F];
            result[j++] = TABLE[triple & 0x3F];
        }

        // Remove padding
        uint256 padding = (3 - (len % 3)) % 3;
        assembly {
            mstore(result, sub(mload(result), padding))
        }

        return result;
    }

    /**
     * @notice Compute key hash from P256 coordinates
     */
    function computeKeyHash(uint256 x, uint256 y) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(x, y));
    }
}
