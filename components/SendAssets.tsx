/**
 * Send Assets Component
 * Professional fintech-grade transfer interface
 * Design: Revolut/Wise/Mercury Bank quality
 */

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { isAddress, parseUnits, Interface } from 'ethers';
import { useArcAccount } from '../contexts/ArcAccountContext';
import { useCircleWallet } from '../contexts/CircleWalletContext';
import { useActivity } from '../contexts/ActivityContext';
import { usePrivacy } from '../contexts/PrivacyContext';
import { preparePrivateTransaction } from '../services/teeService';
import { formatUSDCAmount } from '../utils/format';
import { TransactionStatus, TransactionType } from '../types';
import { getAllSupportedTokens, TokenInfo, formatTokenAmount, getTokenContractAddress } from '../config/tokens';
import { tokenService } from '../services/tokenService';
import { TX_EXPLORER_URL } from '../config/app.config';
import { addressBookService } from '../services/addressBookService';

// ============================================
// LUCIDE-STYLE ICONS (SVG)
// ============================================

const ArrowLeftIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const ShieldCheckIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const WalletIcon = ({ size = 22, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
  </svg>
);

const ChevronDownIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const UserPlusIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="20" y1="8" x2="20" y2="14" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
);

const UsersIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const SendIcon = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const CheckCircleIcon = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const ZapIcon = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const Loader2Icon = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`animate-spin ${className}`}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const FileTextIcon = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const ExternalLinkIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const KeyIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const SearchIcon = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const XIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ClockIcon = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const StarIcon = ({ size = 12, className = '', filled = false }: { size?: number; className?: string; filled?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

// ============================================
// PROGRESS STEPS COMPONENT
// ============================================

const ProgressSteps: React.FC<{ currentStep: number }> = ({ currentStep }) => {
  const steps = ['Details', 'Review', 'Confirm'];

  return (
    <div className="flex items-center justify-center gap-3 my-6">
      {steps.map((step, index) => (
        <React.Fragment key={step}>
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                index < currentStep
                  ? 'bg-white'
                  : index === currentStep
                  ? 'bg-white'
                  : 'bg-[#374151] border border-[#4B5563]'
              }`}
            />
            <span
              className={`text-[11px] font-medium ${
                index <= currentStep ? 'text-white' : 'text-[#4B5563]'
              }`}
            >
              {step}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-14 h-0.5 -mt-4 ${
                index < currentStep ? 'bg-white' : 'bg-[#374151]'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

interface SendAssetsProps {
  initialAmount?: string;
  initialRecipient?: string;
  initialToken?: string;
  onBack?: () => void;
}

const SendAssets: React.FC<SendAssetsProps> = ({ initialAmount = '', initialRecipient = '', initialToken, onBack }) => {
  const { isLoading } = useArcAccount();

  const {
    isConnected: passkeyConnected,
    address: passkeyAddress,
    sendTransaction,
    sendTokenTransfer,
    refreshBalance,
  } = useCircleWallet();

  const { addActivity } = useActivity();
  const { isPrivacyMode } = usePrivacy();

  const walletAddress = passkeyAddress;

  const [amount, setAmount] = useState(initialAmount);
  const [recipient, setRecipient] = useState(initialRecipient);
  const [selectedToken, setSelectedToken] = useState<TokenInfo>(() => {
    const tokens = getAllSupportedTokens();
    if (initialToken) {
      const found = tokens.find(t => t.symbol.toUpperCase() === initialToken.toUpperCase());
      if (found) return found;
    }
    return tokens[0];
  });
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);

  // Address Book State
  const [showAddressBook, setShowAddressBook] = useState(false);
  const [addressBookSearch, setAddressBookSearch] = useState('');
  const [showSaveContact, setShowSaveContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactLabel, setNewContactLabel] = useState('');
  const addressBookRef = useRef<HTMLDivElement>(null);
  const tokenDropdownRef = useRef<HTMLDivElement>(null);

  // Get combined contacts and recent recipients
  const addressBookList = useMemo(() => {
    const list = addressBookService.getCombinedList();
    if (!addressBookSearch.trim()) return list;
    const query = addressBookSearch.toLowerCase();
    return list.filter(
      item => item.address.toLowerCase().includes(query) ||
              item.name?.toLowerCase().includes(query) ||
              item.label?.toLowerCase().includes(query)
    );
  }, [addressBookSearch, showAddressBook]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addressBookRef.current && !addressBookRef.current.contains(event.target as Node)) {
        setShowAddressBook(false);
      }
      if (tokenDropdownRef.current && !tokenDropdownRef.current.contains(event.target as Node)) {
        setShowTokenDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const balance = useMemo(() => parseFloat(tokenBalance) || 0, [tokenBalance]);

  const balanceLabel = useMemo(() => {
    const formatted = formatTokenAmount(BigInt(Math.floor(balance * (10 ** selectedToken.decimals))), selectedToken, {
      minimumFractionDigits: 2,
      showSymbol: true
    });
    return formatted.display;
  }, [balance, selectedToken]);

  const listAddresses = () => {
    const addresses: string[] = [];
    if (walletAddress) addresses.push(walletAddress);
    return addresses;
  };

  const fetchTotalBalance = async (symbol: string, addresses: string[]): Promise<number> => {
    const results: Array<number> = [];
    for (const addr of addresses) {
      try {
        const r = await tokenService.getTokenBalance(symbol, addr, 'testnet', 'arcTestnet');
        const val = r ? parseFloat(r.formattedBalance) : 0;
        if (Number.isFinite(val)) results.push(val);
      } catch (e) {
        // ignore
      }
    }
    return results.reduce((a, b) => a + b, 0);
  };

  const fetchTokenBalance = useCallback(async () => {
    const addresses = listAddresses();
    if (addresses.length === 0) {
      setTokenBalance('0');
      return;
    }
    try {
      const total = await fetchTotalBalance(selectedToken.symbol, addresses);
      setTokenBalance(total.toString());
    } catch (error) {
      setTokenBalance('0');
    }
  }, [selectedToken, walletAddress]);

  useEffect(() => {
    fetchTokenBalance();
  }, [fetchTokenBalance]);

  useEffect(() => {
    const chooseTokenWithBalance = async () => {
      const addresses = listAddresses();
      if (addresses.length === 0) return;
      try {
        const tokens = getAllSupportedTokens();
        let best: { token: TokenInfo; qty: number } | null = null;
        for (const t of tokens) {
          const qty = await fetchTotalBalance(t.symbol, addresses);
          if (!best || qty > best.qty) {
            best = { token: t, qty };
          }
        }
        if (best && best.qty > 0 && best.token.symbol !== selectedToken.symbol) {
          setSelectedToken(best.token);
          setTokenBalance(best.qty.toString());
        }
      } catch (e) {
        // ignore
      }
    };
    void chooseTokenWithBalance();
  }, [walletAddress]);

  const amountNumber = parseFloat(amount) || 0;
  const total = amountNumber;
  const isRecipientValid = recipient ? isAddress(recipient) : false;
  const canSubmit = passkeyConnected && isRecipientValid && amountNumber > 0 && amountNumber <= balance && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passkeyConnected) {
      setSubmitError('Please connect your passkey wallet.');
      return;
    }
    if (!walletAddress) {
      setSubmitError('Wallet address not available.');
      return;
    }
    if (!isRecipientValid) {
      setSubmitError('Recipient address is not valid.');
      return;
    }
    if (amountNumber <= 0) {
      setSubmitError('Enter an amount greater than zero.');
      return;
    }
    if (amountNumber > balance) {
      setSubmitError('Amount exceeds available balance.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setTxHash(null);

    try {
      if (isPrivacyMode) {
        try {
          const amountWei = parseUnits(amount, selectedToken.decimals);
          const contractAddress = selectedToken.symbol !== 'ETH'
            ? getTokenContractAddress(selectedToken.symbol, 'testnet', 'arcTestnet')
            : '0x0000000000000000000000000000000000000000';

          const privateData = await preparePrivateTransaction(
            amountWei,
            recipient,
            contractAddress || undefined
          );
          console.log('[TEE] Private Transaction (Simulation):', privateData);
        } catch (teeError) {
          console.error('TEE Privacy preparation failed:', teeError);
          setSubmitError('Privacy Mode preparation failed. Please try again.');
          setIsSubmitting(false);
          return;
        }
      }

      let to: string;
      let value: string;
      let data: string = '0x';

      if (selectedToken.symbol !== 'ETH') {
        const tokenAddress = getTokenContractAddress(selectedToken.symbol, 'testnet', 'arcTestnet');
        if (!tokenAddress) {
          throw new Error(`Token contract address not found for ${selectedToken.symbol}`);
        }

        const iface = new Interface(['function transfer(address to, uint256 amount) returns (bool)']);
        const amountWei = parseUnits(amount, selectedToken.decimals);
        data = iface.encodeFunctionData('transfer', [recipient, amountWei]);
        to = tokenAddress;
        value = '0';
      } else {
        to = recipient;
        value = parseUnits(amount, selectedToken.decimals).toString();
      }

      let hash: string;
      if (selectedToken.symbol !== 'ETH') {
        const tokenAddress = getTokenContractAddress(selectedToken.symbol, 'testnet', 'arcTestnet');
        hash = await sendTokenTransfer({
          tokenAddress: tokenAddress!,
          to: recipient,
          amount: amount,
          decimals: selectedToken.decimals,
        });
      } else {
        hash = await sendTransaction({
          to: recipient,
          value: BigInt(value),
        });
      }

      setTxHash(hash);
      addressBookService.recordRecipient(recipient, amount, selectedToken.symbol);
      refreshBalance();
      setTimeout(() => fetchTokenBalance(), 1500);

      addActivity({
        id: hash,
        type: TransactionType.Sent,
        description: `Sent ${amountNumber.toFixed(4)} ${selectedToken.symbol}`,
        timestamp: 'Just now',
        date: new Date(),
        amount: -amountNumber,
        currency: selectedToken.symbol,
        usdValue: -amountNumber * (selectedToken.currentPrice || 1),
        status: TransactionStatus.Completed,
        hash,
        from: walletAddress,
        to: recipient,
        networkFee: 0,
        approvals: { required: 0, list: [] },
      });
    } catch (error: any) {
      console.error('[SEND] Transaction failed:', error);
      const message = typeof error?.message === 'string' ? error.message : 'Transaction failed';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get token icon background color
  const getTokenColor = (symbol: string) => {
    switch (symbol.toUpperCase()) {
      case 'USDC': return '#2563EB';
      case 'EURC': return '#1E40AF';
      case 'ETH': return '#627EEA';
      default: return '#374151';
    }
  };

  return (
    <div className="w-full max-w-[480px] mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        {/* Back Button */}
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 -ml-2 mb-4 text-[#6B7280] hover:text-white transition-colors"
          >
            <ArrowLeftIcon size={20} />
          </button>
        )}

        {/* Title */}
        <h1 className="text-2xl font-semibold text-white text-center tracking-[-0.5px]">
          Send Assets
        </h1>
        <p className="text-[#6B7280] text-sm text-center mt-1.5">
          Transfer digital assets securely
        </p>

        {/* Security Indicator */}
        <div className="flex items-center justify-center gap-1.5 mt-3">
          <ShieldCheckIcon size={14} className="text-[#4B5563]" />
          <span className="text-[#4B5563] text-xs">Secure transfer</span>
        </div>
      </div>

      {/* Progress Steps */}
      <ProgressSteps currentStep={0} />

      {/* FROM - Source Wallet Card */}
      {passkeyConnected && (
        <div className="mb-6">
          <p className="text-[#6B7280] text-xs font-medium uppercase tracking-[0.05em] mb-2">From</p>
          <div className="relative bg-gradient-to-b from-[#111827] to-[#0F1629] rounded-[14px] border border-white/[0.06] p-[18px_20px] overflow-hidden">
            {/* Top highlight */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

            <div className="flex items-center gap-3.5">
              {/* Wallet Avatar */}
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1F2937] to-[#374151] border border-white/[0.1] flex items-center justify-center">
                <WalletIcon size={22} className="text-[#9CA3AF]" />
              </div>

              {/* Wallet Info */}
              <div className="flex-1">
                <p className="text-[15px] font-semibold text-white">Smart Wallet</p>
                <p className="text-[13px] text-[#6B7280] font-mono">
                  {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Loading...'}
                </p>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-[#9CA3AF] bg-[#1A2235] border border-[#2D3748] px-2.5 py-1.5 rounded-md">
                  ERC-4337
                </span>
                <span className="text-[11px] font-medium text-[#7DD3FC] bg-[rgba(74,158,255,0.08)] border border-[rgba(74,158,255,0.15)] px-2.5 py-1.5 rounded-md">
                  Gasless
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Asset Selection */}
      <div className="mb-6" ref={tokenDropdownRef}>
        <p className="text-[#6B7280] text-xs font-medium uppercase tracking-[0.05em] mb-2">Asset</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTokenDropdown(!showTokenDropdown)}
            className="w-full flex items-center gap-3 bg-[#0D1321] border border-[#1F2937] rounded-xl p-3.5 cursor-pointer transition-all hover:border-[#374151] hover:bg-[#111827] focus:border-[rgba(74,158,255,0.5)] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.1)] focus:outline-none"
          >
            {/* Token Icon */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: getTokenColor(selectedToken.symbol) }}
            >
              {selectedToken.symbol.slice(0, 2)}
            </div>

            {/* Token Info */}
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-[15px] font-medium text-white">{selectedToken.name}</span>
              <span className="text-[15px] text-[#6B7280]">({selectedToken.symbol})</span>
            </div>

            {/* Chevron */}
            <ChevronDownIcon size={20} className="text-[#6B7280]" />
          </button>

          {/* Dropdown */}
          {showTokenDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#111827] border border-[#1F2937] rounded-xl overflow-hidden z-50 shadow-xl">
              {getAllSupportedTokens().map((token) => (
                <button
                  key={token.symbol}
                  type="button"
                  onClick={() => {
                    setSelectedToken(token);
                    setShowTokenDropdown(false);
                  }}
                  className={`w-full flex items-center gap-3 p-3.5 transition-colors hover:bg-white/[0.05] ${
                    token.symbol === selectedToken.symbol ? 'bg-white/[0.03]' : ''
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: getTokenColor(token.symbol) }}
                  >
                    {token.symbol.slice(0, 2)}
                  </div>
                  <span className="text-[15px] font-medium text-white">{token.name}</span>
                  <span className="text-[15px] text-[#6B7280]">({token.symbol})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Balance */}
        <div className="flex justify-end items-center gap-1 mt-2">
          <span className="text-[13px] text-[#4B5563]">Balance:</span>
          <span className="text-[13px] text-[#6B7280] font-medium font-mono">
            {isLoading ? 'Loading...' : balanceLabel}
          </span>
        </div>
      </div>

      {/* Amount Input */}
      <div className="mb-6">
        <p className="text-[#6B7280] text-xs font-medium uppercase tracking-[0.05em] mb-2">Amount</p>
        <div className="flex items-center bg-[#0D1321] border border-[#1F2937] rounded-xl p-3.5 transition-all focus-within:border-[rgba(74,158,255,0.5)] focus-within:shadow-[0_0_0_3px_rgba(74,158,255,0.1)]">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent text-white text-xl font-semibold outline-none placeholder:text-[#374151] font-mono"
          />
          <span className="text-[#6B7280] text-sm font-medium mr-3">{selectedToken.symbol}</span>
          <button
            type="button"
            onClick={() => setAmount(balance.toFixed(6))}
            className="text-xs font-semibold text-[#9CA3AF] bg-[#1F2937] border border-[#374151] rounded-md px-3 py-1.5 transition-colors hover:bg-[#374151] hover:text-white hover:border-[#4B5563]"
          >
            MAX
          </button>
        </div>

        {/* Quick Amount Buttons */}
        <div className="flex gap-2 mt-2.5">
          {[25, 50, 75, 100].map((percent) => (
            <button
              key={percent}
              type="button"
              onClick={() => setAmount(((balance * percent) / 100).toFixed(6))}
              className="text-xs text-[#6B7280] border border-[#374151] rounded px-2.5 py-1 transition-colors hover:border-[#4B5563] hover:text-[#9CA3AF]"
            >
              {percent}%
            </button>
          ))}
        </div>
      </div>

      {/* Recipient Address */}
      <div className="mb-6 relative" ref={addressBookRef}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[#6B7280] text-xs font-medium uppercase tracking-[0.05em]">Send To</p>
          {recipient && isAddress(recipient) && !addressBookService.getContactByAddress(recipient) && (
            <button
              type="button"
              onClick={() => setShowSaveContact(true)}
              className="flex items-center gap-1 text-[#4B5563] hover:text-[#6B7280] transition-colors"
            >
              <UserPlusIcon size={14} />
              <span className="text-xs">Save Contact</span>
            </button>
          )}
        </div>

        <div className="flex items-center bg-[#0D1321] border border-[#1F2937] rounded-xl p-3.5 gap-3 transition-all focus-within:border-[rgba(74,158,255,0.5)] focus-within:shadow-[0_0_0_3px_rgba(74,158,255,0.1)]">
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            onFocus={() => setShowAddressBook(true)}
            placeholder="0x... or ENS name"
            className="flex-1 bg-transparent text-white text-sm font-mono tracking-wide outline-none placeholder:text-[#374151]"
          />

          {/* Valid Address Indicator */}
          {isRecipientValid && (
            <CheckCircleIcon size={18} className="text-[#34D399]/70" />
          )}

          {/* Address Book Button */}
          <button
            type="button"
            onClick={() => setShowAddressBook(!showAddressBook)}
            className="p-2 rounded-lg text-[#4B5563] hover:bg-white/[0.05] hover:text-[#6B7280] transition-colors"
          >
            <UsersIcon size={20} />
          </button>
        </div>

        {/* Address Book Dropdown */}
        {showAddressBook && (
          <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border border-[#1F2937] bg-[#0F1629] shadow-xl max-h-80 overflow-hidden">
            <div className="p-3 border-b border-white/[0.06]">
              <div className="relative">
                <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={addressBookSearch}
                  onChange={(e) => setAddressBookSearch(e.target.value)}
                  className="w-full bg-[#0D1321] border border-[#1F2937] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-[#374151] focus:outline-none focus:border-[rgba(74,158,255,0.5)]"
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-56">
              {addressBookList.length > 0 ? (
                addressBookList.map((item, index) => (
                  <button
                    key={item.address + index}
                    type="button"
                    onClick={() => {
                      setRecipient(item.address);
                      setShowAddressBook(false);
                      setAddressBookSearch('');
                    }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.03] transition-colors text-left border-b border-white/[0.04] last:border-b-0"
                  >
                    <div className="flex-shrink-0">
                      {item.isContact ? (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#2563EB] flex items-center justify-center">
                          <span className="text-white text-sm font-semibold">
                            {item.name?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#1F2937] flex items-center justify-center">
                          <ClockIcon size={16} className="text-[#6B7280]" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">
                          {item.name || `${item.address.slice(0, 8)}...${item.address.slice(-6)}`}
                        </span>
                        {item.isFavorite && (
                          <StarIcon size={12} filled className="text-[#FBBF24] flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-[#6B7280] truncate font-mono">
                        {item.address.slice(0, 10)}...{item.address.slice(-8)}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-6 text-center">
                  <UsersIcon size={32} className="mx-auto text-[#374151] mb-2" />
                  <p className="text-sm text-[#6B7280]">
                    {addressBookSearch ? 'No matching contacts' : 'No contacts yet'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Save Contact Modal */}
        {showSaveContact && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-gradient-to-b from-[#111827] to-[#0F1629] border border-white/[0.1] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-white">Save Contact</h3>
                <button
                  onClick={() => {
                    setShowSaveContact(false);
                    setNewContactName('');
                    setNewContactLabel('');
                  }}
                  className="text-[#6B7280] hover:text-white transition-colors p-1"
                >
                  <XIcon size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[#6B7280] block mb-1.5">Address</label>
                  <p className="text-sm text-[#9CA3AF] font-mono bg-[#0D1321] p-2.5 rounded-lg border border-white/[0.06] truncate">
                    {recipient}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] block mb-1.5">Name *</label>
                  <input
                    type="text"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="e.g., Alice, Binance"
                    className="w-full bg-[#0D1321] border border-[#1F2937] rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-[#374151] focus:outline-none focus:border-[rgba(74,158,255,0.5)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] block mb-1.5">Label (optional)</label>
                  <input
                    type="text"
                    value={newContactLabel}
                    onChange={(e) => setNewContactLabel(e.target.value)}
                    placeholder="e.g., Work, Exchange"
                    className="w-full bg-[#0D1321] border border-[#1F2937] rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-[#374151] focus:outline-none focus:border-[rgba(74,158,255,0.5)]"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowSaveContact(false);
                      setNewContactName('');
                      setNewContactLabel('');
                    }}
                    className="flex-1 px-4 py-2.5 border border-[#374151] rounded-xl text-[#9CA3AF] hover:bg-white/[0.05] hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (newContactName.trim() && recipient) {
                        try {
                          addressBookService.addContact({
                            address: recipient,
                            name: newContactName.trim(),
                            label: newContactLabel.trim() || undefined,
                          });
                          setShowSaveContact(false);
                          setNewContactName('');
                          setNewContactLabel('');
                        } catch (e: any) {
                          alert(e.message);
                        }
                      }
                    }}
                    disabled={!newContactName.trim()}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#3B82F6] to-[#2563EB] text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(59,130,246,0.3)]"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Summary Card */}
      <div className="mb-6 bg-gradient-to-b from-[#0F1629] to-[#0D1321] rounded-2xl border border-white/[0.06] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-4 bg-white/[0.02] border-b border-white/[0.04]">
          <FileTextIcon size={18} className="text-[#6B7280]" />
          <span className="text-[14px] font-medium text-[#9CA3AF]">Transaction Summary</span>
        </div>

        {/* Gas Sponsored Banner */}
        <div className="mx-5 my-4 p-3.5 bg-[rgba(74,158,255,0.04)] border border-[rgba(74,158,255,0.08)] rounded-[10px] flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-[rgba(74,158,255,0.1)] flex items-center justify-center">
            <ZapIcon size={18} className="text-[#7DD3FC]" />
          </div>
          <div>
            <p className="text-[14px] font-medium text-[#E5E7EB]">Gas Sponsored</p>
            <p className="text-[13px] text-[#6B7280]">Zero transaction fees</p>
          </div>
        </div>

        {/* Detail Rows */}
        <div className="px-5">
          <div className="flex justify-between items-center py-3.5 border-b border-white/[0.04]">
            <span className="text-[14px] text-[#6B7280]">Sending</span>
            <span className="text-[14px] font-semibold text-white">
              {amountNumber > 0 ? `${amountNumber} ${selectedToken.symbol}` : '-'}
            </span>
          </div>

          <div className="flex justify-between items-center py-3.5 border-b border-white/[0.04]">
            <span className="text-[14px] text-[#6B7280]">Execution Route</span>
            <div className="flex items-center gap-1.5">
              <KeyIcon size={14} className="text-[#6B7280]" />
              <span className="text-[14px] font-medium text-white">PasskeyAccount</span>
            </div>
          </div>

          <div className="flex justify-between items-center py-3.5">
            <span className="text-[14px] text-[#6B7280]">Network Fee</span>
            <div className="flex items-center gap-1">
              <ZapIcon size={14} className="text-[#7DD3FC]" />
              <span className="text-[14px] font-semibold text-[#7DD3FC]">FREE</span>
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="px-5 py-[18px] bg-white/[0.02] border-t border-white/[0.06]">
          <div className="flex justify-between items-center">
            <span className="text-[14px] font-medium text-[#9CA3AF]">Total</span>
            <span className="text-[18px] font-bold text-white font-mono">
              {total > 0 ? `${total.toFixed(4)} ${selectedToken.symbol}` : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {submitError && (
        <div className="mb-4 p-3 bg-[#1F2937]/50 border border-[#374151]/50 rounded-xl">
          <p className="text-[13px] text-[#F87171] text-center">{submitError}</p>
        </div>
      )}

      {/* Success State */}
      {txHash && (
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-3">
            <CheckCircleIcon size={18} className="text-[#34D399]/80" />
            <span className="text-[15px] font-medium text-[#34D399]/80">Transaction submitted!</span>
          </div>
          <a
            href={`${TX_EXPLORER_URL}${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#111827] border border-[#1F2937] rounded-lg transition-all hover:bg-[#1A2235] hover:border-[#374151] group"
          >
            <span className="text-[13px] text-[#9CA3AF] font-mono group-hover:text-white transition-colors">
              {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </span>
            <ExternalLinkIcon size={14} className="text-[#6B7280] group-hover:text-white transition-colors" />
            <span className="text-[13px] text-[#6B7280] group-hover:text-white transition-colors">View on ArcScan</span>
          </a>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full py-4 rounded-xl font-semibold text-base transition-all relative overflow-hidden ${
          canSubmit
            ? 'bg-gradient-to-r from-[#3B82F6] to-[#2563EB] text-white shadow-[0_8px_24px_rgba(59,130,246,0.35)] hover:shadow-[0_12px_28px_rgba(59,130,246,0.45)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_4px_12px_rgba(59,130,246,0.25)]'
            : 'bg-[#1F2937] border border-[#374151] text-[#4B5563] cursor-not-allowed'
        }`}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2Icon size={18} />
            <span>Sending...</span>
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <SendIcon size={18} />
            <span>Send with Passkey</span>
          </span>
        )}
      </button>

      {/* Helper Text */}
      {!passkeyConnected && (
        <p className="mt-3 text-[13px] text-[#F87171] text-center">
          Connect with your passkey to send transactions.
        </p>
      )}
    </div>
  );
};

export default SendAssets;
