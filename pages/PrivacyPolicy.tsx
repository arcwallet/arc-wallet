import React from 'react';
import { WaveBackground } from '../components/WaveBackground';
import arcLogo from '../assets/arclogo.png';

const PrivacyPolicy: React.FC = () => {
    const handleBack = () => {
        window.history.back();
    };

    return (
        <div className="fixed inset-0 w-full h-full flex flex-col overflow-hidden bg-slate-950">
            {/* Background Pattern */}
            <div className="absolute inset-0 z-0">
                <WaveBackground />
            </div>

            {/* Header */}
            <div className="relative z-20 p-8 flex justify-between items-center">
                <div className="flex items-center gap-4 cursor-pointer" onClick={() => window.location.href = '/'}>
                    <img src={arcLogo} alt="Arc Wallet" className="w-12 h-12 object-contain" />
                    <span className="text-xl font-light text-slate-100 tracking-tight">Arc Wallet</span>
                </div>
                <button
                    onClick={handleBack}
                    className="text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                >
                    Back
                </button>
            </div>

            {/* Content */}
            <div className="relative z-20 flex-1 overflow-y-auto px-4 py-8">
                <div className="max-w-4xl mx-auto bg-slate-900/80 border border-slate-800 rounded-2xl p-12 backdrop-blur-md shadow-2xl">
                    <h1 className="text-4xl font-light text-slate-100 mb-2">Privacy Policy</h1>
                    <p className="text-slate-500 mb-12">Last updated: December 12, 2025</p>

                    <div className="space-y-12 text-slate-300 leading-relaxed">
                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">1. Introduction</h2>
                            <p>
                                Arc Wallet ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we handle your information when you use our self-custodial wallet application built on Circle Modular Wallet SDK.
                                As a passkey-based self-custodial wallet, our core principle is that <strong>you are in control of your data and assets</strong>.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">2. Circle Modular Wallet Infrastructure</h2>
                            <p className="mb-4">
                                Arc Wallet is built on Circle's Modular Wallet SDK. Regarding data handling:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>Circle provides the underlying wallet infrastructure, including passkey authentication, bundler services, and paymaster functionality.</li>
                                <li>Circle processes data necessary to operate the wallet infrastructure in accordance with their privacy policy.</li>
                                <li>Neither Arc Wallet nor Circle has access to your passkey private key.</li>
                                <li>Your wallet is a smart contract on the blockchain - we cannot freeze, modify, or control your funds.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">3. Passkey Security</h2>
                            <p className="mb-4">
                                Arc Wallet uses WebAuthn passkeys for authentication via Circle's SDK. Regarding your passkey data:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>Your passkey <strong>private key never leaves your device</strong>. It is stored in your device's secure enclave (Touch ID, Face ID, Windows Hello, or security key).</li>
                                <li>Circle stores the <strong>public key</strong> of your passkey for signature verification.</li>
                                <li>Your wallet address is deterministically derived from your public key via CREATE2.</li>
                                <li>No seed phrases or traditional private keys are ever created or stored.</li>
                                <li>P256 (secp256r1) signatures are verified on-chain by Circle's smart contracts.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">4. Data We Collect</h2>
                            <p className="mb-4">
                                We collect minimal data necessary to provide our services:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li><strong>Email address:</strong> Used for authentication via Circle's Email OTP service and account identification.</li>
                                <li><strong>Wallet address:</strong> Your smart contract wallet address, derived from your passkey via Circle's infrastructure.</li>
                                <li><strong>Session data:</strong> Temporary session information for application functionality.</li>
                            </ul>
                            <p className="mt-4">
                                Circle may collect additional data as described in their privacy policy, including passkey public keys and credential identifiers.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">5. Data We Do NOT Collect</h2>
                            <p className="mb-4">
                                We explicitly do not collect or have access to:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>Your passkey private key (stored only in your device's secure enclave)</li>
                                <li>Seed phrases or recovery phrases (we don't use them)</li>
                                <li>Passwords (authentication is passkey-only via Circle)</li>
                                <li>Personal identification information (name, address, phone number, government ID)</li>
                                <li>Financial information beyond on-chain transaction data</li>
                                <li>Biometric data (Face ID, Touch ID data stays on your device)</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">6. On-Chain Data</h2>
                            <p>
                                Your wallet address and all transactions are recorded on the Arc Network blockchain (and other supported networks), which is public and immutable. This includes transaction amounts, recipients, timestamps, and smart contract interactions. This blockchain data is not controlled by us and is accessible to anyone. Transaction history may be displayed via block explorer services.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">7. Local Storage</h2>
                            <p className="mb-4">
                                We store some data locally in your browser for improved user experience:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>Session tokens for auto-reconnect functionality</li>
                                <li>Wallet state information (address, connection status)</li>
                                <li>Bridge transaction history (stored locally)</li>
                                <li>User preferences and settings</li>
                            </ul>
                            <p className="mt-4">
                                This local data can be cleared by clearing your browser storage. Your wallet remains accessible via your passkey regardless of local storage state.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">8. Third-Party Services</h2>
                            <p className="mb-4">
                                Our application integrates with the following third-party services:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li><strong>Circle:</strong> Modular Wallet SDK, passkey authentication, bundler services, paymaster (gas sponsorship), Email OTP, and CCTP bridge. Data is processed according to Circle's privacy policy.</li>
                                <li><strong>Arc Network:</strong> Blockchain RPC for transactions and balance queries.</li>
                                <li><strong>Block Explorers:</strong> Transaction history display (Arcscan, Etherscan).</li>
                                <li><strong>Platform Passkey Sync:</strong> Your passkeys may sync via iCloud Keychain (Apple), Google Password Manager, or similar platform services according to their privacy policies.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">9. Cross-Chain Bridge Data</h2>
                            <p className="mb-4">
                                When using the CCTP bridge feature:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>Bridge transactions are processed by Circle's CCTP infrastructure.</li>
                                <li>Circle's Iris attestation service verifies cross-chain messages.</li>
                                <li>Transaction data (amounts, addresses, chain IDs) is recorded on both source and destination blockchains.</li>
                                <li>Bridge history is stored locally in your browser for convenience.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">10. Data Security</h2>
                            <p className="mb-4">
                                We implement security measures to protect your data:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>All communications use HTTPS encryption</li>
                                <li>Circle's audited smart contract infrastructure for on-chain operations</li>
                                <li>WebAuthn standard for secure passkey authentication</li>
                                <li>ERC-4337 and ERC-6900 compliant smart contracts</li>
                                <li>No server-side storage of sensitive credentials</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">11. Data Retention</h2>
                            <p>
                                We retain your email address as long as your account is active. Session data is automatically deleted after expiration. Circle retains data according to their data retention policies. On-chain transaction history cannot be deleted as it is part of the immutable blockchain. You may contact us to request deletion of off-chain data associated with your account.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">12. Your Rights</h2>
                            <p className="mb-4">
                                Depending on your jurisdiction, you may have certain rights regarding your data:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>Right to access your personal data</li>
                                <li>Right to request deletion of off-chain data</li>
                                <li>Right to data portability</li>
                                <li>Right to withdraw consent</li>
                            </ul>
                            <p className="mt-4">
                                Note: On-chain data and data processed by Circle are subject to their respective policies and blockchain immutability constraints.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">13. Children's Privacy</h2>
                            <p>
                                Arc Wallet is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">14. Changes to This Policy</h2>
                            <p>
                                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">15. Contact Us</h2>
                            <p>
                                If you have any questions about this Privacy Policy, please contact us at <a href="mailto:support@arcwallet.network" className="text-blue-400 hover:text-blue-300">support@arcwallet.network</a>.
                            </p>
                            <p className="mt-4">
                                For Circle's privacy practices, please refer to <a href="https://www.circle.com/legal/privacy-policy" className="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer">Circle's Privacy Policy</a>.
                            </p>
                        </section>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto mt-12 text-center text-slate-500 text-sm">
                    © 2025 Arc Wallet. All rights reserved. Built on Circle Modular Wallet.
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
