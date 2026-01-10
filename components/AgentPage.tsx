/**
 * Arc Assistant - Enhanced Premium UI
 *
 * A futuristic Web3 AI assistant interface with:
 * - Animated gradient orb effects
 * - Glassmorphism components
 * - Framer Motion animations
 * - Circular budget indicator
 * - Quick action carousel
 * - Slash commands support
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
  Sparkles,
  Send,
  ArrowUpRight,
  ArrowLeftRight,
  BarChart3,
  Shield,
  Wallet,
  X,
  Settings,
  RefreshCw,
  Mic,
  Paperclip,
  ChevronRight,
  ChevronLeft,
  Zap,
  TrendingUp,
  Globe,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Command,
} from 'lucide-react';
import { useAgent } from '../contexts/AgentContext';

// ============================================
// Theme Colors
// ============================================
const theme = {
  bg: {
    primary: '#0A1628',
    card: '#111D2E',
    elevated: '#1a2438',
  },
  accent: {
    primary: '#00D4FF',
    secondary: '#3B82F6',
    gradient: 'linear-gradient(135deg, #00D4FF 0%, #3B82F6 100%)',
  },
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#94A3B8',
    muted: '#64748B',
  },
  border: 'rgba(255,255,255,0.1)',
};

// ============================================
// Animated Background Orb
// ============================================
const AnimatedOrb: React.FC<{ size?: number }> = ({ size = 200 }) => (
  <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${theme.accent.primary}30 0%, transparent 70%)`,
        filter: 'blur(40px)',
      }}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.3, 0.5, 0.3],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size * 0.7,
        height: size * 0.7,
        background: `radial-gradient(circle, ${theme.accent.secondary}40 0%, transparent 70%)`,
        filter: 'blur(30px)',
      }}
      animate={{
        scale: [1.2, 1, 1.2],
        opacity: [0.4, 0.6, 0.4],
        rotate: [0, 180, 360],
      }}
      transition={{
        duration: 6,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  </div>
);

// ============================================
// Floating Crypto Particles
// ============================================
const FloatingParticles: React.FC = () => {
  const particles = useMemo(() =>
    Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 10 + 10,
      delay: Math.random() * 5,
    })), []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-cyan-400/20"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};

// ============================================
// Circular Progress Indicator
// ============================================
interface CircularProgressProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  max,
  size = 80,
  strokeWidth = 6,
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (percentage >= 80) return theme.status.error;
    if (percentage >= 50) return theme.status.warning;
    return theme.status.success;
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-slate-400">Budget</span>
        <span className="text-sm font-bold text-white">{percentage.toFixed(0)}%</span>
      </div>
    </div>
  );
};

// ============================================
// Glassmorphism Quick Action Button
// ============================================
interface QuickActionButtonProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  delay?: number;
  color?: string;
}

const QuickActionButton: React.FC<QuickActionButtonProps> = ({
  icon,
  label,
  description,
  onClick,
  delay = 0,
  color = theme.accent.primary,
}) => (
  <motion.button
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    whileHover={{ scale: 1.02, y: -2 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="group relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300"
    style={{
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}
  >
    {/* Hover glow effect */}
    <motion.div
      className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      style={{
        background: `radial-gradient(circle at center, ${color}15 0%, transparent 70%)`,
        boxShadow: `0 0 20px ${color}20`,
      }}
    />

    <div
      className="relative w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300"
      style={{
        background: `${color}15`,
        color: color,
      }}
    >
      {icon}
    </div>

    <div className="relative text-left">
      <p className="text-sm font-medium text-white group-hover:text-cyan-300 transition-colors">
        {label}
      </p>
      {description && (
        <p className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
          {description}
        </p>
      )}
    </div>

    <ChevronRight
      size={16}
      className="relative ml-auto text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all"
    />
  </motion.button>
);

// ============================================
// Chat Message Component
// ============================================
interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  paymentInfo?: { txHash: string; amount: string };
  error?: string;
}

const ChatMessage: React.FC<{ message: Message; index: number }> = ({ message, index }) => {
  const isUser = message.role === 'user';
  const [showTimestamp, setShowTimestamp] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Parse markdown-like content
  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      // Bold text
      if (line.startsWith('**') && line.includes('**')) {
        const parts = line.split('**');
        return (
          <p key={i} className="font-semibold text-[15px] mb-1">
            {parts.filter((_, idx) => idx % 2 === 1).join('')}
          </p>
        );
      }
      // Italic text
      if (line.startsWith('_') && line.endsWith('_')) {
        return (
          <p key={i} className="italic text-slate-400 text-xs mt-2">
            {line.slice(1, -1)}
          </p>
        );
      }
      // List items
      if (line.startsWith('• ') || line.startsWith('- ')) {
        return (
          <p key={i} className="ml-2 my-0.5 flex items-start gap-2">
            <span className="text-cyan-400 mt-1">•</span>
            <span>{line.slice(2)}</span>
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
              className="text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1 my-1"
            >
              {linkMatch[1]}
              <ExternalLink size={12} />
            </a>
          );
        }
      }
      // Transaction hash
      if (line.includes('Tx:') || line.includes('0x')) {
        const hashMatch = line.match(/0x[a-fA-F0-9]+/);
        if (hashMatch) {
          return (
            <p key={i} className="my-0.5 flex items-center gap-2">
              <span>{line.replace(hashMatch[0], '')}</span>
              <code className="bg-slate-800/50 px-2 py-0.5 rounded text-xs font-mono text-cyan-300">
                {hashMatch[0].slice(0, 10)}...{hashMatch[0].slice(-8)}
              </code>
              <button
                onClick={() => copyToClipboard(hashMatch[0])}
                className="text-slate-500 hover:text-cyan-400 transition-colors"
              >
                {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              </button>
            </p>
          );
        }
      }
      // Empty line
      if (!line.trim()) return <br key={i} />;
      // Regular text
      return <p key={i} className="my-0.5">{line}</p>;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => setShowTimestamp(true)}
      onMouseLeave={() => setShowTimestamp(false)}
    >
      {/* Avatar */}
      {!isUser && (
        <motion.div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 relative"
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(59,130,246,0.2) 100%)',
            border: '1px solid rgba(0,212,255,0.3)',
          }}
        >
          <Sparkles size={18} className="text-cyan-400" />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0A1628]" />
        </motion.div>
      )}

      {/* Message Bubble */}
      <div className="max-w-[80%] relative">
        <motion.div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
              : message.error
              ? 'bg-red-500/10 text-red-300 border border-red-500/20'
              : ''
          }`}
          style={
            !isUser && !message.error
              ? {
                  background: 'rgba(26, 36, 56, 0.8)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(0,212,255,0.2)',
                  borderLeft: '3px solid #00D4FF',
                }
              : undefined
          }
        >
          <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {renderContent(message.content)}
          </div>

          {/* Payment Info */}
          {message.paymentInfo && (
            <div className="mt-2 pt-2 border-t border-slate-600/30 text-xs text-slate-400 flex items-center gap-2">
              <Wallet size={12} />
              <span>Paid ${message.paymentInfo.amount} USDC</span>
              <CheckCircle2 size={12} className="text-green-400" />
            </div>
          )}
        </motion.div>

        {/* Timestamp */}
        <AnimatePresence>
          {showTimestamp && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`absolute -bottom-5 text-[10px] text-slate-500 ${
                isUser ? 'right-0' : 'left-0'
              }`}
            >
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// ============================================
// Typing Indicator
// ============================================
const TypingIndicator: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="flex gap-3"
  >
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{
        background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(59,130,246,0.2) 100%)',
        border: '1px solid rgba(0,212,255,0.3)',
      }}
    >
      <Sparkles size={18} className="text-cyan-400" />
    </div>
    <div
      className="rounded-2xl px-4 py-3 flex items-center gap-1"
      style={{
        background: 'rgba(26, 36, 56, 0.8)',
        border: '1px solid rgba(0,212,255,0.2)',
      }}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 bg-cyan-400 rounded-full"
          animate={{ y: [0, -6, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  </motion.div>
);

// ============================================
// Slash Command Dropdown
// ============================================
interface SlashCommandProps {
  onSelect: (command: string) => void;
  onClose: () => void;
  filter: string;
}

const slashCommands = [
  { command: '/send', description: 'Send tokens to an address', icon: ArrowUpRight },
  { command: '/swap', description: 'Swap between tokens', icon: ArrowLeftRight },
  { command: '/bridge', description: 'Bridge tokens to Base', icon: Globe },
  { command: '/balance', description: 'Check wallet balance', icon: Wallet },
  { command: '/price', description: 'Get token price', icon: BarChart3 },
  { command: '/analyze', description: 'Analyze wallet risk', icon: Shield },
  { command: '/news', description: 'Get market news', icon: TrendingUp },
];

const SlashCommandDropdown: React.FC<SlashCommandProps> = ({ onSelect, onClose, filter }) => {
  const filteredCommands = slashCommands.filter((cmd) =>
    cmd.command.toLowerCase().includes(filter.toLowerCase())
  );

  if (filteredCommands.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full left-0 right-0 mb-2 rounded-xl overflow-hidden"
      style={{
        background: 'rgba(17, 29, 46, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(0,212,255,0.2)',
      }}
    >
      <div className="p-2 border-b border-slate-700/50">
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <Command size={12} />
          Commands
        </p>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filteredCommands.map((cmd) => (
          <button
            key={cmd.command}
            onClick={() => {
              onSelect(cmd.command);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-cyan-500/10 transition-colors text-left"
          >
            <cmd.icon size={16} className="text-cyan-400" />
            <div>
              <p className="text-sm text-white">{cmd.command}</p>
              <p className="text-xs text-slate-500">{cmd.description}</p>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
};

// ============================================
// Suggested Prompts Carousel
// ============================================
const suggestedPrompts = [
  { text: 'Check my balance', icon: Wallet },
  { text: 'Send 10 USDC', icon: ArrowUpRight },
  { text: 'Swap to EURC', icon: ArrowLeftRight },
  { text: 'Bridge to Base', icon: Globe },
  { text: 'BTC price', icon: BarChart3 },
  { text: 'Market news', icon: TrendingUp },
];

const SuggestedPromptsCarousel: React.FC<{ onSelect: (prompt: string) => void }> = ({ onSelect }) => {
  const [scrollX, setScrollX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const newX = direction === 'left' ? scrollX - 150 : scrollX + 150;
      containerRef.current.scrollTo({ left: newX, behavior: 'smooth' });
      setScrollX(newX);
    }
  };

  return (
    <div className="relative mt-4">
      <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
        <Zap size={12} className="text-cyan-400" />
        Quick prompts
      </p>
      <div className="relative">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-[#111D2E]/90 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        <div
          ref={containerRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide px-8"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {suggestedPrompts.map((prompt, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onSelect(prompt.text)}
              className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-cyan-300 transition-all"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              whileHover={{ scale: 1.05, borderColor: 'rgba(0,212,255,0.3)' }}
            >
              <prompt.icon size={14} className="text-cyan-400" />
              {prompt.text}
            </motion.button>
          ))}
        </div>

        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-[#111D2E]/90 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

// ============================================
// Enhanced Input Field
// ============================================
interface EnhancedInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isProcessing: boolean;
  onSlashCommand: (cmd: string) => void;
}

const EnhancedInput: React.FC<EnhancedInputProps> = ({
  value,
  onChange,
  onSubmit,
  isProcessing,
  onSlashCommand,
}) => {
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (value.startsWith('/') && !value.includes(' ')) {
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  return (
    <div className="relative">
      <AnimatePresence>
        {showSlashMenu && (
          <SlashCommandDropdown
            filter={value}
            onSelect={(cmd) => {
              const commandMap: Record<string, string> = {
                '/send': 'Send 10 USDC to 0x...',
                '/swap': 'Swap 50 USDC to EURC',
                '/bridge': 'Bridge 25 USDC to Base',
                '/balance': 'Check my balance',
                '/price': 'What is the price of BTC?',
                '/analyze': 'Analyze 0x...',
                '/news': 'Market news',
              };
              onChange(commandMap[cmd] || '');
              onSlashCommand(cmd);
            }}
            onClose={() => setShowSlashMenu(false)}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="flex items-end gap-2 p-2 rounded-2xl transition-all duration-300"
        style={{
          background: 'rgba(26, 36, 56, 0.6)',
          backdropFilter: 'blur(10px)',
          border: `1px solid ${isFocused ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
          boxShadow: isFocused ? '0 0 20px rgba(0,212,255,0.1)' : 'none',
        }}
      >
        {/* Attachment button */}
        <button
          className="p-2 text-slate-500 hover:text-cyan-400 transition-colors rounded-lg hover:bg-white/5"
          title="Attach file"
        >
          <Paperclip size={18} />
        </button>

        {/* Input area */}
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Type a message or / for commands..."
            disabled={isProcessing}
            rows={1}
            className="w-full bg-transparent text-white placeholder-slate-500 focus:outline-none resize-none text-sm py-2 px-1"
            style={{ maxHeight: '120px' }}
          />

          {/* Character count */}
          {value.length > 100 && (
            <span className="absolute right-0 bottom-0 text-[10px] text-slate-500">
              {value.length}/500
            </span>
          )}
        </div>

        {/* Voice input button */}
        <button
          className="p-2 text-slate-500 hover:text-cyan-400 transition-colors rounded-lg hover:bg-white/5"
          title="Voice input"
        >
          <Mic size={18} />
        </button>

        {/* Send button */}
        <motion.button
          onClick={onSubmit}
          disabled={!value.trim() || isProcessing}
          className="p-3 rounded-xl text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: value.trim() && !isProcessing
              ? 'linear-gradient(135deg, #00D4FF 0%, #3B82F6 100%)'
              : 'rgba(255,255,255,0.1)',
          }}
          whileHover={{ scale: value.trim() ? 1.05 : 1 }}
          whileTap={{ scale: value.trim() ? 0.95 : 1 }}
        >
          {isProcessing ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <RefreshCw size={18} />
            </motion.div>
          ) : (
            <Send size={18} />
          )}
        </motion.button>
      </motion.div>
    </div>
  );
};

// ============================================
// Budget Widget
// ============================================
interface BudgetWidgetProps {
  spent: number;
  budget: number;
  onExpand: () => void;
}

const BudgetWidget: React.FC<BudgetWidgetProps> = ({ spent, budget, onExpand }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      onClick={onExpand}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex items-center gap-3 p-3 rounded-xl transition-all"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
      whileHover={{ scale: 1.02 }}
    >
      <CircularProgress value={spent} max={budget} size={50} strokeWidth={4} />

      <div className="text-left">
        <p className="text-xs text-slate-500">Daily Budget</p>
        <p className="text-sm font-medium text-white">
          ${spent.toFixed(2)} / ${budget.toFixed(2)}
        </p>
        <AnimatePresence>
          {isHovered && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-[10px] text-cyan-400"
            >
              Click to view details
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="ml-auto flex items-center gap-1 text-xs text-slate-500">
        <Clock size={12} />
        <span>Resets in 12h</span>
      </div>
    </motion.button>
  );
};

// ============================================
// Settings Panel
// ============================================
const SettingsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { policy, updatePolicy, spending } = useAgent();
  const [dailyBudget, setDailyBudget] = useState(policy.dailyBudget.toString());

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-4 rounded-2xl p-6"
        style={{
          background: 'linear-gradient(180deg, #1a2438 0%, #111D2E 100%)',
          border: '1px solid rgba(0,212,255,0.2)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Settings size={20} className="text-cyan-400" />
            Settings
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Daily Budget (USDC)</label>
            <input
              type="number"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(e.target.value)}
              className="w-full px-4 py-3 bg-[#0A1628] border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          <div className="p-4 rounded-xl" style={{ background: 'rgba(0,212,255,0.05)' }}>
            <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <BarChart3 size={16} className="text-cyan-400" />
              Usage Summary
            </h4>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Today', value: spending.today },
                { label: 'This Week', value: spending.thisWeek },
                { label: 'This Month', value: spending.thisMonth },
              ].map((item) => (
                <div key={item.label} className="flex justify-between">
                  <span className="text-slate-400">{item.label}</span>
                  <span className="text-white font-medium">${item.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <motion.button
          onClick={() => {
            updatePolicy({ dailyBudget: parseFloat(dailyBudget) || 10 });
            onClose();
          }}
          className="w-full mt-6 py-3 rounded-xl text-white font-medium"
          style={{
            background: 'linear-gradient(135deg, #00D4FF 0%, #3B82F6 100%)',
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Save Changes
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

// ============================================
// Payment Approval Modal
// ============================================
const PaymentModal: React.FC = () => {
  const { pendingPayment, approvePayment, rejectPayment } = useAgent();

  if (!pendingPayment) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm mx-4 rounded-2xl p-6"
        style={{
          background: 'linear-gradient(180deg, #1a2438 0%, #111D2E 100%)',
          border: '1px solid rgba(0,212,255,0.2)',
        }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
            <Wallet size={24} className="text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Confirm Payment</h3>
            <p className="text-sm text-slate-400">Service fee required</p>
          </div>
        </div>

        <div className="p-4 rounded-xl mb-5 space-y-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="flex justify-between">
            <span className="text-slate-400 text-sm">Amount</span>
            <span className="text-lg font-bold text-white">
              ${pendingPayment.requirements.price} USDC
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 text-sm">Service</span>
            <span className="text-white text-sm">
              {pendingPayment.requirements.description}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <motion.button
            onClick={rejectPayment}
            className="flex-1 py-3 rounded-xl bg-slate-700/50 text-slate-300 font-medium"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Cancel
          </motion.button>
          <motion.button
            onClick={approvePayment}
            className="flex-1 py-3 rounded-xl text-white font-medium"
            style={{
              background: 'linear-gradient(135deg, #00D4FF 0%, #3B82F6 100%)',
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Confirm
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============================================
// Main Enhanced Agent Page
// ============================================
const AgentPageEnhanced: React.FC = () => {
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = useCallback(async () => {
    if (!inputValue.trim() || isProcessing) return;
    const message = inputValue.trim();
    setInputValue('');
    await sendMessage(message);
  }, [inputValue, isProcessing, sendMessage]);

  const handleQuickAction = (value: string) => {
    setInputValue(value);
  };

  const quickActions = [
    { icon: <ArrowUpRight size={18} />, label: 'Send', description: 'Transfer tokens', color: '#10B981' },
    { icon: <ArrowLeftRight size={18} />, label: 'Swap', description: 'Exchange tokens', color: '#3B82F6' },
    { icon: <Globe size={18} />, label: 'Bridge', description: 'Cross-chain transfer', color: '#8B5CF6' },
    { icon: <BarChart3 size={18} />, label: 'Price', description: 'Token prices', color: '#F59E0B' },
    { icon: <Shield size={18} />, label: 'Analyze', description: 'Risk analysis', color: '#EF4444' },
    { icon: <TrendingUp size={18} />, label: 'News', description: 'Market updates', color: '#00D4FF' },
  ];

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-120px)] relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <motion.div
            className="relative w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(59,130,246,0.2) 100%)',
              border: '1px solid rgba(0,212,255,0.3)',
            }}
            animate={{ boxShadow: ['0 0 20px rgba(0,212,255,0.2)', '0 0 30px rgba(0,212,255,0.4)', '0 0 20px rgba(0,212,255,0.2)'] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles size={24} className="text-cyan-400" />
          </motion.div>
          <div>
            <h1 className="text-xl font-semibold text-white">Arc Assistant</h1>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Online • Powered by AI
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            onClick={clearMessages}
            className="p-2.5 text-slate-500 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <RefreshCw size={16} />
          </motion.button>
          <motion.button
            onClick={() => setShowSettings(true)}
            className="p-2.5 text-slate-500 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Settings size={16} />
          </motion.button>
        </div>
      </div>

      {/* Budget Widget */}
      <BudgetWidget
        spent={spending.today}
        budget={policy.dailyBudget}
        onExpand={() => setShowSettings(true)}
      />

      {/* Messages Area */}
      <div
        className="flex-1 overflow-y-auto rounded-2xl p-4 my-4 space-y-4"
        style={{
          background: 'rgba(10, 22, 40, 0.5)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 relative">
            {/* Background effects */}
            <AnimatedOrb size={250} />
            <FloatingParticles />

            {/* Welcome content */}
            <motion.div
              className="relative z-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <motion.div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 mx-auto"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(59,130,246,0.2) 100%)',
                  border: '1px solid rgba(0,212,255,0.3)',
                }}
                animate={{
                  boxShadow: [
                    '0 0 30px rgba(0,212,255,0.3)',
                    '0 0 50px rgba(0,212,255,0.5)',
                    '0 0 30px rgba(0,212,255,0.3)',
                  ],
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Sparkles size={36} className="text-cyan-400" />
              </motion.div>

              <motion.h3
                className="text-2xl font-semibold text-white mb-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                How can I help you?
              </motion.h3>

              <motion.p
                className="text-slate-400 text-sm mb-8 max-w-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                Send tokens, swap currencies, analyze wallets, and get real-time market data
              </motion.p>

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                {quickActions.map((action, i) => (
                  <QuickActionButton
                    key={action.label}
                    icon={action.icon}
                    label={action.label}
                    description={action.description}
                    color={action.color}
                    delay={0.4 + i * 0.1}
                    onClick={() => {
                      const commands: Record<string, string> = {
                        Send: 'Send 10 USDC to 0x...',
                        Swap: 'Swap 50 USDC to EURC',
                        Bridge: 'Bridge 25 USDC to Base',
                        Price: 'What is the price of BTC?',
                        Analyze: 'Analyze wallet 0x...',
                        News: 'Crypto market news',
                      };
                      handleQuickAction(commands[action.label] || '');
                    }}
                  />
                ))}
              </div>

              {/* Suggested Prompts */}
              <SuggestedPromptsCarousel onSelect={handleQuickAction} />
            </motion.div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <ChatMessage key={msg.id} message={msg} index={i} />
            ))}
            <AnimatePresence>
              {isProcessing && <TypingIndicator />}
            </AnimatePresence>
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Enhanced Input */}
      <EnhancedInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        isProcessing={isProcessing}
        onSlashCommand={(cmd) => console.log('Slash command:', cmd)}
      />

      {/* Modals */}
      <AnimatePresence>
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      </AnimatePresence>
      <PaymentModal />
    </div>
  );
};

export default AgentPageEnhanced;
