import React, { useState, useMemo, useEffect } from 'react';
import { useArcAccount } from '../contexts/ArcAccountContext';
import { useWallet } from '../contexts/WalletContext';
import { useActivity } from '../contexts/ActivityContext';
import { ExpandIcon, SwapIcon, SpinnerIcon } from './Icons';
import { getSwapService, validateSwapParams, SwapQuote, SwapProgressStep } from '../services/swapService';
import { getAllSupportedTokens, TokenInfo } from '../config/tokens';
import { TransactionStatus, TransactionType } from '../types';


// Use real token data from configuration
const getInitialAssets = () => {
    return getAllSupportedTokens()
        .filter(token => token.swapable)
        .map(token => ({
            id: token.symbol.toLowerCase(),
            name: token.name,
            ticker: token.symbol,
            balance: 0,
            price: token.currentPrice || 1,
            decimals: token.decimals,
        }));
};

const AssetInput: React.FC<{
    label: string;
    assetId: string;
    onAssetChange: (id: string) => void;
    amount: string;
    onAmountChange: (amount: string) => void;
    onSetMax?: () => void;
    assets: typeof initialAssets;
}> = ({ label, assetId, onAssetChange, amount, onAmountChange, onSetMax, assets }) => {
    const selectedAsset = assets.find(a => a.id === assetId)!;

    return (
        <div className="rounded-xl border border-border-color bg-input-bg/50 p-4">
            <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium text-text-secondary">{label}</p>
                <p className="text-xs text-text-secondary">Balance: {selectedAsset.balance.toFixed(4)} {selectedAsset.ticker}</p>
            </div>
            <div className="flex items-center gap-4">
                <input
                    className="form-input w-full min-w-0 flex-1 resize-none overflow-hidden border-none bg-transparent p-0 text-3xl font-medium text-text-primary placeholder:text-text-secondary/50 focus:outline-0 focus:ring-0"
                    placeholder="0.0"
                    type="number"
                    step="any"
                    value={amount}
                    onChange={(e) => onAmountChange(e.target.value)}
                />
                <div className="relative">
                     <select
                        value={assetId}
                        onChange={(e) => onAssetChange(e.target.value)}
                        className="form-select flex w-full appearance-none resize-none overflow-hidden rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border-color bg-surface h-10 pl-3 pr-8 text-base font-medium leading-normal"
                     >
                        {assets.map(asset => (
                            <option key={asset.id} value={asset.id}>{asset.ticker}</option>
                        ))}
                    </select>
                    <ExpandIcon size={16} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary" />
                </div>
                 {onSetMax && <button onClick={onSetMax} className="text-sm font-bold text-primary hover:text-primary/80 transition-colors">MAX</button>}
            </div>
        </div>
    );
};


const Swap: React.FC = () => {
    const { snapshot } = useArcAccount();
    const { sessionKey } = useWallet();
    const { addActivity } = useActivity();
    const [assets, setAssets] = useState(getInitialAssets());

    // Swap states
    const [fromAsset, setFromAsset] = useState('usdc');
    const [toAsset, setToAsset] = useState('eurc');
    const [fromAmount, setFromAmount] = useState('');
    const [quote, setQuote] = useState<SwapQuote | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSwapping, setIsSwapping] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [statusVariant, setStatusVariant] = useState<'info' | 'error' | 'success'>('info');
    const [progressStep, setProgressStep] = useState<string>('');

    useEffect(() => {
        const balance = snapshot ? Number(snapshot.balanceWei) / Number(10n ** 18n) : 0;
        const next = getInitialAssets().map(asset =>
            asset.id === 'usdc' ? { ...asset, balance } : { ...asset, balance: 0 }
        );
        setAssets(next);
    }, [snapshot]);
    
    const fromAssetData = assets.find(a => a.id === fromAsset)!;
    const toAssetData = assets.find(a => a.id === toAsset)!;

    // Get real-time quote when amount changes
    useEffect(() => {
        const getQuote = async () => {
            if (!fromAmount || parseFloat(fromAmount) <= 0) {
                setQuote(null);
                return;
            }

            setIsLoading(true);
            try {
                const swapService = getSwapService();
                const newQuote = await swapService.getSwapQuote({
                    fromToken: fromAssetData.ticker,
                    toToken: toAssetData.ticker,
                    fromAmount,
                });
                setQuote(newQuote);
                setStatusMessage('');
            } catch (error: any) {
                setQuote(null);
                setStatusMessage(`Quote error: ${error.message}`);
                setStatusVariant('error');
            } finally {
                setIsLoading(false);
            }
        };

        const debounceTimer = setTimeout(getQuote, 500);
        return () => clearTimeout(debounceTimer);
    }, [fromAmount, fromAssetData.ticker, toAssetData.ticker]);

    const toAmount = quote?.toAmount || '';
    const exchangeRate = quote?.exchangeRate || 0;

    const handleFromAssetChange = (id: string) => {
        if (id === toAsset) { // If user selects the same asset, swap them
            setToAsset(fromAsset);
        }
        setFromAsset(id);
    };

    const handleToAssetChange = (id: string) => {
        if (id === fromAsset) { // If user selects the same asset, swap them
            setFromAsset(toAsset);
        }
        setToAsset(id);
    };
    
    const handleSwapAssets = () => {
        const currentFromAsset = fromAsset;
        const currentToAsset = toAsset;
        const currentFromAmount = fromAmount;

        setFromAsset(currentToAsset);
        setToAsset(currentFromAsset);
        setFromAmount(''); // Clear amount when swapping
        setQuote(null);
    };

    const canSubmit = useMemo(() => {
        if (!sessionKey?.address || isSwapping || isLoading) return false;

        const validation = validateSwapParams({
            fromToken: fromAssetData.ticker,
            toToken: toAssetData.ticker,
            fromAmount,
            walletAddress: sessionKey.address,
        });

        return validation.isValid && quote !== null && parseFloat(fromAmount) <= fromAssetData.balance;
    }, [sessionKey, fromAssetData, toAssetData, fromAmount, quote, isSwapping, isLoading]);

    const handleExecuteSwap = async () => {
        if (!sessionKey?.address) {
            setStatusMessage('Please connect your wallet');
            setStatusVariant('error');
            return;
        }

        if (!canSubmit) return;

        setIsSwapping(true);
        setStatusMessage('Preparing swap transaction...');
        setStatusVariant('info');
        setProgressStep('');

        try {
            const swapService = getSwapService();

            const result = await swapService.executeSwap({
                fromToken: fromAssetData.ticker,
                toToken: toAssetData.ticker,
                fromAmount,
                walletAddress: sessionKey.address,
                onProgress: (step: SwapProgressStep) => {
                    switch (step.type) {
                        case 'quote-fetching':
                            setProgressStep('Getting best price...');
                            break;
                        case 'approval-checking':
                            setProgressStep('Checking token approvals...');
                            break;
                        case 'approval-needed':
                            setProgressStep('Approving token spend...');
                            break;
                        case 'swap-executing':
                            setProgressStep('Executing swap...');
                            break;
                        case 'swap-completed':
                            setProgressStep('Swap completed!');
                            break;
                        case 'error':
                            setStatusMessage(step.message);
                            setStatusVariant('error');
                            break;
                    }
                },
            });

            // Add to activity
            const now = new Date();
            addActivity({
                id: result.txHash,
                type: TransactionType.Swap,
                description: `Swap ${result.fromAmount} ${result.fromToken} for ${result.toAmount} ${result.toToken}`,
                timestamp: 'Just now',
                date: now,
                amount: -parseFloat(result.fromAmount),
                currency: result.fromToken,
                usdValue: -parseFloat(result.fromAmount) * fromAssetData.price,
                status: TransactionStatus.Completed,
                hash: result.txHash,
                from: sessionKey.address,
                to: 'Swap Contract',
                networkFee: 0.002, // Estimated from gas
                approvals: { required: 0, list: [] },
            });

            setStatusMessage(`Successfully swapped ${result.fromAmount} ${result.fromToken} for ${result.toAmount} ${result.toToken}`);
            setStatusVariant('success');
            setFromAmount('');
            setQuote(null);
            setProgressStep('');

        } catch (error: any) {
            setStatusMessage(`Swap failed: ${error.message}`);
            setStatusVariant('error');
            setProgressStep('');
        } finally {
            setIsSwapping(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="mb-8 text-center">
                <p className="text-text-primary text-4xl font-black leading-tight tracking-[-0.033em]">Swap Assets</p>
                <p className="text-text-secondary text-base font-normal leading-normal mt-3">Exchange one cryptocurrency for another.</p>
            </div>
            <div className="flex flex-col gap-3">
                <AssetInput 
                    label="You Send"
                    assetId={fromAsset}
                    onAssetChange={handleFromAssetChange}
                    amount={fromAmount}
                    onAmountChange={setFromAmount}
                    onSetMax={() => setFromAmount(fromAssetData.balance.toFixed(6))}
                    assets={assets}
                />

                <div className="flex justify-center my-1">
                    <button onClick={handleSwapAssets} className="p-2 rounded-full border border-border-color bg-surface hover:bg-white/10 text-text-secondary hover:text-primary transition-all">
                        <SwapIcon size={20} />
                    </button>
                </div>

                <div className="relative">
                    <AssetInput
                        label="You Receive"
                        assetId={toAsset}
                        onAssetChange={handleToAssetChange}
                        amount={toAmount}
                        onAmountChange={() => {}} // This is a calculated value, so the input is effectively read-only
                        assets={assets}
                    />
                    {isLoading && (
                        <div className="absolute right-4 top-12 flex items-center">
                            <SpinnerIcon size={16} className="text-primary" />
                        </div>
                    )}
                </div>

                {quote && (
                    <div className="mt-4 rounded-lg border border-border-color bg-input-bg/50 p-4">
                        <div className="flex flex-col gap-2.5 text-sm">
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Rate</span>
                                <span className="text-text-primary font-medium">1 {fromAssetData.ticker} ≈ {exchangeRate.toFixed(4)} {toAssetData.ticker}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Slippage Tolerance</span>
                                <span className="text-primary font-medium">{quote.slippage}%</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Minimum Received</span>
                                <span className="text-text-primary font-medium">{quote.minimumReceived} {toAssetData.ticker}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Price Impact</span>
                                <span className={`font-medium ${quote.priceImpact > 1 ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {quote.priceImpact.toFixed(2)}%
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Estimated Gas</span>
                                <span className="text-text-primary font-medium">~{quote.estimatedGas} ETH</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-4">
                    <button
                        className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 bg-primary text-primary-text text-base font-bold leading-normal tracking-wide transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                        disabled={!canSubmit}
                        onClick={handleExecuteSwap}
                    >
                        {isSwapping && <SpinnerIcon size={20} />}
                        <span>
                            {isSwapping
                                ? 'Swapping...'
                                : parseFloat(fromAmount) > fromAssetData.balance
                                    ? 'Insufficient Balance'
                                    : !quote
                                        ? 'Enter Amount'
                                        : 'Swap'
                            }
                        </span>
                    </button>
                </div>

                {statusMessage && (
                    <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                        statusVariant === 'error'
                            ? 'border-red-400/50 bg-red-500/10 text-red-200'
                            : statusVariant === 'success'
                            ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                            : 'border-white/10 bg-white/5 text-text-secondary'
                    }`}>
                        {statusMessage}
                        {progressStep && (
                            <div className="mt-1 text-xs text-text-secondary">{progressStep}</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Swap;
