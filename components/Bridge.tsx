/**
 * Bridge Component - CCTP Cross-Chain USDC Transfer
 *
 * Bidirectional bridging via Circle Smart Wallet:
 * - Arc → Sepolia/Base
 * - Sepolia/Base → Arc
 */

import React, { useState, useEffect } from 'react';
import { useCircleWallet } from '../contexts/CircleWalletContext';
import { useBridge } from '../contexts/BridgeContext';
import { formatUnits } from 'ethers';

type BridgeDirection = 'from_arc' | 'to_arc';

// Chain icon component
const ChainIcon: React.FC<{ name: string; size?: number }> = ({ name, size = 32 }) => {
  const getColor = () => {
    if (name.includes('Ethereum')) return 'from-[#627EEA] to-[#3C3C3D]';
    if (name.includes('Base')) return 'from-[#0052FF] to-[#003CC1]';
    if (name.includes('Arc')) return 'from-[#6c7cff] to-[#4aa9ff]';
    return 'from-slate-500 to-slate-600';
  };

  return (
    <div
      className={`rounded-full bg-gradient-to-br ${getColor()} flex items-center justify-center shadow-lg`}
      style={{ width: size, height: size }}
    >
      <span className="text-white font-bold" style={{ fontSize: size * 0.4 }}>
        {name.charAt(0)}
      </span>
    </div>
  );
};

const Bridge: React.FC = () => {
  const { address, isConnected, getTokenBalance } = useCircleWallet();
  const {
    isLoading,
    error,
    transactions,
    pendingTransactions,
    destinationChains,
    sourceChains,
    selectedDestination,
    selectedSource,
    currentEstimate,
    selectDestination,
    selectSource,
    estimateBridge,
    executeBridge,
    executeInboundBridge,
    clearError,
  } = useBridge();

  // State
  const [direction, setDirection] = useState<BridgeDirection>('from_arc');
  const [amount, setAmount] = useState('');
  const [usdcBalance, setUsdcBalance] = useState<bigint | null>(null);
  const [sourceBalance, setSourceBalance] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const ARC_USDC = '0x3600000000000000000000000000000000000000';

  // Load Arc USDC balance
  useEffect(() => {
    if (isConnected && address && direction === 'from_arc') {
      getTokenBalance(ARC_USDC)
        .then(setUsdcBalance)
        .catch(() => setUsdcBalance(null));
    }
  }, [isConnected, address, getTokenBalance, direction]);

  // Estimate when amount or destination changes (outbound)
  useEffect(() => {
    if (direction !== 'from_arc' || !amount || !selectedDestination || parseFloat(amount) <= 0) return;

    const timer = setTimeout(async () => {
      setIsEstimating(true);
      try {
        await estimateBridge(amount, selectedDestination.chainId);
      } catch {
      } finally {
        setIsEstimating(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [amount, selectedDestination, estimateBridge, direction]);

  // Outbound bridge (Arc → External)
  const handleOutboundBridge = async () => {
    if (!selectedDestination || !amount) return;
    try {
      await executeBridge(amount, selectedDestination.chainId);
      setAmount('');
    } catch {
    }
  };

  // Inbound bridge (External → Arc)
  const handleInboundBridge = async () => {
    if (!selectedSource || !amount) return;
    try {
      await executeInboundBridge(amount, selectedSource.chainId);
      setAmount('');
    } catch {
    }
  };

  const handleMaxAmount = () => {
    if (direction === 'from_arc' && usdcBalance) {
      const max = usdcBalance > 100000n ? usdcBalance - 100000n : usdcBalance;
      setAmount(formatUnits(max, 6));
    } else if (direction === 'to_arc' && sourceBalance) {
      setAmount(sourceBalance);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-emerald-400 bg-emerald-400/10';
      case 'failed': return 'text-red-400 bg-red-400/10';
      case 'pending_attestation':
      case 'attestation_received': return 'text-amber-400 bg-amber-400/10';
      default: return 'text-blue-400 bg-blue-400/10';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending_approval': return 'Preparing';
      case 'approving': return 'Approving';
      case 'pending_burn': return 'Preparing';
      case 'burning': return 'Burning';
      case 'pending_attestation': return 'Waiting';
      case 'attestation_received': return 'Ready';
      case 'pending_mint': return 'Minting';
      case 'minting': return 'Minting';
      case 'completed': return 'Done';
      case 'failed': return 'Failed';
      default: return status;
    }
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-slate-400">Connect wallet to use bridge</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Bridge</h2>
        <p className="text-slate-400 text-sm mt-1">Transfer USDC via Circle CCTP</p>
      </div>

      {/* Direction Tabs */}
      <div className="flex mb-6 bg-slate-800/50 rounded-xl p-1">
        <button
          onClick={() => { setDirection('from_arc'); setAmount(''); clearError(); }}
          className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
            direction === 'from_arc'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          From Arc
        </button>
        <button
          onClick={() => { setDirection('to_arc'); setAmount(''); clearError(); }}
          className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
            direction === 'to_arc'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          To Arc
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 cursor-pointer"
          onClick={clearError}
        >
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Pending Alert */}
      {pendingTransactions.length > 0 && (
        <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-400 text-sm font-medium">
                {pendingTransactions.length} pending
              </span>
            </div>
            <button onClick={() => setShowHistory(true)} className="text-amber-400 text-sm hover:underline">
              View
            </button>
          </div>
        </div>
      )}

      {/* Bridge Card */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-700/50 overflow-hidden">

        {/* FROM ARC DIRECTION */}
        {direction === 'from_arc' && (
          <>
            {/* From Section */}
            <div className="p-5 border-b border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-400 text-sm font-medium">From</span>
                <span className="text-slate-500 text-xs">
                  Balance: {usdcBalance ? parseFloat(formatUnits(usdcBalance, 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'} USDC
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 flex-shrink-0">
                  <ChainIcon name="Arc" size={40} />
                  <div>
                    <p className="text-white font-medium">Arc Testnet</p>
                    <p className="text-slate-500 text-xs">Source</p>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-xl text-white text-right pr-20 outline-none focus:border-blue-500/50 transition-colors"
                      step="0.01"
                      min="0"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <button onClick={handleMaxAmount} className="px-2 py-1 rounded bg-slate-700/50 text-slate-400 text-xs hover:bg-slate-700 hover:text-white transition-colors">
                        MAX
                      </button>
                      <span className="text-slate-400 text-sm">USDC</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="relative h-0">
              <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <div className="w-10 h-10 rounded-full bg-slate-800 border-4 border-slate-900 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400">
                    <path d="M12 5v14M19 12l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            {/* To Section */}
            <div className="p-5">
              <span className="text-slate-400 text-sm font-medium block mb-4">To</span>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {destinationChains.map((chain) => (
                  <button
                    key={chain.chainId}
                    onClick={() => selectDestination(chain.chainId)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedDestination?.chainId === chain.chainId
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ChainIcon name={chain.name} size={32} />
                      <div className="text-left">
                        <p className="text-white text-sm font-medium">{chain.name}</p>
                        {chain.supportsFastTransfer && (
                          <p className="text-emerald-400 text-xs">Fast</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="bg-slate-800/30 rounded-xl p-4">
                <p className="text-slate-500 text-xs mb-1">Recipient</p>
                <p className="text-white text-sm font-mono truncate">{address}</p>
              </div>
            </div>

            {/* Estimate */}
            {currentEstimate && (
              <div className="px-5 pb-5">
                <div className="bg-slate-800/30 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Amount</span>
                    <span className="text-white">{currentEstimate.amount} USDC</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Fee</span>
                    <span className="text-white">{currentEstimate.fee} USDC</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Time</span>
                    <span className="text-white">{currentEstimate.estimatedTime}</span>
                  </div>
                  <div className="pt-3 border-t border-slate-700/50 flex justify-between">
                    <span className="text-slate-400 text-sm font-medium">You receive</span>
                    <span className="text-emerald-400 font-semibold">
                      {(parseFloat(currentEstimate.amount) - parseFloat(currentEstimate.fee)).toFixed(2)} USDC
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Bridge Button */}
            <div className="p-5 pt-0">
              <button
                onClick={handleOutboundBridge}
                disabled={isLoading || !amount || !selectedDestination || parseFloat(amount) <= 0}
                className={`w-full py-4 rounded-xl font-semibold transition-all ${
                  isLoading || !amount || !selectedDestination || parseFloat(amount) <= 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:shadow-lg hover:shadow-blue-500/25'
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </span>
                ) : isEstimating ? 'Estimating...' : !selectedDestination ? 'Select Destination' : !amount || parseFloat(amount) <= 0 ? 'Enter Amount' : `Bridge to ${selectedDestination.name}`}
              </button>
            </div>
          </>
        )}

        {/* TO ARC DIRECTION */}
        {direction === 'to_arc' && (
          <>
            {/* From Section */}
            <div className="p-5 border-b border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-400 text-sm font-medium">From</span>
                <span className="text-slate-500 text-xs">
                  Select source chain
                </span>
              </div>

              {/* Chain Selector */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {sourceChains?.map((chain) => (
                  <button
                    key={chain.chainId}
                    onClick={() => selectSource(chain.chainId)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedSource?.chainId === chain.chainId
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ChainIcon name={chain.name} size={32} />
                      <div className="text-left">
                        <p className="text-white text-sm font-medium">{chain.name}</p>
                        {chain.supportsFastTransfer && (
                          <p className="text-emerald-400 text-xs">Fast</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Amount Input */}
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-xl text-white text-right pr-20 outline-none focus:border-blue-500/50 transition-colors"
                  step="0.01"
                  min="0"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button onClick={handleMaxAmount} className="px-2 py-1 rounded bg-slate-700/50 text-slate-400 text-xs hover:bg-slate-700 hover:text-white transition-colors">
                    MAX
                  </button>
                  <span className="text-slate-400 text-sm">USDC</span>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="relative h-0">
              <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <div className="w-10 h-10 rounded-full bg-slate-800 border-4 border-slate-900 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400">
                    <path d="M12 5v14M19 12l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            {/* To Section (Arc) */}
            <div className="p-5">
              <span className="text-slate-400 text-sm font-medium block mb-4">To</span>
              <div className="flex items-center gap-3 p-4 bg-slate-800/30 rounded-xl mb-4">
                <ChainIcon name="Arc" size={40} />
                <div>
                  <p className="text-white font-medium">Arc Testnet</p>
                  <p className="text-slate-500 text-xs">Destination</p>
                </div>
              </div>

              <div className="bg-slate-800/30 rounded-xl p-4">
                <p className="text-slate-500 text-xs mb-1">Recipient</p>
                <p className="text-white text-sm font-mono truncate">{address}</p>
              </div>
            </div>

            {/* Estimate */}
            {amount && parseFloat(amount) > 0 && selectedSource && (
              <div className="px-5 pb-5">
                <div className="bg-slate-800/30 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Amount</span>
                    <span className="text-white">{amount} USDC</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Fee</span>
                    <span className="text-white">~0.05 USDC</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Time</span>
                    <span className="text-white">~15-20 min</span>
                  </div>
                  <div className="pt-3 border-t border-slate-700/50 flex justify-between">
                    <span className="text-slate-400 text-sm font-medium">You receive</span>
                    <span className="text-emerald-400 font-semibold">
                      {(parseFloat(amount) - 0.05).toFixed(2)} USDC
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Bridge Button */}
            <div className="p-5 pt-0">
              <button
                onClick={handleInboundBridge}
                disabled={isLoading || !amount || !selectedSource || parseFloat(amount) <= 0}
                className={`w-full py-4 rounded-xl font-semibold transition-all ${
                  isLoading || !amount || !selectedSource || parseFloat(amount) <= 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:shadow-lg hover:shadow-blue-500/25'
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </span>
                ) : !selectedSource ? 'Select Source Chain' : !amount || parseFloat(amount) <= 0 ? 'Enter Amount' : 'Bridge to Arc'}
              </button>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="px-5 pb-5">
          <div className="flex items-center justify-center gap-2 text-slate-600 text-xs">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <span>Powered by Circle CCTP V2</span>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      {(showHistory || transactions.length > 0) && (
        <div className="mt-6 rounded-2xl bg-slate-900/80 border border-slate-700/50 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
            <h3 className="text-white font-semibold">History</h3>
            <button onClick={() => setShowHistory(false)} className="text-slate-500 hover:text-white transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="p-5">
            {transactions.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No transactions yet</p>
            ) : (
              <div className="space-y-3">
                {transactions.slice(0, 5).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center -space-x-2">
                        <ChainIcon name="Arc" size={28} />
                        <ChainIcon name={destinationChains.find(c => c.chainId === tx.destinationChainId)?.name || ''} size={28} />
                      </div>
                      <div>
                        <p className="text-white font-medium">{tx.amount} USDC</p>
                        <p className="text-slate-500 text-xs">
                          Arc → {destinationChains.find(c => c.chainId === tx.destinationChainId)?.name || 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(tx.status)}`}>
                        {getStatusText(tx.status)}
                      </span>
                      {tx.burnTxHash && (
                        <a
                          href={`https://testnet.arcscan.app/tx/${tx.burnTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-blue-400 text-xs mt-1 hover:underline"
                        >
                          View →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Bridge;
