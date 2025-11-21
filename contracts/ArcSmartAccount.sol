// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IEntryPoint} from "./IEntryPoint.sol";

contract ArcSmartAccount {
    error NotOwner();
    error SessionKeyExpired();
    error SessionKeyNotAuthorised();
    error InvalidSignature();
    error InvalidNonce();
    error InvalidCaller();

    event SessionKeyAuthorised(address indexed sessionKey, uint64 expiresAt);
    event SessionKeyRevoked(address indexed sessionKey);
    event Executed(address indexed target, uint256 value, bytes data);

    IEntryPoint public immutable entryPoint;
    address public owner;
    uint256 private userOpNonce;

    struct SessionKey {
        uint64 expiresAt;
        bool exists;
    }

    mapping(address => SessionKey) private sessionKeys;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAuthorised() {
        if (msg.sender == owner) {
            _;
            return;
        }
        SessionKey memory key = sessionKeys[msg.sender];
        if (!key.exists) revert SessionKeyNotAuthorised();
        if (key.expiresAt != 0 && block.timestamp > key.expiresAt) revert SessionKeyExpired();
        _;
    }

    constructor(address _entryPoint, address _owner) {
        require(_entryPoint != address(0), "entrypoint required");
        require(_owner != address(0), "owner required");
        entryPoint = IEntryPoint(_entryPoint);
        owner = _owner;
    }

    function getUserOpNonce() external view returns (uint256) {
        return userOpNonce;
    }

    function changeOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "invalid owner");
        owner = newOwner;
    }

    function authorizeSessionKey(address sessionKey, uint64 expiresAt) external onlyOwner {
        require(sessionKey != address(0), "invalid key");
        sessionKeys[sessionKey] = SessionKey({expiresAt: expiresAt, exists: true});
        emit SessionKeyAuthorised(sessionKey, expiresAt);
    }

    function revokeSessionKey(address sessionKey) external onlyOwner {
        if (sessionKeys[sessionKey].exists) {
            delete sessionKeys[sessionKey];
            emit SessionKeyRevoked(sessionKey);
        }
    }

    function isSessionKeyAuthorised(address sessionKey) external view returns (bool authorised, uint64 expiresAt) {
        SessionKey memory key = sessionKeys[sessionKey];
        if (!key.exists) return (false, 0);
        if (key.expiresAt != 0 && block.timestamp > key.expiresAt) return (false, key.expiresAt);
        return (true, key.expiresAt);
    }

    function execute(address target, uint256 value, bytes calldata data) external onlyAuthorised returns (bytes memory result) {
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        require(success, string(returndata));
        emit Executed(target, value, data);
        return returndata;
    }

    function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func) external onlyAuthorised {
        require(dest.length == value.length && value.length == func.length, "wrong array lengths");
        for (uint256 i = 0; i < dest.length; i++) {
            (bool success, bytes memory returndata) = dest[i].call{value: value[i]}(func[i]);
            require(success, string(returndata));
            emit Executed(dest[i], value[i], func[i]);
        }
    }

    function validateUserOp(
        IEntryPoint.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingFunds
    ) external returns (uint256 validationData) {
        if (msg.sender != address(entryPoint)) revert InvalidCaller();
        if (userOp.nonce != userOpNonce) revert InvalidNonce();

        address signer = _recoverSigner(userOpHash, userOp.signature);
        if (signer != owner) {
            SessionKey memory key = sessionKeys[signer];
            if (!key.exists) revert SessionKeyNotAuthorised();
            if (key.expiresAt != 0 && block.timestamp > key.expiresAt) revert SessionKeyExpired();
        }

        unchecked {
            userOpNonce += 1;
        }

        if (missingFunds > 0) {
            (bool success, ) = payable(msg.sender).call{value: missingFunds}("");
            require(success, "missingFunds transfer failed");
        }

        return 0;
    }

    function _recoverSigner(bytes32 hash, bytes memory signature) internal pure returns (address signer) {
        if (signature.length != 65) revert InvalidSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        if (v < 27) {
            v += 27;
        }
        if (v != 27 && v != 28) revert InvalidSignature();
        signer = ecrecover(hash, v, r, s);
        if (signer == address(0)) revert InvalidSignature();
    }

    receive() external payable {}
}
