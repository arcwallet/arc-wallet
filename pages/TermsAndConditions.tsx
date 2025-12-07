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
                    <p className="text-slate-500 mb-12">Last updated: December 7, 2025</p>

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
                                Arc Wallet is a self-custodial smart contract wallet using passkey (WebAuthn) authentication. You acknowledge and agree that:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>Your passkey is your sole method of wallet authentication. No seed phrases or private keys are stored by Arc Wallet.</li>
                                <li>Your passkey private key is securely stored in your device's secure enclave (Touch ID, Face ID, or security key) and never leaves your device.</li>
                                <li>We cannot recover your wallet if you lose access to all devices with your registered passkeys.</li>
                                <li>We do not have control over or access to your digital assets.</li>
                                <li>Your smart contract wallet address is deterministically derived from your passkey's public key.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">3. Passkey Authentication</h2>
                            <p className="mb-4">
                                Arc Wallet uses WebAuthn passkeys for authentication. You understand that:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>Passkeys are cryptographic credentials stored in your device's secure hardware.</li>
                                <li>P256 (secp256r1) signatures are verified on-chain via the RIP-7212 precompile.</li>
                                <li>You can register multiple passkeys across different devices for account recovery.</li>
                                <li>Passkeys may sync across devices via platform services (iCloud Keychain, Google Password Manager).</li>
                                <li>You are responsible for maintaining access to devices with your registered passkeys.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">4. Smart Contract Accounts</h2>
                            <p className="mb-4">
                                Your wallet is an ERC-4337 compliant smart contract account. You acknowledge that:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>Your account is deployed on Arc Network (Chain ID: 5042002).</li>
                                <li>Transactions are submitted as UserOperations and processed through the EntryPoint contract.</li>
                                <li>Gas fees may be sponsored via our Paymaster service, payable in USDC.</li>
                                <li>Smart contract functionality is subject to blockchain network conditions and limitations.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">5. Risks of Digital Assets</h2>
                            <p>
                                You acknowledge the inherent risks associated with cryptographic systems and blockchain-based networks, including smart contract vulnerabilities, network congestion, protocol changes, and potential system failures. You agree that you are using the Application at your own risk. Digital asset prices are highly volatile and you may lose all or part of your holdings.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">6. Bridge Services</h2>
                            <p className="mb-4">
                                Arc Wallet provides cross-chain bridging services via Circle CCTP. You understand that:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>Bridge transactions may take time to complete depending on network conditions.</li>
                                <li>Bridge operations are subject to Circle's terms and conditions.</li>
                                <li>We are not responsible for delays or failures in third-party bridge services.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">7. Prohibited Activities</h2>
                            <p>
                                You agree not to use the Application for any illegal purpose or in any way that violates these Terms. This includes, but is not limited to, money laundering, financing of terrorism, sanctions evasion, or engaging in fraudulent activities.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">8. Limitation of Liability</h2>
                            <p>
                                To the maximum extent permitted by law, Arc Wallet shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Application, including but not limited to losses resulting from smart contract vulnerabilities, passkey loss, or network failures.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">9. Service Availability</h2>
                            <p>
                                We strive to maintain service availability but do not guarantee uninterrupted access. The Application may be temporarily unavailable due to maintenance, upgrades, or circumstances beyond our control. Your smart contract wallet remains accessible directly on the blockchain regardless of Application availability.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">10. Governing Law</h2>
                            <p>
                                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Arc Wallet is registered, without regard to its conflict of law provisions.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">11. Contact</h2>
                            <p>
                                If you have any questions about these Terms & Conditions, please contact us at <a href="mailto:support@arcwallet.network" className="text-blue-400 hover:text-blue-300">support@arcwallet.network</a>.
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

export default TermsAndConditions;
