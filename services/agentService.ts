/**
 * Arc Agent Service
 *
 * Orchestrates all Arc Agent capabilities:
 * - Intent parsing and execution
 * - x402 payments for premium services
 * - Wallet operations (send, swap, bridge)
 * - Policy enforcement
 */

import {
  parseIntent,
  analyzeWalletRisk,
  getTokenPrice,
  getNewsSummary,
  type X402PaymentRequirements,
  type X402PaymentResult,
} from './x402Client';
import { logger } from './logger';

// Lazy load circleWalletService to avoid module crash
let _circleWalletService: any = null;
async function getCircleWalletService() {
  if (!_circleWalletService) {
    const module = await import('./circleWalletService');
    _circleWalletService = module.circleWalletService;
  }
  return _circleWalletService;
}

// Lazy load bridgeService
let _bridgeService: any = null;
async function getBridgeService() {
  if (!_bridgeService) {
    const module = await import('./bridgeService');
    _bridgeService = module.bridgeService;
  }
  return _bridgeService;
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

// ============================================
// Types
// ============================================

export type IntentType =
  | 'SEND'
  | 'SWAP'
  | 'BRIDGE'
  | 'CHECK_BALANCE'
  | 'ANALYZE_WALLET'
  | 'GET_PRICE'
  | 'GET_NEWS'
  | 'UNKNOWN';

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
    'SWAP',
    'BRIDGE',
    'CHECK_BALANCE',
    'ANALYZE_WALLET',
    'GET_PRICE',
    'GET_NEWS',
  ],
};

// x402 service costs
const SERVICE_COSTS: Record<string, number> = {
  ANALYZE_WALLET: 0.02,
  GET_PRICE: 0.01,
  GET_NEWS: 0.03,
};

// ============================================
// Agent Service Class
// ============================================

class AgentService {
  private policy: AgentPolicy = DEFAULT_POLICY;
  private spending: AgentSpending = {
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
  };
  private messages: AgentMessage[] = [];

  /**
   * Initialize agent service
   */
  initialize(): void {
    this.loadSpendingFromStorage();
    this.loadPolicyFromStorage();
    logger.info('Agent service initialized', { component: 'AgentService' });
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

  /**
   * Clear conversation history
   */
  clearMessages(): void {
    this.messages = [];
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

    // Add user message to history
    const userMsg: AgentMessage = {
      id: `${messageId}_user`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };
    this.messages.push(userMsg);

    try {
      // Parse intent
      const intentResult = await parseIntent(userMessage);
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
      this.messages.push(agentMsg);

      return agentMsg;
    } catch (error: any) {
      logger.error('Agent processing error', {
        component: 'AgentService',
        errorMsg: error.message,
      });

      const errorMsg: AgentMessage = {
        id: `${messageId}_agent`,
        role: 'agent',
        content: `I encountered an error: ${error.message}`,
        timestamp: Date.now(),
        error: error.message,
      };
      this.messages.push(errorMsg);

      return errorMsg;
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

      default:
        return {
          message: "I'm not sure how to help with that. Try asking me to:\n" +
            "- Send tokens (e.g., 'Send 10 USDC to 0x...')\n" +
            "- Swap tokens (e.g., 'Swap 50 USDC to EURC')\n" +
            "- Analyze a wallet (e.g., 'Analyze 0x...')\n" +
            "- Get token prices (e.g., 'Price of ETH')\n" +
            "- Get market news",
        };
    }
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
        // Send native ARC token
        const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e18));
        txHash = await circleWallet.sendTransaction({
          to: recipient,
          value: amountWei,
        });
      } else {
        // Send ERC20 token
        txHash = await circleWallet.sendTokenTransfer({
          tokenAddress,
          to: recipient,
          amount,
          decimals: tokenUpper === 'USDC' || tokenUpper === 'EURC' ? 6 : 18,
        });
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
   * Handle SWAP intent
   */
  private async handleSwapIntent(
    intent: AgentIntent,
    callbacks: { onNavigate?: (page: string, data?: any) => void }
  ): Promise<{ message: string }> {
    const { fromToken, toToken, amount } = intent.params;

    // Navigate to Swap page with pre-filled data
    if (callbacks.onNavigate) {
      callbacks.onNavigate('Swap', {
        type: 'SWAP',
        params: { fromToken, toToken, amount },
      });
    }

    return {
      message: `I'm preparing to swap ${amount} ${fromToken} to ${toToken}. Please review and confirm on the Swap page.`,
    };
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
        // Arc to Base Sepolia (outbound)
        bridgeTx = await bridge.bridge(amount, destinationChainId);
      } else {
        // Base Sepolia to Arc (inbound)
        bridgeTx = await bridge.bridgeInbound(amount, sourceChainId);
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
        message: `**Bridge Started!**\n\nBridging ${amount} USDC from ${sourceChainName} to ${destChainName}\n\nBurn Tx: ${bridgeTx.burnTxHash?.slice(0, 10)}...${bridgeTx.burnTxHash?.slice(-8)}\n\n[View on Explorer](${explorerUrl})\n\n⏳ Waiting for attestation (~15-20 min). Funds will auto-complete on destination.`,
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
   * Handle CHECK_BALANCE intent
   */
  private async handleBalanceIntent(
    intent: AgentIntent
  ): Promise<{ message: string }> {
    const { token } = intent.params;

    if (token) {
      return {
        message: `To check your ${token} balance, please look at the Dashboard. Your balances are displayed there.`,
      };
    }

    return {
      message: "Your wallet balances are displayed on the Dashboard. Would you like me to analyze a specific wallet address instead?",
    };
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
      const riskEmoji = {
        LOW: '✅',
        MEDIUM: '⚠️',
        HIGH: '🔴',
        CRITICAL: '🚨',
      }[result.riskLevel];

      const flagsList = result.flags.length > 0
        ? `\n\nFlags detected:\n${result.flags.map(f => `• ${f.replace(/_/g, ' ')}`).join('\n')}`
        : '';

      return {
        message: `${riskEmoji} **Risk Analysis for ${address.slice(0, 6)}...${address.slice(-4)}**\n\n` +
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

      const changeEmoji = result.change24h >= 0 ? '📈' : '📉';
      const changeColor = result.change24h >= 0 ? '+' : '';

      return {
        message: `**${token} Price Data** ${changeEmoji}\n\n` +
          `**Price:** $${result.price.toLocaleString()}\n` +
          `**24h Change:** ${changeColor}${result.change24h.toFixed(2)}%\n` +
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

      const sentimentEmoji = {
        bullish: '🟢',
        neutral: '🟡',
        bearish: '🔴',
      }[result.marketSentiment] || '⚪';

      const headlines = result.headlines
        .map(h => `• ${h.title} _(${h.source})_`)
        .join('\n');

      return {
        message: `**Market News Summary** ${sentimentEmoji}\n\n` +
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

  /**
   * Record spending
   */
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
