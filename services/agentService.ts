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
  API_TIMEOUT: 15000,
  SERVICE_TIMEOUT: 10000,
  SEND_TIMEOUT: 60000,
  SWAP_TIMEOUT: 60000,
  BRIDGE_TIMEOUT: 90000,
};

const MESSAGES_STORAGE_KEY = 'arc_agent_messages';
const MAX_STORED_MESSAGES = 50;

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
    if (this.instance) return this.instance;
    if (this.loadingPromise) return this.loadingPromise;

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

async function getCircleWalletService() {
  return withTimeout(circleWalletLoader.get(), CONFIG.SERVICE_TIMEOUT, 'CircleWallet initialization');
}

async function getBridgeService() {
  return withTimeout(bridgeServiceLoader.get(), CONFIG.SERVICE_TIMEOUT, 'Bridge service initialization');
}

async function getSwapService() {
  return withTimeout(swapServiceLoader.get(), CONFIG.SERVICE_TIMEOUT, 'Swap service initialization');
}

async function getTokenConfig() {
  return withTimeout(tokenConfigLoader.get(), CONFIG.SERVICE_TIMEOUT, 'Token config initialization');
}

const CHAIN_IDS: Record<string, number> = {
  'arc': 5042002,
  'arc testnet': 5042002,
  'base': 84532,
  'base sepolia': 84532,
  'sepolia': 84532,
};

const TOKEN_ADDRESSES: Record<string, string> = {
  USDC: '0xd988097fb8612cc24eeC14542bC03424c656005f',
  EURC: '0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4',
  ARC: '0x0000000000000000000000000000000000000000',
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
  maxPerTransaction: number;
  dailyBudget: number;
  requirePasskey: boolean;
  allowedIntents: IntentType[];
}

export interface AgentSpending {
  today: number;
  thisWeek: number;
  thisMonth: number;
  lastTransaction?: X402PaymentResult;
}

const DEFAULT_POLICY: AgentPolicy = {
  maxPerTransaction: 0.10,
  dailyBudget: 10.00,
  requirePasskey: true,
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

const SERVICE_COSTS: Record<string, number> = {
  ANALYZE_WALLET: 0.02,
  GET_PRICE: 0.01,
  GET_NEWS: 0.03,
};

class AgentService {
  private policy: AgentPolicy = DEFAULT_POLICY;
  private spending: AgentSpending = { today: 0, thisWeek: 0, thisMonth: 0 };
  private messages: AgentMessage[] = [];
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private isProcessingMessage: boolean = false;

  isReady(): boolean {
    return this.isInitialized;
  }

  isProcessing(): boolean {
    return this.isProcessingMessage;
  }

  initialize(): void {
    if (this.isInitialized || this.initializationPromise) return;
    this.initializationPromise = this.doInitialize();
  }

  private async doInitialize(): Promise<void> {
    try {
      this.loadSpendingFromStorage();
      this.loadPolicyFromStorage();
      this.loadMessagesFromStorage();

      scheduledTransactionService.initialize(async (tx) => {
        return this.executeScheduledTransaction(tx);
      });

      this.isInitialized = true;
      logger.info('Agent service initialized', { component: 'AgentService' });
    } catch (error: any) {
      logger.error('Agent service initialization failed', { component: 'AgentService', error: error.message });
      this.isInitialized = true;
    } finally {
      this.initializationPromise = null;
    }
  }

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
        return await circleWallet.sendTransaction({ to: tx.params.recipient, value: amountWei });
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

  async waitForInitialization(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }
    this.initialize();
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  getPolicy(): AgentPolicy {
    return { ...this.policy };
  }

  updatePolicy(updates: Partial<AgentPolicy>): void {
    this.policy = { ...this.policy, ...updates };
    this.savePolicyToStorage();
  }

  getSpending(): AgentSpending {
    return { ...this.spending };
  }

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
        this.messages = parsed.slice(-MAX_STORED_MESSAGES);
      }
    } catch (error) {
      this.messages = [];
    }
  }

  private saveMessagesToStorage(): void {
    try {
      const toStore = this.messages.slice(-MAX_STORED_MESSAGES);
      localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(toStore));
    } catch (error) {
      // Ignore
    }
  }

  private addMessage(msg: AgentMessage): void {
    this.messages.push(msg);
    this.saveMessagesToStorage();
  }

  getQuickActions(): Array<{ label: string; command: string; icon: string }> {
    return [
      { label: 'Balance', command: 'check my balance', icon: '' },
      { label: 'Send', command: 'send 10 USDC to', icon: '' },
      { label: 'Swap', command: 'swap 50 USDC to EURC', icon: '' },
      { label: 'Bridge', command: 'bridge 25 USDC to base', icon: '' },
      { label: 'BTC Price', command: 'bitcoin price', icon: '' },
      { label: 'News', command: 'crypto news', icon: '' },
    ];
  }

  getSuggestedActions(): Array<{ label: string; command: string }> {
    const lastAgentMessage = [...this.messages].reverse().find(m => m.role === 'agent');
    if (!lastAgentMessage?.intent) return [];

    switch (lastAgentMessage.intent.type) {
      case 'SEND':
        return [{ label: 'Check balance', command: 'check my balance' }];
      case 'SWAP':
        return [
          { label: 'Check balance', command: 'check my balance' },
          { label: 'Another swap', command: 'swap 50 EURC to USDC' },
        ];
      case 'BRIDGE':
        return [{ label: 'Check balance', command: 'check my balance' }];
      case 'CHECK_BALANCE':
        return [
          { label: 'Make a swap', command: 'swap 50 USDC to EURC' },
          { label: 'Bridge tokens', command: 'bridge 25 USDC to base' },
        ];
      case 'GET_PRICE':
        return [
          { label: 'ETH price', command: 'ETH price' },
          { label: 'Market news', command: 'crypto news' },
        ];
      default:
        return [];
    }
  }

  async processMessage(
    userMessage: string,
    callbacks: {
      onPaymentRequired?: (requirements: X402PaymentRequirements) => Promise<boolean>;
      onPaymentSent?: (result: X402PaymentResult) => void;
      onIntentParsed?: (intent: AgentIntent) => void;
      onNavigate?: (page: string, data?: any) => void;
    } = {}
  ): Promise<AgentMessage> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    if (this.isProcessingMessage) {
      return {
        id: `${messageId}_agent`,
        role: 'agent',
        content: 'Please wait for the previous operation to complete.',
        timestamp: Date.now(),
        error: 'busy',
      };
    }

    this.isProcessingMessage = true;
    await this.waitForInitialization();

    const userMsg: AgentMessage = {
      id: `${messageId}_user`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };
    this.addMessage(userMsg);

    try {
      const conversationHistory = this.messages.slice(-10).map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content,
      }));

      let intentResult;
      try {
        intentResult = await withTimeout(
          parseIntent(userMessage, conversationHistory),
          CONFIG.API_TIMEOUT,
          'Intent parsing'
        );

        if (intentResult.intent?.type === 'SEND' && this.hasScheduledKeywords(userMessage)) {
          logger.info('API returned SEND but message has scheduled keywords, using local parser', { component: 'AgentService' });
          intentResult = this.localParseIntent(userMessage);
        }
      } catch (parseError: any) {
        logger.warn('API parse failed, using local parser', { component: 'AgentService', error: parseError.message });
        intentResult = this.localParseIntent(userMessage);
      }

      const intent = this.mapToAgentIntent(intentResult);

      if (callbacks.onIntentParsed) {
        callbacks.onIntentParsed(intent);
      }

      if (!this.policy.allowedIntents.includes(intent.type)) {
        throw new Error(`Intent type "${intent.type}" is not allowed by policy`);
      }

      const response = await this.executeIntent(intent, callbacks);

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
      logger.error('Agent processing error', { component: 'AgentService', errorMsg: error.message });

      let userFriendlyError = error.message;
      if (error.message?.includes('timed out')) {
        userFriendlyError = 'Operation timed out. Please try again.';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        userFriendlyError = 'Network error. Please check your internet connection.';
      } else if (error.message?.includes('rejected') || error.message?.includes('cancelled')) {
        userFriendlyError = 'Operation cancelled.';
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

  private mapToAgentIntent(intentResult: any): AgentIntent {
    const type = intentResult.intent?.type || 'UNKNOWN';
    const params = intentResult.intent?.params || {};
    const confidence = intentResult.confidence || 0;
    const requiresPayment = ['ANALYZE_WALLET', 'GET_PRICE', 'GET_NEWS'].includes(type);
    const estimatedCost = SERVICE_COSTS[type]?.toString();

    return { type: type as IntentType, params, confidence, requiresPayment, estimatedCost };
  }

  private hasScheduledKeywords(message: string): boolean {
    const lower = message.toLowerCase();

    const scheduledPatterns = [
      'later', 'schedule', 'delayed', 'tomorrow',
      /in \d+ min/i, /in \d+ hour/i, /after \d+ min/i, /after \d+ hour/i
    ];

    for (const pattern of scheduledPatterns) {
      if (typeof pattern === 'string') {
        if (lower.includes(pattern)) return true;
      } else {
        if (pattern.test(lower)) return true;
      }
    }

    return false;
  }

  private localParseIntent(input: string): { intent: { type: string; params: any }; confidence: number; message: string } {
    const lower = input.toLowerCase();
    const addressMatch = input.match(/0x[a-fA-F0-9]{40}/);
    const amountMatch = input.match(/(\d+\.?\d*)/);
    const amount = amountMatch ? amountMatch[1] : '';

    // SCHEDULED_SEND detection
    const hasScheduledKeyword = this.hasScheduledKeywords(input);

    if (hasScheduledKeyword && (lower.includes('send') || lower.includes('transfer'))) {
      const token = lower.includes('eurc') ? 'EURC' : lower.includes('arc') ? 'ARC' : 'USDC';

      let delayMinutes = 10;
      const minMatch = lower.match(/(\d+)\s*min/);
      const hourMatch = lower.match(/(\d+)\s*hour/);

      if (minMatch) {
        delayMinutes = parseInt(minMatch[1]);
      } else if (hourMatch) {
        delayMinutes = parseInt(hourMatch[1]) * 60;
      } else if (lower.includes('tomorrow')) {
        delayMinutes = 1440;
      }

      return {
        intent: {
          type: 'SCHEDULED_SEND',
          params: { token, amount, recipient: addressMatch?.[0] || '', delayMinutes }
        },
        confidence: addressMatch && amount ? 0.9 : 0.5,
        message: addressMatch
          ? `Scheduling ${amount} ${token} to be sent in ${delayMinutes} minutes...`
          : 'Please provide recipient address',
      };
    }

    // SEND detection
    if (lower.includes('send') || lower.includes('transfer') || (addressMatch && amount)) {
      const token = lower.includes('eurc') ? 'EURC' : lower.includes('arc') ? 'ARC' : 'USDC';
      return {
        intent: { type: 'SEND', params: { token, amount, recipient: addressMatch?.[0] || '' } },
        confidence: addressMatch && amount ? 0.9 : 0.5,
        message: addressMatch ? `Sending ${amount} ${token}...` : 'Please provide recipient address',
      };
    }

    // BRIDGE detection
    if (lower.includes('bridge') || lower.includes('base')) {
      return {
        intent: { type: 'BRIDGE', params: { amount, fromChain: 'arc', toChain: 'base sepolia' } },
        confidence: amount ? 0.85 : 0.5,
        message: `Bridging ${amount} USDC to Base Sepolia...`,
      };
    }

    // SWAP detection
    if (lower.includes('swap') || lower.includes('exchange')) {
      const toToken = lower.includes('eurc') ? 'EURC' : 'USDC';
      return {
        intent: { type: 'SWAP', params: { fromToken: 'USDC', toToken, amount } },
        confidence: amount ? 0.85 : 0.5,
        message: `Swapping ${amount} USDC to ${toToken}...`,
      };
    }

    // BALANCE detection
    if (lower.includes('balance')) {
      return {
        intent: { type: 'CHECK_BALANCE', params: {} },
        confidence: 0.9,
        message: 'Checking balance...',
      };
    }

    // PRICE detection
    if (lower.includes('price')) {
      const token = lower.includes('btc') ? 'BTC' : lower.includes('eth') ? 'ETH' : 'USDC';
      return {
        intent: { type: 'GET_PRICE', params: { token } },
        confidence: 0.9,
        message: `Getting ${token} price...`,
      };
    }

    // ANALYZE detection
    if (addressMatch && (lower.includes('analyze') || lower.includes('risk'))) {
      return {
        intent: { type: 'ANALYZE_WALLET', params: { address: addressMatch[0] } },
        confidence: 0.9,
        message: `Analyzing wallet ${addressMatch[0].slice(0, 10)}...`,
      };
    }

    // NEWS detection
    if (lower.includes('news') || lower.includes('market')) {
      return {
        intent: { type: 'GET_NEWS', params: {} },
        confidence: 0.9,
        message: 'Fetching market news...',
      };
    }

    // GET_TRANSACTIONS detection
    const txKeywords = ['transaction', 'history', 'activity', 'recent'];
    const wantsTxHistory = txKeywords.some(k => lower.includes(k)) && !lower.includes('swap') && !lower.includes('bridge');
    const isJustAddress = addressMatch && input.trim().length < 50 && !lower.includes('send');

    if (isJustAddress || (addressMatch && wantsTxHistory)) {
      return {
        intent: { type: 'GET_TRANSACTIONS', params: { address: addressMatch![0] } },
        confidence: 0.9,
        message: `Fetching transactions for ${addressMatch![0].slice(0, 6)}...${addressMatch![0].slice(-4)}...`,
      };
    }

    if (wantsTxHistory && !addressMatch) {
      return {
        intent: { type: 'GET_TRANSACTIONS', params: { address: null } },
        confidence: 0.85,
        message: 'Fetching your transaction history...',
      };
    }

    return {
      intent: { type: 'UNKNOWN', params: {} },
      confidence: 0.3,
      message: 'I can help with: send, swap, bridge, balance, prices. What would you like to do?',
    };
  }

  private async executeIntent(
    intent: AgentIntent,
    callbacks: {
      onPaymentRequired?: (requirements: X402PaymentRequirements) => Promise<boolean>;
      onPaymentSent?: (result: X402PaymentResult) => void;
      onNavigate?: (page: string, data?: any) => void;
    }
  ): Promise<{ message: string; paymentInfo?: X402PaymentResult }> {
    logger.info('Executing intent', { component: 'AgentService', intentType: intent.type });

    switch (intent.type) {
      case 'SEND':
        return this.handleSendIntent(intent);
      case 'SCHEDULED_SEND':
        return this.handleScheduledSendIntent(intent);
      case 'SWAP':
        return this.handleSwapIntent(intent);
      case 'BRIDGE':
        return this.handleBridgeIntent(intent);
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
        return { message: this.getHelpMessage() };
    }
  }

  private getHelpMessage(): string {
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

  private async handleSendIntent(intent: AgentIntent): Promise<{ message: string }> {
    const { token = 'USDC', amount, recipient } = intent.params;

    if (!recipient || !recipient.match(/^0x[a-fA-F0-9]{40}$/)) {
      return { message: 'Please provide a valid recipient address. Example: "Send 10 USDC to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e"' };
    }

    if (!amount || parseFloat(amount) <= 0) {
      return { message: `Please specify the amount to send. Example: "Send 10 ${token} to ${recipient.slice(0, 6)}...${recipient.slice(-4)}"` };
    }

    const tokenUpper = token.toUpperCase();
    const tokenAddress = TOKEN_ADDRESSES[tokenUpper];
    if (!tokenAddress && tokenUpper !== 'ARC') {
      return { message: `Token "${token}" is not supported. Supported tokens: USDC, EURC, ARC` };
    }

    try {
      const circleWallet = await getCircleWalletService();
      const state = circleWallet.getState();

      if (!state.isConnected || !state.address) {
        return { message: 'Wallet not connected. Please connect your wallet first.' };
      }

      let txHash: string;

      if (tokenUpper === 'ARC') {
        const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e18));
        txHash = await withTimeout(
          circleWallet.sendTransaction({ to: recipient, value: amountWei }),
          CONFIG.SEND_TIMEOUT,
          'Send transaction'
        );
      } else {
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

      const shortRecipient = `${recipient.slice(0, 6)}...${recipient.slice(-4)}`;
      const explorerUrl = `https://testnet.arcscan.app/tx/${txHash}`;

      return {
        message: `**Transaction Sent!**\n\nSent ${amount} ${tokenUpper} to ${shortRecipient}\n\nTx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}\n\n[View on Explorer](${explorerUrl})`,
      };
    } catch (error: any) {
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        return { message: 'Transaction cancelled. You can try again when ready.' };
      }
      if (error.message?.includes('insufficient')) {
        return { message: `Insufficient ${tokenUpper} balance. Please check your wallet balance.` };
      }
      return { message: `Transaction failed: ${error.message}` };
    }
  }

  private async handleScheduledSendIntent(intent: AgentIntent): Promise<{ message: string }> {
    const { token = 'USDC', amount, recipient, delayMinutes } = intent.params;

    if (!recipient || !recipient.match(/^0x[a-fA-F0-9]{40}$/)) {
      return { message: 'Please provide a valid recipient address.' };
    }

    if (!amount || parseFloat(amount) <= 0) {
      return { message: 'Please specify the amount to send.' };
    }

    const delay = parseInt(delayMinutes) || 0;
    if (delay <= 0) {
      return { message: 'Please specify a valid delay. Example: "in 10 minutes"' };
    }

    try {
      const circleWallet = await getCircleWalletService();
      const state = circleWallet.getState();

      if (!state.isConnected || !state.address) {
        return { message: 'Wallet not connected. Please connect your wallet first.' };
      }

      const scheduledTx = scheduledTransactionService.create({
        type: 'SEND',
        params: { token: token.toUpperCase(), amount, recipient },
        delayMinutes: delay,
        walletAddress: state.address,
      });

      const executeTime = new Date(scheduledTx.executeAt).toLocaleTimeString();
      const shortRecipient = `${recipient.slice(0, 6)}...${recipient.slice(-4)}`;
      const pendingCount = scheduledTransactionService.getPendingTransactions(state.address).length;

      return {
        message: `**Transaction Scheduled**\n\n${amount} ${token.toUpperCase()} will be sent to ${shortRecipient} in ${delay} minutes (at ${executeTime}).\n\nID: \`${scheduledTx.id.slice(0, 16)}\`\nPending transactions: ${pendingCount}\n\n_To cancel: "cancel transaction ${scheduledTx.id.slice(0, 8)}"_`,
      };
    } catch (error: any) {
      return { message: `Failed to schedule transaction: ${error.message}` };
    }
  }

  cancelScheduledTransaction(txIdPrefix: string): { success: boolean; message: string } {
    const allTx = scheduledTransactionService.getTransactions();
    const tx = allTx.find(t => t.id.startsWith(txIdPrefix) || t.id.includes(txIdPrefix));

    if (!tx) {
      return { success: false, message: `Transaction not found: ${txIdPrefix}` };
    }

    try {
      scheduledTransactionService.cancel(tx.id);
      return { success: true, message: `**Transaction Cancelled**\n\n${tx.params.amount} ${tx.params.token} transfer has been cancelled.` };
    } catch (error: any) {
      return { success: false, message: `Cannot cancel: ${error.message}` };
    }
  }

  getPendingScheduledTransactions(walletAddress: string): ScheduledTransaction[] {
    return scheduledTransactionService.getPendingTransactions(walletAddress);
  }

  private async handleSwapIntent(intent: AgentIntent): Promise<{ message: string }> {
    const { fromToken = 'USDC', toToken = 'EURC', amount } = intent.params;

    if (!amount || parseFloat(amount) <= 0) {
      return { message: 'Please specify the swap amount. Example: "swap 50 USDC to EURC"' };
    }

    const fromTokenUpper = fromToken.toUpperCase();
    const toTokenUpper = toToken.toUpperCase();

    const validPairs = [['USDC', 'EURC'], ['EURC', 'USDC']];
    const isValidPair = validPairs.some(([from, to]) => from === fromTokenUpper && to === toTokenUpper);

    if (!isValidPair) {
      return { message: 'Only USDC ↔ EURC swap is supported. Example: "swap 50 USDC to EURC"' };
    }

    try {
      const circleWallet = await getCircleWalletService();
      const swap = await getSwapService();
      const tokenConfig = await getTokenConfig();

      const state = circleWallet.getState();
      if (!state.isConnected || !state.address) {
        return { message: 'Wallet not connected. Please connect your wallet first.' };
      }

      if (!swap.isAvailable()) {
        return { message: 'Swap service is currently unavailable. Please try again later.' };
      }

      const fromTokenInfo = tokenConfig.SUPPORTED_TOKENS.find((t: any) => t.symbol === fromTokenUpper);
      const toTokenInfo = tokenConfig.SUPPORTED_TOKENS.find((t: any) => t.symbol === toTokenUpper);

      if (!fromTokenInfo || !toTokenInfo) {
        return { message: 'Token not found. Supported tokens: USDC, EURC' };
      }

      const quote = await withTimeout(swap.getQuote(fromTokenInfo, toTokenInfo, amount), CONFIG.API_TIMEOUT, 'Swap quote');

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

      const explorerUrl = `https://testnet.arcscan.app/tx/${txHash}`;

      return {
        message: `**Swap Complete!**\n\n${quote.fromAmount} ${fromTokenUpper} → ${quote.toAmount} ${toTokenUpper}\n\nRate: 1 ${fromTokenUpper} = ${quote.rate} ${toTokenUpper}\nTx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}\n\n[View on Explorer](${explorerUrl})`,
      };
    } catch (error: any) {
      if (error.message?.includes('rejected') || error.message?.includes('cancelled')) {
        return { message: 'Swap cancelled. You can try again when ready.' };
      }
      if (error.message?.includes('insufficient') || error.message?.includes('balance')) {
        return { message: `Insufficient ${fromTokenUpper} balance. Please check your balance.` };
      }
      if (error.message?.includes('expired')) {
        return { message: 'Quote expired. Please try again.' };
      }
      return { message: `Swap failed: ${error.message}` };
    }
  }

  private async handleBridgeIntent(intent: AgentIntent): Promise<{ message: string }> {
    const { amount, toChain, fromChain } = intent.params;

    if (!amount || parseFloat(amount) <= 0) {
      return { message: 'Please specify the amount to bridge. Example: "Bridge 10 USDC to Base Sepolia"' };
    }

    const toChainLower = (toChain || 'base sepolia').toLowerCase();
    const destinationChainId = CHAIN_IDS[toChainLower];

    if (!destinationChainId) {
      return { message: `Chain "${toChain}" is not supported. Supported chains: Base Sepolia` };
    }

    const fromChainLower = (fromChain || 'arc').toLowerCase();
    const sourceChainId = CHAIN_IDS[fromChainLower] || 5042002;

    try {
      const circleWallet = await getCircleWalletService();
      const state = circleWallet.getState();

      if (!state.isConnected || !state.address) {
        return { message: 'Wallet not connected. Please connect your wallet first.' };
      }

      const bridge = await getBridgeService();

      let bridgeTx;
      if (sourceChainId === 5042002) {
        bridgeTx = await withTimeout(bridge.bridge(amount, destinationChainId), CONFIG.BRIDGE_TIMEOUT, 'Bridge transaction');
      } else {
        bridgeTx = await withTimeout(bridge.bridgeInbound(amount, sourceChainId), CONFIG.BRIDGE_TIMEOUT, 'Bridge inbound transaction');
      }

      const sourceChainName = sourceChainId === 5042002 ? 'Arc' : 'Base Sepolia';
      const destChainName = destinationChainId === 5042002 ? 'Arc' : 'Base Sepolia';
      const explorerUrl = sourceChainId === 5042002
        ? `https://testnet.arcscan.app/tx/${bridgeTx.burnTxHash}`
        : `https://sepolia.basescan.org/tx/${bridgeTx.burnTxHash}`;

      return {
        message: `**Bridge Started**\n\nBridging ${amount} USDC from ${sourceChainName} to ${destChainName}\n\nBurn Tx: ${bridgeTx.burnTxHash?.slice(0, 10)}...${bridgeTx.burnTxHash?.slice(-8)}\n\n[View on Explorer](${explorerUrl})\n\n_Waiting for attestation (~15-20 min). Funds will auto-complete on destination._`,
      };
    } catch (error: any) {
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        return { message: 'Bridge cancelled. You can try again when ready.' };
      }
      if (error.message?.includes('insufficient') || error.message?.includes('balance')) {
        return { message: 'Insufficient USDC balance. Please check your wallet balance.' };
      }
      return { message: `Bridge failed: ${error.message}` };
    }
  }

  private async handleBalanceIntent(intent: AgentIntent): Promise<{ message: string }> {
    const { token } = intent.params;

    try {
      const circleWallet = await getCircleWalletService();
      const state = circleWallet.getState();

      if (!state.isConnected || !state.address) {
        return { message: 'Wallet not connected. Please connect your wallet first.' };
      }

      const balances = state.balances || {};

      if (token) {
        const tokenUpper = token.toUpperCase();
        const balance = balances[tokenUpper] || '0';
        return { message: `**Your ${tokenUpper} Balance:** ${balance} ${tokenUpper}` };
      }

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

      for (const [t, bal] of Object.entries(balances)) {
        if (!tokenOrder.includes(t) && parseFloat(bal as string) > 0) {
          balanceLines.push(`• **${t}:** ${parseFloat(bal as string).toFixed(4)}`);
        }
      }

      const shortAddress = `${state.address.slice(0, 6)}...${state.address.slice(-4)}`;

      if (balanceLines.length === 0) {
        return { message: `**Wallet Balance**\n\nNo tokens found yet.\n\nAddress: ${shortAddress}` };
      }

      return { message: `**Wallet Balance**\n\n${balanceLines.join('\n')}\n\nAddress: ${shortAddress}` };
    } catch (error: any) {
      return { message: `Balance check failed: ${error.message}` };
    }
  }

  private async handleAnalyzeWalletIntent(
    intent: AgentIntent,
    callbacks: {
      onPaymentRequired?: (requirements: X402PaymentRequirements) => Promise<boolean>;
      onPaymentSent?: (result: X402PaymentResult) => void;
    }
  ): Promise<{ message: string; paymentInfo?: X402PaymentResult }> {
    const { address } = intent.params;

    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return { message: "Please provide a valid wallet address to analyze (e.g., 'Analyze 0x742d35Cc...')." };
    }

    const cost = SERVICE_COSTS.ANALYZE_WALLET;
    if (this.spending.today + cost > this.policy.dailyBudget) {
      return { message: `Daily spending limit reached ($${this.spending.today.toFixed(2)}/$${this.policy.dailyBudget.toFixed(2)}). Try again tomorrow or increase your limit in settings.` };
    }

    let paymentInfo: X402PaymentResult | undefined;

    try {
      const result = await analyzeWalletRisk(address, {
        onPaymentRequired: callbacks.onPaymentRequired,
        onPaymentSent: (payment) => {
          paymentInfo = payment;
          this.recordSpending(parseFloat(payment.amount));
          if (callbacks.onPaymentSent) callbacks.onPaymentSent(payment);
        },
      });

      const riskIndicator = { LOW: '[LOW]', MEDIUM: '[MEDIUM]', HIGH: '[HIGH]', CRITICAL: '[CRITICAL]' }[result.riskLevel];
      const flagsList = result.flags.length > 0
        ? `\n\nFlags detected:\n${result.flags.map(f => `• ${f.replace(/_/g, ' ')}`).join('\n')}`
        : '';

      return {
        message: `${riskIndicator} **Risk Analysis for ${address.slice(0, 6)}...${address.slice(-4)}**\n\n**Risk Level:** ${result.riskLevel}\n**Risk Score:** ${result.riskScore}/100\n${flagsList}\n\n**Recommendation:** ${result.recommendation}`,
        paymentInfo,
      };
    } catch (error: any) {
      if (error.message === 'Payment rejected by user') {
        return { message: 'Risk analysis cancelled. No payment was made.' };
      }
      throw error;
    }
  }

  private async handlePriceIntent(
    intent: AgentIntent,
    callbacks: {
      onPaymentRequired?: (requirements: X402PaymentRequirements) => Promise<boolean>;
      onPaymentSent?: (result: X402PaymentResult) => void;
    }
  ): Promise<{ message: string; paymentInfo?: X402PaymentResult }> {
    const token = intent.params.token || 'USDC';

    const cost = SERVICE_COSTS.GET_PRICE;
    if (this.spending.today + cost > this.policy.dailyBudget) {
      return { message: 'Daily spending limit reached. Try again tomorrow.' };
    }

    let paymentInfo: X402PaymentResult | undefined;

    try {
      const result = await getTokenPrice(token, {
        onPaymentRequired: callbacks.onPaymentRequired,
        onPaymentSent: (payment) => {
          paymentInfo = payment;
          this.recordSpending(parseFloat(payment.amount));
          if (callbacks.onPaymentSent) callbacks.onPaymentSent(payment);
        },
      });

      const changeSign = result.change24h >= 0 ? '+' : '';

      return {
        message: `**${token} Price Data**\n\n**Price:** $${result.price.toLocaleString()}\n**24h Change:** ${changeSign}${result.change24h.toFixed(2)}%\n**24h Volume:** $${result.volume24h.toLocaleString()}\n**Market Cap:** $${result.marketCap.toLocaleString()}\n\n_Last updated: ${new Date(result.lastUpdated).toLocaleTimeString()}_`,
        paymentInfo,
      };
    } catch (error: any) {
      if (error.message === 'Payment rejected by user') {
        return { message: 'Price lookup cancelled.' };
      }
      throw error;
    }
  }

  private async handleNewsIntent(
    callbacks: {
      onPaymentRequired?: (requirements: X402PaymentRequirements) => Promise<boolean>;
      onPaymentSent?: (result: X402PaymentResult) => void;
    }
  ): Promise<{ message: string; paymentInfo?: X402PaymentResult }> {
    const cost = SERVICE_COSTS.GET_NEWS;
    if (this.spending.today + cost > this.policy.dailyBudget) {
      return { message: 'Daily spending limit reached. Try again tomorrow.' };
    }

    let paymentInfo: X402PaymentResult | undefined;

    try {
      const result = await getNewsSummary({
        onPaymentRequired: callbacks.onPaymentRequired,
        onPaymentSent: (payment) => {
          paymentInfo = payment;
          this.recordSpending(parseFloat(payment.amount));
          if (callbacks.onPaymentSent) callbacks.onPaymentSent(payment);
        },
      });

      const headlines = result.headlines.map(h => `• ${h.title} _(${h.source})_`).join('\n');

      return {
        message: `**Market News Summary**\n\n${result.summary}\n\n**Headlines:**\n${headlines}\n\n**Market Sentiment:** ${result.marketSentiment.toUpperCase()}`,
        paymentInfo,
      };
    } catch (error: any) {
      if (error.message === 'Payment rejected by user') {
        return { message: 'News summary cancelled.' };
      }
      throw error;
    }
  }

  private async handleTransactionsIntent(intent: AgentIntent): Promise<{ message: string }> {
    let { address } = intent.params;

    if (!address) {
      try {
        const circleWallet = await getCircleWalletService();
        const state = circleWallet.getState();
        if (state.isConnected && state.address) {
          address = state.address;
        } else {
          return { message: 'Wallet not connected. Please connect your wallet first or provide an address.' };
        }
      } catch (error) {
        return { message: 'Could not get wallet state. Please provide an address.' };
      }
    }

    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return { message: 'Invalid address format. Please provide a valid Ethereum address.' };
    }

    const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;

    try {
      const explorerUrl = 'https://explorer.arc.circle.com/api/v2';
      const response = await fetch(
        `${explorerUrl}/addresses/${address}/transactions?filter=to%20%7C%20from`,
        { headers: { 'Accept': 'application/json' } }
      );

      if (!response.ok) {
        throw new Error('Explorer API error');
      }

      const data = await response.json();
      const transactions = data.items || [];

      if (transactions.length === 0) {
        return { message: `**${shortAddr} Transaction History**\n\nNo transactions found for this address.` };
      }

      const txList = transactions.slice(0, 10).map((tx: any) => {
        const isIncoming = tx.to?.hash?.toLowerCase() === address.toLowerCase();
        const direction = isIncoming ? '📥' : '📤';
        const otherAddr = isIncoming ? tx.from?.hash?.slice(0, 8) + '...' : tx.to?.hash?.slice(0, 8) + '...';
        const value = tx.value ? (parseInt(tx.value) / 1e18).toFixed(4) : '0';
        const time = new Date(tx.timestamp).toLocaleDateString();
        const status = tx.status === 'ok' ? '✓' : '✗';

        return `${direction} ${value} ARC ${isIncoming ? 'from' : 'to'} ${otherAddr} ${status} (${time})`;
      }).join('\n');

      const totalTx = data.next_page_params ? '10+' : transactions.length;

      return {
        message: `**${shortAddr} Transaction History**\n\nTotal: ${totalTx} transactions\n\n**Recent Transactions:**\n${txList}\n\n_📥 Incoming | 📤 Outgoing_`,
      };
    } catch (error: any) {
      return { message: `Could not fetch transaction history. Explorer: https://explorer.arc.circle.com/address/${address}` };
    }
  }

  private recordSpending(amount: number): void {
    this.spending.today += amount;
    this.spending.thisWeek += amount;
    this.spending.thisMonth += amount;
    this.saveSpendingToStorage();
  }

  resetDailySpending(): void {
    this.spending.today = 0;
    this.saveSpendingToStorage();
  }

  private saveSpendingToStorage(): void {
    try {
      localStorage.setItem('arc_agent_spending', JSON.stringify({ ...this.spending, lastReset: Date.now() }));
    } catch (e) {}
  }

  private loadSpendingFromStorage(): void {
    try {
      const stored = localStorage.getItem('arc_agent_spending');
      if (stored) {
        const data = JSON.parse(stored);
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
    } catch (e) {}
  }

  private savePolicyToStorage(): void {
    try {
      localStorage.setItem('arc_agent_policy', JSON.stringify(this.policy));
    } catch (e) {}
  }

  private loadPolicyFromStorage(): void {
    try {
      const stored = localStorage.getItem('arc_agent_policy');
      if (stored) {
        this.policy = { ...DEFAULT_POLICY, ...JSON.parse(stored) };
      }
    } catch (e) {}
  }
}

export const agentService = new AgentService();
export default agentService;
