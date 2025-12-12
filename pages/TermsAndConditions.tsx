import React from 'react';
import { WaveBackground } from '../components/WaveBackground';
import arcLogo from '../assets/arclogo.png';

const TermsAndConditions: React.FC = () => {
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
                    <h1 className="text-4xl font-light text-slate-100 mb-2">Terms & Conditions</h1>
                    <p className="text-slate-500 mb-12">Last updated: December 12, 2025</p>

                    <div className="space-y-12 text-slate-300 leading-relaxed">
                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">1. Acceptance of Terms</h2>
                            <p>
                                By accessing or using Arc Wallet ("the Application"), you agree to be bound by these Terms & Conditions. If you do not agree to these terms, please do not use the Application.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">2. Self-Custodial Nature</h2>
                            <p className="mb-4">
                                Arc Wallet is a self-custodial smart contract wallet built on Circle Modular Wallet SDK, using passkey (WebAuthn) authentication. You acknowledge and agree that:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>Your passkey is your sole method of wallet authentication. No seed phrases or private keys are stored by Arc Wallet.</li>
                                <li>Your passkey private key is securely stored in your device's secure enclave (Touch ID, Face ID, Windows Hello, or security key) and never leaves your device.</li>
                                <li>We cannot recover your wallet if you lose access to all devices with your registered passkeys.</li>
                                <li>We do not have control over or access to your digital assets.</li>
                                <li>Your smart contract wallet (ERC-4337/ERC-6900 compliant) is managed by Circle's Modular Wallet infrastructure.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">3. Circle Modular Wallet Infrastructure</h2>
                            <p className="mb-4">
                                Arc Wallet is built on Circle's Modular Wallet SDK. You understand and agree that:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>Your wallet is a Modular Smart Contract Account (MSCA) compliant with ERC-4337 and ERC-6900 standards.</li>
                                <li>Circle provides the underlying wallet infrastructure, bundler services, and paymaster functionality.</li>
                                <li>Circle's infrastructure is used to process UserOperations and manage gas sponsorship.</li>
                                <li>You are subject to Circle's Terms of Service in addition to these terms.</li>
                                <li>Circle does not have access to your passkey private key or the ability to control your funds.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">4. Passkey Authentication</h2>
                            <p className="mb-4">
                                Arc Wallet uses WebAuthn passkeys for authentication via Circle's passkey transport. You understand that:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>Passkeys are cryptographic credentials (P256/secp256r1) stored in your device's secure hardware.</li>
                                <li>Signatures are verified on-chain by Circle's smart contract infrastructure.</li>
                                <li>Passkeys may sync across devices via platform services (iCloud Keychain, Google Password Manager).</li>
                                <li>You are responsible for maintaining access to devices with your registered passkeys.</li>
                                <li>Multiple passkey owners can be added for enterprise multi-signature functionality.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">5. Smart Contract Accounts (ERC-4337 & ERC-6900)</h2>
                            <p className="mb-4">
                                Your wallet is a smart contract account. You acknowledge that:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>Your account is deployed on Arc Network (Chain ID: 5042002) and potentially other supported networks.</li>
                                <li>Transactions are submitted as UserOperations and processed through the ERC-4337 EntryPoint contract.</li>
                                <li>Gas fees are paid in USDC (native gas on Arc Network) via Circle's Paymaster.</li>
                                <li>Your account supports ERC-6900 modular plugins, including weighted multi-signature functionality.</li>
                                <li>Smart contract functionality is subject to blockchain network conditions and limitations.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">6. Enterprise Multi-Signature (ERC-6900)</h2>
                            <p className="mb-4">
                                Arc Wallet supports enterprise multi-signature functionality via Circle's WeightedWebauthnMultisigPlugin. You understand that:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>Multiple passkey owners can be added with different signature weights.</li>
                                <li>Transactions require signatures meeting the configured threshold weight.</li>
                                <li>Multi-sig configuration changes are executed on-chain and are irreversible.</li>
                                <li>You are responsible for proper configuration of multi-sig parameters.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">7. Cross-Chain Bridge Services (Circle CCTP)</h2>
                            <p className="mb-4">
                                Arc Wallet provides cross-chain USDC bridging via Circle's Cross-Chain Transfer Protocol (CCTP V2). You understand that:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>Bridge transfers use Circle's native burn-and-mint mechanism for USDC.</li>
                                <li>Standard transfers require Circle attestation and may take 15-20 minutes.</li>
                                <li>Fast transfers (where supported) may complete in approximately 30 seconds.</li>
                                <li>Bridge operations are subject to Circle's CCTP terms and conditions.</li>
                                <li>We are not responsible for delays or failures in Circle's attestation services.</li>
                                <li>Destination chain gas fees may apply and are your responsibility.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">8. Risks of Digital Assets</h2>
                            <p>
                                You acknowledge the inherent risks associated with cryptographic systems and blockchain-based networks, including smart contract vulnerabilities, network congestion, protocol changes, and potential system failures. You agree that you are using the Application at your own risk. Digital asset prices are highly volatile and you may lose all or part of your holdings.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">9. Prohibited Activities</h2>
                            <p>
                                You agree not to use the Application for any illegal purpose or in any way that violates these Terms. This includes, but is not limited to, money laundering, financing of terrorism, sanctions evasion, or engaging in fraudulent activities.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">10. Limitation of Liability</h2>
                            <p>
                                To the maximum extent permitted by law, Arc Wallet and Circle shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Application, including but not limited to losses resulting from smart contract vulnerabilities, passkey loss, bridge failures, or network failures.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">11. Service Availability</h2>
                            <p>
                                We strive to maintain service availability but do not guarantee uninterrupted access. The Application may be temporarily unavailable due to maintenance, upgrades, Circle infrastructure issues, or circumstances beyond our control. Your smart contract wallet remains accessible directly on the blockchain regardless of Application availability.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">12. Third-Party Services</h2>
                            <p className="mb-4">
                                Arc Wallet integrates with and relies on third-party services:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li><strong>Circle:</strong> Modular Wallet SDK, bundler, paymaster, CCTP bridge, and email OTP authentication.</li>
                                <li><strong>Arc Network:</strong> Blockchain infrastructure and USDC as native gas.</li>
                                <li><strong>Platform Providers:</strong> Apple (iCloud Keychain), Google (Password Manager) for passkey sync.</li>
                            </ul>
                            <p className="mt-4">
                                You agree to comply with the terms of service of these third-party providers.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">13. Governing Law</h2>
                            <p>
                                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Arc Wallet is registered, without regard to its conflict of law provisions.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">14. Contact</h2>
                            <p>
                                If you have any questions about these Terms & Conditions, please contact us at <a href="mailto:support@arcwallet.network" className="text-blue-400 hover:text-blue-300">support@arcwallet.network</a>.
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

export default TermsAndConditions;
