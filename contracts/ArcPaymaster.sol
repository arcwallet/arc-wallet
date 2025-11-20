// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IEntryPoint} from "./IEntryPoint.sol";

/**
 * @title ArcPaymaster
 * @notice ERC-4337 Paymaster implementation for sponsoring gas fees
 * @dev Supports multiple sponsorship strategies: whitelist, budget, rate limiting
 */
contract ArcPaymaster {
    error OnlyOwner();
    error OnlyEntryPoint();
    error InsufficientDeposit();
    error NotWhitelisted();
    error RateLimitExceeded();
    error BudgetExceeded();
    error InvalidPolicy();
    error WithdrawFailed();

    event Deposited(address indexed sender, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event StakeAdded(uint256 amount, uint32 unstakeDelaySec);
    event PolicyUpdated(string policyType, bool enabled);
    event WhitelistUpdated(address indexed account, bool enabled);
    event UserOpSponsored(address indexed sender, uint256 actualGasCost);

    IEntryPoint public immutable entryPoint;
    address public owner;

    // Policy configuration
    struct PaymasterConfig {
        bool whitelistEnabled;
        bool budgetEnabled;
        bool rateLimitEnabled;
        uint256 maxCostPerOp;      // Maximum gas cost per operation (in wei)
        uint256 dailyBudget;        // Maximum spending per day (in wei)
        uint256 maxOpsPerHour;      // Maximum operations per hour per address
    }

    PaymasterConfig public config;

    // Whitelist for addresses that can receive sponsorship
    mapping(address => bool) public whitelist;

    // Rate limiting: track operations per address
    mapping(address => uint256) public lastOpTimestamp;
    mapping(address => uint256) public opsCountInHour;

    // Budget tracking
    uint256 public dailySpent;
    uint256 public lastResetTimestamp;

    // Statistics
    uint256 public totalSponsored;
    uint256 public totalCost;

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyEntryPoint() {
        if (msg.sender != address(entryPoint)) revert OnlyEntryPoint();
        _;
    }

    constructor(address _entryPoint, address _owner) {
        require(_entryPoint != address(0), "Invalid EntryPoint");
        require(_owner != address(0), "Invalid owner");
        
        entryPoint = IEntryPoint(_entryPoint);
        owner = _owner;
        lastResetTimestamp = block.timestamp;

        // Default configuration: whitelist mode enabled
        config = PaymasterConfig({
            whitelistEnabled: true,
            budgetEnabled: false,
            rateLimitEnabled: false,
            maxCostPerOp: 0.01 ether,
            dailyBudget: 1 ether,
            maxOpsPerHour: 10
        });
    }

    // ============================================================================
    // ERC-4337 Paymaster Interface
    // ============================================================================

    /**
     * @notice Validate a UserOperation and determine if paymaster will sponsor it
     * @param userOp The UserOperation to validate
     * @param userOpHash Hash of the UserOperation
     * @param maxCost Maximum gas cost for this operation
     * @return context Data to pass to postOp (empty if no postOp needed)
     * @return validationData Validation result (0 = success)
     */
    function validatePaymasterUserOp(
        IEntryPoint.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        // Check if paymaster has enough deposit
        uint256 balance = entryPoint.balanceOf(address(this));
        if (balance < maxCost) revert InsufficientDeposit();

        // Apply policies
        _checkPolicies(userOp.sender, maxCost);

        // Reset daily budget if needed
        _resetDailyBudgetIfNeeded();

        // Update rate limiting
        if (config.rateLimitEnabled) {
            _updateRateLimit(userOp.sender);
        }

        // Update budget tracking
        if (config.budgetEnabled) {
            dailySpent += maxCost;
        }

        // Encode context for postOp
        context = abi.encode(userOp.sender, maxCost);
        
        // Return success (validationData = 0)
        return (context, 0);
    }

    /**
     * @notice Post-operation handler called after UserOperation execution
     * @param mode Whether the operation succeeded or reverted
     * @param context Data from validatePaymasterUserOp
     * @param actualGasCost Actual gas cost of the operation
     */
    function postOp(
        IEntryPoint.PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 /* actualUserOpFeePerGas */
    ) external onlyEntryPoint {
        (address sender, uint256 maxCost) = abi.decode(context, (address, uint256));

        // Update statistics
        totalSponsored++;
        totalCost += actualGasCost;

        // Adjust daily spent (refund unused gas)
        if (config.budgetEnabled && maxCost > actualGasCost) {
            dailySpent -= (maxCost - actualGasCost);
        }

        emit UserOpSponsored(sender, actualGasCost);

        // Note: In advanced implementations, this is where you would:
        // 1. Pull ERC-20 tokens from user (token-based payment)
        // 2. Swap tokens for ETH
        // 3. Handle refunds
    }

    // ============================================================================
    // Policy Management
    // ============================================================================

    function _checkPolicies(address sender, uint256 estimatedCost) internal view {
        // Check whitelist
        if (config.whitelistEnabled && !whitelist[sender]) {
            revert NotWhitelisted();
        }

        // Check budget
        if (config.budgetEnabled) {
            if (estimatedCost > config.maxCostPerOp) {
                revert BudgetExceeded();
            }
            if (dailySpent + estimatedCost > config.dailyBudget) {
                revert BudgetExceeded();
            }
        }

        // Check rate limit
        if (config.rateLimitEnabled) {
            uint256 hoursSinceLastOp = (block.timestamp - lastOpTimestamp[sender]) / 3600;
            
            // Reset counter if more than 1 hour has passed
            if (hoursSinceLastOp >= 1) {
                // Counter will be reset in _updateRateLimit
            } else if (opsCountInHour[sender] >= config.maxOpsPerHour) {
                revert RateLimitExceeded();
            }
        }
    }

    function _updateRateLimit(address sender) internal {
        uint256 hoursSinceLastOp = (block.timestamp - lastOpTimestamp[sender]) / 3600;
        
        if (hoursSinceLastOp >= 1) {
            // Reset counter
            opsCountInHour[sender] = 1;
        } else {
            // Increment counter
            opsCountInHour[sender]++;
        }
        
        lastOpTimestamp[sender] = block.timestamp;
    }

    function _resetDailyBudgetIfNeeded() internal {
        uint256 daysSinceReset = (block.timestamp - lastResetTimestamp) / 86400;
        
        if (daysSinceReset >= 1) {
            dailySpent = 0;
            lastResetTimestamp = block.timestamp;
        }
    }

    // ============================================================================
    // Owner Functions
    // ============================================================================

    /**
     * @notice Update policy configuration
     */
    function setWhitelistPolicy(bool enabled) external onlyOwner {
        config.whitelistEnabled = enabled;
        emit PolicyUpdated("whitelist", enabled);
    }

    function setBudgetPolicy(
        bool enabled,
        uint256 maxCostPerOp,
        uint256 dailyBudget
    ) external onlyOwner {
        if (enabled && (maxCostPerOp == 0 || dailyBudget == 0)) {
            revert InvalidPolicy();
        }
        
        config.budgetEnabled = enabled;
        config.maxCostPerOp = maxCostPerOp;
        config.dailyBudget = dailyBudget;
        
        emit PolicyUpdated("budget", enabled);
    }

    function setRateLimitPolicy(bool enabled, uint256 maxOpsPerHour) external onlyOwner {
        if (enabled && maxOpsPerHour == 0) {
            revert InvalidPolicy();
        }
        
        config.rateLimitEnabled = enabled;
        config.maxOpsPerHour = maxOpsPerHour;
        
        emit PolicyUpdated("rateLimit", enabled);
    }

    /**
     * @notice Add or remove addresses from whitelist
     */
    function setWhitelist(address[] calldata addresses, bool enabled) external onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            whitelist[addresses[i]] = enabled;
            emit WhitelistUpdated(addresses[i], enabled);
        }
    }

    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }

    // ============================================================================
    // Deposit Management
    // ============================================================================

    /**
     * @notice Deposit ETH to paymaster's EntryPoint balance
     */
    function deposit() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw ETH from paymaster's EntryPoint balance
     */
    function withdrawTo(address payable withdrawAddress, uint256 amount) external onlyOwner {
        entryPoint.withdrawTo(withdrawAddress, amount);
        emit Withdrawn(withdrawAddress, amount);
    }

    /**
     * @notice Add stake to EntryPoint (for reputation)
     */
    function addStake(uint32 unstakeDelaySec) external payable onlyOwner {
        entryPoint.addStake{value: msg.value}(unstakeDelaySec);
        emit StakeAdded(msg.value, unstakeDelaySec);
    }

    /**
     * @notice Unlock stake from EntryPoint
     */
    function unlockStake() external onlyOwner {
        entryPoint.unlockStake();
    }

    /**
     * @notice Withdraw unlocked stake
     */
    function withdrawStake(address payable withdrawAddress) external onlyOwner {
        entryPoint.withdrawStake(withdrawAddress);
    }

    // ============================================================================
    // View Functions
    // ============================================================================

    /**
     * @notice Get current paymaster balance in EntryPoint
     */
    function getBalance() external view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }

    /**
     * @notice Get sponsorship statistics
     */
    function getStats() external view returns (
        uint256 _totalSponsored,
        uint256 _totalCost,
        uint256 _dailySpent,
        uint256 _balance
    ) {
        return (
            totalSponsored,
            totalCost,
            dailySpent,
            entryPoint.balanceOf(address(this))
        );
    }

    /**
     * @notice Check if an address can be sponsored
     */
    function canSponsor(address sender, uint256 estimatedCost) external view returns (bool) {
        // Check balance
        if (entryPoint.balanceOf(address(this)) < estimatedCost) {
            return false;
        }

        // Check whitelist
        if (config.whitelistEnabled && !whitelist[sender]) {
            return false;
        }

        // Check budget
        if (config.budgetEnabled) {
            if (estimatedCost > config.maxCostPerOp) {
                return false;
            }
            if (dailySpent + estimatedCost > config.dailyBudget) {
                return false;
            }
        }

        // Check rate limit
        if (config.rateLimitEnabled) {
            uint256 hoursSinceLastOp = (block.timestamp - lastOpTimestamp[sender]) / 3600;
            if (hoursSinceLastOp < 1 && opsCountInHour[sender] >= config.maxOpsPerHour) {
                return false;
            }
        }

        return true;
    }

    // ============================================================================
    // Fallback
    // ============================================================================

    receive() external payable {
        // Auto-deposit received ETH
        entryPoint.depositTo{value: msg.value}(address(this));
        emit Deposited(msg.sender, msg.value);
    }
}
