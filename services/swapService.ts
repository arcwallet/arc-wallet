import { parseUnits, formatUnits } from 'ethers';
import { getCircleApiService } from './circleApiService';
import { getTokenInfo, getTokenContractAddress, SWAP_CONFIG } from '../config/tokens';

const DEBUG = import.meta.env.VITE_SWAP_DEBUG === 'true';

export interface SwapQuote {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  exchangeRate: number;
  priceImpact: number;
  minimumReceived: string;
  estimatedGas: string;
  slippage: number;
}

export interface SwapParams {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  walletAddress: string;
  slippage?: number;
  onProgress?: (step: SwapProgressStep) => void;
}

export type SwapProgressStep =
  | { type: 'quote-fetching' }
  | { type: 'quote-received'; quote: SwapQuote }
  | { type: 'approval-checking' }
  | { type: 'approval-needed'; txHash?: string }
  | { type: 'swap-executing' }
  | { type: 'swap-completed'; txHash: string }
  | { type: 'error'; message: string };

export interface SwapResult {
  txHash: string;
  fromAmount: string;
  toAmount: string;
  fromToken: string;
  toToken: string;
  exchangeRate: number;
}

class SwapService {
  private currentNetwork: 'mainnet' | 'testnet' = 'testnet';
  private currentChain: 'sepolia' | 'arcTestnet' = 'arcTestnet';

  async getSwapQuote(params: {
    fromToken: string;
    toToken: string;
    fromAmount: string;
  }): Promise<SwapQuote> {
    try {
      if (DEBUG) {
        console.log('📊 Getting swap quote:', params);
      }

      const fromTokenInfo = getTokenInfo(params.fromToken);
      const toTokenInfo = getTokenInfo(params.toToken);

      if (!fromTokenInfo || !toTokenInfo) {
        throw new Error('Unsupported token pair');
      }

      if (!fromTokenInfo.swapable || !toTokenInfo.swapable) {
        throw new Error('One or both tokens are not swapable');
      }

      // Simple rate calculation based on current prices
      // In a real implementation, this would call a DEX aggregator or AMM
      const exchangeRate = fromTokenInfo.currentPrice! / toTokenInfo.currentPrice!;
      const fromAmountNum = parseFloat(params.fromAmount);
      const toAmountNum = fromAmountNum * exchangeRate;

      // Calculate slippage protection
      const slippage = SWAP_CONFIG.defaultSlippage / 100;
      const minimumReceived = toAmountNum * (1 - slippage);

      // Mock price impact (in a real implementation, this would be calculated from liquidity)
      const priceImpact = Math.min(fromAmountNum / 10000, 2); // Max 2% impact

      const quote: SwapQuote = {
        fromToken: params.fromToken,
        toToken: params.toToken,
        fromAmount: params.fromAmount,
        toAmount: toAmountNum.toFixed(6),
        exchangeRate,
        priceImpact,
        minimumReceived: minimumReceived.toFixed(6),
        estimatedGas: '0.002', // Estimated gas in ETH
        slippage: SWAP_CONFIG.defaultSlippage,
      };

      if (DEBUG) {
        console.log('📈 Swap quote generated:', quote);
      }

      return quote;
    } catch (error: any) {
      if (DEBUG) {
        console.error('❌ Quote error:', error);
      }
      throw new Error(`Failed to get swap quote: ${error.message}`);
    }
  }

  async executeSwap(params: SwapParams): Promise<SwapResult> {
    try {
      if (DEBUG) {
        console.log('🔄 Starting swap execution:', params);
      }

      params.onProgress?.({ type: 'quote-fetching' });

      // Get swap quote
      const quote = await this.getSwapQuote({
        fromToken: params.fromToken,
        toToken: params.toToken,
        fromAmount: params.fromAmount,
      });

      params.onProgress?.({ type: 'quote-received', quote });

      // Get token contract addresses
      const fromTokenAddress = getTokenContractAddress(
        params.fromToken,
        this.currentNetwork,
        this.currentChain
      );
      const toTokenAddress = getTokenContractAddress(
        params.toToken,
        this.currentNetwork,
        this.currentChain
      );

      if (!fromTokenAddress || !toTokenAddress) {
        throw new Error('Token contract addresses not found for current network');
      }

      // Get router address
      const routerAddress = SWAP_CONFIG.routerAddresses[this.currentNetwork][this.currentChain];

      if (!routerAddress) {
        throw new Error('Swap router not available for current network');
      }

      // Check if approval is needed
      params.onProgress?.({ type: 'approval-checking' });

      const fromTokenInfo = getTokenInfo(params.fromToken)!;
      const toTokenInfo = getTokenInfo(params.toToken)!;

      // Convert amounts to proper units
      const fromAmountWei = parseUnits(params.fromAmount, fromTokenInfo.decimals);
      const toAmountMinWei = parseUnits(quote.minimumReceived, toTokenInfo.decimals);

      // Get Circle API service
      const circleApi = getCircleApiService();

      // First, approve token spending if needed
      params.onProgress?.({ type: 'approval-needed' });

      // Prepare approval transaction
      const approvalTx = await circleApi.executeContractTransaction({
        walletAddress: params.walletAddress,
        blockchain: this.getBlockchainName(),
        contractAddress: fromTokenAddress,
        functionSignature: 'approve(address,uint256)',
        abiParameters: [routerAddress, fromAmountWei.toString()],
        feeLevel: 'MEDIUM',
      });

      if (DEBUG) {
        console.log('✅ Approval transaction:', approvalTx);
      }

      // Wait for approval confirmation
      await circleApi.waitForTransactionConfirmation(approvalTx.id);

      // Execute swap
      params.onProgress?.({ type: 'swap-executing' });

      // Prepare swap transaction (Uniswap V3 exactInputSingle)
      const swapTx = await circleApi.executeContractTransaction({
        walletAddress: params.walletAddress,
        blockchain: this.getBlockchainName(),
        contractAddress: routerAddress,
        functionSignature: 'exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))',
        abiParameters: [
          {
            tokenIn: fromTokenAddress,
            tokenOut: toTokenAddress,
            fee: 3000, // 0.3% fee tier
            recipient: params.walletAddress,
            deadline: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
            amountIn: fromAmountWei.toString(),
            amountOutMinimum: toAmountMinWei.toString(),
            sqrtPriceLimitX96: 0,
          },
        ],
        feeLevel: 'MEDIUM',
      });

      if (DEBUG) {
        console.log('🔄 Swap transaction:', swapTx);
      }

      // Wait for swap confirmation
      const confirmedSwapTx = await circleApi.waitForTransactionConfirmation(swapTx.id);

      params.onProgress?.({ type: 'swap-completed', txHash: confirmedSwapTx.txHash! });

      const result: SwapResult = {
        txHash: confirmedSwapTx.txHash!,
        fromAmount: params.fromAmount,
        toAmount: quote.toAmount,
        fromToken: params.fromToken,
        toToken: params.toToken,
        exchangeRate: quote.exchangeRate,
      };

      if (DEBUG) {
        console.log('✅ Swap completed:', result);
      }

      return result;
    } catch (error: any) {
      if (DEBUG) {
        console.error('❌ Swap execution error:', error);
      }

      params.onProgress?.({ type: 'error', message: error.message });
      throw new Error(`Swap failed: ${error.message}`);
    }
  }

  async estimateGasForSwap(params: {
    fromToken: string;
    toToken: string;
    fromAmount: string;
    walletAddress: string;
  }): Promise<{ gasEstimate: string; gasCostUSD: number }> {
    try {
      // Mock gas estimation - in real implementation would call actual gas estimation
      const gasEstimate = '150000'; // Gas units
      const gasPrice = '20'; // Gwei
      const ethPrice = 2500; // USD per ETH

      const gasCostEth = (parseInt(gasEstimate) * parseInt(gasPrice)) / 1e9;
      const gasCostUSD = gasCostEth * ethPrice;

      return {
        gasEstimate,
        gasCostUSD,
      };
    } catch (error: any) {
      throw new Error(`Gas estimation failed: ${error.message}`);
    }
  }

  private getBlockchainName(): string {
    // Map internal chain names to Circle API blockchain names
    switch (this.currentChain) {
      case 'sepolia':
        return 'ETH-SEPOLIA';
      case 'arcTestnet':
        return 'ARC-TESTNET';
      default:
        throw new Error(`Unsupported blockchain: ${this.currentChain}`);
    }
  }

  setNetwork(network: 'mainnet' | 'testnet', chain: string) {
    this.currentNetwork = network;
    this.currentChain = chain as 'sepolia' | 'arcTestnet';
  }

  getCurrentNetwork(): { network: 'mainnet' | 'testnet'; chain: string } {
    return {
      network: this.currentNetwork,
      chain: this.currentChain,
    };
  }

  getSupportedPairs(): Array<{ from: string; to: string }> {
    const swapableTokens = Object.values(getTokenInfo('USDC') ? { USDC: getTokenInfo('USDC')!, EURC: getTokenInfo('EURC')! } : {})
      .filter(token => token.swapable)
      .map(token => token.symbol);

    const pairs: Array<{ from: string; to: string }> = [];

    for (const from of swapableTokens) {
      for (const to of swapableTokens) {
        if (from !== to) {
          pairs.push({ from, to });
        }
      }
    }

    return pairs;
  }
}

// Singleton instance
let swapService: SwapService | null = null;

export function getSwapService(): SwapService {
  if (!swapService) {
    swapService = new SwapService();
  }
  return swapService;
}

// Helper function to validate swap parameters
export function validateSwapParams(params: SwapParams): { isValid: boolean; error?: string } {
  if (!params.fromToken || !params.toToken) {
    return { isValid: false, error: 'Both from and to tokens are required' };
  }

  if (params.fromToken === params.toToken) {
    return { isValid: false, error: 'Cannot swap same token' };
  }

  const fromAmount = parseFloat(params.fromAmount);
  if (isNaN(fromAmount) || fromAmount <= 0) {
    return { isValid: false, error: 'Invalid swap amount' };
  }

  const fromTokenInfo = getTokenInfo(params.fromToken);
  const toTokenInfo = getTokenInfo(params.toToken);

  if (!fromTokenInfo || !toTokenInfo) {
    return { isValid: false, error: 'Unsupported token' };
  }

  if (!fromTokenInfo.swapable || !toTokenInfo.swapable) {
    return { isValid: false, error: 'Token not available for swapping' };
  }

  const minimumAmount = SWAP_CONFIG.minimumSwapAmount[params.fromToken];
  if (minimumAmount) {
    const minAmountFormatted = parseFloat(formatUnits(minimumAmount, fromTokenInfo.decimals));
    if (fromAmount < minAmountFormatted) {
      return {
        isValid: false,
        error: `Minimum swap amount is ${minAmountFormatted} ${params.fromToken}`
      };
    }
  }

  return { isValid: true };
}