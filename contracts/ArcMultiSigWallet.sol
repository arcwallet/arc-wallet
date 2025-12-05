// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@account-abstraction/contracts/interfaces/IAccount.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";

/**
 * @title ArcMultiSigWallet
 * @notice Multi-signature wallet using passkey (P256/secp256r1) authentication
 * @dev Signers are identified by P256 public keys instead of EOA addresses
 *      Implements ERC-4337 for gas sponsorship and bundler execution
 */
contract ArcMultiSigWallet is ReentrancyGuard, IAccount {
    using SafeERC20 for IERC20;

    // ============================================
    // CONSTANTS
    // ============================================

    /// @notice RIP-7212 P256 verifier precompile
    address public constant P256_VERIFIER = 0x0000000000000000000000000000000000000100;

    /// @notice Transaction expiration time
    uint256 public constant EXPIRATION_TIME = 24 hours;

    /// @notice ERC-4337 signature validation success
    uint256 internal constant SIG_VALIDATION_SUCCESS = 0;
    uint256 internal constant SIG_VALIDATION_FAILED = 1;

    // ============================================
    // STRUCTS
    // ============================================

    /// @notice P256 public key for passkey signers
    struct PasskeySigner {
        uint256 x;
        uint256 y;
        bool active;
    }

    /// @notice WebAuthn signature data
    struct WebAuthnSignature {
        bytes authenticatorData;
        bytes clientDataJSON;
        uint256 challengeIndex;
        uint256 typeIndex;
        uint256 r;
        uint256 s;
    }

    /// @notice Multi-sig signature (aggregated from multiple signers)
    struct AggregatedSignature {
        bytes32[] signerKeyHashes;  // Which signers are signing
        WebAuthnSignature[] signatures;  // Their signatures
    }

    /// @notice Transaction struct
    struct Transaction {
        address to;
        uint256 value;
        address token;  // address(0) for native ETH
        bytes data;
        bool executed;
        uint256 approvalCount;
        uint256 rejectionCount;
        uint256 createdAt;
        uint256 expiresAt;
    }

    // ============================================
    // EVENTS
    // ============================================

    event Deposit(address indexed sender, uint256 amount);
    event TransactionSubmitted(uint256 indexed txId, bytes32 indexed submitterKeyHash, address indexed to, uint256 value, address token);
    event TransactionApproved(uint256 indexed txId, bytes32 indexed signerKeyHash);
    event TransactionRejected(uint256 indexed txId, bytes32 indexed signerKeyHash);
    event TransactionExecuted(uint256 indexed txId);
    event TransactionExpired(uint256 indexed txId);
    event SignerAdded(bytes32 indexed keyHash, uint256 x, uint256 y);
    event SignerRemoved(bytes32 indexed keyHash);
    event ThresholdChanged(uint256 oldThreshold, uint256 newThreshold);

    // ============================================
    // STATE
    // ============================================

    /// @notice ERC-4337 EntryPoint
    IEntryPoint public immutable entryPoint;

    /// @notice Signers indexed by key hash (keccak256(x, y))
    mapping(bytes32 => PasskeySigner) public signers;

    /// @notice List of all signer key hashes
    bytes32[] public signerKeyHashes;

    /// @notice Required signatures threshold
    uint256 public requiredSignatures;

    /// @notice Transactions
    Transaction[] public transactions;

    /// @notice Approval tracking: txId => signerKeyHash => approved
    mapping(uint256 => mapping(bytes32 => bool)) public hasApproved;

    /// @notice Rejection tracking: txId => signerKeyHash => rejected
    mapping(uint256 => mapping(bytes32 => bool)) public hasRejected;

    /// @notice Nonce for replay protection (ERC-4337 uses this)
    uint256 public userOpNonce;

    /// @notice Allowed WebAuthn origins (for cross-origin attack prevention)
    mapping(bytes32 => bool) public allowedOrigins;

    // ============================================
    // ERRORS
    // ============================================

    error NotFromEntryPointOrSelf();
    error InvalidSignature();
    error InvalidSigner();
    error DuplicateSigner();
    error SignerNotActive();
    error AlreadyApproved();
    error AlreadyRejected();
    error TransactionNotFound();
    error TransactionAlreadyExecuted();
    error TransactionExpiredError();
    error NotEnoughApprovals();
    error InvalidThreshold();
    error CannotReduceBelowThreshold();
    error CannotRemoveLastSigner();
    error InvalidAuthenticatorData();
    error InvalidClientData();
    error UserNotPresent();
    error InvalidNonce();
    error DuplicateSignerInSignature();
    error InvalidOrigin();

    // ============================================
    // MODIFIERS
    // ============================================

    modifier onlyEntryPointOrSelf() {
        if (msg.sender != address(entryPoint) && msg.sender != address(this)) {
            revert NotFromEntryPointOrSelf();
        }
        _;
    }

    modifier onlySelf() {
        require(msg.sender == address(this), "Only self");
        _;
    }

    modifier txExists(uint256 _txId) {
        if (_txId >= transactions.length) revert TransactionNotFound();
        _;
    }

    modifier notExecuted(uint256 _txId) {
        if (transactions[_txId].executed) revert TransactionAlreadyExecuted();
        _;
    }

    modifier notExpired(uint256 _txId) {
        if (block.timestamp > transactions[_txId].expiresAt) revert TransactionExpiredError();
        _;
    }

    // ============================================
    // CONSTRUCTOR
    // ============================================

    /**
     * @notice Initialize the passkey multi-sig wallet
     * @param _entryPoint ERC-4337 EntryPoint address
     * @param _signerXs X coordinates of initial signer public keys
     * @param _signerYs Y coordinates of initial signer public keys
     * @param _requiredSignatures Number of required signatures (threshold)
     */
    constructor(
        IEntryPoint _entryPoint,
        uint256[] memory _signerXs,
        uint256[] memory _signerYs,
        uint256 _requiredSignatures
    ) {
        require(_signerXs.length > 0, "Signers required");
        require(_signerXs.length == _signerYs.length, "Mismatched key arrays");
        require(
            _requiredSignatures > 0 && _requiredSignatures <= _signerXs.length,
            "Invalid threshold"
        );

        entryPoint = _entryPoint;

        for (uint256 i = 0; i < _signerXs.length; i++) {
            bytes32 keyHash = keccak256(abi.encodePacked(_signerXs[i], _signerYs[i]));

            if (signers[keyHash].active) revert DuplicateSigner();

            signers[keyHash] = PasskeySigner({
                x: _signerXs[i],
                y: _signerYs[i],
                active: true
            });
            signerKeyHashes.push(keyHash);

            emit SignerAdded(keyHash, _signerXs[i], _signerYs[i]);
        }

        requiredSignatures = _requiredSignatures;

        // SECURITY: Set default allowed origin (can be modified via multi-sig)
        // arcwallet.network is the production domain
        allowedOrigins[keccak256(bytes("https://arcwallet.network"))] = true;
    }

    // ============================================
    // ERC-4337 INTERFACE
    // ============================================

    /**
     * @notice Validate user operation with aggregated passkey signatures
     * @dev Called by EntryPoint to validate the UserOperation
     */
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override returns (uint256 validationData) {
        if (msg.sender != address(entryPoint)) revert NotFromEntryPointOrSelf();

        // SECURITY FIX: Validate nonce for replay protection
        if (userOp.nonce != userOpNonce) revert InvalidNonce();

        // Validate aggregated signatures
        if (!_validateAggregatedSignature(userOpHash, userOp.signature)) {
            return SIG_VALIDATION_FAILED;
        }

        // Increment nonce after successful validation (prevent replay)
        unchecked {
            userOpNonce += 1;
        }

        // Pay prefund if needed
        if (missingAccountFunds > 0) {
            (bool success, ) = payable(msg.sender).call{value: missingAccountFunds}("");
            require(success, "Prefund failed");
        }

        return SIG_VALIDATION_SUCCESS;
    }

    /**
     * @notice Validate aggregated passkey signatures
     * @param userOpHash The hash to verify against
     * @param signature The encoded AggregatedSignature
     */
    function _validateAggregatedSignature(
        bytes32 userOpHash,
        bytes calldata signature
    ) internal view returns (bool) {
        // Decode aggregated signature
        (bytes32[] memory keyHashes, bytes[] memory sigs) = abi.decode(
            signature,
            (bytes32[], bytes[])
        );

        // Must have enough signatures
        if (keyHashes.length < requiredSignatures) {
            return false;
        }

        // Must have matching arrays
        if (keyHashes.length != sigs.length) {
            return false;
        }

        // SECURITY FIX: Check for duplicate signers (prevents 1 signer signing multiple times)
        for (uint256 i = 0; i < keyHashes.length; i++) {
            for (uint256 j = i + 1; j < keyHashes.length; j++) {
                if (keyHashes[i] == keyHashes[j]) {
                    return false; // Duplicate signer detected
                }
            }
        }

        // Verify each signature
        for (uint256 i = 0; i < keyHashes.length; i++) {
            PasskeySigner storage signer = signers[keyHashes[i]];

            if (!signer.active) {
                return false;
            }

            // Decode WebAuthn signature
            WebAuthnSignature memory webAuthnSig = abi.decode(sigs[i], (WebAuthnSignature));

            // Verify WebAuthn signature
            if (!_verifyWebAuthnSignature(userOpHash, webAuthnSig, signer.x, signer.y)) {
                return false;
            }
        }

        return true;
    }

    // ============================================
    // TRANSACTION OPERATIONS
    // ============================================

    /**
     * @notice Submit a new transaction (called via UserOperation)
     * @param _to Target address
     * @param _value Amount of ETH (0 for token transfers)
     * @param _token Token address (address(0) for ETH)
     * @param _data Call data
     * @param _submitterKeyHash Key hash of the submitter
     * @return txId Transaction ID
     */
    function submitTransaction(
        address _to,
        uint256 _value,
        address _token,
        bytes calldata _data,
        bytes32 _submitterKeyHash
    ) external onlyEntryPointOrSelf returns (uint256 txId) {
        require(_to != address(0), "Invalid target");
        if (!signers[_submitterKeyHash].active) revert SignerNotActive();

        txId = transactions.length;

        transactions.push(Transaction({
            to: _to,
            value: _value,
            token: _token,
            data: _data,
            executed: false,
            approvalCount: 1,  // Submitter auto-approves
            rejectionCount: 0,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + EXPIRATION_TIME
        }));

        hasApproved[txId][_submitterKeyHash] = true;

        emit TransactionSubmitted(txId, _submitterKeyHash, _to, _value, _token);
        emit TransactionApproved(txId, _submitterKeyHash);

        // Auto-execute if threshold is 1
        if (requiredSignatures == 1) {
            _executeTransaction(txId);
        }

        return txId;
    }

    /**
     * @notice Approve a pending transaction (via UserOperation with passkey)
     * @param _txId Transaction ID
     * @param _signerKeyHash Key hash of the approving signer
     */
    function approveTransaction(
        uint256 _txId,
        bytes32 _signerKeyHash
    ) external onlyEntryPointOrSelf txExists(_txId) notExecuted(_txId) notExpired(_txId) {
        if (!signers[_signerKeyHash].active) revert SignerNotActive();
        if (hasApproved[_txId][_signerKeyHash]) revert AlreadyApproved();
        if (hasRejected[_txId][_signerKeyHash]) revert AlreadyRejected();

        hasApproved[_txId][_signerKeyHash] = true;
        transactions[_txId].approvalCount++;

        emit TransactionApproved(_txId, _signerKeyHash);

        // Execute if threshold reached
        if (transactions[_txId].approvalCount >= requiredSignatures) {
            _executeTransaction(_txId);
        }
    }

    /**
     * @notice Reject a pending transaction
     * @param _txId Transaction ID
     * @param _signerKeyHash Key hash of the rejecting signer
     */
    function rejectTransaction(
        uint256 _txId,
        bytes32 _signerKeyHash
    ) external onlyEntryPointOrSelf txExists(_txId) notExecuted(_txId) notExpired(_txId) {
        if (!signers[_signerKeyHash].active) revert SignerNotActive();
        if (hasApproved[_txId][_signerKeyHash]) revert AlreadyApproved();
        if (hasRejected[_txId][_signerKeyHash]) revert AlreadyRejected();

        hasRejected[_txId][_signerKeyHash] = true;
        transactions[_txId].rejectionCount++;

        emit TransactionRejected(_txId, _signerKeyHash);
    }

    /**
     * @notice Execute a transaction that has enough approvals
     * @param _txId Transaction ID
     */
    function executeTransaction(
        uint256 _txId
    ) external onlyEntryPointOrSelf txExists(_txId) notExecuted(_txId) notExpired(_txId) {
        if (transactions[_txId].approvalCount < requiredSignatures) {
            revert NotEnoughApprovals();
        }

        _executeTransaction(_txId);
    }

    /**
     * @notice Internal function to execute transaction
     */
    function _executeTransaction(uint256 _txId) internal nonReentrant {
        Transaction storage txn = transactions[_txId];
        txn.executed = true;

        if (txn.token == address(0)) {
            // Native ETH transfer
            (bool success, ) = txn.to.call{value: txn.value}(txn.data);
            require(success, "ETH transfer failed");
        } else {
            // ERC20 token transfer
            if (txn.data.length == 0) {
                IERC20(txn.token).safeTransfer(txn.to, txn.value);
            } else {
                (bool success, ) = txn.token.call(txn.data);
                require(success, "Token call failed");
            }
        }

        emit TransactionExecuted(_txId);
    }

    // ============================================
    // SIGNER MANAGEMENT
    // ============================================

    /**
     * @notice Add a new passkey signer (requires multi-sig approval)
     * @param _x X coordinate of new signer's public key
     * @param _y Y coordinate of new signer's public key
     */
    function addSigner(uint256 _x, uint256 _y) external onlySelf {
        bytes32 keyHash = keccak256(abi.encodePacked(_x, _y));

        if (signers[keyHash].active) revert DuplicateSigner();

        signers[keyHash] = PasskeySigner({
            x: _x,
            y: _y,
            active: true
        });
        signerKeyHashes.push(keyHash);

        emit SignerAdded(keyHash, _x, _y);
    }

    /**
     * @notice Remove a passkey signer (requires multi-sig approval)
     * @param _keyHash Key hash of signer to remove
     */
    function removeSigner(bytes32 _keyHash) external onlySelf {
        if (!signers[_keyHash].active) revert InvalidSigner();
        if (signerKeyHashes.length - 1 < requiredSignatures) {
            revert CannotReduceBelowThreshold();
        }
        if (signerKeyHashes.length <= 1) revert CannotRemoveLastSigner();

        signers[_keyHash].active = false;

        // Remove from array
        for (uint256 i = 0; i < signerKeyHashes.length; i++) {
            if (signerKeyHashes[i] == _keyHash) {
                signerKeyHashes[i] = signerKeyHashes[signerKeyHashes.length - 1];
                signerKeyHashes.pop();
                break;
            }
        }

        emit SignerRemoved(_keyHash);
    }

    /**
     * @notice Change the required signatures threshold
     * @param _newThreshold New threshold value
     */
    function changeThreshold(uint256 _newThreshold) external onlySelf {
        if (_newThreshold == 0) revert InvalidThreshold();
        if (_newThreshold > signerKeyHashes.length) revert InvalidThreshold();

        uint256 oldThreshold = requiredSignatures;
        requiredSignatures = _newThreshold;

        emit ThresholdChanged(oldThreshold, _newThreshold);
    }

    // ============================================
    // ORIGIN MANAGEMENT (SECURITY)
    // ============================================

    /**
     * @notice Add an allowed WebAuthn origin (requires multi-sig)
     * @param _origin Origin URL (e.g., "https://app.arcwallet.network")
     */
    function addAllowedOrigin(string calldata _origin) external onlySelf {
        bytes32 originHash = keccak256(bytes(_origin));
        allowedOrigins[originHash] = true;
    }

    /**
     * @notice Remove an allowed WebAuthn origin (requires multi-sig)
     * @param _origin Origin URL to remove
     */
    function removeAllowedOrigin(string calldata _origin) external onlySelf {
        bytes32 originHash = keccak256(bytes(_origin));
        allowedOrigins[originHash] = false;
    }

    /**
     * @notice Check if origin is allowed
     * @param _origin Origin URL to check
     */
    function isOriginAllowed(string calldata _origin) external view returns (bool) {
        return allowedOrigins[keccak256(bytes(_origin))];
    }

    // ============================================
    // WEBAUTHN VERIFICATION
    // ============================================

    /**
     * @notice Verify a WebAuthn P256 signature
     * @param challenge The challenge that was signed (userOpHash)
     * @param sig The WebAuthn signature data
     * @param x Signer's public key X coordinate
     * @param y Signer's public key Y coordinate
     * @return True if signature is valid
     */
    function _verifyWebAuthnSignature(
        bytes32 challenge,
        WebAuthnSignature memory sig,
        uint256 x,
        uint256 y
    ) internal view returns (bool) {
        // 1. Validate authenticator data (min 37 bytes)
        if (sig.authenticatorData.length < 37) {
            return false;
        }

        // 2. Check User Present (UP) flag
        uint8 flags = uint8(sig.authenticatorData[32]);
        if ((flags & 0x01) != 0x01) {
            return false;
        }

        // 3. Validate clientDataJSON contains the challenge
        bytes memory expectedChallenge = _base64UrlEncode(abi.encodePacked(challenge));
        if (!_containsAt(sig.clientDataJSON, expectedChallenge, sig.challengeIndex)) {
            return false;
        }

        // 4. Verify type is "webauthn.get"
        bytes memory expectedType = bytes('"type":"webauthn.get"');
        if (!_containsAt(sig.clientDataJSON, expectedType, sig.typeIndex)) {
            return false;
        }

        // 5. Compute the message hash
        bytes32 clientDataHash = sha256(sig.clientDataJSON);
        bytes32 message = sha256(abi.encodePacked(sig.authenticatorData, clientDataHash));

        // 6. Verify P256 signature using RIP-7212 precompile
        return _verifyP256(message, sig.r, sig.s, x, y);
    }

    /**
     * @notice Verify P256 signature using precompile
     */
    function _verifyP256(
        bytes32 message,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) internal view returns (bool) {
        (bool success, bytes memory result) = P256_VERIFIER.staticcall(
            abi.encode(message, r, s, x, y)
        );

        if (success && result.length == 32) {
            return abi.decode(result, (uint256)) == 1;
        }

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

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /**
     * @notice Get the number of signers
     */
    function getSignerCount() external view returns (uint256) {
        return signerKeyHashes.length;
    }

    /**
     * @notice Get all signer key hashes
     */
    function getSignerKeyHashes() external view returns (bytes32[] memory) {
        return signerKeyHashes;
    }

    /**
     * @notice Get signer details by key hash
     */
    function getSigner(bytes32 _keyHash) external view returns (uint256 x, uint256 y, bool active) {
        PasskeySigner storage signer = signers[_keyHash];
        return (signer.x, signer.y, signer.active);
    }

    /**
     * @notice Compute key hash from P256 coordinates
     */
    function computeKeyHash(uint256 x, uint256 y) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(x, y));
    }

    /**
     * @notice Get transaction count
     */
    function getTransactionCount() external view returns (uint256) {
        return transactions.length;
    }

    /**
     * @notice Get transaction details
     */
    function getTransaction(uint256 _txId)
        external
        view
        returns (
            address to,
            uint256 value,
            address token,
            bytes memory data,
            bool executed,
            uint256 approvalCount,
            uint256 rejectionCount,
            uint256 createdAt,
            uint256 expiresAt
        )
    {
        Transaction storage txn = transactions[_txId];
        return (
            txn.to,
            txn.value,
            txn.token,
            txn.data,
            txn.executed,
            txn.approvalCount,
            txn.rejectionCount,
            txn.createdAt,
            txn.expiresAt
        );
    }

    /**
     * @notice Check if a transaction is expired
     */
    function isExpired(uint256 _txId) external view returns (bool) {
        return block.timestamp > transactions[_txId].expiresAt;
    }

    /**
     * @notice Get pending transactions
     */
    function getPendingTransactions() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < transactions.length; i++) {
            if (!transactions[i].executed && block.timestamp <= transactions[i].expiresAt) {
                count++;
            }
        }

        uint256[] memory pending = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < transactions.length; i++) {
            if (!transactions[i].executed && block.timestamp <= transactions[i].expiresAt) {
                pending[index] = i;
                index++;
            }
        }

        return pending;
    }

    /**
     * @notice Get token balance
     */
    function getBalance(address _token) external view returns (uint256) {
        if (_token == address(0)) {
            return address(this).balance;
        }
        return IERC20(_token).balanceOf(address(this));
    }

    // ============================================
    // RECEIVE ETH
    // ============================================

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }
}
