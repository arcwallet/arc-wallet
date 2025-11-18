import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ethers } from 'ethers';
import { Database } from '../models/Database';
import { ApiError, MultiSigAccount, MultiSigMember, MultiSigTransaction, MultiSigSignature } from '../types';

export class MultiSigController {
  private db: Database;

  constructor() {
    this.db = new Database(process.env.DB_PATH || './data/passkeys.db');
  }

  // Create a new multi-sig account
  async createAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, requiredSignatures, members } = req.body;
      const createdBy = req.body.userId; // Should come from auth middleware

      if (!name || !requiredSignatures || !createdBy) {
        throw new ApiError('Missing required fields: name, requiredSignatures, userId', 400, 'INVALID_REQUEST');
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
        email: members.find((m: any) => m.userId === createdBy)?.email || '',
        role: 'owner',
        status: 'active'
      });

      // Add other members
      for (const member of members) {
        if (member.userId === createdBy) continue; // Skip creator, already added

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
    } catch (error) {
      next(error);
    }
  }

  // Get accounts for a user
  async getAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        throw new ApiError('User ID is required', 400, 'INVALID_REQUEST');
      }

      const accounts = await this.db.getMultiSigAccountsByUser(userId);

      // Get members and pending transactions for each account
      const accountsWithDetails = await Promise.all(
        accounts.map(async (account) => {
          const members = await this.db.getMultiSigMembers(account.id);
          const transactions = await this.db.getMultiSigTransactionsByAccount(account.id);
          const pendingCount = transactions.filter(tx => tx.status === 'pending').length;

          return {
            ...account,
            members,
            pendingTransactions: pendingCount
          };
        })
      );

      res.json({
        success: true,
        data: accountsWithDetails
      });
    } catch (error) {
      next(error);
    }
  }

  // Get single account details
  async getAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId } = req.params;

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
    } catch (error) {
      next(error);
    }
  }

  // Update account (threshold, name)
  async updateAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId } = req.params;
      const { name, requiredSignatures, userId } = req.body;

      const account = await this.db.getMultiSigAccount(accountId);
      if (!account) {
        throw new ApiError('Account not found', 404, 'NOT_FOUND');
      }

      // Check if user is owner
      const members = await this.db.getMultiSigMembers(accountId);
      const userMember = members.find(m => m.userId === userId);
      if (!userMember || userMember.role !== 'owner') {
        throw new ApiError('Only owners can update account settings', 403, 'FORBIDDEN');
      }

      // Validate new threshold
      if (requiredSignatures !== undefined) {
        const activeMembers = members.filter(m => m.status === 'active');
        if (requiredSignatures > activeMembers.length) {
          throw new ApiError('Required signatures cannot exceed number of active members', 400, 'INVALID_THRESHOLD');
        }
        if (requiredSignatures < 1) {
          throw new ApiError('Required signatures must be at least 1', 400, 'INVALID_THRESHOLD');
        }
      }

      const updates: Partial<{ name: string; address: string; requiredSignatures: number }> = {};
      if (name) updates.name = name;
      if (requiredSignatures) updates.requiredSignatures = requiredSignatures;

      await this.db.updateMultiSigAccount(accountId, updates);

      const updatedAccount = await this.db.getMultiSigAccount(accountId);

      res.json({
        success: true,
        data: updatedAccount
      });
    } catch (error) {
      next(error);
    }
  }

  // Add member to account
  async addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId } = req.params;
      const { email, role, userId: requesterId } = req.body;

      const account = await this.db.getMultiSigAccount(accountId);
      if (!account) {
        throw new ApiError('Account not found', 404, 'NOT_FOUND');
      }

      // Check if requester is owner
      const members = await this.db.getMultiSigMembers(accountId);
      const requester = members.find(m => m.userId === requesterId);
      if (!requester || requester.role !== 'owner') {
        throw new ApiError('Only owners can add members', 403, 'FORBIDDEN');
      }

      // Check if email already exists in account
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

      // TODO: Send invitation email

      res.status(201).json({
        success: true,
        data: newMember
      });
    } catch (error) {
      next(error);
    }
  }

  // Remove member from account
  async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId, memberId } = req.params;
      const { userId: requesterId } = req.body;

      const account = await this.db.getMultiSigAccount(accountId);
      if (!account) {
        throw new ApiError('Account not found', 404, 'NOT_FOUND');
      }

      const members = await this.db.getMultiSigMembers(accountId);

      // Check if requester is owner
      const requester = members.find(m => m.userId === requesterId);
      if (!requester || requester.role !== 'owner') {
        throw new ApiError('Only owners can remove members', 403, 'FORBIDDEN');
      }

      // Find member to remove
      const memberToRemove = members.find(m => m.id === memberId);
      if (!memberToRemove) {
        throw new ApiError('Member not found', 404, 'NOT_FOUND');
      }

      // Cannot remove yourself if you're the only owner
      if (memberToRemove.userId === requesterId) {
        const owners = members.filter(m => m.role === 'owner' && m.status === 'active');
        if (owners.length === 1) {
          throw new ApiError('Cannot remove the only owner', 400, 'INVALID_OPERATION');
        }
      }

      // Check if removing would make threshold impossible
      const activeMembers = members.filter(m => m.status === 'active' && m.id !== memberId);
      if (activeMembers.length < account.requiredSignatures) {
        throw new ApiError(
          `Cannot remove member. Would leave ${activeMembers.length} members but ${account.requiredSignatures} signatures required.`,
          400,
          'THRESHOLD_VIOLATION'
        );
      }

      await this.db.updateMultiSigMemberStatus(memberId, 'removed');

      res.json({
        success: true,
        message: 'Member removed successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Create a transaction request
  async createTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        accountId,
        targetAddress,
        value,
        tokenAddress,
        tokenSymbol,
        data,
        description,
        submitterId
      } = req.body;

      if (!accountId || !targetAddress || !value || !submitterId) {
        throw new ApiError('Missing required fields', 400, 'INVALID_REQUEST');
      }

      // Validate target address
      if (!ethers.isAddress(targetAddress)) {
        throw new ApiError('Invalid target address', 400, 'INVALID_ADDRESS');
      }

      const account = await this.db.getMultiSigAccount(accountId);
      if (!account) {
        throw new ApiError('Account not found', 404, 'NOT_FOUND');
      }

      // Check if submitter is a member with signing rights
      const members = await this.db.getMultiSigMembers(accountId);
      const submitter = members.find(m => m.userId === submitterId && m.status === 'active');
      if (!submitter || submitter.role === 'viewer') {
        throw new ApiError('You do not have permission to create transactions', 403, 'FORBIDDEN');
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

      // Check if already has enough signatures (1-of-1 case)
      const approvalCount = await this.db.getApprovalCount(transaction.id);
      if (approvalCount >= account.requiredSignatures) {
        // TODO: Execute transaction on-chain
        await this.db.updateMultiSigTransaction(transaction.id, { status: 'executed' });
      }

      res.status(201).json({
        success: true,
        data: {
          transaction,
          approvalCount,
          requiredSignatures: account.requiredSignatures
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get transaction details
  async getTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { transactionId } = req.params;

      const transaction = await this.db.getMultiSigTransaction(transactionId);
      if (!transaction) {
        throw new ApiError('Transaction not found', 404, 'NOT_FOUND');
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
    } catch (error) {
      next(error);
    }
  }

  // Get transactions for an account
  async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId } = req.params;
      const { status } = req.query;

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
      const transactionsWithSignatures = await Promise.all(
        transactions.map(async (tx) => {
          const signatures = await this.db.getMultiSigSignatures(tx.id);
          const approvalCount = await this.db.getApprovalCount(tx.id);
          return {
            ...tx,
            signatures,
            approvalCount,
            requiredSignatures: account.requiredSignatures
          };
        })
      );

      res.json({
        success: true,
        data: transactionsWithSignatures
      });
    } catch (error) {
      next(error);
    }
  }

  // Approve a transaction
  async approveTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { transactionId } = req.params;
      const { userId, signerAddress } = req.body;

      if (!userId) {
        throw new ApiError('User ID is required', 400, 'INVALID_REQUEST');
      }

      const transaction = await this.db.getMultiSigTransaction(transactionId);
      if (!transaction) {
        throw new ApiError('Transaction not found', 404, 'NOT_FOUND');
      }

      if (transaction.status !== 'pending') {
        throw new ApiError(`Transaction is ${transaction.status}`, 400, 'INVALID_STATUS');
      }

      // Check if expired
      if (new Date(transaction.expiresAt) < new Date()) {
        await this.db.updateMultiSigTransaction(transactionId, { status: 'expired' });
        throw new ApiError('Transaction has expired', 400, 'TRANSACTION_EXPIRED');
      }

      // Check if user is a member
      const members = await this.db.getMultiSigMembers(transaction.accountId);
      const member = members.find(m => m.userId === userId && m.status === 'active');
      if (!member || member.role === 'viewer') {
        throw new ApiError('You do not have permission to approve transactions', 403, 'FORBIDDEN');
      }

      // Check if already signed
      const signatures = await this.db.getMultiSigSignatures(transactionId);
      const existingSignature = signatures.find(s => s.signerId === userId);
      if (existingSignature) {
        throw new ApiError('You have already signed this transaction', 400, 'ALREADY_SIGNED');
      }

      // Add signature
      await this.db.addMultiSigSignature({
        id: uuidv4(),
        transactionId,
        signerId: userId,
        signerAddress: signerAddress || '',
        status: 'approved'
      });

      // Check if we have enough signatures
      const account = await this.db.getMultiSigAccount(transaction.accountId);
      const approvalCount = await this.db.getApprovalCount(transactionId);

      let executed = false;
      if (account && approvalCount >= account.requiredSignatures) {
        // TODO: Execute transaction on-chain
        await this.db.updateMultiSigTransaction(transactionId, { status: 'executed' });
        executed = true;
      }

      res.json({
        success: true,
        data: {
          approvalCount,
          requiredSignatures: account?.requiredSignatures || 0,
          executed
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Reject a transaction
  async rejectTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { transactionId } = req.params;
      const { userId, signerAddress } = req.body;

      if (!userId) {
        throw new ApiError('User ID is required', 400, 'INVALID_REQUEST');
      }

      const transaction = await this.db.getMultiSigTransaction(transactionId);
      if (!transaction) {
        throw new ApiError('Transaction not found', 404, 'NOT_FOUND');
      }

      if (transaction.status !== 'pending') {
        throw new ApiError(`Transaction is ${transaction.status}`, 400, 'INVALID_STATUS');
      }

      // Check if user is a member
      const members = await this.db.getMultiSigMembers(transaction.accountId);
      const member = members.find(m => m.userId === userId && m.status === 'active');
      if (!member || member.role === 'viewer') {
        throw new ApiError('You do not have permission to reject transactions', 403, 'FORBIDDEN');
      }

      // Check if already signed
      const signatures = await this.db.getMultiSigSignatures(transactionId);
      const existingSignature = signatures.find(s => s.signerId === userId);
      if (existingSignature) {
        throw new ApiError('You have already voted on this transaction', 400, 'ALREADY_SIGNED');
      }

      // Add rejection
      await this.db.addMultiSigSignature({
        id: uuidv4(),
        transactionId,
        signerId: userId,
        signerAddress: signerAddress || '',
        status: 'rejected'
      });

      // Check if transaction should be rejected (more rejections than possible approvals)
      const account = await this.db.getMultiSigAccount(transaction.accountId);
      const allSignatures = await this.db.getMultiSigSignatures(transactionId);
      const rejectionCount = allSignatures.filter(s => s.status === 'rejected').length;
      const activeMembers = members.filter(m => m.status === 'active' && m.role !== 'viewer');
      const maxPossibleApprovals = activeMembers.length - rejectionCount;

      let rejected = false;
      if (account && maxPossibleApprovals < account.requiredSignatures) {
        await this.db.updateMultiSigTransaction(transactionId, { status: 'rejected' });
        rejected = true;
      }

      res.json({
        success: true,
        data: {
          rejectionCount,
          rejected
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Deploy multi-sig contract (set address)
  async deployContract(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId } = req.params;
      const { address, userId } = req.body;

      if (!address || !ethers.isAddress(address)) {
        throw new ApiError('Valid contract address is required', 400, 'INVALID_ADDRESS');
      }

      const account = await this.db.getMultiSigAccount(accountId);
      if (!account) {
        throw new ApiError('Account not found', 404, 'NOT_FOUND');
      }

      // Check if user is owner
      const members = await this.db.getMultiSigMembers(accountId);
      const userMember = members.find(m => m.userId === userId);
      if (!userMember || userMember.role !== 'owner') {
        throw new ApiError('Only owners can deploy contracts', 403, 'FORBIDDEN');
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
    } catch (error) {
      next(error);
    }
  }
}

export const multiSigController = new MultiSigController();
export default multiSigController;
