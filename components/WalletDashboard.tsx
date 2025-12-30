import React, { useMemo, useState, useEffect } from 'react';
import SideNavBar from './SideNavBar';
import TransactionList from './TransactionList';
import TransactionDetail from './TransactionDetail';
import SendAssets from './SendAssets';
import ReceiveAssets from './ReceiveAssets';
import Settings from './Settings';
import MultiSigDashboard from './MultiSigDashboard';
import Faucet from './Faucet';
import SwapScreen from './SwapScreen';
import Bridge from './Bridge';
import History from './History';
// AgentScreen temporarily disabled - will integrate new AI solution
// import AgentScreen, { WalletBalance } from './AgentScreen';
export interface WalletBalance {
    token: string;
    balance: string;
    formattedBalance: string;
}
import TreasuryScreen from './TreasuryScreen';
import NetworkSelector from './NetworkSelector';
import { Transaction } from '../types';
import { useCircleWallet } from '../contexts/CircleWalletContext';
import { useArcAccount } from '../contexts/ArcAccountContext';
import { useNetwork } from '../contexts/NetworkContext';
import type { AccountSnapshot } from '../services/arcRpcClient';
import { formatBlockTime } from '../utils/format';
import { useActivity } from '../contexts/ActivityContext';
import { usePrivacy } from '../contexts/PrivacyContext';
import {
  RefreshIcon,
  WalletIcon,
  NotificationIcon,
  LockIcon,
} from './Icons';
import { formatTokenAmount, getAllSupportedTokens, TokenInfo } from '../config/tokens';
import { DEFAULT_TOKEN_ICON } from '../config/app.config';
import { tokenService, TokenBalance, TokenPrices } from '../services/tokenService';

// ============================================
// LUCIDE-STYLE SVG ICONS
// ============================================

const CheckCircleIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const RefreshCwIcon = ({ size = 12, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 2v6h-6" />
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M3 22v-6h6" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
);

const EyeIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const ArrowUpRightIcon = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="7" y1="17" x2="17" y2="7" />
    <polyline points="7 7 17 7 17 17" />
  </svg>
);

const ArrowDownLeftIcon = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="17" y1="7" x2="7" y2="17" />
    <polyline points="17 17 7 17 7 7" />
  </svg>
);

const TrendingUpIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const TrendingDownIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
    <polyline points="17 18 23 18 23 12" />
  </svg>
);

// ============================================
// TOKEN BRAND COLORS
// ============================================

const TOKEN_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  USDC: {
    bg: 'rgba(39, 117, 202, 0.15)',
    border: 'rgba(39, 117, 202, 0.3)',
    text: '#2775CA',
  },
  EURC: {
    bg: 'rgba(26, 115, 232, 0.15)',
    border: 'rgba(26, 115, 232, 0.3)',
    text: '#1A73E8',
  },
  USYC: {
    bg: 'rgba(99, 102, 241, 0.15)',
    border: 'rgba(99, 102, 241, 0.3)',
    text: '#6366F1',
  },
};

const getTokenColor = (symbol: string) => {
  return TOKEN_COLORS[symbol] || {
    bg: 'rgba(74, 158, 255, 0.15)',
    border: 'rgba(74, 158, 255, 0.3)',
    text: '#4A9EFF',
  };
};

const getTokenIconContent = (symbol: string): string => {
  switch (symbol) {
    case 'USDC': return 'US';
    case 'EURC': return '€';
    case 'USYC': return 'Y';
    default: return symbol.slice(0, 2);
  }
};

// ============================================
// INTERFACES
// ============================================

interface DashboardHeaderProps {
  account: AccountSnapshot | null;
  isRefreshing: boolean;
  onRefresh: () => Promise<void>;
  error: string | null;
}

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTransactions: () => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose, onNavigateToTransactions }) => {
  const { activities } = useActivity();
  // PasskeyAccount - Smart Wallet (single wallet system)
  const { address: walletAddress } = useCircleWallet();

  if (!isOpen) return null;

  // Create notifications from recent activities and system events
  const notifications = useMemo(() => {
    const activityNotifications = activities.slice(0, 3).map((activity, index) => {
      // Safe null check for activity.date
      const activityDate = activity.date instanceof Date ? activity.date : new Date(activity.date || Date.now());
      const timeAgo = Date.now() - activityDate.getTime();
      const timeString = timeAgo < 60000 ? 'Just now' :
        timeAgo < 3600000 ? `${Math.floor(timeAgo / 60000)} min ago` :
          timeAgo < 86400000 ? `${Math.floor(timeAgo / 3600000)} hours ago` :
            `${Math.floor(timeAgo / 86400000)} days ago`;

      const isPositive = activity.amount > 0;

      return {
        id: `activity-${activity.id}`,
        title: isPositive ? `${activity.currency} Received` : `${activity.currency} Sent`,
        message: `${Math.abs(activity.amount)} ${activity.currency} - ${activity.description}`,
        time: timeString,
        type: isPositive ? 'success' as const : 'info' as const
      };
    });

    // Add system notifications
    const systemNotifications = [];

    // Session expiry warning
    if (walletAddress) {
      systemNotifications.push({
        id: 'session-warning',
        title: 'Session Active',
        message: 'Your wallet session is active and secure',
        time: 'Now',
        type: 'info' as const
      });
    }

    // Combine activity and system notifications
    return [...activityNotifications, ...systemNotifications].slice(0, 5);
  }, [activities, walletAddress]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[100]" onClick={onClose} />
      {/* Dropdown */}
      <div className="fixed right-8 top-20 mt-2 w-80 z-[110] rounded-xl border border-white/[0.1] bg-[#0F1629] shadow-xl">
        <div className="p-4 border-b border-white/[0.06]">
          <h3 className="text-base font-semibold text-white">Notifications</h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <div key={notification.id} className="p-4 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${notification.type === 'success' ? 'bg-[#34D399]' :
                    notification.type === 'warning' ? 'bg-yellow-400' :
                      'bg-[#4A9EFF]'
                    }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{notification.title}</p>
                    <p className="text-sm text-[#9CA3AF] mt-1 leading-relaxed">{notification.message}</p>
                    <p className="text-xs text-[#4B5563] mt-2">{notification.time}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center">
              <p className="text-sm text-[#6B7280]">No recent activity</p>
              <p className="text-xs text-[#4B5563] mt-1">Your transactions and updates will appear here</p>
            </div>
          )}
        </div>
        <div className="p-3 border-t border-white/[0.06]">
          <button
            className="w-full text-sm text-[#4A9EFF] hover:text-[#6BB3FF] transition-colors font-medium"
            onClick={() => {
              onNavigateToTransactions();
              onClose();
            }}
          >
            View All Transactions
          </button>
        </div>
      </div>
    </>
  );
};

interface DashboardHeaderPropsWithNav extends DashboardHeaderProps {
  onNavigate: (page: string) => void;
}

interface AgentIntentData {
  type: 'SEND' | 'SWAP' | 'CHECK_BALANCE';
  params: any;
}

const DashboardHeader: React.FC<DashboardHeaderPropsWithNav> = ({ account, isRefreshing, onRefresh, error, onNavigate }) => {
  // Circle Modular Wallet - Smart Wallet (single wallet system)
  const { address, disconnect } = useCircleWallet();
  const { isPrivacyMode, togglePrivacyMode } = usePrivacy();
  const { currentNetwork } = useNetwork();

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [hasCopiedAddress, setHasCopiedAddress] = useState(false);
  const { activities } = useActivity();
  const blockLabel = account?.latestBlock.finalized ? 'Finalized Block' : 'Latest Block';
  const lastUpdated = account ? formatBlockTime(account.latestBlock.timestamp) : '—';

  return (
    <header className="relative z-50 flex h-20 items-center justify-between gap-4 border-b border-white/[0.06] px-8 py-3 backdrop-blur-sm bg-[#0A0F1A]/80">
      <div />
      <div className="flex items-center gap-4">
        <div className="hidden lg:flex flex-col text-right">
          <p className="text-[11px] text-[#4B5563] uppercase tracking-[0.08em] font-semibold">{blockLabel}</p>
          <p className="text-sm font-semibold text-white">{account ? `#${account.latestBlock.number.toLocaleString()}` : '—'}</p>
          <p className="text-xs text-[#6B7280]">{lastUpdated}</p>
        </div>
        {/* Network Selector */}
        <NetworkSelector compact />
        <div className="flex items-center gap-3 rounded-lg bg-[#111827] border border-white/[0.06] px-3 py-1.5 opacity-60 cursor-not-allowed" title="Privacy Mode with TEE - Coming Soon">
          <div className="flex items-center gap-2">
            <LockIcon size={14} className="text-[#4B5563]" />
            <p className="text-sm font-medium text-[#6B7280]">Privacy Mode</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-[#4A9EFF] bg-[rgba(74,158,255,0.1)] px-2 py-0.5 rounded">Coming Soon</span>
            <button
              disabled
              className="relative inline-flex h-5 w-9 items-center rounded-full bg-[#1F2937] cursor-not-allowed opacity-50"
            >
              <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-[#4B5563] translate-x-1" />
            </button>
          </div>
        </div>
        {address && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(address);
              setHasCopiedAddress(true);
              setTimeout(() => setHasCopiedAddress(false), 2000);
            }}
            className="hidden sm:flex items-center gap-2 rounded-lg bg-[#111827] px-3 py-1.5 border border-white/[0.06] text-left hover:border-white/[0.15] hover:bg-[#1A2235] transition-all"
            title="Copy wallet address"
          >
            <WalletIcon size={16} className="text-[#6B7280]" />
            <p className="text-sm font-mono text-[#9CA3AF]">{hasCopiedAddress ? 'Copied!' : `${address.slice(0, 6)}...${address.slice(-4)}`}</p>
          </button>
        )}
        {error && <p className="hidden md:block text-sm text-[#F87171]">{error}</p>}
        <div className="relative">
          <button
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            className="rounded-lg p-2 text-[#6B7280] hover:text-[#9CA3AF] hover:bg-white/[0.05] transition-all relative"
          >
            <NotificationIcon size={20} />
            {/* Notification badge */}
            {activities.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#F87171] rounded-full flex items-center justify-center">
                <span className="text-[10px] text-white font-bold">{Math.min(activities.length, 9)}</span>
              </span>
            )}
          </button>
          <NotificationDropdown
            isOpen={isNotificationOpen}
            onClose={() => setIsNotificationOpen(false)}
            onNavigateToTransactions={() => onNavigate('Transactions')}
          />
        </div>
        <button
          onClick={disconnect}
          className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#111827] border border-white/[0.06] text-white text-sm font-semibold hover:bg-[#1A2235] hover:border-white/[0.1] transition-all"
        >
          <LockIcon size={16} className="mr-2 text-[#6B7280]" />
          <span className="truncate">Lock</span>
        </button>
      </div>
    </header>
  );
};

interface BalanceOverviewProps {
  onNavigate: (page: string) => void;
  balanceDisplay: string | null;
  isLoading: boolean;
  lastUpdated: number | null;
  error: string | null;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  isHidden: boolean;
  toggleHidden: () => void;
}

const BalanceOverview: React.FC<BalanceOverviewProps> = ({ onNavigate, balanceDisplay, isLoading, lastUpdated, error, onRefresh, isRefreshing, isHidden, toggleHidden }) => {
  const displayBalance = balanceDisplay ?? '$0.00';
  const updatedAt = lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—';

  return (
    <div className="relative bg-gradient-to-b from-[#111827] to-[#0F1629] rounded-2xl border border-white/[0.06] p-5 overflow-hidden">
      {/* Top edge highlight */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      {/* Subtle background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(74,158,255,0.03)_0%,transparent_70%)]" />

      <div className="relative flex items-start justify-between">
        <div className="flex flex-col gap-1">
          {/* Total Balance Label */}
          <p className="text-[13px] font-medium text-[#6B7280]">Total Balance</p>

          {/* Balance Value */}
          <div className="flex items-center gap-3">
            <p
              className="text-[32px] font-bold text-white"
              style={{ letterSpacing: '-1px', fontFeatureSettings: '"tnum"' }}
            >
              {isHidden ? '••••••' : displayBalance}
            </p>

            {/* Finalized Badge - GRAY not green */}
            <div className="inline-flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.1] rounded-md px-2 py-0.5">
              <CheckCircleIcon size={12} className="text-[#9CA3AF]" />
              <span className="text-[11px] font-medium text-[#9CA3AF]">Finalized</span>
            </div>
          </div>

          {/* Synced at */}
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[11px] text-[#4B5563]">Synced at {updatedAt}</span>
            <button
              onClick={() => void onRefresh()}
              className="p-0.5 text-[#4B5563] hover:text-[#6B7280] transition-colors group"
              aria-label="Refresh balances"
            >
              <RefreshCwIcon
                size={11}
                className={`transition-transform ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180'}`}
              />
            </button>
          </div>

          {error && <p className="text-[13px] text-[#F87171] mt-1">{error}</p>}
        </div>

        {/* Eye Icon - Hide Balance Toggle */}
        <button
          onClick={toggleHidden}
          className="p-1.5 text-[#4B5563] hover:text-[#6B7280] hover:bg-white/[0.05] rounded-lg transition-all"
          title={isHidden ? 'Show balance' : 'Hide balance'}
        >
          {isHidden ? <EyeIcon size={18} /> : <EyeOffIcon size={18} />}
        </button>
      </div>

      {/* Send / Receive Buttons */}
      <div className="relative grid grid-cols-2 gap-3 mt-5">
        {/* Send Button - White/Light */}
        <button
          onClick={() => onNavigate('Send')}
          className="flex h-11 items-center justify-center gap-2 px-5 text-[14px] font-semibold bg-white text-[#0F1629] rounded-xl transition-all hover:bg-[#F1F5F9] hover:shadow-[0_4px_12px_rgba(255,255,255,0.1)] hover:-translate-y-0.5 active:translate-y-0 active:bg-[#E2E8F0]"
        >
          <ArrowUpRightIcon size={16} />
          <span>Send</span>
        </button>

        {/* Receive Button - Outlined */}
        <button
          onClick={() => onNavigate('Receive')}
          className="flex h-11 items-center justify-center gap-2 px-5 text-[14px] font-semibold bg-transparent border border-white/[0.15] text-white rounded-xl transition-all hover:bg-white/[0.05] hover:border-white/[0.25] hover:-translate-y-0.5 active:translate-y-0 active:bg-white/[0.08]"
        >
          <ArrowDownLeftIcon size={16} />
          <span>Receive</span>
        </button>
      </div>
    </div>
  );
};

interface AssetsTableProps {
  balanceDisplay: string | null;
  isLoading: boolean;
  tokenBalances?: TokenBalance[];
  prices?: TokenPrices;
}

interface TokenAssetData {
  name: string;
  ticker: string;
  price: string;
  priceNum: number;
  change: string;
  changeNum: number;
  balance: string;
  balanceNum: number;
  value: string;
  valueNum: number;
  icon: string;
}

// Helper function for price change color
const getPriceChangeColor = (changeNum: number): string => {
  if (changeNum > 0) return 'text-[#34D399]/80'; // Green at 80% opacity
  if (changeNum < 0) return 'text-[#F87171]/80'; // Red at 80% opacity
  return 'text-[#6B7280]'; // Gray for neutral/zero
};

// Helper function for price change display
const formatPriceChange = (changeNum: number): string => {
  if (changeNum === 0) return '0.00%'; // No + sign for zero
  if (changeNum > 0) return `+${changeNum.toFixed(2)}%`;
  return `${changeNum.toFixed(2)}%`;
};

const AssetsTable: React.FC<AssetsTableProps> = ({ balanceDisplay, isLoading, tokenBalances: propTokenBalances, prices: propPrices }) => {
  // Use props if provided, otherwise empty
  const tokenBalances = propTokenBalances || [];
  const prices = propPrices || {};

  const rows = useMemo(() => {
    if (tokenBalances.length === 0) {
      // Fallback to supported tokens with zero balances
      return getAllSupportedTokens().map((token): TokenAssetData => {
        const priceUsd = prices[token.symbol]?.usd ?? (token.symbol === 'USDC' ? 1.0 : 1.07);
        return {
          name: `${token.name} (${token.symbol})`,
          ticker: token.symbol,
          price: `$${priceUsd.toFixed(2)}`,
          priceNum: priceUsd,
          change: '0.00%',
          changeNum: 0,
          balance: `0.00 ${token.symbol}`,
          balanceNum: 0,
          value: '$0.00',
          valueNum: 0,
          icon: token.icon || DEFAULT_TOKEN_ICON,
        };
      });
    }

    return tokenBalances.map((tokenBalance): TokenAssetData => {
      const symbol = tokenBalance.token.symbol;
      const priceUsd = prices[symbol]?.usd ?? (symbol === 'USDC' ? 1.0 : 1.07);
      const qty = parseFloat(tokenBalance.formattedBalance);
      const value = qty * priceUsd;

      return {
        name: `${tokenBalance.token.name} (${tokenBalance.token.symbol})`,
        ticker: tokenBalance.token.symbol,
        price: `$${priceUsd.toFixed(2)}`,
        priceNum: priceUsd,
        change: '0.00%',
        changeNum: 0, // We don't have real price change data
        balance: `${qty.toFixed(2)} ${tokenBalance.token.symbol}`,
        balanceNum: qty,
        value: `$${value.toFixed(2)}`,
        valueNum: value,
        icon: tokenBalance.token.icon || DEFAULT_TOKEN_ICON,
      };
    });
  }, [tokenBalances, prices]);

  const tokenCount = rows.length;

  return (
    <div>
      {/* My Assets Header with Badge */}
      <div className="flex items-center gap-2 mt-6 mb-3">
        <h2 className="text-base font-semibold text-white">My Assets</h2>
        <span className="bg-[#1F2937] text-[#6B7280] text-[11px] font-medium px-1.5 py-0.5 rounded-full">
          {tokenCount}
        </span>
      </div>

      {/* Table */}
      <div className="flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-1 align-middle sm:px-6 lg:px-8">
            <table className="min-w-full">
              {/* Table Header */}
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th scope="col" className="py-2.5 pl-4 pr-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4B5563] sm:pl-0" style={{ flex: 2 }}>
                    Asset
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4B5563]" style={{ flex: 1 }}>
                    Price
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4B5563]" style={{ flex: 1 }}>
                    Balance
                  </th>
                  <th scope="col" className="py-2.5 pl-3 pr-4 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4B5563] sm:pr-0" style={{ flex: 1 }}>
                    Value
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody>
                {rows.map((asset) => {
                  const isZeroBalance = asset.balanceNum === 0;
                  const tokenColor = getTokenColor(asset.ticker);

                  return (
                    <tr
                      key={asset.ticker}
                      className={`
                        rounded-xl cursor-pointer transition-all duration-150
                        hover:bg-white/[0.03]
                        ${isZeroBalance ? 'opacity-60 hover:opacity-100' : ''}
                      `}
                    >
                      {/* Asset Column */}
                      <td className="whitespace-nowrap py-3 pl-4 pr-3 sm:pl-0">
                        <div className="flex items-center">
                          {/* Token Icon with Brand Colors */}
                          <div
                            className="h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center"
                            style={{
                              backgroundColor: tokenColor.bg,
                              border: `1px solid ${tokenColor.border}`,
                            }}
                          >
                            {asset.icon && (asset.icon.startsWith('http') || asset.icon.startsWith('/')) ? (
                              <img
                                className={`h-9 w-9 object-cover rounded-full ${isZeroBalance ? 'opacity-50' : ''}`}
                                src={asset.icon}
                                alt={`${asset.name} logo`}
                              />
                            ) : (
                              <span
                                className="text-[11px] font-bold"
                                style={{ color: tokenColor.text }}
                              >
                                {getTokenIconContent(asset.ticker)}
                              </span>
                            )}
                          </div>

                          {/* Token Name */}
                          <div className="ml-3">
                            <div className={`text-[14px] font-medium ${isZeroBalance ? 'text-[#9CA3AF]' : 'text-white'}`}>
                              {asset.name}
                            </div>
                            <div className={`text-[12px] ${isZeroBalance ? 'text-[#4B5563]' : 'text-[#6B7280]'}`}>
                              {asset.ticker}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Price Column */}
                      <td className="whitespace-nowrap px-3 py-3">
                        <div className={`text-[13px] font-medium ${isZeroBalance ? 'text-[#9CA3AF]' : 'text-white'}`}>
                          {asset.price}
                        </div>
                        <div className={`text-[12px] ${isZeroBalance ? 'text-[#4B5563]' : getPriceChangeColor(asset.changeNum)}`}>
                          {formatPriceChange(asset.changeNum)}
                        </div>
                      </td>

                      {/* Balance Column */}
                      <td className="whitespace-nowrap px-3 py-3">
                        <span
                          className={`text-[13px] font-medium font-mono ${isZeroBalance ? 'text-[#4B5563]' : 'text-white'}`}
                        >
                          {asset.balance}
                        </span>
                      </td>

                      {/* Value Column */}
                      <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right sm:pr-0">
                        <span
                          className={`text-[13px] font-semibold ${isZeroBalance ? 'text-[#4B5563]' : 'text-white'}`}
                        >
                          {asset.value}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

interface DashboardHomeProps {
  onNavigate: (page: string) => void;
  balanceDisplay: string | null;
  isLoading: boolean;
  lastUpdated: number | null;
  error: string | null;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  isHidden: boolean;
  toggleHidden: () => void;
  tokenBalances?: TokenBalance[];
  prices?: TokenPrices;
  recentActivities?: any[];
}

// Recent Activity Component
const RecentActivity: React.FC<{ activities: any[]; onNavigate: (page: string) => void }> = ({ activities, onNavigate }) => {
  const recentItems = activities.slice(0, 5);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
        <button
          onClick={() => onNavigate('History')}
          className="text-sm text-[#4A9EFF] hover:text-[#6BB3FF] transition-colors font-medium"
        >
          View All
        </button>
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-[#0F1629] overflow-hidden">
        {recentItems.length > 0 ? (
          <div className="divide-y divide-white/[0.04]">
            {recentItems.map((activity, index) => (
              <div key={activity.id || index} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    activity.amount >= 0 ? 'bg-[rgba(52,211,153,0.1)]' : 'bg-[rgba(248,113,113,0.1)]'
                  }`}>
                    {activity.amount >= 0 ? (
                      <ArrowDownLeftIcon size={16} className="text-[#34D399]" />
                    ) : (
                      <ArrowUpRightIcon size={16} className="text-[#F87171]" />
                    )}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{activity.description}</p>
                    <p className="text-[#4B5563] text-xs mt-0.5">{formatTime(activity.date)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold text-sm ${activity.amount >= 0 ? 'text-[#34D399]' : 'text-[#F87171]'}`}>
                    {activity.amount >= 0 ? '+' : ''}{activity.amount?.toFixed(2) || '0.00'} {activity.currency || 'USDC'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-[#111827] flex items-center justify-center mx-auto mb-4">
              <ArrowUpRightIcon size={24} className="text-[#4B5563]" />
            </div>
            <p className="text-[#6B7280] text-sm font-medium">No recent activity</p>
            <p className="text-[#4B5563] text-xs mt-1">Your transactions will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
};

const DashboardHome: React.FC<DashboardHomeProps> = ({ onNavigate, balanceDisplay, isLoading, lastUpdated, error, onRefresh, isRefreshing, isHidden, toggleHidden, tokenBalances, prices, recentActivities = [] }) => (
  <>
    <BalanceOverview
      onNavigate={onNavigate}
      balanceDisplay={balanceDisplay}
      isLoading={isLoading}
      lastUpdated={lastUpdated}
      error={error}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      isHidden={isHidden}
      toggleHidden={toggleHidden}
    />
    <AssetsTable balanceDisplay={balanceDisplay} isLoading={isLoading} tokenBalances={tokenBalances} prices={prices} />
  </>
);

const WalletDashboard: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('Dashboard');
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [agentIntentData, setAgentIntentData] = useState<AgentIntentData | null>(null);

  const handleAgentIntent = (intent: any) => {
    setAgentIntentData(intent);
    if (intent.type === 'SEND') {
      setCurrentPage('Send');
    } else if (intent.type === 'SWAP') {
      setCurrentPage('Swap');
    } else if (intent.type === 'CHECK_BALANCE') {
      // For balance check, we might just want to stay on Agent screen or go to Dashboard
      // For now, let's go to Dashboard to show balance
      setCurrentPage('Dashboard');
    }
  };

  // Circle Modular Wallet - Smart Wallet (single wallet system)
  const { address } = useCircleWallet();
  const { currentNetwork } = useNetwork();

  const { snapshot, formattedBalance, isLoading: isAccountLoading, error: accountError, refresh, lastUpdated } = useArcAccount();

  const { activities: transactions } = useActivity();
  const isLoadingTransactions = false;

  // State for total balance from all tokens
  const [totalBalance, setTotalBalance] = useState<string | null>(null);
  const [isLoadingTotalBalance, setIsLoadingTotalBalance] = useState(false);
  // State for agent wallet balances
  const [agentBalances, setAgentBalances] = useState<WalletBalance[]>([]);
  // State for token balances and prices (shared with AssetsTable)
  const [tokenBalancesState, setTokenBalancesState] = useState<TokenBalance[]>([]);
  const [pricesState, setPricesState] = useState<TokenPrices>({});

  // Sync tokenService RPC URL with current network
  useEffect(() => {
    tokenService.setRpcUrl(currentNetwork.rpcUrls.default);
  }, [currentNetwork]);

  // Calculate total balance from all tokens
  useEffect(() => {
    const calculateTotalBalance = async () => {
      if (!address) {
        setTotalBalance(null);
        return;
      }

      // Determine chain key based on network ID
      type ChainKey2 = 'ethereum' | 'sepolia' | 'base' | 'baseSepolia' | 'avalanche' | 'avalancheFuji' | 'arc' | 'arcTestnet';
      const chainKey: ChainKey2 = currentNetwork.id === 'arc-testnet' ? 'arcTestnet' :
                       currentNetwork.id === 'sepolia' ? 'sepolia' :
                       currentNetwork.id === 'base-sepolia' ? 'baseSepolia' :
                       currentNetwork.id === 'avalanche-fuji' ? 'avalancheFuji' :
                       currentNetwork.id === 'ethereum' ? 'ethereum' :
                       currentNetwork.id === 'base' ? 'base' :
                       currentNetwork.id === 'avalanche' ? 'avalanche' :
                       'arcTestnet';
      const networkType = currentNetwork.testnet ? 'testnet' : 'mainnet';

      setIsLoadingTotalBalance(true);
      try {
        const tokenBalances = await tokenService.getAllTokenBalances(address, networkType, chainKey);
        const symbols = getAllSupportedTokens().map(t => t.symbol);
        const prices = await tokenService.getTokenPrices(symbols);

        // Store for AssetsTable (avoid duplicate fetches)
        setTokenBalancesState(tokenBalances);
        setPricesState(prices);

        let total = 0;
        const walletBalances: WalletBalance[] = [];
        for (const tb of tokenBalances) {
          const qty = parseFloat(tb.formattedBalance);
          const priceUsd = prices[tb.token.symbol]?.usd ?? (tb.token.symbol === 'USDC' ? 1.0 : 1.07);
          total += qty * priceUsd;
          walletBalances.push({
            token: tb.token.symbol,
            balance: tb.balance.toString(),
            formattedBalance: tb.formattedBalance,
          });
        }

        setAgentBalances(walletBalances);
        setTotalBalance(`$${total.toFixed(2)}`);
      } catch (error) {
        console.error('Error calculating total balance:', error);
        setTotalBalance(formattedBalance); // Fallback to USDC balance
      } finally {
        setIsLoadingTotalBalance(false);
      }
    };

    calculateTotalBalance();

    // Refresh every 30 seconds
    const interval = setInterval(calculateTotalBalance, 30000);
    return () => clearInterval(interval);
  }, [address, formattedBalance, currentNetwork]);

  const selectedTransaction = useMemo(() => transactions.find((tx) => tx.id === selectedTransactionId) ?? null, [transactions, selectedTransactionId]);

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    setSelectedTransactionId(null);
  };

  const renderPageContent = () => {
    switch (currentPage) {
      case 'Dashboard':
        return (
          <DashboardHome
            onNavigate={handleNavigate}
            balanceDisplay={totalBalance ?? formattedBalance}
            isLoading={isAccountLoading || isLoadingTotalBalance}
            lastUpdated={lastUpdated}
            error={accountError}
            onRefresh={refresh}
            isRefreshing={isAccountLoading || isLoadingTotalBalance}
            isHidden={isBalanceHidden}
            toggleHidden={() => setIsBalanceHidden((prev) => !prev)}
            tokenBalances={tokenBalancesState}
            prices={pricesState}
            recentActivities={transactions}
          />
        );
      case 'Send':
        return (
          <SendAssets
            initialAmount={agentIntentData?.type === 'SEND' ? agentIntentData.params.amount : undefined}
            initialRecipient={agentIntentData?.type === 'SEND' ? agentIntentData.params.recipient : undefined}
            initialToken={agentIntentData?.type === 'SEND' ? agentIntentData.params.token : undefined}
          />
        );
      case 'Receive':
        return <ReceiveAssets />;
      case 'Swap':
        return (
          <SwapScreen
            initialFromToken={agentIntentData?.type === 'SWAP' ? agentIntentData.params.fromToken : undefined}
            initialToToken={agentIntentData?.type === 'SWAP' ? agentIntentData.params.toToken : undefined}
            initialAmount={agentIntentData?.type === 'SWAP' ? agentIntentData.params.amount : undefined}
          />
        );
      case 'Bridge':
        return <Bridge />;
      case 'Treasury':
        return <TreasuryScreen />;
      case 'History':
        return <History />;
      case 'Transactions':
        return null;
      case 'Multi-Sig':
        return <MultiSigDashboard />;
      case 'Faucet':
        return <Faucet />;
      // Agent temporarily disabled - will integrate new AI solution
      // case 'Agent':
      //   return (
      //     <AgentScreen
      //       onExecuteIntent={handleAgentIntent}
      //       walletAddress={address}
      //       balances={agentBalances}
      //       totalBalance={totalBalance || undefined}
      //     />
      //   );
      case 'Settings':
        return <Settings />;
      default:
        return (
          <DashboardHome
            onNavigate={handleNavigate}
            balanceDisplay={totalBalance ?? formattedBalance}
            isLoading={isAccountLoading || isLoadingTotalBalance}
            lastUpdated={lastUpdated}
            error={accountError}
            onRefresh={refresh}
            isRefreshing={isAccountLoading || isLoadingTotalBalance}
            isHidden={isBalanceHidden}
            toggleHidden={() => setIsBalanceHidden((prev) => !prev)}
            tokenBalances={tokenBalancesState}
            prices={pricesState}
          />
        );
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#0A0F1A] text-white">
      <SideNavBar currentPage={currentPage} onNavigate={handleNavigate} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader account={snapshot} isRefreshing={isAccountLoading} onRefresh={refresh} error={accountError} onNavigate={handleNavigate} />
        <div className="flex flex-1 overflow-auto">
          {currentPage === 'Transactions' ? (
            <>
              <TransactionList
                transactions={transactions}
                isLoading={isLoadingTransactions}
                selectedTransaction={selectedTransaction}
                onSelectTransaction={(transaction) => setSelectedTransactionId(transaction.id)}
              />
              {selectedTransaction && <TransactionDetail transaction={selectedTransaction} onClose={() => setSelectedTransactionId(null)} />}
            </>
          ) : (
            <div className="w-full px-6 py-5 overflow-y-auto">{renderPageContent()}</div>
          )}
        </div>
      </main>
    </div>
  );
};

export default WalletDashboard;
