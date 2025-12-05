import { v4 as uuidv4 } from 'uuid';
import { ethers } from 'ethers';
import { ApiError } from '../types/index.js';
import { getExecutionService } from '../services/MultiSigExecutionService.js';
import { getEmailService } from '../services/EmailService.js';
export class MultiSigController {
    db;
    constructor(db) {
        this.db = db;
    }
    async _isMember(accountId, userId, roles = ['owner', 'signer', 'viewer']) {
        const members = await this.db.getMultiSigMembers(accountId);
        return members.some(m => m.userId === userId && m.status === 'active' && roles.includes(m.role));
    }
    /**
     * Check if transaction can be executed (balance check only)
     * Real execution happens via executeTransaction endpoint with aggregated signature from frontend
     */
    async _canExecute(transaction, account) {
        try {
            // Check if account has contract address
            if (!account.address) {
                return { canExecute: false, error: 'Contract not deployed' };
            }
            const executionService = getExecutionService();
            // Check balance before execution
            const hasBalance = await executionService.checkBalance(account.address, transaction.value, transaction.tokenAddress || undefined);
            if (!hasBalance) {
                return { canExecute: false, error: 'Insufficient balance' };
            }
            return { canExecute: true };
        }
        catch (error) {
            console.error('Execution check failed:', error);
            return { canExecute: false, error: error.message || 'Check failed' };
        }
    }
    /**
     * Execute transaction with aggregated passkey signature from frontend
     */
    async executeWithSignature(transactionId, aggregatedSignature) {
        try {
            const transaction = await this.db.getMultiSigTransaction(transactionId);
            if (!transaction) {
                return { success: false, error: 'Transaction not found' };
            }
            const account = await this.db.getMultiSigAccount(transaction.accountId);
            if (!account || !account.address) {
                return { success: false, error: 'Account not found or not deployed' };
            }
            const executionService = getExecutionService();
            const result = await executionService.executeTransaction({
                accountAddress: account.address,
                targetAddress: transaction.targetAddress,
                value: transaction.value,
                tokenAddress: transaction.tokenAddress,
                tokenSymbol: transaction.tokenSymbol,
                data: transaction.data,
            }, aggregatedSignature);
            if (result.success) {
                await this.db.updateMultiSigTransaction(transactionId, {
                    status: 'executed',
                    txHash: result.txHash || null
                });
            }
            return result;
        }
        catch (error) {
            console.error('On-chain execution failed:', error);
            return { success: false, error: error.message || 'Execution failed' };
        }
    }
    // Create a new multi-sig account
    async createAccount(req, res, next, authUserId) {
        try {
            const { name, requiredSignatures, members } = req.body;
            const createdBy = authUserId;
            if (!name || !requiredSignatures || !createdBy) {
                throw new ApiError('Missing required fields: name, requiredSignatures, and authenticated user', 400, 'INVALID_REQUEST');
            }
            if (!members || !Array.isArray(members) || members.length === 0) {
                throw new ApiError('At least one member is required', 400, 'INVALID_REQUEST');
            }
            if (requiredSignatures > members.length) {
                throw new ApiError('Required signatures cannot exceed number of members', 400, 'INVALID_THRESHOLD');
            }
            if (requiredSignatures < 1) {
                throw new ApiError('Required signatures must be at least 1', 400, 'INVALID_THRESHOLD');
            }
            // Create the account
            const accountId = uuidv4();
            const account = await this.db.createMultiSigAccount({
                id: accountId,
                name,
                address: null, // Will be set when contract is deployed
                requiredSignatures,
                createdBy
            });
            // Add creator as owner
            await this.db.addMultiSigMember({
                id: uuidv4(),
                accountId,
                userId: createdBy,
                email: members.find((m) => m.userId === createdBy)?.email || '',
                role: 'owner',
                status: 'active'
            });
            // Add other members
            for (const member of members) {
                if (member.userId === createdBy)
                    continue; // Skip creator, already added
                await this.db.addMultiSigMember({
                    id: uuidv4(),
                    accountId,
                    userId: member.userId || uuidv4(), // Generate temp ID for invited members
                    email: member.email,
                    role: member.role || 'signer',
                    status: 'pending'
                });
            }
            // Get all members for response
            const allMembers = await this.db.getMultiSigMembers(accountId);
            res.status(201).json({
                success: true,
                data: {
                    account,
                    members: allMembers
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    // Get accounts for a user
    async getAccounts(req, res, next, authUserId) {
        try {
            const userId = authUserId;
            if (!userId) {
                throw new ApiError('User ID is required', 401, 'UNAUTHORIZED');
            }
            const accounts = await this.db.getMultiSigAccountsByUser(userId);
            // Get members and pending transactions for each account
            const accountsWithDetails = await Promise.all(accounts.map(async (account) => {
                const members = await this.db.getMultiSigMembers(account.id);
                const transactions = await this.db.getMultiSigTransactionsByAccount(account.id);
                const pendingCount = transactions.filter(tx => tx.status === 'pending').length;
                return {
                    ...account,
                    members,
                    pendingTransactions: pendingCount
                };
            }));
            res.json({
                success: true,
                data: accountsWithDetails
            });
        }
        catch (error) {
            next(error);
        }
    }
    // Get single account details
    async getAccount(req, res, next, authUserId) {
        try {
            const { accountId } = req.params;
            if (!authUserId) {
                throw new ApiError('User not authenticated', 401, 'UNAUTHORIZED');
            }
            // Authorization check
            if (!await this._isMember(accountId, authUserId)) {
                throw new ApiError('You are not a member of this account', 403, 'FORBIDDEN');
            }
            const account = await this.db.getMultiSigAccount(accountId);
            if (!account) {
                throw new ApiError('Account not found', 404, 'NOT_FOUND');
            }
            const members = await this.db.getMultiSigMembers(accountId);
            const transactions = await this.db.getMultiSigTransactionsByAccount(accountId);
            res.json({
                success: true,
                data: {
                    account,
                    members,
                    transactions
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    // Update account (threshold, name)
    async updateAccount(req, res, next, authUserId) {
        try {
            const { accountId } = req.params;
            const { name, requiredSignatures } = req.body;
            if (!authUserId) {
                throw new ApiError('User not authenticated', 401, 'UNAUTHORIZED');
            }
            // Authorization check: User must be an owner
            if (!await this._isMember(accountId, authUserId, ['owner'])) {
                throw new ApiError('Only owners can update account settings', 403, 'FORBIDDEN');
            }
            const account = await this.db.getMultiSigAccount(accountId);
            if (!account) {
                throw new ApiError('Account not found', 404, 'NOT_FOUND');
            }
            // Validate new threshold
            if (requiredSignatures !== undefined) {
                const members = await this.db.getMultiSigMembers(accountId);
                const activeMembers = members.filter(m => m.status === 'active');
                if (requiredSignatures > activeMembers.length) {
                    throw new ApiError('Required signatures cannot exceed number of active members', 400, 'INVALID_THRESHOLD');
                }
                if (requiredSignatures < 1) {
                    throw new ApiError('Required signatures must be at least 1', 400, 'INVALID_THRESHOLD');
                }
            }
            const updates = {};
            if (name)
                updates.name = name;
            if (requiredSignatures)
                updates.requiredSignatures = requiredSignatures;
            if (Object.keys(updates).length > 0) {
                await this.db.updateMultiSigAccount(accountId, updates);
            }
            const updatedAccount = await this.db.getMultiSigAccount(accountId);
            res.json({
                success: true,
                data: updatedAccount
            });
        }
        catch (error) {
            next(error);
        }
    }
    // Add member to account
    async addMember(req, res, next, authUserId) {
        try {
            const { accountId } = req.params;
            const { email, role } = req.body;
            if (!authUserId) {
                throw new ApiError('User not authenticated', 401, 'UNAUTHORIZED');
            }
            // Authorization check: User must be an owner
            if (!await this._isMember(accountId, authUserId, ['owner'])) {
                throw new ApiError('Only owners can add members', 403, 'FORBIDDEN');
            }
            const account = await this.db.getMultiSigAccount(accountId);
            if (!account) {
                throw new ApiError('Account not found', 404, 'NOT_FOUND');
            }
            // Check if email already exists in account
            const members = await this.db.getMultiSigMembers(accountId);
            const existingMember = members.find(m => m.email === email && m.status !== 'removed');
            if (existingMember) {
                throw new ApiError('This email is already a member of this account', 400, 'MEMBER_EXISTS');
            }
            const newMember = await this.db.addMultiSigMember({
                id: uuidv4(),
                accountId,
                userId: uuidv4(), // Temporary ID until they accept
                email,
                role: role || 'signer',
                status: 'pending'
            });
            // Send invitation email
            const emailService = getEmailService();
            const appUrl = process.env.APP_URL || 'https://arcwallet.network';
            const inviteLink = `${appUrl}/invite/${newMember.id}`;
            await emailService.sendInvitation({
                toEmail: email,
                inviterName: 'Team Admin', // Could fetch actual user name
                accountName: account.name,
                role: role || 'signer',
                inviteLink,
            });
            res.status(201).json({
                success: true,
                data: newMember
            });
        }
        catch (error) {
            next(error);
        }
    }
    // Remove member from account
    async removeMember(req, res, next, authUserId) {
        try {
            const { accountId, memberId } = req.params;
            if (!authUserId) {
                throw new ApiError('User not authenticated', 401, 'UNAUTHORIZED');
            }
            // Authorization check: User must be an owner
            if (!await this._isMember(accountId, authUserId, ['owner'])) {
                throw new ApiError('Only owners can remove members', 403, 'FORBIDDEN');
            }
            const account = await this.db.getMultiSigAccount(accountId);
            if (!account) {
                throw new ApiError('Account not found', 404, 'NOT_FOUND');
            }
            const members = await this.db.getMultiSigMembers(accountId);
            // Find member to remove
            const memberToRemove = members.find(m => m.id === memberId);
            if (!memberToRemove) {
                throw new ApiError('Member not found', 404, 'NOT_FOUND');
            }
            // Cannot remove yourself if you're the only owner
            if (memberToRemove.userId === authUserId) {
                const owners = members.filter(m => m.role === 'owner' && m.status === 'active');
                if (owners.length === 1) {
                    throw new ApiError('Cannot remove the only owner', 400, 'INVALID_OPERATION');
                }
            }
            // Check if removing would make threshold impossible
            const activeMembers = members.filter(m => m.status === 'active' && m.id !== memberId);
            if (activeMembers.length < account.requiredSignatures) {
                throw new ApiError(`Cannot remove member. Would leave ${activeMembers.length} members but ${account.requiredSignatures} signatures required.`, 400, 'THRESHOLD_VIOLATION');
            }
            await this.db.updateMultiSigMemberStatus(memberId, 'removed');
            res.json({
                success: true,
                message: 'Member removed successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    // Create a transaction request
    async createTransaction(req, res, next, authUserId) {
        try {
            const { accountId, targetAddress, value, tokenAddress, tokenSymbol, data, description } = req.body;
            const submitterId = authUserId;
            if (!accountId || !targetAddress || !value || !submitterId) {
                throw new ApiError('Missing required fields', 400, 'INVALID_REQUEST');
            }
            if (!ethers.isAddress(targetAddress)) {
                throw new ApiError('Invalid target address', 400, 'INVALID_ADDRESS');
            }
            // Authorization check: User must be an owner or signer
            if (!await this._isMember(accountId, submitterId, ['owner', 'signer'])) {
                throw new ApiError('You do not have permission to create transactions', 403, 'FORBIDDEN');
            }
            const account = await this.db.getMultiSigAccount(accountId);
            if (!account) {
                throw new ApiError('Account not found', 404, 'NOT_FOUND');
            }
            // 24 hour expiration
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const transaction = await this.db.createMultiSigTransaction({
                id: uuidv4(),
                accountId,
                submitterId,
                targetAddress,
                value,
                tokenAddress: tokenAddress || null,
                tokenSymbol: tokenSymbol || 'ETH',
                data: data || null,
                description: description || null,
                status: 'pending',
                txHash: null,
                onChainTxId: null,
                expiresAt
            });
            // Auto-approve by submitter
            await this.db.addMultiSigSignature({
                id: uuidv4(),
                transactionId: transaction.id,
                signerId: submitterId,
                signerAddress: '', // Will be set when they sign
                status: 'approved'
            });
            // Check if already has enough signatures
            const approvalCount = await this.db.getApprovalCount(transaction.id);
            let readyToExecute = false;
            let canExecuteError;
            if (approvalCount >= account.requiredSignatures) {
                // Check if transaction can be executed (balance check)
                const execCheck = await this._canExecute(transaction, account);
                readyToExecute = execCheck.canExecute;
                canExecuteError = execCheck.error;
                // Note: Actual execution happens via frontend with aggregated passkey signature
            }
            res.status(201).json({
                success: true,
                data: {
                    transaction,
                    approvalCount,
                    requiredSignatures: account.requiredSignatures,
                    readyToExecute,
                    canExecuteError
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    // Get transaction details
    async getTransaction(req, res, next, authUserId) {
        try {
            const { transactionId } = req.params;
            if (!authUserId) {
                throw new ApiError('User not authenticated', 401, 'UNAUTHORIZED');
            }
            const transaction = await this.db.getMultiSigTransaction(transactionId);
            if (!transaction) {
                throw new ApiError('Transaction not found', 404, 'NOT_FOUND');
            }
            // Authorization check
            if (!await this._isMember(transaction.accountId, authUserId)) {
                throw new ApiError('You are not a member of this account', 403, 'FORBIDDEN');
            }
            const signatures = await this.db.getMultiSigSignatures(transactionId);
            const account = await this.db.getMultiSigAccount(transaction.accountId);
            const approvalCount = await this.db.getApprovalCount(transactionId);
            res.json({
                success: true,
                data: {
                    transaction,
                    signatures,
                    approvalCount,
                    requiredSignatures: account?.requiredSignatures || 0
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    // Get transactions for an account
    async getTransactions(req, res, next, authUserId) {
        try {
            const { accountId } = req.params;
            const { status } = req.query;
            if (!authUserId) {
                throw new ApiError('User not authenticated', 401, 'UNAUTHORIZED');
            }
            // Authorization check
            if (!await this._isMember(accountId, authUserId)) {
                throw new ApiError('You are not a member of this account', 403, 'FORBIDDEN');
            }
            // Expire old transactions first
            await this.db.expireOldMultiSigTransactions();
            const account = await this.db.getMultiSigAccount(accountId);
            if (!account) {
                throw new ApiError('Account not found', 404, 'NOT_FOUND');
            }
            let transactions = await this.db.getMultiSigTransactionsByAccount(accountId);
            if (status) {
                transactions = transactions.filter(tx => tx.status === status);
            }
            // Add signature info to each transaction
            const transactionsWithSignatures = await Promise.all(transactions.map(async (tx) => {
                const signatures = await this.db.getMultiSigSignatures(tx.id);
                const approvalCount = await this.db.getApprovalCount(tx.id);
                return {
                    ...tx,
                    signatures,
                    approvalCount,
                    requiredSignatures: account.requiredSignatures
                };
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
    // Approve a transaction
    async approveTransaction(req, res, next, authUserId) {
        try {
            const { transactionId } = req.params;
            const { signerAddress } = req.body;
            const userId = authUserId;
            if (!userId) {
                throw new ApiError('User not authenticated', 401, 'UNAUTHORIZED');
            }
            const transaction = await this.db.getMultiSigTransaction(transactionId);
            if (!transaction) {
                throw new ApiError('Transaction not found', 404, 'NOT_FOUND');
            }
            if (transaction.status !== 'pending') {
                throw new ApiError(`Transaction is ${transaction.status}`, 400, 'INVALID_STATUS');
            }
            if (new Date(transaction.expiresAt) < new Date()) {
                await this.db.updateMultiSigTransaction(transactionId, { status: 'expired' });
                throw new ApiError('Transaction has expired', 400, 'TRANSACTION_EXPIRED');
            }
            // Authorization check: User must be an owner or signer
            if (!await this._isMember(transaction.accountId, userId, ['owner', 'signer'])) {
                throw new ApiError('You do not have permission to approve transactions', 403, 'FORBIDDEN');
            }
            const signatures = await this.db.getMultiSigSignatures(transactionId);
            if (signatures.some(s => s.signerId === userId)) {
                throw new ApiError('You have already voted on this transaction', 400, 'ALREADY_SIGNED');
            }
            await this.db.addMultiSigSignature({
                id: uuidv4(),
                transactionId,
                signerId: userId,
                signerAddress: signerAddress || '',
                status: 'approved'
            });
            const account = await this.db.getMultiSigAccount(transaction.accountId);
            const approvalCount = await this.db.getApprovalCount(transactionId);
            let readyToExecute = false;
            let canExecuteError;
            if (account && approvalCount >= account.requiredSignatures) {
                // Check if transaction can be executed (balance check)
                const execCheck = await this._canExecute(transaction, account);
                readyToExecute = execCheck.canExecute;
                canExecuteError = execCheck.error;
                // Note: Actual execution happens via frontend with aggregated passkey signature
            }
            res.json({
                success: true,
                data: {
                    approvalCount,
                    requiredSignatures: account?.requiredSignatures || 0,
                    readyToExecute,
                    canExecuteError
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    // Reject a transaction
    async rejectTransaction(req, res, next, authUserId) {
        try {
            const { transactionId } = req.params;
            const { signerAddress } = req.body;
            const userId = authUserId;
            if (!userId) {
                throw new ApiError('User not authenticated', 401, 'UNAUTHORIZED');
            }
            const transaction = await this.db.getMultiSigTransaction(transactionId);
            if (!transaction) {
                throw new ApiError('Transaction not found', 404, 'NOT_FOUND');
            }
            if (transaction.status !== 'pending') {
                throw new ApiError(`Transaction is ${transaction.status}`, 400, 'INVALID_STATUS');
            }
            // Authorization check: User must be an owner or signer
            if (!await this._isMember(transaction.accountId, userId, ['owner', 'signer'])) {
                throw new ApiError('You do not have permission to reject transactions', 403, 'FORBIDDEN');
            }
            const signatures = await this.db.getMultiSigSignatures(transactionId);
            if (signatures.some(s => s.signerId === userId)) {
                throw new ApiError('You have already voted on this transaction', 400, 'ALREADY_SIGNED');
            }
            await this.db.addMultiSigSignature({
                id: uuidv4(),
                transactionId,
                signerId: userId,
                signerAddress: signerAddress || '',
                status: 'rejected'
            });
            const account = await this.db.getMultiSigAccount(transaction.accountId);
            const allSignatures = await this.db.getMultiSigSignatures(transactionId);
            const rejectionCount = allSignatures.filter(s => s.status === 'rejected').length;
            let rejected = false;
            if (account) {
                const members = await this.db.getMultiSigMembers(transaction.accountId);
                const activeMembers = members.filter(m => m.status === 'active' && m.role !== 'viewer');
                const maxPossibleApprovals = activeMembers.length - rejectionCount;
                if (maxPossibleApprovals < account.requiredSignatures) {
                    await this.db.updateMultiSigTransaction(transactionId, { status: 'rejected' });
                    rejected = true;
                }
            }
            res.json({
                success: true,
                data: {
                    rejectionCount,
                    rejected
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    // Deploy multi-sig contract (set address)
    async deployContract(req, res, next, authUserId) {
        try {
            const { accountId } = req.params;
            const { address } = req.body;
            if (!authUserId) {
                throw new ApiError('User not authenticated', 401, 'UNAUTHORIZED');
            }
            if (!address || !ethers.isAddress(address)) {
                throw new ApiError('Valid contract address is required', 400, 'INVALID_ADDRESS');
            }
            // Authorization check: User must be an owner
            if (!await this._isMember(accountId, authUserId, ['owner'])) {
                throw new ApiError('Only owners can deploy contracts', 403, 'FORBIDDEN');
            }
            const account = await this.db.getMultiSigAccount(accountId);
            if (!account) {
                throw new ApiError('Account not found', 404, 'NOT_FOUND');
            }
            if (account.address) {
                throw new ApiError('Contract already deployed', 400, 'ALREADY_DEPLOYED');
            }
            await this.db.updateMultiSigAccount(accountId, { address });
            res.json({
                success: true,
                data: {
                    accountId,
                    address
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Prepare transaction for signing - returns userOpHash
     */
    async prepareTransaction(req, res, next, authUserId) {
        try {
            const { transactionId } = req.params;
            if (!authUserId) {
                throw new ApiError('User not authenticated', 401, 'UNAUTHORIZED');
            }
            const transaction = await this.db.getMultiSigTransaction(transactionId);
            if (!transaction) {
                throw new ApiError('Transaction not found', 404, 'NOT_FOUND');
            }
            // Authorization check
            if (!await this._isMember(transaction.accountId, authUserId, ['owner', 'signer'])) {
                throw new ApiError('You do not have permission to sign transactions', 403, 'FORBIDDEN');
            }
            const account = await this.db.getMultiSigAccount(transaction.accountId);
            if (!account || !account.address) {
                throw new ApiError('Account not found or contract not deployed', 404, 'NOT_FOUND');
            }
            const executionService = getExecutionService();
            const userOp = await executionService.prepareUserOperation({
                accountAddress: account.address,
                targetAddress: transaction.targetAddress,
                value: transaction.value,
                tokenAddress: transaction.tokenAddress,
                tokenSymbol: transaction.tokenSymbol,
                data: transaction.data,
            });
            if (!userOp) {
                throw new ApiError('Failed to prepare UserOperation', 500, 'PREPARE_FAILED');
            }
            res.json({
                success: true,
                data: {
                    userOp,
                    transaction,
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Submit passkey signature for transaction
     */
    async signTransaction(req, res, next, authUserId) {
        try {
            const { transactionId } = req.params;
            const { signature, authenticatorData, clientDataJSON, credentialId } = req.body;
            if (!authUserId) {
                throw new ApiError('User not authenticated', 401, 'UNAUTHORIZED');
            }
            if (!signature || !authenticatorData || !clientDataJSON) {
                throw new ApiError('Missing signature data', 400, 'INVALID_REQUEST');
            }
            const transaction = await this.db.getMultiSigTransaction(transactionId);
            if (!transaction) {
                throw new ApiError('Transaction not found', 404, 'NOT_FOUND');
            }
            if (transaction.status !== 'pending') {
                throw new ApiError(`Transaction is ${transaction.status}`, 400, 'INVALID_STATUS');
            }
            // Authorization check
            if (!await this._isMember(transaction.accountId, authUserId, ['owner', 'signer'])) {
                throw new ApiError('You do not have permission to sign transactions', 403, 'FORBIDDEN');
            }
            // Check if already signed
            const existingSignatures = await this.db.getMultiSigSignatures(transactionId);
            if (existingSignatures.some(s => s.signerId === authUserId)) {
                throw new ApiError('You have already signed this transaction', 400, 'ALREADY_SIGNED');
            }
            // Store the passkey signature data
            // Format: JSON string with all WebAuthn data for later aggregation
            const passkeySignature = JSON.stringify({
                signature,
                authenticatorData,
                clientDataJSON,
                credentialId,
            });
            await this.db.addMultiSigSignature({
                id: uuidv4(),
                transactionId,
                signerId: authUserId,
                signerAddress: passkeySignature, // Store passkey data in signerAddress field
                status: 'approved'
            });
            const account = await this.db.getMultiSigAccount(transaction.accountId);
            const approvalCount = await this.db.getApprovalCount(transactionId);
            const readyToExecute = account ? approvalCount >= account.requiredSignatures : false;
            res.json({
                success: true,
                data: {
                    approvalCount,
                    requiredSignatures: account?.requiredSignatures || 0,
                    readyToExecute,
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Execute transaction with collected signatures
     */
    async executeTransaction(req, res, next, authUserId) {
        try {
            const { transactionId } = req.params;
            if (!authUserId) {
                throw new ApiError('User not authenticated', 401, 'UNAUTHORIZED');
            }
            const transaction = await this.db.getMultiSigTransaction(transactionId);
            if (!transaction) {
                throw new ApiError('Transaction not found', 404, 'NOT_FOUND');
            }
            if (transaction.status !== 'pending') {
                throw new ApiError(`Transaction is ${transaction.status}`, 400, 'INVALID_STATUS');
            }
            // Authorization check
            if (!await this._isMember(transaction.accountId, authUserId, ['owner', 'signer'])) {
                throw new ApiError('You do not have permission to execute transactions', 403, 'FORBIDDEN');
            }
            const account = await this.db.getMultiSigAccount(transaction.accountId);
            if (!account || !account.address) {
                throw new ApiError('Account not found or contract not deployed', 404, 'NOT_FOUND');
            }
            // Check threshold met
            const approvalCount = await this.db.getApprovalCount(transactionId);
            if (approvalCount < account.requiredSignatures) {
                throw new ApiError(`Not enough approvals: ${approvalCount}/${account.requiredSignatures}`, 400, 'THRESHOLD_NOT_MET');
            }
            // Get all approved signatures
            const signatures = await this.db.getMultiSigSignatures(transactionId);
            const approvedSignatures = signatures.filter(s => s.status === 'approved');
            // Aggregate passkey signatures into single signature for UserOp
            // For now, use first signature (single-key verification)
            // TODO: Implement proper multi-sig aggregation when contract supports it
            let aggregatedSignature = '0x';
            if (approvedSignatures.length > 0 && approvedSignatures[0].signerAddress) {
                try {
                    const sigData = JSON.parse(approvedSignatures[0].signerAddress);
                    // Format signature for WebAuthn verification on-chain
                    // This format is compatible with P256 signature verification
                    aggregatedSignature = this._formatWebAuthnSignature(sigData);
                }
                catch {
                    // If not JSON, use as-is (backwards compatibility)
                    aggregatedSignature = approvedSignatures[0].signerAddress || '0x';
                }
            }
            // Execute via bundler
            const result = await this.executeWithSignature(transactionId, aggregatedSignature);
            if (result.success) {
                // Send notification emails to all members
                const emailService = getEmailService();
                const members = await this.db.getMultiSigMembers(transaction.accountId);
                for (const member of members) {
                    if (member.email && member.status === 'active') {
                        await emailService.sendTransactionExecuted(member.email, account.name, result.txHash || 'pending', transaction.value, transaction.tokenSymbol);
                    }
                }
            }
            res.json({
                success: true,
                data: result
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Format WebAuthn signature for on-chain verification
     */
    _formatWebAuthnSignature(sigData) {
        // Encode WebAuthn signature components for on-chain verification
        // Format: abi.encode(authenticatorData, clientDataJSON, signature)
        const abiCoder = new ethers.AbiCoder();
        // Decode base64url to bytes
        const authData = this._base64UrlToHex(sigData.authenticatorData);
        const clientData = this._base64UrlToHex(sigData.clientDataJSON);
        const sig = this._base64UrlToHex(sigData.signature);
        return abiCoder.encode(['bytes', 'bytes', 'bytes'], [authData, clientData, sig]);
    }
    _base64UrlToHex(base64url) {
        const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        const pad = base64.length % 4;
        const padded = base64 + (pad ? '='.repeat(4 - pad) : '');
        // Decode base64 to bytes
        const binary = Buffer.from(padded, 'base64');
        return '0x' + binary.toString('hex');
    }
}
//# sourceMappingURL=MultiSigController.js.map