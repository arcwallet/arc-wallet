import { Request, Response, NextFunction } from 'express';
import { Database } from '../models/Database.js';
export declare class TreasuryController {
    private db;
    constructor(db: Database);
    getPolicy(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    createOrUpdatePolicy(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    createTransaction(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    getTransactions(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    getTransaction(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    signTransaction(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    executeTransaction(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    getAuditLogs(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    getStatistics(req: Request, res: Response, next: NextFunction, authUserId?: string): Promise<void>;
    private getDefaultPolicy;
    private validateTransaction;
    private canUserSign;
}
//# sourceMappingURL=TreasuryController.d.ts.map