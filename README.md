# Arc Wallet

<p align="center">
  <img src="./assets/arclogo.png" alt="Arc Wallet Logo" width="120" height="120">
</p>

<p align="center">
  <strong>Next-Generation Self-Custodial Smart Contract Wallet</strong>
</p>

<p align="center">
  <a href="https://app.arcwallet.network">Live App</a> •
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#documentation">Documentation</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-Proprietary-red.svg" alt="License">
  <img src="https://img.shields.io/badge/React-19.2.0-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Solidity-0.8.23-363636?logo=solidity" alt="Solidity">
  <img src="https://img.shields.io/badge/ERC--4337-Account%20Abstraction-blueviolet" alt="ERC-4337">
</p>

---

## Overview

Arc Wallet is an enterprise-grade, self-custodial Web3 wallet built for Arc Network. It leverages **passkey authentication** (WebAuthn) as the primary signing mechanism, eliminating the need for seed phrases or private key management. The wallet implements **ERC-4337 Account Abstraction** with on-chain P256 signature verification using **RIP-7212 precompile**.

### Key Differentiators

| Feature | Traditional Wallets | Arc Wallet |
|---------|---------------------|------------|
| Authentication | Seed phrase / Private key | Passkey (WebAuthn P256) |
| Key Storage | User responsibility | Device secure enclave |
| Signature Verification | Off-chain (ECDSA) | On-chain (P256 precompile) |
| Account Type | EOA | Smart Contract (ERC-4337) |
| Gas Payment | User pays in native token | USDC as gas (via Paymaster) |
| Recovery | Seed phrase backup | Multi-device passkey sync |

---

## Features

### Core Wallet Features

- **Passkey-First Authentication** - No seed phrases, no passwords. Your passkey IS your wallet key.
- **Smart Contract Accounts** - ERC-4337 compliant accounts with native P256 signature support
- **Multi-Token Support** - Native ARC, USDC, EURC, and custom token support
- **Real-Time Balances** - Live balance updates via Blockscout API

### Advanced Features

- **Cross-Chain Bridging** - Circle CCTP integration for USDC/EURC bridging between Arc Network and Ethereum
- **Gas Sponsorship** - Paymaster integration for gasless transactions (USDC as gas)
- **Batch Operations** - Execute multiple transactions in a single UserOperation
- **Multi-Signature Wallets** - Create and manage multi-sig accounts with approval workflows
- **Token Swaps** - In-app token swap functionality
- **Faucet Integration** - Test token faucet for Arc Testnet

### Security Features

- **On-Chain P256 Verification** - Signatures verified directly on-chain via RIP-7212 precompile
- **No Private Key Storage** - Keys never leave device secure enclave
- **Session Management** - 15-minute session persistence with automatic re-authentication
- **Multi-Device Passkey Support** - Manage multiple passkeys across devices

### Enterprise Features

- **Treasury Management** - Daily limits, approval workflows, spending tracking
- **Multi-Passkey Management** - Add/remove passkeys for account recovery
- **Backup Key System** - On-chain backup keys for account recovery
- **Address Book** - Save and manage frequent addresses
- **Transaction History** - Complete activity log via Blockscout

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                               │
├─────────────────────────────────────────────────────────────────────┤
│  React Frontend          │  Passkey Manager         │  WebAuthn     │
│  (TypeScript + Vite)     │  (services/)             │  (Passkeys)   │
└──────────┬───────────────┴──────────┬───────────────┴───────┬───────┘
           │                          │                       │
           ▼                          ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           BACKEND LAYER                              │
├─────────────────────────────────────────────────────────────────────┤
│  Express.js API Server (Render)                                      │
│  ├── Authentication (Circle OTP + WebAuthn)                          │
│  ├── Bundler Service (UserOperation submission)                      │
│  ├── Paymaster Service (Gas sponsorship)                             │
│  ├── Bridge Service (Circle CCTP)                                    │
│  ├── Treasury Service (Spending limits & approvals)                  │
│  └── Multi-Sig Service (Multi-signature wallets)                     │
└──────────┬──────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BLOCKCHAIN LAYER                             │
├─────────────────────────────────────────────────────────────────────┤
│  Arc Testnet (Chain ID: 5042002)                                     │
│  ├── PasskeyAccount.sol     → P256 signature verification            │
│  ├── PasskeyAccountFactory  → CREATE2 account deployment             │
│  ├── ArcPaymaster.sol       → USDC gas sponsorship                   │
│  ├── P256Verifier.sol       → RIP-7212 precompile wrapper            │
│  └── EntryPoint (v0.6)      → ERC-4337 entry point                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────────┐
│  User    │────▶│  Email   │────▶│  OTP     │────▶│  Passkey     │
│  Login   │     │  Input   │     │  Verify  │     │  Auth/Create │
└──────────┘     └──────────┘     └──────────┘     └──────┬───────┘
                                                          │
                                                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                    PASSKEY AUTHENTICATION                         │
├──────────────────────────────────────────────────────────────────┤
│  1. Browser prompts for passkey (Face ID / Touch ID / PIN)        │
│  2. Device signs challenge with P256 private key                  │
│  3. Public key (x, y coordinates) extracted                       │
│  4. Smart contract address derived from public key via CREATE2    │
│  5. Session established (15-minute persistence)                   │
└──────────────────────────────────────────────────────────────────┘
```

### Transaction Flow (ERC-4337)

```
┌─────────┐    ┌─────────────┐    ┌──────────┐    ┌───────────┐
│  User   │───▶│  Build      │───▶│  Sign    │───▶│  Submit   │
│  Intent │    │  UserOp     │    │  (P256)  │    │  to Chain │
└─────────┘    └─────────────┘    └──────────┘    └─────┬─────┘
                                                        │
                    ┌───────────────────────────────────┘
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│                      ON-CHAIN VERIFICATION                        │
├──────────────────────────────────────────────────────────────────┤
│  EntryPoint.handleOps()                                           │
│       │                                                           │
│       ▼                                                           │
│  PasskeyAccount.validateUserOp()                                  │
│       │                                                           │
│       ▼                                                           │
│  P256Verifier.verify(message, r, s, x, y)                        │
│       │                                                           │
│       ▼                                                           │
│  RIP-7212 Precompile (0xc2b78104907F722DABAc4C69f826a522B2754De4) │
│       │                                                           │
│       ▼                                                           │
│  ✓ Signature Valid → Execute Transaction                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.0 | UI Framework |
| TypeScript | 5.8.2 | Type Safety |
| Vite | 6.4.1 | Build Tool |
| ethers.js | 6.15.0 | Blockchain Interaction |
| @simplewebauthn/browser | 13.2.2 | WebAuthn Client |
| Tailwind CSS | 3.x | Styling |
| Framer Motion | 12.23.24 | Animations |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime |
| Express.js | 4.19.2 | API Server |
| SQLite3 | 5.1.6 | Database |
| @simplewebauthn/server | 10.0.0 | WebAuthn Server |
| Helmet | 7.1.0 | Security Headers |

### Smart Contracts

| Contract | Purpose |
|----------|---------|
| PasskeyAccount.sol | P256-based smart account with backup keys |
| PasskeyAccountFactory.sol | CREATE2 deterministic deployment |
| ArcAccount.sol | Multi-key hybrid account |
| ArcPaymaster.sol | USDC gas sponsorship |
| P256Verifier.sol | RIP-7212 wrapper |
| ArcMultiSigWallet.sol | Multi-signature wallet |
| ArcMultiSigFactory.sol | Multi-sig factory |

---

## Smart Contract Addresses

### Arc Testnet (Chain ID: 5042002)

| Contract | Address |
|----------|---------|
| EntryPoint (v0.6) | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
| PasskeyAccountFactory | `0x38bdac0eA9FFA6cE260370D98Fd2b89a3257A9c8` |
| P256Verifier (Precompile) | `0xc2b78104907F722DABAc4C69f826a522B2754De4` |
| USDC | `0x3d44ABb9cfE1C53Da7174C436Ce0030D15867Cef` |
| EURC | `0x0B8829d31FD0E8D2d8EAaE9aE7868f0b9c67BB42` |

### Ethereum Sepolia (Chain ID: 11155111)

| Contract | Address |
|----------|---------|
| PasskeyAccountFactory | `0x38bdac0eA9FFA6cE260370D98Fd2b89a3257A9c8` |

---

## Project Structure

```
arcwallet/
├── components/          # React components (33 files)
│   ├── Bridge.tsx           # Cross-chain bridging UI
│   ├── SendAssets.tsx       # Token transfer UI
│   ├── SwapScreen.tsx       # Token swap interface
│   ├── History.tsx          # Transaction history
│   ├── Settings.tsx         # User settings
│   ├── MultiSigDashboard.tsx # Multi-sig management
│   ├── Faucet.tsx           # Test token faucet
│   └── ...
│
├── contexts/            # React context providers (7 files)
│   ├── PasskeyAccountContext.tsx  # Passkey wallet state
│   ├── SessionContext.tsx         # User session management
│   ├── ActivityContext.tsx        # Transaction activity
│   ├── NetworkContext.tsx         # Network selection
│   └── ...
│
├── services/            # API and blockchain services (24 files)
│   ├── passkeyAccountManager.ts   # Core passkey wallet logic
│   ├── passkeyClient.ts           # WebAuthn client
│   ├── passkeyBridgeService.ts    # Bridge operations
│   ├── tokenService.ts            # Token operations
│   ├── swapService.ts             # Token swaps
│   └── ...
│
├── hooks/               # Custom React hooks (4 files)
├── pages/               # Page components
├── config/              # Configuration files
├── utils/               # Utility functions
│
├── backend/
│   └── src/
│       ├── controllers/     # API controllers
│       ├── routes/          # Express routes (17 files)
│       │   ├── passkeys.ts      # Passkey authentication
│       │   ├── circleOtp.ts     # Email OTP
│       │   ├── bundler.ts       # UserOp submission
│       │   ├── paymaster.ts     # Gas sponsorship
│       │   ├── bridge.ts        # CCTP bridge
│       │   ├── treasury.ts      # Treasury management
│       │   └── ...
│       ├── services/        # Business logic
│       └── models/          # Database models
│
├── contracts/           # Solidity smart contracts (9 files)
│   ├── PasskeyAccount.sol
│   ├── ArcPaymaster.sol
│   ├── ArcMultiSigWallet.sol
│   └── ...
│
└── tests/               # Test suites
    └── e2e/             # Playwright E2E tests
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A modern browser with WebAuthn support

### Installation

```bash
# Clone the repository
git clone https://github.com/arcwallet/arc-wallet.git
cd arc-wallet

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend && npm install
```

### Development

```bash
# Start frontend dev server
npm run dev

# Start backend (in another terminal)
cd backend && npm run dev
```

### Build

```bash
# Build frontend
npm run build

# Build backend
cd backend && npm run build
```

### Testing

```bash
# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e

# Run contract tests
npm run test:hardhat
```

---

## Environment Variables

Create a `.env` file in the root directory:

```env
# Blockchain RPC
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
VITE_SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com

# Backend URL
VITE_BACKEND_URL=https://arcwallet-backend.onrender.com
VITE_PASSKEY_API_URL=https://arcwallet-backend.onrender.com

# Factory Addresses (CREATE2 - same on all chains)
VITE_PASSKEY_FACTORY_ADDRESS=0x38bdac0eA9FFA6cE260370D98Fd2b89a3257A9c8
```

---

## Security

### Security Model

Arc Wallet implements a **passkey-first security model**:

1. **No Seed Phrases** - Private keys never leave the device secure enclave
2. **On-Chain Verification** - P256 signatures verified on-chain, not by a centralized server
3. **Multi-Device Support** - Passkeys sync across devices via platform (iCloud Keychain, Google Password Manager)
4. **Session Isolation** - Each user session is isolated by email

### Security Measures

- **AES-256-GCM** encryption for sensitive data at rest
- **Helmet.js** for HTTP security headers
- **CSRF Protection** with double-submit cookie pattern
- **Rate Limiting** on all API endpoints
- **Input Validation** with express-validator

### Reporting Vulnerabilities

Please report security vulnerabilities to: **security@arcwallet.network**

See [SECURITY.md](./SECURITY.md) for our full security policy.

---

## API Reference

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/circle-otp/request` | Request email OTP |
| POST | `/api/circle-otp/verify` | Verify OTP |
| POST | `/passkeys/register/start` | Start passkey registration |
| POST | `/passkeys/register/finish` | Complete passkey registration |
| POST | `/passkeys/auth/start` | Start passkey authentication |
| POST | `/passkeys/auth/finish` | Complete passkey authentication |
| POST | `/passkeys/check-user` | Check if user has passkey |

### Wallet Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bundler/rpc` | Submit UserOperation |
| POST | `/api/paymaster/rpc` | Get paymaster signature |
| GET | `/api/history/:address` | Get transaction history |

### Bridge Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bridge/start` | Initiate bridge transfer |
| GET | `/api/bridge/status/:txId` | Get bridge status |

### Treasury Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/treasury/policy/:address` | Get spending policy |
| PUT | `/api/treasury/policy/:address` | Update spending policy |
| GET | `/api/treasury/transactions/:address` | Get treasury transactions |

---

## Deployment

### Frontend (Vercel)

The frontend is automatically deployed to Vercel on push to `main` branch.

### Backend (Render)

The backend is automatically deployed to Render on push to `main` branch.

### Smart Contracts

Smart contracts are deployed using Hardhat:

```bash
npx hardhat run scripts/deploy.ts --network arc-testnet
```

---

## License

Copyright © 2025 Arc Wallet. All rights reserved.

This is proprietary software. Unauthorized copying, distribution, modification, or use is strictly prohibited.

See [LICENSE](./LICENSE) for full terms.

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
  <strong>Built with passion by Arc Wallet Team</strong>
</p>

<p align="center">
  © 2025 Arc Wallet. All rights reserved.
</p>
