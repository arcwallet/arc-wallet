
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
      return 'bg-accent-green/10 text-accent-green';
    case TransactionStatus.Pending:
      return 'bg-accent-orange/10 text-accent-orange';
    case TransactionStatus.Failed:
      return 'bg-accent-red/10 text-accent-red';
    default:
      return 'bg-gray-500/10 text-gray-500';
  }
};

const getIcon = (type: TransactionType, status: TransactionStatus) => {
    switch (type) {
        case TransactionType.Sent:
            return <SendIcon size={20} className={status === TransactionStatus.Failed ? 'text-accent-red' : 'text-accent-orange'} />;
        case TransactionType.Received:
            return <ReceiveIcon size={20} className="text-accent-green" />;
        case TransactionType.Contract:
            return <DocumentIcon size={20} />;
        default:
            return <ReceiptIcon size={20} />;
    }
}

const TransactionListItem: React.FC<TransactionListItemProps> = ({ transaction, isSelected, onClick }) => {
  const { type, description, timestamp, amount, currency, usdValue, status } = transaction;

  const baseClasses = 'flex items-center gap-4 bg-surface rounded-xl px-4 min-h-[72px] py-2 justify-between cursor-pointer transition-colors';
  const selectedClasses = 'border border-primary';
  const hoverClasses = 'hover:bg-white/5 border border-divider';

  return (
    <div
      className={`${baseClasses} ${isSelected ? selectedClasses : hoverClasses}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div className="text-text-primary flex items-center justify-center rounded-lg bg-white/5 shrink-0 size-12">
          {getIcon(type, status)}
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-text-primary text-base font-medium leading-normal line-clamp-1">{description}</p>
          <p className="text-text-secondary text-sm font-normal leading-normal line-clamp-2">{timestamp}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-text-primary text-base font-normal leading-normal">{amount > 0 ? '+' : ''}{amount} {currency}</p>
          <p className="text-text-secondary text-sm font-normal leading-normal line-clamp-2">{amount > 0 ? '+' : ''}${Math.abs(usdValue).toFixed(2)}</p>
        </div>
        <div className={`px-2.5 py-1 rounded-full ${getStatusBadgeClasses(status)}`}>
          <p className="text-xs font-medium">{status}</p>
        </div>
      </div>
    </div>
  );
};

export default TransactionListItem;
