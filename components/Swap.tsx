import React, { useState, useMemo, useEffect } from 'react';
import { useArcAccount } from '../contexts/ArcAccountContext';
import { ExpandIcon, SwapIcon } from './Icons';


const initialAssets = [
    { id: 'usdc', name: 'USD Coin', ticker: 'USDC', balance: 0, price: 1 },
    { id: 'eurc', name: 'Euro Coin', ticker: 'EURC', balance: 0, price: 1.07 },
    { id: 'mxnb', name: 'MXN Coin', ticker: 'MXNB', balance: 0, price: 0.058 },
];

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
    const [assets, setAssets] = useState(initialAssets);

    useEffect(() => {
        const balance = snapshot ? Number(snapshot.balanceWei) / Number(10n ** 18n) : 0;
        const next = initialAssets.map(asset =>
            asset.id === 'usdc' ? { ...asset, balance } : { ...asset, balance: 0 }
        );
        setAssets(next);
    }, [snapshot]);

    const [fromAsset, setFromAsset] = useState('usdc');
    const [toAsset, setToAsset] = useState('eurc');
    const [fromAmount, setFromAmount] = useState('');
    
    const fromAssetData = assets.find(a => a.id === fromAsset)!;
    const toAssetData = assets.find(a => a.id === toAsset)!;

    const exchangeRate = useMemo(() => {
        if (!fromAssetData || !toAssetData || toAssetData.price === 0) return 0;
        return fromAssetData.price / toAssetData.price;
    }, [fromAssetData, toAssetData]);

    const toAmount = useMemo(() => {
        const amount = parseFloat(fromAmount);
        if (isNaN(amount) || amount <= 0) return '';
        return (amount * exchangeRate).toFixed(5);
    }, [fromAmount, exchangeRate]);

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
        const currentToAmount = toAmount;

        setFromAsset(currentToAsset);
        setToAsset(currentFromAsset);
        setFromAmount(currentToAmount);
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

                <AssetInput
                    label="You Receive"
                    assetId={toAsset}
                    onAssetChange={handleToAssetChange}
                    amount={toAmount}
                    onAmountChange={() => {}} // This is a calculated value, so the input is effectively read-only
                    assets={assets}
                />

                {parseFloat(fromAmount) > 0 && (
                    <div className="mt-4 rounded-lg border border-border-color bg-input-bg/50 p-4">
                        <div className="flex flex-col gap-2.5 text-sm">
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Rate</span>
                                <span className="text-text-primary font-medium">1 {fromAssetData.ticker} ≈ {exchangeRate.toFixed(4)} {toAssetData.ticker}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Slippage Tolerance</span>
                                <span className="text-primary font-medium">0.5%</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-text-secondary">Network Fee</span>
                                <span className="text-text-primary font-medium">~0.0005 USDC</span>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="mt-4">
                     <button className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 bg-primary text-primary-text text-base font-bold leading-normal tracking-wide transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!parseFloat(fromAmount) || parseFloat(fromAmount) > fromAssetData.balance}
                     >
                        {parseFloat(fromAmount) > fromAssetData.balance ? 'Insufficient Balance' : 'Swap'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Swap;
