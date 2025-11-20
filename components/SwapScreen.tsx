import React, { useState, useEffect } from 'react';
import { SwapIcon, SpinnerIcon } from './Icons';
import { getAllSupportedTokens, TokenInfo } from '../config/tokens';
import { swapService, Quote } from '../services/swapService';

const SwapScreen: React.FC = () => {
    const tokens = getAllSupportedTokens();
    const [fromToken, setFromToken] = useState<TokenInfo>(tokens[0]); // USDC
    const [toToken, setToToken] = useState<TokenInfo>(tokens[1]);   // ARC
    const [amount, setAmount] = useState('');
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
            <h2 className="text-2xl font-bold text-[#E6EEF3] mb-6">Stablecoin FX</h2>

            <div className="bg-[#151A22] p-6 rounded-xl border border-white/5 relative">
                {/* From Token */}
                <div className="mb-4">
                    <label className="text-[#A7B4C8] text-sm mb-2 block">From</label>
                    <div className="flex items-center gap-4 bg-white/5 p-3 rounded-lg">
                        <select
                            value={fromToken.symbol}
                            onChange={(e) => setFromToken(tokens.find(t => t.symbol === e.target.value) || fromToken)}
                            className="bg-transparent text-[#E6EEF3] font-bold outline-none cursor-pointer"
                        >
                            {tokens.map(t => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
                        </select>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="bg-transparent text-right text-[#E6EEF3] text-xl font-bold w-full outline-none"
                        />
                    </div>
                </div>

                {/* Switch Button */}
                <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 z-10">
                    <button
                        onClick={handleSwitch}
                        className="bg-[#091325] border border-white/10 p-2 rounded-full text-[#A7B4C8] hover:text-white transition-colors"
                    >
                        <SwapIcon size={20} />
                    </button>
                </div>

                {/* To Token */}
                <div className="mt-8">
                    <label className="text-[#A7B4C8] text-sm mb-2 block">To (Estimated)</label>
                    <div className="flex items-center gap-4 bg-white/5 p-3 rounded-lg">
                        <select
                            value={toToken.symbol}
                            onChange={(e) => setToToken(tokens.find(t => t.symbol === e.target.value) || toToken)}
                            className="bg-transparent text-[#E6EEF3] font-bold outline-none cursor-pointer"
                        >
                            {tokens.map(t => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
                        </select>
                        <div className="text-right text-[#E6EEF3] text-xl font-bold w-full">
                            {loading ? <SpinnerIcon size={20} /> : quote?.toAmount || '0.00'}
                        </div>
                    </div>
                </div>

                {/* Quote Details */}
                {quote && (
                    <div className="mt-4 p-3 bg-white/5 rounded-lg text-sm">
                        <div className="flex justify-between text-[#A7B4C8] mb-1">
                            <span>Rate</span>
                            <span>1 {fromToken.symbol} = {quote.rate} {toToken.symbol}</span>
                        </div>
                        <div className="flex justify-between text-[#A7B4C8]">
                            <span>Fee</span>
                            <span>{quote.fee} {fromToken.symbol}</span>
                        </div>
                    </div>
                )}

                {/* Swap Button */}
                <button
                    onClick={handleSwap}
                    disabled={!quote || swapping || loading}
                    className={`w-full mt-6 py-3 rounded-lg font-bold text-lg transition-colors ${!quote || swapping
                        ? 'bg-white/10 text-[#A7B4C8] cursor-not-allowed'
                        : 'bg-primary text-primary-text hover:bg-primary/90'
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
