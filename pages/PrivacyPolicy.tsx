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
                    <p className="text-slate-500 mb-12">Last updated: December 7, 2025</p>

                    <div className="space-y-12 text-slate-300 leading-relaxed">
                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">1. Introduction</h2>
                            <p>
                                Arc Wallet ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we handle your information when you use our self-custodial wallet application.
                                As a passkey-based self-custodial wallet, our core principle is that <strong>you are in control of your data and assets</strong>.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">2. Passkey Security</h2>
                            <p className="mb-4">
                                Arc Wallet uses WebAuthn passkeys for authentication. Regarding your passkey data:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>Your passkey <strong>private key never leaves your device</strong>. It is stored in your device's secure enclave (Touch ID, Face ID, Windows Hello, or security key).</li>
                                <li>We only store the <strong>public key coordinates</strong> (x, y) of your passkey for signature verification.</li>
                                <li>Your wallet address is deterministically derived from your public key - we cannot modify or access your funds.</li>
                                <li>No seed phrases or traditional private keys are ever created or stored.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">3. Data We Collect</h2>
                            <p className="mb-4">
                                We collect minimal data necessary to provide our services:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li><strong>Email address:</strong> Used for authentication via OTP (One-Time Password) and account identification.</li>
                                <li><strong>Passkey public key:</strong> The x,y coordinates of your P256 public key, used to verify signatures and derive your wallet address.</li>
                                <li><strong>Credential ID:</strong> A unique identifier for your passkey, used to retrieve the correct passkey during authentication.</li>
                                <li><strong>Wallet address:</strong> Your smart contract wallet address, derived from your passkey's public key.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">4. Data We Do NOT Collect</h2>
                            <p className="mb-4">
                                We explicitly do not collect or have access to:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>Your passkey private key (stored only in your device's secure enclave)</li>
                                <li>Seed phrases or recovery phrases (we don't use them)</li>
                                <li>Passwords (authentication is passkey-only)</li>
                                <li>Personal identification information (name, address, phone number, government ID)</li>
                                <li>Financial information beyond on-chain transaction data</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">5. On-Chain Data</h2>
                            <p>
                                Your wallet address and all transactions are recorded on the Arc Network blockchain, which is public and immutable. This includes transaction amounts, recipients, and timestamps. This blockchain data is not controlled by us and is accessible to anyone. We use Blockscout to display your transaction history.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">6. Local Storage</h2>
                            <p className="mb-4">
                                We store some data locally in your browser for improved user experience:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>Session tokens (expires after 15 minutes of inactivity)</li>
                                <li>Passkey credential references (public data only)</li>
                                <li>User preferences and settings</li>
                            </ul>
                            <p className="mt-4">
                                This local data can be cleared by clearing your browser storage. Your wallet remains accessible via your passkey regardless of local storage state.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">7. Third-Party Services</h2>
                            <p className="mb-4">
                                Our application interacts with the following third-party services:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li><strong>Arc Network RPC:</strong> Blockchain node access for transactions and balance queries.</li>
                                <li><strong>Blockscout:</strong> Transaction history and block explorer services.</li>
                                <li><strong>Circle:</strong> Email OTP authentication and CCTP bridge services.</li>
                                <li><strong>Platform Passkey Sync:</strong> Your passkeys may sync via iCloud Keychain, Google Password Manager, or similar platform services according to their privacy policies.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">8. Data Security</h2>
                            <p className="mb-4">
                                We implement security measures to protect your data:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>All API communications use HTTPS encryption</li>
                                <li>Rate limiting on authentication endpoints</li>
                                <li>Security headers via Helmet.js</li>
                                <li>On-chain signature verification via RIP-7212 precompile</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">9. Data Retention</h2>
                            <p>
                                We retain your email and passkey public key data as long as your account is active. Session data is automatically deleted after expiration. You may request deletion of your account data by contacting us, though on-chain transaction history cannot be deleted as it is part of the immutable blockchain.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">10. Changes to This Policy</h2>
                            <p>
                                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">11. Contact Us</h2>
                            <p>
                                If you have any questions about this Privacy Policy, please contact us at <a href="mailto:support@arcwallet.network" className="text-blue-400 hover:text-blue-300">support@arcwallet.network</a>.
                            </p>
                        </section>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto mt-12 text-center text-slate-500 text-sm">
                    © 2025 Arc Wallet. All rights reserved.
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
