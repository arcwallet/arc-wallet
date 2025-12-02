import React from 'react';

interface GasSponsorshipIndicatorProps {
    isSponsored: boolean;
    estimatedGas?: string;
}

/**
 * Gas Sponsorship Indicator
 * Shows when a transaction is sponsored (gasless)
 */
export const GasSponsorshipIndicator: React.FC<GasSponsorshipIndicatorProps> = ({
    isSponsored,
}) => {
    if (!isSponsored) {
        return null;
    }

    return (
        <div className="rounded-lg bg-slate-800/60 border border-slate-600/50 p-3 mb-4">
            <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                    </svg>
                </div>
                <div>
                    <span className="text-sm font-medium text-white">
                        Gas Sponsored
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Zero transaction fees
                    </p>
                </div>
            </div>
        </div>
    );
};

interface GasFeeBadgeProps {
    isSponsored: boolean;
    gasFee?: string;
}

/**
 * Gas Fee Badge
 * Shows gas fee or "FREE" if sponsored
 */
export const GasFeeBadge: React.FC<GasFeeBadgeProps> = ({ isSponsored, gasFee }) => {
    if (isSponsored) {
        return (
            <span className="text-blue-400 font-medium flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
                FREE
            </span>
        );
    }

    return (
        <span className="text-text-primary font-medium">
            {gasFee || '—'}
        </span>
    );
};
