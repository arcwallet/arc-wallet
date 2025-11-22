import React, { useState, useEffect } from 'react';
import { SwapIcon, SpinnerIcon } from './Icons';
import { getAllSupportedTokens, TokenInfo } from '../config/tokens';
import { swapService, Quote } from '../services/swapService';

interface SwapScreenProps {
    initialFromToken?: string;
    initialToToken?: string;
    initialAmount?: string;
}

const SwapScreen: React.FC<SwapScreenProps> = ({ initialFromToken, initialToToken, initialAmount = '' }) => {
    const tokens = getAllSupportedTokens();
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
        if (!quote) return;
        setSwapping(true);
        try {
            const hash = await swapService.executeSwap(quote);
            setTxHash(hash);
            setAmount('');
            setQuote(null);
        } catch (error) {
            console.error('Swap failed:', error);
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
            <h2 className="text-2xl font-bold text-white mb-6">Stablecoin FX</h2>

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
                        <div className="flex justify-between text-slate-400">
                            <span>Fee</span>
                            <span>{quote.fee} {fromToken.symbol}</span>
                        </div>
                    </div>
                )}

                {/* Swap Button */}
                <button
                    onClick={handleSwap}
                    disabled={!quote || swapping || loading}
                    className={`w-full mt-6 py-3 rounded-lg font-bold text-lg transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] ${!quote || swapping
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                        : 'bg-slate-200 text-slate-900 hover:bg-white'
                        }`}
                >
                    {swapping ? 'Swapping...' : 'Swap'}
                </button>
            </div>

            {/* Success Message */}
            {txHash && (
                <div className="mt-4 p-4 bg-green-400/10 border border-green-400/20 rounded-lg text-green-400 text-center">
                    <p className="font-bold">Swap Successful!</p>
                    <p className="text-xs mt-1 opacity-80">Tx: {txHash.slice(0, 10)}...</p>
                </div>
            )}
        </div>
    );
};

export default SwapScreen;
