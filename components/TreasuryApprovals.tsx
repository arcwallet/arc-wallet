/**
 * Treasury Approvals Component
 * Shows pending treasury transactions requiring approval
 */

import React, { useState, useEffect } from 'react';
import { treasuryMultiSigService, TreasuryTransaction, TreasurySignature } from '../services/treasuryMultiSigService';
import { UserRole } from '../services/treasuryPolicyService';
import { SpinnerIcon } from './Icons';

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
    <div className="bg-[#0D1321] border border-white/[0.06] rounded-xl p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#1F2937] text-[#E5E7EB] border border-white/[0.06]">
              {getOperationLabel(transaction.operationType)}
            </span>
            {isExpired && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#1F2937]/50 text-[#F87171] border border-[#374151]/50">
                Expired
              </span>
            )}
          </div>
          <p className="text-white font-bold text-lg mt-1">
            {parseFloat(transaction.amount).toLocaleString()} {transaction.token}
          </p>
          {transaction.expectedOutput && (
            <p className="text-[#6B7280] text-sm">
              → {parseFloat(transaction.expectedOutput).toLocaleString()} {transaction.outputToken}
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-[#6B7280] text-sm">
            <ClockIcon size={14} />
            {formatTimeRemaining(transaction.expiresAt)}
          </div>
          <p className="text-[#5C6370] text-xs mt-1">
            {formatDate(transaction.createdAt)}
          </p>
        </div>
      </div>

      {/* Submitter Info */}
      <div className="mb-3 p-2.5 bg-[#0A0F1A] rounded-lg border border-white/[0.06]">
        <p className="text-[#5C6370] text-xs">Requested By</p>
        <p className="text-[#E5E7EB] text-sm">{transaction.submitterEmail}</p>
      </div>

      {/* Signatures Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-[#6B7280]">Approval Status</span>
          <span className="text-white font-semibold">
            {transaction.currentSignatures} / {transaction.requiredSignatures}
          </span>
        </div>
        <div className="w-full bg-[#1E293B] rounded-full h-2 relative overflow-hidden">
          {/* Metallic overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
          <div
            className={`h-2 rounded-full transition-all ${
              transaction.currentSignatures >= transaction.requiredSignatures
                ? 'bg-gradient-to-r from-[#E2E8F0] to-[#94A3B8]'
                : 'bg-gradient-to-r from-[#3A7ACC] to-[#4A9EFF]'
            }`}
            style={{ width: `${(transaction.currentSignatures / transaction.requiredSignatures) * 100}%` }}
          />
        </div>
      </div>

      {/* Signatures List */}
      {transaction.signatures.length > 0 && (
        <div className="mb-3 space-y-1.5">
          <p className="text-[#5C6370] text-xs mb-1">Signatures</p>
          {transaction.signatures.map((sig, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              {sig.status === 'approved' ? (
                <CheckIcon size={14} className="text-[#9CA3AF]" />
              ) : (
                <XIcon size={14} className="text-[#F87171]" />
              )}
              <span className="text-[#E5E7EB]">{sig.signerEmail}</span>
              <span className="text-[#5C6370] text-xs">({sig.signerRole})</span>
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
              className="w-full px-3 py-2 bg-[#0A0F1A] border border-[#1F2937] rounded-lg text-white text-sm placeholder:text-[#4B5563] outline-none focus:border-[#4A9EFF]/50"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => onSign(transaction.id, true, comment || undefined)}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-[#3B82F6] to-[#2563EB] text-white font-semibold rounded-lg transition-all disabled:opacity-50 shadow-[0_4px_14px_rgba(59,130,246,0.3)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.4)]"
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
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#1F2937]/50 hover:bg-[#1F2937] text-[#F87171] font-semibold rounded-lg transition-colors disabled:opacity-50 border border-[#374151]/50"
            >
              <XIcon size={16} />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Already Signed */}
      {hasUserSigned && (
        <div className="flex items-center gap-2 p-2.5 bg-[#4A9EFF]/5 border border-[#4A9EFF]/20 rounded-lg">
          <CheckIcon size={16} className="text-[#93C5FD]" />
          <span className="text-[#93C5FD] text-sm">You have already signed this transaction</span>
        </div>
      )}

      {/* Cannot Sign */}
      {!canSign && !hasUserSigned && !isExpired && (
        <div className="flex items-center gap-2 p-2.5 bg-[#1F2937]/50 border border-[#374151]/50 rounded-lg">
          <AlertIcon size={16} className="text-[#9CA3AF]" />
          <span className="text-[#9CA3AF] text-sm">You do not have permission to approve this transaction</span>
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
      <div className="bg-[rgba(15,22,41,0.5)] backdrop-blur-sm rounded-xl border border-white/[0.06] p-6 mt-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <div className="p-2 bg-[#1F2937] rounded-lg">
            <ClockIcon size={20} className="text-[#9CA3AF]" />
          </div>
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
      <div className="bg-[rgba(15,22,41,0.5)] backdrop-blur-sm rounded-xl border border-white/[0.06] p-6 mt-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <div className="p-2 bg-[#1F2937] rounded-lg">
            <ClockIcon size={20} className="text-[#9CA3AF]" />
          </div>
          Pending Approvals
        </h3>
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-[#1F2937]/50 flex items-center justify-center mx-auto mb-3">
            <CheckIcon size={24} className="text-[#6B7280]" />
          </div>
          <p className="text-[#9CA3AF] text-base font-medium">No pending transactions</p>
          <p className="text-[#6B7280] text-sm mt-1">All transactions have been approved or completed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[rgba(15,22,41,0.5)] backdrop-blur-sm rounded-xl border border-white/[0.06] p-6 mt-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <div className="p-2 bg-[#1F2937] rounded-lg">
          <ClockIcon size={20} className="text-[#9CA3AF]" />
        </div>
        Pending Approvals
        <span className="ml-auto px-2 py-0.5 bg-[#4A9EFF]/10 text-[#93C5FD] text-sm font-medium rounded-full border border-[#4A9EFF]/20">
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
