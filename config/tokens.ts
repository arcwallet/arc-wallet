export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  contractAddresses: {
    mainnet?: {
      ethereum?: string;
      base?: string;
      avalanche?: string;
      arc?: string;
    };
    testnet?: {
      sepolia?: string;
      baseSepolia?: string;
      avalancheFuji?: string;
      arcTestnet?: string;
    };
  };
  icon?: string;
  priceSource?: string;
  displayPriority: number;
}

export const SUPPORTED_TOKENS: Record<string, TokenInfo> = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddresses: {
      mainnet: {
        ethereum: '0xA0b86a33E6417c5e5a5f5e5F2e5a5f5e5F2e5a5f', // USDC mainnet
        base: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
      },
      testnet: {
        sepolia: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC Sepolia
        baseSepolia: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        avalancheFuji: '0x5425890298aed601595a70AB815c96711a31Bc65',
        arcTestnet: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a', // Native USDC on Arc Testnet
      },
    },
    icon: '/icons/usdc.svg',
    priceSource: 'coingecko:usd-coin',
    displayPriority: 1,
  },
  EURC: {
    symbol: 'EURC',
    name: 'Euro Coin',
    decimals: 6,
    contractAddresses: {
      mainnet: {
        ethereum: '0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c',
        base: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
        avalanche: '0xC891EB4cbdEFf6e073e859e987815Ed1505c2ACD',
      },
      testnet: {
        sepolia: '0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4',
        baseSepolia: '0x808456652fdb597867f38412077A9182bf77359F',
        avalancheFuji: '0x5E44db7996c682E92a960b65AC713a54AD815c6B',
        arcTestnet: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a', // Will need to check if EURC is available on Arc Testnet
      },
    },
    icon: '/icons/eurc.svg',
    priceSource: 'coingecko:euro-coin',
    displayPriority: 2,
  },
};

export const getTokenInfo = (symbol: string): TokenInfo | undefined => {
  return SUPPORTED_TOKENS[symbol.toUpperCase()];
};

export const getTokenContractAddress = (
  symbol: string,
  network: 'mainnet' | 'testnet',
  chain: 'ethereum' | 'sepolia' | 'base' | 'baseSepolia' | 'avalanche' | 'avalancheFuji' | 'arc' | 'arcTestnet'
): string | undefined => {
  const token = getTokenInfo(symbol);
  if (!token) return undefined;

  return token.contractAddresses[network]?.[chain];
};

export const getAllSupportedTokens = (): TokenInfo[] => {
  return Object.values(SUPPORTED_TOKENS).sort((a, b) => a.displayPriority - b.displayPriority);
};

export const getDefaultToken = (): TokenInfo => {
  return SUPPORTED_TOKENS.USDC;
};

// Helper function to format token amounts
export const formatTokenAmount = (
  amount: bigint | string | number,
  token: TokenInfo,
  options: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    showSymbol?: boolean;
  } = {}
): { value: number; display: string } => {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 6,
    showSymbol = true,
  } = options;

  let amountBigInt: bigint;
  if (typeof amount === 'string') {
    amountBigInt = BigInt(amount);
  } else if (typeof amount === 'number') {
    amountBigInt = BigInt(amount);
  } else {
    amountBigInt = amount;
  }

  const divisor = BigInt(10 ** token.decimals);
  const wholePart = amountBigInt / divisor;
  const fractionalPart = amountBigInt % divisor;

  const value = Number(wholePart) + Number(fractionalPart) / Number(divisor);

  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  });

  const formattedNumber = formatter.format(value);
  const display = showSymbol ? `${formattedNumber} ${token.symbol}` : formattedNumber;

  return { value, display };
};