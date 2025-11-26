// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IEntryPoint} from "./IEntryPoint.sol";

/**
 * @title P256 Verifier Interface
 * @dev Interface for Daimo's P256 verifier deployed at 0xc2b78104907F722DABAc4C69f826a522B2754De4
 */
interface IP256Verifier {
    function verifySignature(
        bytes32 message,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) external view returns (bool);
}

/**
 * @title WebAuthn Helper Library
 * @dev Utilities for WebAuthn signature verification
 */
library WebAuthn {
    bytes32 constant EXPECTED_TYPE_HASH = keccak256('"type":"webauthn.get"');

    struct WebAuthnAuth {
        bytes authenticatorData;
        string clientDataJSON;
        uint256 challengeIndex;
        uint256 typeIndex;
        uint256 r;
        uint256 s;
    }

    function verify(
        bytes memory challenge,
        WebAuthnAuth memory auth,
        uint256 x,
        uint256 y,
        IP256Verifier verifier
    ) internal view returns (bool) {
        // 1. Verify type field in clientDataJSON
        bytes memory expectedType = '"type":"webauthn.get"';
        bytes memory clientDataBytes = bytes(auth.clientDataJSON);
        for (uint i = 0; i < expectedType.length; i++) {
            if (clientDataBytes[auth.typeIndex + i] != expectedType[i]) {
                return false;
            }
        }

        // 2. Verify challenge in clientDataJSON
        string memory challengeBase64 = encodeBase64URL(challenge);
        bytes memory expectedChallenge = abi.encodePacked('"challenge":"', challengeBase64, '"');
        bytes memory challengeSlice = slice(clientDataBytes, auth.challengeIndex, expectedChallenge.length);
        if (keccak256(challengeSlice) != keccak256(expectedChallenge)) {
            return false;
        }

        // 3. Create message hash
        bytes32 clientDataHash = sha256(clientDataBytes);
        bytes32 message = sha256(abi.encodePacked(auth.authenticatorData, clientDataHash));

        // 4. Verify P256 signature
        return verifier.verifySignature(message, auth.r, auth.s, x, y);
    }

    function slice(bytes memory data, uint256 start, uint256 length) internal pure returns (bytes memory) {
        bytes memory result = new bytes(length);
        for (uint i = 0; i < length && start + i < data.length; i++) {
            result[i] = data[start + i];
        }
        return result;
    }

    function encodeBase64URL(bytes memory data) internal pure returns (string memory) {
        string memory base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        bytes memory base64 = bytes(base64Chars);

        uint256 resultLength = 4 * ((data.length + 2) / 3);
        bytes memory result = new bytes(resultLength);

        uint256 resultIndex = 0;
        for (uint256 i = 0; i < data.length; i += 3) {
            uint256 a = uint8(data[i]);
            uint256 b = i + 1 < data.length ? uint8(data[i + 1]) : 0;
            uint256 c = i + 2 < data.length ? uint8(data[i + 2]) : 0;

            result[resultIndex++] = base64[(a >> 2) & 0x3F];
            result[resultIndex++] = base64[((a << 4) | (b >> 4)) & 0x3F];
            if (i + 1 < data.length) {
                result[resultIndex++] = base64[((b << 2) | (c >> 6)) & 0x3F];
            }
            if (i + 2 < data.length) {
                result[resultIndex++] = base64[c & 0x3F];
            }
        }

        // Trim padding
        while (resultIndex > 0 && result[resultIndex - 1] == 0) {
            resultIndex--;
        }

        bytes memory trimmed = new bytes(resultIndex);
        for (uint i = 0; i < resultIndex; i++) {
            trimmed[i] = result[i];
        }
        return string(trimmed);
    }
}

/**
 * @title PasskeyAccount
 * @dev ERC-4337 Smart Contract Wallet using WebAuthn/Passkey (P256) for signatures
 * @notice Passkey IS the signing key - no separate private key needed
 */
contract PasskeyAccount {
    error NotOwner();
    error InvalidSignature();
    error InvalidNonce();
    error InvalidCaller();

    event Executed(address indexed target, uint256 value, bytes data);
    event OwnerChanged(uint256 indexed newX, uint256 indexed newY);

    // Daimo P256 Verifier (deployed on many chains)
    IP256Verifier public constant P256_VERIFIER = IP256Verifier(0xc2b78104907F722DABAc4C69f826a522B2754De4);

    IEntryPoint public immutable entryPoint;

    // P256 public key coordinates (owner's passkey)
    uint256 public ownerX;
    uint256 public ownerY;

    uint256 private userOpNonce;

    constructor(address _entryPoint, uint256 _ownerX, uint256 _ownerY) {
        require(_entryPoint != address(0), "entrypoint required");
        require(_ownerX != 0 && _ownerY != 0, "owner key required");
        entryPoint = IEntryPoint(_entryPoint);
        ownerX = _ownerX;
        ownerY = _ownerY;
    }

    function getUserOpNonce() external view returns (uint256) {
        return userOpNonce;
    }

    function getOwnerPublicKey() external view returns (uint256 x, uint256 y) {
        return (ownerX, ownerY);
    }

    /**
     * @dev Change owner's passkey (only callable by current owner via UserOp)
     */
    function changeOwner(uint256 newX, uint256 newY) external {
        require(msg.sender == address(this), "only self");
        require(newX != 0 && newY != 0, "invalid key");
        ownerX = newX;
        ownerY = newY;
        emit OwnerChanged(newX, newY);
    }

    function execute(address target, uint256 value, bytes calldata data) external returns (bytes memory result) {
        require(msg.sender == address(entryPoint) || msg.sender == address(this), "only entrypoint or self");
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        require(success, string(returndata));
        emit Executed(target, value, data);
        return returndata;
    }

    function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func) external {
        require(msg.sender == address(entryPoint) || msg.sender == address(this), "only entrypoint or self");
        require(dest.length == value.length && value.length == func.length, "wrong array lengths");
        for (uint256 i = 0; i < dest.length; i++) {
            (bool success, bytes memory returndata) = dest[i].call{value: value[i]}(func[i]);
            require(success, string(returndata));
            emit Executed(dest[i], value[i], func[i]);
        }
    }

    /**
     * @dev Validate UserOperation signature using WebAuthn/P256
     * @param userOp The user operation
     * @param userOpHash Hash of the user operation (challenge for WebAuthn)
     * @param missingFunds Funds to pay to EntryPoint
     */
    function validateUserOp(
        IEntryPoint.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingFunds
    ) external returns (uint256 validationData) {
        if (msg.sender != address(entryPoint)) revert InvalidCaller();
        if (userOp.nonce != userOpNonce) revert InvalidNonce();

        // Decode WebAuthn signature
        bool valid = _verifyWebAuthnSignature(userOpHash, userOp.signature);
        if (!valid) revert InvalidSignature();

        unchecked {
            userOpNonce += 1;
        }

        if (missingFunds > 0) {
            (bool success, ) = payable(msg.sender).call{value: missingFunds}("");
            require(success, "missingFunds transfer failed");
        }

        return 0;
    }

    /**
     * @dev Verify WebAuthn signature
     * @param challenge The challenge (userOpHash)
     * @param signature Encoded WebAuthn signature data
     */
    function _verifyWebAuthnSignature(bytes32 challenge, bytes memory signature) internal view returns (bool) {
        // Decode signature
        // Format: abi.encode(authenticatorData, clientDataJSON, challengeIndex, typeIndex, r, s)
        (
            bytes memory authenticatorData,
            string memory clientDataJSON,
            uint256 challengeIndex,
            uint256 typeIndex,
            uint256 r,
            uint256 s
        ) = abi.decode(signature, (bytes, string, uint256, uint256, uint256, uint256));

        WebAuthn.WebAuthnAuth memory auth = WebAuthn.WebAuthnAuth({
            authenticatorData: authenticatorData,
            clientDataJSON: clientDataJSON,
            challengeIndex: challengeIndex,
            typeIndex: typeIndex,
            r: r,
            s: s
        });

        return WebAuthn.verify(abi.encodePacked(challenge), auth, ownerX, ownerY, P256_VERIFIER);
    }

    /**
     * @dev Simple P256 signature verification (without WebAuthn wrapper)
     * @notice For testing or simple use cases
     */
    function verifyP256Signature(bytes32 message, uint256 r, uint256 s) external view returns (bool) {
        return P256_VERIFIER.verifySignature(message, r, s, ownerX, ownerY);
    }

    receive() external payable {}
}

/**
 * @title PasskeyAccountFactory
 * @dev Factory for creating PasskeyAccount instances
 */
contract PasskeyAccountFactory {
    event AccountCreated(address indexed account, uint256 indexed x, uint256 indexed y);

    address public immutable entryPoint;

    constructor(address _entryPoint) {
        require(_entryPoint != address(0), "entrypoint required");
        entryPoint = _entryPoint;
    }

    /**
     * @dev Get the counterfactual address for a passkey
     */
    function getAddress(uint256 x, uint256 y, uint256 salt) public view returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(abi.encodePacked(
                    type(PasskeyAccount).creationCode,
                    abi.encode(entryPoint, x, y)
                ))
            )
        );
        return address(uint160(uint256(hash)));
    }

    /**
     * @dev Create a new PasskeyAccount
     */
    function createAccount(uint256 x, uint256 y, uint256 salt) external returns (PasskeyAccount account) {
        address addr = getAddress(x, y, salt);
        if (addr.code.length > 0) {
            return PasskeyAccount(payable(addr));
        }

        account = new PasskeyAccount{salt: bytes32(salt)}(entryPoint, x, y);
        emit AccountCreated(address(account), x, y);
    }
}
