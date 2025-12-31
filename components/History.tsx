import React, { useState, useMemo, useCallback } from 'react';
import { useActivity } from '../contexts/ActivityContext';
import { useCircleWallet } from '../contexts/CircleWalletContext';
import { TransactionStatus, TransactionType } from '../types';
import { TX_EXPLORER_URL } from '../config/app.config';
import { refreshTransactions } from '../services/activityService';

// Custom icons matching dashboard style
const SendIcon = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

const ReceiveIcon = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </svg>
);

const SwapIcon = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4" />
  </svg>
);

const BridgeIcon = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />
  </svg>
);

const TreasuryIcon = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="8" width="18" height="12" rx="2" />
    <path d="M7 8V6a2 2 0 012-2h6a2 2 0 012 2v2" />
    <circle cx="12" cy="14" r="2" />
  </svg>
);

const RefreshIcon = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

const ExternalLinkIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
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
        return <SendIcon size={16} className="text-[#EF4444]" />;
      case TransactionType.Received:
        return <ReceiveIcon size={16} className="text-[#22C55E]" />;
      case TransactionType.Swap:
        return <SwapIcon size={16} className="text-[#3B82F6]" />;
      case TransactionType.Bridge:
        return <BridgeIcon size={16} className="text-[#A855F7]" />;
      case TransactionType.Subscribe:
      case TransactionType.Redeem:
        return <TreasuryIcon size={16} className="text-[#6366F1]" />;
      default:
        return <SendIcon size={16} className="text-[#6B7280]" />;
    }
  };

  const getStatusBadge = (status: TransactionStatus) => {
    switch (status) {
      case TransactionStatus.Completed:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#22C55E]/10 border border-[#22C55E]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
            <span className="text-[10px] font-medium text-[#22C55E]">Completed</span>
          </span>
        );
      case TransactionStatus.Pending:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F59E0B]/10 border border-[#F59E0B]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse" />
            <span className="text-[10px] font-medium text-[#F59E0B]">Pending</span>
          </span>
        );
      case TransactionStatus.Failed:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EF4444]/10 border border-[#EF4444]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
            <span className="text-[10px] font-medium text-[#EF4444]">Failed</span>
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const groupedActivities = useMemo(() => {
    const groups: { [key: string]: typeof activities } = {};

    filteredActivities.forEach((activity) => {
      const dateKey = activity.date.toDateString();
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      let label = dateKey;
      if (dateKey === today) label = 'Today';
      else if (dateKey === yesterday) label = 'Yesterday';
      else label = activity.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      if (!groups[label]) groups[label] = [];
      groups[label].push(activity);
    });

    return groups;
  }, [filteredActivities]);

  const stats = useMemo(() => ({
    total: activities.length,
    sent: activities.filter(a => a.type === TransactionType.Sent).length,
    received: activities.filter(a => a.type === TransactionType.Received).length,
    bridges: activities.filter(a => a.type === TransactionType.Bridge).length,
    treasury: activities.filter(a => a.type === TransactionType.Subscribe || a.type === TransactionType.Redeem).length,
  }), [activities]);

  return (
    <div className="w-full px-6 py-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-white tracking-tight">Transaction History</h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">Arc Testnet activity</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`p-2.5 rounded-xl bg-[#111827] border border-white/[0.06] text-[#9CA3AF] hover:text-white hover:bg-[#1F2937] transition-all ${
            isRefreshing ? 'animate-spin' : ''
          }`}
        >
          <RefreshIcon size={18} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Sent', value: stats.sent, color: 'text-[#EF4444]' },
          { label: 'Received', value: stats.received, color: 'text-[#22C55E]' },
          { label: 'Bridges', value: stats.bridges, color: 'text-[#A855F7]' },
          { label: 'Treasury', value: stats.treasury, color: 'text-[#6366F1]' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-[#0D1321] rounded-xl border border-white/[0.06] p-3"
          >
            <p className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wide">{stat.label}</p>
            <p className={`text-[20px] font-bold ${stat.color} mt-0.5`} style={{ fontFeatureSettings: '"tnum"' }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by description, hash, or token..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 px-3.5 rounded-xl border border-white/[0.06] bg-[#0D1321] text-[13px] text-white placeholder:text-[#4B5563] focus:border-white/[0.12] focus:outline-none transition-all"
          />
        </div>

        {/* Type Filter */}
        <div className="flex gap-1.5">
          {(['all', 'send', 'receive', 'swap', 'bridge', 'treasury'] as FilterType[]).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-2 rounded-lg text-[12px] font-medium transition-all capitalize ${
                filterType === type
                  ? 'bg-white/[0.08] text-white border border-white/[0.1]'
                  : 'text-[#6B7280] hover:text-[#9CA3AF] hover:bg-white/[0.03] border border-transparent'
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
          className="h-10 px-3 rounded-xl border border-white/[0.06] bg-[#0D1321] text-[13px] text-white focus:outline-none"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>

      {/* Transaction List */}
      <div className="space-y-4">
        {Object.keys(groupedActivities).length > 0 ? (
          Object.entries(groupedActivities).map(([dateLabel, dayActivities]) => (
            <div key={dateLabel}>
              <h3 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-2">{dateLabel}</h3>
              <div className="space-y-1.5">
                {dayActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="bg-[#0D1321] rounded-xl border border-white/[0.06] p-3.5 hover:bg-[#111827] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#1F2937] flex items-center justify-center">
                          {getTypeIcon(activity.type)}
                        </div>
                        <div>
                          <p className="text-[14px] font-medium text-white">{activity.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[12px] text-[#6B7280]">{formatDate(activity.date)}</span>
                            {getStatusBadge(activity.status)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-[14px] font-semibold ${activity.amount >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                          {activity.amount >= 0 ? '+' : ''}{activity.amount.toFixed(2)} {activity.currency}
                        </p>
                        <p className="text-[12px] text-[#6B7280]">${activity.usdValue.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Transaction Hash */}
                    {activity.hash && (
                      <div className="mt-3 pt-2.5 border-t border-white/[0.04] flex items-center justify-between">
                        <span className="text-[11px] text-[#4B5563]">Tx Hash</span>
                        <a
                          href={`${TX_EXPLORER_URL}${activity.hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#3B82F6] hover:text-[#60A5FA] text-[11px] font-mono flex items-center gap-1.5 transition-colors"
                        >
                          {activity.hash.slice(0, 8)}...{activity.hash.slice(-6)}
                          <ExternalLinkIcon size={10} />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-[#0D1321] rounded-xl border border-white/[0.06] p-10 text-center">
            <div className="w-14 h-14 rounded-xl bg-[#1F2937] flex items-center justify-center mx-auto mb-3">
              <RefreshIcon size={22} className="text-[#4B5563]" />
            </div>
            <p className="text-[15px] font-medium text-[#9CA3AF]">No transactions found</p>
            <p className="text-[13px] text-[#6B7280] mt-1">
              {searchQuery ? 'Try adjusting your search' : 'Your activity will appear here'}
            </p>
            {!searchQuery && address && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="mt-4 px-4 py-2 rounded-lg bg-white/[0.06] text-[#9CA3AF] hover:text-white hover:bg-white/[0.08] transition-all text-[13px] font-medium"
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Export Button */}
      {activities.length > 0 && (
        <div className="flex justify-end pt-2">
          <button className="px-4 py-2 rounded-lg border border-white/[0.06] bg-[#0D1321] text-[#6B7280] hover:text-white hover:bg-[#111827] transition-all text-[12px] font-medium">
            Export CSV
          </button>
        </div>
      )}
    </div>
  );
};

export default History;
