/**
 * Smart Contract Addresses and ABIs
 * ArcAccount Multi-Key System
 */

// Contract addresses on Arc Testnet (Chain ID: 5042002)
export const ARC_TESTNET_CONTRACTS = {
  entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as const,
  p256Verifier: '0xbc3005Af3b06528EAB8E1605C568239da3Be5E37' as const,
  arcAccountFactory: '0xAAD19fd1E49ED5ecE26494c74278200966447363' as const,
  arcAccountImplementation: '0xE4D8e7471F3dC9371d4A766804C1fAF1B69E37aA' as const,
};

// Key types
export const KEY_TYPE = {
  ECDSA: 1,      // secp256k1 (normal Ethereum wallets)
  WEBAUTHN: 2,   // P256 (passkeys/biometric)
} as const;

// ArcAccountFactory ABI (minimal)
export const ARC_ACCOUNT_FACTORY_ABI = [
  'function createAccount(bytes32 keyHash, uint8 keyType, string deviceName, uint256 salt) returns (address)',
  'function getAddress(bytes32 keyHash, uint8 keyType, string deviceName, uint256 salt) view returns (address)',
  'function accountImplementation() view returns (address)',
  'function isAccount(address) view returns (bool)',
] as const;

// ArcAccount ABI (full)
export const ARC_ACCOUNT_ABI = [
  // Key Management
  'function addSigningKey(bytes32 keyHash, uint8 keyType, string deviceName)',
  'function removeSigningKey(bytes32 keyHash)',
  'function getSigningKeys() view returns (bytes32[] keyHashes, uint8[] keyTypes, bool[] isActive, uint40[] addedAt, string[] deviceNames)',
  'function isValidSigner(bytes32 keyHash) view returns (bool)',
  'function activeKeyCount() view returns (uint8)',

  // Execution
  'function execute(address target, uint256 value, bytes data) returns (bytes)',
  'function executeBatch(address[] targets, uint256[] values, bytes[] datas) returns (bytes[])',

  // Account Abstraction
  'function entryPoint() view returns (address)',

  // Events
  'event SigningKeyAdded(uint8 indexed slot, bytes32 indexed keyHash, uint8 keyType, string deviceName)',
  'event SigningKeyRemoved(uint8 indexed slot, bytes32 indexed keyHash)',
  'event Executed(address indexed target, uint256 value, bytes data, bool success)',
  'event ExecutedBatch(address[] targets, uint256[] values, bytes[] datas)',
] as const;

// P256Verifier ABI
export const P256_VERIFIER_ABI = [
  'function verifyWebAuthnSignature(bytes32 challenge, tuple(bytes authenticatorData, bytes clientDataJSON, uint256 challengeIndex, uint256 typeIndex, uint256 r, uint256 s) sig, tuple(uint256 x, uint256 y) pubKey) view returns (bool)',
  'function verifyP256Signature(bytes32 message, uint256 r, uint256 s, uint256 x, uint256 y) view returns (bool)',
  'function computeKeyHash(uint256 x, uint256 y) pure returns (bytes32)',
] as const;

// Get contract addresses by chain ID
export function getContractAddresses(chainId: number) {
  switch (chainId) {
    case 5042002: // Arc Testnet
      return ARC_TESTNET_CONTRACTS;
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`);
  }
}
