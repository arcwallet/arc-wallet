import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import { SUPPORTED_TOKENS, TokenInfo, getTokenInfo, getTokenContractAddress } from '../config/tokens';

// ERC-20 Token Contract ABI (minimal)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

export interface TokenBalance {
  token: TokenInfo;
  balance: bigint;
  formattedBalance: string;
  usdValue?: number;
}

export interface TokenPrices {
  [symbol: string]: {
    usd: number;
    eur?: number;
    lastUpdated: number;
  };
}

class TokenService {
  private rpcProvider: JsonRpcProvider;
  private cachedPrices: TokenPrices = {};
  private pricesCacheExpiry = 5 * 60 * 1000; // 5 minutes

  constructor(rpcUrl: string) {
    this.rpcProvider = new JsonRpcProvider(rpcUrl);
  }

  /**
   * Get balance for a specific token
   */
  async getTokenBalance(
    tokenSymbol: string,
    walletAddress: string,
    network: 'mainnet' | 'testnet' = 'testnet',
    chain: 'arcTestnet' | 'sepolia' = 'arcTestnet'
  ): Promise<TokenBalance | null> {
    const token = getTokenInfo(tokenSymbol);
    if (!token) {
      console.warn(`Token ${tokenSymbol} not found in supported tokens`);
      return null;
    }

    try {
      const contractAddress = getTokenContractAddress(tokenSymbol, network, chain);
      if (!contractAddress) {
        console.warn(`Contract address not found for ${tokenSymbol} on ${network}/${chain}`);
        return null;
      }

      const contract = new Contract(contractAddress, ERC20_ABI, this.rpcProvider);
      const balance = await contract.balanceOf(walletAddress);

      const formattedBalance = formatUnits(balance, token.decimals);

      // Get USD value if prices are available
      const prices = await this.getTokenPrices([tokenSymbol]);
      const usdValue = prices[tokenSymbol] ?
        parseFloat(formattedBalance) * prices[tokenSymbol].usd : undefined;

      return {
        token,
        balance,
        formattedBalance,
        usdValue,
      };
    } catch (error) {
      console.error(`Error fetching balance for ${tokenSymbol}:`, error);
      return null;
    }
  }

  /**
   * Get balances for all supported tokens
   */
  async getAllTokenBalances(
    walletAddress: string,
    network: 'mainnet' | 'testnet' = 'testnet',
    chain: 'arcTestnet' | 'sepolia' = 'arcTestnet'
  ): Promise<TokenBalance[]> {
    const supportedTokens = Object.keys(SUPPORTED_TOKENS);
    const balancePromises = supportedTokens.map(symbol =>
      this.getTokenBalance(symbol, walletAddress, network, chain)
    );

    const results = await Promise.allSettled(balancePromises);

    return results
      .filter((result): result is PromiseFulfilledResult<TokenBalance> =>
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);
  }

  /**
   * Get token prices from external API (mock implementation)
   */
  async getTokenPrices(symbols: string[]): Promise<TokenPrices> {
    const now = Date.now();
    const prices: TokenPrices = {};

    for (const symbol of symbols) {
      // Check cache first
      if (this.cachedPrices[symbol] &&
          (now - this.cachedPrices[symbol].lastUpdated) < this.pricesCacheExpiry) {
        prices[symbol] = this.cachedPrices[symbol];
        continue;
      }

      try {
        // Mock price data - in production, integrate with CoinGecko or similar
        const mockPrices: Record<string, number> = {
          'USDC': 1.00,
          'EURC': 1.07, // Approximate EUR to USD rate
        };

        if (mockPrices[symbol]) {
          const priceData = {
            usd: mockPrices[symbol],
            lastUpdated: now,
          };

          prices[symbol] = priceData;
          this.cachedPrices[symbol] = priceData;
        }
      } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error);

        // Use cached data if available, even if expired
        if (this.cachedPrices[symbol]) {
          prices[symbol] = this.cachedPrices[symbol];
        }
      }
    }

    return prices;
  }

  /**
   * Get token contract instance
   */
  getTokenContract(
    tokenSymbol: string,
    network: 'mainnet' | 'testnet' = 'testnet',
    chain: 'arcTestnet' | 'sepolia' = 'arcTestnet'
  ): Contract | null {
    const contractAddress = getTokenContractAddress(tokenSymbol, network, chain);
    if (!contractAddress) return null;

    return new Contract(contractAddress, ERC20_ABI, this.rpcProvider);
  }

  /**
   * Calculate total portfolio value in USD
   */
  calculateTotalPortfolioValue(balances: TokenBalance[]): number {
    return balances.reduce((total, balance) => {
      return total + (balance.usdValue || 0);
    }, 0);
  }

  /**
   * Format portfolio value as currency string
   */
  formatPortfolioValue(balances: TokenBalance[]): string {
    const total = this.calculateTotalPortfolioValue(balances);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(total);
  }
}

// Export singleton instance
const DEFAULT_RPC_URL = import.meta.env.VITE_ARC_RPC_URL ?? 'https://rpc.testnet.arc.network';
export const tokenService = new TokenService(DEFAULT_RPC_URL);

// Export class for custom instances
export { TokenService };