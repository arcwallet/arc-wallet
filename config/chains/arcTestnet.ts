/**
 * Arc Testnet Chain Definition for Viem
 *
 * Arc Network is Circle's L1 blockchain with USDC as native gas token.
 * This chain definition is used with Circle Modular Wallet SDK.
 */

import { defineChain } from 'viem';

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: 'https://testnet.arcscan.app',
    },
  },
  contracts: {
    // Circle contracts on Arc Testnet
    usdc: {
      address: '0x3600000000000000000000000000000000000000' as const,
    },
    eurc: {
      address: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a' as const,
    },
  },
  testnet: true,
});

export default arcTestnet;
