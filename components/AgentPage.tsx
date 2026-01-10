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

const CommandIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

const SendIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const SettingsIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const TrashIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const DollarIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const CloseIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl border border-slate-700/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <DollarIcon size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Confirm Payment</h3>
            <p className="text-sm text-slate-400">Service Fee</p>
          </div>
        </div>

        <div className="bg-slate-700/50 rounded-xl p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-400">Amount</span>
            <span className="text-xl font-bold text-white">${requirements.price} USDC</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-400">Service</span>
            <span className="text-white">{requirements.description}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Network</span>
            <span className="text-white">{requirements.network}</span>
          </div>
        </div>

        <p className="text-sm text-slate-400 mb-4">
          This action requires a micropayment. Your passkey will be used to authorize the transaction.
        </p>

        <div className="flex gap-3">
          <button
            onClick={rejectPayment}
            className="flex-1 px-4 py-3 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={approvePayment}
            className="flex-1 px-4 py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-400 transition-colors"
          >
            Pay ${requirements.price}
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
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
          <CommandIcon size={20} className="text-blue-400" />
        </div>
      )}
      <div
        className={`max-w-[70%] rounded-2xl px-5 py-4 ${
          isUser
            ? 'bg-blue-500/10 text-white border border-blue-500/20'
            : message.error
            ? 'bg-red-500/10 text-red-200 border border-red-500/20'
            : 'bg-slate-800/80 text-slate-100 border border-slate-700/50'
        }`}
      >
        <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {message.content.split('\n').map((line, i) => {
            if (line.startsWith('**') && line.endsWith('**')) {
              return <p key={i} className="font-bold text-base mb-1">{line.slice(2, -2)}</p>;
            }
            if (line.startsWith('_') && line.endsWith('_')) {
              return <p key={i} className="italic text-slate-400 text-xs">{line.slice(1, -1)}</p>;
            }
            if (line.startsWith('- ') || line.startsWith('• ')) {
              return <p key={i} className="ml-2">{line}</p>;
            }
            return <p key={i}>{line}</p>;
          })}
        </div>
        {message.paymentInfo && (
          <div className="mt-2 pt-2 border-t border-slate-600/50 text-xs text-slate-400">
            Paid ${message.paymentInfo.amount} USDC
          </div>
        )}
        <div className="text-xs text-slate-500 mt-2">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl border border-slate-700/50">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">Settings</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Daily Budget (USDC)</label>
            <input
              type="number"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:border-blue-500"
              min="1"
              max="100"
              step="1"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Max Per Transaction (USDC)</label>
            <div className="px-4 py-3 bg-slate-700/30 border border-slate-600/30 rounded-xl text-slate-300">
              ${policy.maxPerTransaction.toFixed(2)} (fixed)
            </div>
          </div>

          <div className="bg-slate-700/30 rounded-xl p-4">
            <h4 className="text-sm font-medium text-white mb-3">Spending Summary</h4>
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

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <h4 className="text-sm font-medium text-blue-400 mb-1">Security</h4>
            <p className="text-xs text-slate-400">
              All payments require passkey authentication. Your keys never leave your device.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full mt-6 py-3 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-400 transition-colors"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
};

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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
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

  const percentUsed = (spending.today / policy.dailyBudget) * 100;
  const isNearLimit = percentUsed > 80;

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <CommandIcon size={28} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Smart Assistant</h1>
            <p className="text-sm text-slate-400">Execute commands and manage your wallet</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearMessages}
            className="p-3 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-colors"
            title="Clear history"
          >
            <TrashIcon size={18} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-3 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-colors"
            title="Settings"
          >
            <SettingsIcon size={18} />
          </button>
        </div>
      </div>

      {/* Spending Tracker */}
      <div className="bg-slate-800/50 rounded-xl p-4 mb-4 border border-slate-700/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Daily Limit</span>
          <span className={`text-sm font-medium ${isNearLimit ? 'text-amber-400' : 'text-slate-300'}`}>
            ${spending.today.toFixed(2)} / ${policy.dailyBudget.toFixed(2)} USDC
          </span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isNearLimit ? 'bg-amber-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 space-y-4 mb-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12">
            <div className="w-20 h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
              <CommandIcon size={40} className="text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">How can I help?</h3>
            <p className="text-slate-400 mb-6 max-w-md">
              Send tokens, swap currencies, check wallet risks, get prices, and view market updates.
            </p>
            <div className="grid grid-cols-2 gap-3 w-full max-w-md">
              {[
                { label: 'Check wallet', value: 'Analyze 0x742d35Cc6634C0532925a3b844Bc454e4438f44e' },
                { label: 'ETH price', value: 'What is the price of ETH?' },
                { label: 'Send tokens', value: 'Send 10 USDC to 0x...' },
                { label: 'Market news', value: 'Show me the latest crypto news' },
              ].map((suggestion) => (
                <button
                  key={suggestion.label}
                  onClick={() => setInputValue(suggestion.value)}
                  className="px-4 py-3 bg-slate-800/80 hover:bg-slate-700 text-sm text-slate-300 rounded-xl transition-colors text-left border border-slate-700/50 hover:border-blue-500/30"
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}

        {isProcessing && (
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <CommandIcon size={20} className="text-blue-400" />
            </div>
            <div className="bg-slate-800/80 rounded-2xl px-5 py-4 border border-slate-700/50">
              <div className="flex gap-1.5">
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
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a command..."
          disabled={isProcessing}
          className="flex-1 px-5 py-4 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 disabled:opacity-50 text-base"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isProcessing}
          className="px-6 py-4 bg-blue-500 text-white rounded-xl hover:bg-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SendIcon size={22} />
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
