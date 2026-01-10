/**
 * Swap Service
 *
 * Uses Curve StableSwap pool for USDC ↔ EURC swaps on Arc Testnet
 * with near-zero slippage optimized for stablecoin pairs.
 */

import { TokenInfo } from '../config/tokens';
import { curveSwapService, CurveQuote } from './curveSwapService';

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
  source: 'curve';
  poolAddress: string;
}

// Quote freshness configuration
const QUOTE_CONFIG = {
  STALE_TIME: 30_000, // 30 seconds - quote becomes stale
  EXPIRY_TIME: 60_000, // 60 seconds - quote expires
};

class SwapService {
  private slippageTolerance: number = 0.5; // 0.5% default

  constructor() {
    // Curve service handles initialization
  }

  /**
   * Check if swap service is available
   */
  isAvailable(): boolean {
    return curveSwapService.isAvailable();
  }

  /**
   * Check if a token pair is supported
   */
  isPairSupported(fromSymbol: string, toSymbol: string): boolean {
    return curveSwapService.isPairSupported(fromSymbol, toSymbol);
  }

  /**
   * Get a quote for swapping tokens via Curve
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

    // Check if pair is supported
    if (!curveSwapService.isPairSupported(fromToken.symbol, toToken.symbol)) {
      throw new Error(`Pair ${fromToken.symbol}/${toToken.symbol} is not supported. Only USDC ↔ EURC is available.`);
    }

    console.log('[SWAP] Getting Curve quote:', {
      from: fromToken.symbol,
      to: toToken.symbol,
      amount,
    });

    try {
      // Get quote from Curve
      const curveQuote = await curveSwapService.getQuote(fromToken, toToken, amount);

      console.log('[SWAP] Curve quote received:', {
        rate: curveQuote.rate,
        toAmount: curveQuote.toAmount,
        fee: curveQuote.fee,
      });

      // Convert to our Quote format
      const quote: Quote = {
        fromToken,
        toToken,
        fromAmount: curveQuote.fromAmount,
        toAmount: curveQuote.toAmount,
        rate: curveQuote.rate,
        fee: curveQuote.fee,
        estimatedGas: '~0.01 USDC',
        priceImpact: curveQuote.priceImpact,
        minimumReceived: curveQuote.minimumReceived,
        timestamp: curveQuote.timestamp,
        expiresAt: curveQuote.timestamp + QUOTE_CONFIG.EXPIRY_TIME,
        source: 'curve',
        poolAddress: curveQuote.poolAddress,
      };

      return quote;
    } catch (error: any) {
      console.error('[SWAP] Curve quote failed:', error);

      if (error?.message?.includes('Minimum')) {
        throw error;
      } else if (error?.message?.includes('not supported')) {
        throw error;
      }

      throw new Error(error?.message || 'Failed to get swap quote.');
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
    return Date.now() > quote.expiresAt;
  }

  /**
   * Execute a token swap via Curve
   */
  async executeSwap(
    quote: Quote,
    executeTransaction: (to: string, value: bigint, data: string) => Promise<{ hash?: string }>,
    walletAddress: string
  ): Promise<string> {
    // Validate quote
    if (!quote.poolAddress) {
      throw new Error('Invalid quote - no pool address');
    }

    // Check quote hasn't expired
    if (this.isQuoteExpired(quote)) {
      throw new Error('Quote expired. Please get a fresh quote.');
    }

    console.log('[SWAP] Executing Curve swap:', {
      from: quote.fromToken.symbol,
      to: quote.toToken.symbol,
      amount: quote.fromAmount,
      wallet: walletAddress,
    });

    try {
      // Get token address for approval
      const fromTokenAddress = quote.fromToken.contractAddresses.testnet?.arcTestnet;
      if (!fromTokenAddress) {
        throw new Error(`Token ${quote.fromToken.symbol} not configured for Arc Testnet`);
      }

      // Step 1: Check and do approval if needed
      const hasAllowance = await curveSwapService.checkAllowance(
        fromTokenAddress,
        walletAddress,
        quote.fromAmount,
        quote.fromToken.decimals
      );

      if (!hasAllowance) {
        console.log('[SWAP] Approving token spend...');
        const approvalTx = curveSwapService.buildApprovalTransaction(
          fromTokenAddress,
          quote.fromAmount,
          quote.fromToken.decimals
        );

        const approvalResult = await executeTransaction(
          approvalTx.to,
          approvalTx.value,
          approvalTx.data
        );

        if (!approvalResult.hash) {
          throw new Error('Approval transaction failed');
        }

        console.log('[SWAP] Approval tx:', approvalResult.hash);

        // Wait a bit for approval to be mined
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Step 2: Execute swap
      console.log('[SWAP] Executing swap transaction...');
      const swapTx = curveSwapService.buildSwapTransaction(
        quote.fromToken,
        quote.toToken,
        quote.fromAmount,
        quote.minimumReceived,
        walletAddress
      );

      const swapResult = await executeTransaction(
        swapTx.to,
        swapTx.value,
        swapTx.data
      );

      if (!swapResult.hash) {
        throw new Error('Swap transaction failed');
      }

      console.log('[SWAP] Swap completed:', swapResult.hash);
      return swapResult.hash;
    } catch (error: any) {
      console.error('[SWAP] Swap failed:', error);

      if (error?.message?.includes('expired')) {
        throw new Error('Quote expired. Please get a fresh quote and try again.');
      } else if (error?.message?.includes('insufficient')) {
        throw new Error('Insufficient balance for this swap.');
      } else if (error?.message?.includes('cancelled') || error?.message?.includes('rejected')) {
        throw new Error('Transaction was cancelled.');
      }

      throw new Error(error?.message || 'Swap failed. Please try again.');
    }
  }

  /**
   * Execute swap with PasskeyManager adapter (for SwapScreen compatibility)
   */
  async executeSwapWithPasskey(
    quote: Quote,
    passkeyManager: {
      getAccountAddress: () => string | null;
      executeTransaction: (to: string, value: bigint, data: string) => Promise<{ hash?: string }>;
    }
  ): Promise<string> {
    const walletAddress = passkeyManager.getAccountAddress();
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    return this.executeSwap(
      quote,
      passkeyManager.executeTransaction.bind(passkeyManager),
      walletAddress
    );
  }

  /**
   * Get Curve pool configuration
   */
  getConfig() {
    return curveSwapService.getConfig();
  }

  /**
   * Get slippage tolerance
   */
  getSlippageTolerance(): number {
    return this.slippageTolerance;
  }

  /**
   * Set slippage tolerance
   */
  setSlippageTolerance(slippage: number): { success: boolean; warning?: string } {
    if (slippage < 0.1 || slippage > 5) {
      return {
        success: false,
        warning: 'Slippage must be between 0.1% and 5%',
      };
    }

    this.slippageTolerance = slippage;
    return { success: true };
  }

  /**
   * Get pool liquidity info
   */
  async getPoolLiquidity(): Promise<{ usdc: string; eurc: string }> {
    return curveSwapService.getPoolBalances();
  }
}

export const swapService = new SwapService();
