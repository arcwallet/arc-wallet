import React from 'react';

export const Footer: React.FC = () => {
    return (
        <div className="absolute bottom-0 w-full p-8 flex justify-between items-center text-sm text-slate-500 z-20 font-medium">
            <div>
                © 2025 Arc Wallet
            </div>
            <div className="flex gap-8">
                <button
                    onClick={() => window.location.href = '/'}
                    className="hover:text-slate-300 transition-colors bg-transparent border-none cursor-pointer p-0 text-sm font-medium text-slate-500"
                >
                    Home
                </button>
                <button
                    onClick={() => {
                        window.history.pushState({}, '', '/privacy-policy');
                        window.dispatchEvent(new PopStateEvent('popstate'));
                    }}
                    className="hover:text-slate-300 transition-colors bg-transparent border-none cursor-pointer p-0 text-sm font-medium text-slate-500"
                >
                    Privacy Policy
                </button>
                <button
                    onClick={() => {
                        window.history.pushState({}, '', '/terms-and-conditions');
                        window.dispatchEvent(new PopStateEvent('popstate'));
                    }}
                    className="hover:text-slate-300 transition-colors bg-transparent border-none cursor-pointer p-0 text-sm font-medium text-slate-500"
                >
                    Terms & Conditions
                </button>
            </div>
        </div>
    );
};
