import React from 'react';

export const Footer: React.FC = () => {
    return (
        <div className="absolute bottom-0 w-full p-8 flex justify-between items-center text-sm text-slate-500 z-20 font-medium">
            <div>
                © 2025 Arc Wallet
            </div>
            <div className="flex gap-8">
                <a href="#" className="hover:text-slate-300 transition-colors">Home</a>
                <a href="#" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-slate-300 transition-colors">Terms & Conditions</a>
            </div>
        </div>
    );
};
