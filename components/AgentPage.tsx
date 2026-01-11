import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowUpRight,
  ArrowLeftRight,
  GitBranch,
  ShieldCheck,
  TrendingUp,
  Clock,
  SlidersHorizontal,
  RotateCcw,
  ArrowUp,
  X,
  Check,
  AlertCircle,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Calendar,
  XCircle,
} from 'lucide-react';
import { useAgent } from '../contexts/AgentContext';
import { agentService } from '../services/agentService';
import { scheduledTransactionService, type ScheduledTransaction } from '../services/scheduledTransactionService';
import { useCircleWallet } from '../contexts/CircleWalletContext';

const tokens = {
  // Backgrounds
  bgPrimary: '#0B0F14',
  bgSecondary: '#12171E',
  surface: '#1A1F28',
  surfaceHover: '#1E242D',

  // Borders
  border: '#2A3441',
  borderHover: '#3B82F6',

  // Text
  textPrimary: '#F8FAFC',
  textSecondary: '#64748B',
  textTertiary: '#475569',

  // Accents
  accent: '#3B82F6',
  accentSecondary: '#8B5CF6',
  success: '#22C55E',
  warning: '#EAB308',
  danger: '#EF4444',

  // Highlight
  highlight: 'rgba(59, 130, 246, 0.08)',

  // Transitions
  transition: '150ms ease-out',
};

const DiamondIcon: React.FC<{ size?: number; className?: string; style?: React.CSSProperties }> = ({
  size = 20,
  className = '',
  style = {},
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={style}
  >
    <path
      d="M12 2L2 9L12 22L22 9L12 2Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M2 9H22"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M12 2L8 9L12 22L16 9L12 2Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

const ActionCard: React.FC<ActionCardProps> = ({
  icon,
  title,
  description,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="group text-left p-4 rounded-lg transition-all duration-150 ease-out"
    style={{
      backgroundColor: tokens.surface,
      border: `1px solid ${tokens.border}`,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = tokens.surfaceHover;
      e.currentTarget.style.borderColor = tokens.accent;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = tokens.surface;
      e.currentTarget.style.borderColor = tokens.border;
    }}
    onMouseDown={(e) => {
      e.currentTarget.style.transform = 'scale(0.98)';
    }}
    onMouseUp={(e) => {
      e.currentTarget.style.transform = 'scale(1)';
    }}
  >
    <div
      className="mb-3"
      style={{ color: tokens.textSecondary }}
    >
      {icon}
    </div>
    <h3
      className="text-sm font-semibold mb-1"
      style={{
        color: tokens.textPrimary,
        letterSpacing: '-0.02em',
      }}
    >
      {title}
    </h3>
    <p
      className="text-xs"
      style={{ color: tokens.textSecondary }}
    >
      {description}
    </p>
  </button>
);

interface SuggestionChipProps {
  text: string;
  onClick: () => void;
}

const SuggestionChip: React.FC<SuggestionChipProps> = ({ text, onClick }) => (
  <button
    onClick={onClick}
    className="px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-all duration-150 ease-out"
    style={{
      backgroundColor: 'transparent',
      border: `1px solid ${tokens.border}`,
      color: tokens.textSecondary,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = tokens.surface;
      e.currentTarget.style.color = tokens.textPrimary;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = 'transparent';
      e.currentTarget.style.color = tokens.textSecondary;
    }}
  >
    {text}
  </button>
);

interface BudgetBarProps {
  spent: number;
  limit: number;
  resetTime?: string;
}

const BudgetBar: React.FC<BudgetBarProps> = ({
  spent,
  limit,
  resetTime = '12:00',
}) => {
  const percentage = Math.min((spent / limit) * 100, 100);

  const getBarColor = () => {
    if (percentage >= 80) return tokens.danger;
    if (percentage >= 50) return tokens.warning;
    return tokens.accent;
  };

  return (
    <div
      className="px-4 py-3 rounded-lg"
      style={{
        backgroundColor: tokens.surface,
        border: `1px solid ${tokens.border}`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-xs"
          style={{ color: tokens.textSecondary }}
        >
          Daily Limit
        </span>
        <span
          className="text-xs"
          style={{ color: tokens.textTertiary }}
        >
          Resets {resetTime}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div
          className="flex-1 h-0.5 rounded-full overflow-hidden"
          style={{ backgroundColor: tokens.border }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${percentage}%`,
              backgroundColor: getBarColor(),
            }}
          />
        </div>
        <span
          className="text-xs font-mono"
          style={{ color: tokens.textSecondary }}
        >
          ${spent.toFixed(2)} / ${limit.toFixed(2)}
        </span>
      </div>
    </div>
  );
};

interface ScheduledTransactionsPanelProps {
  transactions: ScheduledTransaction[];
  onCancel: (txId: string) => void;
}

const ScheduledTransactionsPanel: React.FC<ScheduledTransactionsPanelProps> = ({
  transactions,
  onCancel,
}) => {
  if (transactions.length === 0) return null;

  const formatTimeRemaining = (executeAt: number): string => {
    const now = Date.now();
    const diff = executeAt - now;
    if (diff <= 0) return 'Executing...';

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div
      className="mx-4 mb-3 rounded-lg overflow-hidden"
      style={{
        backgroundColor: tokens.surface,
        border: `1px solid ${tokens.border}`,
      }}
    >
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{
          borderBottom: `1px solid ${tokens.border}`,
          backgroundColor: tokens.bgSecondary,
        }}
      >
        <Calendar size={14} style={{ color: tokens.accent }} />
        <span
          className="text-xs font-medium"
          style={{ color: tokens.textPrimary }}
        >
          Scheduled Transactions ({transactions.length})
        </span>
      </div>

      <div className="divide-y" style={{ borderColor: tokens.border }}>
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="px-3 py-2 flex items-center justify-between"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-medium"
                  style={{ color: tokens.textPrimary }}
                >
                  {tx.params.amount} {tx.params.token}
                </span>
                <span
                  className="text-xs"
                  style={{ color: tokens.textTertiary }}
                >
                  to {tx.params.recipient?.slice(0, 6)}...{tx.params.recipient?.slice(-4)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Clock size={10} style={{ color: tokens.textSecondary }} />
                <span
                  className="text-xs font-mono"
                  style={{ color: tokens.accent }}
                >
                  {formatTimeRemaining(tx.executeAt)}
                </span>
              </div>
            </div>
            <button
              onClick={() => onCancel(tx.id)}
              className="p-1.5 rounded transition-colors"
              style={{
                color: tokens.danger,
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${tokens.danger}20`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Cancel transaction"
            >
              <XCircle size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  paymentInfo?: { txHash: string; amount: string };
  error?: string;
}

const ChatMessage: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      // Bold text
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <p key={i} className="text-sm font-semibold mb-1" style={{ color: tokens.textPrimary }}>
            {parts.map((part, j) => (j % 2 === 1 ? part : <span key={j}>{part}</span>))}
          </p>
        );
      }
      // Italic text
      if (line.startsWith('_') && line.endsWith('_')) {
        return (
          <p key={i} className="text-xs mt-2" style={{ color: tokens.textTertiary }}>
            {line.slice(1, -1)}
          </p>
        );
      }
      // List items
      if (line.startsWith('• ') || line.startsWith('- ')) {
        return (
          <p key={i} className="text-sm ml-2 my-0.5" style={{ color: tokens.textSecondary }}>
            <span style={{ color: tokens.accent }}>•</span> {line.slice(2)}
          </p>
        );
      }
      // Links
      if (line.includes('[') && line.includes('](')) {
        const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
          return (
            <a
              key={i}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm flex items-center gap-1 my-1 hover:underline"
              style={{ color: tokens.accent }}
            >
              {linkMatch[1]}
              <ExternalLink size={12} />
            </a>
          );
        }
      }
      // Transaction hash
      if (line.includes('0x')) {
        const hashMatch = line.match(/0x[a-fA-F0-9]+/);
        if (hashMatch) {
          return (
            <p key={i} className="text-sm my-0.5 flex items-center gap-2 flex-wrap">
              <span style={{ color: tokens.textSecondary }}>{line.replace(hashMatch[0], '')}</span>
              <code
                className="px-2 py-0.5 rounded text-xs font-mono"
                style={{
                  backgroundColor: tokens.bgSecondary,
                  color: tokens.textPrimary,
                }}
              >
                {hashMatch[0].slice(0, 10)}...{hashMatch[0].slice(-8)}
              </code>
              <button
                onClick={() => copyToClipboard(hashMatch[0])}
                className="p-1 rounded hover:bg-white/5 transition-colors"
                style={{ color: tokens.textTertiary }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </p>
          );
        }
      }
      // Empty line
      if (!line.trim()) return <br key={i} />;
      // Regular text
      return (
        <p key={i} className="text-sm my-0.5" style={{ color: tokens.textSecondary }}>
          {line}
        </p>
      );
    });
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Agent indicator */}
      {!isUser && (
        <div
          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: tokens.surface,
            border: `1px solid ${tokens.border}`,
          }}
        >
          <DiamondIcon size={12} className="text-slate-400" />
        </div>
      )}

      {/* Message bubble */}
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${isUser ? 'ml-auto' : ''}`}
        style={
          isUser
            ? {
                backgroundColor: tokens.accent,
                color: tokens.textPrimary,
              }
            : message.error
            ? {
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: `1px solid rgba(239, 68, 68, 0.3)`,
              }
            : {
                backgroundColor: tokens.surface,
                border: `1px solid ${tokens.border}`,
              }
        }
      >
        <div className="leading-relaxed">
          {isUser ? (
            <p className="text-sm">{message.content}</p>
          ) : (
            renderContent(message.content)
          )}
        </div>

        {/* Payment info */}
        {message.paymentInfo && (
          <div
            className="mt-2 pt-2 text-xs flex items-center gap-2"
            style={{
              borderTop: `1px solid ${tokens.border}`,
              color: tokens.textTertiary,
            }}
          >
            <Check size={12} style={{ color: tokens.success }} />
            Paid ${message.paymentInfo.amount} USDC
          </div>
        )}
      </div>
    </div>
  );
};

const TypingIndicator: React.FC = () => (
  <div className="flex gap-3">
    <div
      className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
      style={{
        backgroundColor: tokens.surface,
        border: `1px solid ${tokens.border}`,
      }}
    >
      <DiamondIcon size={12} className="text-slate-400" />
    </div>
    <div
      className="rounded-lg px-4 py-3 flex items-center gap-1.5"
      style={{
        backgroundColor: tokens.surface,
        border: `1px solid ${tokens.border}`,
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{
            backgroundColor: tokens.textTertiary,
            animationDelay: `${i * 150}ms`,
          }}
        />
      ))}
    </div>
  </div>
);

const SettingsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { policy, updatePolicy, spending } = useAgent();
  const [dailyBudget, setDailyBudget] = useState(policy.dailyBudget.toString());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-4 rounded-lg p-6"
        style={{
          backgroundColor: tokens.bgSecondary,
          border: `1px solid ${tokens.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3
            className="text-base font-semibold"
            style={{
              color: tokens.textPrimary,
              letterSpacing: '-0.02em',
            }}
          >
            Settings
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/5 transition-colors"
            style={{ color: tokens.textSecondary }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label
              className="block text-xs mb-2"
              style={{ color: tokens.textSecondary }}
            >
              Daily Budget (USDC)
            </label>
            <input
              type="number"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm font-mono focus:outline-none transition-colors"
              style={{
                backgroundColor: tokens.bgPrimary,
                border: `1px solid ${tokens.border}`,
                color: tokens.textPrimary,
              }}
              onFocus={(e) => (e.target.style.borderColor = tokens.accent)}
              onBlur={(e) => (e.target.style.borderColor = tokens.border)}
            />
          </div>

          <div
            className="rounded-lg p-4"
            style={{
              backgroundColor: tokens.bgPrimary,
              border: `1px solid ${tokens.border}`,
            }}
          >
            <h4
              className="text-xs font-semibold mb-3"
              style={{ color: tokens.textSecondary }}
            >
              Usage
            </h4>
            <div className="space-y-2">
              {[
                { label: 'Today', value: spending.today },
                { label: 'This Week', value: spending.thisWeek },
                { label: 'This Month', value: spending.thisMonth },
              ].map((item) => (
                <div key={item.label} className="flex justify-between text-sm">
                  <span style={{ color: tokens.textTertiary }}>{item.label}</span>
                  <span className="font-mono" style={{ color: tokens.textPrimary }}>
                    ${item.value.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            updatePolicy({ dailyBudget: parseFloat(dailyBudget) || 10 });
            onClose();
          }}
          className="w-full mt-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
          style={{
            backgroundColor: tokens.accent,
            color: tokens.textPrimary,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Save
        </button>
      </div>
    </div>
  );
};

const PaymentModal: React.FC = () => {
  const { pendingPayment, approvePayment, rejectPayment } = useAgent();

  if (!pendingPayment) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-lg p-6"
        style={{
          backgroundColor: tokens.bgSecondary,
          border: `1px solid ${tokens.border}`,
        }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: tokens.surface,
              border: `1px solid ${tokens.border}`,
            }}
          >
            <ShieldCheck size={20} style={{ color: tokens.accent }} />
          </div>
          <div>
            <h3
              className="text-sm font-semibold"
              style={{ color: tokens.textPrimary }}
            >
              Confirm Payment
            </h3>
            <p className="text-xs" style={{ color: tokens.textSecondary }}>
              Service fee required
            </p>
          </div>
        </div>

        <div
          className="rounded-lg p-4 mb-5 space-y-3"
          style={{
            backgroundColor: tokens.bgPrimary,
            border: `1px solid ${tokens.border}`,
          }}
        >
          <div className="flex justify-between">
            <span className="text-xs" style={{ color: tokens.textSecondary }}>
              Amount
            </span>
            <span
              className="text-sm font-semibold font-mono"
              style={{ color: tokens.textPrimary }}
            >
              ${pendingPayment.requirements.price} USDC
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs" style={{ color: tokens.textSecondary }}>
              Service
            </span>
            <span className="text-xs" style={{ color: tokens.textPrimary }}>
              {pendingPayment.requirements.description}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={rejectPayment}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: tokens.surface,
              color: tokens.textSecondary,
              border: `1px solid ${tokens.border}`,
            }}
          >
            Cancel
          </button>
          <button
            onClick={approvePayment}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: tokens.accent,
              color: tokens.textPrimary,
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

const AgentPage: React.FC = () => {
  const {
    messages,
    isProcessing,
    sendMessage,
    clearMessages,
    spending,
    policy,
  } = useAgent();
  const { walletAddress } = useCircleWallet();

  const [inputValue, setInputValue] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [scheduledTxs, setScheduledTxs] = useState<ScheduledTransaction[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load and refresh scheduled transactions
  useEffect(() => {
    const loadScheduledTxs = () => {
      const pending = scheduledTransactionService.getPendingTransactions(walletAddress || undefined);
      setScheduledTxs(pending);
    };

    loadScheduledTxs();

    // Refresh every second for countdown timer
    const interval = setInterval(loadScheduledTxs, 1000);

    return () => clearInterval(interval);
  }, [walletAddress]);

  // Handle cancel scheduled transaction
  const handleCancelScheduledTx = useCallback((txId: string) => {
    try {
      scheduledTransactionService.cancel(txId);
      setScheduledTxs(prev => prev.filter(tx => tx.id !== txId));
    } catch (error) {
      console.error('Failed to cancel scheduled transaction:', error);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
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

  const actionCards = [
    {
      icon: <ArrowUpRight size={20} strokeWidth={1.5} />,
      title: 'Send',
      description: 'Transfer tokens',
      command: 'Send 10 USDC to 0x...',
    },
    {
      icon: <ArrowLeftRight size={20} strokeWidth={1.5} />,
      title: 'Swap',
      description: 'Exchange tokens',
      command: 'Swap 50 USDC to EURC',
    },
    {
      icon: <GitBranch size={20} strokeWidth={1.5} />,
      title: 'Bridge',
      description: 'Cross-chain',
      command: 'Bridge 25 USDC to Base',
    },
    {
      icon: <ShieldCheck size={20} strokeWidth={1.5} />,
      title: 'Analyze',
      description: 'Risk & security',
      command: 'Analyze 0x742d35Cc...',
    },
    {
      icon: <TrendingUp size={20} strokeWidth={1.5} />,
      title: 'Prices',
      description: 'Market data',
      command: 'BTC price',
    },
    {
      icon: <Clock size={20} strokeWidth={1.5} />,
      title: 'History',
      description: 'Past activity',
      command: 'Show recent transactions',
    },
  ];

  const suggestions = [
    'Check balance',
    'ETH price',
    'Recent transactions',
    'Gas fees',
    'Portfolio value',
  ];

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: tokens.bgPrimary }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          borderBottom: `1px solid ${tokens.border}`,
        }}
      >
        <div className="flex items-center gap-2">
          <DiamondIcon size={18} style={{ color: tokens.textSecondary }} />
          <div>
            <h1
              className="text-sm font-semibold"
              style={{
                color: tokens.textPrimary,
                letterSpacing: '-0.02em',
              }}
            >
              Assistant
            </h1>
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: tokens.success }}
              />
              <span className="text-xs" style={{ color: tokens.textTertiary }}>
                Ready
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={clearMessages}
            className="p-2 rounded-lg transition-colors"
            style={{ color: tokens.textSecondary }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = tokens.surface)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="Reset"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: tokens.textSecondary }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = tokens.surface)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="Settings"
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* Budget Bar */}
      <div className="px-4 py-3">
        <BudgetBar spent={spending.today} limit={policy.dailyBudget} />
      </div>

      {/* Scheduled Transactions */}
      <ScheduledTransactionsPanel
        transactions={scheduledTxs}
        onCancel={handleCancelScheduledTx}
      />

      {/* Messages Area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        style={{ backgroundColor: tokens.bgPrimary }}
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col">
            {/* Welcome */}
            <div className="text-center py-8">
              <h2
                className="text-lg font-semibold mb-1"
                style={{
                  color: tokens.textPrimary,
                  letterSpacing: '-0.02em',
                }}
              >
                What would you like to do?
              </h2>
              <p className="text-sm" style={{ color: tokens.textTertiary }}>
                Select an action or type a command
              </p>
            </div>

            {/* Action Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              {actionCards.map((card) => (
                <ActionCard
                  key={card.title}
                  icon={card.icon}
                  title={card.title}
                  description={card.description}
                  onClick={() => handleQuickAction(card.command)}
                />
              ))}
            </div>

            {/* Suggestions */}
            <div>
              <p
                className="text-xs mb-2"
                style={{ color: tokens.textTertiary }}
              >
                Suggestions
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {suggestions.map((suggestion) => (
                  <SuggestionChip
                    key={suggestion}
                    text={suggestion}
                    onClick={() => handleQuickAction(suggestion)}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isProcessing && <TypingIndicator />}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-3"
        style={{ borderTop: `1px solid ${tokens.border}` }}
      >
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-150"
          style={{
            backgroundColor: tokens.bgSecondary,
            border: `1px solid ${tokens.border}`,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Message..."
            disabled={isProcessing}
            className="flex-1 bg-transparent text-sm focus:outline-none disabled:opacity-50"
            style={{
              color: tokens.textPrimary,
            }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isProcessing}
            className="p-1.5 rounded-md transition-all duration-150 disabled:opacity-30"
            style={{
              backgroundColor: inputValue.trim() ? tokens.accent : 'transparent',
              color: inputValue.trim() ? tokens.textPrimary : tokens.textTertiary,
            }}
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </form>

      {/* Modals */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      <PaymentModal />
    </div>
  );
};

export default AgentPage;
