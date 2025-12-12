import React, { useMemo, useState } from 'react';
import { useCircleWallet } from '../contexts/CircleWalletContext';
import { useArcAccount } from '../contexts/ArcAccountContext';
import { CIRCLE_FAUCET_URL } from '../config/app.config';
import { formatUSDCAmount } from '../utils/format';
import { CopyIcon, CheckCircleIcon } from './Icons';

const Faucet: React.FC = () => {
    const { address: passkeyAddress } = useCircleWallet();
    const { address: arcAddress } = useArcAccount();
    const address = passkeyAddress || arcAddress;
    const walletAddress = address || "0x0000000000000000000000000000000000000000";

    const [statusMessage] = useState('Circle testnet faucet limits requests to 1 USDC per hour.');
    const [isCopied, setIsCopied] = useState(false);

    const circleFaucetUrl = useMemo(() => CIRCLE_FAUCET_URL, []);

    const handleCopyAddress = () => {
        if (!address) return;
        navigator.clipboard.writeText(walletAddress);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleOpenFaucet = () => {
        window.open(circleFaucetUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="relative flex flex-1 items-center justify-center h-full">
            <div className="flex w-full max-w-lg flex-col items-center gap-8 text-center">
                {/* PageHeading */}
                <div className="flex w-full flex-col items-center gap-3">
                    <p className="text-text-primary text-4xl font-bold leading-tight tracking-[-0.03em]">USDC Faucet</p>
                    <p className="text-text-secondary text-base font-normal leading-normal">
                        Request Arc Testnet USDC through Circle's official faucet. Maximum 1 USDC, hourly limit applies.
                    </p>
                </div>

                {/* Wallet Address Display Card */}
                <div className="w-full rounded-xl border border-border-color bg-surface p-4 text-left">
                    <label className="flex flex-col">
                        <p className="text-text-secondary text-sm font-medium leading-normal pb-2">Your Wallet Address</p>
                        <div className="flex w-full flex-1 items-center">
                            <input
                                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden border-none bg-transparent p-0 text-text-primary placeholder:text-text-secondary focus:outline-0 focus:ring-0 font-mono"
                                readOnly
                                value={address ? walletAddress : 'No Wallet Connected'}
                            />
                            <button
                                onClick={handleCopyAddress}
                                disabled={!address}
                                className="text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
                            >
                                {isCopied ? <CheckCircleIcon size={24} /> : <CopyIcon size={24} />}
                            </button>
                        </div>
                    </label>
                </div>

                {/* Primary Action Button */}
                <div className="flex w-full flex-col items-center gap-2">
                    <button
                        onClick={handleOpenFaucet}
                        disabled={!address}
                        className="flex h-12 w-full min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-primary px-5 text-base font-bold leading-normal tracking-[0.015em] text-primary-text transition-colors hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        <span className="truncate">Go to Circle Faucet</span>
                    </button>
                    <p className="text-xs text-text-secondary">
                        Hourly limit: {formatUSDCAmount(1n * 10n ** 18n).display}. If needed, update the amount field in Circle interface to this value.
                    </p>
                    {statusMessage && <p className={`text-sm font-normal leading-normal pt-1 text-text-secondary`}>{statusMessage}</p>}
                </div>
            </div>

        </div>
    );
};

export default Faucet;
