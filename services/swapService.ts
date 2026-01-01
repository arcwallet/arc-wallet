import { JsonRpcProvider, parseUnits, formatUnits, Interface } from 'ethers';
import { TokenInfo, getTokenContractAddress, SWAP_CONFIG } from '../config/tokens';
import { getProvider, getFeeSettings } from './rpcProvider';

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
  warning?: string; // Optional warning message
  usingFallback?: boolean; // True if using fallback calculation
}

// MEV Protection Constants
const MEV_CONFIG = {
  QUOTE_STALE_TIME: 5_000, // 5 seconds - quote becomes stale (shorter for testnet)
  QUOTE_EXPIRY_TIME: 20_000, // 20 seconds - quote expires completely
  DEADLINE_SECONDS: 300, // 5 minutes (reduced from 20 for MEV protection)
  MAX_SLIPPAGE: 50, // 50% max slippage for testnet (low liquidity pools)
  MIN_SLIPPAGE: 0.1, // 0.1% minimum
  HIGH_SLIPPAGE_WARNING: 10, // Warn user above 10%
  TESTNET_SLIPPAGE: 20, // Default 20% slippage for testnet pools
};

// Uniswap V3 Fee Tiers (in hundredths of a bip, i.e. 1e-6)
const FEE_TIERS = {
  LOWEST: 100,   // 0.01% - very stable pairs
  LOW: 500,      // 0.05% - stable pairs
  MEDIUM: 3000,  // 0.30% - most pairs
  HIGH: 10000,   // 1.00% - exotic pairs
};

// Uniswap V2 Router ABI
const UNISWAP_V2_ROUTER_ABI = [
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)',
  'function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts)',
  'function factory() external view returns (address)',
];

// Uniswap V2 Factory ABI
const UNISWAP_V2_FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
];

// Uniswap V2 Pair ABI
const UNISWAP_V2_PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
];

// ERC20 ABI for approval
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
];

class SwapService {
  private provider: JsonRpcProvider;
  private routerAddress: string;
  private slippageTolerance: number; // 0.5% default

  constructor() {
    this.provider = getProvider();
    this.routerAddress = SWAP_CONFIG.routerAddresses.testnet.arcTestnet;
    // Use higher slippage for testnet pools (very low liquidity)
    this.slippageTolerance = MEV_CONFIG.TESTNET_SLIPPAGE; // 20% slippage for testnet
  }

  /**
   * Get a quote for swapping tokens
   * Uses real on-chain price data from UniswapV2 Router
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

      // Get real quote from UniswapV2 Router using getAmountsOut
      let amountOut: bigint;
      let fee: number = FEE_TIERS.LOW;

      let usingFallback = false;

      try {
        amountOut = await this.getAmountsOutFromRouter(tokenInAddress, tokenOutAddress, amountIn);
        console.log('[SWAP] Got real quote from router:', formatUnits(amountOut, toToken.decimals));

        // Check if pool has sufficient liquidity
        if (amountOut === 0n) {
          throw new Error('Pool has no liquidity for this pair');
        }

        // Calculate rate and check if it's reasonable
        const routerRate = Number(formatUnits(amountOut, toToken.decimals)) / Number(amount);
        const rateCheck = this.isRateReasonable(fromToken.symbol, toToken.symbol, routerRate);

        console.log('[SWAP] Rate check:', {
          routerRate,
          expectedRate: rateCheck.expectedRate,
          deviation: `${(rateCheck.deviation * 100).toFixed(1)}%`,
          reasonable: rateCheck.reasonable,
        });

        // If rate is unreasonable (>50% deviation), use fallback
        if (!rateCheck.reasonable) {
          console.warn('[SWAP] Pool rate unreasonable, using fallback calculation');
          if (this.isStablecoinPair(fromToken.symbol, toToken.symbol)) {
            amountOut = this.calculateStablecoinSwap(amountIn, fromToken, toToken);
          } else {
            amountOut = this.calculateFallbackQuote(amountIn, fromToken, toToken);
          }
          usingFallback = true;
        }
      } catch (error: any) {
        console.warn('[SWAP] Router quote failed, using fallback:', error?.message || error);
        // Fallback to approximate calculation
        if (this.isStablecoinPair(fromToken.symbol, toToken.symbol)) {
          amountOut = this.calculateStablecoinSwap(amountIn, fromToken, toToken);
        } else {
          amountOut = this.calculateFallbackQuote(amountIn, fromToken, toToken);
        }
        usingFallback = true;
      }

      // If using fallback, log warning
      if (usingFallback) {
        console.log('[SWAP] Using fallback rate for quote. Actual swap will use pool price.');
      }

      const amountOutFormatted = formatUnits(amountOut, toToken.decimals);
      const rate = (Number(amountOutFormatted) / Number(amount)).toFixed(6);
      const feePercent = (fee / 1_000_000).toFixed(4); // Convert to percentage

      // Calculate minimum amount after slippage (use higher slippage for testnet)
      const slippageMultiplier = (100 - this.slippageTolerance) / 100;
      const minimumReceived = (Number(amountOutFormatted) * slippageMultiplier).toFixed(6);

      // Estimate gas
      const estimatedGas = 150000n;

      // Calculate actual price impact
      let priceImpact = '< 0.01%';
      if (this.isStablecoinPair(fromToken.symbol, toToken.symbol)) {
        // For stablecoins, compare to expected 1:1 (or known rate)
        const expectedRate = fromToken.symbol === 'USDC' && toToken.symbol === 'EURC' ? 0.92 :
                            fromToken.symbol === 'EURC' && toToken.symbol === 'USDC' ? 1.08 : 1;
        const actualRate = Number(rate);
        const impact = Math.abs((actualRate - expectedRate) / expectedRate * 100);
        if (impact > 1) {
          priceImpact = `~${impact.toFixed(2)}%`;
        }
      }

      const now = Date.now();

      // Generate warning if using fallback
      let warning: string | undefined;
      if (usingFallback) {
        warning = 'Pool liquidity is low or imbalanced. Displaying estimated rate. Actual swap may differ.';
      }

      return {
        fromToken,
        toToken,
        fromAmount: amount,
        toAmount: amountOutFormatted,
        rate,
        fee: feePercent + '%',
        estimatedGas: formatUnits(estimatedGas, 18),
        priceImpact,
        minimumReceived,
        timestamp: now,
        expiresAt: now + MEV_CONFIG.QUOTE_EXPIRY_TIME,
        warning,
        usingFallback,
      };
    } catch (error) {
      console.error('Error getting quote:', error);
      throw new Error('Failed to get swap quote. Please try again.');
    }
  }

  /**
   * Get real quote from UniswapV2 Router using getAmountsOut
   */
  private async getAmountsOutFromRouter(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint
  ): Promise<bigint> {
    const routerInterface = new Interface(UNISWAP_V2_ROUTER_ABI);
    const path = [tokenIn, tokenOut];

    const data = routerInterface.encodeFunctionData('getAmountsOut', [amountIn, path]);

    const result = await this.provider.call({
      to: this.routerAddress,
      data,
    });

    // Decode result - returns uint256[] amounts
    const decoded = routerInterface.decodeFunctionResult('getAmountsOut', result);
    const amounts = decoded[0] as bigint[];

    // amounts[0] = amountIn, amounts[1] = amountOut
    return amounts[1];
  }

  /**
   * Get pool reserves for a token pair
   */
  async getPoolReserves(
    tokenA: string,
    tokenB: string
  ): Promise<{ reserveA: bigint; reserveB: bigint; pairAddress: string } | null> {
    try {
      const routerInterface = new Interface(UNISWAP_V2_ROUTER_ABI);
      const factoryInterface = new Interface(UNISWAP_V2_FACTORY_ABI);
      const pairInterface = new Interface(UNISWAP_V2_PAIR_ABI);

      // Get factory address from router
      const factoryData = routerInterface.encodeFunctionData('factory', []);
      const factoryResult = await this.provider.call({
        to: this.routerAddress,
        data: factoryData,
      });
      const factoryAddress = routerInterface.decodeFunctionResult('factory', factoryResult)[0] as string;

      // Get pair address from factory
      const getPairData = factoryInterface.encodeFunctionData('getPair', [tokenA, tokenB]);
      const pairResult = await this.provider.call({
        to: factoryAddress,
        data: getPairData,
      });
      const pairAddress = factoryInterface.decodeFunctionResult('getPair', pairResult)[0] as string;

      if (pairAddress === '0x0000000000000000000000000000000000000000') {
        console.warn('[SWAP] No pool exists for this pair');
        return null;
      }

      // Get token0 to know the order
      const token0Data = pairInterface.encodeFunctionData('token0', []);
      const token0Result = await this.provider.call({
        to: pairAddress,
        data: token0Data,
      });
      const token0 = pairInterface.decodeFunctionResult('token0', token0Result)[0] as string;

      // Get reserves
      const reservesData = pairInterface.encodeFunctionData('getReserves', []);
      const reservesResult = await this.provider.call({
        to: pairAddress,
        data: reservesData,
      });
      const decoded = pairInterface.decodeFunctionResult('getReserves', reservesResult);
      const reserve0 = decoded[0] as bigint;
      const reserve1 = decoded[1] as bigint;

      // Order reserves correctly
      const isTokenAFirst = tokenA.toLowerCase() === token0.toLowerCase();
      const reserveA = isTokenAFirst ? reserve0 : reserve1;
      const reserveB = isTokenAFirst ? reserve1 : reserve0;

      console.log('[SWAP] Pool reserves:', {
        pairAddress,
        reserveA: reserveA.toString(),
        reserveB: reserveB.toString(),
      });

      return { reserveA, reserveB, pairAddress };
    } catch (error) {
      console.error('[SWAP] Failed to get pool reserves:', error);
      return null;
    }
  }

  /**
   * Check if pool rate is reasonable for stablecoin pairs
   */
  private isRateReasonable(
    fromSymbol: string,
    toSymbol: string,
    rate: number
  ): { reasonable: boolean; expectedRate: number; deviation: number } {
    // Expected rates for stablecoin pairs
    const expectedRates: Record<string, number> = {
      'USDC-EURC': 0.92,
      'EURC-USDC': 1.08,
      'USDC-USYC': 1.0,
      'USYC-USDC': 1.0,
      'EURC-USYC': 1.08,
      'USYC-EURC': 0.92,
    };

    const pairKey = `${fromSymbol}-${toSymbol}`;
    const expectedRate = expectedRates[pairKey] || 1.0;
    const deviation = Math.abs((rate - expectedRate) / expectedRate);

    // Allow up to 50% deviation for testnet (pools might be imbalanced)
    const reasonable = deviation < 0.5;

    return { reasonable, expectedRate, deviation };
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
   * Execute a token swap using PasskeyAccount (ERC-4337 Smart Wallet)
   * Uses UniswapV2 swapExactTokensForTokens
   * No private key required - uses passkey signing
   */
  async executeSwapWithPasskey(
    quote: Quote,
    passkeyManager: {
      getAccountAddress: () => string | null;
      executeTransaction: (to: string, value: bigint, data: string) => Promise<{ hash?: string }>;
    }
  ): Promise<string> {
    try {
      // MEV Protection: Check quote expiration
      if (this.isQuoteExpired(quote)) {
        throw new Error('Quote expired. Please get a fresh quote to avoid unfavorable pricing.');
      }

      const walletAddress = passkeyManager.getAccountAddress();
      if (!walletAddress) {
        throw new Error('PasskeyAccount not connected');
      }

      const tokenInAddress = getTokenContractAddress(quote.fromToken.symbol, 'testnet', 'arcTestnet');
      const tokenOutAddress = getTokenContractAddress(quote.toToken.symbol, 'testnet', 'arcTestnet');

      if (!tokenInAddress || !tokenOutAddress) {
        throw new Error('Token addresses not found');
      }

      const amountIn = parseUnits(quote.fromAmount, quote.fromToken.decimals);

      // Get real-time pool data for minimum output calculation
      console.log('[SWAP] Getting real pool data before execution...');
      let amountOutMinimum: bigint;

      try {
        // Get fresh quote directly from router (not fallback)
        const freshAmountOut = await this.getAmountsOutFromRouter(tokenInAddress, tokenOutAddress, amountIn);
        console.log('[SWAP] Fresh router output:', formatUnits(freshAmountOut, quote.toToken.decimals));

        // Apply slippage tolerance
        const slippageMultiplier = BigInt(Math.floor((100 - this.slippageTolerance) * 100));
        amountOutMinimum = (freshAmountOut * slippageMultiplier) / 10000n;

        console.log('[SWAP] Minimum output with slippage:', formatUnits(amountOutMinimum, quote.toToken.decimals));
      } catch (error) {
        console.warn('[SWAP] Could not get fresh pool data, using minimal protection');
        // If we can't get pool data, use 1 as minimum (accept any output)
        // This is risky but necessary for low-liquidity testnet pools
        amountOutMinimum = 1n;
        console.log('[SWAP] WARNING: Using minimal output protection (1 wei)');
      }

      // Step 1: Check and approve token if needed via PasskeyAccount
      const erc20Interface = new Interface(ERC20_ABI);
      const allowanceData = erc20Interface.encodeFunctionData('allowance', [walletAddress, this.routerAddress]);
      const allowanceResult = await this.provider.call({
        to: tokenInAddress,
        data: allowanceData,
      });
      const currentAllowance = BigInt(allowanceResult);

      if (currentAllowance < amountIn) {
        console.log('[SWAP] Approving token via PasskeyAccount...');
        const approveData = erc20Interface.encodeFunctionData('approve', [this.routerAddress, amountIn * 2n]);
        const approveResult = await passkeyManager.executeTransaction(tokenInAddress, 0n, approveData);
        console.log('[SWAP] Token approved via PasskeyAccount:', approveResult.hash);
      }

      // Step 2: Execute swap via PasskeyAccount using UniswapV2
      const routerInterface = new Interface(UNISWAP_V2_ROUTER_ABI);

      // MEV Protection: Shorter deadline (5 min instead of 20)
      const deadline = Math.floor(Date.now() / 1000) + MEV_CONFIG.DEADLINE_SECONDS;

      // UniswapV2 uses path array for swaps
      const path = [tokenInAddress, tokenOutAddress];

      console.log('[SWAP] Executing swap via PasskeyAccount with params:', {
        from: quote.fromToken.symbol,
        to: quote.toToken.symbol,
        amountIn: quote.fromAmount,
        amountInWei: amountIn.toString(),
        amountOutMinWei: amountOutMinimum.toString(),
        slippage: `${this.slippageTolerance}%`,
        router: this.routerAddress,
        path,
        deadline,
      });

      // Encode the swap call for UniswapV2
      const swapData = routerInterface.encodeFunctionData('swapExactTokensForTokens', [
        amountIn,
        amountOutMinimum,
        path,
        walletAddress,
        deadline,
      ]);

      // Execute via PasskeyAccount (UserOperation with passkey signature)
      const swapResult = await passkeyManager.executeTransaction(this.routerAddress, 0n, swapData);

      console.log('[SWAP] Swap successful via PasskeyAccount! TxHash:', swapResult.hash);

      return swapResult.hash || '';
    } catch (error: any) {
      console.error('[SWAP] Swap execution via PasskeyAccount failed:', error);

      const errorMessage = error?.message || '';
      const errorDetails = JSON.stringify(error).toLowerCase();

      // Enhanced error messages
      if (errorMessage.includes('insufficient allowance')) {
        throw new Error('Token approval failed. Please try again.');
      } else if (errorMessage.includes('insufficient balance') || errorDetails.includes('insufficient balance')) {
        throw new Error('Insufficient token balance for swap.');
      } else if (errorMessage.includes('Too little received')) {
        throw new Error('Price moved unfavorably. Please try again with higher slippage.');
      } else if (errorMessage.includes('STF') || errorDetails.includes('stf')) {
        throw new Error('Swap transaction failed. Pool may have insufficient liquidity.');
      } else if (errorMessage.includes('INSUFFICIENT_OUTPUT_AMOUNT') || errorDetails.includes('insufficient_output_amount')) {
        throw new Error('Pool liquidity too low. The swap amount exceeds available liquidity. Try a smaller amount or wait for more liquidity.');
      } else if (errorMessage.includes('INSUFFICIENT_LIQUIDITY') || errorDetails.includes('insufficient_liquidity')) {
        throw new Error('No liquidity available for this pair. The pool may be empty.');
      } else if (errorMessage.includes('expired') || errorDetails.includes('expired')) {
        throw new Error('Transaction deadline expired. Please try again.');
      } else if (errorMessage.includes('user rejected') || errorDetails.includes('user rejected')) {
        throw new Error('Transaction was cancelled.');
      }

      throw new Error(errorMessage || 'Swap failed. Please try again.');
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
