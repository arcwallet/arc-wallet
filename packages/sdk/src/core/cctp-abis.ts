/**
 * TokenMessenger ABI
 * Circle CCTP TokenMessenger contract interface
 */

export const TOKEN_MESSENGER_ABI = [
    {
        inputs: [
            {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
            },
            {
                internalType: 'uint32',
                name: 'destinationDomain',
                type: 'uint32',
            },
            {
                internalType: 'bytes32',
                name: 'mintRecipient',
                type: 'bytes32',
            },
            {
                internalType: 'address',
                name: 'burnToken',
                type: 'address',
            },
        ],
        name: 'depositForBurn',
        outputs: [
            {
                internalType: 'uint64',
                name: '_nonce',
                type: 'uint64',
            },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: 'uint64',
                name: 'nonce',
                type: 'uint64',
            },
            {
                indexed: true,
                internalType: 'address',
                name: 'burnToken',
                type: 'address',
            },
            {
                indexed: false,
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
            },
            {
                indexed: true,
                internalType: 'address',
                name: 'depositor',
                type: 'address',
            },
            {
                indexed: false,
                internalType: 'bytes32',
                name: 'mintRecipient',
                type: 'bytes32',
            },
            {
                indexed: false,
                internalType: 'uint32',
                name: 'destinationDomain',
                type: 'uint32',
            },
            {
                indexed: false,
                internalType: 'bytes32',
                name: 'destinationTokenMessenger',
                type: 'bytes32',
            },
            {
                indexed: false,
                internalType: 'bytes32',
                name: 'destinationCaller',
                type: 'bytes32',
            },
        ],
        name: 'DepositForBurn',
        type: 'event',
    },
] as const;

/**
 * MessageTransmitter ABI (for receiving on destination chain)
 */
export const MESSAGE_TRANSMITTER_ABI = [
    {
        inputs: [
            {
                internalType: 'bytes',
                name: 'message',
                type: 'bytes',
            },
            {
                internalType: 'bytes',
                name: 'attestation',
                type: 'bytes',
            },
        ],
        name: 'receiveMessage',
        outputs: [
            {
                internalType: 'bool',
                name: 'success',
                type: 'bool',
            },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const;

/**
 * USDC ABI (for approval)
 */
export const USDC_ABI = [
    {
        inputs: [
            {
                internalType: 'address',
                name: 'spender',
                type: 'address',
            },
            {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
            },
        ],
        name: 'approve',
        outputs: [
            {
                internalType: 'bool',
                name: '',
                type: 'bool',
            },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            {
                internalType: 'address',
                name: 'owner',
                type: 'address',
            },
            {
                internalType: 'address',
                name: 'spender',
                type: 'address',
            },
        ],
        name: 'allowance',
        outputs: [
            {
                internalType: 'uint256',
                name: '',
                type: 'uint256',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            {
                internalType: 'address',
                name: 'account',
                type: 'address',
            },
        ],
        name: 'balanceOf',
        outputs: [
            {
                internalType: 'uint256',
                name: '',
                type: 'uint256',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'decimals',
        outputs: [
            {
                internalType: 'uint8',
                name: '',
                type: 'uint8',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
] as const;
