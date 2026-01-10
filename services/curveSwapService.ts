/**
 * Curve Swap Service
 *
 * Uses Curve StableSwap pool for USDC ↔ EURC swaps on Arc Testnet
 * with near-zero slippage optimized for stablecoin pairs.
 */

import { ethers } from 'ethers';
import { TokenInfo } from '../config/tokens';

// Curve Pool Configuration on Arc Testnet
const CURVE_CONFIG = {
  // USDC/EURC Pool
  pool: '0x2D84D79C852f6842AbE0304b70bBaA1506AdD457',

  // Token addresses
  tokens: {
    USDC: '0x3600000000000000000000000000000000000000',
    EURC: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
  },

  // Token indices in pool
  indices: {
    USDC: 0,
    EURC: 1,
  } as Record<string, number>,

  // Arc Testnet
  chainId: 5042002,
  rpcUrl: 'https://rpc.testnet.arc.network',

  // Swap fee (0.04%)
  feePercent: 0.04,

  // Minimum swap amount
  minimumAmount: '1',
};

// Curve Pool ABI (minimal)
const CURVE_POOL_ABI = [
  // Get expected output amount
  'function get_dy(int128 i, int128 j, uint256 dx) view returns (uint256)',
  // Execute swap
  'function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) returns (uint256)',
  // Execute swap with receiver
  'function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy, address receiver) returns (uint256)',
  // Get coin addresses
  'function coins(uint256 i) view returns (address)',
  // Get balances
  'function balances(uint256 i) view returns (uint256)',
];

// ERC20 ABI for approvals
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
];

export interface CurveQuote {
  fromToken: TokenInfo;
  toToken: TokenInfo;
  fromAmount: string;
  toAmount: string;
  rate: string;
  fee: string;
  priceImpact: string;
  minimumReceived: string;
  timestamp: number;
  poolAddress: string;
}

class CurveSwapService {
  private provider: ethers.JsonRpcProvider;
  private poolContract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(CURVE_CONFIG.rpcUrl);
    this.poolContract = new ethers.Contract(
      CURVE_CONFIG.pool,
      CURVE_POOL_ABI,
      this.provider
    );
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return true; // Curve is always available on Arc Testnet
  }

  /**
   * Check if a token pair is supported
   */
  isPairSupported(fromSymbol: string, toSymbol: string): boolean {
    const from = fromSymbol.toUpperCase();
    const to = toSymbol.toUpperCase();
    return (
      (from === 'USDC' || from === 'EURC') &&
      (to === 'USDC' || to === 'EURC') &&
      from !== to
    );
  }

  /**
   * Get token index in pool
   */
  private getTokenIndex(symbol: string): number {
    const index = CURVE_CONFIG.indices[symbol.toUpperCase()];
    if (index === undefined) {
      throw new Error(`Token ${symbol} not supported in Curve pool`);
    }
    return index;
  }

  /**
   * Get a quote for swapping tokens
   */
  async getQuote(
    fromToken: TokenInfo,
    toToken: TokenInfo,
    amount: string
  ): Promise<CurveQuote> {
    if (!this.isPairSupported(fromToken.symbol, toToken.symbol)) {
      throw new Error(`Pair ${fromToken.symbol}/${toToken.symbol} not supported`);
    }

    const amountNum = parseFloat(amount);
    if (amountNum < parseFloat(CURVE_CONFIG.minimumAmount)) {
      throw new Error(`Minimum swap amount is ${CURVE_CONFIG.minimumAmount} ${fromToken.symbol}`);
    }

    // Convert amount to wei (6 decimals for USDC/EURC)
    const amountWei = ethers.parseUnits(amount, fromToken.decimals);

    // Get token indices
    const i = this.getTokenIndex(fromToken.symbol);
    const j = this.getTokenIndex(toToken.symbol);

    console.log('[Curve] Getting quote:', {
      from: fromToken.symbol,
      to: toToken.symbol,
      amount,
      i,
      j,
    });

    try {
      // Get expected output from Curve pool
      const outputWei = await this.poolContract.get_dy(i, j, amountWei);
      const outputAmount = ethers.formatUnits(outputWei, toToken.decimals);

      // Calculate rate
      const rate = parseFloat(outputAmount) / parseFloat(amount);

      // Calculate fee (0.04%)
      const feeAmount = amountNum * (CURVE_CONFIG.feePercent / 100);

      // Calculate price impact (for stablecoins, should be minimal)
      // Ideal rate for USDC/EURC is ~0.92 (1 EUR = 1.08 USD)
      const idealRate = fromToken.symbol === 'USDC' ? 0.92 : 1.08;
      const priceImpact = Math.abs((rate - idealRate) / idealRate * 100);

      // Minimum received with 0.5% slippage tolerance
      const slippageTolerance = 0.005;
      const minReceived = parseFloat(outputAmount) * (1 - slippageTolerance);

      const quote: CurveQuote = {
        fromToken,
        toToken,
        fromAmount: amount,
        toAmount: outputAmount,
        rate: rate.toFixed(6),
        fee: `${feeAmount.toFixed(4)} ${fromToken.symbol}`,
        priceImpact: priceImpact < 0.01 ? '< 0.01%' : `${priceImpact.toFixed(2)}%`,
        minimumReceived: minReceived.toFixed(6),
        timestamp: Date.now(),
        poolAddress: CURVE_CONFIG.pool,
      };

      console.log('[Curve] Quote received:', quote);
      return quote;
    } catch (error: any) {
      console.error('[Curve] Quote failed:', error);
      throw new Error(`Failed to get quote: ${error.message}`);
    }
  }

  /**
   * Build swap transaction data
   */
  buildSwapTransaction(
    fromToken: TokenInfo,
    toToken: TokenInfo,
    amount: string,
    minOutput: string,
    recipient?: string
  ): { to: string; data: string; value: bigint } {
    const amountWei = ethers.parseUnits(amount, fromToken.decimals);
    const minOutputWei = ethers.parseUnits(minOutput, toToken.decimals);

    const i = this.getTokenIndex(fromToken.symbol);
    const j = this.getTokenIndex(toToken.symbol);

    const iface = new ethers.Interface(CURVE_POOL_ABI);

    let data: string;
    if (recipient) {
      data = iface.encodeFunctionData('exchange(int128,int128,uint256,uint256,address)', [
        i, j, amountWei, minOutputWei, recipient
      ]);
    } else {
      data = iface.encodeFunctionData('exchange(int128,int128,uint256,uint256)', [
        i, j, amountWei, minOutputWei
      ]);
    }

    return {
      to: CURVE_CONFIG.pool,
      data,
      value: 0n,
    };
  }

  /**
   * Build approval transaction for token
   */
  buildApprovalTransaction(
    tokenAddress: string,
    amount: string,
    decimals: number
  ): { to: string; data: string; value: bigint } {
    const amountWei = ethers.parseUnits(amount, decimals);
    const iface = new ethers.Interface(ERC20_ABI);

    const data = iface.encodeFunctionData('approve', [
      CURVE_CONFIG.pool,
      amountWei,
    ]);

    return {
      to: tokenAddress,
      data,
      value: 0n,
    };
  }

  /**
   * Check if approval is needed
   */
  async checkAllowance(
    tokenAddress: string,
    ownerAddress: string,
    amount: string,
    decimals: number
  ): Promise<boolean> {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    const allowance = await tokenContract.allowance(ownerAddress, CURVE_CONFIG.pool);
    const amountWei = ethers.parseUnits(amount, decimals);
    return allowance >= amountWei;
  }

  /**
   * Get pool balances (for liquidity info)
   */
  async getPoolBalances(): Promise<{ usdc: string; eurc: string }> {
    const usdcBalance = await this.poolContract.balances(0);
    const eurcBalance = await this.poolContract.balances(1);

    return {
      usdc: ethers.formatUnits(usdcBalance, 6),
      eurc: ethers.formatUnits(eurcBalance, 6),
    };
  }

  /**
   * Get configuration
   */
  getConfig() {
    return {
      ...CURVE_CONFIG,
      isAvailable: true,
    };
  }
}

export const curveSwapService = new CurveSwapService();
