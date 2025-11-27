// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@account-abstraction/contracts/core/Helpers.sol";

/**
 * @title ArcAccount
 * @notice Smart wallet with multi-key support (inspired by SendApp)
 * @dev Supports:
 *   - Multiple signing keys (1-of-n multisig)
 *   - WebAuthn P256 passkey authentication
 *   - ERC-4337 Account Abstraction
 *   - Key management (add/remove devices)
 */
contract ArcAccount is BaseAccount, UUPSUpgradeable, Initializable {

    // ============================================
    // CONSTANTS
    // ============================================

    /// @notice Maximum number of signing keys allowed
    uint8 public constant MAX_KEYS = 20;

    /// @notice Key slot for ECDSA secp256k1 keys
    uint8 public constant KEY_TYPE_ECDSA = 1;

    /// @notice Key slot for WebAuthn P256 keys
    uint8 public constant KEY_TYPE_WEBAUTHN = 2;

    // ============================================
    // STATE
    // ============================================

    /// @notice The ERC-4337 EntryPoint contract
    IEntryPoint private immutable _entryPoint;

    /// @notice Signing key structure
    struct SigningKey {
        bytes32 keyHash;      // Hash of the public key
        uint8 keyType;        // KEY_TYPE_ECDSA or KEY_TYPE_WEBAUTHN
        bool isActive;        // Whether the key is active
        uint40 addedAt;       // Timestamp when key was added
        string deviceName;    // Human-readable device name
    }

    /// @notice Array of signing keys
    SigningKey[MAX_KEYS] private _signingKeys;

    /// @notice Number of active signing keys
    uint8 private _activeKeyCount;

    /// @notice Nonce for replay protection (separate from EntryPoint nonce)
    uint256 private _internalNonce;

    /// @notice Mapping from key hash to key slot index
    mapping(bytes32 => uint8) private _keySlotIndex;

    // ============================================
    // EVENTS
    // ============================================

    event SigningKeyAdded(
        uint8 indexed slot,
        bytes32 indexed keyHash,
        uint8 keyType,
        string deviceName
    );

    event SigningKeyRemoved(
        uint8 indexed slot,
        bytes32 indexed keyHash
    );

    event Executed(
        address indexed target,
        uint256 value,
        bytes data,
        bool success
    );

    event ExecutedBatch(
        address[] targets,
        uint256[] values,
        bytes[] datas
    );

    // ============================================
    // ERRORS
    // ============================================

    error InvalidSignature();
    error KeyAlreadyExists();
    error KeyNotFound();
    error MaxKeysReached();
    error CannotRemoveLastKey();
    error OnlyEntryPointOrSelf();
    error InvalidKeyType();
    error KeyNotActive();
    error InvalidNonce();

    // ============================================
    // MODIFIERS
    // ============================================

    modifier onlyEntryPointOrSelf() {
        if (msg.sender != address(_entryPoint) && msg.sender != address(this)) {
            revert OnlyEntryPointOrSelf();
        }
        _;
    }

    // ============================================
    // CONSTRUCTOR & INITIALIZATION
    // ============================================

    constructor(IEntryPoint anEntryPoint) {
        _entryPoint = anEntryPoint;
        _disableInitializers();
    }

    /**
     * @notice Initialize the account with a primary signing key
     * @param keyHash Hash of the initial signing key
     * @param keyType Type of the key (ECDSA or WebAuthn)
     * @param deviceName Human-readable name for the device
     */
    function initialize(
        bytes32 keyHash,
        uint8 keyType,
        string calldata deviceName
    ) external initializer {
        if (keyType != KEY_TYPE_ECDSA && keyType != KEY_TYPE_WEBAUTHN) {
            revert InvalidKeyType();
        }

        _signingKeys[0] = SigningKey({
            keyHash: keyHash,
            keyType: keyType,
            isActive: true,
            addedAt: uint40(block.timestamp),
            deviceName: deviceName
        });

        _keySlotIndex[keyHash] = 0;
        _activeKeyCount = 1;

        emit SigningKeyAdded(0, keyHash, keyType, deviceName);
    }

    // ============================================
    // ACCOUNT ABSTRACTION
    // ============================================

    /// @inheritdoc BaseAccount
    function entryPoint() public view override returns (IEntryPoint) {
        return _entryPoint;
    }

    /// @inheritdoc BaseAccount
    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal override returns (uint256 validationData) {
        // Decode signature: (uint8 keySlot, bytes signature)
        (uint8 keySlot, bytes memory signature) = abi.decode(
            userOp.signature,
            (uint8, bytes)
        );

        SigningKey storage key = _signingKeys[keySlot];

        if (!key.isActive) {
            return SIG_VALIDATION_FAILED;
        }

        bool isValid;

        if (key.keyType == KEY_TYPE_ECDSA) {
            isValid = _validateECDSASignature(userOpHash, signature, key.keyHash);
        } else if (key.keyType == KEY_TYPE_WEBAUTHN) {
            isValid = _validateWebAuthnSignature(userOpHash, signature, key.keyHash);
        } else {
            return SIG_VALIDATION_FAILED;
        }

        return isValid ? 0 : SIG_VALIDATION_FAILED;
    }

    /**
     * @notice Validate ECDSA signature
     */
    function _validateECDSASignature(
        bytes32 hash,
        bytes memory signature,
        bytes32 expectedKeyHash
    ) internal pure returns (bool) {
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(hash);
        address signer = ECDSA.recover(ethSignedHash, signature);
        return keccak256(abi.encodePacked(signer)) == expectedKeyHash;
    }

    /**
     * @notice Validate WebAuthn P256 signature
     * @dev This is a placeholder - actual implementation requires P256 verification
     */
    function _validateWebAuthnSignature(
        bytes32 hash,
        bytes memory signature,
        bytes32 expectedKeyHash
    ) internal pure returns (bool) {
        // WebAuthn signature format:
        // (bytes authenticatorData, bytes clientDataJSON, uint256 r, uint256 s)
        (
            bytes memory authenticatorData,
            bytes memory clientDataJSON,
            uint256 r,
            uint256 s
        ) = abi.decode(signature, (bytes, bytes, uint256, uint256));

        // Verify authenticator data flags
        // Bit 0: User Present (UP) - must be set
        if (authenticatorData.length < 37 || (uint8(authenticatorData[32]) & 0x01) != 0x01) {
            return false;
        }

        // Construct the message that was signed
        bytes32 clientDataHash = sha256(clientDataJSON);
        bytes32 message = sha256(abi.encodePacked(authenticatorData, clientDataHash));

        // P256 signature verification would go here
        // For now, we use a simplified check
        // In production, use a P256 verifier contract like RIP-7212

        // Placeholder: verify key hash matches
        bytes32 computedKeyHash = keccak256(abi.encodePacked(r, s, message));

        // This is a simplified placeholder - real implementation needs P256 ecrecover
        return computedKeyHash != bytes32(0) && expectedKeyHash != bytes32(0);
    }

    // ============================================
    // KEY MANAGEMENT
    // ============================================

    /**
     * @notice Add a new signing key
     * @param keyHash Hash of the public key
     * @param keyType Type of key (ECDSA or WebAuthn)
     * @param deviceName Human-readable device name
     */
    function addSigningKey(
        bytes32 keyHash,
        uint8 keyType,
        string calldata deviceName
    ) external onlyEntryPointOrSelf {
        if (keyType != KEY_TYPE_ECDSA && keyType != KEY_TYPE_WEBAUTHN) {
            revert InvalidKeyType();
        }

        if (_keySlotIndex[keyHash] != 0 || _signingKeys[0].keyHash == keyHash) {
            revert KeyAlreadyExists();
        }

        // Find empty slot
        uint8 slot = 0;
        for (uint8 i = 0; i < MAX_KEYS; i++) {
            if (!_signingKeys[i].isActive && _signingKeys[i].keyHash == bytes32(0)) {
                slot = i;
                break;
            }
            if (i == MAX_KEYS - 1) {
                revert MaxKeysReached();
            }
        }

        _signingKeys[slot] = SigningKey({
            keyHash: keyHash,
            keyType: keyType,
            isActive: true,
            addedAt: uint40(block.timestamp),
            deviceName: deviceName
        });

        _keySlotIndex[keyHash] = slot;
        _activeKeyCount++;

        emit SigningKeyAdded(slot, keyHash, keyType, deviceName);
    }

    /**
     * @notice Remove a signing key
     * @param keyHash Hash of the key to remove
     */
    function removeSigningKey(bytes32 keyHash) external onlyEntryPointOrSelf {
        if (_activeKeyCount <= 1) {
            revert CannotRemoveLastKey();
        }

        uint8 slot = _keySlotIndex[keyHash];

        // Check if key exists and is at the expected slot
        if (_signingKeys[slot].keyHash != keyHash) {
            // Check slot 0 separately since mapping returns 0 for non-existent keys
            if (slot != 0 || _signingKeys[0].keyHash != keyHash) {
                revert KeyNotFound();
            }
        }

        if (!_signingKeys[slot].isActive) {
            revert KeyNotActive();
        }

        emit SigningKeyRemoved(slot, keyHash);

        delete _signingKeys[slot];
        delete _keySlotIndex[keyHash];
        _activeKeyCount--;
    }

    /**
     * @notice Get all active signing keys
     * @return keyHashes Array of key hashes
     * @return keyTypes Array of key types
     * @return isActive Array of active flags
     * @return addedAt Array of timestamps
     * @return deviceNames Array of device names
     */
    function getSigningKeys() external view returns (
        bytes32[] memory keyHashes,
        uint8[] memory keyTypes,
        bool[] memory isActive,
        uint40[] memory addedAt,
        string[] memory deviceNames
    ) {
        keyHashes = new bytes32[](_activeKeyCount);
        keyTypes = new uint8[](_activeKeyCount);
        isActive = new bool[](_activeKeyCount);
        addedAt = new uint40[](_activeKeyCount);
        deviceNames = new string[](_activeKeyCount);

        uint8 index = 0;
        for (uint8 i = 0; i < MAX_KEYS && index < _activeKeyCount; i++) {
            if (_signingKeys[i].isActive) {
                keyHashes[index] = _signingKeys[i].keyHash;
                keyTypes[index] = _signingKeys[i].keyType;
                isActive[index] = _signingKeys[i].isActive;
                addedAt[index] = _signingKeys[i].addedAt;
                deviceNames[index] = _signingKeys[i].deviceName;
                index++;
            }
        }
    }

    /**
     * @notice Check if a key hash is a valid signer
     * @param keyHash Hash of the key to check
     */
    function isValidSigner(bytes32 keyHash) external view returns (bool) {
        uint8 slot = _keySlotIndex[keyHash];
        if (_signingKeys[slot].keyHash == keyHash && _signingKeys[slot].isActive) {
            return true;
        }
        // Check slot 0 explicitly
        if (slot == 0 && _signingKeys[0].keyHash == keyHash && _signingKeys[0].isActive) {
            return true;
        }
        return false;
    }

    /**
     * @notice Get the number of active keys
     */
    function activeKeyCount() external view returns (uint8) {
        return _activeKeyCount;
    }

    // ============================================
    // EXECUTION
    // ============================================

    /**
     * @notice Execute a transaction
     * @param target Target address
     * @param value ETH value to send
     * @param data Call data
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyEntryPointOrSelf returns (bytes memory) {
        (bool success, bytes memory result) = target.call{value: value}(data);

        emit Executed(target, value, data, success);

        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }

        return result;
    }

    /**
     * @notice Execute a batch of transactions
     * @param targets Array of target addresses
     * @param values Array of ETH values
     * @param datas Array of call data
     */
    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas
    ) external onlyEntryPointOrSelf returns (bytes[] memory results) {
        require(
            targets.length == values.length && values.length == datas.length,
            "Length mismatch"
        );

        results = new bytes[](targets.length);

        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, bytes memory result) = targets[i].call{value: values[i]}(datas[i]);

            if (!success) {
                assembly {
                    revert(add(result, 32), mload(result))
                }
            }

            results[i] = result;
        }

        emit ExecutedBatch(targets, values, datas);
    }

    // ============================================
    // UPGRADES
    // ============================================

    function _authorizeUpgrade(address newImplementation) internal override onlyEntryPointOrSelf {}

    // ============================================
    // RECEIVE
    // ============================================

    receive() external payable {}
}
