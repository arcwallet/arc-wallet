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
import AgentScreen from './AgentScreen';
// import Bridge from './Bridge';
import { Transaction } from '../types';
import { useWallet } from '../contexts/WalletContext';
import { useSelfCustodialWallet } from '../contexts/SelfCustodialWalletContext';
import { useArcAccount } from '../contexts/ArcAccountContext';
import type { AccountSnapshot } from '../services/arcRpcClient';
import { formatBlockTime } from '../utils/format';
import { useActivity } from '../contexts/ActivityContext';
import { usePrivacy } from '../contexts/PrivacyContext';
import {
  RefreshIcon,
  WalletIcon,
  NotificationIcon,
  LockIcon,
  VerifiedIcon,
  EyeOffIcon,
  EyeIcon,
  SendIcon,
  ReceiveIcon
} from './Icons';
import { formatTokenAmount, getAllSupportedTokens, TokenInfo } from '../config/tokens';
import { DEFAULT_TOKEN_ICON } from '../config/app.config';
import { tokenService, TokenBalance, TokenPrices } from '../services/tokenService';

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
  // Get address from self-custodial context first
  const { address: selfCustodialAddress } = useSelfCustodialWallet();
  const { sessionKey } = useWallet();
  const walletAddress = selfCustodialAddress || sessionKey?.address;

  if (!isOpen) return null;

  // Create notifications from recent activities and system events
  const notifications = useMemo(() => {
    const activityNotifications = activities.slice(0, 3).map((activity, index) => {
      const timeAgo = new Date().getTime() - activity.date.getTime();
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
      <div className="fixed right-8 top-20 mt-2 w-80 z-[110] rounded-lg border border-white/10 bg-[#151A22] shadow-lg">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-[#E6EEF3]">Notifications</h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <div key={notification.id} className="p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${notification.type === 'success' ? 'bg-green-400' :
                    notification.type === 'warning' ? 'bg-yellow-400' :
                      'bg-blue-400'
                    }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#E6EEF3] truncate">{notification.title}</p>
                    <p className="text-sm text-[#A7B4C8] mt-1 leading-relaxed">{notification.message}</p>
                    <p className="text-xs text-[#A7B4C8] mt-2">{notification.time}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center">
              <p className="text-sm text-[#A7B4C8]">No recent activity</p>
              <p className="text-xs text-[#A7B4C8] mt-1">Your transactions and updates will appear here</p>
            </div>
          )}
        </div>
        <div className="p-3 border-t border-white/10">
          <button
            className="w-full text-sm text-[#9EBBE4] hover:text-[#B9D1ED] transition-colors"
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
  // Get address from self-custodial context first
  const { address: selfCustodialAddress, lockWallet } = useSelfCustodialWallet();
  const { address: legacyAddress, logout: legacyLogout } = useWallet();
  const address = selfCustodialAddress || legacyAddress;
  const logout = selfCustodialAddress ? lockWallet : legacyLogout;
  const { isPrivacyMode, togglePrivacyMode } = usePrivacy();

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [hasCopiedAddress, setHasCopiedAddress] = useState(false);
  const { activities } = useActivity();
  const blockLabel = account?.latestBlock.finalized ? 'Finalized Block' : 'Latest Block';
  const lastUpdated = account ? formatBlockTime(account.latestBlock.timestamp) : '—';

  return (
    <header className="relative z-50 flex h-20 items-center justify-between gap-4 border-b border-slate-500/30 px-8 py-3 backdrop-blur-sm bg-slate-900/40">
      <div />
      <div className="flex items-center gap-4">
        <div className="hidden lg:flex flex-col text-right">
          <p className="text-xs text-[#A7B4C8] uppercase tracking-wide">{blockLabel}</p>
          <p className="text-sm font-semibold text-[#E6EEF3]">{account ? `#${account.latestBlock.number.toLocaleString()}` : '—'}</p>
          <p className="text-xs text-[#A7B4C8]">{lastUpdated}</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-slate-900/60 backdrop-blur-sm border border-slate-600/30 px-3 py-1.5">
          <div className="size-2 rounded-full bg-green-500" />
          <p className="text-sm font-medium text-slate-400">Arc Testnet</p>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-[#151A22] border border-white/10 px-3 py-1.5 opacity-60 cursor-not-allowed" title="Privacy Mode with TEE - Coming Soon">
          <div className="flex items-center gap-2">
            <LockIcon size={14} className="text-slate-500" />
            <p className="text-sm font-medium text-slate-400">Privacy Mode</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">Coming Soon</span>
            <button
              disabled
              className="relative inline-flex h-5 w-9 items-center rounded-full bg-slate-700 cursor-not-allowed opacity-50"
            >
              <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white translate-x-1" />
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
            className="hidden sm:flex items-center gap-2 rounded-lg bg-slate-900/60 backdrop-blur-sm px-3 py-1.5 border border-slate-500/50 text-left hover:border-blue-400 transition-all"
            title="Copy wallet address"
          >
            <WalletIcon size={16} className="text-text-secondary" />
            <p className="text-sm font-mono text-text-secondary">{hasCopiedAddress ? 'Copied!' : `${address.slice(0, 6)}...${address.slice(-4)}`}</p>
          </button>
        )}
        {error && <p className="hidden md:block text-sm text-accent-orange">{error}</p>}
        <div className="relative">
          <button
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            className="rounded-lg p-2 text-[#A7B4C8] hover:bg-[#151A22] transition-colors relative"
          >
            <NotificationIcon size={20} />
            {/* Notification badge */}
            {activities.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-xs text-white font-bold">{Math.min(activities.length, 9)}</span>
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
          onClick={logout}
          className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#151A22] text-[#E6EEF3] text-sm font-bold tracking-wide hover:bg-[#1f252e]"
        >
          <LockIcon size={18} className="mr-2" />
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

const ShimmerBar: React.FC<{ width?: string }> = ({ width = '100%' }) => (
  <div className="relative overflow-hidden rounded-md bg-white/5" style={{ width, height: '14px' }}>
    <div className="absolute inset-0 animate-[shimmer_1.8s_infinite]" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.04) 100%)' }} />
  </div>
);

const BalanceOverview: React.FC<BalanceOverviewProps> = ({ onNavigate, balanceDisplay, isLoading, lastUpdated, error, onRefresh, isRefreshing, isHidden, toggleHidden }) => {
  const displayBalance = balanceDisplay ?? '$0.00';
  const updatedAt = lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—';

  return (
    <div className="flex flex-col gap-6 rounded-xl bg-slate-900/60 backdrop-blur-sm border border-slate-500/50 p-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-base font-medium text-[#A7B4C8]">Total Balance</p>
          <div className="flex items-center gap-4">
            <p className="text-4xl font-bold text-[#E6EEF3] min-h-[44px]">
              {isHidden ? '••••••' : displayBalance}
            </p>
            <div className="flex items-center gap-1.5">
              <p className="text-green-400 text-sm font-medium">Finalized</p>
              <VerifiedIcon size={16} className="text-green-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#A7B4C8]">
            {`Synced at ${updatedAt}`}
            {(
              <button
                onClick={() => void onRefresh()}
                className="p-1 text-[#A7B4C8] hover:text-white transition-colors"
                aria-label="Refresh balances"
              >
                <RefreshIcon size={14} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
            )}
          </div>
          {error && <p className="text-sm text-accent-orange">{error}</p>}
        </div>
        <button
          onClick={toggleHidden}
          className="p-2 text-[#A7B4C8] hover:bg-white/10 rounded-lg"
          title={isHidden ? 'Show balance' : 'Hide balance'}
        >
          {isHidden ? <EyeIcon size={20} /> : <EyeOffIcon size={20} />}
        </button>
      </div>
      <div className="flex gap-4">
        <button
          onClick={() => onNavigate('Send')}
          className="flex h-12 flex-1 items-center justify-center gap-2 px-5 text-base font-semibold bg-slate-200 hover:bg-white text-slate-900 rounded-lg shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all"
        >
          <SendIcon size={20} />
          <span className="truncate">Send</span>
        </button>
        <button
          onClick={() => onNavigate('Receive')}
          className="flex h-12 flex-1 items-center justify-center gap-2 px-5 text-base font-semibold bg-slate-200 hover:bg-white text-slate-900 rounded-lg shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all"
        >
          <ReceiveIcon size={20} />
          <span className="truncate">Receive</span>
        </button>
      </div>
    </div>
  );
};

interface AssetsTableProps {
  balanceDisplay: string | null;
  isLoading: boolean;
}

interface TokenAssetData {
  name: string;
  ticker: string;
  price: string;
  change: string;
  balance: string;
  value: string;
  icon: string;
}

const AssetsTable: React.FC<AssetsTableProps> = ({ balanceDisplay, isLoading }) => {
  // Get address from self-custodial context first
  const { address: selfCustodialAddress } = useSelfCustodialWallet();
  const { sessionKey } = useWallet();
  const walletAddress = selfCustodialAddress || sessionKey?.address;

  const [activeTab, setActiveTab] = useState<'tokens'>('tokens');
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [prices, setPrices] = useState<TokenPrices>({});

  // Fetch all token balances
  useEffect(() => {
    const fetchTokenBalances = async () => {
      const addresses: string[] = [];
      if (walletAddress) addresses.push(walletAddress);
      if (addresses.length === 0) {
        setTokenBalances([]);
        return;
      }

      setIsLoadingTokens(true);
      try {
        // Fetch per address then merge by token symbol (sum balances)
        const resultsPerAddress = await Promise.all(
          addresses.map((addr) => tokenService.getAllTokenBalances(addr, 'testnet', 'arcTestnet'))
        );

        const merged = new Map<string, { token: TokenInfo; qty: number }>();
        for (const list of resultsPerAddress) {
          for (const tb of list) {
            const prev = merged.get(tb.token.symbol) ?? { token: tb.token, qty: 0 };
            const qty = Number.parseFloat(tb.formattedBalance);
            merged.set(tb.token.symbol, { token: tb.token, qty: prev.qty + (Number.isFinite(qty) ? qty : 0) });
          }
        }

        const mergedBalances: TokenBalance[] = Array.from(merged.values()).map(({ token, qty }) => ({
          token,
          balance: 0n,
          formattedBalance: qty.toString(),
          usdValue: undefined,
        }));

        setTokenBalances(mergedBalances);
        const symbols = getAllSupportedTokens().map(t => t.symbol);
        const latestPrices = await tokenService.getTokenPrices(symbols);
        setPrices(latestPrices);
      } catch (error) {
        console.error('Error fetching token balances:', error);
        setTokenBalances([]);
      } finally {
        setIsLoadingTokens(false);
      }
    };

    fetchTokenBalances();

    // Refresh every 30 seconds
    const interval = setInterval(fetchTokenBalances, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  const rows = useMemo(() => {


    if (tokenBalances.length === 0) {
      // Fallback to supported tokens with zero balances
      return getAllSupportedTokens().map((token): TokenAssetData => {
        const priceUsd = prices[token.symbol]?.usd ?? (token.symbol === 'USDC' ? 1.0 : 1.07);
        return {
          name: `${token.name} (${token.symbol})`,
          ticker: token.symbol,
          price: `$${priceUsd.toFixed(2)}`,
          change: '+0.00%',
          balance: '0.00',
          value: '$0.00',
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
        change: '+0.00%',
        balance: `${qty.toFixed(2)} ${tokenBalance.token.symbol}`,
        value: `$${value.toFixed(2)}`,
        icon: tokenBalance.token.icon || DEFAULT_TOKEN_ICON,
      };
    });
  }, [tokenBalances, prices, activeTab]);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('tokens')}
            className={`text-xl font-bold transition-colors ${activeTab === 'tokens' ? 'text-[#E6EEF3]' : 'text-[#A7B4C8] hover:text-white'}`}
          >
            My Assets
          </button>

        </div>
      </div>
      <div className="mt-4 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table className="min-w-full">
              <thead className="text-left text-xs font-semibold uppercase text-[#A7B4C8]">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 sm:pl-0">Asset</th>
                  <th scope="col" className="px-3 py-3.5">Price</th>
                  <th scope="col" className="px-3 py-3.5">Balance</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-0">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rows.map((asset) => (
                  <tr key={asset.name}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-0">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 bg-white/5 rounded-full flex items-center justify-center overflow-hidden">
                          {asset.icon && (asset.icon.startsWith('http') || asset.icon.startsWith('/')) ? (
                            <img className="h-10 w-10 object-cover" src={asset.icon} alt={`${asset.name} logo`} />
                          ) : (
                            <span className="text-xs font-bold text-[#A7B4C8]">{asset.ticker.slice(0, 2)}</span>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-[#E6EEF3]">{asset.name}</div>
                          <div className="text-[#A7B4C8]">{asset.ticker}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <>
                        <div className="text-slate-100">{asset.price}</div>
                        <div className="text-green-400">{asset.change}</div>
                      </>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-300">{asset.balance}</td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                      <div className="text-slate-100">{asset.value}</div>
                    </td>
                  </tr>
                ))}
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
}

// SmartAccount panel removed

const DashboardHome: React.FC<DashboardHomeProps> = ({ onNavigate, balanceDisplay, isLoading, lastUpdated, error, onRefresh, isRefreshing, isHidden, toggleHidden }) => (
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
    <AssetsTable balanceDisplay={balanceDisplay} isLoading={isLoading} />
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

  // Get address from self-custodial context first, fall back to legacy wallet
  const { address: selfCustodialAddress, lockWallet } = useSelfCustodialWallet();
  const { address: legacyAddress, sessionKey } = useWallet();
  const address = selfCustodialAddress || legacyAddress;

  const { snapshot, formattedBalance, isLoading: isAccountLoading, error: accountError, refresh, lastUpdated } = useArcAccount();

  const { activities: transactions } = useActivity();
  const isLoadingTransactions = false;

  // State for total balance from all tokens
  const [totalBalance, setTotalBalance] = useState<string | null>(null);
  const [isLoadingTotalBalance, setIsLoadingTotalBalance] = useState(false);

  // Calculate total balance from all tokens
  useEffect(() => {
    const calculateTotalBalance = async () => {
      if (!address) {
        setTotalBalance(null);
        return;
      }

      setIsLoadingTotalBalance(true);
      try {
        const tokenBalances = await tokenService.getAllTokenBalances(address, 'testnet', 'arcTestnet');
        const symbols = getAllSupportedTokens().map(t => t.symbol);
        const prices = await tokenService.getTokenPrices(symbols);

        let total = 0;
        for (const tb of tokenBalances) {
          const qty = parseFloat(tb.formattedBalance);
          const priceUsd = prices[tb.token.symbol]?.usd ?? (tb.token.symbol === 'USDC' ? 1.0 : 1.07);
          total += qty * priceUsd;
        }

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
  }, [address, formattedBalance]);

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
      case 'Transactions':
        return null;
      case 'Multi-Sig':
        return <MultiSigDashboard />;
      case 'Faucet':
        return <Faucet />;
      case 'Agent':
        return <AgentScreen onExecuteIntent={handleAgentIntent} />;
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
          />
        );
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#091325] text-white">
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
            <div className="w-full p-8 overflow-y-auto">{renderPageContent()}</div>
          )}
        </div>
      </main>
    </div>
  );
};

export default WalletDashboard;
