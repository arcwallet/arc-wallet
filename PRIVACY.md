# Privacy Policy

**Last Updated: November 23, 2025**

## Introduction

Arc Wallet ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we handle information when you use the Arc Wallet SDK and related services.

## Our Privacy-First Approach

Arc Wallet is designed with privacy as a core principle:

- **Self-Custodial**: You maintain complete control of your wallet and private keys
- **No Seed Phrases**: We never generate, store, or have access to seed phrases
- **Local Storage**: All sensitive data is stored locally on your device
- **No Account Required**: No email, phone number, or personal information needed
- **Minimal Data Collection**: We collect only what's necessary for the service to function

## Information We Do NOT Collect

We explicitly **DO NOT** collect:

- ❌ Seed phrases or mnemonic phrases
- ❌ Private keys
- ❌ Wallet passwords or PINs
- ❌ Transaction history
- ❌ Wallet balances
- ❌ Personal identification information (unless voluntarily provided)
- ❌ Browsing history
- ❌ Location data
- ❌ Device identifiers (beyond what's necessary for WebAuthn)

## Information Stored Locally on Your Device

The following information is stored **locally** on your device and never transmitted to our servers:

### 1. Passkey Credentials
- **What**: WebAuthn passkey credentials
- **Where**: Device Secure Enclave (iOS Keychain, Android Keystore, or browser credential manager)
- **Purpose**: Authenticate you to unlock your wallet
- **Access**: Only you can access via biometric authentication

### 2. Encrypted Private Keys
- **What**: Your Ethereum private keys, encrypted with non-extractable master keys
- **Where**: Browser IndexedDB
- **Purpose**: Sign transactions
- **Encryption**: Protected by WebCrypto non-extractable AES-GCM keys
- **Access**: Only accessible after passkey authentication

### 3. Wallet Metadata
- **What**: Wallet address, creation date, public key
- **Where**: Browser IndexedDB
- **Purpose**: Display wallet information
- **Sensitivity**: Public information only

## Information We May Collect

### Optional Backend Services

If you choose to use our optional backend services (e.g., passkey registration backup), we may collect:

1. **Passkey Registration Data**
   - Passkey public key (not the private credential)
   - User identifier (email or username, if provided)
   - Registration timestamp
   - **Purpose**: Enable passkey recovery across devices
   - **Retention**: Until you delete your account

2. **Usage Analytics** (Optional, Opt-In Only)
   - SDK version
   - Network interactions (RPC calls)
   - Error logs (anonymized)
   - **Purpose**: Improve SDK performance and reliability
   - **Opt-Out**: Available in SDK configuration

### Blockchain Transactions

When you send transactions:

- **Public Information**: All blockchain transactions are public and permanently recorded on the blockchain
- **What's Public**: Wallet addresses, transaction amounts, timestamps, smart contract interactions
- **What's Private**: Your identity is not linked to your wallet address unless you choose to reveal it

## Third-Party Services

### Circle CCTP (Cross-Chain Transfer Protocol)

When using CCTP for cross-chain transfers:

- **Service**: Circle's attestation service
- **Data Shared**: Transaction hash, message hash
- **Purpose**: Verify cross-chain transfers
- **Privacy**: No personal information shared
- **Policy**: [Circle Privacy Policy](https://www.circle.com/en/legal/privacy-policy)

### RPC Providers

When interacting with blockchains:

- **Service**: RPC node providers (configurable)
- **Data Shared**: Transaction data, wallet addresses (public blockchain data)
- **Purpose**: Submit transactions to blockchain
- **Privacy**: Use your own RPC node for maximum privacy

### Paymaster Services (Optional)

When using gasless transactions:

- **Service**: Paymaster service (if enabled)
- **Data Shared**: UserOperation data, wallet address
- **Purpose**: Sponsor transaction gas fees
- **Privacy**: Only transaction-related data, no personal information

## Data Security

### Security Measures

1. **Non-Extractable Keys**
   - Master encryption keys cannot be exported from WebCrypto
   - Keys never leave the browser's cryptographic module

2. **Hardware-Backed Security**
   - Passkeys stored in device Secure Enclave when available
   - Biometric authentication required for access

3. **Encryption**
   - All private keys encrypted with AES-GCM 256-bit encryption
   - Unique encryption keys per wallet

4. **Browser Sandbox**
   - All cryptographic operations isolated in browser sandbox
   - Protection against memory extraction attacks

5. **No Server-Side Keys**
   - We never have access to your private keys
   - Self-custodial architecture ensures you're always in control

## Your Rights

You have the right to:

1. **Access**: View all data stored locally in your browser
2. **Delete**: Permanently delete your wallet and all associated data
3. **Export**: Export your wallet (public information only)
4. **Opt-Out**: Disable optional analytics and backend services
5. **Control**: Full control over your private keys and transactions

## Data Retention

### Local Data
- **Retention**: Indefinitely, until you delete your wallet
- **Deletion**: Permanent and immediate when you delete your wallet

### Backend Data (if using optional services)
- **Retention**: Until you request deletion
- **Deletion**: Within 30 days of deletion request

## Children's Privacy

Arc Wallet is not intended for users under 18 years of age. We do not knowingly collect information from children.

## International Users

Arc Wallet is designed to work globally. Your data is stored locally on your device, regardless of your location.

If you use our optional backend services:
- Data may be processed in the United States
- We comply with applicable data protection laws
- GDPR rights apply to EU users

## Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of any material changes by:

- Updating the "Last Updated" date
- Displaying a notice in the SDK
- Sending an email (if you've provided one)

Continued use of Arc Wallet after changes constitutes acceptance of the updated policy.

## Open Source

Arc Wallet SDK is open source. You can:

- Review our code on [GitHub](https://github.com/arcwallet/arc-wallet)
- Verify our privacy claims
- Contribute to improvements
- Self-host if desired

## Contact Us

If you have questions about this Privacy Policy:

- **Email**: privacy@arc.network
- **GitHub**: [github.com/arcwallet/arc-wallet/issues](https://github.com/arcwallet/arc-wallet/issues)
- **Discord**: [discord.gg/arcnetwork](https://discord.gg/arcnetwork)

## Transparency

We believe in radical transparency:

- ✅ Open source code
- ✅ No hidden data collection
- ✅ Clear documentation
- ✅ Self-custodial design
- ✅ Privacy by default

**Your privacy is not a feature—it's a fundamental right.**

---

**Arc Wallet - Privacy-First, Self-Custodial, Open Source**
