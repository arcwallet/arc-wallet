import React from 'react';
import { WaveBackground } from '../components/WaveBackground';
import arcLogo from '../assets/arclogo.png';
import { ArrowUpRightIcon } from '../components/Icons';

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
                    <p className="text-slate-500 mb-12">Last updated: November 23, 2025</p>

                    <div className="space-y-12 text-slate-300 leading-relaxed">
                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">1. Introduction</h2>
                            <p>
                                Arc Wallet ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we handle your information when you use our self-custodial wallet application.
                                As a self-custodial wallet, our core principle is that <strong>you are in control of your data</strong>.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">2. Data Collection</h2>
                            <p className="mb-4">
                                We are a self-custodial wallet provider. This means:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>We do <strong>not</strong> collect, store, or have access to your private keys, seed phrases, or passwords.</li>
                                <li>We do <strong>not</strong> collect personal identification information (PII) such as your name, address, or phone number.</li>
                                <li>Your wallet addresses and transaction history are public on the blockchain but are not linked to your personal identity by us.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">3. Local Storage</h2>
                            <p>
                                Your private keys and encrypted wallet data are stored locally on your device. This information never leaves your device and is encrypted using industry-standard encryption protocols. You are solely responsible for keeping your device secure and backing up your seed phrase.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">4. Third-Party Services</h2>
                            <p>
                                Our application may interact with third-party services, such as blockchain nodes (RPC providers) and decentralized applications (dApps). When you interact with these services, they may collect your IP address and wallet address in accordance with their own privacy policies.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">5. Changes to This Policy</h2>
                            <p>
                                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-medium text-white mb-4">6. Contact Us</h2>
                            <p>
                                If you have any questions about this Privacy Policy, please contact us at support@arcwallet.com.
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
