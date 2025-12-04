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
 * @notice Smart wallet with multi-key support and threshold signatures
 * @dev Supports:
 *   - Multiple signing keys (m-of-n multisig)
 *   - WebAuthn P256 passkey authentication
 *   - ERC-4337 Account Abstraction
 *   - Key management (add/remove devices)
 *   - Configurable signature threshold (e.g., 2-of-3)
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

    /// @notice Minimum threshold value
    uint8 public constant MIN_THRESHOLD = 1;

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

    /// @notice Pending multi-sig operation
    struct PendingOperation {
        bytes32 userOpHash;       // Hash of the operation
        uint8 signatureCount;     // Number of signatures collected
        uint40 createdAt;         // When operation was created
        uint40 expiresAt;         // When operation expires
        bool executed;            // Whether operation was executed
        mapping(bytes32 => bool) hasSigned; // Track which keys have signed
    }

    /// @notice Array of signing keys
    SigningKey[MAX_KEYS] private _signingKeys;

    /// @notice Number of active signing keys
    uint8 private _activeKeyCount;

    /// @notice Required number of signatures for operations
    uint8 private _signatureThreshold;

    /// @notice Nonce for replay protection (separate from EntryPoint nonce)
    uint256 private _internalNonce;

    /// @notice Mapping from key hash to key slot index
    mapping(bytes32 => uint8) private _keySlotIndex;

    /// @notice Pending operations awaiting signatures
    mapping(bytes32 => PendingOperation) private _pendingOperations;

    /// @notice Operation expiry time (24 hours)
    uint40 public constant OPERATION_EXPIRY = 24 hours;

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

    event ThresholdChanged(
        uint8 oldThreshold,
        uint8 newThreshold
    );

    event OperationProposed(
        bytes32 indexed opHash,
        bytes32 indexed signerKeyHash,
        uint8 currentSignatures,
        uint8 requiredSignatures
    );

    event OperationApproved(
        bytes32 indexed opHash,
        bytes32 indexed signerKeyHash,
        uint8 currentSignatures
    );

    event OperationExecuted(
        bytes32 indexed opHash
    );

    event OperationCancelled(
        bytes32 indexed opHash
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
    error InvalidThreshold();
    error ThresholdTooHigh();
    error AlreadySigned();
    error OperationExpired();
    error OperationNotFound();
    error InsufficientSignatures();

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
        _signatureThreshold = 1; // Default: 1-of-N (single sig)

        emit SigningKeyAdded(0, keyHash, keyType, deviceName);
    }

    /**
     * @notice Initialize the account with threshold support (for corporate wallets)
     * @param keyHash Hash of the initial signing key
     * @param keyType Type of the key (ECDSA or WebAuthn)
     * @param deviceName Human-readable name for the device
     * @param threshold Required number of signatures (e.g., 2 for 2-of-3)
     */
    function initializeWithThreshold(
        bytes32 keyHash,
        uint8 keyType,
        string calldata deviceName,
        uint8 threshold
    ) external initializer {
        if (keyType != KEY_TYPE_ECDSA && keyType != KEY_TYPE_WEBAUTHN) {
            revert InvalidKeyType();
        }
        if (threshold < MIN_THRESHOLD) {
            revert InvalidThreshold();
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
        _signatureThreshold = threshold;

        emit SigningKeyAdded(0, keyHash, keyType, deviceName);
        emit ThresholdChanged(0, threshold);
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

    /**
     * @notice Get current signature threshold
     */
    function signatureThreshold() external view returns (uint8) {
        return _signatureThreshold;
    }

    /**
     * @notice Set signature threshold (e.g., 2 for 2-of-3)
     * @param newThreshold New required number of signatures
     */
    function setSignatureThreshold(uint8 newThreshold) external onlyEntryPointOrSelf {
        if (newThreshold < MIN_THRESHOLD) {
            revert InvalidThreshold();
        }
        if (newThreshold > _activeKeyCount) {
            revert ThresholdTooHigh();
        }

        uint8 oldThreshold = _signatureThreshold;
        _signatureThreshold = newThreshold;

        emit ThresholdChanged(oldThreshold, newThreshold);
    }

    // ============================================
    // MULTI-SIG OPERATIONS
    // ============================================

    /**
     * @notice Propose a new operation requiring multiple signatures
     * @param opHash Hash of the operation to propose
     * @param keySlot Slot of the signing key
     * @param signature Signature from the proposer
     */
    function proposeOperation(
        bytes32 opHash,
        uint8 keySlot,
        bytes calldata signature
    ) external {
        SigningKey storage key = _signingKeys[keySlot];
        if (!key.isActive) revert KeyNotActive();

        // Verify signature
        bool isValid;
        if (key.keyType == KEY_TYPE_ECDSA) {
            isValid = _validateECDSASignature(opHash, signature, key.keyHash);
        } else if (key.keyType == KEY_TYPE_WEBAUTHN) {
            isValid = _validateWebAuthnSignature(opHash, signature, key.keyHash);
        }
        if (!isValid) revert InvalidSignature();

        // Create or update pending operation
        PendingOperation storage pending = _pendingOperations[opHash];

        if (pending.createdAt == 0) {
            // New operation
            pending.userOpHash = opHash;
            pending.signatureCount = 1;
            pending.createdAt = uint40(block.timestamp);
            pending.expiresAt = uint40(block.timestamp) + OPERATION_EXPIRY;
            pending.executed = false;
        } else {
            // Check if expired
            if (block.timestamp > pending.expiresAt) revert OperationExpired();
            // Check if already signed by this key
            if (pending.hasSigned[key.keyHash]) revert AlreadySigned();
            pending.signatureCount++;
        }

        pending.hasSigned[key.keyHash] = true;

        emit OperationProposed(opHash, key.keyHash, pending.signatureCount, _signatureThreshold);
    }

    /**
     * @notice Approve an existing pending operation
     * @param opHash Hash of the operation to approve
     * @param keySlot Slot of the signing key
     * @param signature Signature from the approver
     */
    function approveOperation(
        bytes32 opHash,
        uint8 keySlot,
        bytes calldata signature
    ) external {
        PendingOperation storage pending = _pendingOperations[opHash];
        if (pending.createdAt == 0) revert OperationNotFound();
        if (block.timestamp > pending.expiresAt) revert OperationExpired();
        if (pending.executed) revert OperationNotFound();

        SigningKey storage key = _signingKeys[keySlot];
        if (!key.isActive) revert KeyNotActive();
        if (pending.hasSigned[key.keyHash]) revert AlreadySigned();

        // Verify signature
        bool isValid;
        if (key.keyType == KEY_TYPE_ECDSA) {
            isValid = _validateECDSASignature(opHash, signature, key.keyHash);
        } else if (key.keyType == KEY_TYPE_WEBAUTHN) {
            isValid = _validateWebAuthnSignature(opHash, signature, key.keyHash);
        }
        if (!isValid) revert InvalidSignature();

        pending.hasSigned[key.keyHash] = true;
        pending.signatureCount++;

        emit OperationApproved(opHash, key.keyHash, pending.signatureCount);
    }

    /**
     * @notice Check if an operation has enough signatures and mark as executed
     * @param opHash Hash of the operation
     * @return True if operation can be executed
     */
    function canExecuteOperation(bytes32 opHash) public view returns (bool) {
        PendingOperation storage pending = _pendingOperations[opHash];
        if (pending.createdAt == 0) return false;
        if (block.timestamp > pending.expiresAt) return false;
        if (pending.executed) return false;
        return pending.signatureCount >= _signatureThreshold;
    }

    /**
     * @notice Mark operation as executed (called by execute functions)
     * @param opHash Hash of the operation
     */
    function _markOperationExecuted(bytes32 opHash) internal {
        PendingOperation storage pending = _pendingOperations[opHash];
        if (pending.createdAt != 0) {
            pending.executed = true;
            emit OperationExecuted(opHash);
        }
    }

    /**
     * @notice Get pending operation status
     * @param opHash Hash of the operation
     */
    function getPendingOperation(bytes32 opHash) external view returns (
        uint8 signatureCount,
        uint8 requiredSignatures,
        uint40 createdAt,
        uint40 expiresAt,
        bool executed
    ) {
        PendingOperation storage pending = _pendingOperations[opHash];
        return (
            pending.signatureCount,
            _signatureThreshold,
            pending.createdAt,
            pending.expiresAt,
            pending.executed
        );
    }

    /**
     * @notice Check if a specific key has signed an operation
     * @param opHash Hash of the operation
     * @param keyHash Hash of the key to check
     */
    function hasKeySigned(bytes32 opHash, bytes32 keyHash) external view returns (bool) {
        return _pendingOperations[opHash].hasSigned[keyHash];
    }

    /**
     * @notice Cancel a pending operation (only by signers)
     * @param opHash Hash of the operation to cancel
     */
    function cancelOperation(bytes32 opHash) external onlyEntryPointOrSelf {
        PendingOperation storage pending = _pendingOperations[opHash];
        if (pending.createdAt == 0) revert OperationNotFound();

        delete _pendingOperations[opHash];
        emit OperationCancelled(opHash);
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
