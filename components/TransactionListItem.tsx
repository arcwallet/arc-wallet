
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

const getIcon = (type: TransactionType, status: TransactionStatus) => {
  switch (type) {
    case TransactionType.Sent:
      return <SendIcon size={20} className={status === TransactionStatus.Failed ? 'text-red-400' : 'text-orange-400'} />;
    case TransactionType.Received:
      return <ReceiveIcon size={20} className="text-emerald-400" />;
    case TransactionType.Contract:
      return <DocumentIcon size={20} />;
    default:
      return <ReceiptIcon size={20} />;
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
          <p className="text-slate-100 text-base font-normal leading-normal">{amount > 0 ? '+' : ''}{amount} {currency}</p>
          <p className="text-slate-400 text-sm font-normal leading-normal line-clamp-2">{amount > 0 ? '+' : ''}${Math.abs(usdValue).toFixed(2)}</p>
        </div>
        <div className={`px-2.5 py-1 rounded-full ${getStatusBadgeClasses(status)}`}>
          <p className="text-xs font-medium">{status}</p>
        </div>
      </div>
    </div>
  );
};

export default TransactionListItem;
