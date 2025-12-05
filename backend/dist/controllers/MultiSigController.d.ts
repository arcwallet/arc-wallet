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
     */
    signTransaction(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    /**
     * Execute transaction with collected signatures
     */
    executeTransaction(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    /**
     * Format WebAuthn signature for on-chain verification
     */
    private _formatWebAuthnSignature;
    private _base64UrlToHex;
}
//# sourceMappingURL=MultiSigController.d.ts.map