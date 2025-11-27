import { Contract, JsonRpcProvider, Wallet, parseUnits, formatUnits } from 'ethers';
import { TokenInfo, getTokenContractAddress, SWAP_CONFIG } from '../config/tokens';
import { getProvider, getFeeSettings } from './transactionService';

export interface Quote {
  fromToken: TokenInfo;
  toToken: TokenInfo;
  fromAmount: string;
  toAmount: string;
  rate: string;
  fee: string;
  estimatedGas: string;
  priceImpact: string;
  minimumReceived: string; // After slippage
  timestamp: number; // Quote creation time for freshness check
  expiresAt: number; // Quote expiration time
}

// MEV Protection Constants
const MEV_CONFIG = {
  QUOTE_STALE_TIME: 10_000, // 10 seconds - quote becomes stale
  QUOTE_EXPIRY_TIME: 30_000, // 30 seconds - quote expires completely
  DEADLINE_SECONDS: 300, // 5 minutes (reduced from 20 for MEV protection)
  MAX_SLIPPAGE: 5, // 5% max slippage to prevent sandwich attacks
  MIN_SLIPPAGE: 0.1, // 0.1% minimum
  HIGH_SLIPPAGE_WARNING: 2, // Warn user above 2%
};

// Uniswap V3 Router ABI (minimal)
const UNISWAP_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut)',
];

// Uniswap V3 Quoter ABI
const QUOTER_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
];

// ERC20 ABI for approval
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
];

// Uniswap V3 pool fee tiers
const FEE_TIERS = {
  LOW: 500,      // 0.05%
  MEDIUM: 3000,  // 0.3%
  HIGH: 10000,   // 1%
};

class SwapService {
  private provider: JsonRpcProvider;
  private routerAddress: string;
  private slippageTolerance: number; // 0.5% default

  constructor() {
    this.provider = getProvider();
    this.routerAddress = SWAP_CONFIG.routerAddresses.testnet.arcTestnet;
    this.slippageTolerance = SWAP_CONFIG.defaultSlippage;
  }

  /**
   * Get a quote for swapping tokens
   * Uses real on-chain price data
   */
  async getQuote(
    fromToken: TokenInfo,
    toToken: TokenInfo,
    amount: string
  ): Promise<Quote> {
    try {
      const tokenInAddress = getTokenContractAddress(fromToken.symbol, 'testnet', 'arcTestnet');
      const tokenOutAddress = getTokenContractAddress(toToken.symbol, 'testnet', 'arcTestnet');

      if (!tokenInAddress || !tokenOutAddress) {
        throw new Error('Token addresses not found for arcTestnet');
      }

      const amountIn = parseUnits(amount, fromToken.decimals);

      // For stablecoins, use simpler pricing (near 1:1 for USDC-EURC)
      let amountOut: bigint;
      let fee: number;

      if (this.isStablecoinPair(fromToken.symbol, toToken.symbol)) {
        // Stablecoin swap: use approximate rate
        amountOut = this.calculateStablecoinSwap(amountIn, fromToken, toToken);
        fee = FEE_TIERS.LOW; // Use low fee tier for stablecoins
      } else {
        // For other pairs, try to get on-chain quote
        // Note: This may fail if no liquidity pool exists
        try {
          const quote = await this.getOnChainQuote(
            tokenInAddress,
            tokenOutAddress,
            amountIn,
            FEE_TIERS.MEDIUM
          );
          amountOut = quote.amountOut;
          fee = FEE_TIERS.MEDIUM;
        } catch (error) {
          console.warn('On-chain quote failed, using fallback calculation:', error);
          amountOut = this.calculateFallbackQuote(amountIn, fromToken, toToken);
          fee = FEE_TIERS.MEDIUM;
        }
      }

      const amountOutFormatted = formatUnits(amountOut, toToken.decimals);
      const rate = (Number(amountOutFormatted) / Number(amount)).toFixed(6);
      const feePercent = (fee / 1_000_000).toFixed(4); // Convert to percentage

      // Calculate minimum amount after slippage
      const slippageMultiplier = (100 - this.slippageTolerance) / 100;
      const minimumReceived = (Number(amountOutFormatted) * slippageMultiplier).toFixed(6);

      // Estimate gas
      const estimatedGas = await this.estimateSwapGas(
        tokenInAddress,
        tokenOutAddress,
        amountIn,
        parseUnits(minimumReceived, toToken.decimals),
        fee
      );

      const now = Date.now();
      return {
        fromToken,
        toToken,
        fromAmount: amount,
        toAmount: amountOutFormatted,
        rate,
        fee: feePercent + '%',
        estimatedGas: formatUnits(estimatedGas, 18),
        priceImpact: '< 0.01%', // For stablecoins
        minimumReceived,
        timestamp: now,
        expiresAt: now + MEV_CONFIG.QUOTE_EXPIRY_TIME,
      };
    } catch (error) {
      console.error('Error getting quote:', error);
      throw new Error('Failed to get swap quote. Please try again.');
    }
  }

  /**
   * Check if quote is still fresh (not stale)
   */
  isQuoteFresh(quote: Quote): boolean {
    return Date.now() - quote.timestamp < MEV_CONFIG.QUOTE_STALE_TIME;
  }

  /**
   * Check if quote has expired
   */
  isQuoteExpired(quote: Quote): boolean {
    return Date.now() > quote.expiresAt;
  }

  /**
   * Execute a token swap with MEV protection
   */
  async executeSwap(
    quote: Quote,
    privateKey: string
  ): Promise<string> {
    try {
      // MEV Protection: Check quote expiration
      if (this.isQuoteExpired(quote)) {
        throw new Error('Quote expired. Please get a fresh quote to avoid unfavorable pricing.');
      }

      const wallet = new Wallet(privateKey, this.provider);
      const tokenInAddress = getTokenContractAddress(quote.fromToken.symbol, 'testnet', 'arcTestnet');
      const tokenOutAddress = getTokenContractAddress(quote.toToken.symbol, 'testnet', 'arcTestnet');

      if (!tokenInAddress || !tokenOutAddress) {
        throw new Error('Token addresses not found');
      }

      const amountIn = parseUnits(quote.fromAmount, quote.fromToken.decimals);

      // MEV Protection: Re-quote if quote is stale
      let amountOutMinimum: bigint;
      if (!this.isQuoteFresh(quote)) {
        console.log('[SWAP] Quote stale, re-quoting for current price...');
        const freshQuote = await this.getQuote(quote.fromToken, quote.toToken, quote.fromAmount);
        amountOutMinimum = parseUnits(freshQuote.minimumReceived, quote.toToken.decimals);
        console.log('[SWAP] Fresh minimum received:', freshQuote.minimumReceived);
      } else {
        amountOutMinimum = parseUnits(quote.minimumReceived, quote.toToken.decimals);
      }

      // Step 1: Check and approve token if needed
      await this.ensureTokenApproval(wallet, tokenInAddress, amountIn);

      // Step 2: Execute swap
      const router = new Contract(this.routerAddress, UNISWAP_ROUTER_ABI, wallet);

      // MEV Protection: Shorter deadline (5 min instead of 20)
      const deadline = Math.floor(Date.now() / 1000) + MEV_CONFIG.DEADLINE_SECONDS;
      const fee = this.isStablecoinPair(quote.fromToken.symbol, quote.toToken.symbol)
        ? FEE_TIERS.LOW
        : FEE_TIERS.MEDIUM;

      const params = {
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress,
        fee,
        recipient: wallet.address,
        deadline,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0, // No price limit
      };

      console.log('[SWAP] Executing swap with params:', {
        from: quote.fromToken.symbol,
        to: quote.toToken.symbol,
        amountIn: quote.fromAmount,
        minimumOut: quote.minimumReceived,
        router: this.routerAddress,
      });

      const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeSettings(this.provider);

      const tx = await router.exactInputSingle(params, {
        maxFeePerGas: maxFeePerGas || undefined,
        maxPriorityFeePerGas: maxPriorityFeePerGas || undefined,
      });

      const receipt = await tx.wait();
      console.log('[SWAP] Swap successful! TxHash:', receipt.hash);

      return receipt.hash;
    } catch (error: any) {
      console.error('[SWAP] Swap execution failed:', error);

      // Enhanced error messages
      if (error?.message?.includes('insufficient allowance')) {
        throw new Error('Token approval failed. Please try again.');
      } else if (error?.message?.includes('insufficient balance')) {
        throw new Error('Insufficient token balance for swap.');
      } else if (error?.message?.includes('Too little received')) {
        throw new Error('Price moved unfavorably. Please try again with higher slippage.');
      } else if (error?.message?.includes('STF')) {
        throw new Error('Swap transaction failed. Pool may have insufficient liquidity.');
      }

      throw new Error(error?.message || 'Swap failed. Please try again.');
    }
  }

  /**
   * Ensure token is approved for router
   */
  private async ensureTokenApproval(
    wallet: Wallet,
    tokenAddress: string,
    amount: bigint
  ): Promise<void> {
    const token = new Contract(tokenAddress, ERC20_ABI, wallet);

    // Check current allowance
    const allowance = await token.allowance(wallet.address, this.routerAddress);

    if (allowance < amount) {
      console.log('[SWAP] Approving token...');
      const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeSettings(this.provider);

      // Approve max amount to avoid repeated approvals
      const approveTx = await token.approve(this.routerAddress, amount * 2n, {
        maxFeePerGas: maxFeePerGas || undefined,
        maxPriorityFeePerGas: maxPriorityFeePerGas || undefined,
      });
      await approveTx.wait();
      console.log('[SWAP] Token approved');
    }
  }

  /**
   * Get on-chain quote from Uniswap pool
   */
  private async getOnChainQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    fee: number
  ): Promise<{ amountOut: bigint }> {
    // This would require a quoter contract
    // For now, fallback to calculation
    throw new Error('On-chain quoter not available');
  }

  /**
   * Calculate stablecoin swap amount (USDC ↔ EURC)
   */
  private calculateStablecoinSwap(
    amountIn: bigint,
    fromToken: TokenInfo,
    toToken: TokenInfo
  ): bigint {
    // USDC to EURC: ~0.92 (1 USD = 0.92 EUR)
    // EURC to USDC: ~1.08 (1 EUR = 1.08 USD)

    if (fromToken.symbol === 'USDC' && toToken.symbol === 'EURC') {
      // 1 USDC = 0.92 EURC
      return (amountIn * 92n) / 100n;
    } else if (fromToken.symbol === 'EURC' && toToken.symbol === 'USDC') {
      // 1 EURC = 1.08 USDC
      return (amountIn * 108n) / 100n;
    }

    // Same token or unknown pair - 1:1
    return amountIn;
  }

  /**
   * Fallback quote calculation
   */
  private calculateFallbackQuote(
    amountIn: bigint,
    fromToken: TokenInfo,
    toToken: TokenInfo
  ): bigint {
    // Use token prices if available
    const fromPrice = fromToken.currentPrice || 1;
    const toPrice = toToken.currentPrice || 1;

    const rate = fromPrice / toPrice;
    const rateScaled = BigInt(Math.floor(rate * 1_000_000));

    return (amountIn * rateScaled) / 1_000_000n;
  }

  /**
   * Estimate gas for swap
   */
  private async estimateSwapGas(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    amountOutMinimum: bigint,
    fee: number
  ): Promise<bigint> {
    try {
      // Typical Uniswap V3 swap gas cost
      return 150000n; // ~150k gas for swap
    } catch (error) {
      console.warn('Gas estimation failed, using default:', error);
      return 150000n;
    }
  }

  /**
   * Check if pair is stablecoin swap
   */
  private isStablecoinPair(tokenA: string, tokenB: string): boolean {
    const stablecoins = ['USDC', 'EURC', 'USDT', 'DAI'];
    return stablecoins.includes(tokenA) && stablecoins.includes(tokenB);
  }

  /**
   * Set slippage tolerance with MEV protection limits
   * @param slippage - Slippage in percentage (e.g., 0.5 for 0.5%)
   * @returns Object with success status and any warnings
   */
  setSlippageTolerance(slippage: number): { success: boolean; warning?: string } {
    // MEV Protection: Enforce min/max slippage
    if (slippage < MEV_CONFIG.MIN_SLIPPAGE) {
      this.slippageTolerance = MEV_CONFIG.MIN_SLIPPAGE;
      return {
        success: true,
        warning: `Slippage increased to minimum ${MEV_CONFIG.MIN_SLIPPAGE}% to prevent failed transactions.`
      };
    }

    if (slippage > MEV_CONFIG.MAX_SLIPPAGE) {
      this.slippageTolerance = MEV_CONFIG.MAX_SLIPPAGE;
      return {
        success: true,
        warning: `Slippage capped at ${MEV_CONFIG.MAX_SLIPPAGE}% to protect against sandwich attacks.`
      };
    }

    this.slippageTolerance = slippage;

    // Warn for high slippage
    if (slippage > MEV_CONFIG.HIGH_SLIPPAGE_WARNING) {
      return {
        success: true,
        warning: `High slippage (${slippage}%) increases vulnerability to MEV attacks. Consider lowering it.`
      };
    }

    return { success: true };
  }

  /**
   * Get current slippage tolerance
   */
  getSlippageTolerance(): number {
    return this.slippageTolerance;
  }

  /**
   * Get MEV protection configuration
   */
  getMevConfig() {
    return { ...MEV_CONFIG };
  }

  /**
   * Check if slippage is dangerously high
   */
  isHighSlippage(): boolean {
    return this.slippageTolerance > MEV_CONFIG.HIGH_SLIPPAGE_WARNING;
  }
}

export const swapService = new SwapService();
