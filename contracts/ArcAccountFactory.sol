// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/utils/Create2.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "./ArcAccount.sol";

/**
 * @title ArcAccountFactory
 * @notice Factory for deploying ArcAccount smart wallets
 * @dev Uses CREATE2 for deterministic addresses
 */
contract ArcAccountFactory {
    /// @notice The ArcAccount implementation contract
    ArcAccount public immutable accountImplementation;

    /// @notice The ERC-4337 EntryPoint
    IEntryPoint public immutable entryPoint;

    /// @notice Mapping of deployed accounts
    mapping(address => bool) public isAccount;

    // ============================================
    // EVENTS
    // ============================================

    event AccountCreated(
        address indexed account,
        bytes32 indexed keyHash,
        uint8 keyType
    );

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(IEntryPoint _entryPoint) {
        entryPoint = _entryPoint;
        accountImplementation = new ArcAccount(_entryPoint);
    }

    // ============================================
    // ACCOUNT CREATION
    // ============================================

    /**
     * @notice Create a new ArcAccount
     * @param keyHash Hash of the initial signing key
     * @param keyType Type of key (1 = ECDSA, 2 = WebAuthn)
     * @param deviceName Name of the initial device
     * @param salt Salt for CREATE2 deployment
     * @return account The deployed account address
     */
    function createAccount(
        bytes32 keyHash,
        uint8 keyType,
        string calldata deviceName,
        uint256 salt
    ) external returns (ArcAccount account) {
        address addr = getAddress(keyHash, keyType, deviceName, salt);

        // Check if already deployed
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(addr)
        }

        if (codeSize > 0) {
            return ArcAccount(payable(addr));
        }

        // Deploy new account
        account = ArcAccount(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    address(accountImplementation),
                    abi.encodeCall(
                        ArcAccount.initialize,
                        (keyHash, keyType, deviceName)
                    )
                )
            )
        );

        isAccount[address(account)] = true;

        emit AccountCreated(address(account), keyHash, keyType);
    }

    /**
     * @notice Get the counterfactual address of an account
     * @param keyHash Hash of the initial signing key
     * @param keyType Type of key
     * @param deviceName Name of the initial device
     * @param salt Salt for CREATE2
     * @return The deterministic account address
     */
    function getAddress(
        bytes32 keyHash,
        uint8 keyType,
        string calldata deviceName,
        uint256 salt
    ) public view returns (address) {
        return Create2.computeAddress(
            bytes32(salt),
            keccak256(
                abi.encodePacked(
                    type(ERC1967Proxy).creationCode,
                    abi.encode(
                        address(accountImplementation),
                        abi.encodeCall(
                            ArcAccount.initialize,
                            (keyHash, keyType, deviceName)
                        )
                    )
                )
            )
        );
    }

    /**
     * @notice Add stake to the EntryPoint (for paymaster-less operation)
     */
    function addStake(uint32 unstakeDelaySec) external payable {
        entryPoint.addStake{value: msg.value}(unstakeDelaySec);
    }

    /**
     * @notice Withdraw stake from EntryPoint
     */
    function withdrawStake(address payable withdrawAddress) external {
        entryPoint.withdrawStake(withdrawAddress);
    }
}
