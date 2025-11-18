// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ArcMultiSigWallet.sol";

/**
 * @title ArcMultiSigFactory
 * @notice Factory contract for deploying ArcMultiSigWallet instances
 */
contract ArcMultiSigFactory {
    // Events
    event WalletCreated(
        address indexed wallet,
        address indexed creator,
        address[] signers,
        uint256 requiredSignatures
    );

    // State
    address[] public deployedWallets;
    mapping(address => address[]) public userWallets;
    mapping(address => bool) public isDeployedWallet;

    /**
     * @notice Create a new multi-sig wallet
     * @param _signers List of initial signers
     * @param _requiredSignatures Number of required signatures (threshold)
     * @return wallet Address of the new wallet
     */
    function createWallet(
        address[] calldata _signers,
        uint256 _requiredSignatures
    ) external returns (address wallet) {
        ArcMultiSigWallet newWallet = new ArcMultiSigWallet(
            _signers,
            _requiredSignatures
        );

        wallet = address(newWallet);
        deployedWallets.push(wallet);
        isDeployedWallet[wallet] = true;

        // Track wallet for each signer
        for (uint256 i = 0; i < _signers.length; i++) {
            userWallets[_signers[i]].push(wallet);
        }

        emit WalletCreated(wallet, msg.sender, _signers, _requiredSignatures);

        return wallet;
    }

    /**
     * @notice Create wallet with deterministic address using CREATE2
     * @param _signers List of initial signers
     * @param _requiredSignatures Number of required signatures
     * @param _salt Salt for deterministic address
     * @return wallet Address of the new wallet
     */
    function createWalletDeterministic(
        address[] calldata _signers,
        uint256 _requiredSignatures,
        bytes32 _salt
    ) external returns (address wallet) {
        bytes memory bytecode = abi.encodePacked(
            type(ArcMultiSigWallet).creationCode,
            abi.encode(_signers, _requiredSignatures)
        );

        assembly {
            wallet := create2(0, add(bytecode, 0x20), mload(bytecode), _salt)
        }

        require(wallet != address(0), "Deployment failed");

        deployedWallets.push(wallet);
        isDeployedWallet[wallet] = true;

        // Track wallet for each signer
        for (uint256 i = 0; i < _signers.length; i++) {
            userWallets[_signers[i]].push(wallet);
        }

        emit WalletCreated(wallet, msg.sender, _signers, _requiredSignatures);

        return wallet;
    }

    /**
     * @notice Compute deterministic wallet address
     * @param _signers List of initial signers
     * @param _requiredSignatures Number of required signatures
     * @param _salt Salt for deterministic address
     * @return predicted Predicted wallet address
     */
    function computeWalletAddress(
        address[] calldata _signers,
        uint256 _requiredSignatures,
        bytes32 _salt
    ) external view returns (address predicted) {
        bytes memory bytecode = abi.encodePacked(
            type(ArcMultiSigWallet).creationCode,
            abi.encode(_signers, _requiredSignatures)
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
     * @notice Get wallets for a specific user
     * @param _user User address
     */
    function getUserWallets(address _user) external view returns (address[] memory) {
        return userWallets[_user];
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
