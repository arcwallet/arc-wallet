import React, { useEffect, useMemo, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { passkeyClient, type SessionKeySummary } from '../services/passkeyClient';
import { WalletIcon, CopyIcon, AddIcon, LaptopIcon, PhoneIcon, ChevronDownIcon } from './Icons';

const WalletIdentitySection: React.FC = () => {
    const { address } = useWallet();
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
                    <button onClick={handleAddDevice} className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#2B3440] bg-transparent px-4 text-sm font-medium text-[#E6EEF3] hover:bg-white/5">
                        <AddIcon size={18} />
                        <span className="truncate">Add New Device (Passkey)</span>
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
                                    <td className="px-4 py-3 font-mono text-[#E6EEF3]">{`${k.address.slice(0,6)}...${k.address.slice(-4)}`}{isCurrent && <span className="ml-2 text-green-400">(current)</span>}</td>
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
                                <td className="px-4 py-3 text-[#E6EEF3] break-all">{d.credentialID.slice(0,12)}…{d.credentialID.slice(-8)}</td>
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

const OrganizationRolesSection: React.FC = () => (
    <div className="flex flex-col gap-4 rounded-xl bg-[#151A22] p-5 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <h3 className="text-lg font-semibold text-[#E6EEF3]">Organization Roles</h3>
            <button className="flex h-10 w-full shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-[#9EBBE4] px-4 text-sm font-semibold text-[#091325] hover:bg-[#B9D1ED] sm:w-auto">
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
                    <tr>
                        <td className="py-3.5 pr-4 font-mono text-[#E6EEF3]">0x8a1b…eFc9</td>
                        <td className="px-4 py-3.5 text-[#E6EEF3]">Owner</td>
                        <td className="py-3.5 pl-4 text-[#E6EEF3]">Active</td>
                    </tr>
                    <tr>
                        <td className="py-3.5 pr-4 font-mono text-[#E6EEF3]">0x3fD4…bA72</td>
                        <td className="px-4 py-3.5 text-[#E6EEF3]">Member</td>
                        <td className="py-3.5 pl-4 text-[#E6EEF3]">Active</td>
                    </tr>
                    <tr>
                        <td className="py-3.5 pr-4 font-mono text-[#E6EEF3]">0x5c7e…dD01</td>
                        <td className="px-4 py-3.5 text-[#E6EEF3]">Member</td>
                        <td className="py-3.5 pl-4 text-[#E6EEF3]">Pending</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
);

const RecoverySection: React.FC = () => (
    <div className="flex flex-col items-start gap-3 rounded-xl bg-[#151A22]/70 p-5 sm:p-6">
        <h3 className="text-base font-semibold text-[#E6EEF3]">Recovery Options</h3>
        <p className="text-sm text-[#A7B4C8]">Your organization recovery policy defines how this wallet can be restored if devices are lost.</p>
        <button className="mt-1 text-sm font-medium text-[#9EBBE4] hover:text-[#B9D1ED]">View Recovery Policy</button>
    </div>
);


const Settings: React.FC = () => {
  return (
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
        <OrganizationRolesSection />
        <RecoverySection />
      </div>
    </div>
  );
};

export default Settings;