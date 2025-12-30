import React, { useState, useMemo, useCallback } from 'react';
import { useActivity } from '../contexts/ActivityContext';
import { useCircleWallet } from '../contexts/CircleWalletContext';
import { TransactionStatus, TransactionType } from '../types';
import { TX_EXPLORER_URL } from '../config/app.config';
import { refreshTransactions } from '../services/activityService';
import {
  SendIcon,
  ReceiveIcon,
  SwapIcon,
  BridgeIcon,
  RefreshIcon,
} from './Icons';

// Custom icons for new transaction types
const SubscribeIcon = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 2v20M17 7l-5-5-5 5" />
    <circle cx="12" cy="16" r="4" />
  </svg>
);

const RedeemIcon = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22V2M7 17l5 5 5-5" />
    <circle cx="12" cy="8" r="4" />
  </svg>
);

const ContractIcon = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 9h6M9 12h6M9 15h4" />
  </svg>
);

type FilterType = 'all' | 'send' | 'receive' | 'swap' | 'bridge' | 'treasury';
type TimeFilter = 'all' | 'today' | 'week' | 'month';

const History: React.FC = () => {
  const { activities, addActivity } = useActivity();
  const { address } = useCircleWallet();
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh transactions from blockchain
  const handleRefresh = useCallback(async () => {
    if (!address || isRefreshing) return;

    setIsRefreshing(true);
    try {
      const freshTransactions = await refreshTransactions(address);
      // The ActivityContext will handle merging/updating
      freshTransactions.forEach(tx => addActivity(tx));
      console.log(`[History] Refreshed ${freshTransactions.length} transactions`);
    } catch (error) {
      console.error('[History] Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [address, isRefreshing, addActivity]);

  const filteredActivities = useMemo(() => {
    let filtered = [...activities];

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter((activity) => {
        switch (filterType) {
          case 'send':
            return activity.type === TransactionType.Sent;
          case 'receive':
            return activity.type === TransactionType.Received;
          case 'swap':
            return activity.type === TransactionType.Swap;
          case 'bridge':
            return activity.type === TransactionType.Bridge;
          case 'treasury':
            return activity.type === TransactionType.Subscribe || activity.type === TransactionType.Redeem;
          default:
            return true;
        }
      });
    }

    // Filter by time
    if (timeFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter((activity) => {
        const activityDate = activity.date;
        switch (timeFilter) {
          case 'today':
            return activityDate.toDateString() === now.toDateString();
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return activityDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return activityDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (activity) =>
          activity.description.toLowerCase().includes(query) ||
          activity.hash?.toLowerCase().includes(query) ||
          activity.currency.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [activities, filterType, timeFilter, searchQuery]);

  const getTypeIcon = (type: TransactionType) => {
    switch (type) {
      case TransactionType.Sent:
        return <SendIcon size={18} className="text-red-400" />;
      case TransactionType.Received:
        return <ReceiveIcon size={18} className="text-green-400" />;
      case TransactionType.Swap:
        return <SwapIcon size={18} className="text-blue-400" />;
      case TransactionType.Bridge:
        return <BridgeIcon size={18} className="text-purple-400" />;
      case TransactionType.Subscribe:
        return <SubscribeIcon size={18} className="text-indigo-400" />;
      case TransactionType.Redeem:
        return <RedeemIcon size={18} className="text-amber-400" />;
      case TransactionType.Contract:
        return <ContractIcon size={18} className="text-slate-400" />;
      default:
        return <SendIcon size={18} className="text-slate-400" />;
    }
  };

  const getStatusColor = (status: TransactionStatus) => {
    switch (status) {
      case TransactionStatus.Completed:
        return 'text-green-400 bg-green-400/10';
      case TransactionStatus.Pending:
        return 'text-yellow-400 bg-yellow-400/10';
      case TransactionStatus.Failed:
        return 'text-red-400 bg-red-400/10';
      default:
        return 'text-slate-400 bg-slate-400/10';
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hours ago`;
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups: { [key: string]: typeof activities } = {};

    filteredActivities.forEach((activity) => {
      const dateKey = activity.date.toDateString();
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      let label = dateKey;
      if (dateKey === today) label = 'Today';
      else if (dateKey === yesterday) label = 'Yesterday';
      else label = activity.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

      if (!groups[label]) groups[label] = [];
      groups[label].push(activity);
    });

    return groups;
  }, [filteredActivities]);

  // Calculate stats
  const stats = useMemo(() => ({
    total: activities.length,
    sent: activities.filter(a => a.type === TransactionType.Sent).length,
    received: activities.filter(a => a.type === TransactionType.Received).length,
    bridges: activities.filter(a => a.type === TransactionType.Bridge).length,
    treasury: activities.filter(a => a.type === TransactionType.Subscribe || a.type === TransactionType.Redeem).length,
  }), [activities]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-3xl font-bold">Transaction History</h2>
          <p className="text-slate-400 text-sm mt-1">
            View all your wallet activity on Arc Testnet
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors ${
            isRefreshing ? 'animate-spin' : ''
          }`}
        >
          <RefreshIcon size={20} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by description, hash, or token..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 px-4 rounded-lg border border-slate-500/30 bg-slate-900/60 text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all"
          />
        </div>

        {/* Type Filter */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'send', 'receive', 'swap', 'bridge', 'treasury'] as FilterType[]).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                filterType === type
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 border border-transparent'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Time Filter */}
        <select
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
          className="h-11 px-3 rounded-lg border border-slate-500/30 bg-slate-900/60 text-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="rounded-xl border border-slate-500/30 bg-slate-900/60 p-4">
          <p className="text-slate-400 text-xs mb-1">Total</p>
          <p className="text-white text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-slate-500/30 bg-slate-900/60 p-4">
          <p className="text-slate-400 text-xs mb-1">Sent</p>
          <p className="text-red-400 text-2xl font-bold">{stats.sent}</p>
        </div>
        <div className="rounded-xl border border-slate-500/30 bg-slate-900/60 p-4">
          <p className="text-slate-400 text-xs mb-1">Received</p>
          <p className="text-green-400 text-2xl font-bold">{stats.received}</p>
        </div>
        <div className="rounded-xl border border-slate-500/30 bg-slate-900/60 p-4">
          <p className="text-slate-400 text-xs mb-1">Bridges</p>
          <p className="text-purple-400 text-2xl font-bold">{stats.bridges}</p>
        </div>
        <div className="rounded-xl border border-slate-500/30 bg-slate-900/60 p-4">
          <p className="text-slate-400 text-xs mb-1">Treasury</p>
          <p className="text-indigo-400 text-2xl font-bold">{stats.treasury}</p>
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-6">
        {Object.keys(groupedActivities).length > 0 ? (
          Object.entries(groupedActivities).map(([dateLabel, dayActivities]) => (
            <div key={dateLabel}>
              <h3 className="text-slate-400 text-sm font-medium mb-3">{dateLabel}</h3>
              <div className="space-y-2">
                {dayActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-xl border border-slate-500/30 bg-slate-900/60 p-4 hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                          {getTypeIcon(activity.type)}
                        </div>
                        <div>
                          <p className="text-white font-medium">{activity.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-slate-500 text-xs">{formatDate(activity.date)}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(activity.status)}`}>
                              {activity.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${activity.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {activity.amount >= 0 ? '+' : ''}{activity.amount.toFixed(2)} {activity.currency}
                        </p>
                        <p className="text-slate-500 text-xs">${activity.usdValue.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Transaction Hash */}
                    {activity.hash && (
                      <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                        <span className="text-slate-500 text-xs">Tx Hash:</span>
                        <a
                          href={`${TX_EXPLORER_URL}${activity.hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-xs font-mono flex items-center gap-1"
                        >
                          {activity.hash.slice(0, 10)}...{activity.hash.slice(-8)}
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                          </svg>
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-slate-500/30 bg-slate-900/60 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <RefreshIcon size={24} className="text-slate-500" />
            </div>
            <p className="text-slate-400 text-lg font-medium">No transactions found</p>
            <p className="text-slate-500 text-sm mt-1">
              {searchQuery
                ? 'Try adjusting your search or filters'
                : 'Your transaction history will appear here'}
            </p>
            {!searchQuery && address && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="mt-4 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors text-sm font-medium"
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Export Button */}
      {activities.length > 0 && (
        <div className="flex justify-end">
          <button className="px-4 py-2 rounded-lg border border-slate-500/30 bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors text-sm">
            Export CSV
          </button>
        </div>
      )}
    </div>
  );
};

export default History;
