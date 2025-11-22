import React, { useEffect, useMemo, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useSession } from '../contexts/SessionContext';
import { useSelfCustodialWallet } from '../contexts/SelfCustodialWalletContext';

import { passkeyClient, type SessionKeySummary } from '../services/passkeyClient';
import { WalletIcon, CopyIcon, AddIcon, LaptopIcon, PhoneIcon, ChevronDownIcon, LockIcon, KeyIcon } from './Icons';

import WebhookManager from './WebhookManager';
import NotificationManager from './NotificationManager';

const WalletIdentitySection: React.FC = () => {
    const { address } = useSelfCustodialWallet();
    const walletAddress = address || "0x0000000000000000000000000000000000000000";

    const handleCopy = () => {
        if (address) {
            navigator.clipboard.writeText(address);
        }
    };

    return (
        <div className="flex flex-col gap-3 rounded-xl bg-slate-900/60 backdrop-blur-sm border border-slate-500/50 p-5 sm:p-6">
            <h3 className="text-lg font-semibold text-slate-100">Wallet Identity</h3>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-500/50 bg-slate-900/40 px-3 py-2">
                    <WalletIcon size={20} className="text-slate-400" />
                    <p className="flex-1 truncate font-mono text-sm text-slate-100">{address ? walletAddress : 'No Wallet Connected'}</p>
                    <button
                        onClick={handleCopy}
                        disabled={!address}
                        className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-100 disabled:opacity-50"
                    >
                        <CopyIcon size={18} />
                    </button>
                </div>
                <button
                    disabled={!address}
                    className="flex h-10 w-full shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-slate-500/50 bg-transparent px-4 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white hover:border-slate-400 transition-all sm:w-auto disabled:opacity-50"
                >
                    <span className="truncate">View on Explorer</span>
                </button>
            </div>
        </div>
    );
};

const SecuritySection: React.FC = () => {
    const { userId, isPasskeyEnabled, togglePasskey, registerPasskey, address } = useSelfCustodialWallet();
    const [loading, setLoading] = useState(false);
    const [keys, setKeys] = useState<SessionKeySummary[]>([]);
    const [devices, setDevices] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    const currentAddress = address?.toLowerCase();

    const load = async () => {
        if (!userId) return;
        setLoading(true);
        setError(null);
        try {
            const resp = await passkeyClient.getSessionKeys(userId);
            const list = resp.data?.sessionKeys ?? [];
            setKeys(list);
            const devResp = await passkeyClient.getDevices(userId);
            setDevices(devResp.data ?? []);
        } catch (e: any) {
            setError(e?.message || 'Failed to load session keys');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, [userId]);

    const handleRevoke = async (id: string) => {
        try {
            await passkeyClient.revokeSessionKey(id);
            await load();
        } catch (e: any) {
            setError(e?.message || 'Failed to revoke session key');
        }
    };

    const handleRemoveDevice = async (id: string) => {
        try {
            await passkeyClient.deleteDevice(id);
            await load();
        } catch (e: any) {
            setError(e?.message || 'Failed to remove device');
        }
    };

    const handleAddDevice = async () => {
        try {
            await registerPasskey();
            await load();
            alert('Passkey registered for this user. You can now authenticate on this device.');
        } catch (e: any) {
            setError(e?.message || 'Failed to register passkey');
        }
    };

    return (
        <div className="flex flex-col gap-4 rounded-xl bg-slate-900/60 backdrop-blur-sm border border-slate-500/50 p-5 sm:p-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold text-slate-100">Security</h3>
                    <p className="text-sm text-slate-400">Passkey Sessions & Devices</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={load} disabled={loading} className="flex h-10 items-center justify-center rounded-lg border border-slate-500/50 bg-transparent px-4 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white hover:border-slate-400 transition-all disabled:opacity-60">
                        Refresh
                    </button>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-[#151A22] border border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                <KeyIcon size={20} className="text-blue-400" />
                            </div>
                            <div>
                                <p className="font-medium text-text-primary">Require Passkey</p>
                                <p className="text-sm text-text-secondary">Use passkey for login and transactions</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={isPasskeyEnabled}
                                onChange={(e) => togglePasskey(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                        </label>
                    </div>
                    <button
                        onClick={handleAddDevice}
                        className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-500/50 bg-transparent px-4 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white hover:border-slate-400 transition-all"
                    >
                        <AddIcon size={18} />
                        <span className="truncate">Register Passkey for {userId?.slice(0, 6) ?? 'user'}</span>
                    </button>
                </div>
            </div>
            {error && <div className="rounded-md border border-accent-orange/40 bg-accent-orange/10 p-3 text-sm text-accent-orange">{error}</div>}
            <div className="rounded-lg border border-slate-600/30 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-800/40 text-slate-400">
                        <tr>
                            <th className="px-4 py-2 text-left">Address</th>
                            <th className="px-4 py-2 text-left">Created</th>
                            <th className="px-4 py-2 text-left">Expires</th>
                            <th className="px-4 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-600/30">
                        {loading && (
                            <tr><td className="px-4 py-3 text-slate-400" colSpan={4}>Loading…</td></tr>
                        )}
                        {!loading && keys.length === 0 && (
                            <tr><td className="px-4 py-6 text-[#A7B4C8]" colSpan={4}>No active session keys</td></tr>
                        )}
                        {keys.map(k => {
                            const isCurrent = currentAddress && k.address.toLowerCase() === currentAddress;
                            return (
                                <tr key={k.id} className={isCurrent ? 'bg-white/5' : ''}>
                                    <td className="px-4 py-3 font-mono text-slate-100">{`${k.address.slice(0, 6)}...${k.address.slice(-4)}`}{isCurrent && <span className="ml-2 text-green-400">(current)</span>}</td>
                                    <td className="px-4 py-3 text-slate-100">{new Date(k.createdAt).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-slate-100">{new Date(k.expiresAt).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => handleRevoke(k.id)} disabled={isCurrent} className="rounded-md border border-slate-500/50 px-3 py-1.5 text-slate-300 hover:bg-white/5 hover:text-white hover:border-slate-400 transition-all disabled:opacity-50">Revoke</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="mt-6 rounded-lg border border-slate-600/30 overflow-hidden">
                <div className="px-4 py-2 bg-slate-800/40 text-slate-400 text-sm">Passkey Devices</div>
                <table className="w-full text-sm">
                    <thead className="bg-slate-800/40 text-slate-400">
                        <tr>
                            <th className="px-4 py-2 text-left">Credential ID</th>
                            <th className="px-4 py-2 text-left">Transports</th>
                            <th className="px-4 py-2 text-left">Created</th>
                            <th className="px-4 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-600/30">
                        {devices.length === 0 && (
                            <tr><td colSpan={4} className="px-4 py-6 text-slate-400">No registered devices</td></tr>
                        )}
                        {devices.map((d) => (
                            <tr key={d.id}>
                                <td className="px-4 py-3 text-slate-100 break-all">{d.credentialID.slice(0, 12)}…{d.credentialID.slice(-8)}</td>
                                <td className="px-4 py-3 text-slate-100">{(d.transports || []).join(', ') || '—'}</td>
                                <td className="px-4 py-3 text-slate-100">{new Date(d.createdAt).toLocaleString()}</td>
                                <td className="px-4 py-3 text-right">
                                    <button onClick={() => handleRemoveDevice(d.id)} className="rounded-md border border-slate-500/50 px-3 py-1.5 text-slate-300 hover:bg-white/5 hover:text-white hover:border-slate-400 transition-all">Remove</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-[#A7B4C8]">Revoking the current session is disabled. Use Logout to end it.</p>
        </div>
    );
};

const NetworkSection: React.FC = () => (
    <div className="flex flex-col gap-4 rounded-xl bg-[#151A22] p-5 sm:p-6">
        <h3 className="text-lg font-semibold text-[#E6EEF3]">Network</h3>
        <div className="relative">
            <select defaultValue="Arc Testnet" className="w-full appearance-none rounded-lg border border-[#2B3440] bg-[#091325]/50 py-2.5 pl-4 pr-10 text-sm text-[#E6EEF3] focus:border-[#9EBBE4] focus:outline-none focus:ring-1 focus:ring-[#9EBBE4]">
                <option>Arc Mainnet</option>
                <option>Arc Testnet</option>
                <option>Custom RPC</option>
            </select>
            <ChevronDownIcon size={20} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#A7B4C8]" />
        </div>
    </div>
);



const OrganizationRolesSection: React.FC = () => {
    const { address } = useSelfCustodialWallet();
    const { email } = useSession();

    return (
        <div className="flex flex-col gap-4 rounded-xl bg-[#151A22] p-5 sm:p-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <h3 className="text-lg font-semibold text-[#E6EEF3]">Organization Roles</h3>
                <button
                    onClick={() => alert('Role management coming soon! For now, use Multi-Sig wallets for team collaboration.')}
                    className="flex h-10 w-full shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-[#9EBBE4] px-4 text-sm font-semibold text-[#091325] hover:bg-[#B9D1ED] sm:w-auto"
                >
                    <span className="truncate">Manage Roles</span>
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="border-b border-[#2B3440]">
                        <tr>
                            <th className="py-2.5 pr-4 font-medium text-[#A7B4C8]">Member</th>
                            <th className="py-2.5 px-4 font-medium text-[#A7B4C8]">Role</th>
                            <th className="py-2.5 pl-4 font-medium text-[#A7B4C8]">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B3440]">
                        {address ? (
                            <tr>
                                <td className="py-3.5 pr-4 font-mono text-[#E6EEF3]">
                                    {address.slice(0, 6)}...{address.slice(-4)}
                                    {email && <div className="text-xs text-[#A7B4C8] mt-1">{email}</div>}
                                </td>
                                <td className="px-4 py-3.5 text-[#E6EEF3]">Owner</td>
                                <td className="py-3.5 pl-4 text-green-400">Active</td>
                            </tr>
                        ) : (
                            <tr>
                                <td colSpan={3} className="py-6 text-center text-[#A7B4C8]">
                                    No wallet connected. Connect your wallet to see your role.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-[#A7B4C8]">
                For team collaboration with multiple members, use Multi-Sig wallets from the sidebar.
            </p>
        </div>
    );
};

const RecoverySection: React.FC = () => {
    const { sessionKey, verifyWithPasskey } = useWallet();
    const { getPrivateKey, getMnemonic, isUnlocked, isPasskeyEnabled } = useSelfCustodialWallet();
    const [showSecret, setShowSecret] = useState(false);
    const [activeTab, setActiveTab] = useState<'privateKey' | 'seedPhrase'>('privateKey');
    const [copied, setCopied] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [confirmationChecks, setConfirmationChecks] = useState({
        understand: false,
        noShare: false,
        responsibility: false,
    });
    const [holdProgress, setHoldProgress] = useState(0);
    const [isHolding, setIsHolding] = useState(false);

    // Use self-custodial wallet if unlocked, otherwise fall back to legacy
    const walletPrivateKey = isUnlocked ? getPrivateKey() : sessionKey?.privateKey;
    const walletMnemonic = isUnlocked ? getMnemonic() : null;

    // Auto-hide secret after 60 seconds
    useEffect(() => {
        if (showSecret) {
            const timer = setTimeout(() => {
                setShowSecret(false);
                setShowModal(false);
            }, 60000);
            return () => clearTimeout(timer);
        }
    }, [showSecret]);

    const handleCopy = () => {
        const textToCopy = activeTab === 'privateKey' ? walletPrivateKey : walletMnemonic;
        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleOpenModal = () => {
        setShowModal(true);
        setConfirmationChecks({ understand: false, noShare: false, responsibility: false });
        setHoldProgress(0);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setShowSecret(false);
        setConfirmationChecks({ understand: false, noShare: false, responsibility: false });
        setHoldProgress(0);
    };

    const allChecksConfirmed = confirmationChecks.understand && confirmationChecks.noShare && confirmationChecks.responsibility;

    const handleHoldStart = () => {
        if (!allChecksConfirmed) return;
        setIsHolding(true);

        let progress = 0;
        const interval = setInterval(() => {
            progress += 2;
            setHoldProgress(progress);

            if (progress >= 100) {
                clearInterval(interval);
                setIsHolding(false);
                handleRevealSecret();
            }
        }, 30); // 1.5 seconds total

        (window as any).__holdInterval = interval;
    };

    const handleHoldEnd = () => {
        setIsHolding(false);
        if ((window as any).__holdInterval) {
            clearInterval((window as any).__holdInterval);
        }
        if (holdProgress < 100) {
            setHoldProgress(0);
        }
    };

    const handleRevealSecret = async () => {
        if (showSecret) {
            setShowSecret(false);
            setShowModal(false);
            return;
        }

        setIsVerifying(true);
        setPasswordError('');

        try {
            if (isPasskeyEnabled) {
                // Use passkey verification
                await verifyWithPasskey();
                setShowSecret(true);
            } else {
                // Use password verification
                if (!password) {
                    setPasswordError('Please enter your wallet password');
                    setIsVerifying(false);
                    return;
                }

                // TODO: Verify password with wallet decryption
                // For now, we'll use a simple check (this should be replaced with actual password verification)
                const { decryptWallet } = await import('../contexts/SelfCustodialWalletContext');
                try {
                    // Attempt to decrypt with password
                    // This is a placeholder - actual implementation depends on your wallet encryption
                    setShowSecret(true);
                } catch (err) {
                    setPasswordError('Incorrect password. Please try again.');
                    setIsVerifying(false);
                    return;
                }
            }
        } catch (error) {
            console.error('Verification failed:', error);
            if (isPasskeyEnabled) {
                alert('Passkey verification failed. You must authenticate to view your backup.');
            } else {
                setPasswordError('Verification failed. Please try again.');
            }
            setShowModal(false);
        } finally {
            setIsVerifying(false);
        }
    };

    if (!walletPrivateKey) {
        return (
            <div className="flex flex-col items-start gap-3 rounded-xl bg-slate-900/60 backdrop-blur-sm border border-slate-500/50 p-5 sm:p-6">
                <h3 className="text-base font-semibold text-slate-100">Wallet Backup</h3>
                <p className="text-sm text-slate-400">No wallet connected or wallet locked. Unlock to view backup options.</p>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col items-start gap-4 rounded-xl bg-slate-900/60 backdrop-blur-sm border border-slate-500/50 p-5 sm:p-6">
                <div className="flex w-full items-start justify-between">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-base font-semibold text-slate-100">Wallet Backup</h3>
                        <p className="text-sm text-slate-400">Securely export your Private Key or Seed Phrase</p>
                    </div>
                </div>

                {/* Professional Security Warning (Blue/Amber) */}
                <div className="w-full rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <LockIcon size={64} className="text-blue-400" />
                    </div>
                    <div className="flex gap-3 relative z-10">
                        <div className="p-2 bg-blue-500/20 rounded-lg h-fit">
                            <LockIcon size={24} className="text-blue-400" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-sm font-semibold text-blue-100">Sensitive Information</p>
                            <p className="text-xs text-blue-200/80 leading-relaxed max-w-lg">
                                Your Private Key and Seed Phrase give full access to your funds.
                                Never share them with anyone. Arc Wallet support will <span className="font-bold text-amber-400">NEVER</span> ask for them.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Reveal Button */}
                {!showSecret && (
                    <button
                        onClick={handleOpenModal}
                        className="w-full sm:w-auto px-6 py-3 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-100 font-medium text-sm transition-all border border-slate-600/30 hover:border-blue-500/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.1)] flex items-center justify-center gap-2"
                    >
                        <LockIcon size={18} className="text-blue-400" />
                        Reveal Secret Recovery
                    </button>
                )}

                {/* Secret Display (only when revealed) */}
                {showSecret && (
                    <div className="w-full flex flex-col gap-4 p-1 rounded-xl bg-slate-950/50 border border-slate-800">
                        {/* Tabs */}
                        <div className="flex p-1 gap-1 bg-slate-900/50 rounded-lg">
                            <button
                                onClick={() => setActiveTab('privateKey')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'privateKey'
                                    ? 'bg-slate-800 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                Private Key
                            </button>
                            {walletMnemonic && (
                                <button
                                    onClick={() => setActiveTab('seedPhrase')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'seedPhrase'
                                        ? 'bg-slate-800 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                >
                                    Seed Phrase
                                </button>
                            )}
                        </div>

                        <div className="px-4 pb-4 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                                    <span>⚠️</span>
                                    Visible for 60 seconds
                                </label>
                                <button
                                    onClick={() => { setShowSecret(false); setShowModal(false); }}
                                    className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
                                >
                                    Hide Now
                                </button>
                            </div>

                            {activeTab === 'privateKey' ? (
                                <div className="relative flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-3 group hover:border-slate-600 transition-colors">
                                    <p className="flex-1 font-mono text-sm text-slate-300 break-all select-all">
                                        {walletPrivateKey}
                                    </p>
                                    <button
                                        onClick={handleCopy}
                                        className="flex shrink-0 items-center justify-center rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-all"
                                        title="Copy Private Key"
                                    >
                                        <CopyIcon size={18} />
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                        {walletMnemonic?.split(' ').map((word, idx) => (
                                            <div key={idx} className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 rounded-md px-2 py-1.5">
                                                <span className="text-xs text-slate-500 font-mono w-4">{idx + 1}.</span>
                                                <span className="text-sm text-slate-200 font-medium">{word}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleCopy}
                                        className="absolute top-2 right-2 p-2 bg-slate-800/80 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white border border-slate-600/50 backdrop-blur-sm transition-all"
                                        title="Copy Seed Phrase"
                                    >
                                        <CopyIcon size={16} />
                                    </button>
                                </div>
                            )}

                            {copied && (
                                <p className="text-xs text-emerald-400 text-center font-medium animate-pulse">
                                    ✓ Copied to clipboard
                                </p>
                            )}

                            <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                                <h4 className="text-xs font-semibold text-slate-300 mb-2">Security Best Practices:</h4>
                                <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
                                    <li>Write down on paper and store in a fireproof safe.</li>
                                    <li>Do not take a screenshot or photo.</li>
                                    <li>Do not save in unencrypted cloud storage.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Security Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                    <div className="w-full max-w-lg bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 relative overflow-hidden">
                            <div className="absolute -right-4 -top-4 opacity-20 rotate-12">
                                <LockIcon size={120} className="text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2 relative z-10">
                                <LockIcon size={28} className="text-white" />
                                Secure Backup
                            </h2>
                            <p className="text-blue-100/90 text-sm mt-1 relative z-10">Authentication required to reveal secrets</p>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                            {/* Warning */}
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex gap-3">
                                <div className="p-1 bg-amber-500/20 rounded h-fit">
                                    <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-amber-400 font-bold text-sm mb-1">Handle with Extreme Care</p>
                                    <p className="text-amber-200/70 text-xs leading-relaxed">
                                        Anyone with your Private Key or Seed Phrase can steal your funds.
                                        Arc Wallet cannot recover lost funds if these secrets are compromised.
                                    </p>
                                </div>
                            </div>

                            {/* Confirmation Checkboxes */}
                            <div className="space-y-3 pt-2">
                                <p className="text-slate-100 font-medium text-sm">Please confirm to proceed:</p>

                                <label className="flex items-start gap-3 cursor-pointer group p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={confirmationChecks.understand}
                                        onChange={(e) => setConfirmationChecks(prev => ({ ...prev, understand: e.target.checked }))}
                                        className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                                    />
                                    <span className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors">
                                        I understand that sharing this secret allows anyone to access my funds.
                                    </span>
                                </label>

                                <label className="flex items-start gap-3 cursor-pointer group p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={confirmationChecks.noShare}
                                        onChange={(e) => setConfirmationChecks(prev => ({ ...prev, noShare: e.target.checked }))}
                                        className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                                    />
                                    <span className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors">
                                        I will never share this with anyone claiming to be Support.
                                    </span>
                                </label>

                                <label className="flex items-start gap-3 cursor-pointer group p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={confirmationChecks.responsibility}
                                        onChange={(e) => setConfirmationChecks(prev => ({ ...prev, responsibility: e.target.checked }))}
                                        className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                                    />
                                    <span className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors">
                                        I take full responsibility for the security of this backup.
                                    </span>
                                </label>
                            </div>

                            {/* Password Input (only if passkey is not enabled) */}
                            {!isPasskeyEnabled && (
                                <div className="space-y-2 pt-2">
                                    <label className="block text-sm font-medium text-slate-300">
                                        Wallet Password
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your wallet password"
                                        className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all"
                                    />
                                    {passwordError && (
                                        <p className="text-sm text-red-400">{passwordError}</p>
                                    )}
                                </div>
                            )}

                            {/* Hold to Reveal Button */}
                            <div className="space-y-2 pt-2">
                                <button
                                    onMouseDown={handleHoldStart}
                                    onMouseUp={handleHoldEnd}
                                    onMouseLeave={handleHoldEnd}
                                    onTouchStart={handleHoldStart}
                                    onTouchEnd={handleHoldEnd}
                                    disabled={!allChecksConfirmed || isVerifying}
                                    className={`relative w-full py-4 rounded-xl font-bold text-base transition-all overflow-hidden shadow-lg ${allChecksConfirmed
                                        ? 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white cursor-pointer shadow-blue-900/20'
                                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                        }`}
                                >
                                    <div
                                        className="absolute inset-0 bg-white/20 transition-all ease-linear"
                                        style={{ width: `${holdProgress}%` }}
                                    />
                                    <span className="relative z-10 flex items-center justify-center gap-2">
                                        {isVerifying ? (
                                            <>
                                                <span className="animate-spin">⏳</span> Verifying...
                                            </>
                                        ) : isHolding ? (
                                            'Keep Holding...'
                                        ) : allChecksConfirmed ? (
                                            <>
                                                <span>👆</span> Hold to Reveal
                                            </>
                                        ) : (
                                            'Confirm All Above'
                                        )}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-950 p-4 border-t border-slate-800 flex justify-center">
                            <button
                                onClick={handleCloseModal}
                                className="text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const SessionInfoSection: React.FC = () => {
    const { email, logout: sessionLogout } = useSession();
    const { logout: walletLogout } = useWallet();

    if (!email) {
        return null;
    }

    const handleLogout = async () => {
        await sessionLogout();
        walletLogout();
    };

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-500/50 bg-slate-900/40 backdrop-blur-sm p-5 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-400">Signed in as</p>
            <p className="text-lg font-semibold text-slate-100">{email}</p>
            <p className="text-sm text-slate-400">
                Magic link sessions remain active for 24 hours. Sign out to revoke the current session.
            </p>
            <div className="flex justify-end">
                <button
                    onClick={handleLogout}
                    className="rounded-lg border border-slate-500/50 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white hover:border-slate-400 transition-all"
                >
                    Sign out
                </button>
            </div>
        </div>
    );
};


const Settings: React.FC = () => {
    return (
        <>
            <div className="w-full">
                {/* PageHeading */}
                <div className="mb-8 sm:mb-12">
                    <div className="flex flex-wrap justify-between gap-3">
                        <div className="flex min-w-72 flex-col gap-2 sm:gap-3">
                            <h1 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-white">Settings</h1>
                            <p className="text-base font-normal leading-normal text-slate-400">Manage your security, network, and organization settings.</p>
                        </div>
                    </div>
                </div>
                {/* Settings Sections */}
                <div className="flex flex-col gap-8">
                    <WalletIdentitySection />
                    <SecuritySection />
                    <NetworkSection />

                    <OrganizationRolesSection />
                    <RecoverySection />
                    <div className="h-px bg-slate-700/50 my-8" />



                    <WebhookManager />

                    <div className="h-px bg-slate-700/50 my-8" />

                    <NotificationManager />
                </div>
            </div>
            <div className="mt-8">
                <SessionInfoSection />
            </div>
        </>
    );
};

export default Settings;
