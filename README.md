# Arc Wallet

<p align="center">
  <img src="./assets/arclogo.png" alt="Arc Wallet Logo" width="120" height="120">
</p>

<p align="center">
  <strong>Enterprise-Grade Smart Contract Wallet for Arc Network</strong>
</p>

<p align="center">
  Built on <a href="https://developers.circle.com/wallets/modular">Circle Modular Wallet</a> • ERC-4337 Account Abstraction • ERC-6900 Modular Accounts
</p>

<p align="center">
  <a href="https://app.arcwallet.network">Live App</a> •
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting Started</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Circle-Modular%20Wallet-00D632?logo=circle" alt="Circle">
  <img src="https://img.shields.io/badge/ERC--4337-Account%20Abstraction-blueviolet" alt="ERC-4337">
  <img src="https://img.shields.io/badge/ERC--6900-Modular%20Accounts-blue" alt="ERC-6900">
  <img src="https://img.shields.io/badge/React-19.2.0-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-Proprietary-red.svg" alt="License">
</p>

---

## Overview

Arc Wallet is an enterprise-grade, self-custodial Web3 wallet built on **Circle Modular Wallet SDK**. It leverages **passkey authentication** (WebAuthn) for seamless, passwordless access without seed phrases. The wallet is fully compliant with **ERC-4337** (Account Abstraction) and **ERC-6900** (Modular Smart Contract Accounts).

### Why Circle Modular Wallet?

| Feature | Traditional Wallets | Arc Wallet (Circle Modular) |
|---------|---------------------|----------------------------|
| Authentication | Seed phrase / Private key | Passkey (Face ID / Touch ID) |
| Key Storage | User responsibility | Device Secure Enclave |
| Account Type | EOA (Externally Owned) | Smart Contract Account (SCA) |
| Signature Curve | secp256k1 | secp256r1 (P256/WebAuthn) |
| Gas Payment | Native token only | USDC as gas (Paymaster) |
| Recovery | Seed phrase backup | Multi-device passkey sync |
| Extensibility | None | ERC-6900 Modular Plugins |
| Multi-Sig | Separate contracts | Native weighted multi-sig |
| Audited Infrastructure | Varies | Circle-audited contracts |

---

## Features

### Core Wallet (Circle Modular Wallet SDK)

- **Passkey-First Authentication** - No seed phrases, no passwords. Biometric authentication via WebAuthn.
- **Smart Contract Accounts** - ERC-4337 compliant accounts with native P256 signature verification.
- **Gas Sponsorship** - Pay transaction fees with USDC via Circle's Paymaster infrastructure.
- **Lazy Deployment** - Account deployed on first transaction, reducing onboarding friction.
- **Session Persistence** - Auto-reconnect with stored passkey credentials.

### Cross-Chain Bridge (Circle CCTP V2)

- **Native USDC Bridging** - Transfer USDC across chains using Circle's Cross-Chain Transfer Protocol.
- **Supported Routes**:
  - Arc Testnet ↔ Ethereum Sepolia
  - Arc Testnet ↔ Base Sepolia
- **Fast Transfer** - ~30 seconds on supported chains.
- **Standard Transfer** - ~15-20 minutes with Circle attestation.
- **No Wrapped Tokens** - Native burn-and-mint mechanism, 1:1 capital efficiency.

### Enterprise Multi-Sig (ERC-6900)

- **Weighted Signatures** - Different signers can have different weights (CEO=2, CFO=2, CTO=1).
- **Threshold Approvals** - Require minimum combined weight for transaction approval.
- **Native Plugin** - Uses Circle's WeightedWebauthnMultisigPlugin (ERC-6900 compliant).
- **Passkey Owners** - Add multiple passkey-based owners without EOA dependencies.
- **Audited Contracts** - Circle's enterprise-grade, audited infrastructure.

### Treasury Management

- **USYC Integration** - Hashnote's US Yield Coin for treasury yield.
- **Spending Limits** - Configure daily/monthly limits by token.
- **Batch Transactions** - Execute multiple operations in single UserOperation.
- **Allowance Optimization** - Smart approval management to minimize transactions.

### Additional Features

- **Token Swaps** - In-app swap functionality.
- **Transaction History** - Complete activity tracking.
- **Faucet Integration** - Test token faucet for Arc Testnet.
- **Multi-Token Support** - USDC (native), EURC, USYC, and custom tokens.

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ARC WALLET ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     FRONTEND (React + Vite)                  │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│   │
│  │  │ WalletSetup │ │  Dashboard  │ │   Bridge / Treasury     ││   │
│  │  └──────┬──────┘ └──────┬──────┘ └───────────┬─────────────┘│   │
│  │         │               │                     │              │   │
│  │         └───────────────┼─────────────────────┘              │   │
│  │                         ▼                                    │   │
│  │  ┌─────────────────────────────────────────────────────────┐│   │
│  │  │              CONTEXTS (React State Management)           ││   │
│  │  │  CircleWalletContext │ BridgeContext │ ERC6900MultiSig  ││   │
│  │  └──────────────────────┴───────────────┴──────────────────┘│   │
│  │                         │                                    │   │
│  │                         ▼                                    │   │
│  │  ┌─────────────────────────────────────────────────────────┐│   │
│  │  │                    SERVICES LAYER                        ││   │
│  │  │  circleWalletService │ bridgeService │ erc6900MultiSig  ││   │
│  │  └──────────────────────┴───────────────┴──────────────────┘│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │               CIRCLE MODULAR WALLET SDK                      │   │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌────────────────┐ │   │
│  │  │ toPasskeyTransport│ │toModularTransport│ │toCircleSmartAcc│ │   │
│  │  └────────┬────────┘ └────────┬────────┘ └───────┬────────┘ │   │
│  │           │                   │                   │          │   │
│  │           ▼                   ▼                   ▼          │   │
│  │  ┌─────────────────────────────────────────────────────────┐│   │
│  │  │              BUNDLER CLIENT (viem/account-abstraction)   ││   │
│  │  │                    sendUserOperation()                   ││   │
│  │  └──────────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    BLOCKCHAIN LAYER                          │   │
│  │                                                              │   │
│  │  Arc Testnet (Chain ID: 5042002)                            │   │
│  │  ├── EntryPoint v0.7 (ERC-4337)                             │   │
│  │  ├── Circle MSCA Factory (ERC-6900)                         │   │
│  │  ├── WeightedWebauthnMultisigPlugin                         │   │
│  │  ├── TokenMessengerV2 (CCTP)                                │   │
│  │  ├── MessageTransmitterV2 (CCTP)                            │   │
│  │  └── USDC (Native Gas Token)                                │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌───────────────┐     ┌──────────────┐
│  User    │────▶│  Email   │────▶│  Circle OTP   │────▶│   Passkey    │
│  Login   │     │  Input   │     │  Verification │     │  Auth/Create │
└──────────┘     └──────────┘     └───────────────┘     └──────┬───────┘
                                                               │
                                                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    CIRCLE MODULAR WALLET FLOW                         │
├──────────────────────────────────────────────────────────────────────┤
│  1. toPasskeyTransport() - Initialize passkey communication          │
│  2. toWebAuthnCredential() - Register/Login with WebAuthn            │
│  3. toWebAuthnAccount() - Create viem account from credential        │
│  4. toCircleSmartAccount() - Create Circle MSCA (ERC-6900)          │
│  5. createBundlerClient() - Initialize UserOp submission client      │
│  6. Session stored locally for auto-reconnect                        │
└──────────────────────────────────────────────────────────────────────┘
```

### Transaction Flow (ERC-4337)

```
┌─────────┐    ┌─────────────┐    ┌──────────────┐    ┌───────────────┐
│  User   │───▶│  Build Tx   │───▶│  Passkey     │───▶│  Submit       │
│  Action │    │  Calls      │    │  Sign (P256) │    │  UserOperation│
└─────────┘    └─────────────┘    └──────────────┘    └───────┬───────┘
                                                              │
                    ┌─────────────────────────────────────────┘
                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      BUNDLER → ENTRYPOINT                             │
├──────────────────────────────────────────────────────────────────────┤
│  bundlerClient.sendUserOperation({                                    │
│    account: circleSmartAccount,                                       │
│    calls: [                                                           │
│      { to: "0x...", data: "0x...", value: 0n },  // Call 1           │
│      { to: "0x...", data: "0x...", value: 0n },  // Call 2 (batch)   │
│    ],                                                                 │
│    paymaster: true,  // Gas paid by Circle Paymaster                 │
│  })                                                                   │
│                              │                                        │
│                              ▼                                        │
│  EntryPoint.handleOps() → MSCA.validateUserOp() → Execute Calls      │
└──────────────────────────────────────────────────────────────────────┘
```

### CCTP Bridge Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                    CCTP BRIDGE (Arc → Sepolia)                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Source Chain (Arc Testnet):                                         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  sendBatchTransactions([                                        │ │
│  │    USDC.approve(TokenMessenger, amount),                        │ │
│  │    TokenMessenger.depositForBurn(amount, destDomain, recipient) │ │
│  │  ])                                                             │ │
│  │                        │                                        │ │
│  │                        ▼                                        │ │
│  │  Single UserOperation → Bundler → EntryPoint → Execute          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│  Circle Attestation Service (Iris) - ~15-20 minutes                 │
│                              │                                       │
│                              ▼                                       │
│  Destination Chain (Sepolia):                                        │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  MessageTransmitter.receiveMessage(message, attestation)        │ │
│  │                        │                                        │ │
│  │                        ▼                                        │ │
│  │  USDC minted to recipient (same Smart Account address)          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.0 | UI Framework |
| TypeScript | 5.8.2 | Type Safety |
| Vite | 6.4.1 | Build Tool |
| viem | 2.x | Blockchain Interaction |
| @circle-fin/modular-wallets-core | latest | Circle Modular Wallet SDK |
| Tailwind CSS | 3.x | Styling |

### Circle SDK Components

| Package | Purpose |
|---------|---------|
| `@circle-fin/modular-wallets-core` | Core SDK for passkey and smart accounts |
| `toPasskeyTransport` | WebAuthn communication layer |
| `toModularTransport` | On-chain operation transport |
| `toCircleSmartAccount` | ERC-6900 MSCA creation |
| `toWebAuthnCredential` | Passkey registration/login |

### Blockchain Standards

| Standard | Implementation |
|----------|---------------|
| ERC-4337 | Account Abstraction via UserOperations |
| ERC-6900 | Modular Smart Contract Accounts |
| WebAuthn | Passkey authentication (P256/secp256r1) |
| CCTP V2 | Cross-Chain Transfer Protocol |

---

## Contract Addresses

### Arc Testnet (Chain ID: 5042002)

| Contract | Address |
|----------|---------|
| USDC (Native) | `0x3600000000000000000000000000000000000000` |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |
| USYC | `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C` |
| TokenMessengerV2 (CCTP) | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` |
| MessageTransmitterV2 (CCTP) | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` |
| TokenMinterV2 (CCTP) | `0xb43db544E2c27092c107639Ad201b3dEfAbcF192` |

### Ethereum Sepolia (Chain ID: 11155111)

| Contract | Address |
|----------|---------|
| USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| TokenMessengerV2 (CCTP) | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` |
| MessageTransmitterV2 (CCTP) | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` |

### CCTP Domain IDs

| Chain | Domain ID |
|-------|-----------|
| Ethereum | 0 |
| Arc Testnet | 26 |
| Base | 6 |

---

## Project Structure

```
arcwallet/
├── components/              # React UI components
│   ├── Bridge.tsx               # CCTP cross-chain bridge
│   ├── ERC6900MultiSigPanel.tsx # Enterprise multi-sig UI
│   ├── MultiSigDashboard.tsx    # Multi-sig management
│   ├── SendAssets.tsx           # Token transfers
│   ├── SwapScreen.tsx           # Token swaps
│   ├── TreasuryScreen.tsx       # Treasury management
│   ├── WalletDashboard.tsx      # Main dashboard
│   ├── WalletSetup.tsx          # Onboarding flow
│   └── ...
│
├── contexts/                # React state management
│   ├── CircleWalletContext.tsx  # Circle Modular Wallet state
│   ├── BridgeContext.tsx        # CCTP bridge state
│   ├── ERC6900MultiSigContext.tsx # Multi-sig state
│   ├── SessionContext.tsx       # User session
│   └── ...
│
├── services/                # Business logic
│   ├── circleWalletService.ts   # Core wallet operations
│   ├── bridgeService.ts         # CCTP bridge logic
│   ├── erc6900MultiSigService.ts # Multi-sig operations
│   ├── usycService.ts           # Treasury/USYC
│   └── ...
│
├── config/                  # Configuration
│   ├── circle.ts               # Circle SDK config
│   ├── cctp.ts                 # CCTP addresses & ABIs
│   └── chains/                 # Chain definitions
│
├── pages/                   # Page components
│   ├── LoginPage.tsx           # Email OTP login
│   ├── PrivacyPolicy.tsx       # Legal pages
│   └── ...
│
├── styles/                  # CSS styles
├── App.tsx                  # Root component with providers
└── index.tsx                # Entry point
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Modern browser with WebAuthn support (Chrome, Safari, Firefox, Edge)
- Circle Developer Account (for API keys)

### Environment Variables

Create a `.env` file:

```env
# Circle Modular Wallet
VITE_CIRCLE_CLIENT_URL=https://modular-sdk.circle.com/v1/rpc/w3s/buidl
VITE_CIRCLE_CLIENT_KEY=your_circle_client_key
VITE_CIRCLE_CHAIN_PATH=/arc

# Arc Network
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
VITE_EXPLORER_URL=https://testnet.arcscan.app
```

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/arcwallet.git
cd arcwallet

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Circle Developer Setup

1. Create account at [Circle Developer Console](https://console.circle.com)
2. Create a new Modular Wallet project
3. Add Arc Testnet to supported networks
4. Copy Client Key to `.env`

---

## Security

### Security Model

Arc Wallet implements a **passkey-first, non-custodial security model**:

1. **No Seed Phrases** - Private keys never leave device secure enclave
2. **WebAuthn P256** - Industry-standard passkey authentication
3. **On-Chain Verification** - Signatures verified by smart contract
4. **Circle Infrastructure** - Audited, enterprise-grade contracts
5. **ERC-6900 Modular** - Extensible security via plugins

### Key Security Features

- **Biometric Auth** - Face ID, Touch ID, Windows Hello
- **Multi-Device Sync** - Passkeys sync via iCloud Keychain / Google Password Manager
- **No Server-Side Keys** - Circle never has access to signing keys
- **Deterministic Addresses** - Same address across all EVM chains (CREATE2)

### Reporting Vulnerabilities

Please report security vulnerabilities to: **security@arcwallet.network**

---

## Resources

### Circle Documentation

- [Modular Wallets Overview](https://developers.circle.com/wallets/modular)
- [Web SDK Reference](https://developers.circle.com/wallets/modular/web-sdk)
- [Passkey Authentication](https://developers.circle.com/wallets/modular/passkeys)
- [CCTP Documentation](https://developers.circle.com/cctp)

### Standards

- [ERC-4337: Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [ERC-6900: Modular Smart Contract Accounts](https://eips.ethereum.org/EIPS/eip-6900)
- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)

### Arc Network

- [Arc Network Website](https://arc.network)
- [Arc Testnet Explorer](https://testnet.arcscan.app)
- [Arc Documentation](https://docs.arc.network)

---

## License

Copyright 2025 Arc Wallet. All rights reserved.

This is proprietary software. Unauthorized copying, distribution, modification, or use is strictly prohibited.

---

## Support

- **Website**: https://arcwallet.network
- **App**: https://app.arcwallet.network
- **Email**: support@arcwallet.network
- **Security**: security@arcwallet.network

---

## Disclaimer

**This software is provided "as is", without warranty of any kind, express or implied.**

Arc Wallet is a self-custodial wallet. You are solely responsible for the security of your passkeys and funds. We cannot recover your wallet if you lose access to all devices with your passkey.

Arc Wallet is not responsible for any loss of funds due to user error, security breaches, smart contract vulnerabilities, or technical issues.

---

<p align="center">
  <strong>Built on Circle Modular Wallet</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Powered%20by-Circle-00D632?logo=circle" alt="Powered by Circle">
</p>

<p align="center">
  2025 Arc Wallet. All rights reserved.
</p>
