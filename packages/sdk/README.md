# Arc Wallet SDK

A modern, secure wallet SDK with passkey authentication, cross-chain transfers, and gasless transactions.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/arcwallet/arc-wallet)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

## 🎯 Features

- **🔐 Passkey Authentication** - No seed phrases, biometric authentication only
- **🔒 WebCrypto Security** - Non-extractable master keys for maximum security
- **🌉 CCTP Integration** - Native cross-chain USDC transfers via Circle
- **⚡ Account Abstraction** - ERC-4337 support with gasless transactions
- **📦 Batch Operations** - Execute multiple transactions in one operation
- **🎨 Simple API** - Clean, intuitive developer experience
- **📘 TypeScript** - Full type safety and IntelliSense support

## 📦 Installation

```bash
npm install @arc/wallet-sdk
```

## 🚀 Quick Start

### Basic Wallet

```typescript
import { WalletSDK } from '@arc/wallet-sdk';

const arc = new WalletSDK({
  appName: 'My dApp',
  rpId: 'mydapp.com',
  rpcUrl: 'https://rpc.arc.network'
});

// Create wallet with passkey
await arc.createWallet('user@example.com', 'John Doe');

// Connect (unlock with biometric)
await arc.connect();

// Sign message
const signature = await arc.signMessage('Hello World');

// Send transaction
const tx = await arc.signTransaction({
  to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  value: '1000000000000000000' // 1 ETH in wei
});
```

### Cross-Chain USDC Transfer (CCTP)

```typescript
const arc = new WalletSDK({
  appName: 'My dApp',
  rpcUrl: 'https://rpc.arc.network',
  cctp: {
    attestationServiceUrl: 'https://iris-api.circle.com'
  }
});

// Transfer USDC from Arc to Ethereum Sepolia
const result = await arc.transferUSDC({
  amount: '100', // 100 USDC
  destinationAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  destinationChainId: 11155111 // Sepolia
});

console.log('Transfer initiated:', result.sourceTxHash);
console.log('Message hash:', result.messageHash);

// Check USDC balance
const balance = await arc.getUSDCBalance();
console.log('Balance:', balance, 'USDC');
```

### Gasless Transactions (Account Abstraction)

```typescript
const arc = new WalletSDK({
  appName: 'My dApp',
  rpcUrl: 'https://rpc.arc.network',
  accountType: 'smart-account',
  smartAccount: {
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    bundlerUrl: 'https://bundler.arc.network',
    factoryAddress: '0x...',
    accountImplementation: '0x...'
  },
  paymaster: {
    url: 'https://paymaster.arc.network',
    enabled: true
  }
});

// Gasless transaction (sponsored by paymaster)
const result = await arc.sendUserOperation({
  to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  value: '1000000',
  sponsored: true // Paymaster pays gas!
});

// Batch transactions
const batchResult = await arc.batchTransactions([
  { to: '0xAddr1', value: '100000' },
  { to: '0xAddr2', value: '200000' },
  { to: '0xAddr3', value: '300000' }
], true); // sponsored = true
```

## 📚 API Reference

### WalletSDK

#### Constructor

```typescript
new WalletSDK(config: WalletSDKConfig)
```

**Config Options:**

```typescript
interface WalletSDKConfig {
  appName: string;              // Your app name
  rpId: string;                 // Your domain (for WebAuthn)
  rpcUrl: string;               // Blockchain RPC URL
  theme?: 'light' | 'dark';     // UI theme
  backendUrl?: string;          // Backend URL for passkey registration
  
  // CCTP Configuration
  cctp?: {
    tokenMessengerAddresses?: Record<number, string>;
    usdcAddresses?: Record<number, string>;
    domainIds?: Record<number, number>;
    attestationServiceUrl?: string;
  };
  
  // Account Abstraction Configuration
  accountType?: 'eoa' | 'smart-account';
  smartAccount?: {
    entryPoint?: string;
    bundlerUrl?: string;
    factoryAddress?: string;
    accountImplementation?: string;
  };
  paymaster?: {
    url: string;
    enabled: boolean;
  };
}
```

#### Methods

##### Wallet Management

```typescript
// Create new wallet
createWallet(userId: string, userName: string): Promise<WalletAccount>

// Connect (unlock) wallet
connect(): Promise<WalletAccount>

// Disconnect wallet
disconnect(): void

// Delete wallet permanently
deleteWallet(): Promise<void>

// Get current address
getAddress(): string | null

// Check if connected
isConnected(): boolean
```

##### Transactions

```typescript
// Sign message
signMessage(message: string): Promise<string>

// Sign transaction
signTransaction(tx: TransactionRequest): Promise<SignedTransaction>

// Send transaction
sendTransaction(tx: TransactionRequest): Promise<string>
```

##### CCTP (Cross-Chain)

```typescript
// Transfer USDC cross-chain
transferUSDC(params: CCTPTransferParams): Promise<CCTPTransferResult>

// Get USDC balance
getUSDCBalance(chainId?: number): Promise<string>
```

##### Account Abstraction

```typescript
// Send UserOperation (Smart Account only)
sendUserOperation(request: UserOperationRequest): Promise<UserOperationResult>

// Batch transactions (Smart Account only)
batchTransactions(
  transactions: BatchTransaction[],
  sponsored?: boolean
): Promise<UserOperationResult>

// Get Smart Account address
getSmartAccountAddress(): string | null

// Check if Smart Account is deployed
isSmartAccountDeployed(): Promise<boolean>
```

##### Events

```typescript
// Listen to events
on(event: WalletEvent, callback: (payload: any) => void): void

// Remove event listener
off(event: WalletEvent, callback: (payload: any) => void): void

// Available events:
// - 'connected'
// - 'disconnected'
// - 'accountChanged'
// - 'transactionSigned'
// - 'error'
```

## 🔐 Security

### Architecture

Arc Wallet SDK uses a multi-layered security approach:

1. **Passkey Layer** - WebAuthn credentials stored in device Secure Enclave
2. **WebCrypto Layer** - Non-extractable AES-GCM master keys
3. **Encryption Layer** - Private keys encrypted with master keys
4. **Sandbox Layer** - All crypto operations in browser sandbox

### Security Flow

```
User → Biometric Auth → Passkey (Secure Enclave)
                            ↓
                    WebCrypto Master Key (Non-Extractable)
                            ↓
                    Decrypt Private Key (In Memory)
                            ↓
                    Sign Transaction
                            ↓
                    Clear from Memory
```

### Key Features

- ✅ **No Seed Phrases** - Eliminates phishing risk
- ✅ **Non-Extractable Keys** - Master keys cannot be exported
- ✅ **Hardware-Backed** - Uses device crypto when available
- ✅ **Self-Custodial** - User always in control
- ✅ **Biometric Auth** - FaceID, TouchID, or device PIN

## 🏗️ Architecture

### Core Components

```
WalletSDK
├── WebAuthnManager      # Passkey authentication
├── KeyManager           # Private key management
├── SecureStorage        # Encrypted storage
├── WebCryptoMasterKey   # Non-extractable master keys
├── CCTPManager          # Cross-chain transfers
└── SmartAccountManager  # Account Abstraction
```

### Storage

- **Passkeys**: Device Secure Enclave (iOS Keychain, Android Keystore)
- **Master Keys**: WebCrypto (non-extractable)
- **Private Keys**: IndexedDB (encrypted with master keys)
- **Metadata**: IndexedDB (public info only)

## 🌐 Supported Networks

### Mainnet
- Ethereum
- Arbitrum
- Optimism
- Base
- Arc Network

### Testnet
- Sepolia
- Arbitrum Sepolia
- Optimism Sepolia
- Base Sepolia
- Arc Testnet

## 📖 Examples

### React Integration

```typescript
import { WalletSDK } from '@arc/wallet-sdk';
import { useState, useEffect } from 'react';

function App() {
  const [arc] = useState(() => new WalletSDK({
    appName: 'My dApp',
    rpId: window.location.hostname,
    rpcUrl: 'https://rpc.arc.network'
  }));
  
  const [address, setAddress] = useState<string | null>(null);
  
  useEffect(() => {
    arc.on('connected', ({ address }) => {
      setAddress(address);
    });
    
    arc.on('disconnected', () => {
      setAddress(null);
    });
  }, [arc]);
  
  const handleConnect = async () => {
    try {
      const account = await arc.connect();
      console.log('Connected:', account.address);
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };
  
  return (
    <div>
      {address ? (
        <p>Connected: {address}</p>
      ) : (
        <button onClick={handleConnect}>Connect Wallet</button>
      )}
    </div>
  );
}
```

### Next.js Integration

```typescript
// app/providers.tsx
'use client';

import { WalletSDK } from '@arc/wallet-sdk';
import { createContext, useContext, ReactNode } from 'react';

const WalletContext = createContext<WalletSDK | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const arc = new WalletSDK({
    appName: 'My dApp',
    rpId: process.env.NEXT_PUBLIC_RP_ID!,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL!
  });
  
  return (
    <WalletContext.Provider value={arc}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}
```

## 🛠️ Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

## 📞 Support

- **Documentation**: [docs.arc.network](https://docs.arc.network)
- **Discord**: [discord.gg/arcnetwork](https://discord.gg/arcnetwork)
- **Twitter**: [@ArcNetwork](https://twitter.com/ArcNetwork)
- **Email**: support@arc.network

## 🙏 Acknowledgments

- [Circle CCTP](https://www.circle.com/en/cross-chain-transfer-protocol) - Cross-chain infrastructure
- [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) - Account Abstraction standard
- [WebAuthn](https://webauthn.io/) - Passkey authentication

---

**Built with ❤️ by the Arc Network team**
