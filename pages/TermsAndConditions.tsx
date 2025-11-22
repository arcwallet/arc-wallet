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
                    <p className="text-slate-500 mb-12">Last updated: November 23, 2025</p>

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
                                Arc Wallet is a self-custodial wallet. You acknowledge and agree that:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>You are solely responsible for the safety and management of your private keys and seed phrases.</li>
                                <li>We cannot recover your wallet or funds if you lose your private keys or seed phrase.</li>
                                <li>We do not have control over or access to your digital assets.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">3. Risks of Digital Assets</h2>
                            <p>
                                You acknowledge the inherent risks associated with cryptographic systems and blockchain-based networks, including usage of private keys, volatility of price, and potential system failures. You agree that you are using the Application at your own risk.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">4. Prohibited Activities</h2>
                            <p>
                                You agree not to use the Application for any illegal purpose or in any way that violates these Terms. This includes, but is not limited to, money laundering, financing of terrorism, or engaging in fraudulent activities.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">5. Limitation of Liability</h2>
                            <p>
                                To the maximum extent permitted by law, Arc Wallet shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Application.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">6. Governing Law</h2>
                            <p>
                                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Arc Wallet is registered, without regard to its conflict of law provisions.
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
