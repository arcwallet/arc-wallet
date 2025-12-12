/**
 * Bridge Component - CCTP Cross-Chain USDC Transfer
 *
 * Uses Circle's CCTP V2 protocol for secure cross-chain USDC transfers.
 * Works with ERC-4337 smart accounts (passkey-based, no EOA required).
 */

import React, { useState, useEffect } from 'react';
import { useCircleWallet } from '../contexts/CircleWalletContext';
import { useBridge } from '../contexts/BridgeContext';
import { formatUnits } from 'ethers';
import type { BridgeChainConfig } from '../config/cctp';

const Bridge: React.FC = () => {
  const { address, isConnected, getTokenBalance } = useCircleWallet();
  const {
    isLoading,
    error,
    transactions,
    pendingTransactions,
    destinationChains,
    selectedDestination,
    currentEstimate,
    selectDestination,
    estimateBridge,
    executeBridge,
    clearError,
  } = useBridge();

  // Form state
  const [amount, setAmount] = useState('');
  const [usdcBalance, setUsdcBalance] = useState<bigint | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Arc Testnet USDC address (native)
  const ARC_USDC = '0x3600000000000000000000000000000000000000';

  // Load USDC balance
  useEffect(() => {
    if (isConnected && address) {
      getTokenBalance(ARC_USDC)
        .then(setUsdcBalance)
        .catch(() => setUsdcBalance(null));
    }
  }, [isConnected, address, getTokenBalance]);

  // Estimate when amount or destination changes
  useEffect(() => {
    if (!amount || !selectedDestination || parseFloat(amount) <= 0) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsEstimating(true);
      try {
        await estimateBridge(amount, selectedDestination.chainId);
      } catch {
        // Error handled by context
      } finally {
        setIsEstimating(false);
      }
    }, 500); // Debounce

    return () => clearTimeout(timer);
  }, [amount, selectedDestination, estimateBridge]);

  const handleBridge = async () => {
    if (!selectedDestination || !amount) return;

    try {
      await executeBridge(amount, selectedDestination.chainId);
      setAmount('');
    } catch {
      // Error handled by context
    }
  };

  const handleMaxAmount = () => {
    if (usdcBalance) {
      // Leave a small buffer for fees
      const max = usdcBalance > 100000n ? usdcBalance - 100000n : usdcBalance;
      setAmount(formatUnits(max, 6));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      case 'pending_attestation':
      case 'attestation_received':
        return 'text-yellow-400';
      default:
        return 'text-blue-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return 'Preparing...';
      case 'approving':
        return 'Approving USDC...';
      case 'pending_burn':
        return 'Preparing burn...';
      case 'burning':
        return 'Burning USDC...';
      case 'pending_attestation':
        return 'Waiting for attestation...';
      case 'attestation_received':
        return 'Ready to claim';
      case 'pending_mint':
        return 'Minting...';
      case 'minting':
        return 'Minting USDC...';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  };

  if (!isConnected) {
    return (
      <div className="w-full max-w-3xl mx-auto px-6 py-10">
        <div className="rounded-2xl border border-slate-600/50 bg-slate-900/60 p-8 text-center">
          <p className="text-slate-400">Connect wallet to use bridge</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-6 py-10 space-y-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <h2 className="text-white text-4xl font-black leading-tight tracking-[-0.03em]">
          Bridge USDC
        </h2>
        <p className="text-slate-400 text-base mt-2">
          Transfer USDC cross-chain using Circle CCTP
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 cursor-pointer"
          onClick={clearError}
        >
          <p className="text-red-400 text-sm">{error}</p>
          <p className="text-red-400/60 text-xs mt-1">Click to dismiss</p>
        </div>
      )}

      {/* Pending Transactions Alert */}
      {pendingTransactions.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-400 font-medium">
                {pendingTransactions.length} pending transfer(s)
              </p>
              <p className="text-yellow-400/60 text-sm mt-1">
                Waiting for attestation (~15-20 min)
              </p>
            </div>
            <button
              onClick={() => setShowHistory(true)}
              className="text-yellow-400 text-sm underline"
            >
              View
            </button>
          </div>
        </div>
      )}

      {/* Bridge Form */}
      <div className="rounded-2xl border border-slate-600/50 bg-slate-900/60 backdrop-blur-sm p-6 space-y-6">
        {/* From Section */}
        <div>
          <label className="text-slate-400 text-sm mb-2 block">From</label>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <span className="text-blue-400 text-sm font-bold">A</span>
                </div>
                <span className="text-white font-medium">Arc Testnet</span>
              </div>
              <span className="text-slate-400 text-sm">
                Balance: {usdcBalance ? formatUnits(usdcBalance, 6) : '0.00'} USDC
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-2xl text-white outline-none"
                step="0.01"
                min="0"
              />
              <button
                onClick={handleMaxAmount}
                className="px-3 py-1 rounded-lg bg-slate-700/50 text-slate-300 text-sm hover:bg-slate-700"
              >
                MAX
              </button>
              <span className="text-white font-medium">USDC</span>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* To Section */}
        <div>
          <label className="text-slate-400 text-sm mb-2 block">To</label>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="grid grid-cols-2 gap-2">
              {destinationChains.map((chain) => (
                <button
                  key={chain.chainId}
                  onClick={() => selectDestination(chain.chainId)}
                  className={`p-3 rounded-xl border transition-all ${
                    selectedDestination?.chainId === chain.chainId
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      chain.name.includes('Ethereum') ? 'bg-blue-500/20' :
                      chain.name.includes('Base') ? 'bg-blue-600/20' : 'bg-purple-500/20'
                    }`}>
                      <span className="text-xs font-bold text-white">
                        {chain.name.charAt(0)}
                      </span>
                    </div>
                    <span className="text-white text-sm font-medium">{chain.name}</span>
                  </div>
                  {chain.supportsFastTransfer && (
                    <span className="text-xs text-green-400 mt-1 block">Fast transfer</span>
                  )}
                </button>
              ))}
            </div>

            {/* Recipient Address */}
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <p className="text-slate-400 text-xs mb-1">Recipient (same address)</p>
              <p className="text-white text-sm font-mono">
                {address?.slice(0, 10)}...{address?.slice(-8)}
              </p>
            </div>
          </div>
        </div>

        {/* Estimate */}
        {currentEstimate && (
          <div className="bg-slate-800/30 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Amount</span>
              <span className="text-white">{currentEstimate.amount} USDC</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Bridge Fee</span>
              <span className="text-white">{currentEstimate.fee} USDC</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Estimated Time</span>
              <span className="text-white">{currentEstimate.estimatedTime}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-slate-700/50">
              <span className="text-slate-400">You will receive</span>
              <span className="text-green-400 font-medium">
                ~{(parseFloat(currentEstimate.amount) - parseFloat(currentEstimate.fee)).toFixed(2)} USDC
              </span>
            </div>
          </div>
        )}

        {/* Bridge Button */}
        <button
          onClick={handleBridge}
          disabled={isLoading || !amount || !selectedDestination || parseFloat(amount) <= 0}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
            isLoading || !amount || !selectedDestination
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90'
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
          ) : isEstimating ? (
            'Estimating...'
          ) : !selectedDestination ? (
            'Select destination'
          ) : !amount ? (
            'Enter amount'
          ) : (
            `Bridge to ${selectedDestination.name}`
          )}
        </button>

        {/* Info */}
        <p className="text-center text-xs text-slate-500">
          Powered by Circle CCTP V2. Standard transfers take ~15-20 minutes.
        </p>
      </div>

      {/* Transaction History */}
      {(showHistory || transactions.length > 0) && (
        <div className="rounded-2xl border border-slate-600/50 bg-slate-900/60 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Bridge History</h3>
            {showHistory && (
              <button
                onClick={() => setShowHistory(false)}
                className="text-slate-400 text-sm"
              >
                Hide
              </button>
            )}
          </div>

          {transactions.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">
              No bridge transactions yet
            </p>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="bg-slate-800/30 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{tx.amount} USDC</span>
                    <span className={`text-sm ${getStatusColor(tx.status)}`}>
                      {getStatusText(tx.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <span>Arc</span>
                    <span>→</span>
                    <span>
                      {destinationChains.find(c => c.chainId === tx.destinationChainId)?.name || 'Unknown'}
                    </span>
                  </div>
                  {tx.burnTxHash && (
                    <a
                      href={`https://testnet.arcscan.app/tx/${tx.burnTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:underline mt-2 block"
                    >
                      View on Explorer
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Bridge;
