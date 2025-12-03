import { v4 as uuidv4 } from 'uuid';
import { ApiError } from '../types/index.js';
export class TreasuryController {
    db;
    constructor(db) {
        this.db = db;
    }
    // ==================== Policy Management ====================
    async getPolicy(req, res, next, authUserId) {
        try {
            const { walletAddress } = req.params;
            if (!walletAddress) {
                throw new ApiError('Wallet address is required', 400, 'INVALID_REQUEST');
            }
            const policy = await this.db.getTreasuryPolicy(walletAddress);
            if (!policy) {
                // Return default policy
                res.json({
                    success: true,
                    data: this.getDefaultPolicy(walletAddress)
                });
                return;
            }
            res.json({
                success: true,
                data: policy
            });
        }
        catch (error) {
            next(error);
        }
    }
    async createOrUpdatePolicy(req, res, next, authUserId) {
        try {
            const { walletAddress } = req.params;
            const policyData = req.body;
            if (!walletAddress) {
                throw new ApiError('Wallet address is required', 400, 'INVALID_REQUEST');
            }
            if (!authUserId) {
                throw new ApiError('Authentication required', 401, 'UNAUTHORIZED');
            }
            const existingPolicy = await this.db.getTreasuryPolicy(walletAddress);
            let policy;
            if (existingPolicy) {
                policy = await this.db.updateTreasuryPolicy(walletAddress, policyData);
            }
            else {
                const defaultPolicy = this.getDefaultPolicy(walletAddress);
                policy = await this.db.createTreasuryPolicy({
                    id: uuidv4(),
                    ...defaultPolicy,
                    ...policyData,
                    walletAddress,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
            // Log audit
            await this.db.createTreasuryAuditLog({
                id: uuidv4(),
                walletAddress,
                action: existingPolicy ? 'update_policy' : 'create_policy',
                performedBy: authUserId,
                details: `Policy ${existingPolicy ? 'updated' : 'created'}`,
                timestamp: new Date()
            });
            res.json({
                success: true,
                data: policy
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ==================== Transaction Management ====================
    async createTransaction(req, res, next, authUserId) {
        try {
            const { walletAddress, operationType, amount, token, outputToken, expectedOutput, submitterEmail, submitterRole, usdcBalance, usycBalance } = req.body;
            if (!authUserId) {
                throw new ApiError('Authentication required', 401, 'UNAUTHORIZED');
            }
            if (!walletAddress || !operationType || !amount || !token) {
                throw new ApiError('Missing required fields', 400, 'INVALID_REQUEST');
            }
            // Validate against policy
            const validation = await this.validateTransaction(walletAddress, operationType, parseFloat(amount), token, submitterRole, usdcBalance, usycBalance);
            if (!validation.allowed) {
                throw new ApiError(validation.reason || 'Transaction not allowed', 403, 'POLICY_VIOLATION');
            }
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
            const transaction = {
                id: uuidv4(),
                walletAddress,
                operationType,
                amount,
                token,
                outputToken,
                expectedOutput,
                submittedBy: authUserId,
                submitterEmail: submitterEmail || authUserId,
                submitterRole: submitterRole || 'member',
                status: validation.requiresApproval ? 'pending_approval' : 'approved',
                requiredSignatures: validation.requiredSignatures,
                currentSignatures: 0,
                createdAt: now,
                updatedAt: now,
                expiresAt
            };
            // If no approval required, auto-approve
            if (!validation.requiresApproval) {
                transaction.currentSignatures = 1;
                await this.db.createTreasurySignature({
                    id: uuidv4(),
                    transactionId: transaction.id,
                    signerId: authUserId,
                    signerEmail: submitterEmail || authUserId,
                    signerRole: submitterRole || 'member',
                    status: 'approved',
                    signedAt: now
                });
            }
            const created = await this.db.createTreasuryTransaction(transaction);
            // Log audit
            await this.db.createTreasuryAuditLog({
                id: uuidv4(),
                walletAddress,
                action: 'create_transaction',
                performedBy: submitterEmail || authUserId,
                details: `Created ${operationType} transaction for ${amount} ${token}`,
                transactionId: created.id,
                timestamp: now
            });
            res.status(201).json({
                success: true,
                data: created
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getTransactions(req, res, next, authUserId) {
        try {
            const { walletAddress } = req.params;
            const { status } = req.query;
            if (!walletAddress) {
                throw new ApiError('Wallet address is required', 400, 'INVALID_REQUEST');
            }
            const transactions = await this.db.getTreasuryTransactions(walletAddress, status);
            // Get signatures for each transaction
            const transactionsWithSignatures = await Promise.all(transactions.map(async (tx) => {
                const signatures = await this.db.getTreasurySignatures(tx.id);
                return { ...tx, signatures };
            }));
            res.json({
                success: true,
                data: transactionsWithSignatures
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getTransaction(req, res, next, authUserId) {
        try {
            const { transactionId } = req.params;
            if (!transactionId) {
                throw new ApiError('Transaction ID is required', 400, 'INVALID_REQUEST');
            }
            const transaction = await this.db.getTreasuryTransaction(transactionId);
            if (!transaction) {
                throw new ApiError('Transaction not found', 404, 'NOT_FOUND');
            }
            const signatures = await this.db.getTreasurySignatures(transactionId);
            res.json({
                success: true,
                data: { ...transaction, signatures }
            });
        }
        catch (error) {
            next(error);
        }
    }
    async signTransaction(req, res, next, authUserId) {
        try {
            const { transactionId } = req.params;
            const { approve, comment, signerEmail, signerRole } = req.body;
            if (!authUserId) {
                throw new ApiError('Authentication required', 401, 'UNAUTHORIZED');
            }
            if (!transactionId) {
                throw new ApiError('Transaction ID is required', 400, 'INVALID_REQUEST');
            }
            const transaction = await this.db.getTreasuryTransaction(transactionId);
            if (!transaction) {
                throw new ApiError('Transaction not found', 404, 'NOT_FOUND');
            }
            if (transaction.status !== 'pending_approval') {
                throw new ApiError('Transaction is not pending approval', 400, 'INVALID_STATUS');
            }
            if (new Date() > transaction.expiresAt) {
                await this.db.updateTreasuryTransaction(transactionId, {
                    status: 'rejected',
                    error: 'Transaction expired'
                });
                throw new ApiError('Transaction has expired', 400, 'EXPIRED');
            }
            // Check if already signed
            const existingSignatures = await this.db.getTreasurySignatures(transactionId);
            const existingSig = existingSignatures.find(s => s.signerId === authUserId);
            if (existingSig) {
                throw new ApiError('You have already signed this transaction', 400, 'ALREADY_SIGNED');
            }
            // Check permission to sign
            const role = signerRole || 'member';
            if (!this.canUserSign(role)) {
                throw new ApiError('You do not have permission to sign treasury transactions', 403, 'FORBIDDEN');
            }
            // Create signature
            const signature = {
                id: uuidv4(),
                transactionId,
                signerId: authUserId,
                signerEmail: signerEmail || authUserId,
                signerRole: role,
                status: approve ? 'approved' : 'rejected',
                comment,
                signedAt: new Date()
            };
            await this.db.createTreasurySignature(signature);
            // Update transaction
            let newStatus = transaction.status;
            let errorMsg;
            if (approve) {
                const newSignatureCount = transaction.currentSignatures + 1;
                if (newSignatureCount >= transaction.requiredSignatures) {
                    newStatus = 'approved';
                }
                await this.db.updateTreasuryTransaction(transactionId, {
                    currentSignatures: newSignatureCount,
                    status: newStatus
                });
            }
            else {
                newStatus = 'rejected';
                errorMsg = `Rejected by ${signerEmail}${comment ? `: ${comment}` : ''}`;
                await this.db.updateTreasuryTransaction(transactionId, {
                    status: newStatus,
                    error: errorMsg
                });
            }
            // Log audit
            await this.db.createTreasuryAuditLog({
                id: uuidv4(),
                walletAddress: transaction.walletAddress,
                action: approve ? 'approve_transaction' : 'reject_transaction',
                performedBy: signerEmail || authUserId,
                details: `${approve ? 'Approved' : 'Rejected'} ${transaction.operationType} transaction for ${transaction.amount} ${transaction.token}`,
                transactionId,
                timestamp: new Date()
            });
            const updatedTransaction = await this.db.getTreasuryTransaction(transactionId);
            const allSignatures = await this.db.getTreasurySignatures(transactionId);
            res.json({
                success: true,
                data: { ...updatedTransaction, signatures: allSignatures }
            });
        }
        catch (error) {
            next(error);
        }
    }
    async executeTransaction(req, res, next, authUserId) {
        try {
            const { transactionId } = req.params;
            const { txHash } = req.body;
            if (!transactionId) {
                throw new ApiError('Transaction ID is required', 400, 'INVALID_REQUEST');
            }
            const transaction = await this.db.getTreasuryTransaction(transactionId);
            if (!transaction) {
                throw new ApiError('Transaction not found', 404, 'NOT_FOUND');
            }
            if (transaction.status !== 'approved') {
                throw new ApiError('Transaction is not approved', 400, 'INVALID_STATUS');
            }
            await this.db.updateTreasuryTransaction(transactionId, {
                status: 'executed',
                txHash
            });
            // Record spending
            await this.db.recordTreasurySpending(transaction.walletAddress, transaction.token, parseFloat(transaction.amount));
            // Log audit
            await this.db.createTreasuryAuditLog({
                id: uuidv4(),
                walletAddress: transaction.walletAddress,
                action: 'execute_transaction',
                performedBy: 'system',
                details: `Executed ${transaction.operationType} transaction for ${transaction.amount} ${transaction.token}`,
                transactionId,
                timestamp: new Date()
            });
            const updatedTransaction = await this.db.getTreasuryTransaction(transactionId);
            res.json({
                success: true,
                data: updatedTransaction
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ==================== Audit Logs ====================
    async getAuditLogs(req, res, next, authUserId) {
        try {
            const { walletAddress } = req.params;
            const { limit = 100, offset = 0 } = req.query;
            if (!walletAddress) {
                throw new ApiError('Wallet address is required', 400, 'INVALID_REQUEST');
            }
            const logs = await this.db.getTreasuryAuditLogs(walletAddress, parseInt(limit), parseInt(offset));
            res.json({
                success: true,
                data: logs
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ==================== Statistics ====================
    async getStatistics(req, res, next, authUserId) {
        try {
            const { walletAddress } = req.params;
            if (!walletAddress) {
                throw new ApiError('Wallet address is required', 400, 'INVALID_REQUEST');
            }
            const transactions = await this.db.getTreasuryTransactions(walletAddress);
            const todaySpending = await this.db.getTodaySpending(walletAddress);
            const stats = {
                pending: 0,
                approved: 0,
                executed: 0,
                rejected: 0,
                totalVolume: { USDC: 0, USYC: 0 },
                todaySpending
            };
            for (const tx of transactions) {
                switch (tx.status) {
                    case 'pending_approval':
                        stats.pending++;
                        break;
                    case 'approved':
                    case 'executing':
                        stats.approved++;
                        break;
                    case 'executed':
                        stats.executed++;
                        stats.totalVolume[tx.token] += parseFloat(tx.amount);
                        break;
                    case 'rejected':
                    case 'failed':
                        stats.rejected++;
                        break;
                }
            }
            res.json({
                success: true,
                data: stats
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ==================== Helper Methods ====================
    getDefaultPolicy(walletAddress) {
        return {
            walletAddress,
            dailyLimit: 100000,
            singleTransactionLimit: 50000,
            requireApprovalAbove: 10000,
            requiredSignatures: 2,
            allowedOperations: ['subscribe', 'redeem', 'transfer', 'rebalance'],
            cooldownPeriod: 60,
            maxYieldAllocation: 80,
            emergencyPauseEnabled: false,
            whitelistedAddresses: []
        };
    }
    async validateTransaction(walletAddress, operationType, amount, token, userRole, usdcBalance, usycBalance) {
        const policy = await this.db.getTreasuryPolicy(walletAddress) || this.getDefaultPolicy(walletAddress);
        // Check if operation is allowed
        if (!policy.allowedOperations.includes(operationType)) {
            return { allowed: false, requiresApproval: false, requiredSignatures: 0, reason: 'Operation not allowed' };
        }
        // Check emergency pause
        if (policy.emergencyPauseEnabled) {
            return { allowed: false, requiresApproval: false, requiredSignatures: 0, reason: 'Treasury is paused' };
        }
        // Check single transaction limit
        if (amount > policy.singleTransactionLimit) {
            return { allowed: false, requiresApproval: false, requiredSignatures: 0, reason: `Amount exceeds single transaction limit of ${policy.singleTransactionLimit}` };
        }
        // Check daily limit
        const todaySpending = await this.db.getTodaySpending(walletAddress);
        const todayTotal = token === 'USDC' ? todaySpending.usdcSpent : todaySpending.usycSpent;
        if (todayTotal + amount > policy.dailyLimit) {
            return { allowed: false, requiresApproval: false, requiredSignatures: 0, reason: `Would exceed daily limit of ${policy.dailyLimit}` };
        }
        // Check max yield allocation for subscribe
        if (operationType === 'subscribe') {
            const totalBalance = usdcBalance + usycBalance;
            const newYieldAmount = usycBalance + amount;
            const newYieldPercentage = totalBalance > 0 ? (newYieldAmount / totalBalance) * 100 : 0;
            if (newYieldPercentage > policy.maxYieldAllocation) {
                return { allowed: false, requiresApproval: false, requiredSignatures: 0, reason: `Would exceed max yield allocation of ${policy.maxYieldAllocation}%` };
            }
        }
        // Determine if approval is required
        const requiresApproval = amount > policy.requireApprovalAbove || userRole === 'member' || userRole === 'viewer';
        return {
            allowed: true,
            requiresApproval,
            requiredSignatures: requiresApproval ? policy.requiredSignatures : 1
        };
    }
    canUserSign(role) {
        return ['admin', 'treasury_manager', 'approver'].includes(role);
    }
}
//# sourceMappingURL=TreasuryController.js.map