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
| Gas Payment | User pays | Sponsorable via Paymaster |
| Recovery | Seed phrase backup | Multi-device passkey sync |

---

## Features

### Core Wallet Features

- **Passkey-First Authentication** - No seed phrases, no passwords. Your passkey IS your wallet key.
- **Smart Contract Accounts** - ERC-4337 compliant accounts with native P256 signature support
- **Multi-Token Support** - Native ARC, USDC, EURC, and custom token support
- **Real-Time Balances** - Live balance updates with price feeds

### Advanced Features

- **Cross-Chain Bridging** - Circle CCTP integration for USDC/EURC bridging between Arc Network and Ethereum
- **Gas Sponsorship** - Paymaster integration for gasless transactions
- **Batch Operations** - Execute multiple transactions in a single UserOperation
- **Multi-Signature Wallets** - Create and manage multi-sig accounts with approval workflows
- **AI Transaction Assistant** - Natural language transaction intent parsing powered by Gemini

### Security Features

- **On-Chain P256 Verification** - Signatures verified directly on-chain via RIP-7212 precompile
- **No Private Key Storage** - Keys never leave device secure enclave
- **Session Management** - 15-minute session persistence with automatic re-authentication
- **Encrypted Backups** - AES-256-GCM encrypted wallet backup and restore

### Enterprise Features

- **Device Management** - Manage multiple passkeys across devices
- **Webhook Integration** - Real-time transaction notifications
- **Push Notifications** - Web push for transaction updates
- **Address Book** - Save and manage frequent addresses

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                               │
├─────────────────────────────────────────────────────────────────────┤
│  React Frontend          │  @arc/wallet-sdk         │  WebAuthn     │
│  (TypeScript + Vite)     │  (NPM Package)           │  (Passkeys)   │
└──────────┬───────────────┴──────────┬───────────────┴───────┬───────┘
           │                          │                       │
           ▼                          ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           BACKEND LAYER                              │
├─────────────────────────────────────────────────────────────────────┤
│  Express.js API Server                                               │
│  ├── Authentication (Circle OTP + WebAuthn)                          │
│  ├── Bundler Service (UserOperation submission)                      │
│  ├── Paymaster Service (Gas sponsorship)                             │
│  ├── Bridge Service (Circle CCTP)                                    │
│  └── Indexer Service (Transaction history)                           │
└──────────┬──────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BLOCKCHAIN LAYER                             │
├─────────────────────────────────────────────────────────────────────┤
│  Arc Network (Chain ID: 5042002)                                     │
│  ├── PasskeyAccount.sol     → P256 signature verification            │
│  ├── ArcAccount.sol         → Multi-key smart account                │
│  ├── ArcPaymaster.sol       → Gas sponsorship                        │
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
│  4. Smart contract address derived from public key                │
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
| Vite | 6.2.0 | Build Tool |
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
| PasskeyAccount.sol | P256-based smart account |
| ArcAccount.sol | Multi-key hybrid account |
| ArcPaymaster.sol | Gas sponsorship |
| P256Verifier.sol | RIP-7212 wrapper |
| ArcMultiSigWallet.sol | Multi-signature wallet |

### SDK

| Package | Purpose |
|---------|---------|
| @arc/wallet-sdk | Reusable wallet SDK for integration |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/ArcWallet/arcwallet.git
cd arcwallet

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install SDK dependencies
cd packages/sdk && npm install && cd ../..
```

### Environment Setup

Create `.env` file in root directory:

```env
# Network Configuration
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
VITE_CHAIN_ID=5042002

# Backend
VITE_BACKEND_URL=http://localhost:3001
VITE_PASSKEY_API_URL=http://localhost:3001

# Circle Integration (for bridging)
VITE_CIRCLE_API_KEY=your_circle_api_key

# Encryption
VITE_WALLET_ENCRYPTION_SECRET=your_encryption_secret_min_16_chars
```

Create `backend/.env`:

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DB_PATH=./data/arcwallet.db
DB_ENCRYPTION_KEY=your_32_char_encryption_key_here

# Frontend
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,https://app.arcwallet.network

# Session
SESSION_SECRET=your_session_secret_min_32_chars

# Email (SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_FROM_ADDRESS=noreply@arcwallet.network
```

### Running Locally

```bash
# Terminal 1: Start backend
cd backend && npm run dev

# Terminal 2: Start frontend
npm run dev
```

Open `http://localhost:3000` in your browser.

### Building for Production

```bash
# Build frontend
npm run build

# Build backend
cd backend && npm run build
```

---

## Smart Contract Addresses

### Arc Testnet (Chain ID: 5042002)

| Contract | Address |
|----------|---------|
| EntryPoint (v0.6) | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
| PasskeyAccountFactory | `0x4C16f269dE57B846309a8Eb3591ddb394aBba488` |
| P256Verifier (Precompile) | `0xc2b78104907F722DABAc4C69f826a522B2754De4` |
| USDC | `0x3d44ABb9cfE1C53Da7174C436Ce0030D15867Cef` |
| EURC | `0x0B8829d31FD0E8D2d8EAaE9aE7868f0b9c67BB42` |

---

## Project Structure

```
arcwallet/
├── components/          # React components (32 files)
├── contexts/            # React context providers (8 files)
├── hooks/               # Custom React hooks
├── services/            # API and blockchain services (28 files)
├── pages/               # Page components
├── config/              # Configuration files
├── utils/               # Utility functions
├── assets/              # Static assets
├── styles/              # CSS styles
│
├── backend/
│   ├── src/
│   │   ├── controllers/ # API controllers
│   │   ├── routes/      # Express routes (12 files)
│   │   ├── services/    # Business logic (55+ files)
│   │   ├── middleware/  # Security middleware
│   │   ├── models/      # Database models
│   │   └── utils/       # Backend utilities
│   └── test/            # Backend tests
│
├── contracts/           # Solidity smart contracts (9 files)
├── test/                # Contract tests
│
├── packages/
│   └── sdk/             # @arc/wallet-sdk package
│
└── scripts/             # Build and deployment scripts
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

## Documentation

| Document | Description |
|----------|-------------|
| [SECURITY.md](./SECURITY.md) | Security policy and vulnerability reporting |
| [PRIVACY.md](./PRIVACY.md) | Privacy policy and GDPR compliance |
| [TERMS.md](./TERMS.md) | Terms of service |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Contribution guidelines |

---

## API Reference

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/circle-otp/request` | Request email OTP |
| POST | `/api/circle-otp/verify` | Verify OTP |
| POST | `/api/passkeys/register/start` | Start passkey registration |
| POST | `/api/passkeys/register/finish` | Complete passkey registration |
| POST | `/api/passkeys/auth/start` | Start passkey authentication |
| POST | `/api/passkeys/auth/finish` | Complete passkey authentication |

### Wallet Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/wallet/balance` | Get wallet balance |
| POST | `/api/bundler/rpc` | Submit UserOperation |
| POST | `/api/paymaster/rpc` | Get paymaster signature |

### Bridge Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bridge/start` | Initiate bridge transfer |
| GET | `/api/bridge/status/:txId` | Get bridge status |
| GET | `/api/bridge/history/:userId` | Get bridge history |

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
  <strong>Built with ❤️ by Arc Wallet Team</strong>
</p>

<p align="center">
  © 2025 Arc Wallet. All rights reserved.
</p>
