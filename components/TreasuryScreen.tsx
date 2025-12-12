import React, { useState, useEffect, useMemo } from 'react';
import { useCircleWallet } from '../contexts/CircleWalletContext';
import { useActivity } from '../contexts/ActivityContext';
import { useSession } from '../contexts/SessionContext';
import { usycService, USYCBalance, USYCQuote, TreasuryAllocation } from '../services/usycService';
import { treasuryPolicyService, UserRole, PolicyValidationResult } from '../services/treasuryPolicyService';
import { treasuryMultiSigService } from '../services/treasuryMultiSigService';
import { TransactionStatus, TransactionType } from '../types';
import { TX_EXPLORER_URL } from '../config/app.config';
import { SpinnerIcon, RefreshIcon, SettingsIcon } from './Icons';
import TreasurySettings from './TreasurySettings';
import TreasuryApprovals from './TreasuryApprovals';
// MultiPasskeyManager moved to MultiSigDashboard
import WalletRecovery from './WalletRecovery';

// Treasury Icon - Building/vault style
const TreasuryIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 21h18" />
    <path d="M5 21V7l7-4 7 4v14" />
    <path d="M9 21v-8h6v8" />
    <path d="M10 9h4" />
    <path d="M12 9v3" />
  </svg>
);

// Yield Icon - Trending up style
const YieldIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M23 6l-9.5 9.5-5-5L1 18" />
    <path d="M17 6h6v6" />
  </svg>
);

// Check Icon - Small verification
const CheckIcon = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

// Info Icon with tooltip trigger
const InfoTooltip = ({ content }: { content: string }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-slate-500 hover:text-slate-400 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 whitespace-nowrap z-50 shadow-lg">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
};

// Compact Allocation Bar (replaces pie chart)
const AllocationBar: React.FC<{ allocation: TreasuryAllocation }> = ({ allocation }) => {
  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="h-3 bg-slate-800 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
          style={{ width: `${allocation.liquid}%` }}
        />
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-500"
          style={{ width: `${allocation.yield}%` }}
        />
      </div>

      {/* Legend - inline */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span className="text-slate-400">USDC</span>
          <span className="text-slate-200 font-medium">{allocation.liquid}%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
          <span className="text-slate-400">USYC</span>
          <span className="text-slate-200 font-medium">{allocation.yield}%</span>
        </div>
      </div>
    </div>
  );
};

interface ActionPanelProps {
  type: 'subscribe' | 'redeem';
  balance: USYCBalance;
  onSuccess: () => void;
  userEmail: string;
  userRole: UserRole;
}

const ActionPanel: React.FC<ActionPanelProps> = ({ type, balance, onSuccess, userEmail, userRole }) => {
  const { sendTransaction, address: walletAddress, isConnected } = useCircleWallet();
  const { addActivity } = useActivity();

  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<USYCQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [policyValidation, setPolicyValidation] = useState<PolicyValidationResult | null>(null);

  const isSubscribe = type === 'subscribe';
  const maxAmount = isSubscribe ? balance.usdcFormatted : balance.usycFormatted;
  const inputToken = isSubscribe ? 'USDC' : 'USYC';
  const outputToken = isSubscribe ? 'USYC' : 'USDC';

  useEffect(() => {
    const fetchQuoteAndValidate = async () => {
      if (!amount || parseFloat(amount) <= 0) {
        setQuote(null);
        setPolicyValidation(null);
        return;
      }

      setLoading(true);
      try {
        const q = isSubscribe
          ? await usycService.getSubscribeQuote(amount)
          : await usycService.getRedeemQuote(amount);
        setQuote(q);

        if (walletAddress) {
          const validation = treasuryPolicyService.validateTransaction(
            isSubscribe ? 'subscribe' : 'redeem',
            parseFloat(amount),
            isSubscribe ? 'USDC' : 'USYC',
            userRole,
            userEmail,
            walletAddress,
            undefined,
            parseFloat(balance.usdcFormatted),
            parseFloat(balance.usycFormatted)
          );
          setPolicyValidation(validation);
        }
      } catch (err) {
        console.error('Error fetching quote:', err);
      } finally {
        setLoading(false);
      }
    };

    const timeout = setTimeout(fetchQuoteAndValidate, 500);
    return () => clearTimeout(timeout);
  }, [amount, isSubscribe, walletAddress, userRole, userEmail, balance]);

  const handleMaxClick = () => {
    setAmount(maxAmount);
  };

  const handleExecute = async () => {
    if (!quote || !walletAddress || !isConnected) {
      setError('Wallet not connected');
      return;
    }

    setExecuting(true);
    setError(null);
    setTxHash(null);

    try {
      const hash = isSubscribe
        ? await usycService.subscribe(amount, walletAddress)
        : await usycService.redeem(amount, walletAddress);

      setTxHash(hash);

      addActivity({
        id: hash,
        type: TransactionType.Contract,
        description: isSubscribe
          ? `Subscribed ${parseFloat(amount).toFixed(2)} USDC to USYC`
          : `Redeemed ${parseFloat(amount).toFixed(2)} USYC to USDC`,
        timestamp: 'Just now',
        date: new Date(),
        amount: parseFloat(amount),
        currency: inputToken,
        usdValue: parseFloat(amount),
        status: TransactionStatus.Pending,
        hash,
        from: walletAddress,
        to: walletAddress,
        networkFee: 0,
        approvals: { required: 0, list: [] },
      });

      setAmount('');
      setQuote(null);
      onSuccess();
    } catch (err: any) {
      console.error('Transaction failed:', err);
      setError(err?.message || 'Transaction failed');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="bg-slate-900/40 rounded-xl border border-slate-700/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium text-slate-200">
          {isSubscribe ? 'USDC → USYC' : 'USYC → USDC'}
        </h3>
        <span className="text-xs text-slate-500 uppercase tracking-wide">
          {isSubscribe ? 'Subscribe' : 'Redeem'}
        </span>
      </div>

      {/* Amount Input */}
      <div className="mb-4">
        <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-600/40 p-3 rounded-lg">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="bg-transparent text-white text-lg font-medium w-full outline-none placeholder:text-slate-600"
          />
          <button
            onClick={handleMaxClick}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium px-2 py-1 bg-cyan-500/10 rounded transition-colors"
          >
            MAX
          </button>
          <span className="text-slate-400 text-sm font-medium">{inputToken}</span>
        </div>
        <p className="text-slate-500 text-xs mt-1.5">
          Available: {parseFloat(maxAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {inputToken}
        </p>
      </div>

      {/* Output Preview */}
      {quote && (
        <div className="mb-4 p-3 bg-slate-800/40 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">You receive</span>
            <span className="text-white font-medium">
              {parseFloat(quote.outputAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {outputToken}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-slate-500 text-xs">Rate</span>
            <span className="text-slate-400 text-xs">1:{quote.rate}</span>
          </div>
        </div>
      )}

      {/* Policy Warnings */}
      {policyValidation && !policyValidation.allowed && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-xs text-red-400">{policyValidation.reason}</p>
        </div>
      )}

      {policyValidation?.requiresApproval && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-xs text-amber-400">
            Requires {policyValidation.requiredSignatures} approval(s)
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Success */}
      {txHash && (
        <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
          <p className="text-xs text-cyan-400">
            Submitted!{' '}
            <a href={`${TX_EXPLORER_URL}${txHash}`} target="_blank" rel="noreferrer" className="underline">
              View tx
            </a>
          </p>
        </div>
      )}

      {/* Execute Button */}
      <button
        onClick={handleExecute}
        disabled={!quote || executing || loading || !isConnected || (policyValidation && !policyValidation.allowed)}
        className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all ${
          !quote || executing || !isConnected || (policyValidation && !policyValidation.allowed)
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
            : isSubscribe
            ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
            : 'bg-blue-600 hover:bg-blue-500 text-white'
        }`}
      >
        {executing ? 'Processing...' : loading ? 'Loading...' :
         policyValidation?.requiresApproval ? 'Request Approval' :
         isSubscribe ? 'Convert to USYC' : 'Convert to USDC'}
      </button>
    </div>
  );
};

// Compact History (single line empty state)
const TreasuryHistory: React.FC<{ activities: any[] }> = ({ activities }) => {
  const treasuryActivities = useMemo(() => {
    return activities
      .filter((a) => a.description?.includes('USYC') || a.description?.includes('Subscribe') || a.description?.includes('Redeem'))
      .slice(0, 5);
  }, [activities]);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-300 uppercase tracking-wide">Recent Activity</h3>
      </div>

      {treasuryActivities.length === 0 ? (
        <p className="text-slate-500 text-sm">No treasury transactions yet</p>
      ) : (
        <div className="space-y-2">
          {treasuryActivities.map((activity, index) => (
            <div key={activity.id || index} className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  activity.description?.includes('Subscribe') ? 'bg-cyan-500/10' : 'bg-blue-500/10'
                }`}>
                  <YieldIcon size={12} className={activity.description?.includes('Subscribe') ? 'text-cyan-400' : 'text-blue-400'} />
                </div>
                <div>
                  <p className="text-slate-200 text-sm">{activity.description}</p>
                  <p className="text-slate-500 text-xs">{activity.timestamp}</p>
                </div>
              </div>
              <span className={`text-sm font-medium ${
                activity.description?.includes('Subscribe') ? 'text-cyan-400' : 'text-blue-400'
              }`}>
                {activity.amount?.toFixed(2)} {activity.currency}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const TreasuryScreen: React.FC = () => {
  const { address: walletAddress, isConnected } = useCircleWallet();
  const { activities } = useActivity();
  const { currentEmail, userId } = useSession();

  const [balance, setBalance] = useState<USYCBalance | null>(null);
  const [allocation, setAllocation] = useState<TreasuryAllocation | null>(null);
  const [isAllowlisted, setIsAllowlisted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

  const userRole: UserRole = 'admin';
  const userEmail = currentEmail || 'user@arcwallet.network';
  const currentUserId = userId || userEmail;

  const fetchData = async () => {
    if (!walletAddress) return;

    try {
      const [balanceData, allocationData, allowlistStatus] = await Promise.all([
        usycService.getBalances(walletAddress),
        usycService.getTreasuryAllocation(walletAddress),
        usycService.checkAllowlist(walletAddress),
      ]);

      setBalance(balanceData);
      setAllocation(allocationData);
      setIsAllowlisted(allowlistStatus);
    } catch (error) {
      console.error('Error fetching treasury data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <TreasuryIcon size={48} className="text-slate-600 mb-4" />
        <h2 className="text-xl font-medium text-white mb-1">Treasury</h2>
        <p className="text-slate-400 text-sm">Connect wallet to continue</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <SpinnerIcon size={32} />
      </div>
    );
  }

  const totalValue = parseFloat(balance?.totalValueUsdc || '0');
  const usdcValue = parseFloat(balance?.usdcFormatted || '0');
  const usycValue = parseFloat(balance?.usycFormatted || '0');
  const yieldEarned = parseFloat(balance?.yieldEarned || '0');

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-medium text-white tracking-tight">Treasury</h1>
            {isAllowlisted && (
              <span className="flex items-center gap-1 text-xs text-cyan-400">
                <CheckIcon size={12} />
                Verified
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm mt-1">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-slate-500 ml-2">total value</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRecovery(true)}
            className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
            title="Wallet Recovery"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            title="Settings"
          >
            <SettingsIcon size={18} />
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshIcon size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
        {/* Balances Row */}
        <div className="grid grid-cols-2 gap-8 mb-6">
          {/* USDC */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">USDC (Liquid)</p>
            <p className="text-2xl font-medium text-slate-100">
              {usdcValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          {/* USYC */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs text-slate-500 uppercase tracking-wide">USYC (Yield)</p>
              <span className="text-xs text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                {balance?.apy || '5.0'}% APY
              </span>
            </div>
            <p className="text-2xl font-medium text-slate-100">
              {usycValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Allocation Bar */}
        {allocation && <AllocationBar allocation={allocation} />}

        {/* Yield Stats */}
        <div className="mt-6 pt-6 border-t border-slate-700/50">
          <div className="flex items-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Yield Earned</span>
              <span className="text-cyan-400 font-medium">
                ${yieldEarned.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Provider</span>
              <span className="text-slate-300">Hashnote</span>
              <InfoTooltip content="USYC is backed by US Treasury Bills" />
            </div>
          </div>
        </div>

        {/* Action Panels */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          {balance && (
            <>
              <ActionPanel type="subscribe" balance={balance} onSuccess={handleRefresh} userEmail={userEmail} userRole={userRole} />
              <ActionPanel type="redeem" balance={balance} onSuccess={handleRefresh} userEmail={userEmail} userRole={userRole} />
            </>
          )}
        </div>

        {/* Pending Approvals (only show if exists) */}
        {walletAddress && (
          <TreasuryApprovals
            walletAddress={walletAddress}
            userId={currentUserId}
            userEmail={userEmail}
            userRole={userRole}
            onTransactionApproved={handleRefresh}
          />
        )}

        {/* History */}
        <TreasuryHistory activities={activities} />
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden">
            <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">Treasury Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(85vh-70px)]">
              <TreasurySettings userRole={userRole} />
            </div>
          </div>
        </div>
      )}

      {/* Wallet Recovery Modal */}
      {showRecovery && walletAddress && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full">
            <WalletRecovery
              walletAddress={walletAddress}
              availableKeys={[
                { keyHash: '0x1234...', deviceName: "CEO's MacBook", role: 'ceo', isActive: true },
                { keyHash: '0x5678...', deviceName: "CFO's iPhone", role: 'cfo', isActive: true },
                { keyHash: '0x9abc...', deviceName: "CTO's MacBook", role: 'cto', isActive: true },
              ]}
              onRecoveryComplete={() => {
                setShowRecovery(false);
              }}
              onClose={() => setShowRecovery(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TreasuryScreen;
