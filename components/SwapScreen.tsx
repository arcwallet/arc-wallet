import React, { useState, useEffect } from 'react';
import { SwapIcon, SpinnerIcon } from './Icons';
import { getAllSupportedTokens, TokenInfo } from '../config/tokens';
import { swapService, Quote } from '../services/swapService';
import { useCircleWallet } from '../contexts/CircleWalletContext';
import { useActivity } from '../contexts/ActivityContext';
import { TransactionStatus, TransactionType } from '../types';
import { TX_EXPLORER_URL } from '../config/app.config';

interface SwapScreenProps {
    initialFromToken?: string;
    initialToToken?: string;
    initialAmount?: string;
}

const SwapScreen: React.FC<SwapScreenProps> = ({ initialFromToken, initialToToken, initialAmount = '' }) => {
    const tokens = getAllSupportedTokens();
    // Circle Modular Wallet - Smart Wallet (single wallet system)
    const { address: walletAddress, isConnected: passkeyConnected, sendTransaction } = useCircleWallet();
    const { addActivity } = useActivity();

    const [fromToken, setFromToken] = useState<TokenInfo>(() => {
        if (initialFromToken) {
            const found = tokens.find(t => t.symbol.toUpperCase() === initialFromToken.toUpperCase());
            if (found) return found;
        }
        return tokens[0];
    });
    const [toToken, setToToken] = useState<TokenInfo>(() => {
        if (initialToToken) {
            const found = tokens.find(t => t.symbol.toUpperCase() === initialToToken.toUpperCase());
            if (found) return found;
        }
        return tokens[1];
    });
    const [amount, setAmount] = useState(initialAmount);
    const [quote, setQuote] = useState<Quote | null>(null);
    const [loading, setLoading] = useState(false);
    const [swapping, setSwapping] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchQuote = async () => {
            if (!amount || parseFloat(amount) <= 0) {
                setQuote(null);
                return;
            }
            setLoading(true);
            try {
                const q = await swapService.getQuote(fromToken, toToken, amount);
                setQuote(q);
            } catch (error) {
                console.error('Error fetching quote:', error);
            } finally {
                setLoading(false);
            }
        };

        const timeout = setTimeout(fetchQuote, 500); // Debounce
        return () => clearTimeout(timeout);
    }, [amount, fromToken, toToken]);

    const handleSwap = async () => {
        if (!quote || !passkeyConnected || !walletAddress) {
            setError('Wallet not connected. Please connect your passkey wallet.');
            return;
        }

        setSwapping(true);
        setError(null);

        try {
            console.log('[SWAP UI] Starting swap via Circle Wallet:', {
                from: quote.fromToken.symbol,
                to: quote.toToken.symbol,
                amount: quote.fromAmount
            });

            // Execute swap via Circle Modular Wallet
            const hash = await swapService.executeSwap(quote, walletAddress);

            console.log('[SWAP UI] Swap successful! Hash:', hash);
            setTxHash(hash);

            // Add to activity feed
            const swapAmount = parseFloat(quote.fromAmount);
            addActivity({
                id: hash,
                type: TransactionType.Swap,
                description: `Swapped ${quote.fromAmount} ${quote.fromToken.symbol} to ${quote.toToken.symbol}`,
                timestamp: 'Just now',
                date: new Date(),
                amount: swapAmount,
                currency: quote.fromToken.symbol,
                usdValue: swapAmount * (quote.fromToken.currentPrice || 1),
                status: TransactionStatus.Pending,
                hash,
                from: walletAddress,
                to: walletAddress, // Swap is to self
                networkFee: 0, // Gasless via smart wallet
                approvals: {
                    required: 0,
                    list: [],
                },
            });

            // Reset form
            setAmount('');
            setQuote(null);
        } catch (error: any) {
            console.error('[SWAP UI] Swap failed:', error);
            const errorMessage = error?.message || 'Swap failed. Please try again.';
            setError(errorMessage);
        } finally {
            setSwapping(false);
        }
    };

    const handleSwitch = () => {
        setFromToken(toToken);
        setToToken(fromToken);
        setAmount('');
        setQuote(null);
    };

    return (
        <div className="max-w-md mx-auto mt-8">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white">Stablecoin FX</h2>
                <p className="text-slate-400 text-sm mt-2">
                    Powered by <span className="text-blue-400 font-medium">StableFX</span> — Circle's decentralized FX protocol with atomic PvP settlement on Arc.
                </p>
                <a
                    href="https://6778953.fs1.hubspotusercontent-na1.net/hubfs/6778953/StableFX-Litepaper_2025.pdf"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mt-2 transition-colors"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    StableFX Litepaper (PDF)
                </a>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-xl border border-slate-500/50 relative shadow-xl">
                {/* From Token */}
                <div className="mb-4">
                    <label className="text-slate-400 text-sm mb-2 block">From</label>
                    <div className="flex items-center gap-4 bg-slate-900/40 border border-slate-500/30 p-3 rounded-lg transition-all hover:border-blue-400/50">
                        <select
                            value={fromToken.symbol}
                            onChange={(e) => setFromToken(tokens.find(t => t.symbol === e.target.value) || fromToken)}
                            className="bg-transparent text-white font-bold outline-none cursor-pointer focus:text-blue-400 transition-colors"
                        >
                            {tokens.map(t => <option key={t.symbol} value={t.symbol} className="bg-slate-900 text-white">{t.symbol}</option>)}
                        </select>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="bg-transparent text-right text-white text-xl font-bold w-full outline-none placeholder:text-slate-600"
                        />
                    </div>
                </div>

                {/* Switch Button */}
                <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 z-10">
                    <button
                        onClick={handleSwitch}
                        className="bg-slate-800 border border-slate-500/50 p-2 rounded-full text-slate-400 hover:text-white hover:border-blue-400 hover:bg-slate-700 transition-all shadow-lg"
                    >
                        <SwapIcon size={20} />
                    </button>
                </div>

                {/* To Token */}
                <div className="mt-8">
                    <label className="text-slate-400 text-sm mb-2 block">To (Estimated)</label>
                    <div className="flex items-center gap-4 bg-slate-900/40 border border-slate-500/30 p-3 rounded-lg">
                        <select
                            value={toToken.symbol}
                            onChange={(e) => setToToken(tokens.find(t => t.symbol === e.target.value) || toToken)}
                            className="bg-transparent text-white font-bold outline-none cursor-pointer focus:text-blue-400 transition-colors"
                        >
                            {tokens.map(t => <option key={t.symbol} value={t.symbol} className="bg-slate-900 text-white">{t.symbol}</option>)}
                        </select>
                        <div className="text-right text-white text-xl font-bold w-full">
                            {loading ? <SpinnerIcon size={20} /> : quote?.toAmount || '0.00'}
                        </div>
                    </div>
                </div>

                {/* Quote Details */}
                {quote && (
                    <div className="mt-4 p-3 bg-slate-900/40 border border-slate-500/30 rounded-lg text-sm">
                        <div className="flex justify-between text-slate-400 mb-1">
                            <span>Rate</span>
                            <span>1 {fromToken.symbol} = {quote.rate} {toToken.symbol}</span>
                        </div>
                        <div className="flex justify-between text-slate-400 mb-1">
                            <span>Fee</span>
                            <span>{quote.fee}</span>
                        </div>
                        <div className="flex justify-between text-slate-400 mb-1">
                            <span>Price Impact</span>
                            <span className="text-blue-400">{quote.priceImpact}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                            <span>Minimum Received</span>
                            <span>{quote.minimumReceived} {toToken.symbol}</span>
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {/* Success Message */}
                {txHash && (
                    <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-sm text-blue-400">
                            Swap successful!{' '}
                            <a
                                href={`${TX_EXPLORER_URL}${txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="underline hover:text-blue-300"
                            >
                                View on Explorer
                            </a>
                        </p>
                    </div>
                )}

                {/* StableFX Notice */}
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-amber-400 text-sm font-medium">StableFX Integration Pending</span>
                    </div>
                    <p className="text-xs text-slate-400">
                        Swaps require Circle StableFX API access. Use the <span className="text-blue-400">Bridge</span> to transfer USDC between chains.
                    </p>
                </div>

                {/* Swap Button */}
                <button
                    onClick={handleSwap}
                    disabled={true}
                    className="w-full mt-4 py-3 rounded-lg font-bold text-lg bg-slate-800 text-slate-500 cursor-not-allowed"
                >
                    Coming Soon
                </button>
            </div>

            {/* Success Message */}
            {txHash && (
                <div className="mt-4 p-4 bg-blue-400/10 border border-blue-400/20 rounded-lg text-blue-400 text-center">
                    <p className="font-bold">Swap Successful!</p>
                    <p className="text-xs mt-1 opacity-80">Tx: {txHash.slice(0, 10)}...</p>
                </div>
            )}

            {/* Protocol Info */}
            <div className="mt-6 p-4 bg-slate-900/40 border border-slate-500/20 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs text-slate-400">Arc Testnet • 24/7 Settlement</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-800/50 rounded-lg p-2.5">
                        <p className="text-slate-500 mb-1">Supported Pairs</p>
                        <p className="text-slate-300 font-medium">USDC ↔ EURC ↔ USYC</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-2.5">
                        <p className="text-slate-500 mb-1">Settlement</p>
                        <p className="text-slate-300 font-medium">Atomic PvP</p>
                    </div>
                </div>
                <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-slate-700/50">
                    <a
                        href="https://developers.circle.com/stablefx"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-500 hover:text-blue-400 transition-colors"
                    >
                        Circle Docs
                    </a>
                    <span className="text-slate-700">•</span>
                    <a
                        href="https://docs.arc.network"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-500 hover:text-blue-400 transition-colors"
                    >
                        Arc Docs
                    </a>
                    <span className="text-slate-700">•</span>
                    <a
                        href="https://testnet.arcscan.app"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-500 hover:text-blue-400 transition-colors"
                    >
                        Explorer
                    </a>
                </div>
            </div>
        </div>
    );
};

export default SwapScreen;
