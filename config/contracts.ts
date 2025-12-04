/**
 * Smart Contract Addresses and ABIs
 * ArcAccount Multi-Key System
 */

// Contract addresses on Arc Testnet (Chain ID: 5042002)
// Updated with multi-sig support (Dec 2024)
export const ARC_TESTNET_CONTRACTS = {
  entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as const,
  p256Verifier: '0x27ddc8dbf5fabff96b2f0335a705e84a62922b25' as const,
  arcAccountFactory: '0x74f401344ef294686fc6721d8fb817f04c2f65a5' as const,
  arcAccountImplementation: '0x2F308A905218E1b0aDA901A87C8aa9d5AECa56D1' as const,
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

// ArcAccount ABI (full - with multi-sig support)
export const ARC_ACCOUNT_ABI = [
  // Key Management
  'function addSigningKey(bytes32 keyHash, uint8 keyType, string deviceName)',
  'function removeSigningKey(bytes32 keyHash)',
  'function getSigningKeys() view returns (bytes32[] keyHashes, uint8[] keyTypes, bool[] isActive, uint40[] addedAt, string[] deviceNames)',
  'function isValidSigner(bytes32 keyHash) view returns (bool)',
  'function activeKeyCount() view returns (uint8)',

  // Multi-Sig / Threshold
  'function signatureThreshold() view returns (uint8)',
  'function setSignatureThreshold(uint8 newThreshold)',
  'function proposeOperation(bytes32 opHash, uint8 keySlot, bytes signature)',
  'function approveOperation(bytes32 opHash, uint8 keySlot, bytes signature)',
  'function canExecuteOperation(bytes32 opHash) view returns (bool)',
  'function getPendingOperation(bytes32 opHash) view returns (uint8 signatureCount, uint8 requiredSignatures, uint40 createdAt, uint40 expiresAt, bool executed)',
  'function hasKeySigned(bytes32 opHash, bytes32 keyHash) view returns (bool)',
  'function cancelOperation(bytes32 opHash)',

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
  'event OperationProposed(bytes32 indexed opHash, bytes32 indexed keyHash)',
  'event OperationApproved(bytes32 indexed opHash, bytes32 indexed keyHash)',
  'event OperationExecuted(bytes32 indexed opHash)',
  'event ThresholdChanged(uint8 oldThreshold, uint8 newThreshold)',
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
