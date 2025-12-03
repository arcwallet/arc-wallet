/**
 * Treasury Approvals Component
 * Shows pending treasury transactions requiring approval
 */

import React, { useState, useEffect } from 'react';
import { treasuryMultiSigService, TreasuryTransaction, TreasurySignature } from '../services/treasuryMultiSigService';
import { UserRole } from '../services/treasuryPolicyService';
import { SpinnerIcon, VerifiedIcon } from './Icons';

// Icons
const ClockIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12,6 12,12 16,14" />
  </svg>
);

const CheckIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20,6 9,17 4,12" />
  </svg>
);

const XIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const AlertIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

interface TreasuryApprovalsProps {
  walletAddress: string;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  onTransactionApproved?: () => void;
}

const formatTimeRemaining = (expiresAt: Date): string => {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();

  if (diff <= 0) return 'Expired';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  return `${minutes}m remaining`;
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getOperationLabel = (type: string): string => {
  switch (type) {
    case 'subscribe': return 'Subscribe (USDC → USYC)';
    case 'redeem': return 'Redeem (USYC → USDC)';
    case 'transfer': return 'Transfer';
    case 'rebalance': return 'Rebalance';
    default: return type;
  }
};

interface ApprovalCardProps {
  transaction: TreasuryTransaction;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  onSign: (transactionId: string, approve: boolean, comment?: string) => Promise<void>;
  isLoading: boolean;
}

const ApprovalCard: React.FC<ApprovalCardProps> = ({
  transaction,
  userId,
  userEmail,
  userRole,
  onSign,
  isLoading,
}) => {
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);

  const hasUserSigned = transaction.signatures.some((s) => s.signerId === userId);
  const canSign = !hasUserSigned && ['admin', 'treasury_manager', 'approver'].includes(userRole);
  const isExpired = new Date() > transaction.expiresAt;

  return (
    <div className="bg-slate-800/50 border border-slate-600/50 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
              transaction.operationType === 'subscribe'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              {getOperationLabel(transaction.operationType)}
            </span>
            {isExpired && (
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-400">
                Expired
              </span>
            )}
          </div>
          <p className="text-white font-bold text-lg mt-1">
            {parseFloat(transaction.amount).toLocaleString()} {transaction.token}
          </p>
          {transaction.expectedOutput && (
            <p className="text-slate-400 text-sm">
              → {parseFloat(transaction.expectedOutput).toLocaleString()} {transaction.outputToken}
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-slate-400 text-sm">
            <ClockIcon size={14} />
            {formatTimeRemaining(transaction.expiresAt)}
          </div>
          <p className="text-slate-500 text-xs mt-1">
            {formatDate(transaction.createdAt)}
          </p>
        </div>
      </div>

      {/* Submitter Info */}
      <div className="mb-3 p-2 bg-slate-900/50 rounded-lg">
        <p className="text-slate-400 text-xs">Requested By</p>
        <p className="text-slate-300 text-sm">{transaction.submitterEmail}</p>
      </div>

      {/* Signatures Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-slate-400">Approval Status</span>
          <span className="text-white font-semibold">
            {transaction.currentSignatures} / {transaction.requiredSignatures}
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              transaction.currentSignatures >= transaction.requiredSignatures
                ? 'bg-cyan-500'
                : 'bg-blue-500'
            }`}
            style={{ width: `${(transaction.currentSignatures / transaction.requiredSignatures) * 100}%` }}
          />
        </div>
      </div>

      {/* Signatures List */}
      {transaction.signatures.length > 0 && (
        <div className="mb-3 space-y-1">
          <p className="text-slate-400 text-xs mb-1">Signatures</p>
          {transaction.signatures.map((sig, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              {sig.status === 'approved' ? (
                <CheckIcon size={14} className="text-cyan-400" />
              ) : (
                <XIcon size={14} className="text-red-400" />
              )}
              <span className="text-slate-300">{sig.signerEmail}</span>
              <span className="text-slate-500 text-xs">({sig.signerRole})</span>
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      {canSign && !isExpired && (
        <div className="space-y-2">
          {showComment && (
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add comment (optional)"
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm placeholder:text-slate-500 outline-none focus:border-blue-500"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => onSign(transaction.id, true, comment || undefined)}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <SpinnerIcon size={16} />
              ) : (
                <>
                  <CheckIcon size={16} />
                  Approve
                </>
              )}
            </button>
            <button
              onClick={() => {
                if (!showComment) {
                  setShowComment(true);
                } else {
                  onSign(transaction.id, false, comment || 'Rejected');
                }
              }}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              <XIcon size={16} />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Already Signed */}
      {hasUserSigned && (
        <div className="flex items-center gap-2 p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
          <VerifiedIcon size={16} className="text-cyan-400" />
          <span className="text-cyan-400 text-sm">You have already signed this transaction</span>
        </div>
      )}

      {/* Cannot Sign */}
      {!canSign && !hasUserSigned && !isExpired && (
        <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <AlertIcon size={16} className="text-amber-400" />
          <span className="text-amber-400 text-sm">You do not have permission to approve this transaction</span>
        </div>
      )}
    </div>
  );
};

const TreasuryApprovals: React.FC<TreasuryApprovalsProps> = ({
  walletAddress,
  userId,
  userEmail,
  userRole,
  onTransactionApproved,
}) => {
  const [pendingTransactions, setPendingTransactions] = useState<TreasuryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingId, setSigningId] = useState<string | null>(null);

  const loadPendingTransactions = async () => {
    try {
      const pending = await treasuryMultiSigService.getPendingTransactions(walletAddress);
      setPendingTransactions(pending);
    } catch (error) {
      console.error('Failed to load pending transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingTransactions();

    // Refresh every 30 seconds
    const interval = setInterval(loadPendingTransactions, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  const handleSign = async (transactionId: string, approve: boolean, comment?: string) => {
    setSigningId(transactionId);
    try {
      await treasuryMultiSigService.signTransaction(
        transactionId,
        userId,
        userEmail,
        userRole,
        approve,
        comment
      );
      loadPendingTransactions();
      onTransactionApproved?.();
    } catch (error: any) {
      console.error('Failed to sign transaction:', error);
      alert(error.message || 'Signing failed');
    } finally {
      setSigningId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-500/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <ClockIcon size={20} className="text-amber-400" />
          Pending Approvals
        </h3>
        <div className="flex items-center justify-center py-8">
          <SpinnerIcon size={32} />
        </div>
      </div>
    );
  }

  if (pendingTransactions.length === 0) {
    return (
      <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-500/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <ClockIcon size={20} className="text-amber-400" />
          Pending Approvals
        </h3>
        <div className="text-center py-6">
          <CheckIcon size={48} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No pending transactions</p>
          <p className="text-slate-500 text-sm mt-1">All transactions have been approved or completed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-amber-500/30 p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <ClockIcon size={20} className="text-amber-400" />
        Pending Approvals
        <span className="ml-auto px-2 py-0.5 bg-amber-500/20 text-amber-400 text-sm rounded-full">
          {pendingTransactions.length}
        </span>
      </h3>

      <div className="space-y-4">
        {pendingTransactions.map((tx) => (
          <ApprovalCard
            key={tx.id}
            transaction={tx}
            userId={userId}
            userEmail={userEmail}
            userRole={userRole}
            onSign={handleSign}
            isLoading={signingId === tx.id}
          />
        ))}
      </div>
    </div>
  );
};

export default TreasuryApprovals;
