import React from 'react';
import { WaveBackground } from './WaveBackground';
import arcLogo from '../assets/arclogo.png';
import { Footer } from './Footer';

interface PasskeySelectionScreenProps {
    hasExistingWallet: boolean;
    onSelectCreate: () => void;
    onSelectUnlock: () => void;
}

const PasskeySelectionScreen: React.FC<PasskeySelectionScreenProps> = ({
    hasExistingWallet,
    onSelectCreate,
    onSelectUnlock,
}) => {
    return (
        <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center overflow-hidden bg-transparent">
            {/* Background Pattern */}
            <div className="absolute inset-0 z-0">
                <WaveBackground showAnimation={true} />
            </div>

            {/* Top Left Logo */}
            <div className="absolute top-8 left-8 z-20 opacity-90 hover:opacity-100 transition-opacity cursor-pointer">
                <img
                    src={arcLogo}
                    alt="Arc Wallet"
                    className="w-20 h-20 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]"
                />
            </div>

            {/* Selection Container */}
            <div className="relative z-20 w-full max-w-lg px-4 animate-in fade-in zoom-in duration-700">
                <div className="space-y-8">

                    {/* Header */}
                    <div className="text-center space-y-4">
                        <h2 className="text-4xl font-light text-slate-100 tracking-tight drop-shadow-lg">
                            Welcome Back
                        </h2>
                        <p className="text-slate-400 text-lg">
                            Choose how to access your wallet
                        </p>
                    </div>

                    {/* Selection Cards */}
                    <div className="space-y-4">

                        {/* Create New Passkey Option */}
                        {!hasExistingWallet && (
                            <button
                                onClick={onSelectCreate}
                                className="w-full group"
                            >
                                <div className="relative p-6 rounded-lg bg-slate-900/60 border border-slate-600/30 backdrop-blur-sm hover:border-blue-400/50 transition-all duration-200 text-left">
                                    {/* Icon */}
                                    <div className="flex items-start gap-4">
                                        <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-400/30 flex items-center justify-center flex-shrink-0">
                                            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                            </svg>
                                        </div>

                                        <div className="flex-1">
                                            <h3 className="text-xl font-light text-slate-100 mb-1">Create New Passkey</h3>
                                            <p className="text-sm text-slate-400 leading-relaxed">
                                                First time or using a new device. Set up biometric authentication.
                                            </p>

                                            {/* Badge */}
                                            <div className="mt-3">
                                                <span className="inline-block text-xs font-semibold text-green-400 bg-green-400/10 px-2 py-1 rounded">
                                                    Recommended
                                                </span>
                                            </div>
                                        </div>

                                        {/* Arrow */}
                                        <div className="text-slate-400 group-hover:text-blue-400 transition-colors">
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        )}

                        {/* Use Existing Passkey Option */}
                        <button
                            onClick={onSelectUnlock}
                            className="w-full group"
                        >
                            <div className="relative p-6 rounded-lg bg-slate-900/60 border border-slate-600/30 backdrop-blur-sm hover:border-blue-400/50 transition-all duration-200 text-left">
                                {/* Icon */}
                                <div className="flex items-start gap-4">
                                    <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-400/30 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                                        </svg>
                                    </div>

                                    <div className="flex-1">
                                        <h3 className="text-xl font-light text-slate-100 mb-1">Use Existing Passkey</h3>
                                        <p className="text-sm text-slate-400 leading-relaxed">
                                            {hasExistingWallet
                                                ? 'Unlock your wallet with biometric authentication.'
                                                : 'Returning on this device. Authenticate with your passkey.'}
                                        </p>
                                    </div>

                                    {/* Arrow */}
                                    <div className="text-slate-400 group-hover:text-blue-400 transition-colors">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </button>
                    </div>

                    {/* Info Notice */}
                    <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-500/50 backdrop-blur-sm">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-blue-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p className="text-sm text-blue-200">
                                    Your wallet is secured with passkey authentication. No passwords or seed phrases required.
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <Footer />

            <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes zoom-in {
          from { transform: scale(0.95); }
          to { transform: scale(1); }
        }
        .animate-in {
          animation: fade-in 0.7s ease-out, zoom-in 0.7s ease-out;
        }
      `}</style>
        </div>
    );
};

export default PasskeySelectionScreen;
