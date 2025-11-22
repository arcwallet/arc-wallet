# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability, please send an email to **security@example.com** with the following information:

- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability, including how an attacker might exploit it

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours.
- **Investigation**: We will investigate and validate the vulnerability within 7 days.
- **Resolution**: We will work on a fix and release a security patch as soon as possible.
- **Disclosure**: We follow responsible disclosure practices and will coordinate with you on public disclosure timing.

## Security Best Practices

When using Arc Wallet:

1. **Never share your private keys or seed phrases** with anyone
2. **Use strong, unique passwords** for wallet encryption
3. **Enable passkey authentication** for additional security
4. **Keep your software updated** to the latest version
5. **Verify all transaction details** before confirming
6. **Use hardware wallets** for large amounts when possible

## Known Security Considerations

### Wallet Storage
- Private keys are encrypted using AES-256-GCM
- Encryption keys are derived from user passwords using PBKDF2
- Encrypted wallets are stored in browser localStorage

### Network Security
- All API communications use HTTPS
- WebAuthn/Passkey authentication for enhanced security
- Session tokens are httpOnly and secure cookies

### Smart Contract Security
- Smart contracts should be audited before mainnet deployment
- Use testnet for development and testing
- Verify contract addresses before interacting

## Responsible Disclosure

We appreciate the security research community's efforts to responsibly disclose vulnerabilities. If you report a valid security issue, we will:

- Acknowledge your contribution in our security advisories (if you wish)
- Work with you to understand and resolve the issue
- Keep you informed about the progress of the fix

Thank you for helping keep Arc Wallet and our users safe!
