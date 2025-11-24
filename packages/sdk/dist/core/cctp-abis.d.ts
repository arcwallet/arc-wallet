/**
 * TokenMessenger ABI
 * Circle CCTP TokenMessenger contract interface
 */
export declare const TOKEN_MESSENGER_ABI: readonly [{
    readonly inputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }, {
        readonly internalType: "uint32";
        readonly name: "destinationDomain";
        readonly type: "uint32";
    }, {
        readonly internalType: "bytes32";
        readonly name: "mintRecipient";
        readonly type: "bytes32";
    }, {
        readonly internalType: "address";
        readonly name: "burnToken";
        readonly type: "address";
    }];
    readonly name: "depositForBurn";
    readonly outputs: readonly [{
        readonly internalType: "uint64";
        readonly name: "_nonce";
        readonly type: "uint64";
    }];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "uint64";
        readonly name: "nonce";
        readonly type: "uint64";
    }, {
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "burnToken";
        readonly type: "address";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }, {
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "depositor";
        readonly type: "address";
    }, {
        readonly indexed: false;
        readonly internalType: "bytes32";
        readonly name: "mintRecipient";
        readonly type: "bytes32";
    }, {
        readonly indexed: false;
        readonly internalType: "uint32";
        readonly name: "destinationDomain";
        readonly type: "uint32";
    }, {
        readonly indexed: false;
        readonly internalType: "bytes32";
        readonly name: "destinationTokenMessenger";
        readonly type: "bytes32";
    }, {
        readonly indexed: false;
        readonly internalType: "bytes32";
        readonly name: "destinationCaller";
        readonly type: "bytes32";
    }];
    readonly name: "DepositForBurn";
    readonly type: "event";
}];
/**
 * MessageTransmitter ABI (for receiving on destination chain)
 */
export declare const MESSAGE_TRANSMITTER_ABI: readonly [{
    readonly inputs: readonly [{
        readonly internalType: "bytes";
        readonly name: "message";
        readonly type: "bytes";
    }, {
        readonly internalType: "bytes";
        readonly name: "attestation";
        readonly type: "bytes";
    }];
    readonly name: "receiveMessage";
    readonly outputs: readonly [{
        readonly internalType: "bool";
        readonly name: "success";
        readonly type: "bool";
    }];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}];
/**
 * USDC ABI (for approval)
 */
export declare const USDC_ABI: readonly [{
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "spender";
        readonly type: "address";
    }, {
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly name: "approve";
    readonly outputs: readonly [{
        readonly internalType: "bool";
        readonly name: "";
        readonly type: "bool";
    }];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "owner";
        readonly type: "address";
    }, {
        readonly internalType: "address";
        readonly name: "spender";
        readonly type: "address";
    }];
    readonly name: "allowance";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "account";
        readonly type: "address";
    }];
    readonly name: "balanceOf";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "decimals";
    readonly outputs: readonly [{
        readonly internalType: "uint8";
        readonly name: "";
        readonly type: "uint8";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}];
