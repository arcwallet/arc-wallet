import React, { useState, useEffect, useMemo } from 'react';
import { usePasskeyAccount } from '../contexts/PasskeyAccountContext';
import { useActivity } from '../contexts/ActivityContext';
import { useSession } from '../contexts/SessionContext';
import { usycService, USYCBalance, USYCQuote, TreasuryAllocation } from '../services/usycService';
import { treasuryPolicyService, UserRole, PolicyValidationResult } from '../services/treasuryPolicyService';
import { treasuryMultiSigService } from '../services/treasuryMultiSigService';
import { TransactionStatus, TransactionType } from '../types';
import { TX_EXPLORER_URL } from '../config/app.config';
import { SpinnerIcon, RefreshIcon, VerifiedIcon, SettingsIcon } from './Icons';
import TreasurySettings from './TreasurySettings';
import TreasuryApprovals from './TreasuryApprovals';

// Treasury Icon
const TreasuryIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </svg>
);

// Yield Icon
const YieldIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

// Chart Icon
const ChartIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
    <path d="M22 12A10 10 0 0 0 12 2v10z" />
  </svg>
);

interface AllocationChartProps {
  allocation: TreasuryAllocation;
}

const AllocationChart: React.FC<AllocationChartProps> = ({ allocation }) => {
  const liquidAngle = (allocation.liquid / 100) * 360;
  const yieldAngle = (allocation.yield / 100) * 360;

  // SVG arc calculation
  const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
  };

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Background circle */}
          <circle cx="50" cy="50" r="40" fill="#1e293b" />
          {/* USDC (Liquid) - Blue */}
          {allocation.liquid > 0 && (
            <path
              d={describeArc(50, 50, 40, 0, liquidAngle)}
              fill="#3b82f6"
              className="transition-all duration-500"
            />
          )}
          {/* USYC (Yield) - Emerald */}
          {allocation.yield > 0 && (
            <path
              d={describeArc(50, 50, 40, liquidAngle, liquidAngle + yieldAngle)}
              fill="#10b981"
              className="transition-all duration-500"
            />
          )}
          {/* Center hole */}
          <circle cx="50" cy="50" r="25" fill="#0f172a" />
          {/* Center text */}
          <text x="50" y="47" textAnchor="middle" className="fill-white text-xs font-bold">
            ${allocation.totalValue.toLocaleString()}
          </text>
          <text x="50" y="58" textAnchor="middle" className="fill-slate-400 text-[8px]">
            Total Value
          </text>
        </svg>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-slate-300 text-sm">USDC (Liquid)</span>
          <span className="text-white font-semibold ml-auto">{allocation.liquid}%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-slate-300 text-sm">USYC (Yield)</span>
          <span className="text-white font-semibold ml-auto">{allocation.yield}%</span>
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
  const { manager: passkeyManager, address: walletAddress, isConnected } = usePasskeyAccount();
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

  // Fetch quote and validate policy when amount changes
  useEffect(() => {
    const fetchQuoteAndValidate = async () => {
      if (!amount || parseFloat(amount) <= 0) {
        setQuote(null);
        setPolicyValidation(null);
        return;
      }

      setLoading(true);
      try {
        // Fetch quote
        const q = isSubscribe
          ? await usycService.getSubscribeQuote(amount)
          : await usycService.getRedeemQuote(amount);
        setQuote(q);

        // Validate against policy
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
    if (!quote || !passkeyManager || !walletAddress || !isConnected) {
      setError('Wallet not connected');
      return;
    }

    setExecuting(true);
    setError(null);
    setTxHash(null);

    try {
      const hash = isSubscribe
        ? await usycService.subscribe(amount, passkeyManager)
        : await usycService.redeem(amount, passkeyManager);

      setTxHash(hash);

      // Add to activity
      addActivity({
        id: hash,
        type: TransactionType.Contract,
        description: isSubscribe
          ? `Subscribed ${amount} USDC to USYC`
          : `Redeemed ${amount} USYC to USDC`,
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
    <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-500/50 p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        {isSubscribe ? (
          <>
            <YieldIcon size={20} className="text-emerald-400" />
            Subscribe (USDC to USYC)
          </>
        ) : (
          <>
            <YieldIcon size={20} className="text-blue-400" />
            Redeem (USYC to USDC)
          </>
        )}
      </h3>

      {/* Amount Input */}
      <div className="mb-4">
        <label className="text-slate-400 text-sm mb-2 block">Amount ({inputToken})</label>
        <div className="flex items-center gap-2 bg-slate-900/40 border border-slate-500/30 p-3 rounded-lg">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="bg-transparent text-white text-xl font-bold w-full outline-none placeholder:text-slate-600"
          />
          <button
            onClick={handleMaxClick}
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold px-2 py-1 bg-blue-500/10 rounded"
          >
            MAX
          </button>
          <span className="text-slate-400 font-semibold">{inputToken}</span>
        </div>
        <p className="text-slate-500 text-xs mt-1">
          Available: {parseFloat(maxAmount).toLocaleString()} {inputToken}
        </p>
      </div>

      {/* Output Preview */}
      <div className="mb-4">
        <label className="text-slate-400 text-sm mb-2 block">You will receive</label>
        <div className="flex items-center gap-2 bg-slate-800/40 border border-slate-600/30 p-3 rounded-lg">
          <div className="text-white text-xl font-bold w-full">
            {loading ? (
              <SpinnerIcon size={20} />
            ) : quote ? (
              parseFloat(quote.outputAmount).toLocaleString()
            ) : (
              '0.00'
            )}
          </div>
          <span className="text-slate-400 font-semibold">{outputToken}</span>
        </div>
      </div>

      {/* Quote Details */}
      {quote && (
        <div className="mb-4 p-3 bg-slate-900/40 border border-slate-500/30 rounded-lg text-sm">
          <div className="flex justify-between text-slate-400 mb-1">
            <span>Rate</span>
            <span>1 {inputToken} = {quote.rate} {outputToken}</span>
          </div>
          <div className="flex justify-between text-slate-400 mb-1">
            <span>Price per USYC</span>
            <span>${quote.pricePerShare}</span>
          </div>
          {isSubscribe && (
            <div className="flex justify-between text-emerald-400">
              <span>Est. APY</span>
              <span>~5.0%</span>
            </div>
          )}
        </div>
      )}

      {/* Policy Validation */}
      {policyValidation && !policyValidation.allowed && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400 font-semibold">Politika Uyarısı</p>
          <p className="text-sm text-red-400 mt-1">{policyValidation.reason}</p>
        </div>
      )}

      {policyValidation && policyValidation.allowed && policyValidation.requiresApproval && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-sm text-yellow-400 font-semibold">Onay Gerekli</p>
          <p className="text-sm text-yellow-400 mt-1">
            Bu işlem {policyValidation.requiredSignatures} imza gerektiriyor.
          </p>
        </div>
      )}

      {policyValidation?.warnings && policyValidation.warnings.length > 0 && (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          {policyValidation.warnings.map((warning, idx) => (
            <p key={idx} className="text-sm text-blue-400">{warning}</p>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Success */}
      {txHash && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <p className="text-sm text-emerald-400">
            Transaction submitted!{' '}
            <a
              href={`${TX_EXPLORER_URL}${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-emerald-300"
            >
              View on Explorer
            </a>
          </p>
        </div>
      )}

      {/* Execute Button */}
      <button
        onClick={handleExecute}
        disabled={!quote || executing || loading || !isConnected || (policyValidation && !policyValidation.allowed)}
        className={`w-full py-3 rounded-lg font-bold text-lg transition-all ${
          !quote || executing || !isConnected || (policyValidation && !policyValidation.allowed)
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
            : isSubscribe
            ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]'
            : 'bg-blue-500 hover:bg-blue-400 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]'
        }`}
      >
        {executing ? 'İşleniyor...' :
         policyValidation?.requiresApproval ? `Onay Talebi Oluştur (${policyValidation.requiredSignatures} imza)` :
         isSubscribe ? 'Subscribe to USYC' : 'Redeem to USDC'}
      </button>
    </div>
  );
};

interface TreasuryHistoryItem {
  type: 'subscribe' | 'redeem';
  amount: string;
  token: string;
  timestamp: Date;
  hash: string;
  status: 'completed' | 'pending' | 'failed';
}

const TreasuryHistory: React.FC<{ activities: any[] }> = ({ activities }) => {
  // Filter treasury-related activities
  const treasuryActivities = useMemo(() => {
    return activities
      .filter((a) => a.description?.includes('USYC') || a.description?.includes('Subscribe') || a.description?.includes('Redeem'))
      .slice(0, 10);
  }, [activities]);

  if (treasuryActivities.length === 0) {
    return (
      <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-500/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Treasury Activity</h3>
        <div className="text-center py-8">
          <TreasuryIcon size={48} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No treasury activity yet</p>
          <p className="text-slate-500 text-sm mt-1">Subscribe to USYC to start earning yield</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-500/50 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Treasury Activity</h3>
      <div className="divide-y divide-slate-700/50">
        {treasuryActivities.map((activity, index) => (
          <div key={activity.id || index} className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                activity.description?.includes('Subscribe') ? 'bg-emerald-500/10' : 'bg-blue-500/10'
              }`}>
                <YieldIcon
                  size={16}
                  className={activity.description?.includes('Subscribe') ? 'text-emerald-400' : 'text-blue-400'}
                />
              </div>
              <div>
                <p className="text-white text-sm font-medium">{activity.description}</p>
                <p className="text-slate-500 text-xs">{activity.timestamp}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-semibold text-sm ${
                activity.description?.includes('Subscribe') ? 'text-emerald-400' : 'text-blue-400'
              }`}>
                {activity.amount?.toFixed(2)} {activity.currency}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TreasuryScreen: React.FC = () => {
  const { address: walletAddress, isConnected } = usePasskeyAccount();
  const { activities } = useActivity();
  const { currentEmail, userId } = useSession();

  const [balance, setBalance] = useState<USYCBalance | null>(null);
  const [allocation, setAllocation] = useState<TreasuryAllocation | null>(null);
  const [isAllowlisted, setIsAllowlisted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Varsayılan olarak admin rolü (gerçek uygulamada backend'den alınmalı)
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

      // Update pending count
      const pending = await treasuryMultiSigService.getPendingTransactions(walletAddress);
      setPendingCount(pending.length);
    } catch (error) {
      console.error('Error fetching treasury data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <TreasuryIcon size={64} className="text-slate-600 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Treasury Management</h2>
        <p className="text-slate-400">Connect your wallet to access treasury features</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <SpinnerIcon size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <TreasuryIcon size={28} className="text-emerald-400" />
            Treasury Management
          </h2>
          <p className="text-slate-400 mt-1">Manage your yield-bearing assets with USYC</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
          >
            <SettingsIcon size={16} />
            Ayarlar
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
          >
            <RefreshIcon size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Allowlist Warning */}
      {isAllowlisted === false && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <p className="text-yellow-400 font-semibold">Allowlist Required</p>
          <p className="text-yellow-400/80 text-sm mt-1">
            Your wallet needs to be allowlisted to interact with USYC. Contact Circle/Hashnote support to request access.
          </p>
        </div>
      )}

      {/* Allowlist Verified */}
      {isAllowlisted === true && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3">
          <VerifiedIcon size={20} className="text-emerald-400" />
          <div>
            <p className="text-emerald-400 font-semibold">Allowlist Verified</p>
            <p className="text-emerald-400/80 text-sm">Your wallet is approved for USYC operations</p>
          </div>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Total Value */}
        <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-500/50 p-5">
          <p className="text-slate-400 text-sm mb-1">Total Treasury Value</p>
          <p className="text-3xl font-bold text-white">${balance?.totalValueUsdc || '0.00'}</p>
        </div>

        {/* USDC Balance */}
        <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-blue-500/30 p-5">
          <p className="text-slate-400 text-sm mb-1">USDC (Liquid)</p>
          <p className="text-2xl font-bold text-blue-400">
            {parseFloat(balance?.usdcFormatted || '0').toLocaleString()} USDC
          </p>
        </div>

        {/* USYC Balance */}
        <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-emerald-500/30 p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-slate-400 text-sm">USYC (Yield-Bearing)</p>
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
              ~{balance?.apy || '5.0'}% APY
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            {parseFloat(balance?.usycFormatted || '0').toLocaleString()} USYC
          </p>
          <p className="text-slate-500 text-xs mt-1">
            ≈ ${balance?.usycValueInUsdc || '0.00'} USD
          </p>
        </div>
      </div>

      {/* Allocation & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Allocation Chart */}
        <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-500/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ChartIcon size={20} className="text-slate-400" />
            Treasury Allocation
          </h3>
          {allocation && <AllocationChart allocation={allocation} />}
          <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
            <p className="text-slate-400 text-xs">
              <strong className="text-slate-300">Recommendation:</strong> Keep at least 20% in USDC for operational liquidity. USYC earns yield from US Treasury Bills via Hashnote.
            </p>
          </div>
        </div>

        {/* Yield Info */}
        <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-500/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <YieldIcon size={20} className="text-emerald-400" />
            Yield Information
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
              <span className="text-slate-400">Current APY</span>
              <span className="text-emerald-400 font-bold text-xl">~{balance?.apy || '5.0'}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
              <span className="text-slate-400">Yield Earned</span>
              <span className="text-emerald-400 font-semibold">${balance?.yieldEarned || '0.00'}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
              <span className="text-slate-400">Underlying Asset</span>
              <span className="text-slate-300">US Treasury Bills</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
              <span className="text-slate-400">Provider</span>
              <span className="text-slate-300">Hashnote</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {balance && (
          <>
            <ActionPanel type="subscribe" balance={balance} onSuccess={handleRefresh} userEmail={userEmail} userRole={userRole} />
            <ActionPanel type="redeem" balance={balance} onSuccess={handleRefresh} userEmail={userEmail} userRole={userRole} />
          </>
        )}
      </div>

      {/* Pending Approvals */}
      {walletAddress && (
        <div className="mb-6">
          <TreasuryApprovals
            walletAddress={walletAddress}
            userId={currentUserId}
            userEmail={userEmail}
            userRole={userRole}
            onTransactionApproved={handleRefresh}
          />
        </div>
      )}

      {/* History */}
      <TreasuryHistory activities={activities} />

      {/* Treasury Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <SettingsIcon size={24} className="text-slate-400" />
                Treasury Politika Ayarları
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <TreasurySettings userRole={userRole} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TreasuryScreen;
