import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';

const WalletDashboardSimple: React.FC = () => {
  const { sessionKey, address } = useWallet();
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="min-h-screen w-full bg-[#09121D] text-slate-100 font-sans">
      {/* Header */}
      <div className="p-5 border-b border-slate-500/30 bg-slate-900/60 backdrop-blur-sm">
        <h1 className="text-2xl font-bold">🚀 Arc Wallet Dashboard</h1>
        <p className="text-slate-400">Welcome to your Arc Wallet!</p>
        {sessionKey && (
          <p className="text-xs text-slate-500 mt-1">
            Address: {sessionKey.address.slice(0, 6)}...{sessionKey.address.slice(-4)}
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="p-5 flex gap-3 flex-wrap">
        {['home', 'send', 'receive', 'swap', 'bridge', 'settings'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-full border transition-all capitalize ${activeTab === tab
              ? 'bg-blue-500/20 border-blue-400 text-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.3)]'
              : 'bg-slate-800/40 border-slate-600/30 text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-5">
        {activeTab === 'home' && (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4">💰 Portfolio</h2>
            <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-xl border border-slate-500/30 my-5">
              <h3 className="text-slate-400 text-sm uppercase tracking-wide">Total Balance</h3>
              <p className="text-4xl font-light text-white my-2">$0.00 USD</p>
              <p className="text-slate-500 text-sm">No tokens detected</p>
            </div>
          </div>
        )}

        {activeTab === 'send' && (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4">📤 Send Assets</h2>
            <div className="bg-slate-900/60 backdrop-blur-sm p-8 rounded-xl border border-slate-500/30 my-5 flex flex-col items-center justify-center min-h-[200px]">
              <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">📤</span>
              </div>
              <p className="text-slate-300 text-lg mb-2">Send functionality coming soon</p>
              <p className="text-slate-500 text-sm max-w-xs">You'll be able to send tokens to any address on the Arc network.</p>
            </div>
          </div>
        )}

        {activeTab === 'receive' && (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4">📥 Receive Assets</h2>
            <div className="bg-slate-900/60 backdrop-blur-sm p-8 rounded-xl border border-slate-500/30 my-5 flex flex-col items-center justify-center min-h-[200px]">
              <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">📥</span>
              </div>
              <p className="text-slate-300 text-lg mb-2">Receive functionality coming soon</p>
              <p className="text-slate-500 text-sm max-w-xs">View your address and QR code to receive tokens.</p>
            </div>
          </div>
        )}

        {activeTab === 'swap' && (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4">🔄 Swap Assets</h2>
            <div className="bg-slate-900/60 backdrop-blur-sm p-8 rounded-xl border border-slate-500/30 my-5 flex flex-col items-center justify-center min-h-[200px]">
              <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">🔄</span>
              </div>
              <p className="text-slate-300 text-lg mb-2">Swap functionality coming soon</p>
              <p className="text-slate-500 text-sm max-w-xs">Instantly swap between different tokens with low fees.</p>
            </div>
          </div>
        )}

        {activeTab === 'bridge' && (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4">🌉 Bridge Assets</h2>
            <div className="bg-slate-900/60 backdrop-blur-sm p-8 rounded-xl border border-slate-500/30 my-5 flex flex-col items-center justify-center min-h-[200px]">
              <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">🌉</span>
              </div>
              <p className="text-slate-300 text-lg mb-2">Bridge functionality coming soon</p>
              <p className="text-slate-500 text-sm max-w-xs">Transfer assets between Arc and other networks.</p>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4">⚙️ Settings</h2>
            <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-xl border border-slate-500/30 text-left space-y-2">
              <h3 className="text-lg font-medium text-white mb-3">Wallet Info</h3>
              {sessionKey && (
                <>
                  <p className="text-slate-300"><strong className="text-slate-500">Address:</strong> {sessionKey.address}</p>
                  <p className="text-slate-300"><strong className="text-slate-500">Network:</strong> Arc Testnet</p>
                  <p className="text-green-400"><strong className="text-slate-500">Status:</strong> ✅ Connected</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletDashboardSimple;