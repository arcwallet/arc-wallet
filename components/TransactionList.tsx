import React, { useMemo, useState } from 'react';
import { Transaction, TransactionStatus, TransactionType } from '../types';
import TransactionListItem from './TransactionListItem';
import { SearchIcon, HistoryIcon } from './Icons';

interface TransactionListProps {
  transactions: Transaction[];
  isLoading: boolean;
  selectedTransaction: Transaction | null;
  onSelectTransaction: (transaction: Transaction) => void;
}

const FilterChip: React.FC<{ label: string; active?: boolean; onClick: () => void }> = ({ label, active, onClick }) => {
  const activeClasses = 'bg-primary/20 text-primary';
  const inactiveClasses = 'bg-surface hover:bg-white/5 border border-divider text-text-primary';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-lg px-4 transition-colors ${active ? activeClasses : inactiveClasses}`}
    >
      <p className="text-sm font-medium leading-normal">{label}</p>
    </button>
  );
};

const TransactionListItemSkeleton: React.FC = () => (
    <div className="flex items-center gap-4 bg-surface rounded-xl px-4 min-h-[72px] py-2 justify-between animate-pulse">
        <div className="flex items-center gap-4 w-full">
            <div className="rounded-lg bg-white/5 shrink-0 size-12"></div>
            <div className="flex flex-col justify-center w-2/3">
                <div className="h-4 bg-white/5 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-white/5 rounded w-1/2"></div>
            </div>
        </div>
        <div className="flex items-center gap-4 w-1/3 justify-end">
            <div className="text-right hidden sm:block w-24">
                <div className="h-4 bg-white/5 rounded w-full mb-2"></div>
                <div className="h-3 bg-white/5 rounded w-3/4 ml-auto"></div>
            </div>
            <div className="w-20 h-6 bg-white/5 rounded-full"></div>
        </div>
    </div>
);

const FILTERS = ['All', 'Sent', 'Received', 'Contract', 'Failed'] as const;
type FilterValue = (typeof FILTERS)[number];

const TransactionList: React.FC<TransactionListProps> = ({ transactions, isLoading, selectedTransaction, onSelectTransaction }) => {
  const [activeFilter, setActiveFilter] = useState<FilterValue>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return transactions
      .filter((tx) => {
        if (activeFilter === 'Sent' && tx.type !== TransactionType.Sent) return false;
        if (activeFilter === 'Received' && tx.type !== TransactionType.Received) return false;
        if (activeFilter === 'Contract' && tx.type !== TransactionType.Contract) return false;
        if (activeFilter === 'Failed' && tx.status !== TransactionStatus.Failed) return false;
        return true;
      })
      .filter((tx) => {
        if (!query) return true;
        const haystack = [tx.hash, tx.description, tx.from, tx.to]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });
  }, [transactions, activeFilter, searchQuery]);

  return (
    <div className="flex-1 flex flex-col w-full lg:max-w-[65%] overflow-y-auto">
      <div className="sticky top-0 bg-gradient-to-b from-[#091325] to-[#091325]/80 backdrop-blur-sm z-10 px-4 sm:px-8 pt-8 pb-4">
        {/* PageHeading */}
        <div className="flex flex-wrap justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h1 className="text-text-primary text-4xl font-black leading-tight tracking-[-0.033em]">Activity</h1>
            <p className="text-text-secondary text-base font-normal leading-normal">View and manage all recent transactions.</p>
          </div>
        </div>
        {/* Search & Filters */}
        <div className="mt-6 flex flex-col gap-4">
          {/* SearchBar */}
          <label className="flex flex-col min-w-40 h-12 w-full">
            <div className="flex w-full flex-1 items-stretch rounded-xl h-full">
              <div className="text-text-secondary flex bg-surface items-center justify-center pl-4 rounded-l-xl border-y border-l border-divider">
                <SearchIcon size={20} />
              </div>
              <input
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-xl text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary focus:ring-inset border-y border-r border-divider bg-surface h-full placeholder:text-text-secondary px-4 pl-2 text-base font-normal leading-normal"
                placeholder="Search by transaction hash or address"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </label>
          {/* Chips */}
          <div className="flex gap-3 overflow-x-auto pb-1">
            {FILTERS.map((filter) => (
              <FilterChip
                key={filter}
                label={filter}
                active={activeFilter === filter}
                onClick={() => setActiveFilter(filter)}
              />
            ))}
          </div>
        </div>
      </div>
      {/* Transaction List */}
      <div className="px-4 sm:px-8 pb-8 flex flex-col gap-2">
        {isLoading ? (
          <>
            <TransactionListItemSkeleton />
            <TransactionListItemSkeleton />
            <TransactionListItemSkeleton />
            <TransactionListItemSkeleton />
            <TransactionListItemSkeleton />
          </>
        ) : filteredTransactions.length > 0 ? (
          filteredTransactions.map((tx) => (
            <TransactionListItem
              key={tx.id}
              transaction={tx}
              isSelected={selectedTransaction?.id === tx.id}
              onClick={() => onSelectTransaction(tx)}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-20 text-text-secondary">
            <HistoryIcon size={96} className="mb-4" />
            <h3 className="text-xl font-bold text-text-primary">No Transactions Yet</h3>
            <p>{searchQuery || activeFilter !== 'All' ? 'Adjust filters or search criteria.' : 'Your transaction history will appear here.'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionList;
