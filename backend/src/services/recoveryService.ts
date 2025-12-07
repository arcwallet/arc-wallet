/**
 * Recovery Service
 * Handles wallet recovery operations for both individual and corporate users
 *
 * Features:
 * - Backup Key recovery (individual users)
 * - Guardian-based recovery (corporate users)
 * - UserOp building for recovery transactions
 */

import { ethers } from 'ethers';
import { Database } from '../models/Database.js';
import { EnvConfig } from '../types/index.js';

// PasskeyAccount ABI for recovery functions
const PASSKEY_ACCOUNT_ABI = [
  // Backup Keys
  'function getBackupKeys() external view returns (tuple(uint256 x, uint256 y, bool active, string deviceName)[])',
  'function getBackupKeyCount() external view returns (uint256)',
  'function isValidBackupKey(uint256 x, uint256 y) external view returns (bool)',
  'function addBackupKey(uint256 x, uint256 y, string calldata deviceName) external',
  'function removeBackupKey(uint256 x, uint256 y) external',
  'function recoverWithBackupKey(uint256 newPrimaryX, uint256 newPrimaryY, uint256 backupX, uint256 backupY, bytes calldata webAuthnSignature) external',

  // Guardian Recovery
  'function getGuardians() external view returns (address[])',
  'function getGuardianThreshold() external view returns (uint256)',
  'function isGuardian(address guardian) external view returns (bool)',
  'function addGuardian(address guardian) external',
  'function removeGuardian(address guardian) external',
  'function setGuardianThreshold(uint256 threshold) external',
  'function initiateRecovery(uint256 newX, uint256 newY) external',
  'function approveRecovery() external',
  'function executeRecovery() external',
  'function cancelRecovery() external',
  'function getRecoveryStatus() external view returns (bool initiated, uint256 newX, uint256 newY, uint256 executeAfter, uint256 approvalCount)',
];

export interface BackupKey {
  x: string;
  y: string;
  deviceName: string;
  active: boolean;
}

export interface GuardianInfo {
  address: string;
  approved: boolean;
}

export interface RecoveryStatus {
  initiated: boolean;
  newX: string;
  newY: string;
  executeAfter: number;
  approvalCount: number;
  threshold: number;
  guardians: GuardianInfo[];
}

export class RecoveryService {
  private db: Database;
  private config: EnvConfig;
  private provider: ethers.JsonRpcProvider;

  constructor(db: Database, config: EnvConfig) {
    this.db = db;
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.ARC_RPC_URL || 'https://rpc-testnet.arc.network');
  }

  /**
   * Get backup keys for a wallet
   */
  async getBackupKeys(walletAddress: string): Promise<BackupKey[]> {
    try {
      const contract = new ethers.Contract(walletAddress, PASSKEY_ACCOUNT_ABI, this.provider);
      const keys = await contract.getBackupKeys();

      return keys.map((key: any) => ({
        x: '0x' + BigInt(key.x).toString(16).padStart(64, '0'),
        y: '0x' + BigInt(key.y).toString(16).padStart(64, '0'),
        deviceName: key.deviceName,
        active: key.active,
      })).filter((k: BackupKey) => k.active);
    } catch (error) {
      console.error('Failed to get backup keys:', error);
      return [];
    }
  }

  /**
   * Build calldata for adding a backup key
   */
  buildAddBackupKeyCalldata(x: string, y: string, deviceName: string): string {
    const iface = new ethers.Interface(PASSKEY_ACCOUNT_ABI);
    return iface.encodeFunctionData('addBackupKey', [x, y, deviceName]);
  }

  /**
   * Build calldata for removing a backup key
   */
  buildRemoveBackupKeyCalldata(x: string, y: string): string {
    const iface = new ethers.Interface(PASSKEY_ACCOUNT_ABI);
    return iface.encodeFunctionData('removeBackupKey', [x, y]);
  }

  /**
   * Build calldata for recovery with backup key
   */
  buildRecoverWithBackupKeyCalldata(
    newPrimaryX: string,
    newPrimaryY: string,
    backupX: string,
    backupY: string,
    webAuthnSignature: string
  ): string {
    const iface = new ethers.Interface(PASSKEY_ACCOUNT_ABI);
    return iface.encodeFunctionData('recoverWithBackupKey', [
      newPrimaryX,
      newPrimaryY,
      backupX,
      backupY,
      webAuthnSignature,
    ]);
  }

  /**
   * Get guardian recovery status
   */
  async getGuardianRecoveryStatus(walletAddress: string): Promise<RecoveryStatus> {
    try {
      const contract = new ethers.Contract(walletAddress, PASSKEY_ACCOUNT_ABI, this.provider);

      const [status, guardians, threshold] = await Promise.all([
        contract.getRecoveryStatus(),
        contract.getGuardians(),
        contract.getGuardianThreshold(),
      ]);

      return {
        initiated: status.initiated,
        newX: '0x' + BigInt(status.newX).toString(16).padStart(64, '0'),
        newY: '0x' + BigInt(status.newY).toString(16).padStart(64, '0'),
        executeAfter: Number(status.executeAfter),
        approvalCount: Number(status.approvalCount),
        threshold: Number(threshold),
        guardians: guardians.map((addr: string) => ({
          address: addr,
          approved: false, // Would need to check individually
        })),
      };
    } catch (error) {
      console.error('Failed to get recovery status:', error);
      return {
        initiated: false,
        newX: '0x0',
        newY: '0x0',
        executeAfter: 0,
        approvalCount: 0,
        threshold: 0,
        guardians: [],
      };
    }
  }

  /**
   * Build calldata for adding a guardian
   */
  buildAddGuardianCalldata(guardianAddress: string): string {
    const iface = new ethers.Interface(PASSKEY_ACCOUNT_ABI);
    return iface.encodeFunctionData('addGuardian', [guardianAddress]);
  }

  /**
   * Build calldata for removing a guardian
   */
  buildRemoveGuardianCalldata(guardianAddress: string): string {
    const iface = new ethers.Interface(PASSKEY_ACCOUNT_ABI);
    return iface.encodeFunctionData('removeGuardian', [guardianAddress]);
  }

  /**
   * Build calldata for setting guardian threshold
   */
  buildSetGuardianThresholdCalldata(threshold: number): string {
    const iface = new ethers.Interface(PASSKEY_ACCOUNT_ABI);
    return iface.encodeFunctionData('setGuardianThreshold', [threshold]);
  }

  /**
   * Build calldata for initiating recovery
   */
  buildInitiateRecoveryCalldata(newX: string, newY: string): string {
    const iface = new ethers.Interface(PASSKEY_ACCOUNT_ABI);
    return iface.encodeFunctionData('initiateRecovery', [newX, newY]);
  }

  /**
   * Build calldata for approving recovery
   */
  buildApproveRecoveryCalldata(): string {
    const iface = new ethers.Interface(PASSKEY_ACCOUNT_ABI);
    return iface.encodeFunctionData('approveRecovery', []);
  }

  /**
   * Build calldata for executing recovery
   */
  buildExecuteRecoveryCalldata(): string {
    const iface = new ethers.Interface(PASSKEY_ACCOUNT_ABI);
    return iface.encodeFunctionData('executeRecovery', []);
  }

  /**
   * Build calldata for canceling recovery
   */
  buildCancelRecoveryCalldata(): string {
    const iface = new ethers.Interface(PASSKEY_ACCOUNT_ABI);
    return iface.encodeFunctionData('cancelRecovery', []);
  }

  /**
   * Verify if a backup key is valid for a wallet
   */
  async isValidBackupKey(walletAddress: string, x: string, y: string): Promise<boolean> {
    try {
      const contract = new ethers.Contract(walletAddress, PASSKEY_ACCOUNT_ABI, this.provider);
      return await contract.isValidBackupKey(x, y);
    } catch (error) {
      console.error('Failed to check backup key:', error);
      return false;
    }
  }

  /**
   * Check if an address is a guardian
   */
  async isGuardian(walletAddress: string, guardianAddress: string): Promise<boolean> {
    try {
      const contract = new ethers.Contract(walletAddress, PASSKEY_ACCOUNT_ABI, this.provider);
      return await contract.isGuardian(guardianAddress);
    } catch (error) {
      console.error('Failed to check guardian:', error);
      return false;
    }
  }
}
