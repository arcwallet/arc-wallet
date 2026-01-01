/**
 * Swap Service - StableFX Only
 *
 * Uses Circle StableFX for institutional-grade USDC ↔ EURC swaps
 * with competitive rates and instant settlement on Arc.
 */

import { TokenInfo } from '../config/tokens';
import { stableFxService, SwapQuote as StableFxSwapQuote } from './stableFxService';
import { TypedDataParams } from './circleWalletService';

export interface Quote {
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
  warning?: string;
  usingFallback?: boolean;
  source: 'stablefx';
  stableFxQuoteId: string;
}

// Quote freshness configuration
const QUOTE_CONFIG = {
  STALE_TIME: 10_000, // 10 seconds - quote becomes stale
  EXPIRY_BUFFER: 30_000, // 30 seconds before expiry, consider it expired
};

class SwapService {
  constructor() {
    // No initialization needed - StableFX service handles everything
  }

  /**
   * Check if swap service is available
   */
  isAvailable(): boolean {
    return stableFxService.isAvailable();
  }

  /**
   * Check if a token pair is supported
   */
  isPairSupported(fromSymbol: string, toSymbol: string): boolean {
    return stableFxService.isPairSupported(fromSymbol, toSymbol);
  }

  /**
   * Get a quote for swapping tokens via Circle StableFX
   */
  async getQuote(
    fromToken: TokenInfo,
    toToken: TokenInfo,
    amount: string
  ): Promise<Quote> {
    // Validate inputs
    if (!amount || parseFloat(amount) <= 0) {
      throw new Error('Invalid amount');
    }

    // Check if StableFX is available
    if (!stableFxService.isAvailable()) {
      throw new Error('StableFX is not configured. Please set VITE_CIRCLE_STABLEFX_API_KEY in your environment.');
    }

    // Check if pair is supported
    if (!stableFxService.isPairSupported(fromToken.symbol, toToken.symbol)) {
      throw new Error(`Pair ${fromToken.symbol}/${toToken.symbol} is not supported. StableFX only supports USDC ↔ EURC.`);
    }

    console.log('[SWAP] Getting StableFX quote:', {
      from: fromToken.symbol,
      to: toToken.symbol,
      amount,
    });

    try {
      // Get quote from StableFX
      const stableFxQuote = await stableFxService.getQuote(fromToken, toToken, amount);

      console.log('[SWAP] StableFX quote received:', {
        id: stableFxQuote.id,
        rate: stableFxQuote.rate,
        toAmount: stableFxQuote.to.amount,
        fee: stableFxQuote.fee.amount,
        expiresAt: stableFxQuote.expiresAt,
      });

      // Convert to our Quote format
      const quote: Quote = {
        fromToken,
        toToken,
        fromAmount: stableFxQuote.from.amount,
        toAmount: stableFxQuote.to.amount,
        rate: stableFxQuote.rate.toFixed(6),
        fee: `${stableFxQuote.fee.amount} ${stableFxQuote.fee.currency}`,
        estimatedGas: '0', // Gasless via Circle
        priceImpact: '< 0.01%', // RFQ model - no price impact
        minimumReceived: stableFxQuote.to.amount, // No slippage with RFQ
        timestamp: Date.now(),
        expiresAt: new Date(stableFxQuote.expiresAt).getTime(),
        source: 'stablefx',
        stableFxQuoteId: stableFxQuote.id,
      };

      return quote;
    } catch (error: any) {
      console.error('[SWAP] StableFX quote failed:', error);

      // Provide helpful error messages
      if (error?.message?.includes('Minimum')) {
        throw error;
      } else if (error?.message?.includes('not supported')) {
        throw error;
      } else if (error?.message?.includes('API key')) {
        throw new Error('StableFX API key not configured. Contact sales@circle.com for access.');
      }

      throw new Error(error?.message || 'Failed to get swap quote from StableFX.');
    }
  }

  /**
   * Check if quote is still fresh (not stale)
   */
  isQuoteFresh(quote: Quote): boolean {
    return Date.now() - quote.timestamp < QUOTE_CONFIG.STALE_TIME;
  }

  /**
   * Check if quote has expired
   */
  isQuoteExpired(quote: Quote): boolean {
    return Date.now() > quote.expiresAt - QUOTE_CONFIG.EXPIRY_BUFFER;
  }

  /**
   * Execute a token swap via Circle StableFX
   *
   * Full flow:
   * 1. Create Trade from Quote
   * 2. Get Trade Presign Data → Sign → Register Signature
   * 3. Get Funding Presign Data → Sign → Fund Trade
   * 4. Wait for settlement
   */
  async executeSwap(
    quote: Quote,
    signTypedData: (params: TypedDataParams) => Promise<`0x${string}`>,
    walletAddress: string
  ): Promise<string> {
    // Validate quote
    if (!quote.stableFxQuoteId) {
      throw new Error('Invalid quote - no StableFX quote ID');
    }

    // Check quote hasn't expired
    if (this.isQuoteExpired(quote)) {
      throw new Error('Quote expired. Please get a fresh quote.');
    }

    console.log('[SWAP] Executing StableFX swap:', {
      quoteId: quote.stableFxQuoteId,
      from: quote.fromToken.symbol,
      to: quote.toToken.symbol,
      amount: quote.fromAmount,
      wallet: walletAddress,
    });

    try {
      // Execute the full StableFX swap flow
      const result = await stableFxService.executeSwap(
        quote.fromToken,
        quote.toToken,
        quote.fromAmount,
        signTypedData,
        walletAddress
      );

      console.log('[SWAP] StableFX swap completed:', {
        tradeId: result.tradeId,
        txHash: result.txHash,
      });

      return result.txHash || result.tradeId;
    } catch (error: any) {
      console.error('[SWAP] StableFX swap failed:', error);

      // Enhanced error messages
      if (error?.message?.includes('expired')) {
        throw new Error('Quote expired. Please get a fresh quote and try again.');
      } else if (error?.message?.includes('signature')) {
        throw new Error('Signature verification failed. Please try again.');
      } else if (error?.message?.includes('insufficient')) {
        throw new Error('Insufficient balance for this swap.');
      } else if (error?.message?.includes('cancelled') || error?.message?.includes('rejected')) {
        throw new Error('Transaction was cancelled.');
      }

      throw new Error(error?.message || 'Swap failed. Please try again.');
    }
  }

  /**
   * Execute swap with PasskeyManager adapter (for backward compatibility with SwapScreen)
   */
  async executeSwapWithPasskey(
    quote: Quote,
    passkeyManager: {
      getAccountAddress: () => string | null;
      executeTransaction: (to: string, value: bigint, data: string) => Promise<{ hash?: string }>;
    },
    signTypedData?: (params: TypedDataParams) => Promise<`0x${string}`>
  ): Promise<string> {
    const walletAddress = passkeyManager.getAccountAddress();
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    if (!signTypedData) {
      throw new Error('signTypedData function required for StableFX swaps');
    }

    return this.executeSwap(quote, signTypedData, walletAddress);
  }

  /**
   * Get StableFX configuration
   */
  getConfig() {
    return stableFxService.getConfig();
  }

  /**
   * Get slippage tolerance (always 0 for RFQ model)
   */
  getSlippageTolerance(): number {
    return 0; // RFQ model - no slippage
  }

  /**
   * Set slippage tolerance (no-op for RFQ model)
   */
  setSlippageTolerance(_slippage: number): { success: boolean; warning?: string } {
    return {
      success: true,
      warning: 'StableFX uses RFQ model - slippage tolerance is not applicable.',
    };
  }
}

export const swapService = new SwapService();
