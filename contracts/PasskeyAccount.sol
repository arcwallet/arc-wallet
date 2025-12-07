// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IEntryPoint} from "./IEntryPoint.sol";

/**
 * @title P256 Verifier Library
 * @dev Wrapper for P256 verifier at 0xc2b78104907F722DABAc4C69f826a522B2754De4
 * The verifier uses EIP-7212 style fallback: message || r || s || x || y (160 bytes)
 * Returns 0x01 for valid, 0x00 for invalid
 */
library P256Verifier {
    address constant VERIFIER = 0xc2b78104907F722DABAc4C69f826a522B2754De4;

    function verifySignature(
        bytes32 message,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) internal view returns (bool) {
        // EIP-7212 precompile-style call: message || r || s || x || y
        bytes memory data = abi.encodePacked(message, r, s, x, y);

        (bool success, bytes memory result) = VERIFIER.staticcall(data);

        if (!success || result.length < 32) {
            return false;
        }

        // Check if result is 0x01 (valid)
        return abi.decode(result, (uint256)) == 1;
    }
}

// Legacy interface for compatibility (not used by current verifier)
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
        uint256 y
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

        // 4. Verify P256 signature using the library
        return P256Verifier.verifySignature(message, auth.r, auth.s, x, y);
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
 * @notice Includes time-locked recovery mechanism with guardian support
 */
contract PasskeyAccount {
    error NotOwner();
    error InvalidSignature();
    error InvalidNonce();
    error InvalidCaller();
    error RecoveryNotInitiated();
    error RecoveryAlreadyInitiated();
    error RecoveryDelayNotPassed();
    error NotGuardian();
    error InsufficientApprovals();
    error GuardianAlreadyApproved();
    error InvalidGuardian();
    error TooManyGuardians();
    error TooManyBackupKeys();
    error BackupKeyAlreadyExists();
    error BackupKeyNotFound();
    error InvalidBackupKey();

    event Executed(address indexed target, uint256 value, bytes data);
    event OwnerChanged(uint256 indexed newX, uint256 indexed newY);
    event RecoveryInitiated(uint256 indexed newX, uint256 indexed newY, uint256 executeAfter);
    event RecoveryCancelled();
    event RecoveryExecuted(uint256 indexed newX, uint256 indexed newY);
    event GuardianAdded(address indexed guardian);
    event GuardianRemoved(address indexed guardian);
    event GuardianApproved(address indexed guardian, bytes32 indexed recoveryHash);
    event BackupKeyAdded(uint256 indexed x, uint256 indexed y, string deviceName);
    event BackupKeyRemoved(uint256 indexed x, uint256 indexed y);
    event RecoveryByBackupKey(uint256 indexed oldX, uint256 indexed oldY, uint256 newX, uint256 newY);

    IEntryPoint public immutable entryPoint;

    // P256 public key coordinates (owner's passkey)
    uint256 public ownerX;
    uint256 public ownerY;

    uint256 private userOpNonce;

    // ============ Recovery Configuration ============
    uint256 public constant RECOVERY_DELAY = 48 hours;  // Time lock for recovery
    uint256 public constant MAX_GUARDIANS = 5;
    uint256 public constant MAX_BACKUP_KEYS = 3;  // Max backup passkeys for individual users
    uint256 public guardianThreshold;  // Required approvals (e.g., 2 of 3)

    // Guardian storage (for corporate recovery)
    mapping(address => bool) public isGuardian;
    address[] public guardians;

    // Backup passkey storage (for individual recovery)
    struct BackupKey {
        uint256 x;
        uint256 y;
        bool active;
        string deviceName;
    }
    BackupKey[] public backupKeys;
    mapping(bytes32 => bool) public isBackupKeyHash;  // keccak256(x, y) => exists

    // Recovery state
    struct RecoveryRequest {
        uint256 newX;
        uint256 newY;
        uint256 executeAfter;
        uint256 approvalCount;
        mapping(address => bool) approved;
    }
    RecoveryRequest public recoveryRequest;
    bool public recoveryInitiated;

    constructor(address _entryPoint, uint256 _ownerX, uint256 _ownerY) {
        require(_entryPoint != address(0), "entrypoint required");
        require(_ownerX != 0 && _ownerY != 0, "owner key required");
        entryPoint = IEntryPoint(_entryPoint);
        ownerX = _ownerX;
        ownerY = _ownerY;
        guardianThreshold = 1;  // Default: 1 guardian needed
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

    // ============ Backup Key Management (Individual Users) ============

    /**
     * @dev Add a backup passkey (owner only via UserOp)
     * @notice Allows user to add up to 3 backup devices for recovery
     * @param x P256 public key X coordinate of backup device
     * @param y P256 public key Y coordinate of backup device
     * @param deviceName Human-readable device name (e.g., "iPhone", "iPad")
     */
    function addBackupKey(uint256 x, uint256 y, string calldata deviceName) external {
        require(msg.sender == address(this), "only self");
        if (x == 0 || y == 0) revert InvalidBackupKey();
        if (backupKeys.length >= MAX_BACKUP_KEYS) revert TooManyBackupKeys();

        bytes32 keyHash = keccak256(abi.encodePacked(x, y));
        if (isBackupKeyHash[keyHash]) revert BackupKeyAlreadyExists();

        // Don't allow adding primary key as backup
        if (x == ownerX && y == ownerY) revert BackupKeyAlreadyExists();

        backupKeys.push(BackupKey({
            x: x,
            y: y,
            active: true,
            deviceName: deviceName
        }));
        isBackupKeyHash[keyHash] = true;

        emit BackupKeyAdded(x, y, deviceName);
    }

    /**
     * @dev Remove a backup passkey (owner only via UserOp)
     * @param x P256 public key X coordinate
     * @param y P256 public key Y coordinate
     */
    function removeBackupKey(uint256 x, uint256 y) external {
        require(msg.sender == address(this), "only self");

        bytes32 keyHash = keccak256(abi.encodePacked(x, y));
        if (!isBackupKeyHash[keyHash]) revert BackupKeyNotFound();

        // Find and remove
        for (uint256 i = 0; i < backupKeys.length; i++) {
            if (backupKeys[i].x == x && backupKeys[i].y == y) {
                backupKeys[i] = backupKeys[backupKeys.length - 1];
                backupKeys.pop();
                isBackupKeyHash[keyHash] = false;
                emit BackupKeyRemoved(x, y);
                return;
            }
        }
        revert BackupKeyNotFound();
    }

    /**
     * @dev Get all backup keys
     */
    function getBackupKeys() external view returns (BackupKey[] memory) {
        return backupKeys;
    }

    /**
     * @dev Get backup key count
     */
    function getBackupKeyCount() external view returns (uint256) {
        return backupKeys.length;
    }

    /**
     * @dev Check if a key is a valid backup key
     */
    function isValidBackupKey(uint256 x, uint256 y) public view returns (bool) {
        bytes32 keyHash = keccak256(abi.encodePacked(x, y));
        return isBackupKeyHash[keyHash];
    }

    /**
     * @dev Recover using backup passkey (for individual users)
     * @notice Backup key can immediately take over as primary - no timelock needed
     * @notice This validates a WebAuthn signature from the backup key
     * @param newPrimaryX New primary key X coordinate (can be same as backup key)
     * @param newPrimaryY New primary key Y coordinate (can be same as backup key)
     * @param backupX Backup key X coordinate
     * @param backupY Backup key Y coordinate
     * @param webAuthnSignature Encoded WebAuthn signature (authenticatorData, clientDataJSON, challengeIndex, typeIndex, r, s)
     */
    function recoverWithBackupKey(
        uint256 newPrimaryX,
        uint256 newPrimaryY,
        uint256 backupX,
        uint256 backupY,
        bytes calldata webAuthnSignature
    ) external {
        require(newPrimaryX != 0 && newPrimaryY != 0, "invalid new key");

        // Verify backup key is registered
        if (!isValidBackupKey(backupX, backupY)) revert BackupKeyNotFound();

        // Verify signature
        bytes32 challenge = keccak256(abi.encodePacked(
            "RECOVER",
            address(this),
            newPrimaryX,
            newPrimaryY,
            block.chainid
        ));

        if (!_verifyBackupSignature(challenge, webAuthnSignature, backupX, backupY)) {
            revert InvalidSignature();
        }

        // Emit events before state change
        emit RecoveryByBackupKey(ownerX, ownerY, newPrimaryX, newPrimaryY);

        // Update primary owner
        ownerX = newPrimaryX;
        ownerY = newPrimaryY;

        emit OwnerChanged(newPrimaryX, newPrimaryY);
    }

    /**
     * @dev Internal function to verify backup key WebAuthn signature
     */
    function _verifyBackupSignature(
        bytes32 challenge,
        bytes calldata signature,
        uint256 x,
        uint256 y
    ) internal view returns (bool) {
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

        return WebAuthn.verify(abi.encodePacked(challenge), auth, x, y);
    }

    // ============ Guardian Management (Corporate Users) ============

    /**
     * @dev Add a guardian (only owner via UserOp)
     * @param guardian Address of the guardian to add
     */
    function addGuardian(address guardian) external {
        require(msg.sender == address(this), "only self");
        if (guardian == address(0)) revert InvalidGuardian();
        if (isGuardian[guardian]) revert InvalidGuardian();
        if (guardians.length >= MAX_GUARDIANS) revert TooManyGuardians();

        isGuardian[guardian] = true;
        guardians.push(guardian);
        emit GuardianAdded(guardian);
    }

    /**
     * @dev Remove a guardian (only owner via UserOp)
     * @param guardian Address of the guardian to remove
     */
    function removeGuardian(address guardian) external {
        require(msg.sender == address(this), "only self");
        if (!isGuardian[guardian]) revert NotGuardian();

        isGuardian[guardian] = false;

        // Remove from array
        for (uint256 i = 0; i < guardians.length; i++) {
            if (guardians[i] == guardian) {
                guardians[i] = guardians[guardians.length - 1];
                guardians.pop();
                break;
            }
        }
        emit GuardianRemoved(guardian);
    }

    /**
     * @dev Set guardian threshold (only owner via UserOp)
     * @param threshold Number of guardians required for recovery
     */
    function setGuardianThreshold(uint256 threshold) external {
        require(msg.sender == address(this), "only self");
        require(threshold > 0, "threshold must be > 0");
        require(threshold <= guardians.length || guardians.length == 0, "threshold > guardians");
        guardianThreshold = threshold;
    }

    /**
     * @dev Get all guardians
     */
    function getGuardians() external view returns (address[] memory) {
        return guardians;
    }

    /**
     * @dev Get guardian count
     */
    function getGuardianCount() external view returns (uint256) {
        return guardians.length;
    }

    // ============ Recovery Functions ============

    /**
     * @dev Initiate recovery process (guardian only)
     * @notice Starts 48-hour timelock before recovery can be executed
     * @param newX New owner's P256 public key X coordinate
     * @param newY New owner's P256 public key Y coordinate
     */
    function initiateRecovery(uint256 newX, uint256 newY) external {
        if (!isGuardian[msg.sender]) revert NotGuardian();
        if (recoveryInitiated) revert RecoveryAlreadyInitiated();
        require(newX != 0 && newY != 0, "invalid key");
        require(guardians.length >= guardianThreshold, "not enough guardians");

        recoveryRequest.newX = newX;
        recoveryRequest.newY = newY;
        recoveryRequest.executeAfter = block.timestamp + RECOVERY_DELAY;
        recoveryRequest.approvalCount = 1;
        recoveryRequest.approved[msg.sender] = true;
        recoveryInitiated = true;

        emit RecoveryInitiated(newX, newY, recoveryRequest.executeAfter);
        emit GuardianApproved(msg.sender, keccak256(abi.encodePacked(newX, newY)));
    }

    /**
     * @dev Approve an existing recovery request (guardian only)
     */
    function approveRecovery() external {
        if (!isGuardian[msg.sender]) revert NotGuardian();
        if (!recoveryInitiated) revert RecoveryNotInitiated();
        if (recoveryRequest.approved[msg.sender]) revert GuardianAlreadyApproved();

        recoveryRequest.approved[msg.sender] = true;
        recoveryRequest.approvalCount++;

        emit GuardianApproved(
            msg.sender,
            keccak256(abi.encodePacked(recoveryRequest.newX, recoveryRequest.newY))
        );
    }

    /**
     * @dev Execute recovery after timelock (anyone can call if conditions met)
     */
    function executeRecovery() external {
        if (!recoveryInitiated) revert RecoveryNotInitiated();
        if (block.timestamp < recoveryRequest.executeAfter) revert RecoveryDelayNotPassed();
        if (recoveryRequest.approvalCount < guardianThreshold) revert InsufficientApprovals();

        uint256 newX = recoveryRequest.newX;
        uint256 newY = recoveryRequest.newY;

        // Reset recovery state
        _resetRecovery();

        // Update owner
        ownerX = newX;
        ownerY = newY;

        emit RecoveryExecuted(newX, newY);
        emit OwnerChanged(newX, newY);
    }

    /**
     * @dev Cancel recovery (owner only via UserOp)
     * @notice Owner can cancel any pending recovery if they still have access
     */
    function cancelRecovery() external {
        require(msg.sender == address(this), "only self");
        if (!recoveryInitiated) revert RecoveryNotInitiated();

        _resetRecovery();
        emit RecoveryCancelled();
    }

    /**
     * @dev Internal function to reset recovery state
     */
    function _resetRecovery() internal {
        // Clear approvals
        for (uint256 i = 0; i < guardians.length; i++) {
            recoveryRequest.approved[guardians[i]] = false;
        }

        recoveryRequest.newX = 0;
        recoveryRequest.newY = 0;
        recoveryRequest.executeAfter = 0;
        recoveryRequest.approvalCount = 0;
        recoveryInitiated = false;
    }

    /**
     * @dev Get recovery request details
     */
    function getRecoveryRequest() external view returns (
        uint256 newX,
        uint256 newY,
        uint256 executeAfter,
        uint256 approvalCount,
        bool initiated
    ) {
        return (
            recoveryRequest.newX,
            recoveryRequest.newY,
            recoveryRequest.executeAfter,
            recoveryRequest.approvalCount,
            recoveryInitiated
        );
    }

    /**
     * @dev Check if a guardian has approved current recovery
     */
    function hasGuardianApproved(address guardian) external view returns (bool) {
        return recoveryRequest.approved[guardian];
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

        return WebAuthn.verify(abi.encodePacked(challenge), auth, ownerX, ownerY);
    }

    /**
     * @dev Simple P256 signature verification (without WebAuthn wrapper)
     * @notice For testing or simple use cases
     */
    function verifyP256Signature(bytes32 message, uint256 r, uint256 s) external view returns (bool) {
        return P256Verifier.verifySignature(message, r, s, ownerX, ownerY);
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
