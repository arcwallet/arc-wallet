import {
  parseIntent,
  analyzeWalletRisk,
  getTokenPrice,
  getNewsSummary,
  type X402PaymentRequirements,
  type X402PaymentResult,
} from './x402Client';
import { logger } from './logger';

const CONFIG = {
  // Timeouts (ms)
  API_TIMEOUT: 15000,        // 15 seconds for API calls
  SERVICE_TIMEOUT: 10000,    // 10 seconds for service initialization

  // Operation timeouts
  SEND_TIMEOUT: 60000,       // 60 seconds for send
  SWAP_TIMEOUT: 60000,       // 60 seconds for swap
  BRIDGE_TIMEOUT: 90000,     // 90 seconds for bridge
};

const MESSAGES_STORAGE_KEY = 'arc_agent_messages';
const MAX_STORED_MESSAGES = 50; // Keep last 50 messages

function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${ms}ms`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

class LazyLoader<T> {
  private instance: T | null = null;
  private loadingPromise: Promise<T> | null = null;
  private loader: () => Promise<T>;

  constructor(loader: () => Promise<T>) {
    this.loader = loader;
  }

  async get(): Promise<T> {
    // Return cached instance
    if (this.instance) {
      return this.instance;
    }

    // If already loading, wait for that promise
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    // Start loading
    this.loadingPromise = this.loader()
      .then((result) => {
        this.instance = result;
        this.loadingPromise = null;
        return result;
      })
      .catch((error) => {
        this.loadingPromise = null;
        throw error;
      });

    return this.loadingPromise;
  }

  isLoaded(): boolean {
    return this.instance !== null;
  }

  reset(): void {
    this.instance = null;
    this.loadingPromise = null;
  }
}

// Lazy loaders with mutex pattern
const circleWalletLoader = new LazyLoader(async () => {
  const module = await import('./circleWalletService');
  return module.circleWalletService;
});

const bridgeServiceLoader = new LazyLoader(async () => {
  const module = await import('./bridgeService');
  return module.bridgeService;
});

const swapServiceLoader = new LazyLoader(async () => {
  const module = await import('./swapService');
  return module.swapService;
});

const tokenConfigLoader = new LazyLoader(async () => {
  const module = await import('../config/tokens');
  return module;
});

// Helper functions with timeout protection
async function getCircleWalletService() {
  return withTimeout(
    circleWalletLoader.get(),
    CONFIG.SERVICE_TIMEOUT,
    'CircleWallet initialization'
  );
}

async function getBridgeService() {
  return withTimeout(
    bridgeServiceLoader.get(),
    CONFIG.SERVICE_TIMEOUT,
    'Bridge service initialization'
  );
}

async function getSwapService() {
  return withTimeout(
    swapServiceLoader.get(),
    CONFIG.SERVICE_TIMEOUT,
    'Swap service initialization'
  );
}

async function getTokenConfig() {
  return withTimeout(
    tokenConfigLoader.get(),
    CONFIG.SERVICE_TIMEOUT,
    'Token config initialization'
  );
}

// Chain IDs
const CHAIN_IDS: Record<string, number> = {
  'arc': 5042002,
  'arc testnet': 5042002,
  'base': 84532,
  'base sepolia': 84532,
  'sepolia': 84532,
};

// Token addresses on Arc Testnet
const TOKEN_ADDRESSES: Record<string, string> = {
  USDC: '0xd988097fb8612cc24eeC14542bC03424c656005f',
  EURC: '0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4',
  ARC: '0x0000000000000000000000000000000000000000', // Native token
};

export type IntentType =
  | 'SEND'
  | 'SCHEDULED_SEND'
  | 'SWAP'
  | 'BRIDGE'
  | 'CHECK_BALANCE'
  | 'ANALYZE_WALLET'
  | 'GET_PRICE'
  | 'GET_NEWS'
  | 'GET_TRANSACTIONS'
  | 'UNKNOWN';

// Import scheduled transaction service
import {
  scheduledTransactionService,
  type ScheduledTransaction,
} from './scheduledTransactionService';

export interface AgentIntent {
  type: IntentType;
  params: Record<string, any>;
  confidence: number;
  requiresPayment: boolean;
  estimatedCost?: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  intent?: AgentIntent;
  paymentInfo?: X402PaymentResult;
  error?: string;
}

export interface AgentPolicy {
  maxPerTransaction: number;  // Max USDC per transaction
  dailyBudget: number;        // Daily spending limit
  requirePasskey: boolean;    // Always require passkey for payments
  allowedIntents: IntentType[]; // Allowed intent types
}

export interface AgentSpending {
  today: number;
  thisWeek: number;
  thisMonth: number;
  lastTransaction?: X402PaymentResult;
}

// Default policy
const DEFAULT_POLICY: AgentPolicy = {
  maxPerTransaction: 0.10,  // $0.10 max per tx
  dailyBudget: 10.00,       // $10.00 daily limit
  requirePasskey: true,     // Always require passkey
  allowedIntents: [
    'SEND',
    'SCHEDULED_SEND',
    'SWAP',
    'BRIDGE',
    'CHECK_BALANCE',
    'ANALYZE_WALLET',
    'GET_PRICE',
    'GET_NEWS',
    'GET_TRANSACTIONS',
  ],
};

// x402 service costs
const SERVICE_COSTS: Record<string, number> = {
  ANALYZE_WALLET: 0.02,
  GET_PRICE: 0.01,
  GET_NEWS: 0.03,
};

class AgentService {
  private policy: AgentPolicy = DEFAULT_POLICY;
  private spending: AgentSpending = {
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
  };
  private messages: AgentMessage[] = [];
  private lastUserLanguage: 'tr' | 'en' = 'en';
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private isProcessingMessage: boolean = false;

  /**
   * Detect user's language from message
   */
  private detectLanguage(message: string): 'tr' | 'en' {
    const turkishIndicators = [
      'merhaba', 'selam', 'nasıl', 'gönder', 'yolla', 'bakiye', 'fiyat',
      'çevir', 'köprü', 'kaç', 'ne kadar', 'analiz', 'haber', 'lütfen',
      'tamam', 'evet', 'hayır', 'teşekkür', 'güvenli', 'riskli'
    ];
    const lower = message.toLowerCase();
    const hasTurkish = turkishIndicators.some(word => lower.includes(word));
    this.lastUserLanguage = hasTurkish ? 'tr' : 'en';
    return this.lastUserLanguage;
  }

  /**
   * Get localized message
   */
  private t(tr: string, en: string): string {
    return this.lastUserLanguage === 'tr' ? tr : en;
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Check if currently processing
   */
  isProcessing(): boolean {
    return this.isProcessingMessage;
  }

  /**
   * Initialize agent service (thread-safe)
   */
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return;
    }

    this.initializationPromise = this.doInitialize();
  }

  private async doInitialize(): Promise<void> {
    try {
      this.loadSpendingFromStorage();
      this.loadPolicyFromStorage();
      this.loadMessagesFromStorage();

      // Initialize scheduled transaction service with execute callback
      scheduledTransactionService.initialize(async (tx) => {
        return this.executeScheduledTransaction(tx);
      });

      this.isInitialized = true;
      logger.info('Agent service initialized', { component: 'AgentService' });
    } catch (error: any) {
      logger.error('Agent service initialization failed', {
        component: 'AgentService',
        error: error.message,
      });
      // Still mark as initialized to prevent infinite retry
      this.isInitialized = true;
    } finally {
      this.initializationPromise = null;
    }
  }

  /**
   * Execute a scheduled transaction (called by ScheduledTransactionService)
   */
  private async executeScheduledTransaction(tx: ScheduledTransaction): Promise<string> {
    const circleWallet = await getCircleWalletService();
    const state = circleWallet.getState();

    if (!state.isConnected) {
      throw new Error('Wallet not connected');
    }

    if (tx.type === 'SEND' && tx.params.recipient) {
      const tokenAddress = TOKEN_ADDRESSES[tx.params.token || 'USDC'];

      if (tx.params.token === 'ARC') {
        const amountWei = BigInt(Math.floor(parseFloat(tx.params.amount) * 1e18));
        return await circleWallet.sendTransaction({
          to: tx.params.recipient,
          value: amountWei,
        });
      } else {
        return await circleWallet.sendTokenTransfer({
          tokenAddress,
          to: tx.params.recipient,
          amount: tx.params.amount,
          decimals: 6,
        });
      }
    }

    throw new Error(`Unsupported scheduled transaction type: ${tx.type}`);
  }

  /**
   * Wait for initialization to complete
   */
  async waitForInitialization(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    // Initialize if not already started
    this.initialize();
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  /**
   * Get current policy
   */
  getPolicy(): AgentPolicy {
    return { ...this.policy };
  }

  /**
   * Update policy
   */
  updatePolicy(updates: Partial<AgentPolicy>): void {
    this.policy = { ...this.policy, ...updates };
    this.savePolicyToStorage();
    logger.info('Policy updated', {
      component: 'AgentService',
      policy: this.policy,
    });
  }

  /**
   * Get current spending
   */
  getSpending(): AgentSpending {
    return { ...this.spending };
  }

  /**
   * Get conversation history
   */
  getMessages(): AgentMessage[] {
    return [...this.messages];
  }

  clearMessages(): void {
    this.messages = [];
    this.saveMessagesToStorage();
  }

  private loadMessagesFromStorage(): void {
    try {
      const stored = localStorage.getItem(MESSAGES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AgentMessage[];
        // Only load recent messages
        this.messages = parsed.slice(-MAX_STORED_MESSAGES);
        logger.info('Loaded conversation history', {
          component: 'AgentService',
          count: this.messages.length,
        });
      }
    } catch (error) {
      logger.error('Failed to load messages from storage', {
        component: 'AgentService',
      });
      this.messages = [];
    }
  }

  private saveMessagesToStorage(): void {
    try {
      // Keep only recent messages
      const toStore = this.messages.slice(-MAX_STORED_MESSAGES);
      localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(toStore));
    } catch (error) {
      logger.error('Failed to save messages to storage', {
        component: 'AgentService',
      });
    }
  }

  private addMessage(msg: AgentMessage): void {
    this.messages.push(msg);
    this.saveMessagesToStorage();
  }

  /**
   * Get quick action suggestions for UI
   */
  getQuickActions(language: 'tr' | 'en' = 'en'): Array<{ label: string; command: string; icon: string }> {
    if (language === 'tr') {
      return [
        { label: 'Bakiye', command: 'bakiyem ne kadar', icon: '' },
        { label: 'Gönder', command: '10 USDC gönder', icon: '' },
        { label: 'Swap', command: '50 USDC EURC\'ye çevir', icon: '' },
        { label: 'Bridge', command: '25 USDC base\'e köprüle', icon: '' },
        { label: 'BTC Fiyat', command: 'bitcoin fiyatı', icon: '' },
        { label: 'Haberler', command: 'kripto haberleri', icon: '' },
      ];
    }

    return [
      { label: 'Balance', command: 'check my balance', icon: '' },
      { label: 'Send', command: 'send 10 USDC to', icon: '' },
      { label: 'Swap', command: 'swap 50 USDC to EURC', icon: '' },
      { label: 'Bridge', command: 'bridge 25 USDC to base', icon: '' },
      { label: 'BTC Price', command: 'bitcoin price', icon: '' },
      { label: 'News', command: 'crypto news', icon: '' },
    ];
  }

  /**
   * Get suggested follow-up actions based on last intent
   */
  getSuggestedActions(): Array<{ label: string; command: string }> {
    const lastAgentMessage = [...this.messages].reverse().find(m => m.role === 'agent');
    if (!lastAgentMessage?.intent) {
      return [];
    }

    const isTurkish = this.lastUserLanguage === 'tr';

    switch (lastAgentMessage.intent.type) {
      case 'SEND':
        return isTurkish
          ? [{ label: 'Bakiye kontrol', command: 'bakiyem ne kadar' }]
          : [{ label: 'Check balance', command: 'check my balance' }];

      case 'SWAP':
        return isTurkish
          ? [
              { label: 'Bakiye kontrol', command: 'bakiyem ne kadar' },
              { label: 'Başka swap', command: '50 EURC USDC\'ye çevir' },
            ]
          : [
              { label: 'Check balance', command: 'check my balance' },
              { label: 'Another swap', command: 'swap 50 EURC to USDC' },
            ];

      case 'BRIDGE':
        return isTurkish
          ? [{ label: 'Bakiye kontrol', command: 'bakiyem ne kadar' }]
          : [{ label: 'Check balance', command: 'check my balance' }];

      case 'CHECK_BALANCE':
        return isTurkish
          ? [
              { label: 'Swap yap', command: '50 USDC EURC\'ye çevir' },
              { label: 'Bridge yap', command: '25 USDC base\'e köprüle' },
            ]
          : [
              { label: 'Make a swap', command: 'swap 50 USDC to EURC' },
              { label: 'Bridge tokens', command: 'bridge 25 USDC to base' },
            ];

      case 'GET_PRICE':
        return isTurkish
          ? [
              { label: 'ETH fiyatı', command: 'ETH fiyatı' },
              { label: 'Haberler', command: 'kripto haberleri' },
            ]
          : [
              { label: 'ETH price', command: 'ETH price' },
              { label: 'Market news', command: 'crypto news' },
            ];

      default:
        return [];
    }
  }

  /**
   * Process user message and execute intent
   */
  async processMessage(
    userMessage: string,
    callbacks: {
      onPaymentRequired?: (
        requirements: X402PaymentRequirements
      ) => Promise<boolean>;
      onPaymentSent?: (result: X402PaymentResult) => void;
      onIntentParsed?: (intent: AgentIntent) => void;
      onNavigate?: (page: string, data?: any) => void;
    } = {}
  ): Promise<AgentMessage> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Prevent concurrent message processing
    if (this.isProcessingMessage) {
      const busyMsg: AgentMessage = {
        id: `${messageId}_agent`,
        role: 'agent',
        content: this.t(
          'Lütfen önceki işlemin tamamlanmasını bekleyin.',
          'Please wait for the previous operation to complete.'
        ),
        timestamp: Date.now(),
        error: 'busy',
      };
      return busyMsg;
    }

    this.isProcessingMessage = true;

    // Ensure service is initialized
    await this.waitForInitialization();

    // Add user message to history (will be synced to UI via getMessages())
    const userMsg: AgentMessage = {
      id: `${messageId}_user`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };
    this.addMessage(userMsg);

    // Notify UI immediately that user message was added
    // This is handled by returning the message and letting caller sync

    try {
      // Detect user language
      this.detectLanguage(userMessage);

      // Build conversation history for context
      const conversationHistory = this.messages
        .slice(-10) // Last 10 messages
        .map(msg => ({
          role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
          content: msg.content,
        }));

      // Parse intent - try API first with timeout, fallback to local
      let intentResult;
      try {
        intentResult = await withTimeout(
          parseIntent(userMessage, conversationHistory),
          CONFIG.API_TIMEOUT,
          'Intent parsing'
        );
      } catch (parseError: any) {
        logger.warn('API parse failed, using local parser', {
          component: 'AgentService',
          error: parseError.message,
        });
        intentResult = this.localParseIntent(userMessage);
      }
      const intent = this.mapToAgentIntent(intentResult);

      // Notify about parsed intent
      if (callbacks.onIntentParsed) {
        callbacks.onIntentParsed(intent);
      }

      // Check if intent is allowed
      if (!this.policy.allowedIntents.includes(intent.type)) {
        throw new Error(`Intent type "${intent.type}" is not allowed by policy`);
      }

      // Execute intent
      const response = await this.executeIntent(intent, callbacks);

      // Create agent response message
      const agentMsg: AgentMessage = {
        id: `${messageId}_agent`,
        role: 'agent',
        content: response.message,
        timestamp: Date.now(),
        intent,
        paymentInfo: response.paymentInfo,
      };
      this.addMessage(agentMsg);

      return agentMsg;
    } catch (error: any) {
      logger.error('Agent processing error', {
        component: 'AgentService',
        errorMsg: error.message,
      });

      // User-friendly error messages
      let userFriendlyError = error.message;
      if (error.message?.includes('timed out')) {
        userFriendlyError = this.t(
          'İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.',
          'Operation timed out. Please try again.'
        );
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        userFriendlyError = this.t(
          'Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin.',
          'Network error. Please check your internet connection.'
        );
      } else if (error.message?.includes('rejected') || error.message?.includes('cancelled')) {
        userFriendlyError = this.t(
          'İşlem iptal edildi.',
          'Operation cancelled.'
        );
      }

      const errorMsg: AgentMessage = {
        id: `${messageId}_agent`,
        role: 'agent',
        content: userFriendlyError,
        timestamp: Date.now(),
        error: error.message,
      };
      this.addMessage(errorMsg);

      return errorMsg;
    } finally {
      this.isProcessingMessage = false;
    }
  }

  /**
   * Map backend intent to AgentIntent
   */
  private mapToAgentIntent(intentResult: any): AgentIntent {
    const type = intentResult.intent?.type || 'UNKNOWN';
    const params = intentResult.intent?.params || {};
    const confidence = intentResult.confidence || 0;

    // Check if this intent requires payment
    const requiresPayment = ['ANALYZE_WALLET', 'GET_PRICE', 'GET_NEWS'].includes(type);
    const estimatedCost = SERVICE_COSTS[type]?.toString();

    return {
      type: type as IntentType,
      params,
      confidence,
      requiresPayment,
      estimatedCost,
    };
  }

  /**
   * Local intent parser - fallback when API is unavailable
   */
  private localParseIntent(input: string): { intent: { type: string; params: any }; confidence: number; message: string } {
    const lower = input.toLowerCase();
    const addressMatch = input.match(/0x[a-fA-F0-9]{40}/);
    const amountMatch = input.match(/(\d+\.?\d*)/);
    const amount = amountMatch ? amountMatch[1] : '';

    // SCHEDULED_SEND detection - Check this BEFORE regular SEND
    // Turkish: "10 dk sonra", "5 dakika sonra", "1 saat sonra", "yarın"
    // English: "in 10 minutes", "after 5 min", "later"
    const scheduledKeywords = [
      'sonra', 'dakika sonra', 'dk sonra', 'saat sonra', 'later',
      'in \\d+ min', 'after \\d+ min', 'schedule'
    ];
    const hasScheduledKeyword = scheduledKeywords.some(k => {
      if (k.includes('\\d')) {
        return new RegExp(k, 'i').test(lower);
      }
      return lower.includes(k);
    });

    if (hasScheduledKeyword && (lower.includes('gönder') || lower.includes('send') || lower.includes('yolla') || lower.includes('transfer'))) {
      const token = lower.includes('eurc') ? 'EURC' : lower.includes('arc') ? 'ARC' : 'USDC';

      // Extract delay in minutes
      let delayMinutes = 10; // default

      // Turkish patterns: "10 dk", "10 dakika", "1 saat"
      const dkMatch = lower.match(/(\d+)\s*(dk|dakika)/);
      const saatMatch = lower.match(/(\d+)\s*saat/);
      // English patterns: "10 min", "10 minutes", "1 hour"
      const minMatch = lower.match(/(\d+)\s*min/);
      const hourMatch = lower.match(/(\d+)\s*hour/);

      if (dkMatch) {
        delayMinutes = parseInt(dkMatch[1]);
      } else if (saatMatch) {
        delayMinutes = parseInt(saatMatch[1]) * 60;
      } else if (minMatch) {
        delayMinutes = parseInt(minMatch[1]);
      } else if (hourMatch) {
        delayMinutes = parseInt(hourMatch[1]) * 60;
      } else if (lower.includes('yarın') || lower.includes('tomorrow')) {
        delayMinutes = 1440; // 24 hours
      }

      return {
        intent: {
          type: 'SCHEDULED_SEND',
          params: {
            token,
            amount,
            recipient: addressMatch?.[0] || '',
            delayMinutes,
          }
        },
        confidence: addressMatch && amount ? 0.9 : 0.5,
        message: addressMatch
          ? `Scheduling ${amount} ${token} to be sent in ${delayMinutes} minutes...`
          : 'Please provide recipient address',
      };
    }

    // SEND detection (only if not scheduled)
    const sendKeywords = ['send', 'gönder', 'gonder', 'yolla', 'transfer', 'enviar', 'at'];
    if (sendKeywords.some(k => lower.includes(k)) || (addressMatch && amount)) {
      const token = lower.includes('eurc') ? 'EURC' : lower.includes('arc') ? 'ARC' : 'USDC';
      return {
        intent: { type: 'SEND', params: { token, amount, recipient: addressMatch?.[0] || '' } },
        confidence: addressMatch && amount ? 0.9 : 0.5,
        message: addressMatch ? `Sending ${amount} ${token}...` : 'Please provide recipient address',
      };
    }

    // BRIDGE detection
    const bridgeKeywords = ['bridge', 'köprü', 'koprule', 'base'];
    if (bridgeKeywords.some(k => lower.includes(k))) {
      return {
        intent: { type: 'BRIDGE', params: { amount, fromChain: 'arc', toChain: 'base sepolia' } },
        confidence: amount ? 0.85 : 0.5,
        message: `Bridging ${amount} USDC to Base Sepolia...`,
      };
    }

    // SWAP detection
    const swapKeywords = ['swap', 'takas', 'çevir', 'cevir', 'exchange', 'al'];
    if (swapKeywords.some(k => lower.includes(k))) {
      const toToken = lower.includes('eurc') ? 'EURC' : 'USDC';
      return {
        intent: { type: 'SWAP', params: { fromToken: 'USDC', toToken, amount } },
        confidence: amount ? 0.85 : 0.5,
        message: `Swapping ${amount} USDC to ${toToken}...`,
      };
    }

    // BALANCE detection
    const balanceKeywords = ['balance', 'bakiye', 'ne kadar'];
    if (balanceKeywords.some(k => lower.includes(k))) {
      return {
        intent: { type: 'CHECK_BALANCE', params: {} },
        confidence: 0.9,
        message: 'Checking balance...',
      };
    }

    // PRICE detection
    const priceKeywords = ['price', 'fiyat', 'kaç'];
    if (priceKeywords.some(k => lower.includes(k))) {
      const token = lower.includes('btc') ? 'BTC' : lower.includes('eth') ? 'ETH' : 'USDC';
      return {
        intent: { type: 'GET_PRICE', params: { token } },
        confidence: 0.9,
        message: `Getting ${token} price...`,
      };
    }

    // ANALYZE detection
    if (addressMatch && (lower.includes('analiz') || lower.includes('analyze') || lower.includes('risk') || lower.includes('güvenli'))) {
      return {
        intent: { type: 'ANALYZE_WALLET', params: { address: addressMatch[0] } },
        confidence: 0.9,
        message: `Analyzing wallet ${addressMatch[0].slice(0, 10)}...`,
      };
    }

    // NEWS detection
    const newsKeywords = ['news', 'haber', 'piyasa', 'market'];
    if (newsKeywords.some(k => lower.includes(k))) {
      return {
        intent: { type: 'GET_NEWS', params: {} },
        confidence: 0.9,
        message: 'Fetching market news...',
      };
    }

    // GET_TRANSACTIONS - when user pastes just an address or asks for transaction history
    const txKeywords = ['transaction', 'işlem', 'history', 'geçmiş', 'aktivite', 'activity'];
    const isJustAddress = addressMatch && input.trim().length < 50 && !lower.includes('send') && !lower.includes('gönder');
    if (isJustAddress || (addressMatch && txKeywords.some(k => lower.includes(k)))) {
      return {
        intent: { type: 'GET_TRANSACTIONS', params: { address: addressMatch![0] } },
        confidence: 0.9,
        message: this.t(
          `${addressMatch![0].slice(0, 6)}...${addressMatch![0].slice(-4)} adresinin işlemleri getiriliyor...`,
          `Fetching transactions for ${addressMatch![0].slice(0, 6)}...${addressMatch![0].slice(-4)}...`
        ),
      };
    }

    // Unknown
    return {
      intent: { type: 'UNKNOWN', params: {} },
      confidence: 0.3,
      message: 'I can help with: send, swap, bridge, balance, prices. What would you like to do?',
    };
  }

  /**
   * Execute parsed intent
   */
  private async executeIntent(
    intent: AgentIntent,
    callbacks: {
      onPaymentRequired?: (
        requirements: X402PaymentRequirements
      ) => Promise<boolean>;
      onPaymentSent?: (result: X402PaymentResult) => void;
      onNavigate?: (page: string, data?: any) => void;
    }
  ): Promise<{ message: string; paymentInfo?: X402PaymentResult }> {
    logger.info('Executing intent', {
      component: 'AgentService',
      intentType: intent.type,
    });

    switch (intent.type) {
      case 'SEND':
        return this.handleSendIntent(intent, callbacks);

      case 'SCHEDULED_SEND':
        return this.handleScheduledSendIntent(intent);

      case 'SWAP':
        return this.handleSwapIntent(intent, callbacks);

      case 'BRIDGE':
        return this.handleBridgeIntent(intent, callbacks);

      case 'CHECK_BALANCE':
        return this.handleBalanceIntent(intent);

      case 'ANALYZE_WALLET':
        return this.handleAnalyzeWalletIntent(intent, callbacks);

      case 'GET_PRICE':
        return this.handlePriceIntent(intent, callbacks);

      case 'GET_NEWS':
        return this.handleNewsIntent(callbacks);

      case 'GET_TRANSACTIONS':
        return this.handleTransactionsIntent(intent);

      default:
        return {
          message: this.getHelpMessage(),
        };
    }
  }

  /**
   * Get localized help message with quick actions
   */
  private getHelpMessage(): string {
    if (this.lastUserLanguage === 'tr') {
      return `**Merhaba! Size nasıl yardımcı olabilirim?**

**Hızlı Komutlar:**
• "50 USDC gönder 0x..." - Token transfer
• "100 USDC'yi EURC'ye çevir" - Swap
• "50 USDC base'e köprüle" - Bridge
• "bakiyem ne kadar" - Bakiye kontrolü
• "ETH fiyatı ne" - Fiyat sorgulama
• "0x... güvenli mi" - Cüzdan analizi
• "kripto haberleri" - Piyasa haberleri

**Örnek cümleler:**
_"20 usdc yolla 0x742d..."_
_"tüm USDC'mi EURC'ye çevir"_
_"base sepolia'ya 10 usdc köprüle"_`;
    }

    return `**Hello! How can I help you?**

**Quick Commands:**
• "Send 50 USDC to 0x..." - Token transfer
• "Swap 100 USDC to EURC" - Exchange tokens
• "Bridge 50 USDC to Base" - Cross-chain transfer
• "Check my balance" - View balances
• "ETH price" - Price lookup
• "Analyze 0x..." - Wallet risk analysis
• "Crypto news" - Market news

**Example phrases:**
_"transfer 20 usdc to 0x742d..."_
_"exchange all my USDC for EURC"_
_"bridge 10 usdc to base sepolia"_`;
  }

  /**
   * Handle SEND intent - Execute transaction directly
   */
  private async handleSendIntent(
    intent: AgentIntent,
    _callbacks: { onNavigate?: (page: string, data?: any) => void }
  ): Promise<{ message: string }> {
    const { token = 'USDC', amount, recipient } = intent.params;

    // Validate recipient address
    if (!recipient || !recipient.match(/^0x[a-fA-F0-9]{40}$/)) {
      return {
        message: `Please provide a valid recipient address. Example: "Send 10 USDC to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e"`,
      };
    }

    // Validate amount
    if (!amount || parseFloat(amount) <= 0) {
      return {
        message: `Please specify the amount to send. Example: "Send 10 ${token} to ${recipient.slice(0, 6)}...${recipient.slice(-4)}"`,
      };
    }

    // Get token address
    const tokenUpper = token.toUpperCase();
    const tokenAddress = TOKEN_ADDRESSES[tokenUpper];
    if (!tokenAddress && tokenUpper !== 'ARC') {
      return {
        message: `Token "${token}" is not supported. Supported tokens: USDC, EURC, ARC`,
      };
    }

    try {
      const circleWallet = await getCircleWalletService();

      // Check if wallet is connected
      const state = circleWallet.getState();
      if (!state.isConnected || !state.address) {
        return {
          message: `Wallet not connected. Please connect your wallet first.`,
        };
      }

      logger.info('Executing send transaction', {
        component: 'AgentService',
        token: tokenUpper,
        amount,
        recipient,
      });

      let txHash: string;

      if (tokenUpper === 'ARC') {
        // Send native ARC token with timeout
        const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e18));
        txHash = await withTimeout(
          circleWallet.sendTransaction({
            to: recipient,
            value: amountWei,
          }),
          CONFIG.SEND_TIMEOUT,
          'Send transaction'
        );
      } else {
        // Send ERC20 token with timeout
        txHash = await withTimeout(
          circleWallet.sendTokenTransfer({
            tokenAddress,
            to: recipient,
            amount,
            decimals: tokenUpper === 'USDC' || tokenUpper === 'EURC' ? 6 : 18,
          }),
          CONFIG.SEND_TIMEOUT,
          'Send token transfer'
        );
      }

      logger.info('Send transaction successful', {
        component: 'AgentService',
        txHash,
      });

      const shortRecipient = `${recipient.slice(0, 6)}...${recipient.slice(-4)}`;
      const explorerUrl = `https://testnet.arcscan.app/tx/${txHash}`;

      return {
        message: `**Transaction Sent!**\n\nSent ${amount} ${tokenUpper} to ${shortRecipient}\n\nTx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}\n\n[View on Explorer](${explorerUrl})`,
      };
    } catch (error: any) {
      logger.error('Send transaction failed', {
        component: 'AgentService',
        errorMsg: error.message,
      });

      // User-friendly error messages
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        return {
          message: `Transaction cancelled. You can try again when ready.`,
        };
      }
      if (error.message?.includes('insufficient')) {
        return {
          message: `Insufficient ${tokenUpper} balance. Please check your wallet balance.`,
        };
      }

      return {
        message: `Transaction failed: ${error.message}`,
      };
    }
  }

  /**
   * Handle SCHEDULED_SEND intent - Schedule a transaction for later
   * Uses persistent ScheduledTransactionService
   */
  private async handleScheduledSendIntent(
    intent: AgentIntent
  ): Promise<{ message: string }> {
    const { token = 'USDC', amount, recipient, delayMinutes } = intent.params;

    // Validate recipient address
    if (!recipient || !recipient.match(/^0x[a-fA-F0-9]{40}$/)) {
      return {
        message: this.t(
          'Lütfen geçerli bir alıcı adresi belirtin.',
          'Please provide a valid recipient address.'
        ),
      };
    }

    // Validate amount
    if (!amount || parseFloat(amount) <= 0) {
      return {
        message: this.t(
          'Lütfen gönderilecek miktarı belirtin.',
          'Please specify the amount to send.'
        ),
      };
    }

    // Validate delay
    const delay = parseInt(delayMinutes) || 0;
    if (delay <= 0) {
      return {
        message: this.t(
          'Lütfen geçerli bir süre belirtin. Örnek: "10 dakika sonra"',
          'Please specify a valid delay. Example: "in 10 minutes"'
        ),
      };
    }

    try {
      const circleWallet = await getCircleWalletService();
      const state = circleWallet.getState();

      if (!state.isConnected || !state.address) {
        return {
          message: this.t(
            'Cüzdan bağlı değil. Lütfen önce cüzdanınızı bağlayın.',
            'Wallet not connected. Please connect your wallet first.'
          ),
        };
      }

      // Create scheduled transaction using the service
      const scheduledTx = scheduledTransactionService.create({
        type: 'SEND',
        params: {
          token: token.toUpperCase(),
          amount,
          recipient,
        },
        delayMinutes: delay,
        walletAddress: state.address,
      });

      const executeTime = new Date(scheduledTx.executeAt).toLocaleTimeString();
      const shortRecipient = `${recipient.slice(0, 6)}...${recipient.slice(-4)}`;

      // Get pending count for user info
      const pendingCount = scheduledTransactionService.getPendingTransactions(state.address).length;

      return {
        message: this.t(
          `**İşlem Zamanlandı**\n\n` +
          `${amount} ${token.toUpperCase()} ${shortRecipient} adresine ` +
          `${delay} dakika sonra (${executeTime}) gönderilecek.\n\n` +
          `ID: \`${scheduledTx.id.slice(0, 16)}\`\n` +
          `Bekleyen işlemler: ${pendingCount}\n\n` +
          `_İptal etmek için: "işlemi iptal et ${scheduledTx.id.slice(0, 8)}"_`,

          `**Transaction Scheduled**\n\n` +
          `${amount} ${token.toUpperCase()} will be sent to ${shortRecipient} ` +
          `in ${delay} minutes (at ${executeTime}).\n\n` +
          `ID: \`${scheduledTx.id.slice(0, 16)}\`\n` +
          `Pending transactions: ${pendingCount}\n\n` +
          `_To cancel: "cancel transaction ${scheduledTx.id.slice(0, 8)}"_`
        ),
      };
    } catch (error: any) {
      logger.error('Schedule transaction failed', {
        component: 'AgentService',
        error: error.message,
      });

      return {
        message: this.t(
          `İşlem zamanlanamadı: ${error.message}`,
          `Failed to schedule transaction: ${error.message}`
        ),
      };
    }
  }

  /**
   * Cancel a scheduled transaction
   */
  cancelScheduledTransaction(txIdPrefix: string): { success: boolean; message: string } {
    // Find transaction by ID prefix
    const allTx = scheduledTransactionService.getTransactions();
    const tx = allTx.find(t => t.id.startsWith(txIdPrefix) || t.id.includes(txIdPrefix));

    if (!tx) {
      return {
        success: false,
        message: this.t(
          `İşlem bulunamadı: ${txIdPrefix}`,
          `Transaction not found: ${txIdPrefix}`
        ),
      };
    }

    try {
      scheduledTransactionService.cancel(tx.id);
      return {
        success: true,
        message: this.t(
          `**İşlem İptal Edildi**\n\n${tx.params.amount} ${tx.params.token} transferi iptal edildi.`,
          `**Transaction Cancelled**\n\n${tx.params.amount} ${tx.params.token} transfer has been cancelled.`
        ),
      };
    } catch (error: any) {
      return {
        success: false,
        message: this.t(
          `İptal edilemedi: ${error.message}`,
          `Cannot cancel: ${error.message}`
        ),
      };
    }
  }

  /**
   * Get pending scheduled transactions for display
   */
  getPendingScheduledTransactions(walletAddress: string): ScheduledTransaction[] {
    return scheduledTransactionService.getPendingTransactions(walletAddress);
  }

  /**
   * Handle SWAP intent - Execute swap directly via Curve
   */
  private async handleSwapIntent(
    intent: AgentIntent,
    _callbacks: { onNavigate?: (page: string, data?: any) => void }
  ): Promise<{ message: string }> {
    const { fromToken = 'USDC', toToken = 'EURC', amount } = intent.params;

    // Validate amount
    if (!amount || parseFloat(amount) <= 0) {
      return {
        message: this.t(
          'Lütfen swap miktarını belirtin. Örnek: "50 USDC\'yi EURC\'ye çevir"',
          'Please specify the swap amount. Example: "swap 50 USDC to EURC"'
        ),
      };
    }

    // Normalize token names
    const fromTokenUpper = fromToken.toUpperCase();
    const toTokenUpper = toToken.toUpperCase();

    // Validate supported pairs (only USDC ↔ EURC on Curve)
    const validPairs = [
      ['USDC', 'EURC'],
      ['EURC', 'USDC'],
    ];
    const isValidPair = validPairs.some(
      ([from, to]) => from === fromTokenUpper && to === toTokenUpper
    );

    if (!isValidPair) {
      return {
        message: this.t(
          'Şu an sadece USDC ↔ EURC swap destekleniyor. Örnek: "50 USDC\'yi EURC\'ye çevir"',
          'Only USDC ↔ EURC swap is supported. Example: "swap 50 USDC to EURC"'
        ),
      };
    }

    try {
      const circleWallet = await getCircleWalletService();
      const swap = await getSwapService();
      const tokenConfig = await getTokenConfig();

      // Check wallet connection
      const state = circleWallet.getState();
      if (!state.isConnected || !state.address) {
        return {
          message: this.t(
            'Cüzdan bağlı değil. Lütfen önce cüzdanınızı bağlayın.',
            'Wallet not connected. Please connect your wallet first.'
          ),
        };
      }

      // Check if swap service is available
      if (!swap.isAvailable()) {
        return {
          message: this.t(
            'Swap servisi şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
            'Swap service is currently unavailable. Please try again later.'
          ),
        };
      }

      // Get token info
      const fromTokenInfo = tokenConfig.SUPPORTED_TOKENS.find(
        (t: any) => t.symbol === fromTokenUpper
      );
      const toTokenInfo = tokenConfig.SUPPORTED_TOKENS.find(
        (t: any) => t.symbol === toTokenUpper
      );

      if (!fromTokenInfo || !toTokenInfo) {
        return {
          message: this.t(
            'Token bulunamadı. Desteklenen tokenlar: USDC, EURC',
            'Token not found. Supported tokens: USDC, EURC'
          ),
        };
      }

      logger.info('Getting swap quote', {
        component: 'AgentService',
        from: fromTokenUpper,
        to: toTokenUpper,
        amount,
      });

      // Get quote first with timeout
      const quote = await withTimeout(
        swap.getQuote(fromTokenInfo, toTokenInfo, amount),
        CONFIG.API_TIMEOUT,
        'Swap quote'
      );

      logger.info('Executing swap', {
        component: 'AgentService',
        quote: {
          fromAmount: quote.fromAmount,
          toAmount: quote.toAmount,
          rate: quote.rate,
        },
      });

      // Execute swap with timeout
      const txHash = await withTimeout(
        swap.executeSwap(
          quote,
          async (to: string, value: bigint, data: string) => {
            return circleWallet.sendTransaction({ to, value, data });
          },
          state.address
        ),
        CONFIG.SWAP_TIMEOUT,
        'Swap execution'
      );

      logger.info('Swap successful', {
        component: 'AgentService',
        txHash,
      });

      const explorerUrl = `https://testnet.arcscan.app/tx/${txHash}`;

      return {
        message: this.t(
          `**Swap Tamamlandı!**\n\n` +
            `${quote.fromAmount} ${fromTokenUpper} → ${quote.toAmount} ${toTokenUpper}\n\n` +
            `Oran: 1 ${fromTokenUpper} = ${quote.rate} ${toTokenUpper}\n` +
            `Tx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}\n\n` +
            `[Explorer'da Görüntüle](${explorerUrl})`,
          `**Swap Complete!**\n\n` +
            `${quote.fromAmount} ${fromTokenUpper} → ${quote.toAmount} ${toTokenUpper}\n\n` +
            `Rate: 1 ${fromTokenUpper} = ${quote.rate} ${toTokenUpper}\n` +
            `Tx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}\n\n` +
            `[View on Explorer](${explorerUrl})`
        ),
      };
    } catch (error: any) {
      logger.error('Swap failed', {
        component: 'AgentService',
        errorMsg: error.message,
      });

      // User-friendly error messages
      if (error.message?.includes('rejected') || error.message?.includes('cancelled')) {
        return {
          message: this.t(
            'Swap iptal edildi. Hazır olduğunuzda tekrar deneyebilirsiniz.',
            'Swap cancelled. You can try again when ready.'
          ),
        };
      }
      if (error.message?.includes('insufficient') || error.message?.includes('balance')) {
        return {
          message: this.t(
            `Yetersiz ${fromTokenUpper} bakiyesi. Lütfen bakiyenizi kontrol edin.`,
            `Insufficient ${fromTokenUpper} balance. Please check your balance.`
          ),
        };
      }
      if (error.message?.includes('expired')) {
        return {
          message: this.t(
            'Fiyat teklifi süresi doldu. Lütfen tekrar deneyin.',
            'Quote expired. Please try again.'
          ),
        };
      }

      return {
        message: this.t(
          `Swap başarısız: ${error.message}`,
          `Swap failed: ${error.message}`
        ),
      };
    }
  }

  /**
   * Handle BRIDGE intent - Execute bridge directly
   */
  private async handleBridgeIntent(
    intent: AgentIntent,
    _callbacks: { onNavigate?: (page: string, data?: any) => void }
  ): Promise<{ message: string }> {
    const { amount, toChain, fromChain } = intent.params;

    // Validate amount
    if (!amount || parseFloat(amount) <= 0) {
      return {
        message: `Please specify the amount to bridge. Example: "Bridge 10 USDC to Base Sepolia"`,
      };
    }

    // Determine destination chain
    const toChainLower = (toChain || 'base sepolia').toLowerCase();
    const destinationChainId = CHAIN_IDS[toChainLower];

    if (!destinationChainId) {
      return {
        message: `Chain "${toChain}" is not supported. Supported chains: Base Sepolia`,
      };
    }

    // Determine source chain
    const fromChainLower = (fromChain || 'arc').toLowerCase();
    const sourceChainId = CHAIN_IDS[fromChainLower] || 5042002;

    try {
      const circleWallet = await getCircleWalletService();

      // Check if wallet is connected
      const state = circleWallet.getState();
      if (!state.isConnected || !state.address) {
        return {
          message: `Wallet not connected. Please connect your wallet first.`,
        };
      }

      const bridge = await getBridgeService();

      logger.info('Executing bridge transaction', {
        component: 'AgentService',
        amount,
        from: sourceChainId,
        to: destinationChainId,
      });

      let bridgeTx;

      if (sourceChainId === 5042002) {
        // Arc to Base Sepolia (outbound) with timeout
        bridgeTx = await withTimeout(
          bridge.bridge(amount, destinationChainId),
          CONFIG.BRIDGE_TIMEOUT,
          'Bridge transaction'
        );
      } else {
        // Base Sepolia to Arc (inbound) with timeout
        bridgeTx = await withTimeout(
          bridge.bridgeInbound(amount, sourceChainId),
          CONFIG.BRIDGE_TIMEOUT,
          'Bridge inbound transaction'
        );
      }

      logger.info('Bridge transaction initiated', {
        component: 'AgentService',
        txId: bridgeTx.id,
        burnTxHash: bridgeTx.burnTxHash,
      });

      const sourceChainName = sourceChainId === 5042002 ? 'Arc' : 'Base Sepolia';
      const destChainName = destinationChainId === 5042002 ? 'Arc' : 'Base Sepolia';
      const explorerUrl = sourceChainId === 5042002
        ? `https://testnet.arcscan.app/tx/${bridgeTx.burnTxHash}`
        : `https://sepolia.basescan.org/tx/${bridgeTx.burnTxHash}`;

      return {
        message: `**Bridge Started**\n\nBridging ${amount} USDC from ${sourceChainName} to ${destChainName}\n\nBurn Tx: ${bridgeTx.burnTxHash?.slice(0, 10)}...${bridgeTx.burnTxHash?.slice(-8)}\n\n[View on Explorer](${explorerUrl})\n\n_Waiting for attestation (~15-20 min). Funds will auto-complete on destination._`,
      };
    } catch (error: any) {
      logger.error('Bridge transaction failed', {
        component: 'AgentService',
        errorMsg: error.message,
      });

      // User-friendly error messages
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        return {
          message: `Bridge cancelled. You can try again when ready.`,
        };
      }
      if (error.message?.includes('insufficient') || error.message?.includes('balance')) {
        return {
          message: `Insufficient USDC balance. Please check your wallet balance.`,
        };
      }

      return {
        message: `Bridge failed: ${error.message}`,
      };
    }
  }

  /**
   * Handle CHECK_BALANCE intent - Fetch and display real balances
   */
  private async handleBalanceIntent(
    intent: AgentIntent
  ): Promise<{ message: string }> {
    const { token } = intent.params;

    try {
      const circleWallet = await getCircleWalletService();

      // Check wallet connection
      const state = circleWallet.getState();
      if (!state.isConnected || !state.address) {
        return {
          message: this.t(
            'Cüzdan bağlı değil. Lütfen önce cüzdanınızı bağlayın.',
            'Wallet not connected. Please connect your wallet first.'
          ),
        };
      }

      // Get balances from wallet state
      const balances = state.balances || {};

      // If specific token requested
      if (token) {
        const tokenUpper = token.toUpperCase();
        const balance = balances[tokenUpper] || '0';
        return {
          message: this.t(
            `**${tokenUpper} Bakiyeniz:** ${balance} ${tokenUpper}`,
            `**Your ${tokenUpper} Balance:** ${balance} ${tokenUpper}`
          ),
        };
      }

      // Show all balances
      const balanceLines: string[] = [];
      const tokenOrder = ['USDC', 'EURC', 'ARC', 'ETH'];

      for (const t of tokenOrder) {
        if (balances[t] !== undefined) {
          const bal = parseFloat(balances[t] || '0');
          if (bal > 0 || t === 'USDC' || t === 'EURC') {
            balanceLines.push(`• **${t}:** ${bal.toFixed(t === 'USDC' || t === 'EURC' ? 2 : 4)}`);
          }
        }
      }

      // Add any other tokens not in the standard order
      for (const [t, bal] of Object.entries(balances)) {
        if (!tokenOrder.includes(t) && parseFloat(bal as string) > 0) {
          balanceLines.push(`• **${t}:** ${parseFloat(bal as string).toFixed(4)}`);
        }
      }

      const shortAddress = `${state.address.slice(0, 6)}...${state.address.slice(-4)}`;

      if (balanceLines.length === 0) {
        return {
          message: this.t(
            `**Cüzdan Bakiyesi**\n\nHenüz token bulunmuyor.\n\nAdres: ${shortAddress}`,
            `**Wallet Balance**\n\nNo tokens found yet.\n\nAddress: ${shortAddress}`
          ),
        };
      }

      return {
        message: this.t(
          `**Cüzdan Bakiyesi**\n\n${balanceLines.join('\n')}\n\nAdres: ${shortAddress}`,
          `**Wallet Balance**\n\n${balanceLines.join('\n')}\n\nAddress: ${shortAddress}`
        ),
      };
    } catch (error: any) {
      logger.error('Balance check failed', {
        component: 'AgentService',
        errorMsg: error.message,
      });

      return {
        message: this.t(
          `Bakiye kontrolü başarısız: ${error.message}`,
          `Balance check failed: ${error.message}`
        ),
      };
    }
  }

  /**
   * Handle ANALYZE_WALLET intent (x402 protected)
   */
  private async handleAnalyzeWalletIntent(
    intent: AgentIntent,
    callbacks: {
      onPaymentRequired?: (
        requirements: X402PaymentRequirements
      ) => Promise<boolean>;
      onPaymentSent?: (result: X402PaymentResult) => void;
    }
  ): Promise<{ message: string; paymentInfo?: X402PaymentResult }> {
    const { address } = intent.params;

    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return {
        message: "Please provide a valid wallet address to analyze (e.g., 'Analyze 0x742d35Cc6634C0532925a3b844Bc9e7595f3a5').",
      };
    }

    // Check spending limit
    const cost = SERVICE_COSTS.ANALYZE_WALLET;
    if (this.spending.today + cost > this.policy.dailyBudget) {
      return {
        message: `Daily spending limit reached ($${this.spending.today.toFixed(2)}/$${this.policy.dailyBudget.toFixed(2)}). Try again tomorrow or increase your limit in settings.`,
      };
    }

    let paymentInfo: X402PaymentResult | undefined;

    try {
      const result = await analyzeWalletRisk(address, {
        onPaymentRequired: callbacks.onPaymentRequired,
        onPaymentSent: (payment) => {
          paymentInfo = payment;
          this.recordSpending(parseFloat(payment.amount));
          if (callbacks.onPaymentSent) {
            callbacks.onPaymentSent(payment);
          }
        },
      });

      // Format risk analysis response
      const riskIndicator = {
        LOW: '[LOW]',
        MEDIUM: '[MEDIUM]',
        HIGH: '[HIGH]',
        CRITICAL: '[CRITICAL]',
      }[result.riskLevel];

      const flagsList = result.flags.length > 0
        ? `\n\nFlags detected:\n${result.flags.map(f => `• ${f.replace(/_/g, ' ')}`).join('\n')}`
        : '';

      return {
        message: `${riskIndicator} **Risk Analysis for ${address.slice(0, 6)}...${address.slice(-4)}**\n\n` +
          `**Risk Level:** ${result.riskLevel}\n` +
          `**Risk Score:** ${result.riskScore}/100\n` +
          `${flagsList}\n\n` +
          `**Recommendation:** ${result.recommendation}`,
        paymentInfo,
      };
    } catch (error: any) {
      if (error.message === 'Payment rejected by user') {
        return {
          message: 'Risk analysis cancelled. No payment was made.',
        };
      }
      throw error;
    }
  }

  /**
   * Handle GET_PRICE intent (x402 protected)
   */
  private async handlePriceIntent(
    intent: AgentIntent,
    callbacks: {
      onPaymentRequired?: (
        requirements: X402PaymentRequirements
      ) => Promise<boolean>;
      onPaymentSent?: (result: X402PaymentResult) => void;
    }
  ): Promise<{ message: string; paymentInfo?: X402PaymentResult }> {
    const token = intent.params.token || 'USDC';

    // Check spending limit
    const cost = SERVICE_COSTS.GET_PRICE;
    if (this.spending.today + cost > this.policy.dailyBudget) {
      return {
        message: `Daily spending limit reached. Try again tomorrow.`,
      };
    }

    let paymentInfo: X402PaymentResult | undefined;

    try {
      const result = await getTokenPrice(token, {
        onPaymentRequired: callbacks.onPaymentRequired,
        onPaymentSent: (payment) => {
          paymentInfo = payment;
          this.recordSpending(parseFloat(payment.amount));
          if (callbacks.onPaymentSent) {
            callbacks.onPaymentSent(payment);
          }
        },
      });

      const changeSign = result.change24h >= 0 ? '+' : '';

      return {
        message: `**${token} Price Data**\n\n` +
          `**Price:** $${result.price.toLocaleString()}\n` +
          `**24h Change:** ${changeSign}${result.change24h.toFixed(2)}%\n` +
          `**24h Volume:** $${result.volume24h.toLocaleString()}\n` +
          `**Market Cap:** $${result.marketCap.toLocaleString()}\n\n` +
          `_Last updated: ${new Date(result.lastUpdated).toLocaleTimeString()}_`,
        paymentInfo,
      };
    } catch (error: any) {
      if (error.message === 'Payment rejected by user') {
        return {
          message: 'Price lookup cancelled.',
        };
      }
      throw error;
    }
  }

  /**
   * Handle GET_NEWS intent (x402 protected)
   */
  private async handleNewsIntent(
    callbacks: {
      onPaymentRequired?: (
        requirements: X402PaymentRequirements
      ) => Promise<boolean>;
      onPaymentSent?: (result: X402PaymentResult) => void;
    }
  ): Promise<{ message: string; paymentInfo?: X402PaymentResult }> {
    // Check spending limit
    const cost = SERVICE_COSTS.GET_NEWS;
    if (this.spending.today + cost > this.policy.dailyBudget) {
      return {
        message: `Daily spending limit reached. Try again tomorrow.`,
      };
    }

    let paymentInfo: X402PaymentResult | undefined;

    try {
      const result = await getNewsSummary({
        onPaymentRequired: callbacks.onPaymentRequired,
        onPaymentSent: (payment) => {
          paymentInfo = payment;
          this.recordSpending(parseFloat(payment.amount));
          if (callbacks.onPaymentSent) {
            callbacks.onPaymentSent(payment);
          }
        },
      });

      const headlines = result.headlines
        .map(h => `• ${h.title} _(${h.source})_`)
        .join('\n');

      return {
        message: `**Market News Summary**\n\n` +
          `${result.summary}\n\n` +
          `**Headlines:**\n${headlines}\n\n` +
          `**Market Sentiment:** ${result.marketSentiment.toUpperCase()}`,
        paymentInfo,
      };
    } catch (error: any) {
      if (error.message === 'Payment rejected by user') {
        return {
          message: 'News summary cancelled.',
        };
      }
      throw error;
    }
  }

  private async handleTransactionsIntent(
    intent: AgentIntent
  ): Promise<{ message: string }> {
    const { address } = intent.params;

    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return {
        message: this.t(
          'Geçersiz adres formatı. Lütfen geçerli bir Ethereum adresi girin.',
          'Invalid address format. Please provide a valid Ethereum address.'
        ),
      };
    }

    const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;

    try {
      // Use Blockscout API for Arc testnet
      const explorerUrl = 'https://explorer.arc.circle.com/api/v2';
      const response = await fetch(
        `${explorerUrl}/addresses/${address}/transactions?filter=to%20%7C%20from`,
        {
          headers: { 'Accept': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error('Explorer API error');
      }

      const data = await response.json();
      const transactions = data.items || [];

      if (transactions.length === 0) {
        return {
          message: this.t(
            `**${shortAddr} İşlem Geçmişi**\n\nBu adreste henüz işlem bulunmuyor.`,
            `**${shortAddr} Transaction History**\n\nNo transactions found for this address.`
          ),
        };
      }

      // Format last 10 transactions
      const txList = transactions.slice(0, 10).map((tx: any) => {
        const isIncoming = tx.to?.hash?.toLowerCase() === address.toLowerCase();
        const direction = isIncoming ? '📥' : '📤';
        const otherAddr = isIncoming
          ? tx.from?.hash?.slice(0, 8) + '...'
          : tx.to?.hash?.slice(0, 8) + '...';
        const value = tx.value ? (parseInt(tx.value) / 1e18).toFixed(4) : '0';
        const time = new Date(tx.timestamp).toLocaleDateString();
        const status = tx.status === 'ok' ? '✓' : '✗';

        return `${direction} ${value} ARC ${isIncoming ? 'from' : 'to'} ${otherAddr} ${status} (${time})`;
      }).join('\n');

      const totalTx = data.next_page_params ? '10+' : transactions.length;

      return {
        message: this.t(
          `**${shortAddr} İşlem Geçmişi**\n\n` +
          `Toplam: ${totalTx} işlem\n\n` +
          `**Son İşlemler:**\n${txList}\n\n` +
          `_📥 Gelen | 📤 Giden_`,
          `**${shortAddr} Transaction History**\n\n` +
          `Total: ${totalTx} transactions\n\n` +
          `**Recent Transactions:**\n${txList}\n\n` +
          `_📥 Incoming | 📤 Outgoing_`
        ),
      };
    } catch (error: any) {
      logger.error('Transaction fetch failed', {
        component: 'AgentService',
        address,
        error: error.message,
      });

      return {
        message: this.t(
          `İşlem geçmişi alınamadı. Explorer: https://explorer.arc.circle.com/address/${address}`,
          `Could not fetch transaction history. Explorer: https://explorer.arc.circle.com/address/${address}`
        ),
      };
    }
  }

  private recordSpending(amount: number): void {
    this.spending.today += amount;
    this.spending.thisWeek += amount;
    this.spending.thisMonth += amount;
    this.saveSpendingToStorage();

    logger.info('Spending recorded', {
      component: 'AgentService',
      amount,
      todayTotal: this.spending.today,
    });
  }

  /**
   * Reset daily spending (call at midnight)
   */
  resetDailySpending(): void {
    this.spending.today = 0;
    this.saveSpendingToStorage();
  }

  // Storage helpers
  private saveSpendingToStorage(): void {
    try {
      localStorage.setItem('arc_agent_spending', JSON.stringify({
        ...this.spending,
        lastReset: Date.now(),
      }));
    } catch (e) {
      // Ignore storage errors
    }
  }

  private loadSpendingFromStorage(): void {
    try {
      const stored = localStorage.getItem('arc_agent_spending');
      if (stored) {
        const data = JSON.parse(stored);
        // Check if day has changed
        const lastReset = data.lastReset || 0;
        const daysSinceReset = (Date.now() - lastReset) / (24 * 60 * 60 * 1000);

        if (daysSinceReset >= 1) {
          this.spending.today = 0;
        } else {
          this.spending.today = data.today || 0;
        }

        this.spending.thisWeek = data.thisWeek || 0;
        this.spending.thisMonth = data.thisMonth || 0;
      }
    } catch (e) {
      // Ignore storage errors
    }
  }

  private savePolicyToStorage(): void {
    try {
      localStorage.setItem('arc_agent_policy', JSON.stringify(this.policy));
    } catch (e) {
      // Ignore storage errors
    }
  }

  private loadPolicyFromStorage(): void {
    try {
      const stored = localStorage.getItem('arc_agent_policy');
      if (stored) {
        this.policy = { ...DEFAULT_POLICY, ...JSON.parse(stored) };
      }
    } catch (e) {
      // Ignore storage errors
    }
  }
}

// Singleton instance
export const agentService = new AgentService();
export default agentService;
