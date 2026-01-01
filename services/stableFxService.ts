/**
 * Circle StableFX Service
 *
 * Uses Circle's institutional-grade FX engine for USDC ↔ EURC swaps
 * with competitive rates and instant settlement on Arc.
 *
 * Full flow:
 * 1. Create Quote
 * 2. Create Trade
 * 3. Get Trade Presign Data → Sign → Register Signature
 * 4. Get Funding Presign Data → Sign → Fund Trade
 */

import { TokenInfo } from '../config/tokens';
import { circleWalletService, type TypedDataParams } from './circleWalletService';

// StableFX API Configuration
const STABLEFX_CONFIG = {
  // API Endpoints
  sandboxUrl: 'https://api-sandbox.circle.com/v1/exchange/stablefx',
  productionUrl: 'https://api.circle.com/v1/exchange/stablefx',

  // Contract addresses on Arc Testnet
  contracts: {
    fxEscrow: '0x1f91886C7028986aD885ffCee0e40b75C9cd5aC1',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    usdc: '0x3600000000000000000000000000000000000000',
    eurc: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
  },

  // Arc Testnet chainId
  chainId: 5042002,

  // Minimum swap amount (in USDC/EURC)
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
  status: 'pending' | 'pending_settlement' | 'settled' | 'failed' | 'breached';
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

export interface StableFxPresignData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, any>;
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
  source: 'stablefx';
  stableFxQuoteId: string;
}

class StableFxService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = getApiKey();
    this.baseUrl = getBaseUrl();
  }

  /**
   * Refresh API key from environment (useful after config changes)
   */
  refreshConfig(): void {
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
   * Get authorization header
   */
  private getAuthHeader(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Step 1: Request a quote from Circle StableFX
   */
  async getQuote(
    fromToken: TokenInfo,
    toToken: TokenInfo,
    amount: string,
    direction: 'from' | 'to' = 'from'
  ): Promise<StableFxQuote> {
    if (!this.isAvailable()) {
      throw new Error('StableFX API key not configured. Contact sales@circle.com for access.');
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
      headers: this.getAuthHeader(),
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
      priceImpact: '< 0.01%', // StableFX has minimal impact (RFQ model)
      minimumReceived: stableFxQuote.to.amount, // No slippage with RFQ
      timestamp: Date.now(),
      expiresAt,
      source: 'stablefx',
      stableFxQuoteId: stableFxQuote.id,
    };
  }

  /**
   * Step 2: Create a trade from a quote
   */
  async createTrade(quoteId: string): Promise<StableFxTrade> {
    if (!this.isAvailable()) {
      throw new Error('StableFX API key not configured');
    }

    const idempotencyKey = crypto.randomUUID();

    console.log('[StableFX] Creating trade for quote:', quoteId);

    const response = await fetch(`${this.baseUrl}/trades`, {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify({
        idempotencyKey,
        quoteId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[StableFX] Trade creation failed:', error);
      throw new Error(error.message || `StableFX trade creation failed: ${response.status}`);
    }

    const trade = await response.json();
    console.log('[StableFX] Trade created:', trade);

    return trade;
  }

  /**
   * Step 3a: Get trade presign data for EIP-712 signing
   */
  async getTradePresignData(tradeId: string, recipientAddress: string): Promise<StableFxPresignData> {
    console.log('[StableFX] Getting trade presign data:', { tradeId, recipientAddress });

    const url = `${this.baseUrl}/signatures/presign/taker/${tradeId}?recipientAddress=${recipientAddress}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[StableFX] Get presign data failed:', error);
      throw new Error(error.message || `Failed to get presign data: ${response.status}`);
    }

    const data = await response.json();
    console.log('[StableFX] Presign data received');

    return data;
  }

  /**
   * Step 3b: Register trade signature
   */
  async registerTradeSignature(
    tradeId: string,
    walletAddress: string,
    presignData: StableFxPresignData,
    signature: string
  ): Promise<void> {
    console.log('[StableFX] Registering trade signature');

    const response = await fetch(`${this.baseUrl}/signatures`, {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify({
        tradeId,
        type: 'taker',
        address: walletAddress,
        details: presignData.message,
        signature,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[StableFX] Register signature failed:', error);
      throw new Error(error.message || `Failed to register signature: ${response.status}`);
    }

    console.log('[StableFX] Signature registered successfully');
  }

  /**
   * Step 4a: Get funding presign data (Permit2)
   */
  async getFundingPresignData(contractTradeIds: string[]): Promise<StableFxPresignData> {
    console.log('[StableFX] Getting funding presign data:', { contractTradeIds });

    const response = await fetch(`${this.baseUrl}/signatures/funding/presign`, {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify({
        contractTradeIds,
        type: 'taker',
        fundingMode: 'gross',
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[StableFX] Get funding presign data failed:', error);
      throw new Error(error.message || `Failed to get funding data: ${response.status}`);
    }

    const data = await response.json();
    console.log('[StableFX] Funding presign data received');

    return data;
  }

  /**
   * Step 4b: Fund the trade with Permit2 signature
   */
  async fundTrade(
    permit2Message: Record<string, any>,
    signature: string
  ): Promise<void> {
    console.log('[StableFX] Funding trade with Permit2');

    const response = await fetch(`${this.baseUrl}/fund`, {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify({
        type: 'taker',
        signature,
        permit2: permit2Message,
        fundingMode: 'gross',
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[StableFX] Fund trade failed:', error);
      throw new Error(error.message || `Failed to fund trade: ${response.status}`);
    }

    console.log('[StableFX] Trade funded successfully');
  }

  /**
   * Get trade status
   */
  async getTradeStatus(tradeId: string): Promise<StableFxTrade> {
    const response = await fetch(`${this.baseUrl}/trades/${tradeId}`, {
      method: 'GET',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get trade status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Full swap execution flow
   *
   * 1. Create quote
   * 2. Create trade
   * 3. Sign and register trade signature
   * 4. Sign and fund with Permit2
   * 5. Wait for settlement
   */
  async executeSwap(
    fromToken: TokenInfo,
    toToken: TokenInfo,
    amount: string,
    signTypedData: (params: TypedDataParams) => Promise<`0x${string}`>,
    walletAddress: string
  ): Promise<{ tradeId: string; txHash?: string }> {
    console.log('[StableFX] Starting swap execution:', {
      from: fromToken.symbol,
      to: toToken.symbol,
      amount,
      wallet: walletAddress,
    });

    // Step 1: Get quote
    const quote = await this.getQuote(fromToken, toToken, amount);

    // Check quote hasn't expired
    const expiresAt = new Date(quote.expiresAt).getTime();
    if (Date.now() > expiresAt - STABLEFX_CONFIG.quoteExpiryBuffer) {
      throw new Error('Quote expired, please try again');
    }

    // Step 2: Create trade
    const trade = await this.createTrade(quote.id);

    // Step 3: Sign and register trade signature
    console.log('[StableFX] Signing trade agreement...');
    const tradePresignData = await this.getTradePresignData(trade.id, walletAddress);

    const tradeSignature = await signTypedData({
      domain: tradePresignData.domain as TypedDataParams['domain'],
      types: tradePresignData.types,
      primaryType: tradePresignData.primaryType,
      message: tradePresignData.message,
    });

    await this.registerTradeSignature(trade.id, walletAddress, tradePresignData, tradeSignature);

    // Step 4: Sign and fund with Permit2
    console.log('[StableFX] Signing Permit2 funding...');
    const fundingPresignData = await this.getFundingPresignData([trade.contractTradeId]);

    const fundingSignature = await signTypedData({
      domain: fundingPresignData.domain as TypedDataParams['domain'],
      types: fundingPresignData.types,
      primaryType: fundingPresignData.primaryType,
      message: fundingPresignData.message,
    });

    await this.fundTrade(fundingPresignData.message, fundingSignature);

    // Step 5: Poll for settlement (optional - could return immediately)
    console.log('[StableFX] Waiting for settlement...');
    let finalTrade = await this.getTradeStatus(trade.id);
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max wait

    while (finalTrade.status === 'pending_settlement' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      finalTrade = await this.getTradeStatus(trade.id);
      attempts++;
    }

    console.log('[StableFX] Swap completed:', {
      tradeId: trade.id,
      status: finalTrade.status,
      txHash: finalTrade.settlementTransactionHash,
    });

    return {
      tradeId: trade.id,
      txHash: finalTrade.settlementTransactionHash,
    };
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
