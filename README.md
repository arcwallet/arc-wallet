# Arc Wallet

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](./LICENSE)
[![Security](https://img.shields.io/badge/Security-Policy-blue)](./SECURITY.md)
[![Privacy](https://img.shields.io/badge/Privacy-Policy-green)](./PRIVACY.md)

A modern, self-custodial Web3 wallet built for Arc Network with support for multiple stablecoins (USDC, EURC), cross-chain bridging, and passkey authentication.

> **Note**: This is proprietary software owned by Arc Wallet. All rights reserved.

## Features

- **Multi-Token Support**: USDC and EURC stablecoins
- **Cross-Chain Bridging**: Bridge tokens between Arc Testnet and Ethereum Sepolia using Circle's CCTP
- **Passkey Authentication**: Secure WebAuthn-based authentication (no passwords needed)
- **Smart Account Integration**: ERC-4337 account abstraction support
- **TEE Privacy**: Trusted Execution Environment integration (coming soon)
- **AI Agent**: Intent-based transaction assistant powered by Gemini
- **Real-time Balances**: Live token balance updates
- **Professional UI**: Modern, responsive interface with dark mode

## Development Setup

### Prerequisites
- Node.js 18+ and npm
- A modern browser with WebAuthn support

### Installation

```bash
# Clone the repository
git clone https://github.com/arcwallet/arc-wallet.git
cd arc-wallet

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev
```

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# Required
VITE_WALLET_ENCRYPTION_SECRET=your-secret-key-min-16-chars
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network

# Optional
VITE_PASSKEY_API_URL=http://localhost:4000
VITE_API_BASE_URL=http://localhost:4000
VITE_ARC_ENTRY_POINT=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
VITE_ARC_BUNDLER_URL=https://bundler.example.com
```

See [.env.example](.env.example) for all available options.

## Backend Setup

The backend handles passkey authentication and magic link emails:

```bash
cd backend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start backend server
npm run dev
```

### Backend Environment Variables

```env
NODE_ENV=development
PORT=4000
ALLOWED_ORIGINS=http://localhost:5173
RP_ID=localhost
ORIGIN=http://localhost:5173

# Magic Link
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM_ADDRESS=noreply@arcwallet.network
EMAIL_FROM_NAME=Arc Wallet
MAGIC_LINK_BASE_URL=http://localhost:5173/auth/callback

# Security
SESSION_SECRET=your-session-secret
JWT_SECRET=your-jwt-secret

# RPC Endpoints
ARC_RPC_URL=https://rpc.testnet.arc.network
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-key
```

## Deployment

### Frontend (Vercel)

1. Connect your GitHub repository
2. Set environment variables in dashboard
3. Deploy

### Backend (Render)

1. Connect your GitHub repository
2. Set build command: `cd backend && npm install && npm run build`
3. Set start command: `cd backend && npm start`
4. Configure environment variables
5. Deploy

## Testing

```bash
# Run all tests
npm test

# E2E tests
npm run test:e2e

# Backend tests
cd backend && npm test
```

## Documentation

- [Security Policy](./SECURITY.md) - Vulnerability reporting
- [Privacy Policy](./PRIVACY.md) - Data handling and GDPR compliance
- [Architecture](./docs/architecture.md) - Technical overview
- [Passkey Integration](./docs/passkey-architecture.md) - WebAuthn details

## Security

Arc Wallet is a **self-custodial wallet**:
- You control your private keys
- We never have access to your funds
- We cannot recover your wallet if you lose your seed phrase

**Important**: Always backup your seed phrase and store it securely.

For security vulnerabilities, please see our [Security Policy](./SECURITY.md).

## Privacy

We are committed to protecting your privacy:
- No tracking or analytics by default
- Private keys encrypted locally
- GDPR and CCPA compliant

See our [Privacy Policy](./PRIVACY.md) for details.

## License

Copyright © 2024 Arc Wallet. All rights reserved.

This is proprietary software. Unauthorized copying, distribution, or use is strictly prohibited.

See [LICENSE](./LICENSE) for full terms.

## Support

- **Email**: support@arcwallet.network
- **Website**: https://arcwallet.network

## Disclaimer

**This software is provided "as is", without warranty of any kind.** Use at your own risk. Always verify transactions and never share your private keys or seed phrase.

---

© 2024 Arc Wallet. All rights reserved.
