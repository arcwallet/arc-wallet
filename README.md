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

## Live Application

Visit: **https://app.arcwallet.network**

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

## Technology Stack

Built with:
- React + TypeScript
- Vite
- Tailwind CSS
- ethers.js
- Circle CCTP
- WebAuthn/Passkeys
- ERC-4337 Account Abstraction

## License

Copyright © 2025 Arc Wallet. All rights reserved.

This is proprietary software. Unauthorized copying, distribution, or use is strictly prohibited.

See [LICENSE](./LICENSE) for full terms.

## Support

- **Email**: support@arcwallet.network
- **Website**: https://arcwallet.network

## Disclaimer

**This software is provided "as is", without warranty of any kind.** Use at your own risk. Always verify transactions and never share your private keys or seed phrase.

Arc Wallet is not responsible for any loss of funds due to user error, security breaches, or technical issues.

---

© 2025 Arc Wallet. All rights reserved.
