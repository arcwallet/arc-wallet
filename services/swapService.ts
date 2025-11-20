import { TokenInfo } from '../config/tokens';

export interface Quote {
  fromToken: TokenInfo;
  toToken: TokenInfo;
  fromAmount: string;
  toAmount: string;
  rate: string;
  fee: string;
  estimatedGas: string;
}

class SwapService {
  // Mock exchange rates
  private rates: Record<string, number> = {
    'USDC-ARC': 0.25, // 1 USDC = 0.25 ARC
    'ARC-USDC': 4.0,  // 1 ARC = 4.0 USDC
    'USDC-EURC': 0.92,
    'EURC-USDC': 1.08,
  };

  async getQuote(
    fromToken: TokenInfo,
    toToken: TokenInfo,
    amount: string
  ): Promise<Quote> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    const pair = `${fromToken.symbol}-${toToken.symbol}`;
    const rate = this.rates[pair] || 1.0;
    const numAmount = parseFloat(amount);
    const toAmount = (numAmount * rate).toFixed(6);

    return {
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount,
      rate: rate.toString(),
      fee: '0.01', // Mock fee
      estimatedGas: '0.0005',
    };
  }

  async executeSwap(quote: Quote): Promise<string> {
    // Simulate transaction
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return `0x${Math.random().toString(16).substr(2, 64)}`; // Mock Tx Hash
  }
}

export const swapService = new SwapService();