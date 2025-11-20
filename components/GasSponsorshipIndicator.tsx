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
    estimatedGas,
}) => {
    if (!isSponsored) {
        return null;
    }

    return (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 mb-4">
            <div className="flex items-center gap-2">
                <span className="text-green-400 text-lg">⚡</span>
                <span className="text-sm font-semibold text-green-400">
                    Gas Sponsored
                </span>
            </div>
            <p className="text-xs text-green-300/80 mt-1">
                This transaction is free! No gas fees required.
            </p>
            {estimatedGas && (
                <p className="text-xs text-green-300/60 mt-1">
                    Saved: {estimatedGas} ETH
                </p>
            )}
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
            <span className="text-green-400 font-medium flex items-center gap-1">
                FREE ⚡
            </span>
        );
    }

    return (
        <span className="text-text-primary font-medium">
            {gasFee || '—'}
        </span>
    );
};
