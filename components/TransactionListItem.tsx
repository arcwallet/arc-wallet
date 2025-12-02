
import React from 'react';
import { Transaction, TransactionStatus, TransactionType } from '../types';
import { SendIcon, ReceiveIcon, DocumentIcon, ReceiptIcon } from './Icons';

interface TransactionListItemProps {
  transaction: Transaction;
  isSelected: boolean;
  onClick: () => void;
}

const getStatusBadgeClasses = (status: TransactionStatus) => {
  switch (status) {
    case TransactionStatus.Completed:
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    case TransactionStatus.Pending:
      return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
    case TransactionStatus.Failed:
      return 'bg-red-500/10 text-red-400 border border-red-500/20';
    default:
      return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
  }
};

// Swap icon SVG
const SwapIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M7 16V4M7 4L3 8M7 4L11 8" />
    <path d="M17 8V20M17 20L21 16M17 20L13 16" />
  </svg>
);

// Bridge icon SVG
const BridgeIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 15V9C4 7.89543 4.89543 7 6 7H18C19.1046 7 20 7.89543 20 9V15" />
    <path d="M4 17H20" />
    <circle cx="8" cy="12" r="2" />
    <circle cx="16" cy="12" r="2" />
  </svg>
);

const getIcon = (type: TransactionType, status: TransactionStatus) => {
  switch (type) {
    case TransactionType.Sent:
      return <SendIcon size={20} className={status === TransactionStatus.Failed ? 'text-red-400' : 'text-red-400'} />;
    case TransactionType.Received:
      return <ReceiveIcon size={20} className="text-emerald-400" />;
    case TransactionType.Swap:
      return <SwapIcon size={20} className="text-purple-400" />;
    case TransactionType.Bridge:
      return <BridgeIcon size={20} className="text-blue-400" />;
    case TransactionType.Contract:
      return <DocumentIcon size={20} className="text-slate-400" />;
    default:
      return <ReceiptIcon size={20} className="text-slate-400" />;
  }
}

const TransactionListItem: React.FC<TransactionListItemProps> = ({ transaction, isSelected, onClick }) => {
  const { type, description, timestamp, amount, currency, usdValue, status } = transaction;

  const baseClasses = 'flex items-center gap-4 bg-slate-900/40 rounded-xl px-4 min-h-[72px] py-2 justify-between cursor-pointer transition-all';
  const selectedClasses = 'border border-blue-400 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]';
  const hoverClasses = 'hover:bg-white/10 border border-slate-500/30 hover:border-blue-400/50';

  return (
    <div
      className={`${baseClasses} ${isSelected ? selectedClasses : hoverClasses}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div className="text-slate-100 flex items-center justify-center rounded-lg bg-slate-700/50 shrink-0 size-12">
          {getIcon(type, status)}
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-slate-100 text-base font-medium leading-normal line-clamp-1">{description}</p>
          <p className="text-slate-400 text-sm font-normal leading-normal line-clamp-2">{timestamp}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className={`text-base font-medium leading-normal ${
            type === TransactionType.Received ? 'text-emerald-400' :
            type === TransactionType.Sent ? 'text-red-400' :
            'text-slate-100'
          }`}>
            {amount > 0 ? '+' : ''}{amount} {currency}
          </p>
          <p className={`text-sm font-normal leading-normal line-clamp-2 ${
            type === TransactionType.Received ? 'text-emerald-400/70' :
            type === TransactionType.Sent ? 'text-red-400/70' :
            'text-slate-400'
          }`}>
            {amount > 0 ? '+' : ''}${Math.abs(usdValue).toFixed(2)}
          </p>
        </div>
        <div className={`px-2.5 py-1 rounded-full ${getStatusBadgeClasses(status)}`}>
          <p className="text-xs font-medium">{status}</p>
        </div>
      </div>
    </div>
  );
};

export default TransactionListItem;
