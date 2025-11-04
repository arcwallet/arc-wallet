import React, { useMemo, useState } from 'react';
import SideNavBar from './SideNavBar';
import TransactionList from './TransactionList';
import TransactionDetail from './TransactionDetail';
import SendAssets from './SendAssets';
import ReceiveAssets from './ReceiveAssets';
import Settings from './Settings';
import MultiSigDashboard from './MultiSigDashboard';
import Faucet from './Faucet';
import Swap from './Swap';
import Bridge from './Bridge';
import { Transaction } from '../types';
import { useWallet } from '../contexts/WalletContext';
import { useArcAccount } from '../contexts/ArcAccountContext';
import { useSmartAccount } from '../contexts/SmartAccountContext';
import type { AccountSnapshot } from '../services/arcRpcClient';
import { formatBlockTime } from '../utils/format';
import { useActivity } from '../contexts/ActivityContext';
import {
  RefreshIcon,
  WalletIcon,
  NotificationIcon,
  LockIcon,
  VerifiedIcon,
  EyeOffIcon,
  SendIcon,
  ReceiveIcon
} from './Icons';

interface DashboardHeaderProps {
  account: AccountSnapshot | null;
  isRefreshing: boolean;
  onRefresh: () => Promise<void>;
  error: string | null;
}

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const notifications = [
    {
      id: 1,
      title: 'Transaction Completed',
      message: 'Your USDC transfer has been confirmed',
      time: '2 min ago',
      type: 'success'
    },
    {
      id: 2,
      title: 'New Device Added',
      message: 'iPhone 15 FaceID was added to your account',
      time: '1 hour ago',
      type: 'info'
    },
    {
      id: 3,
      title: 'Security Alert',
      message: 'Session key will expire in 24 hours',
      time: '3 hours ago',
      type: 'warning'
    }
  ];

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
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                    notification.type === 'success' ? 'bg-green-400' :
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
              <p className="text-sm text-[#A7B4C8]">No new notifications</p>
            </div>
          )}
        </div>
        <div className="p-3 border-t border-white/10">
          <button className="w-full text-sm text-[#9EBBE4] hover:text-[#B9D1ED] transition-colors">
            Mark all as read
          </button>
        </div>
      </div>
    </>
  );
};

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ account, isRefreshing, onRefresh, error }) => {
  const { address, logout } = useWallet();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const blockLabel = account?.latestBlock.finalized ? 'Finalized Block' : 'Latest Block';
  const lastUpdated = account ? formatBlockTime(account.latestBlock.timestamp) : '—';

  return (
    <header className="flex h-20 items-center justify-between gap-4 border-b border-white/10 px-8 py-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-[#E6EEF3]">Enterprise Treasury</h2>
        <button
          onClick={() => {
            void onRefresh();
          }}
          className="flex items-center justify-center rounded-md p-1.5 text-[#A7B4C8] hover:bg-[#151A22]"
          title="Refresh account snapshot"
          aria-live="polite"
        >
          <RefreshIcon size={16} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden lg:flex flex-col text-right">
          <p className="text-xs text-[#A7B4C8] uppercase tracking-wide">{blockLabel}</p>
          <p className="text-sm font-semibold text-[#E6EEF3]">{account ? `#${account.latestBlock.number.toLocaleString()}` : '—'}</p>
          <p className="text-xs text-[#A7B4C8]">{lastUpdated}</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-[#151A22] px-3 py-1.5">
          <div className="size-2 rounded-full bg-green-500" />
          <p className="text-sm font-medium text-[#A7B4C8]">Arc Testnet</p>
        </div>
        {address && (
          <div className="hidden sm:flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 border border-divider">
            <WalletIcon size={16} className="text-text-secondary" />
            <p className="text-sm font-mono text-text-secondary">{`${address.slice(0, 6)}...${address.slice(-4)}`}</p>
          </div>
        )}
        {error && <p className="hidden md:block text-sm text-accent-orange">{error}</p>}
        <div className="relative">
          <button
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            className="rounded-lg p-2 text-[#A7B4C8] hover:bg-[#151A22] transition-colors relative"
          >
            <NotificationIcon size={20} />
            {/* Notification badge */}
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-xs text-white font-bold">3</span>
            </span>
          </button>
          <NotificationDropdown
            isOpen={isNotificationOpen}
            onClose={() => setIsNotificationOpen(false)}
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
}

const BalanceOverview: React.FC<BalanceOverviewProps> = ({ onNavigate, balanceDisplay, isLoading, lastUpdated, error }) => {
  const displayBalance = balanceDisplay ?? '$0.00';
  const updatedAt = lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—';

  return (
    <div className="flex flex-col gap-6 rounded-xl bg-[#151A22] p-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-base font-medium text-[#A7B4C8]">Total Balance</p>
          <div className="flex items-center gap-4">
            <p className="text-4xl font-bold text-[#E6EEF3]">
              {isLoading ? <span className="animate-pulse text-[#A7B4C8]">Loading…</span> : displayBalance}
            </p>
            <div className="flex items-center gap-1.5">
              <p className="text-green-400 text-sm font-medium">Finalized</p>
              <VerifiedIcon size={16} className="text-green-400" />
            </div>
          </div>
          <p className="text-xs text-[#A7B4C8]">Synced at {updatedAt}</p>
          {error && <p className="text-sm text-accent-orange">{error}</p>}
        </div>
        <button className="p-2 text-[#A7B4C8] hover:bg-white/10 rounded-lg" title="Hide balance">
          <EyeOffIcon size={20} />
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

const AssetsTable: React.FC<AssetsTableProps> = ({ balanceDisplay, isLoading }) => {
  const rows = useMemo(
    () => [
      {
        name: 'USDC (Native)',
        ticker: 'USDC',
        price: '$1.00',
        change: '+0.00%',
        balance: balanceDisplay ?? '$0.00',
        value: balanceDisplay ?? '$0.00',
        icon: 'https://mintcdn.com/arc-docs/FYqE2_-PsObv0l4x/logo/Arc_Logo_FC.svg?fit=max&auto=format',
      },
    ],
    [balanceDisplay],
  );

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-[#E6EEF3]">My Assets</h3>
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
                        <div className="h-10 w-10 flex-shrink-0">
                          <img className="h-10 w-10 rounded-full" src={asset.icon} alt={`${asset.name} logo`} />
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-[#E6EEF3]">{asset.name}</div>
                          <div className="text-[#A7B4C8]">{asset.ticker}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <div className="text-[#E6EEF3]">{asset.price}</div>
                      <div className="text-green-400">{asset.change}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      {isLoading ? (
                        <span className="animate-pulse text-[#A7B4C8]">Loading…</span>
                      ) : (
                        <div className="text-[#E6EEF3]">{asset.balance}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                      {isLoading ? <span className="animate-pulse text-[#A7B4C8]">—</span> : asset.value}
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
}

const SmartAccountPanel: React.FC = () => {
  const {
    smartAccountAddress,
    ownerAddress,
    isDeploying,
    isAuthorising,
    isCheckingAuthorisation,
    isSessionAuthorised,
    authorisationExpiresAt,
    error,
    deploy,
    authoriseCurrentSession,
    clearError,
  } = useSmartAccount();
  const { sessionKey } = useWallet();

  const addressDisplay = smartAccountAddress
    ? `${smartAccountAddress.slice(0, 6)}...${smartAccountAddress.slice(-4)}`
    : 'Not deployed';
  const ownerDisplay = ownerAddress ? `${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)}` : 'Pending';

  const statusLabel = isCheckingAuthorisation
    ? 'Checking…'
    : isSessionAuthorised
      ? authorisationExpiresAt
        ? `Authorized until ${new Date(authorisationExpiresAt * 1000).toLocaleTimeString()}`
        : 'Authorized'
      : 'Not authorized';

  return (
    <div className="rounded-xl bg-[#151A22] p-6 mt-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#E6EEF3]">Smart Account</h3>
          {smartAccountAddress && <span className="text-xs text-[#A7B4C8] uppercase">Active</span>}
        </div>
        <p className="text-sm text-[#A7B4C8]">
          Deploy and manage the smart account contract that will execute on-chain actions using session keys.
        </p>
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0d182c] px-3 py-2 text-sm">
          <span className="text-[#A7B4C8]">Address</span>
          <span className="text-[#E6EEF3] font-mono">{addressDisplay}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0d182c] px-3 py-2 text-sm">
          <span className="text-[#A7B4C8]">Owner</span>
          <span className="text-[#E6EEF3] font-mono">{ownerDisplay}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0d182c] px-3 py-2 text-sm">
          <span className="text-[#A7B4C8]">Session Status</span>
          <span className={`font-medium ${isSessionAuthorised ? 'text-green-400' : 'text-accent-orange'}`}>
            {statusLabel}
          </span>
        </div>
        {error && (
          <div className="flex items-start justify-between rounded-lg bg-accent-orange/10 border border-accent-orange px-3 py-2 text-sm text-accent-orange">
            <span>{error}</span>
            <button onClick={clearError} className="text-xs uppercase">Dismiss</button>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={deploy}
            disabled={!sessionKey || isDeploying}
            className="flex-1 rounded-lg bg-primary text-primary-text h-11 font-semibold hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isDeploying ? 'Deploying…' : 'Deploy Account'}
          </button>
          <button
            onClick={() => authoriseCurrentSession()}
            disabled={!sessionKey || !smartAccountAddress || isAuthorising}
            className="flex-1 rounded-lg border border-[#2B3440] h-11 font-semibold text-[#E6EEF3] hover:bg-white/5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isAuthorising ? 'Authorising…' : 'Authorize Session Key'}
          </button>
        </div>
        {!sessionKey && <p className="text-xs text-[#A7B4C8]">Authenticate with your passkey to manage session keys.</p>}
        {sessionKey && smartAccountAddress && !isSessionAuthorised && !isAuthorising && (
          <p className="text-xs text-accent-orange">
            This session is not authorised yet. Authorise it to execute transactions through the smart account.
          </p>
        )}
      </div>
    </div>
  );
};

const DashboardHome: React.FC<DashboardHomeProps> = ({ onNavigate, balanceDisplay, isLoading, lastUpdated, error }) => (
  <>
    <BalanceOverview onNavigate={onNavigate} balanceDisplay={balanceDisplay} isLoading={isLoading} lastUpdated={lastUpdated} error={error} />
    <SmartAccountPanel />
    <AssetsTable balanceDisplay={balanceDisplay} isLoading={isLoading} />
  </>
);

const WalletDashboard: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('Dashboard');
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  const { address } = useWallet();
  const { snapshot, formattedBalance, isLoading: isAccountLoading, error: accountError, refresh, lastUpdated } = useArcAccount();

  const { activities: transactions } = useActivity();
  const isLoadingTransactions = false;

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
            balanceDisplay={formattedBalance}
            isLoading={isAccountLoading}
            lastUpdated={lastUpdated}
            error={accountError}
          />
        );
      case 'Send':
        return <SendAssets />;
      case 'Receive':
        return <ReceiveAssets />;
      case 'Swap':
        return <Swap />;
      case 'Bridge':
        return <Bridge />;
      case 'Transactions':
        return null;
      case 'Multi-Sig':
        return <MultiSigDashboard />;
      case 'Faucet':
        return <Faucet />;
      case 'Settings':
        return <Settings />;
      default:
        return (
          <DashboardHome
            onNavigate={handleNavigate}
            balanceDisplay={formattedBalance}
            isLoading={isAccountLoading}
            lastUpdated={lastUpdated}
            error={accountError}
          />
        );
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#091325] text-white">
      <SideNavBar currentPage={currentPage} onNavigate={handleNavigate} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader account={snapshot} isRefreshing={isAccountLoading} onRefresh={refresh} error={accountError} />
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
