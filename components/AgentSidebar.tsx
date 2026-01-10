/**
 * Arc Agent Sidebar
 *
 * Right-side panel for Arc Agent interaction:
 * - Chat interface
 * - Spending tracker
 * - Payment approval
 * - Settings
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAgent } from '../contexts/AgentContext';
import { RobotIcon } from './Icons';

// ============================================
// Icons
// ============================================

const CloseIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
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

// ============================================
// Payment Approval Modal
// ============================================

const PaymentApprovalModal: React.FC = () => {
  const { pendingPayment, approvePayment, rejectPayment } = useAgent();

  if (!pendingPayment) return null;

  const { requirements } = pendingPayment;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl border border-slate-600/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
            <DollarIcon size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Payment Required</h3>
            <p className="text-sm text-slate-400">x402 Service Fee</p>
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
// Spending Tracker
// ============================================

const SpendingTracker: React.FC = () => {
  const { spending, policy } = useAgent();

  const percentUsed = (spending.today / policy.dailyBudget) * 100;
  const isNearLimit = percentUsed > 80;

  return (
    <div className="px-4 py-3 border-b border-slate-700/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">Today's Spending</span>
        <span className={`text-xs font-medium ${isNearLimit ? 'text-amber-400' : 'text-slate-300'}`}>
          ${spending.today.toFixed(2)} / ${policy.dailyBudget.toFixed(2)}
        </span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isNearLimit ? 'bg-amber-500' : 'bg-blue-500'
          }`}
          style={{ width: `${Math.min(percentUsed, 100)}%` }}
        />
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
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <RobotIcon size={16} className="text-white" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-500 text-white'
            : message.error
            ? 'bg-red-500/20 text-red-200 border border-red-500/30'
            : 'bg-slate-700/50 text-slate-100'
        }`}
      >
        <div className="text-sm whitespace-pre-wrap break-words">
          {message.content.split('\n').map((line, i) => {
            // Simple markdown-like formatting
            if (line.startsWith('**') && line.endsWith('**')) {
              return <p key={i} className="font-bold">{line.slice(2, -2)}</p>;
            }
            if (line.startsWith('_') && line.endsWith('_')) {
              return <p key={i} className="italic text-slate-400">{line.slice(1, -1)}</p>;
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
        <div className="text-xs text-slate-500 mt-1">
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
    <div className="absolute inset-0 bg-slate-800 z-10 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <h3 className="font-semibold text-white">Agent Settings</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <CloseIcon size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
          <h4 className="text-sm font-medium text-white mb-2">Spending Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Today</span>
              <span className="text-white">${spending.today.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">This Week</span>
              <span className="text-white">${spending.thisWeek.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">This Month</span>
              <span className="text-white">${spending.thisMonth.toFixed(2)}</span>
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

      <div className="p-4 border-t border-slate-700/50">
        <button
          onClick={handleSave}
          className="w-full py-3 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-400 transition-colors"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
};

// ============================================
// Main Sidebar Component
// ============================================

const AgentSidebar: React.FC = () => {
  const {
    isOpen,
    closeAgent,
    messages,
    isProcessing,
    sendMessage,
    clearMessages,
  } = useAgent();

  const [inputValue, setInputValue] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when sidebar opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

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

  // Don't render if closed
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 md:hidden"
        onClick={closeAgent}
      />

      {/* Sidebar */}
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-slate-800 border-l border-slate-700/50 shadow-2xl z-40 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/90 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <RobotIcon size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Arc Agent</h2>
              <p className="text-xs text-slate-400">x402 Enabled</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearMessages}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              title="Clear history"
            >
              <TrashIcon size={16} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              title="Settings"
            >
              <SettingsIcon size={18} />
            </button>
            <button
              onClick={closeAgent}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <CloseIcon size={20} />
            </button>
          </div>
        </div>

        {/* Spending Tracker */}
        <SpendingTracker />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mb-4">
                <RobotIcon size={32} className="text-blue-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Hi, I'm Arc Agent</h3>
              <p className="text-sm text-slate-400 mb-4">
                I can help you send tokens, swap, analyze wallets, and get market data.
              </p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                {[
                  'Analyze 0x742d...',
                  'Price of ETH',
                  'Send 10 USDC',
                  'Market news',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInputValue(suggestion)}
                    className="px-3 py-2 bg-slate-700/50 hover:bg-slate-700 text-sm text-slate-300 rounded-lg transition-colors text-left"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
          )}

          {isProcessing && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <RobotIcon size={16} className="text-white" />
              </div>
              <div className="bg-slate-700/50 rounded-2xl px-4 py-3">
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
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700/50">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Arc Agent..."
              disabled={isProcessing}
              className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isProcessing}
              className="px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SendIcon size={20} />
            </button>
          </div>
        </form>

        {/* Settings Panel */}
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      </aside>

      {/* Payment Approval Modal */}
      <PaymentApprovalModal />
    </>
  );
};

export default AgentSidebar;
