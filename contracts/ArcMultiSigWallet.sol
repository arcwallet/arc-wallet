// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ArcMultiSigWallet
 * @notice Multi-signature wallet with configurable threshold and 24-hour expiration
 */
contract ArcMultiSigWallet is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Events
    event Deposit(address indexed sender, uint256 amount);
    event TransactionSubmitted(uint256 indexed txId, address indexed submitter, address indexed to, uint256 value, address token);
    event TransactionApproved(uint256 indexed txId, address indexed approver);
    event TransactionRejected(uint256 indexed txId, address indexed rejector);
    event TransactionExecuted(uint256 indexed txId);
    event TransactionExpired(uint256 indexed txId);
    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);
    event ThresholdChanged(uint256 oldThreshold, uint256 newThreshold);

    // Transaction struct
    struct Transaction {
        address to;
        uint256 value;
        address token; // address(0) for native ETH
        bytes data;
        bool executed;
        uint256 approvalCount;
        uint256 rejectionCount;
        uint256 createdAt;
        uint256 expiresAt;
    }

    // State variables
    address[] public signers;
    mapping(address => bool) public isSigner;
    uint256 public requiredSignatures;

    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public hasApproved;
    mapping(uint256 => mapping(address => bool)) public hasRejected;

    // Constants
    uint256 public constant EXPIRATION_TIME = 24 hours;

    // Modifiers
    modifier onlySigner() {
        require(isSigner[msg.sender], "Not a signer");
        _;
    }

    modifier onlyWallet() {
        require(msg.sender == address(this), "Only wallet can call");
        _;
    }

    modifier txExists(uint256 _txId) {
        require(_txId < transactions.length, "Transaction does not exist");
        _;
    }

    modifier notExecuted(uint256 _txId) {
        require(!transactions[_txId].executed, "Transaction already executed");
        _;
    }

    modifier notExpired(uint256 _txId) {
        require(block.timestamp <= transactions[_txId].expiresAt, "Transaction expired");
        _;
    }

    /**
     * @notice Initialize the multi-sig wallet
     * @param _signers Initial list of signers
     * @param _requiredSignatures Number of required signatures (threshold)
     */
    constructor(address[] memory _signers, uint256 _requiredSignatures) {
        require(_signers.length > 0, "Signers required");
        require(
            _requiredSignatures > 0 && _requiredSignatures <= _signers.length,
            "Invalid threshold"
        );

        for (uint256 i = 0; i < _signers.length; i++) {
            address signer = _signers[i];
            require(signer != address(0), "Invalid signer");
            require(!isSigner[signer], "Duplicate signer");

            isSigner[signer] = true;
            signers.push(signer);
        }

        requiredSignatures = _requiredSignatures;
    }

    /**
     * @notice Receive native ETH
     */
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @notice Submit a new transaction
     * @param _to Target address
     * @param _value Amount of ETH (0 for token transfers)
     * @param _token Token address (address(0) for ETH)
     * @param _data Call data
     * @return txId Transaction ID
     */
    function submitTransaction(
        address _to,
        uint256 _value,
        address _token,
        bytes calldata _data
    ) external onlySigner returns (uint256 txId) {
        require(_to != address(0), "Invalid target");

        txId = transactions.length;

        transactions.push(Transaction({
            to: _to,
            value: _value,
            token: _token,
            data: _data,
            executed: false,
            approvalCount: 1, // Submitter auto-approves
            rejectionCount: 0,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + EXPIRATION_TIME
        }));

        hasApproved[txId][msg.sender] = true;

        emit TransactionSubmitted(txId, msg.sender, _to, _value, _token);
        emit TransactionApproved(txId, msg.sender);

        // Auto-execute if threshold is 1
        if (requiredSignatures == 1) {
            _executeTransaction(txId);
        }

        return txId;
    }

    /**
     * @notice Approve a pending transaction
     * @param _txId Transaction ID
     */
    function approveTransaction(uint256 _txId)
        external
        onlySigner
        txExists(_txId)
        notExecuted(_txId)
        notExpired(_txId)
    {
        require(!hasApproved[_txId][msg.sender], "Already approved");
        require(!hasRejected[_txId][msg.sender], "Already rejected");

        hasApproved[_txId][msg.sender] = true;
        transactions[_txId].approvalCount++;

        emit TransactionApproved(_txId, msg.sender);

        // Execute if threshold reached
        if (transactions[_txId].approvalCount >= requiredSignatures) {
            _executeTransaction(_txId);
        }
    }

    /**
     * @notice Reject a pending transaction
     * @param _txId Transaction ID
     */
    function rejectTransaction(uint256 _txId)
        external
        onlySigner
        txExists(_txId)
        notExecuted(_txId)
        notExpired(_txId)
    {
        require(!hasApproved[_txId][msg.sender], "Already approved");
        require(!hasRejected[_txId][msg.sender], "Already rejected");

        hasRejected[_txId][msg.sender] = true;
        transactions[_txId].rejectionCount++;

        emit TransactionRejected(_txId, msg.sender);
    }

    /**
     * @notice Execute a transaction that has enough approvals
     * @param _txId Transaction ID
     */
    function executeTransaction(uint256 _txId)
        external
        onlySigner
        txExists(_txId)
        notExecuted(_txId)
        notExpired(_txId)
    {
        require(
            transactions[_txId].approvalCount >= requiredSignatures,
            "Not enough approvals"
        );

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
                // Simple transfer
                IERC20(txn.token).safeTransfer(txn.to, txn.value);
            } else {
                // Custom call (e.g., approve, transferFrom)
                (bool success, ) = txn.token.call(txn.data);
                require(success, "Token call failed");
            }
        }

        emit TransactionExecuted(_txId);
    }

    /**
     * @notice Add a new signer (requires multi-sig approval)
     * @param _signer Address of new signer
     */
    function addSigner(address _signer) external onlyWallet {
        require(_signer != address(0), "Invalid signer");
        require(!isSigner[_signer], "Already a signer");

        isSigner[_signer] = true;
        signers.push(_signer);

        emit SignerAdded(_signer);
    }

    /**
     * @notice Remove a signer (requires multi-sig approval)
     * @param _signer Address of signer to remove
     */
    function removeSigner(address _signer) external onlyWallet {
        require(isSigner[_signer], "Not a signer");
        require(signers.length - 1 >= requiredSignatures, "Cannot reduce below threshold");
        require(signers.length > 1, "Cannot remove last signer");

        isSigner[_signer] = false;

        // Remove from signers array
        for (uint256 i = 0; i < signers.length; i++) {
            if (signers[i] == _signer) {
                signers[i] = signers[signers.length - 1];
                signers.pop();
                break;
            }
        }

        emit SignerRemoved(_signer);
    }

    /**
     * @notice Change the required signatures threshold (requires multi-sig approval)
     * @param _newThreshold New threshold value
     */
    function changeThreshold(uint256 _newThreshold) external onlyWallet {
        require(_newThreshold > 0, "Invalid threshold");
        require(_newThreshold <= signers.length, "Threshold exceeds signers");

        uint256 oldThreshold = requiredSignatures;
        requiredSignatures = _newThreshold;

        emit ThresholdChanged(oldThreshold, _newThreshold);
    }

    // View functions

    /**
     * @notice Get the number of signers
     */
    function getSignerCount() external view returns (uint256) {
        return signers.length;
    }

    /**
     * @notice Get all signers
     */
    function getSigners() external view returns (address[] memory) {
        return signers;
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
     * @param _token Token address (address(0) for ETH)
     */
    function getBalance(address _token) external view returns (uint256) {
        if (_token == address(0)) {
            return address(this).balance;
        }
        return IERC20(_token).balanceOf(address(this));
    }
}
