
import React from 'react';
import { Transaction, TransactionStatus, Approval } from '../types';
import { CopyIcon, CloseIcon, CheckCircleIcon, PendingIcon } from './Icons';

interface TransactionDetailProps {
  transaction: Transaction;
  onClose: () => void;
}

const DetailRow: React.FC<{ label: string, children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex justify-between items-center">
    <span className="text-text-secondary text-sm">{label}</span>
    {children}
  </div>
);

const AddressRow: React.FC<{ label: string, address: string }> = ({ label, address }) => (
  <div>
    <p className="text-text-secondary text-sm mb-1">{label}</p>
    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-divider">
      <p className="text-text-primary font-mono text-sm break-all">{address.slice(0, 10)}...{address.slice(-8)}</p>
      <button
        className="text-text-secondary hover:text-primary transition-colors"
        onClick={() => navigator.clipboard.writeText(address)}
      >
        <CopyIcon size={16} />
      </button>
    </div>
  </div>
);

const ApprovalRow: React.FC<{ approval: Approval }> = ({ approval }) => {
    const isApproved = approval.status === 'Approved';
    return (
        <div className="flex items-center gap-3">
            {isApproved ? (
                <CheckCircleIcon size={20} className="text-accent-green" />
            ) : (
                <PendingIcon size={20} className="text-text-secondary" />
            )}
            <p className={`${isApproved ? 'text-text-primary' : 'text-text-secondary'} text-sm font-mono`}>{approval.address}</p>
            <span className="ml-auto text-text-secondary text-xs">{approval.status}</span>
        </div>
    );
};

const TransactionDetail: React.FC<TransactionDetailProps> = ({ transaction, onClose }) => {
  const { status, date, hash, from, to, amount, networkFee, approvals } = transaction;

  const getStatusIndicator = () => {
    let colorClass = '';
    switch (status) {
      case TransactionStatus.Pending: colorClass = 'bg-accent-orange'; break;
      case TransactionStatus.Completed: colorClass = 'bg-accent-green'; break;
      case TransactionStatus.Failed: colorClass = 'bg-accent-red'; break;
    }
    return (
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${colorClass}`}></span>
        <span className={`text-sm font-medium ${colorClass.replace('bg-', 'text-')}`}>{status}</span>
      </div>
    );
  };
  
  const totalAmount = amount - networkFee;
  const approvedCount = approvals.list.filter(a => a.status === 'Approved').length;

  return (
    <aside className="w-full lg:max-w-[35%] bg-surface border-l border-divider flex flex-col shrink-0 absolute lg:relative h-full inset-0 lg:inset-auto z-20">
      <div className="p-6 border-b border-divider flex justify-between items-center">
        <h2 className="text-xl font-bold text-text-primary">Transaction Details</h2>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
          <CloseIcon size={20} />
        </button>
      </div>
      <div className="p-6 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6">
          {/* Key Details */}
          <div className="flex flex-col gap-4">
            <DetailRow label="Status">{getStatusIndicator()}</DetailRow>
            <DetailRow label="Timestamp">
              <span className="text-text-primary text-sm font-medium">{date.toLocaleString()}</span>
            </DetailRow>
            <DetailRow label="Transaction Hash">
              <div className="flex items-center gap-2">
                <span className="text-primary text-sm font-medium font-mono">{hash.slice(0, 6)}...{hash.slice(-4)}</span>
                <button
                    className="text-text-secondary hover:text-primary transition-colors"
                    onClick={() => navigator.clipboard.writeText(hash)}
                >
                  <CopyIcon size={16} />
                </button>
              </div>
            </DetailRow>
          </div>
          <hr className="border-divider" />
          {/* From/To */}
          <div className="flex flex-col gap-4">
            <AddressRow label="From" address={from} />
            <AddressRow label="To" address={to} />
          </div>
          <hr className="border-divider" />
          {/* Value & Fees */}
          <div className="flex flex-col gap-4">
            <DetailRow label="Amount">
              <span className="text-text-primary text-sm font-medium">{amount} {transaction.currency}</span>
            </DetailRow>
            <DetailRow label="Network Fee">
              <span className="text-text-primary text-sm font-medium">{networkFee.toFixed(4)} ETH</span>
            </DetailRow>
            <div className="flex justify-between items-center">
              <span className="text-text-primary text-sm font-bold">Total</span>
              <span className="text-text-primary text-sm font-bold">{totalAmount.toFixed(4)} {transaction.currency === 'ETH' ? 'ETH' : transaction.currency}</span>
            </div>
          </div>
          <hr className="border-divider" />
          {/* Multi-Sig Info */}
          <div>
            <h3 className="text-text-primary font-bold mb-4">Multi-Sig Approvals ({approvedCount} of {approvals.required})</h3>
            <div className="flex flex-col gap-3">
              {approvals.list.map((approval, index) => (
                <ApprovalRow key={index} approval={approval} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default TransactionDetail;
