import React, { useEffect, useMemo, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useSession } from '../contexts/SessionContext';
import { useSelfCustodialWallet } from '../contexts/SelfCustodialWalletContext';
import { usePrivacy } from '../contexts/PrivacyContext';
import { passkeyClient, type SessionKeySummary } from '../services/passkeyClient';
import { WalletIcon, CopyIcon, AddIcon, LaptopIcon, PhoneIcon, ChevronDownIcon } from './Icons';

const WalletIdentitySection: React.FC = () => {
    const { address } = useSelfCustodialWallet();
    const walletAddress = address || "0x0000000000000000000000000000000000000000";

    const handleCopy = () => {
        if (address) {
            navigator.clipboard.writeText(address);
        }
    };

    return (
        <div className="flex flex-col gap-3 rounded-xl bg-[#151A22] p-5 sm:p-6">
            <h3 className="text-lg font-semibold text-[#E6EEF3]">Wallet Identity</h3>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3 rounded-lg border border-[#2B3440] bg-[#091325]/50 px-3 py-2">
                    <WalletIcon size={20} className="text-[#A7B4C8]" />
                    <p className="flex-1 truncate font-mono text-sm text-[#E6EEF3]">{address ? walletAddress : 'No Wallet Connected'}</p>
                    <button
                        onClick={handleCopy}
                        disabled={!address}
                        className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-[#A7B4C8] hover:bg-white/10 hover:text-[#E6EEF3] disabled:opacity-50"
                    >
                        <CopyIcon size={18} />
                    </button>
                </div>
                <button
                    disabled={!address}
                    className="flex h-10 w-full shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-[#2B3440] bg-transparent px-4 text-sm font-medium text-[#E6EEF3] hover:bg-white/5 sm:w-auto disabled:opacity-50"
                >
                    <span className="truncate">View on Explorer</span>
                </button>
            </div>
        </div>
    );
};

const SecuritySection: React.FC = () => {
    const { userId, sessionKey, registerPasskeyForCurrentUser } = useWallet();
    const [loading, setLoading] = useState(false);
    const [keys, setKeys] = useState<SessionKeySummary[]>([]);
    const [devices, setDevices] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    const currentAddress = sessionKey?.address?.toLowerCase();

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
            await registerPasskeyForCurrentUser();
            await load();
            alert('Passkey registered for this user. You can now authenticate on this device.');
        } catch (e: any) {
            setError(e?.message || 'Failed to register passkey');
        }
    };

    return (
        <div className="flex flex-col gap-4 rounded-xl bg-[#151A22] p-5 sm:p-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold text-[#E6EEF3]">Security</h3>
                    <p className="text-sm text-[#A7B4C8]">Passkey Sessions & Devices</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={load} disabled={loading} className="flex h-10 items-center justify-center rounded-lg border border-[#2B3440] bg-transparent px-4 text-sm font-medium text-[#E6EEF3] hover:bg-white/5 disabled:opacity-60">
                        Refresh
                    </button>
                    <button
                        onClick={handleAddDevice}
                        className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#2B3440] bg-transparent px-4 text-sm font-medium text-[#E6EEF3] hover:bg-white/5"
                    >
                        <AddIcon size={18} />
                        <span className="truncate">Register Passkey for {userId?.slice(0, 6) ?? 'user'}</span>
                    </button>
                </div>
            </div>
            {error && <div className="rounded-md border border-accent-orange/40 bg-accent-orange/10 p-3 text-sm text-accent-orange">{error}</div>}
            <div className="rounded-lg border border-[#2B3440] overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-[#0f1724] text-[#A7B4C8]">
                        <tr>
                            <th className="px-4 py-2 text-left">Address</th>
                            <th className="px-4 py-2 text-left">Created</th>
                            <th className="px-4 py-2 text-left">Expires</th>
                            <th className="px-4 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B3440]">
                        {loading && (
                            <tr><td className="px-4 py-3 text-[#A7B4C8]" colSpan={4}>Loading…</td></tr>
                        )}
                        {!loading && keys.length === 0 && (
                            <tr><td className="px-4 py-6 text-[#A7B4C8]" colSpan={4}>No active session keys</td></tr>
                        )}
                        {keys.map(k => {
                            const isCurrent = currentAddress && k.address.toLowerCase() === currentAddress;
                            return (
                                <tr key={k.id} className={isCurrent ? 'bg-white/5' : ''}>
                                    <td className="px-4 py-3 font-mono text-[#E6EEF3]">{`${k.address.slice(0, 6)}...${k.address.slice(-4)}`}{isCurrent && <span className="ml-2 text-green-400">(current)</span>}</td>
                                    <td className="px-4 py-3 text-[#E6EEF3]">{new Date(k.createdAt).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-[#E6EEF3]">{new Date(k.expiresAt).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => handleRevoke(k.id)} disabled={isCurrent} className="rounded-md border border-[#2B3440] px-3 py-1.5 text-[#E6EEF3] hover:bg-white/5 disabled:opacity-50">Revoke</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="mt-6 rounded-lg border border-[#2B3440] overflow-hidden">
                <div className="px-4 py-2 bg-[#0f1724] text-[#A7B4C8] text-sm">Passkey Devices</div>
                <table className="w-full text-sm">
                    <thead className="bg-[#0f1724] text-[#A7B4C8]">
                        <tr>
                            <th className="px-4 py-2 text-left">Credential ID</th>
                            <th className="px-4 py-2 text-left">Transports</th>
                            <th className="px-4 py-2 text-left">Created</th>
                            <th className="px-4 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B3440]">
                        {devices.length === 0 && (
                            <tr><td colSpan={4} className="px-4 py-6 text-[#A7B4C8]">No registered devices</td></tr>
                        )}
                        {devices.map((d) => (
                            <tr key={d.id}>
                                <td className="px-4 py-3 text-[#E6EEF3] break-all">{d.credentialID.slice(0, 12)}…{d.credentialID.slice(-8)}</td>
                                <td className="px-4 py-3 text-[#E6EEF3]">{(d.transports || []).join(', ') || '—'}</td>
                                <td className="px-4 py-3 text-[#E6EEF3]">{new Date(d.createdAt).toLocaleString()}</td>
                                <td className="px-4 py-3 text-right">
                                    <button onClick={() => handleRemoveDevice(d.id)} className="rounded-md border border-[#2B3440] px-3 py-1.5 text-[#E6EEF3] hover:bg-white/5">Remove</button>
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

const PrivacySection: React.FC = () => {
    const { isPrivacyMode, togglePrivacyMode, fheKeypair, viewKeys, createViewKey, revokeViewKey } = usePrivacy();
    const [showViewKeyModal, setShowViewKeyModal] = useState(false);
    const [newViewKeyAddress, setNewViewKeyAddress] = useState('');
    const [newViewKeyName, setNewViewKeyName] = useState('');

    const handleCreateViewKey = () => {
        if (!newViewKeyAddress) {
            alert('Please enter an address');
            return;
        }
        createViewKey(newViewKeyAddress, newViewKeyName);
        setNewViewKeyAddress('');
        setNewViewKeyName('');
        setShowViewKeyModal(false);
    };

    return (
        <>
            <div className="flex flex-col gap-4 rounded-xl bg-[#151A22] p-5 sm:p-6">
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-semibold text-[#E6EEF3]">Privacy Mode (FHE)</h3>
                        <p className="text-sm text-[#A7B4C8]">Encrypt transaction amounts with Fully Homomorphic Encryption</p>
                    </div>
                    <button
                        onClick={togglePrivacyMode}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPrivacyMode ? 'bg-primary' : 'bg-[#2B3440]'
                            }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPrivacyMode ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>

                {isPrivacyMode && fheKeypair && (
                    <div className="space-y-4">
                        {/* FHE Public Key */}
                        <div className="rounded-lg border border-[#2B3440] bg-[#091325]/50 p-4">
                            <p className="text-sm font-medium text-[#A7B4C8] mb-2">FHE Public Key</p>
                            <p className="font-mono text-xs text-[#E6EEF3] break-all">{fheKeypair.publicKey}</p>
                        </div>

                        {/* View Keys Management */}
                        <div className="rounded-lg border border-[#2B3440] overflow-hidden">
                            <div className="px-4 py-3 bg-[#0f1724] flex items-center justify-between">
                                <p className="text-sm font-medium text-[#A7B4C8]">View Keys</p>
                                <button
                                    onClick={() => setShowViewKeyModal(true)}
                                    className="text-sm text-primary hover:text-primary/80"
                                >
                                    + Create View Key
                                </button>
                            </div>
                            {viewKeys.length === 0 ? (
                                <div className="px-4 py-6 text-center text-sm text-[#A7B4C8]">
                                    No view keys created. Create one to share with auditors.
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-[#0f1724] text-[#A7B4C8]">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Granted To</th>
                                            <th className="px-4 py-2 text-left">Created</th>
                                            <th className="px-4 py-2 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#2B3440]">
                                        {viewKeys.map((vk) => (
                                            <tr key={vk.id}>
                                                <td className="px-4 py-3 text-[#E6EEF3]">
                                                    <div className="font-mono text-xs">{vk.grantedTo.slice(0, 10)}...</div>
                                                    {vk.grantedToName && <div className="text-xs text-[#A7B4C8]">{vk.grantedToName}</div>}
                                                </td>
                                                <td className="px-4 py-3 text-[#E6EEF3]">{vk.createdAt.toLocaleDateString()}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => revokeViewKey(vk.id)}
                                                        className="text-sm text-accent-orange hover:text-accent-orange/80"
                                                    >
                                                        Revoke
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Privacy Info */}
                        <div className="rounded-lg border border-[#2B3440]/50 bg-[#091325]/30 p-4">
                            <p className="text-xs text-[#A7B4C8] leading-relaxed">
                                🔒 When Privacy Mode is enabled, transaction amounts are encrypted using FHE.
                                Addresses remain visible for compliance, but amounts are hidden from public view.
                                You can grant view keys to auditors for selective disclosure.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* View Key Creation Modal */}
            {showViewKeyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[#0F1419] border border-[#2B3440] rounded-2xl p-6">
                        <h3 className="text-xl font-bold text-[#E6EEF3] mb-4">Create View Key</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-[#A7B4C8] mb-2 block">Auditor Address</label>
                                <input
                                    type="text"
                                    value={newViewKeyAddress}
                                    onChange={(e) => setNewViewKeyAddress(e.target.value)}
                                    placeholder="0x..."
                                    className="w-full bg-[#151A22] border border-[#2B3440] rounded-lg px-4 py-2 text-[#E6EEF3] placeholder-[#A7B4C8] focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-[#A7B4C8] mb-2 block">Name (Optional)</label>
                                <input
                                    type="text"
                                    value={newViewKeyName}
                                    onChange={(e) => setNewViewKeyName(e.target.value)}
                                    placeholder="e.g., Tax Auditor"
                                    className="w-full bg-[#151A22] border border-[#2B3440] rounded-lg px-4 py-2 text-[#E6EEF3] placeholder-[#A7B4C8] focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowViewKeyModal(false)}
                                    className="flex-1 py-2 rounded-lg border border-[#2B3440] text-[#E6EEF3] hover:bg-white/5"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateViewKey}
                                    className="flex-1 py-2 rounded-lg bg-primary text-primary-text hover:bg-primary/90"
                                >
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

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
    const { getPrivateKey, getMnemonic, isUnlocked } = useSelfCustodialWallet();
    const [showPrivateKey, setShowPrivateKey] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [confirmationChecks, setConfirmationChecks] = useState({
        understand: false,
        noShare: false,
        responsibility: false,
    });
    const [holdProgress, setHoldProgress] = useState(0);
    const [isHolding, setIsHolding] = useState(false);

    // Use self-custodial wallet if unlocked, otherwise fall back to legacy
    const walletPrivateKey = isUnlocked ? getPrivateKey() : sessionKey?.privateKey;

    // Auto-hide private key after 60 seconds
    useEffect(() => {
        if (showPrivateKey) {
            const timer = setTimeout(() => {
                setShowPrivateKey(false);
                setShowModal(false);
            }, 60000);
            return () => clearTimeout(timer);
        }
    }, [showPrivateKey]);

    const handleCopyPrivateKey = () => {
        if (walletPrivateKey) {
            navigator.clipboard.writeText(walletPrivateKey);
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
        setShowPrivateKey(false);
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
                handleRevealPrivateKey();
            }
        }, 30); // 1.5 seconds total (30ms * 50 steps)

        // Store interval ID to clear on mouse up
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

    const handleRevealPrivateKey = async () => {
        if (showPrivateKey) {
            setShowPrivateKey(false);
            setShowModal(false);
            return;
        }

        // Verify with passkey first
        setIsVerifying(true);
        try {
            await verifyWithPasskey();
            setShowPrivateKey(true);
        } catch (error) {
            console.error('Passkey verification failed:', error);
            alert('Passkey verification failed. You must authenticate to view your private key.');
            setShowModal(false);
        } finally {
            setIsVerifying(false);
        }
    };

    if (!walletPrivateKey) {
        return (
            <div className="flex flex-col items-start gap-3 rounded-xl bg-[#151A22]/70 p-5 sm:p-6">
                <h3 className="text-base font-semibold text-[#E6EEF3]">Wallet Backup</h3>
                <p className="text-sm text-[#A7B4C8]">No wallet connected or wallet locked. Unlock to view backup options.</p>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col items-start gap-4 rounded-xl bg-[#151A22]/70 p-5 sm:p-6">
                <div className="flex w-full items-start justify-between">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-base font-semibold text-[#E6EEF3]">Wallet Backup</h3>
                        <p className="text-sm text-[#A7B4C8]">Securely export your private key</p>
                    </div>
                </div>

                {/* Security Warning */}
                <div className="w-full rounded-lg border border-[#ff6b81]/30 bg-[#ff6b81]/10 p-4">
                    <div className="flex gap-2">
                        <span className="text-[#ff6b81]">⚠️</span>
                        <div className="flex flex-col gap-1">
                            <p className="text-sm font-semibold text-[#ff6b81]">Critical Security Warning</p>
                            <p className="text-xs text-[#ffb3be]">
                                Your private key controls your wallet. Never share it. Revealing requires authentication and multiple confirmations.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Reveal Button */}
                <button
                    onClick={handleOpenModal}
                    className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#2B3440] hover:bg-[#3a4553] text-[#E6EEF3] font-medium text-sm transition-colors border border-[#3a4553]"
                >
                    Reveal Private Key
                </button>

                {/* Private Key Display (only when revealed) */}
                {showPrivateKey && (
                    <div className="w-full flex flex-col gap-3 p-4 rounded-lg border-2 border-[#ff6b81] bg-[#ff6b81]/5">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-[#ff6b81]">⚠️ Private Key (visible for 60 seconds)</label>
                            <button
                                onClick={() => { setShowPrivateKey(false); setShowModal(false); }}
                                className="text-sm font-medium text-[#ff6b81] hover:text-[#ff8a9a]"
                            >
                                Hide Now
                            </button>
                        </div>

                        <div className="relative flex items-center gap-2 rounded-lg border border-[#ff6b81]/50 bg-[#091325] px-3 py-3">
                            <p className="flex-1 font-mono text-sm text-[#E6EEF3] break-all select-all">
                                {walletPrivateKey}
                            </p>
                            <button
                                onClick={handleCopyPrivateKey}
                                className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-[#ff6b81] hover:bg-white/10 hover:text-[#ff8a9a]"
                                title="Copy to clipboard"
                            >
                                <CopyIcon size={18} />
                            </button>
                        </div>

                        {copied && (
                            <p className="text-xs text-[#6de4b4]">✓ Copied to clipboard</p>
                        )}

                        <div className="rounded-lg border border-[#2B3440] bg-[#091325]/50 p-3">
                            <h4 className="text-sm font-semibold text-[#E6EEF3] mb-2">Backup Instructions:</h4>
                            <ul className="text-xs text-[#A7B4C8] space-y-1 list-disc list-inside">
                                <li>Store in a password manager (1Password, Bitwarden, etc.)</li>
                                <li>Write on paper and store in a safe place</li>
                                <li>Never save in cloud storage or email</li>
                                <li>Keep multiple secure backups</li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>

            {/* Security Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-[#0F1419] border border-[#2B3440] rounded-2xl shadow-2xl overflow-hidden">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-[#ff6b81] to-[#ff4757] p-6">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <span className="text-3xl">🔐</span>
                                Private Key Access
                            </h2>
                            <p className="text-white/90 text-sm mt-1">Maximum security verification required</p>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                            {/* Critical Warning */}
                            <div className="bg-[#ff6b81]/10 border-2 border-[#ff6b81] rounded-lg p-4">
                                <p className="text-[#ff6b81] font-bold text-lg mb-2">⚠️ EXTREME DANGER ⚠️</p>
                                <p className="text-[#ffb3be] text-sm leading-relaxed">
                                    Your private key is like the master password to your bank account. Anyone who obtains it can steal ALL your funds immediately and permanently. There is NO way to reverse or recover stolen funds.
                                </p>
                            </div>

                            {/* Risks List */}
                            <div className="space-y-3">
                                <h3 className="text-[#E6EEF3] font-semibold text-base">You could lose everything if:</h3>
                                <div className="space-y-2">
                                    {[
                                        'Someone sees your screen while the key is visible',
                                        'You save it in an unsecured location (screenshots, notes, cloud)',
                                        'Malware or keyloggers capture it from your device',
                                        'You accidentally share or send it to someone',
                                        'A camera or recording device captures your screen'
                                    ].map((risk, idx) => (
                                        <div key={idx} className="flex gap-2 text-sm text-[#A7B4C8]">
                                            <span className="text-[#ff6b81] shrink-0">•</span>
                                            <span>{risk}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Confirmation Checkboxes */}
                            <div className="space-y-3 border-t border-[#2B3440] pt-4">
                                <p className="text-[#E6EEF3] font-medium text-sm">You must confirm you understand:</p>

                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={confirmationChecks.understand}
                                        onChange={(e) => setConfirmationChecks(prev => ({ ...prev, understand: e.target.checked }))}
                                        className="mt-1 w-4 h-4 rounded border-[#3a4553] bg-[#1a1f26] text-[#6c7cff] focus:ring-2 focus:ring-[#6c7cff] focus:ring-offset-0"
                                    />
                                    <span className="text-sm text-[#A7B4C8] group-hover:text-[#E6EEF3]">
                                        I understand that anyone with my private key can steal all my funds permanently
                                    </span>
                                </label>

                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={confirmationChecks.noShare}
                                        onChange={(e) => setConfirmationChecks(prev => ({ ...prev, noShare: e.target.checked }))}
                                        className="mt-1 w-4 h-4 rounded border-[#3a4553] bg-[#1a1f26] text-[#6c7cff] focus:ring-2 focus:ring-[#6c7cff] focus:ring-offset-0"
                                    />
                                    <span className="text-sm text-[#A7B4C8] group-hover:text-[#E6EEF3]">
                                        I will never share this key with anyone, including Arc Wallet support
                                    </span>
                                </label>

                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={confirmationChecks.responsibility}
                                        onChange={(e) => setConfirmationChecks(prev => ({ ...prev, responsibility: e.target.checked }))}
                                        className="mt-1 w-4 h-4 rounded border-[#3a4553] bg-[#1a1f26] text-[#6c7cff] focus:ring-2 focus:ring-[#6c7cff] focus:ring-offset-0"
                                    />
                                    <span className="text-sm text-[#A7B4C8] group-hover:text-[#E6EEF3]">
                                        I take full responsibility for securing this key and understand Arc Wallet cannot help if it's compromised
                                    </span>
                                </label>
                            </div>

                            {/* Hold to Reveal Button */}
                            <div className="space-y-2 border-t border-[#2B3440] pt-4">
                                <button
                                    onMouseDown={handleHoldStart}
                                    onMouseUp={handleHoldEnd}
                                    onMouseLeave={handleHoldEnd}
                                    onTouchStart={handleHoldStart}
                                    onTouchEnd={handleHoldEnd}
                                    disabled={!allChecksConfirmed || isVerifying}
                                    className={`relative w-full py-4 rounded-lg font-semibold text-base transition-all overflow-hidden ${allChecksConfirmed
                                        ? 'bg-gradient-to-r from-[#ff6b81] to-[#ff4757] hover:from-[#ff7a8e] hover:to-[#ff5767] text-white cursor-pointer'
                                        : 'bg-[#2B3440] text-[#5a6573] cursor-not-allowed'
                                        }`}
                                >
                                    <div
                                        className="absolute inset-0 bg-white/20 transition-all"
                                        style={{ width: `${holdProgress}%` }}
                                    />
                                    <span className="relative z-10">
                                        {isVerifying
                                            ? 'Verifying with Passkey...'
                                            : isHolding
                                                ? 'Keep Holding...'
                                                : allChecksConfirmed
                                                    ? 'Hold to Reveal Private Key'
                                                    : 'Confirm All Warnings Above'}
                                    </span>
                                </button>
                                {allChecksConfirmed && !isVerifying && (
                                    <p className="text-xs text-center text-[#A7B4C8]">
                                        Hold the button for 1.5 seconds, then authenticate with your passkey
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-[#151A22] p-4 border-t border-[#2B3440]">
                            <button
                                onClick={handleCloseModal}
                                className="w-full py-2 text-sm font-medium text-[#A7B4C8] hover:text-[#E6EEF3] transition-colors"
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
        <div className="flex flex-col gap-3 rounded-xl border border-[#2B3440] bg-[#0b1325] p-5 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-[#9EBBE4]">Signed in as</p>
            <p className="text-lg font-semibold text-[#E6EEF3]">{email}</p>
            <p className="text-sm text-[#A7B4C8]">
                Magic link sessions remain active for 24 hours. Sign out to revoke the current session.
            </p>
            <div className="flex justify-end">
                <button
                    onClick={handleLogout}
                    className="rounded-lg border border-[#2B3440] px-4 py-2 text-sm font-medium text-[#E6EEF3] hover:bg-white/5"
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
                            <h1 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-text-primary">Settings</h1>
                            <p className="text-base font-normal leading-normal text-text-secondary">Manage your security, network, and organization settings.</p>
                        </div>
                    </div>
                </div>
                {/* Settings Sections */}
                <div className="flex flex-col gap-8">
                    <WalletIdentitySection />
                    <SecuritySection />
                    <NetworkSection />
                    <PrivacySection />
                    <OrganizationRolesSection />
                    <RecoverySection />
                </div>
            </div>
            <div className="mt-8">
                <SessionInfoSection />
            </div>
        </>
    );
};

export default Settings;
