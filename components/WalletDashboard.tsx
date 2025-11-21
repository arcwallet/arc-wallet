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
import IdentityScreen from './IdentityScreen';
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
      <div className="fixed inset-0 z-40" onClick={onClose} />
      {/* Dropdown */}
      <div className="absolute right-0 top-full mt-2 w-80 z-50 rounded-lg border border-white/10 bg-[#151A22] shadow-lg">
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

const DashboardHeader: React.FC<DashboardHeaderPropsWithNav> = ({ account, isRefreshing, onRefresh, error, onNavigate }) => {
  // Get address from self-custodial context first
  const { address: selfCustodialAddress, lockWallet } = useSelfCustodialWallet();
  const { address: legacyAddress, logout: legacyLogout } = useWallet();
  const address = selfCustodialAddress || legacyAddress;
  const logout = selfCustodialAddress ? lockWallet : legacyLogout;
  const { isPrivacyMode } = usePrivacy();

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [hasCopiedAddress, setHasCopiedAddress] = useState(false);
  const { activities } = useActivity();
  const blockLabel = account?.latestBlock.finalized ? 'Finalized Block' : 'Latest Block';
  const lastUpdated = account ? formatBlockTime(account.latestBlock.timestamp) : '—';

  return (
    <header className="flex h-20 items-center justify-between gap-4 border-b border-white/10 px-8 py-3">
      <div />
      <div className="flex items-center gap-4">
        <div className="hidden lg:flex flex-col text-right">
          <p className="text-xs text-[#A7B4C8] uppercase tracking-wide">{blockLabel}</p>
          <p className="text-sm font-semibold text-[#E6EEF3]">{isRefreshing ? <ShimmerBar width="70px" /> : account ? `#${account.latestBlock.number.toLocaleString()}` : '—'}</p>
          <p className="text-xs text-[#A7B4C8]">{isRefreshing ? <ShimmerBar width="60px" /> : lastUpdated}</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-[#151A22] px-3 py-1.5">
          <div className="size-2 rounded-full bg-green-500" />
          <p className="text-sm font-medium text-[#A7B4C8]">Arc Testnet</p>
        </div>
        {isPrivacyMode && (
          <div className="flex items-center gap-2 rounded-lg bg-purple-500/10 border border-purple-500/30 px-3 py-1.5">
            <LockIcon size={14} className="text-purple-400" />
            <p className="text-sm font-medium text-purple-400">Privacy Mode</p>
          </div>
        )}
        {address && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(address);
              setHasCopiedAddress(true);
              setTimeout(() => setHasCopiedAddress(false), 2000);
            }}
            className="hidden sm:flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 border border-divider text-left hover:bg-white/10 transition-colors"
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
    <div className="flex flex-col gap-6 rounded-xl bg-[#151A22] p-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-base font-medium text-[#A7B4C8]">Total Balance</p>
          <div className="flex items-center gap-4">
            <p className="text-4xl font-bold text-[#E6EEF3] min-h-[44px]">
              {isLoading ? <ShimmerBar width="180px" /> : isHidden ? '••••••' : displayBalance}
            </p>
            <div className="flex items-center gap-1.5">
              <p className="text-green-400 text-sm font-medium">Finalized</p>
              <VerifiedIcon size={16} className="text-green-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#A7B4C8]">
            {isLoading ? <ShimmerBar width="110px" /> : `Synced at ${updatedAt}`}
            {!isLoading && (
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
          className="flex h-12 flex-1 items-center justify-center gap-2 px-5 text-base font-bold bg-primary text-primary-text rounded-lg shadow-lg hover:bg-primary/90 transition-colors"
        >
          <SendIcon size={20} />
          <span className="truncate">Send</span>
        </button>
        <button
          onClick={() => onNavigate('Receive')}
          className="flex h-12 flex-1 items-center justify-center gap-2 px-5 text-base font-bold bg-primary text-primary-text rounded-lg shadow-lg hover:bg-primary/90 transition-colors"
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

  const [activeTab, setActiveTab] = useState<'tokens' | 'rwa'>('tokens');
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
    if (activeTab === 'rwa') {
      // Mock RWA Data
      return [
        {
          name: 'BlackRock USD Inst. Digital Liquidity Fund',
          ticker: 'BUIDL',
          price: '$1.00',
          change: '+0.01%',
          balance: '0.00',
          value: '$0.00',
          icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/BlackRock_wordmark.svg/2560px-BlackRock_wordmark.svg.png',
        },
        {
          name: 'Ondo US Dollar Yield',
          ticker: 'USDY',
          price: '$1.05',
          change: '+0.02%',
          balance: '0.00',
          value: '$0.00',
          icon: 'https://images.crunchbase.com/image/upload/c_lpad,f_auto,q_auto:eco,dpr_1/v14/organization/logos/8f9b8e8e-8e8e-4e8e-8e8e-8e8e8e8e8e8e.png', // Placeholder
        }
      ];
    }

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
          <button
            onClick={() => setActiveTab('rwa')}
            className={`text-xl font-bold transition-colors ${activeTab === 'rwa' ? 'text-[#E6EEF3]' : 'text-[#A7B4C8] hover:text-white'}`}
          >
            Real World Assets
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
                          {asset.icon.startsWith('http') ? (
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
                      {isLoading || isLoadingTokens ? (
                        <div className="flex flex-col gap-1">
                          <ShimmerBar width="60px" />
                          <ShimmerBar width="40px" />
                        </div>
                      ) : (
                        <>
                          <div className="text-[#E6EEF3]">{asset.price}</div>
                          <div className={asset.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}>
                            {asset.change}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      {isLoading || isLoadingTokens ? (
                        <ShimmerBar width="80px" />
                      ) : (
                        <div className="text-[#E6EEF3]">{asset.balance}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                      {isLoading || isLoadingTokens ? <ShimmerBar width="90px" /> : asset.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {activeTab === 'rwa' && rows.length === 2 && (
              <div className="mt-8 p-6 bg-white/5 rounded-xl text-center">
                <p className="text-[#E6EEF3] font-medium mb-2">Start Investing in Real World Assets</p>
                <p className="text-[#A7B4C8] text-sm mb-4">Access tokenized treasuries, real estate, and private credit directly on Arc.</p>
                <button className="px-4 py-2 bg-primary text-primary-text rounded-lg font-medium hover:bg-primary/90 transition-colors">
                  Explore Market
                </button>
              </div>
            )}
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
        return <SendAssets />;
      case 'Receive':
        return <ReceiveAssets />;
      case 'Swap':
        return <SwapScreen />;
      case 'Bridge':
        return <Bridge />;
      case 'Transactions':
        return null;
      case 'Multi-Sig':
        return <MultiSigDashboard />;
      case 'Faucet':
        return <Faucet />;
      case 'Identity':
        return <IdentityScreen />;
      case 'Agent':
        return <AgentScreen />;
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
