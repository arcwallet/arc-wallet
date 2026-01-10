/**
 * Arc Agent Context
 *
 * React context for managing Arc Agent state:
 * - Conversation history
 * - Spending tracking
 * - Policy management
 * - Sidebar visibility
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  agentService,
  type AgentMessage,
  type AgentIntent,
  type AgentPolicy,
  type AgentSpending,
} from '../services/agentService';
import { type X402PaymentRequirements, type X402PaymentResult } from '../services/x402Client';
import { logger } from '../services/logger';

// ============================================
// Types
// ============================================

interface PendingPayment {
  requirements: X402PaymentRequirements;
  resolve: (approved: boolean) => void;
}

interface AgentContextValue {
  // Sidebar state
  isOpen: boolean;
  openAgent: () => void;
  closeAgent: () => void;
  toggleAgent: () => void;

  // Conversation
  messages: AgentMessage[];
  isProcessing: boolean;
  sendMessage: (message: string) => Promise<AgentMessage>;
  clearMessages: () => void;

  // Spending
  spending: AgentSpending;
  refreshSpending: () => void;

  // Policy
  policy: AgentPolicy;
  updatePolicy: (updates: Partial<AgentPolicy>) => void;

  // Payment approval
  pendingPayment: PendingPayment | null;
  approvePayment: () => void;
  rejectPayment: () => void;

  // Navigation callback
  setNavigationCallback: (cb: (page: string, data?: any) => void) => void;
}

// ============================================
// Context
// ============================================

const AgentContext = createContext<AgentContextValue | undefined>(undefined);

// ============================================
// Provider
// ============================================

interface AgentProviderProps {
  children: ReactNode;
}

export const AgentProvider: React.FC<AgentProviderProps> = ({ children }) => {
  // Sidebar state
  const [isOpen, setIsOpen] = useState(false);

  // Conversation state
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Spending state
  const [spending, setSpending] = useState<AgentSpending>({
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
  });

  // Policy state
  const [policy, setPolicy] = useState<AgentPolicy>(agentService.getPolicy());

  // Payment approval state
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);

  // Navigation callback ref
  const [navigationCallback, setNavigationCallbackState] = useState<
    ((page: string, data?: any) => void) | null
  >(null);

  // Initialize agent service
  useEffect(() => {
    agentService.initialize();
    setMessages(agentService.getMessages());
    setSpending(agentService.getSpending());
    setPolicy(agentService.getPolicy());

    logger.info('Agent context initialized', { component: 'AgentContext' });
  }, []);

  // ============================================
  // Sidebar handlers
  // ============================================

  const openAgent = useCallback(() => {
    setIsOpen(true);
    logger.info('Agent sidebar opened', { component: 'AgentContext' });
  }, []);

  const closeAgent = useCallback(() => {
    setIsOpen(false);
    logger.info('Agent sidebar closed', { component: 'AgentContext' });
  }, []);

  const toggleAgent = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // ============================================
  // Message handlers
  // ============================================

  const sendMessage = useCallback(
    async (message: string): Promise<AgentMessage> => {
      setIsProcessing(true);

      try {
        const response = await agentService.processMessage(message, {
          onPaymentRequired: async (requirements) => {
            return new Promise<boolean>((resolve) => {
              setPendingPayment({ requirements, resolve });
            });
          },
          onPaymentSent: (result) => {
            setSpending(agentService.getSpending());
            logger.info('Payment processed', {
              component: 'AgentContext',
              amount: result.amount,
            });
          },
          onIntentParsed: (intent) => {
            logger.info('Intent parsed', {
              component: 'AgentContext',
              intentType: intent.type,
              confidence: intent.confidence,
            });
          },
          onNavigate: (page, data) => {
            if (navigationCallback) {
              navigationCallback(page, data);
              // Close sidebar after navigation
              setIsOpen(false);
            }
          },
        });

        setMessages(agentService.getMessages());
        return response;
      } finally {
        setIsProcessing(false);
      }
    },
    [navigationCallback]
  );

  const clearMessages = useCallback(() => {
    agentService.clearMessages();
    setMessages([]);
  }, []);

  // ============================================
  // Spending handlers
  // ============================================

  const refreshSpending = useCallback(() => {
    setSpending(agentService.getSpending());
  }, []);

  // ============================================
  // Policy handlers
  // ============================================

  const updatePolicy = useCallback((updates: Partial<AgentPolicy>) => {
    agentService.updatePolicy(updates);
    setPolicy(agentService.getPolicy());
  }, []);

  // ============================================
  // Payment handlers
  // ============================================

  const approvePayment = useCallback(() => {
    if (pendingPayment) {
      pendingPayment.resolve(true);
      setPendingPayment(null);
    }
  }, [pendingPayment]);

  const rejectPayment = useCallback(() => {
    if (pendingPayment) {
      pendingPayment.resolve(false);
      setPendingPayment(null);
    }
  }, [pendingPayment]);

  // ============================================
  // Navigation callback
  // ============================================

  const setNavigationCallback = useCallback(
    (cb: (page: string, data?: any) => void) => {
      setNavigationCallbackState(() => cb);
    },
    []
  );

  // ============================================
  // Context value
  // ============================================

  const value: AgentContextValue = {
    isOpen,
    openAgent,
    closeAgent,
    toggleAgent,
    messages,
    isProcessing,
    sendMessage,
    clearMessages,
    spending,
    refreshSpending,
    policy,
    updatePolicy,
    pendingPayment,
    approvePayment,
    rejectPayment,
    setNavigationCallback,
  };

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  );
};

// ============================================
// Hook
// ============================================

export function useAgent(): AgentContextValue {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return context;
}

export default AgentContext;
