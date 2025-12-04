import { Request, Response, NextFunction } from 'express';
import { Database } from '../models/Database.js';
export declare class MultiSigController {
    private db;
    constructor(db: Database);
    private _isMember;
    /**
     * Execute approved transaction on-chain using ERC-4337 UserOperations
     * Collects passkey signatures from DB and submits to bundler
     */
    private _executeOnChain;
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
}
//# sourceMappingURL=MultiSigController.d.ts.map