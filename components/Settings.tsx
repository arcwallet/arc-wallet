import React, { useEffect, useMemo, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useSession } from '../contexts/SessionContext';
import { usePasskeyAccount } from '../contexts/PasskeyAccountContext';
import { useSelfCustodialWallet } from '../contexts/SelfCustodialWalletContext';

import { passkeyClient, type SessionKeySummary } from '../services/passkeyClient';
import { WalletIcon, CopyIcon, AddIcon, LaptopIcon, PhoneIcon, ChevronDownIcon, LockIcon, KeyIcon } from './Icons';

import WebhookManager from './WebhookManager';
import NotificationManager from './NotificationManager';

import { ARC_TESTNET_CONTRACTS, KEY_TYPE } from '../config/contracts';

const SecuritySection: React.FC = () => {
    const { address: passkeyAddress } = usePasskeyAccount();
    const { userId, address: selfCustodialAddress } = useSelfCustodialWallet();
    const address = passkeyAddress || selfCustodialAddress;
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
    const { address: passkeyAddress } = usePasskeyAccount();
    const { address: selfCustodialAddress } = useSelfCustodialWallet();
    const address = passkeyAddress || selfCustodialAddress;
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



// Smart Wallet Section - Shows ArcAccount contract info
const SmartWalletSection: React.FC = () => {
    const { address: passkeyAddress } = usePasskeyAccount();
    const { address: selfCustodialAddress } = useSelfCustodialWallet();
    const address = passkeyAddress || selfCustodialAddress;
    const [copied, setCopied] = useState<string | null>(null);

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    const truncateAddress = (addr: string) => `${addr.slice(0, 10)}...${addr.slice(-8)}`;

    const contracts = [
        { name: 'ArcAccount Factory', address: ARC_TESTNET_CONTRACTS.arcAccountFactory, description: 'Creates new smart wallets' },
        { name: 'ArcAccount Implementation', address: ARC_TESTNET_CONTRACTS.arcAccountImplementation, description: 'Multi-key wallet logic' },
        { name: 'P256 Verifier', address: ARC_TESTNET_CONTRACTS.p256Verifier, description: 'WebAuthn signature verification' },
        { name: 'EntryPoint (ERC-4337)', address: ARC_TESTNET_CONTRACTS.entryPoint, description: 'Account Abstraction entry' },
    ];

    return (
        <div className="flex flex-col gap-4 rounded-xl bg-gradient-to-br from-indigo-900/30 to-purple-900/20 border border-indigo-500/30 p-5 sm:p-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                        <span className="text-xl">🔐</span> Smart Wallet (Multi-Key)
                    </h3>
                    <p className="text-sm text-slate-400">ERC-4337 Account Abstraction with P256 passkey support</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                        Arc Testnet
                    </span>
                </div>
            </div>

            <div className="grid gap-3">
                {contracts.map((contract) => (
                    <div key={contract.name} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-600/30">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium text-slate-200">{contract.name}</span>
                            <span className="text-xs text-slate-500">{contract.description}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <code className="text-xs text-indigo-300 font-mono bg-indigo-900/30 px-2 py-1 rounded">
                                {truncateAddress(contract.address)}
                            </code>
                            <button
                                onClick={() => copyToClipboard(contract.address, contract.name)}
                                className="p-1.5 rounded hover:bg-white/10 transition-colors"
                                title="Copy address"
                            >
                                {copied === contract.name ? (
                                    <span className="text-green-400 text-xs">✓</span>
                                ) : (
                                    <CopyIcon size={14} className="text-slate-400" />
                                )}
                            </button>
                            <a
                                href={`https://explorer.arc.network/address/${contract.address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-200"
                                title="View on Explorer"
                            >
                                ↗
                            </a>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-2 p-4 rounded-lg bg-slate-800/30 border border-slate-600/20">
                <h4 className="text-sm font-medium text-slate-300 mb-3">Features</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-400">
                        <span className="text-green-400">✓</span> Multi-device support (up to 20 keys)
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                        <span className="text-green-400">✓</span> WebAuthn/Passkey authentication
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                        <span className="text-green-400">✓</span> 1-of-n signature (any key can sign)
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                        <span className="text-green-400">✓</span> Batch transactions
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                        <span className="text-green-400">✓</span> ECDSA & P256 curve support
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                        <span className="text-green-400">✓</span> Upgradeable (UUPS proxy)
                    </div>
                </div>
            </div>

            <p className="text-xs text-slate-500">
                Smart wallets allow multiple devices to control one account. Add passkeys for biometric authentication or link external wallets.
            </p>
        </div>
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
                    <SecuritySection />

                    <SmartWalletSection />

                    <NetworkSection />

                    <OrganizationRolesSection />
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
