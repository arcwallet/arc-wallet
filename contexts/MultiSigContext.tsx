import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  multiSigClient,
  MultiSigAccount,
  MultiSigMember,
  MultiSigTransaction,
  AccountWithDetails,
  TransactionWithDetails,
} from '../services/multiSigClient';
import { multiSigSigningService } from '../services/multiSigSigningService';
import { usePasskeyAccount } from './PasskeyAccountContext';
import { useSession } from './SessionContext';

interface MultiSigContextType {
  // State
  accounts: AccountWithDetails[];
  selectedAccount: AccountWithDetails | null;
  transactions: TransactionWithDetails[];
  isLoading: boolean;
  error: string | null;

  // Account operations
  loadAccounts: () => Promise<void>;
  createAccount: (
    name: string,
    requiredSignatures: number,
    members: Array<{ email: string; role?: string }>
  ) => Promise<MultiSigAccount>;
  selectAccount: (accountId: string) => Promise<void>;
  updateAccount: (
    accountId: string,
    updates: { name?: string; requiredSignatures?: number }
  ) => Promise<void>;
  deployContract: (accountId: string, address: string) => Promise<void>;

  // Member operations
  addMember: (
    accountId: string,
    email: string,
    role: 'signer' | 'viewer'
  ) => Promise<MultiSigMember>;
  removeMember: (accountId: string, memberId: string) => Promise<void>;

  // Transaction operations
  loadTransactions: (accountId: string, status?: string) => Promise<void>;
  createTransaction: (params: {
    accountId: string;
    targetAddress: string;
    value: string;
    tokenAddress?: string;
    tokenSymbol?: string;
    description?: string;
  }) => Promise<MultiSigTransaction>;
  approveTransaction: (transactionId: string) => Promise<{ executed: boolean }>;
  rejectTransaction: (transactionId: string) => Promise<{ rejected: boolean }>;
  signWithPasskey: (transactionId: string) => Promise<{ readyToExecute: boolean }>;
  executeTransaction: (transactionId: string) => Promise<{ success: boolean; txHash?: string }>;

  // Utility
  clearError: () => void;
}

const MultiSigContext = createContext<MultiSigContextType | undefined>(undefined);

export const MultiSigProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // PasskeyAccount - Smart Wallet (single wallet system)
  const { address: walletAddress } = usePasskeyAccount();
  const { userId } = useSession();

  const [accounts, setAccounts] = useState<AccountWithDetails[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<AccountWithDetails | null>(null);
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // Load accounts for current user
  const loadAccounts = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await multiSigClient.getAccounts(userId);
      if (response.data) {
        setAccounts(response.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load accounts');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Create new multi-sig account
  const createAccount = useCallback(
    async (
      name: string,
      requiredSignatures: number,
      members: Array<{ email: string; role?: string }>
    ) => {
      if (!userId) throw new Error('Not authenticated');

      setIsLoading(true);
      setError(null);

      try {
        // Add current user to members
        const allMembers = members.map((m) => ({
          ...m,
          userId: undefined,
        }));

        const response = await multiSigClient.createAccount(
          name,
          requiredSignatures,
          allMembers,
          userId
        );

        if (response.data) {
          // Reload accounts to get updated list
          await loadAccounts();
          return response.data.account;
        }

        throw new Error('Failed to create account');
      } catch (err: any) {
        setError(err.message || 'Failed to create account');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [userId, loadAccounts]
  );

  // Select and load account details
  const selectAccount = useCallback(async (accountId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await multiSigClient.getAccount(accountId);
      if (response.data) {
        const accountWithDetails: AccountWithDetails = {
          ...response.data.account,
          members: response.data.members,
          pendingTransactions: response.data.transactions.filter(
            (tx) => tx.status === 'pending'
          ).length,
        };
        setSelectedAccount(accountWithDetails);
        setTransactions(
          response.data.transactions.map((tx) => ({
            ...tx,
            signatures: [],
            approvalCount: 0,
            requiredSignatures: response.data!.account.requiredSignatures,
          }))
        );
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load account');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update account settings
  const updateAccount = useCallback(
    async (
      accountId: string,
      updates: { name?: string; requiredSignatures?: number }
    ) => {
      if (!userId) throw new Error('Not authenticated');

      setIsLoading(true);
      setError(null);

      try {
        await multiSigClient.updateAccount(accountId, updates, userId);
        // Reload account details
        await selectAccount(accountId);
        await loadAccounts();
      } catch (err: any) {
        setError(err.message || 'Failed to update account');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [userId, selectAccount, loadAccounts]
  );

  // Deploy contract
  const deployContract = useCallback(
    async (accountId: string, address: string) => {
      if (!userId) throw new Error('Not authenticated');

      setIsLoading(true);
      setError(null);

      try {
        await multiSigClient.deployContract(accountId, address, userId);
        await selectAccount(accountId);
        await loadAccounts();
      } catch (err: any) {
        setError(err.message || 'Failed to deploy contract');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [userId, selectAccount, loadAccounts]
  );

  // Add member to account
  const addMember = useCallback(
    async (accountId: string, email: string, role: 'signer' | 'viewer') => {
      if (!userId) throw new Error('Not authenticated');

      setIsLoading(true);
      setError(null);

      try {
        const response = await multiSigClient.addMember(
          accountId,
          email,
          role,
          userId
        );

        if (response.data) {
          await selectAccount(accountId);
          return response.data;
        }

        throw new Error('Failed to add member');
      } catch (err: any) {
        setError(err.message || 'Failed to add member');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [userId, selectAccount]
  );

  // Remove member from account
  const removeMember = useCallback(
    async (accountId: string, memberId: string) => {
      if (!userId) throw new Error('Not authenticated');

      setIsLoading(true);
      setError(null);

      try {
        await multiSigClient.removeMember(accountId, memberId, userId);
        await selectAccount(accountId);
      } catch (err: any) {
        setError(err.message || 'Failed to remove member');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [userId, selectAccount]
  );

  // Load transactions for account
  const loadTransactions = useCallback(
    async (accountId: string, status?: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await multiSigClient.getTransactions(accountId, status);
        if (response.data) {
          setTransactions(response.data);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load transactions');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Create transaction
  const createTransaction = useCallback(
    async (params: {
      accountId: string;
      targetAddress: string;
      value: string;
      tokenAddress?: string;
      tokenSymbol?: string;
      description?: string;
    }) => {
      if (!userId) throw new Error('Not authenticated');

      setIsLoading(true);
      setError(null);

      try {
        const response = await multiSigClient.createTransaction({
          ...params,
          submitterId: userId,
        });

        if (response.data) {
          // Reload transactions
          await loadTransactions(params.accountId);
          return response.data.transaction;
        }

        throw new Error('Failed to create transaction');
      } catch (err: any) {
        setError(err.message || 'Failed to create transaction');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [userId, loadTransactions]
  );

  // Approve transaction
  const approveTransaction = useCallback(
    async (transactionId: string) => {
      if (!userId) throw new Error('Not authenticated');

      setIsLoading(true);
      setError(null);

      try {
        const response = await multiSigClient.approveTransaction(
          transactionId,
          userId,
          walletAddress || undefined
        );

        if (response.data) {
          // Reload transactions for the current account
          if (selectedAccount) {
            await loadTransactions(selectedAccount.id);
          }
          return { executed: response.data.executed };
        }

        throw new Error('Failed to approve transaction');
      } catch (err: any) {
        setError(err.message || 'Failed to approve transaction');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [userId, walletAddress, selectedAccount, loadTransactions]
  );

  // Reject transaction
  const rejectTransaction = useCallback(
    async (transactionId: string) => {
      if (!userId) throw new Error('Not authenticated');

      setIsLoading(true);
      setError(null);

      try {
        const response = await multiSigClient.rejectTransaction(
          transactionId,
          userId,
          walletAddress || undefined
        );

        if (response.data) {
          // Reload transactions for the current account
          if (selectedAccount) {
            await loadTransactions(selectedAccount.id);
          }
          return { rejected: response.data.rejected };
        }

        throw new Error('Failed to reject transaction');
      } catch (err: any) {
        setError(err.message || 'Failed to reject transaction');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [userId, walletAddress, selectedAccount, loadTransactions]
  );

  // Sign transaction with passkey
  const signWithPasskey = useCallback(
    async (transactionId: string) => {
      if (!userId) throw new Error('Not authenticated');

      setIsLoading(true);
      setError(null);

      try {
        // Use the signing service to handle passkey flow
        const result = await multiSigSigningService.approveWithPasskey(
          transactionId,
          userId
        );

        // Reload transactions
        if (selectedAccount) {
          await loadTransactions(selectedAccount.id);
        }

        return { readyToExecute: result.readyToExecute };
      } catch (err: any) {
        setError(err.message || 'Failed to sign with passkey');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [userId, selectedAccount, loadTransactions]
  );

  // Execute transaction on-chain
  const executeTransaction = useCallback(
    async (transactionId: string) => {
      if (!userId) throw new Error('Not authenticated');

      setIsLoading(true);
      setError(null);

      try {
        const result = await multiSigSigningService.executeMultiSigTransaction(transactionId);

        // Reload transactions
        if (selectedAccount) {
          await loadTransactions(selectedAccount.id);
        }

        return result;
      } catch (err: any) {
        setError(err.message || 'Failed to execute transaction');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [userId, selectedAccount, loadTransactions]
  );

  // Load accounts when user changes
  useEffect(() => {
    if (userId) {
      loadAccounts();
    } else {
      setAccounts([]);
      setSelectedAccount(null);
      setTransactions([]);
    }
  }, [userId, loadAccounts]);

  const value: MultiSigContextType = {
    accounts,
    selectedAccount,
    transactions,
    isLoading,
    error,
    loadAccounts,
    createAccount,
    selectAccount,
    updateAccount,
    deployContract,
    addMember,
    removeMember,
    loadTransactions,
    createTransaction,
    approveTransaction,
    rejectTransaction,
    signWithPasskey,
    executeTransaction,
    clearError,
  };

  return (
    <MultiSigContext.Provider value={value}>
      {children}
    </MultiSigContext.Provider>
  );
};

export const useMultiSig = () => {
  const context = useContext(MultiSigContext);
  if (!context) {
    throw new Error('useMultiSig must be used within a MultiSigProvider');
  }
  return context;
};

export default MultiSigContext;
