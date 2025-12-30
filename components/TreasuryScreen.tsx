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
        className="text-[#5C6370] hover:text-[#9CA3AF] transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1A2235] border border-white/[0.1] rounded-lg text-xs text-[#E5E7EB] whitespace-nowrap z-50 shadow-xl">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1A2235]" />
        </div>
      )}
    </div>
  );
};

// Compact Allocation Bar (replaces pie chart)
const AllocationBar: React.FC<{ allocation: TreasuryAllocation }> = ({ allocation }) => {
  const hasYield = allocation.yield > 0;
  const hasLiquid = allocation.liquid > 0;

  return (
    <div className="space-y-3">
      {/* Stacked bar with metallic look */}
      <div className="h-2 bg-[#1E293B] rounded-full overflow-hidden flex relative">
        {/* Subtle overlay for metallic effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
        <div
          className="h-full bg-gradient-to-r from-[#E2E8F0] to-[#94A3B8] transition-all duration-500"
          style={{ width: `${allocation.liquid}%` }}
        />
        <div
          className="h-full bg-gradient-to-r from-[#3A7ACC] to-[#4A9EFF] opacity-70 transition-all duration-500"
          style={{ width: `${allocation.yield}%` }}
        />
      </div>

      {/* Legend - square indicators for modern look */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-[#E2E8F0] to-[#94A3B8]" />
          <span className={hasLiquid ? 'text-[#E5E7EB] font-medium' : 'text-[#6B7280]'}>USDC</span>
          <span className={hasLiquid ? 'text-[#9CA3AF]' : 'text-[#4B5563]'}>{allocation.liquid}%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#4A9EFF] opacity-70" />
          <span className={hasYield ? 'text-[#E5E7EB] font-medium' : 'text-[#6B7280]'}>USYC</span>
          <span className={hasYield ? 'text-[#9CA3AF]' : 'text-[#4B5563]'}>{allocation.yield}%</span>
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
    <div className="bg-[#0D1321] backdrop-blur-sm rounded-xl border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-[#E5E7EB]">
          {isSubscribe ? 'USDC' : 'USYC'} <span className="text-[#6B7280]">→</span> {isSubscribe ? 'USYC' : 'USDC'}
        </h3>
        <span className="text-xs text-[#6B7280] uppercase tracking-wider">
          {isSubscribe ? 'Subscribe' : 'Redeem'}
        </span>
      </div>

      {/* Amount Input */}
      <div className="mb-4">
        <div className="flex items-center gap-2 bg-[#0A0F1A] border border-[#1F2937] p-3 rounded-lg focus-within:border-[#4A9EFF]/50 focus-within:shadow-[0_0_12px_rgba(74,158,255,0.1)] transition-all">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="bg-transparent text-white text-lg font-medium w-full outline-none placeholder:text-[#4B5563]"
          />
          <button
            onClick={handleMaxClick}
            className="text-xs text-[#9CA3AF] hover:text-white font-medium px-2 py-1 bg-[#1F2937] hover:bg-[#374151] border border-[#374151] rounded transition-colors"
          >
            MAX
          </button>
          <span className="text-[#9CA3AF] text-sm font-medium">{inputToken}</span>
        </div>
        <p className="text-[#6B7280] text-[13px] mt-1.5">
          Available: {parseFloat(maxAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {inputToken}
        </p>
      </div>

      {/* Output Preview */}
      {quote && (
        <div className="mb-4 p-3 bg-[#0A0F1A] rounded-lg border border-white/[0.06]">
          <div className="flex items-center justify-between">
            <span className="text-[#6B7280] text-sm">You receive</span>
            <span className="text-white font-medium">
              {parseFloat(quote.outputAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {outputToken}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[#5C6370] text-xs">Rate</span>
            <span className="text-[#6B7280] text-xs">1:{quote.rate}</span>
          </div>
        </div>
      )}

      {/* Policy Warnings */}
      {policyValidation && !policyValidation.allowed && (
        <div className="mb-4 p-3 bg-[#1F2937]/50 border border-[#374151]/50 rounded-lg">
          <p className="text-xs text-[#F87171]">{policyValidation.reason}</p>
        </div>
      )}

      {policyValidation?.requiresApproval && (
        <div className="mb-4 p-3 bg-[#1F2937]/50 border border-[#374151]/50 rounded-lg">
          <p className="text-xs text-[#9CA3AF]">
            Requires {policyValidation.requiredSignatures} approval(s)
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-[#1F2937]/50 border border-[#374151]/50 rounded-lg">
          <p className="text-xs text-[#F87171]">{error}</p>
        </div>
      )}

      {/* Success */}
      {txHash && (
        <div className="mb-4 p-3 bg-[#4A9EFF]/5 border border-[#4A9EFF]/20 rounded-lg">
          <p className="text-xs text-[#93C5FD]">
            Submitted!{' '}
            <a href={`${TX_EXPLORER_URL}${txHash}`} target="_blank" rel="noreferrer" className="underline hover:text-white">
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
            ? 'bg-[#1F2937]/50 text-[#4B5563] cursor-not-allowed border border-[#374151]/50'
            : 'bg-gradient-to-r from-[#3B82F6] to-[#2563EB] text-white shadow-[0_4px_14px_rgba(59,130,246,0.3)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.4)]'
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
        <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-[0.1em]">Recent Activity</h3>
      </div>

      {treasuryActivities.length === 0 ? (
        <p className="text-[#4B5563] text-sm">No treasury transactions yet</p>
      ) : (
        <div className="space-y-1">
          {treasuryActivities.map((activity, index) => (
            <div key={activity.id || index} className="flex items-center justify-between py-2 hover:bg-white/[0.02] rounded-lg px-2 -mx-2 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg bg-[#1F2937] flex items-center justify-center">
                  <YieldIcon size={12} className="text-[#9CA3AF]" />
                </div>
                <div>
                  <p className="text-[#E5E7EB] text-sm">{activity.description}</p>
                  <p className="text-[#6B7280] text-xs">{activity.timestamp}</p>
                </div>
              </div>
              <span className="text-sm font-medium text-white">
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
        <TreasuryIcon size={48} className="text-[#A7B4C8] mb-4" />
        <h2 className="text-xl font-medium text-[#E6EEF3] mb-1">Treasury</h2>
        <p className="text-[#A7B4C8] text-sm">Connect wallet to continue</p>
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
              <span className="flex items-center gap-1.5 text-sm text-[#9CA3AF]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF]" />
                Verified
              </span>
            )}
          </div>
          <p className="text-[#9CA3AF] text-sm mt-1">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-[#6B7280] ml-2">total value</span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowRecovery(true)}
            className="p-2 text-[#6B7280] hover:text-[#E5E7EB] hover:bg-white/[0.05] rounded-lg transition-all duration-150"
            title="Wallet Recovery"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-[#6B7280] hover:text-[#E5E7EB] hover:bg-white/[0.05] rounded-lg transition-all duration-150"
            title="Settings"
          >
            <SettingsIcon size={20} />
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-[#6B7280] hover:text-[#E5E7EB] hover:bg-white/[0.05] rounded-lg transition-all duration-150"
            title="Refresh"
          >
            <RefreshIcon size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative bg-gradient-to-b from-[#0F1629] to-[#111827] backdrop-blur-sm rounded-2xl border border-white/[0.08] p-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] hover:border-white/[0.12] transition-colors duration-200">
        {/* Top highlight line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        {/* Balances Row */}
        <div className="grid grid-cols-2 gap-8 mb-6">
          {/* USDC */}
          <div>
            <p className="text-xs text-[#6B7280] uppercase tracking-[0.05em] mb-1">USDC (Liquid)</p>
            <p className={`text-[32px] font-bold ${usdcValue > 0 ? 'text-white' : 'text-[#4B5563]'}`}>
              {usdcValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          {/* USYC */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs text-[#6B7280] uppercase tracking-[0.05em]">USYC (Yield)</p>
              <span className="text-xs text-[#93C5FD] font-medium bg-[#4A9EFF]/[0.08] border border-[#4A9EFF]/20 px-2.5 py-0.5 rounded-md">
                {balance?.apy || '5.0'}% APY
              </span>
            </div>
            <p className={`text-[32px] font-bold ${usycValue > 0 ? 'text-white' : 'text-[#4B5563]'}`}>
              {usycValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Allocation Bar */}
        {allocation && <AllocationBar allocation={allocation} />}

        {/* Yield Stats */}
        <div className="mt-6 pt-6 border-t border-white/[0.06]">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[#6B7280]">Yield Earned</span>
              <span className={`font-medium ${yieldEarned > 0 ? 'text-[#4ADE80]' : 'text-[#6B7280]'}`}>
                ${yieldEarned.toFixed(2)}
              </span>
            </div>
            <div className="w-px h-4 bg-[#374151]" />
            <div className="flex items-center gap-2">
              <span className="text-[#6B7280]">Provider</span>
              <span className="text-[#9CA3AF] font-medium">Hashnote</span>
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative bg-gradient-to-b from-[#0F1629] to-[#0A0F1A] border border-white/[0.08] rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl">
            {/* Top highlight line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Treasury Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-[#6B7280] hover:text-[#E5E7EB] p-2 hover:bg-white/[0.05] rounded-lg transition-all"
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
