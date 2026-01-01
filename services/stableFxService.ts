/**
 * Circle StableFX Service
 *
 * Uses Circle's institutional-grade FX engine for USDC ↔ EURC swaps
 * with competitive rates and instant settlement on Arc.
 */

import { TokenInfo } from '../config/tokens';

// StableFX API Configuration
const STABLEFX_CONFIG = {
  // API Endpoints
  sandboxUrl: 'https://api-sandbox.circle.com/v1/exchange/stablefx',
  productionUrl: 'https://api.circle.com/v1/exchange/stablefx',

  // Settlement contract on Arc Testnet
  escrowContract: '0x1f91886C7028986aD885ffCee0e40b75C9cd5aC1',

  // Minimum swap amount (in USDC equivalent)
  minimumAmount: '10',

  // Supported currencies
  supportedCurrencies: ['USDC', 'EURC'],

  // Quote expiry buffer (don't use quotes about to expire)
  quoteExpiryBuffer: 30_000, // 30 seconds
};

// Get API key from environment
const getApiKey = (): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env.VITE_CIRCLE_STABLEFX_API_KEY ||
           (import.meta as any).env.VITE_CIRCLE_API_KEY || '';
  }
  return '';
};

// Check if we're in sandbox mode
const isSandbox = (): boolean => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env.VITE_STABLEFX_SANDBOX !== 'false';
  }
  return true; // Default to sandbox
};

const getBaseUrl = (): string => {
  return isSandbox() ? STABLEFX_CONFIG.sandboxUrl : STABLEFX_CONFIG.productionUrl;
};

// Types
export interface StableFxQuote {
  id: string;
  rate: number;
  from: {
    currency: string;
    amount: string;
  };
  to: {
    currency: string;
    amount: string;
  };
  fee: {
    currency: string;
    amount: string;
  };
  createdAt: string;
  expiresAt: string;
}

export interface StableFxTrade {
  id: string;
  contractTradeId: string;
  status: 'pending' | 'settled' | 'failed' | 'breached';
  rate: number;
  from: {
    currency: string;
    amount: string;
  };
  to: {
    currency: string;
    amount: string;
  };
  quoteId: string;
  createDate: string;
  updateDate: string;
  settlementTransactionHash?: string;
}

export interface SwapQuote {
  fromToken: TokenInfo;
  toToken: TokenInfo;
  fromAmount: string;
  toAmount: string;
  rate: string;
  fee: string;
  estimatedGas: string;
  priceImpact: string;
  minimumReceived: string;
  timestamp: number;
  expiresAt: number;
  source: 'stablefx' | 'uniswap';
  stableFxQuoteId?: string;
}

class StableFxService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = getApiKey();
    this.baseUrl = getBaseUrl();
  }

  /**
   * Check if StableFX is available and configured
   */
  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Check if a token pair is supported by StableFX
   */
  isPairSupported(fromSymbol: string, toSymbol: string): boolean {
    return (
      STABLEFX_CONFIG.supportedCurrencies.includes(fromSymbol) &&
      STABLEFX_CONFIG.supportedCurrencies.includes(toSymbol) &&
      fromSymbol !== toSymbol
    );
  }

  /**
   * Request a quote from Circle StableFX
   */
  async getQuote(
    fromToken: TokenInfo,
    toToken: TokenInfo,
    amount: string,
    direction: 'from' | 'to' = 'from'
  ): Promise<StableFxQuote> {
    if (!this.isAvailable()) {
      throw new Error('StableFX API key not configured');
    }

    if (!this.isPairSupported(fromToken.symbol, toToken.symbol)) {
      throw new Error(`Pair ${fromToken.symbol}/${toToken.symbol} not supported by StableFX`);
    }

    // Validate minimum amount
    if (parseFloat(amount) < parseFloat(STABLEFX_CONFIG.minimumAmount)) {
      throw new Error(`Minimum swap amount is ${STABLEFX_CONFIG.minimumAmount} ${fromToken.symbol}`);
    }

    const requestBody: any = {
      tenor: 'instant', // Fastest settlement
    };

    if (direction === 'from') {
      requestBody.from = {
        currency: fromToken.symbol,
        amount: amount,
      };
      requestBody.to = {
        currency: toToken.symbol,
      };
    } else {
      requestBody.from = {
        currency: fromToken.symbol,
      };
      requestBody.to = {
        currency: toToken.symbol,
        amount: amount,
      };
    }

    console.log('[StableFX] Requesting quote:', requestBody);

    const response = await fetch(`${this.baseUrl}/quotes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[StableFX] Quote request failed:', error);
      throw new Error(error.message || `StableFX quote failed: ${response.status}`);
    }

    const quote = await response.json();
    console.log('[StableFX] Quote received:', quote);

    return quote;
  }

  /**
   * Convert StableFX quote to our standard SwapQuote format
   */
  toSwapQuote(
    stableFxQuote: StableFxQuote,
    fromToken: TokenInfo,
    toToken: TokenInfo
  ): SwapQuote {
    const expiresAt = new Date(stableFxQuote.expiresAt).getTime();

    return {
      fromToken,
      toToken,
      fromAmount: stableFxQuote.from.amount,
      toAmount: stableFxQuote.to.amount,
      rate: stableFxQuote.rate.toFixed(6),
      fee: `${stableFxQuote.fee.amount} ${stableFxQuote.fee.currency}`,
      estimatedGas: '0', // Gasless via Circle
      priceImpact: '< 0.01%', // StableFX has minimal impact
      minimumReceived: stableFxQuote.to.amount, // No slippage with RFQ
      timestamp: Date.now(),
      expiresAt,
      source: 'stablefx',
      stableFxQuoteId: stableFxQuote.id,
    };
  }

  /**
   * Execute a trade using a previously obtained quote
   */
  async executeTrade(quoteId: string): Promise<StableFxTrade> {
    if (!this.isAvailable()) {
      throw new Error('StableFX API key not configured');
    }

    const idempotencyKey = crypto.randomUUID();

    console.log('[StableFX] Executing trade for quote:', quoteId);

    const response = await fetch(`${this.baseUrl}/trades`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idempotencyKey,
        quoteId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[StableFX] Trade execution failed:', error);
      throw new Error(error.message || `StableFX trade failed: ${response.status}`);
    }

    const trade = await response.json();
    console.log('[StableFX] Trade created:', trade);

    return trade;
  }

  /**
   * Get trade status
   */
  async getTradeStatus(tradeId: string): Promise<StableFxTrade> {
    if (!this.isAvailable()) {
      throw new Error('StableFX API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/trades/${tradeId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get trade status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Full swap flow: get quote and execute
   */
  async swap(
    fromToken: TokenInfo,
    toToken: TokenInfo,
    amount: string
  ): Promise<{ trade: StableFxTrade; quote: StableFxQuote }> {
    // Step 1: Get quote
    const quote = await this.getQuote(fromToken, toToken, amount);

    // Step 2: Check quote hasn't expired
    const expiresAt = new Date(quote.expiresAt).getTime();
    if (Date.now() > expiresAt - STABLEFX_CONFIG.quoteExpiryBuffer) {
      throw new Error('Quote expired, please try again');
    }

    // Step 3: Execute trade
    const trade = await this.executeTrade(quote.id);

    return { trade, quote };
  }

  /**
   * Get configuration info
   */
  getConfig() {
    return {
      ...STABLEFX_CONFIG,
      isAvailable: this.isAvailable(),
      isSandbox: isSandbox(),
    };
  }
}

export const stableFxService = new StableFxService();
