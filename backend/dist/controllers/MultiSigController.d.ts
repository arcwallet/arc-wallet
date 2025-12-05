import { Request, Response, NextFunction } from 'express';
import { Database } from '../models/Database.js';
export declare class MultiSigController {
    private db;
    constructor(db: Database);
    private _isMember;
    /**
     * Check if transaction can be executed (balance check only)
     * Real execution happens via executeTransaction endpoint with aggregated signature from frontend
     */
    private _canExecute;
    /**
     * Execute transaction with aggregated passkey signature from frontend
     */
    executeWithSignature(transactionId: string, aggregatedSignature: string): Promise<{
        success: boolean;
        txHash?: string;
        error?: string;
    }>;
    createAccount(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    getAccounts(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    getAccount(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    updateAccount(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    addMember(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    removeMember(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    createTransaction(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    getTransaction(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    getTransactions(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    approveTransaction(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    rejectTransaction(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    deployContract(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    /**
     * Prepare transaction for signing - returns userOpHash
     */
    prepareTransaction(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    /**
     * Submit passkey signature for transaction
     * SECURITY: Now requires publicKeyX and publicKeyY for on-chain verification
     */
    signTransaction(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    /**
     * Execute transaction with collected signatures
     * SECURITY FIX: Now properly aggregates ALL approved signatures
     */
    executeTransaction(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    /**
     * SECURITY FIX: Aggregate multiple passkey signatures for multi-sig verification
     * Format matches ArcMultiSigWallet._validateAggregatedSignature expectation:
     * abi.encode(bytes32[] keyHashes, bytes[] signatures)
     */
    private _aggregateMultiSigSignatures;
    /**
     * Format single WebAuthn signature for on-chain verification
     * Matches WebAuthnSignature struct in contract
     */
    private _formatWebAuthnSignatureWithIndices;
    /**
     * Parse P256 signature from DER format to r, s values
     */
    private _parseP256Signature;
    /**
     * Format WebAuthn signature for on-chain verification (legacy single sig)
     */
    private _formatWebAuthnSignature;
    private _base64UrlToHex;
}
//# sourceMappingURL=MultiSigController.d.ts.map