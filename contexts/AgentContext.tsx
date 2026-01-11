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


const AgentContext = createContext<AgentContextValue | undefined>(undefined);


interface AgentProviderProps {
  children: ReactNode;
}

export const AgentProvider: React.FC<AgentProviderProps> = ({ children }) => {
  // Sidebar state
  const [isOpen, setIsOpen] = useState(false);

  // Conversation state
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialization state
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

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

  // Initialize agent service with error handling
  useEffect(() => {
    let isMounted = true;

    const initializeAgent = async () => {
      try {
        agentService.initialize();
        await agentService.waitForInitialization();

        if (isMounted) {
          setMessages(agentService.getMessages());
          setSpending(agentService.getSpending());
          setPolicy(agentService.getPolicy());
          setIsInitialized(true);
          setInitError(null);
          logger.info('Agent context initialized', { component: 'AgentContext' });
        }
      } catch (error: any) {
        if (isMounted) {
          setInitError(error.message);
          logger.error('Agent context initialization failed', {
            component: 'AgentContext',
            error: error.message,
          });
        }
      }
    };

    initializeAgent();

    return () => {
      isMounted = false;
    };
  }, []);


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


  const sendMessage = useCallback(
    async (message: string): Promise<AgentMessage> => {
      // Check if initialized
      if (!isInitialized) {
        const errorMsg: AgentMessage = {
          id: `msg_${Date.now()}_error`,
          role: 'agent',
          content: 'Agent is still initializing. Please wait a moment and try again.',
          timestamp: Date.now(),
          error: 'not_initialized',
        };
        return errorMsg;
      }

      // Prevent double processing
      if (isProcessing) {
        const busyMsg: AgentMessage = {
          id: `msg_${Date.now()}_busy`,
          role: 'agent',
          content: 'Please wait for the current operation to complete.',
          timestamp: Date.now(),
          error: 'busy',
        };
        return busyMsg;
      }

      setIsProcessing(true);

      // Add user message to local state immediately for instant feedback
      // The actual message is also added in agentService, we'll sync after processing
      const tempUserMsg: AgentMessage = {
        id: `msg_${Date.now()}_user_temp`,
        role: 'user',
        content: message,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, tempUserMsg]);

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

        // Sync with service messages (includes agent response)
        setMessages(agentService.getMessages());
        return response;
      } catch (error: any) {
        logger.error('SendMessage failed', {
          component: 'AgentContext',
          error: error.message,
        });

        const errorMsg: AgentMessage = {
          id: `msg_${Date.now()}_error`,
          role: 'agent',
          content: `An error occurred: ${error.message}`,
          timestamp: Date.now(),
          error: error.message,
        };
        return errorMsg;
      } finally {
        setIsProcessing(false);
      }
    },
    [navigationCallback, isInitialized, isProcessing]
  );

  const clearMessages = useCallback(() => {
    agentService.clearMessages();
    setMessages([]);
  }, []);


  const refreshSpending = useCallback(() => {
    setSpending(agentService.getSpending());
  }, []);


  const updatePolicy = useCallback((updates: Partial<AgentPolicy>) => {
    agentService.updatePolicy(updates);
    setPolicy(agentService.getPolicy());
  }, []);


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


  const setNavigationCallback = useCallback(
    (cb: (page: string, data?: any) => void) => {
      setNavigationCallbackState(() => cb);
    },
    []
  );


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


export function useAgent(): AgentContextValue {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return context;
}

export default AgentContext;
