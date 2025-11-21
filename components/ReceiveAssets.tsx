import React, { useState, useEffect, useRef } from 'react';
import { useArcAccount } from '../contexts/ArcAccountContext';
import { CopyIcon, ChevronDownIcon } from './Icons';
import QRCode from 'qrcode';
import { getAllSupportedTokens, TokenInfo } from '../config/tokens';

const ReceiveAssets: React.FC = () => {
    const { address } = useArcAccount();
    const walletAddress = address || "0x0000000000000000000000000000000000000000";
    const [copyButtonText, setCopyButtonText] = useState('Copy Address');
    const [selectedToken, setSelectedToken] = useState<TokenInfo>(getAllSupportedTokens()[0]);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleCopyAddress = () => {
        if (!address) return;
        navigator.clipboard.writeText(walletAddress);
        setCopyButtonText('Copied!');
        setTimeout(() => setCopyButtonText('Copy Address'), 2000);
    };

    useEffect(() => {
        if (address && canvasRef.current) {
            QRCode.toCanvas(canvasRef.current, address, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                errorCorrectionLevel: 'M'
            }).catch((err) => {
                console.error('QR Code generation failed:', err);
            });
        }
    }, [address]);

    return (
        <div className="flex flex-col w-full max-w-sm mx-auto items-center">
            {/* PageHeading */}
            <div className="flex flex-wrap justify-center gap-3 p-4 text-center">
                <h1 className="text-text-primary text-3xl font-bold leading-tight tracking-[-0.03em]">Receive Funds</h1>
            </div>

            {/* Wallet Address Card */}
            <div className="w-full flex items-center justify-between gap-4 rounded-lg bg-slate-900/60 backdrop-blur-sm border border-slate-500/50 p-4 shadow-md">
                <p className="text-text-primary text-base font-medium leading-tight truncate">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'No Wallet Connected'}</p>
                <button
                    onClick={handleCopyAddress}
                    className="flex-shrink-0 text-text-primary hover:text-primary transition-colors disabled:opacity-50"
                    aria-label="Copy wallet address"
                    disabled={!address}
                >
                    <CopyIcon size={18} />
                </button>
            </div>

            {/* SingleButton */}
            <div className="w-full flex px-0 py-2 mt-2">
                <button
                    onClick={handleCopyAddress}
                    disabled={!address}
                    className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 flex-1 bg-slate-200 hover:bg-white text-slate-900 text-base font-semibold leading-normal tracking-[0.015em] transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-50"
                >
                    <span className="truncate">{copyButtonText}</span>
                </button>
            </div>

            {/* Token Selector */}
            <div className="w-full flex flex-col gap-2 mt-4">
                <label className="text-text-secondary text-sm font-normal px-1" htmlFor="token-select">Receiving Token</label>
                <div className="relative">
                    <select
                        id="token-select"
                        value={selectedToken.symbol}
                        onChange={(e) => {
                            const token = getAllSupportedTokens().find(t => t.symbol === e.target.value);
                            if (token) setSelectedToken(token);
                        }}
                        className="w-full appearance-none rounded-lg border border-slate-500/50 bg-slate-900/60 backdrop-blur-sm px-4 py-3 text-white focus:border-blue-400 focus:ring-blue-400/50 focus:ring-1 transition-all"
                    >
                        {getAllSupportedTokens().map((token) => (
                            <option key={token.symbol} value={token.symbol}>
                                {token.name} ({token.symbol})
                            </option>
                        ))}
                    </select>
                    <ChevronDownIcon size={20} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary" />
                </div>
            </div>

            {/* QR Code */}
            <div className="flex w-full grow bg-transparent @container p-4 mt-4">
                <div className="mx-auto w-full max-w-[240px] gap-1 overflow-hidden bg-white @[480px]:gap-2 aspect-square rounded-lg flex items-center justify-center p-3 shadow-md">
                    {address ? (
                        <canvas
                            ref={canvasRef}
                            className="w-full h-full max-w-[200px] max-h-[200px]"
                            aria-label={`QR code for wallet address ${walletAddress}`}
                        />
                    ) : (
                        <div className="flex items-center justify-center w-full h-full text-gray-400 text-sm text-center">
                            Connect wallet to generate QR code
                        </div>
                    )}
                </div>
            </div>

            {/* MetaText (QR Code Caption) */}
            <p className="text-text-secondary text-sm font-normal leading-normal pb-3 pt-1 px-4 text-center">Scan to deposit</p>

            {/* Network Info */}
            <div className="flex justify-center items-center py-2">
                <p className="text-text-secondary text-sm font-normal leading-normal">Network: Arc Testnet • Token: {selectedToken.symbol}</p>
            </div>

            {/* Footer Instruction */}
            <div className="pt-4 mt-auto">
                <p className="text-text-secondary text-xs font-normal leading-normal text-center">Only send {selectedToken.symbol} to this address. Sending other tokens may result in permanent loss.</p>
            </div>
        </div>
    );
};

export default ReceiveAssets;