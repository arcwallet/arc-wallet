// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ArcMultiSigWallet.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

/**
 * @title ArcMultiSigFactory
 * @notice Factory contract for deploying passkey-based ArcMultiSigWallet instances
 * @dev Creates multi-sig wallets where signers are identified by P256 public keys
 */
contract ArcMultiSigFactory {
    // ============================================
    // EVENTS
    // ============================================

    event WalletCreated(
        address indexed wallet,
        address indexed creator,
        bytes32[] signerKeyHashes,
        uint256 requiredSignatures
    );

    // ============================================
    // STATE
    // ============================================

    /// @notice ERC-4337 EntryPoint
    IEntryPoint public immutable entryPoint;

    /// @notice All deployed wallets
    address[] public deployedWallets;

    /// @notice Wallets by signer key hash
    mapping(bytes32 => address[]) public signerWallets;

    /// @notice Check if address is a deployed wallet
    mapping(address => bool) public isDeployedWallet;

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(IEntryPoint _entryPoint) {
        entryPoint = _entryPoint;
    }

    // ============================================
    // WALLET CREATION
    // ============================================

    /**
     * @notice Create a new passkey multi-sig wallet
     * @param _signerXs X coordinates of signer public keys
     * @param _signerYs Y coordinates of signer public keys
     * @param _requiredSignatures Number of required signatures (threshold)
     * @return wallet Address of the new wallet
     */
    function createWallet(
        uint256[] calldata _signerXs,
        uint256[] calldata _signerYs,
        uint256 _requiredSignatures
    ) external returns (address wallet) {
        require(_signerXs.length == _signerYs.length, "Mismatched key arrays");

        ArcMultiSigWallet newWallet = new ArcMultiSigWallet(
            entryPoint,
            _signerXs,
            _signerYs,
            _requiredSignatures
        );

        wallet = address(newWallet);
        deployedWallets.push(wallet);
        isDeployedWallet[wallet] = true;

        // Track wallet for each signer by key hash
        bytes32[] memory keyHashes = new bytes32[](_signerXs.length);
        for (uint256 i = 0; i < _signerXs.length; i++) {
            bytes32 keyHash = keccak256(abi.encodePacked(_signerXs[i], _signerYs[i]));
            keyHashes[i] = keyHash;
            signerWallets[keyHash].push(wallet);
        }

        emit WalletCreated(wallet, msg.sender, keyHashes, _requiredSignatures);

        return wallet;
    }

    /**
     * @notice Create wallet with deterministic address using CREATE2
     * @param _signerXs X coordinates of signer public keys
     * @param _signerYs Y coordinates of signer public keys
     * @param _requiredSignatures Number of required signatures
     * @param _salt Salt for deterministic address
     * @return wallet Address of the new wallet
     */
    function createWalletDeterministic(
        uint256[] calldata _signerXs,
        uint256[] calldata _signerYs,
        uint256 _requiredSignatures,
        bytes32 _salt
    ) external returns (address wallet) {
        require(_signerXs.length == _signerYs.length, "Mismatched key arrays");

        bytes memory bytecode = abi.encodePacked(
            type(ArcMultiSigWallet).creationCode,
            abi.encode(entryPoint, _signerXs, _signerYs, _requiredSignatures)
        );

        assembly {
            wallet := create2(0, add(bytecode, 0x20), mload(bytecode), _salt)
        }

        require(wallet != address(0), "Deployment failed");

        deployedWallets.push(wallet);
        isDeployedWallet[wallet] = true;

        // Track wallet for each signer by key hash
        bytes32[] memory keyHashes = new bytes32[](_signerXs.length);
        for (uint256 i = 0; i < _signerXs.length; i++) {
            bytes32 keyHash = keccak256(abi.encodePacked(_signerXs[i], _signerYs[i]));
            keyHashes[i] = keyHash;
            signerWallets[keyHash].push(wallet);
        }

        emit WalletCreated(wallet, msg.sender, keyHashes, _requiredSignatures);

        return wallet;
    }

    /**
     * @notice Compute deterministic wallet address
     * @param _signerXs X coordinates of signer public keys
     * @param _signerYs Y coordinates of signer public keys
     * @param _requiredSignatures Number of required signatures
     * @param _salt Salt for deterministic address
     * @return predicted Predicted wallet address
     */
    function computeWalletAddress(
        uint256[] calldata _signerXs,
        uint256[] calldata _signerYs,
        uint256 _requiredSignatures,
        bytes32 _salt
    ) external view returns (address predicted) {
        bytes memory bytecode = abi.encodePacked(
            type(ArcMultiSigWallet).creationCode,
            abi.encode(entryPoint, _signerXs, _signerYs, _requiredSignatures)
        );

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                _salt,
                keccak256(bytecode)
            )
        );

        return address(uint160(uint256(hash)));
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /**
     * @notice Get total number of deployed wallets
     */
    function getDeployedWalletsCount() external view returns (uint256) {
        return deployedWallets.length;
    }

    /**
     * @notice Get all deployed wallets
     */
    function getDeployedWallets() external view returns (address[] memory) {
        return deployedWallets;
    }

    /**
     * @notice Get wallets for a specific signer by key hash
     * @param _keyHash Signer's key hash (keccak256(x, y))
     */
    function getSignerWallets(bytes32 _keyHash) external view returns (address[] memory) {
        return signerWallets[_keyHash];
    }

    /**
     * @notice Get wallets for a specific signer by public key coordinates
     * @param _x Public key X coordinate
     * @param _y Public key Y coordinate
     */
    function getWalletsByPublicKey(uint256 _x, uint256 _y) external view returns (address[] memory) {
        bytes32 keyHash = keccak256(abi.encodePacked(_x, _y));
        return signerWallets[keyHash];
    }

    /**
     * @notice Compute key hash from P256 coordinates
     * @param _x Public key X coordinate
     * @param _y Public key Y coordinate
     */
    function computeKeyHash(uint256 _x, uint256 _y) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(_x, _y));
    }

    /**
     * @notice Get deployed wallets with pagination
     * @param _offset Start index
     * @param _limit Max number of results
     */
    function getDeployedWalletsPaginated(
        uint256 _offset,
        uint256 _limit
    ) external view returns (address[] memory) {
        if (_offset >= deployedWallets.length) {
            return new address[](0);
        }

        uint256 end = _offset + _limit;
        if (end > deployedWallets.length) {
            end = deployedWallets.length;
        }

        address[] memory result = new address[](end - _offset);
        for (uint256 i = _offset; i < end; i++) {
            result[i - _offset] = deployedWallets[i];
        }

        return result;
    }
}
