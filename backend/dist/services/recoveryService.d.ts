/**
 * Recovery Service
 * Handles wallet recovery operations for both individual and corporate users
 *
 * Features:
 * - Backup Key recovery (individual users)
 * - Guardian-based recovery (corporate users)
 * - UserOp building for recovery transactions
 */
import { Database } from '../models/Database.js';
import { EnvConfig } from '../types/index.js';
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
export declare class RecoveryService {
    private db;
    private config;
    private provider;
    constructor(db: Database, config: EnvConfig);
    /**
     * Get backup keys for a wallet
     */
    getBackupKeys(walletAddress: string): Promise<BackupKey[]>;
    /**
     * Build calldata for adding a backup key
     */
    buildAddBackupKeyCalldata(x: string, y: string, deviceName: string): string;
    /**
     * Build calldata for removing a backup key
     */
    buildRemoveBackupKeyCalldata(x: string, y: string): string;
    /**
     * Build calldata for recovery with backup key
     */
    buildRecoverWithBackupKeyCalldata(newPrimaryX: string, newPrimaryY: string, backupX: string, backupY: string, webAuthnSignature: string): string;
    /**
     * Get guardian recovery status
     */
    getGuardianRecoveryStatus(walletAddress: string): Promise<RecoveryStatus>;
    /**
     * Build calldata for adding a guardian
     */
    buildAddGuardianCalldata(guardianAddress: string): string;
    /**
     * Build calldata for removing a guardian
     */
    buildRemoveGuardianCalldata(guardianAddress: string): string;
    /**
     * Build calldata for setting guardian threshold
     */
    buildSetGuardianThresholdCalldata(threshold: number): string;
    /**
     * Build calldata for initiating recovery
     */
    buildInitiateRecoveryCalldata(newX: string, newY: string): string;
    /**
     * Build calldata for approving recovery
     */
    buildApproveRecoveryCalldata(): string;
    /**
     * Build calldata for executing recovery
     */
    buildExecuteRecoveryCalldata(): string;
    /**
     * Build calldata for canceling recovery
     */
    buildCancelRecoveryCalldata(): string;
    /**
     * Verify if a backup key is valid for a wallet
     */
    isValidBackupKey(walletAddress: string, x: string, y: string): Promise<boolean>;
    /**
     * Check if an address is a guardian
     */
    isGuardian(walletAddress: string, guardianAddress: string): Promise<boolean>;
}
//# sourceMappingURL=recoveryService.d.ts.map