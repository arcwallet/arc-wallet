/**
 * Arc Assistant Page
 *
 * Smart command interface for Arc Wallet.
 * Execute transactions, check balances, and get market info.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAgent } from '../contexts/AgentContext';

// ============================================
// Icons
// ============================================

const SparkIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 3v4m0 14v-4m9-5h-4M7 12H3m15.364-6.364l-2.828 2.828M8.464 15.536l-2.828 2.828m12.728 0l-2.828-2.828M8.464 8.464L5.636 5.636" />
  </svg>
);

const ArrowUpIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

const SettingsIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2m0 18v2m-9-11h2m18 0h-2m-2.636-6.364l-1.414 1.414M7.05 16.95l-1.414 1.414m12.728 0l-1.414-1.414M7.05 7.05L5.636 5.636" />
  </svg>
);

const RefreshIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
);

const WalletIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
  </svg>
);

const CloseIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SendTokenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="7" y1="17" x2="17" y2="7" />
    <polyline points="7 7 17 7 17 17" />
  </svg>
);

const SwapTokenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 3l4 4-4 4" />
    <path d="M20 7H4" />
    <path d="M8 21l-4-4 4-4" />
    <path d="M4 17h16" />
  </svg>
);

const ChartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

// ============================================
// Payment Approval Modal
// ============================================

const PaymentApprovalModal: React.FC = () => {
  const { pendingPayment, approvePayment, rejectPayment } = useAgent();

  if (!pendingPayment) return null;

  const { requirements } = pendingPayment;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1f2e] rounded-2xl p-6 max-w-sm mx-4 shadow-2xl border border-slate-700/50">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
            <WalletIcon size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Confirm Payment</h3>
            <p className="text-sm text-slate-400">Service Fee Required</p>
          </div>
        </div>

        <div className="bg-[#0d1117] rounded-xl p-4 mb-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Amount</span>
            <span className="text-lg font-bold text-white">${requirements.price} USDC</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Service</span>
            <span className="text-white text-sm">{requirements.description || 'Query'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Network</span>
            <span className="text-white text-sm">{requirements.network}</span>
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-5 text-center">
          Passkey authentication required to confirm
        </p>

        <div className="flex gap-3">
          <button
            onClick={rejectPayment}
            className="flex-1 px-4 py-3 rounded-xl bg-slate-700/50 text-slate-300 font-medium hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={approvePayment}
            className="flex-1 px-4 py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-400 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Chat Message
// ============================================

interface ChatMessageProps {
  message: {
    id: string;
    role: 'user' | 'agent';
    content: string;
    timestamp: number;
    paymentInfo?: { txHash: string; amount: string };
    error?: string;
  };
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center flex-shrink-0 border border-blue-500/20">
          <SparkIcon size={18} className="text-blue-400" />
        </div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-500 text-white'
            : message.error
            ? 'bg-red-500/10 text-red-300 border border-red-500/20'
            : 'bg-[#1a1f2e] text-slate-200 border border-slate-700/50'
        }`}
      >
        <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {message.content.split('\n').map((line, i) => {
            if (line.startsWith('**') && line.endsWith('**')) {
              return <p key={i} className="font-semibold text-[15px] mb-1">{line.slice(2, -2)}</p>;
            }
            if (line.startsWith('_') && line.endsWith('_')) {
              return <p key={i} className="italic text-slate-400 text-xs mt-2">{line.slice(1, -1)}</p>;
            }
            if (line.startsWith('- ') || line.startsWith('• ')) {
              return <p key={i} className="ml-2 my-0.5">{line}</p>;
            }
            return line ? <p key={i} className="my-0.5">{line}</p> : <br key={i} />;
          })}
        </div>
        {message.paymentInfo && (
          <div className="mt-2 pt-2 border-t border-slate-600/30 text-xs text-slate-400 flex items-center gap-1">
            <WalletIcon size={12} />
            Paid ${message.paymentInfo.amount} USDC
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// Settings Panel
// ============================================

interface SettingsPanelProps {
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const { policy, updatePolicy, spending } = useAgent();
  const [dailyBudget, setDailyBudget] = useState(policy.dailyBudget.toString());

  const handleSave = () => {
    updatePolicy({ dailyBudget: parseFloat(dailyBudget) || 10 });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1f2e] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl border border-slate-700/50">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Settings</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 hover:bg-slate-700/50 rounded-lg transition-colors">
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Daily Budget (USDC)</label>
            <input
              type="number"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(e.target.value)}
              className="w-full px-4 py-3 bg-[#0d1117] border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50 transition-colors"
              min="1"
              max="100"
              step="1"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Max Per Transaction</label>
            <div className="px-4 py-3 bg-[#0d1117]/50 border border-slate-700/30 rounded-xl text-slate-400">
              ${policy.maxPerTransaction.toFixed(2)} USDC
            </div>
          </div>

          <div className="bg-[#0d1117] rounded-xl p-4">
            <h4 className="text-sm font-medium text-white mb-3">Usage Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Today</span>
                <span className="text-white font-medium">${spending.today.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">This Week</span>
                <span className="text-white font-medium">${spending.thisWeek.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">This Month</span>
                <span className="text-white font-medium">${spending.thisMonth.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full mt-6 py-3 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-400 transition-colors"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

// ============================================
// Quick Action Button
// ============================================

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

const QuickAction: React.FC<QuickActionProps> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1f2e] hover:bg-[#242938] text-sm text-slate-300 rounded-xl transition-all border border-slate-700/50 hover:border-blue-500/30 hover:text-white"
  >
    <span className="text-blue-400">{icon}</span>
    {label}
  </button>
);

// ============================================
// Main Agent Page Component
// ============================================

const AgentPage: React.FC = () => {
  const {
    messages,
    isProcessing,
    sendMessage,
    clearMessages,
    spending,
    policy,
  } = useAgent();

  const [inputValue, setInputValue] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim() || isProcessing) return;

      const message = inputValue.trim();
      setInputValue('');
      await sendMessage(message);
    },
    [inputValue, isProcessing, sendMessage]
  );

  const handleQuickAction = (value: string) => {
    setInputValue(value);
    inputRef.current?.focus();
  };

  const percentUsed = (spending.today / policy.dailyBudget) * 100;

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center border border-blue-500/20">
            <SparkIcon size={22} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Assistant</h1>
            <p className="text-xs text-slate-500">Powered by Arc</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearMessages}
            className="p-2.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 rounded-lg transition-colors"
            title="Clear chat"
          >
            <RefreshIcon size={16} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 rounded-lg transition-colors"
            title="Settings"
          >
            <SettingsIcon size={16} />
          </button>
        </div>
      </div>

      {/* Budget Bar */}
      <div className="bg-[#1a1f2e] rounded-xl p-3 mb-4 border border-slate-700/30">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-500">Daily Budget</span>
          <span className="text-xs text-slate-400">
            ${spending.today.toFixed(2)} / ${policy.dailyBudget.toFixed(2)}
          </span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto rounded-xl p-4 space-y-4 mb-4 bg-[#0d1117]/50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center mb-5 border border-blue-500/20">
              <SparkIcon size={32} className="text-blue-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1">How can I help?</h3>
            <p className="text-slate-500 text-sm mb-6 max-w-sm">
              Send tokens, swap currencies, analyze wallets, and get market data
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <QuickAction
                icon={<SendTokenIcon />}
                label="Send"
                onClick={() => handleQuickAction('Send 10 USDC to 0x...')}
              />
              <QuickAction
                icon={<SwapTokenIcon />}
                label="Swap"
                onClick={() => handleQuickAction('Swap 50 USDC to EURC')}
              />
              <QuickAction
                icon={<ChartIcon />}
                label="Price"
                onClick={() => handleQuickAction('What is the price of ETH?')}
              />
              <QuickAction
                icon={<ShieldIcon />}
                label="Analyze"
                onClick={() => handleQuickAction('Analyze 0x742d35Cc6634C0532925a3b844Bc454e4438f44e')}
              />
            </div>
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}

        {isProcessing && (
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center flex-shrink-0 border border-blue-500/20">
              <SparkIcon size={18} className="text-blue-400" />
            </div>
            <div className="bg-[#1a1f2e] rounded-2xl px-4 py-3 border border-slate-700/50">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a message..."
          disabled={isProcessing}
          className="flex-1 px-4 py-3.5 bg-[#1a1f2e] border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 disabled:opacity-50 text-sm"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isProcessing}
          className="px-5 py-3.5 bg-blue-500 text-white rounded-xl hover:bg-blue-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ArrowUpIcon size={20} />
        </button>
      </form>

      {/* Settings Panel */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {/* Payment Approval Modal */}
      <PaymentApprovalModal />
    </div>
  );
};

export default AgentPage;
