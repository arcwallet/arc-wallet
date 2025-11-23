# 🔐 Arc Wallet SDK

**Passkey-based Ethereum Wallet SDK for Web3 Applications**

Build secure, user-friendly wallets using WebAuthn (Passkeys) instead of seed phrases. Users sign transactions with biometrics (FaceID/TouchID) or device passcodes.

[![npm version](https://img.shields.io/npm/v/@arc/wallet-sdk.svg)](https://www.npmjs.com/package/@arc/wallet-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ✨ Features

- **🔒 No Seed Phrases** - Uses WebAuthn (Passkeys) for authentication
- **📱 Biometric Authentication** - FaceID, TouchID, or device passcode
- **🔐 Secure Enclave** - Private keys stored in device's Secure Enclave
- **🎨 Embedded UI** - Modal/overlay components for seamless integration
- **⚡ Simple API** - Easy to integrate with just a few lines of code
- **🌐 Arc Network** - Optimized for Arc testnet and mainnet
- **📦 NPM Package** - Install and use like any other library

---

## 📦 Installation

```bash
npm install @arc/wallet-sdk
```

or

```bash
yarn add @arc/wallet-sdk
```

---

## 🚀 Quick Start

### 1. Initialize SDK

```typescript
import { WalletSDK } from '@arc/wallet-sdk';

const sdk = new WalletSDK({
  appName: 'My DApp',
  rpId: 'myapp.com', // Your domain
  rpcUrl: 'https://rpc.testnet.arc.network',
  backendUrl: 'https://api.myapp.com', // Optional
  theme: 'dark', // or 'light'
});
```

### 2. Create New Wallet

```typescript
// User creates wallet with passkey
const account = await sdk.createWallet(
  'user_123', // User ID
  'john@example.com' // User name/email
);

console.log('Wallet created:', account.address);
// Output: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

### 3. Connect Existing Wallet

```typescript
// User unlocks wallet with passkey (biometric)
const account = await sdk.connect();

console.log('Connected:', account.address);
```

### 4. Sign Transaction

```typescript
// Sign and send transaction
const result = await sdk.signTransaction({
  to: '0x...',
  value: '1000000', // Amount in wei
  data: '0x', // Contract call data
});

console.log('Transaction hash:', result.hash);
```

### 5. Sign Message

```typescript
// Sign arbitrary message
const signature = await sdk.signMessage('Hello, World!');

console.log('Signature:', signature);
```

---

## 📚 API Reference

### `WalletSDK`

Main SDK class for wallet operations.

#### Constructor

```typescript
new WalletSDK(config: WalletSDKConfig)
```

**Config Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `appName` | string | ✅ | Your application name (for WebAuthn) |
| `rpId` | string | ✅ | Relying Party ID (usually your domain) |
| `rpcUrl` | string | ✅ | Blockchain RPC URL |
| `backendUrl` | string | ❌ | Backend URL for passkey registration |
| `theme` | 'light' \| 'dark' | ❌ | UI theme (default: 'dark') |

#### Methods

##### `createWallet(userId: string, userName: string): Promise<WalletAccount>`

Create new wallet with passkey.

```typescript
const account = await sdk.createWallet('user_123', 'John Doe');
```

**Returns:**
```typescript
{
  address: string; // Ethereum address
  credentialId: string; // Passkey credential ID
  publicKey: string; // Public key hex
}
```

---

##### `connect(credentialId?: string): Promise<WalletAccount>`

Connect to existing wallet (unlock with passkey).

```typescript
const account = await sdk.connect();
```

---

##### `disconnect(): void`

Disconnect wallet (lock).

```typescript
sdk.disconnect();
```

---

##### `signTransaction(tx: TransactionRequest): Promise<SignedTransaction>`

Sign and send transaction.

```typescript
const result = await sdk.signTransaction({
  to: '0x...',
  value: '1000000',
  data: '0x',
  // Optional:
  gasLimit: 21000n,
  maxFeePerGas: 1000000000n,
  maxPriorityFeePerGas: 1000000000n,
});
```

**Returns:**
```typescript
{
  hash: string; // Transaction hash
  signedTx: string; // Signed transaction data
  from: string; // Sender address
  to: string; // Recipient address
  value: string; // Amount
}
```

---

##### `signMessage(message: string): Promise<string>`

Sign arbitrary message.

```typescript
const signature = await sdk.signMessage('Hello!');
```

---

##### `getAccount(): WalletAccount | null`

Get current connected account.

```typescript
const account = sdk.getAccount();
if (account) {
  console.log('Connected:', account.address);
}
```

---

##### `getAddress(): string | null`

Get current wallet address.

```typescript
const address = sdk.getAddress();
```

---

##### `isConnected(): boolean`

Check if wallet is connected.

```typescript
if (sdk.isConnected()) {
  console.log('Wallet is connected');
}
```

---

##### `getProvider(): JsonRpcProvider`

Get ethers.js provider for advanced usage.

```typescript
const provider = sdk.getProvider();
const balance = await provider.getBalance(address);
```

---

### Events

Subscribe to wallet events:

```typescript
sdk.on('connect', (payload) => {
  console.log('Wallet connected:', payload.address);
});

sdk.on('disconnect', (payload) => {
  console.log('Wallet disconnected:', payload.reason);
});

sdk.on('transactionSigned', (payload) => {
  console.log('Transaction signed:', payload.hash);
});

sdk.on('error', (payload) => {
  console.error('Error:', payload.message);
});
```

**Available Events:**

- `connect` - Wallet connected
- `disconnect` - Wallet disconnected
- `accountsChanged` - Account changed
- `chainChanged` - Network changed
- `transactionSigned` - Transaction signed
- `error` - Error occurred

---

## 🔐 Security

### How It Works

1. **Passkey Creation** - User creates passkey using device biometrics
2. **Key Generation** - Ethereum wallet generated and private key encrypted
3. **Secure Storage** - Encrypted key stored in IndexedDB
4. **Encryption Key** - Derived from passkey credential (never leaves device)
5. **Authentication** - User authenticates with biometrics to unlock wallet
6. **Signing** - Private key decrypted in-memory for signing only

### Security Features

- ✅ **No Seed Phrases** - Eliminates phishing risk
- ✅ **Secure Enclave** - Keys stored in device's Secure Enclave via WebAuthn
- ✅ **AES-GCM Encryption** - Private keys encrypted with AES-256-GCM
- ✅ **PBKDF2 Key Derivation** - Encryption key derived with 100,000 iterations
- ✅ **No Backend Storage** - Private keys never sent to backend
- ✅ **Client-Side Signing** - All signing happens on client

---

## 🎨 React Integration

### Example: Connect Button

```typescript
import { WalletSDK } from '@arc/wallet-sdk';
import { useState } from 'react';

const sdk = new WalletSDK({
  appName: 'My DApp',
  rpId: 'localhost',
  rpcUrl: 'https://rpc.testnet.arc.network',
});

function ConnectButton() {
  const [address, setAddress] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      const account = await sdk.connect();
      setAddress(account.address);
    } catch (error) {
      console.error('Connect failed:', error);
    }
  };

  return (
    <button onClick={handleConnect}>
      {address ? `Connected: ${address.slice(0, 6)}...` : 'Connect Wallet'}
    </button>
  );
}
```

---

## 🌐 Backend Setup (Optional)

If you want to track passkey registrations on your backend:

```typescript
// Backend endpoint example (Express.js)
app.post('/passkey/register/options', async (req, res) => {
  const { userId, userName } = req.body;

  const options = {
    challenge: generateRandomChallenge(),
    rp: {
      name: 'My DApp',
      id: 'myapp.com',
    },
    user: {
      id: userId,
      name: userName,
      displayName: userName,
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' }, // ES256
      { alg: -257, type: 'public-key' }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      requireResidentKey: false,
      userVerification: 'required',
    },
  };

  res.json(options);
});
```

---

## 📖 Examples

### Send USDC

```typescript
import { parseUnits } from 'ethers';

// USDC has 6 decimals
const amount = parseUnits('10', 6); // 10 USDC

const result = await sdk.signTransaction({
  to: '0xRecipientAddress',
  value: amount.toString(),
  data: '0x',
});

console.log('USDC sent:', result.hash);
```

### Call Smart Contract

```typescript
import { Interface } from 'ethers';

// ERC20 transfer
const iface = new Interface([
  'function transfer(address to, uint256 amount) returns (bool)',
]);

const data = iface.encodeFunctionData('transfer', [
  '0xRecipient',
  parseUnits('10', 6),
]);

const result = await sdk.signTransaction({
  to: '0xUSDCContractAddress',
  value: '0',
  data,
});
```

---

## 🛠️ Advanced Usage

### Custom Storage Provider

```typescript
import { WalletSDK, StorageProvider } from '@arc/wallet-sdk';

class CustomStorage implements StorageProvider {
  async set(key: string, value: any): Promise<void> {
    // Your custom storage logic
  }

  async get<T>(key: string): Promise<T | null> {
    // Your custom retrieval logic
  }

  async delete(key: string): Promise<void> {
    // Your custom deletion logic
  }

  async clear(): Promise<void> {
    // Your custom clear logic
  }
}

// Use custom storage
const sdk = new WalletSDK({
  // ... config
  storage: new CustomStorage(),
});
```

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md).

---

## 📄 License

MIT © Arc Network

---

## 🔗 Links

- [Documentation](https://docs.arc.network)
- [GitHub](https://github.com/arcwallet/arc-wallet-sdk)
- [NPM Package](https://www.npmjs.com/package/@arc/wallet-sdk)
- [Arc Network](https://arc.network)

---

## 💬 Support

- Discord: [Join our community](https://discord.gg/arc)
- Twitter: [@ArcNetwork](https://twitter.com/arcnetwork)
- Email: support@arc.network
