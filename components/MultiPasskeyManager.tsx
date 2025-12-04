/**
 * Multi-Passkey Manager Component
 * UI for managing corporate wallet passkeys (2-of-3 multisig)
 */

import React, { useState, useEffect } from 'react';
import {
  MultiPasskeyService,
  PasskeyInfo,
  KeyRole,
  initMultiPasskeyService,
} from '../services/multiPasskeyService';
import { SpinnerIcon } from './Icons';

// Icons
const KeyIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const PlusIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TrashIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const ShieldIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const UserIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

interface MultiPasskeyManagerProps {
  walletAddress: string;
  backendUrl: string;
  rpcUrl: string;
  onClose?: () => void;
  onPasskeyAdded?: () => void;
}

const ROLE_LABELS: Record<KeyRole, string> = {
  primary: 'Primary',
  ceo: 'CEO',
  cfo: 'CFO',
  cto: 'CTO',
  backup: 'Backup',
};

const ROLE_COLORS: Record<KeyRole, string> = {
  primary: 'bg-cyan-500/20 text-cyan-400',
  ceo: 'bg-blue-500/20 text-blue-400',
  cfo: 'bg-purple-500/20 text-purple-400',
  cto: 'bg-sky-500/20 text-sky-400',
  backup: 'bg-slate-500/20 text-slate-400',
};

const MultiPasskeyManager: React.FC<MultiPasskeyManagerProps> = ({
  walletAddress,
  backendUrl,
  rpcUrl,
  onClose,
  onPasskeyAdded,
}) => {
  const [service, setService] = useState<MultiPasskeyService | null>(null);
  const [keys, setKeys] = useState<PasskeyInfo[]>([]);
  const [threshold, setThreshold] = useState(1);
  const [activeKeyCount, setActiveKeyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // Add new passkey form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKeyEmail, setNewKeyEmail] = useState('');
  const [newKeyDeviceName, setNewKeyDeviceName] = useState('');
  const [newKeyRole, setNewKeyRole] = useState<KeyRole>('cfo');

  // Initialize service
  useEffect(() => {
    const svc = initMultiPasskeyService({
      rpcUrl,
      backendUrl,
      rpId: window.location.hostname,
      rpName: 'Arc Wallet',
    });
    svc.connect(walletAddress);
    setService(svc);
  }, [walletAddress, rpcUrl, backendUrl]);

  // Load keys
  useEffect(() => {
    if (!service) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [signingKeys, thresh, count] = await Promise.all([
          service.getSigningKeys(),
          service.getSignatureThreshold(),
          service.getActiveKeyCount(),
        ]);
        setKeys(signingKeys);
        setThreshold(thresh);
        setActiveKeyCount(count);
      } catch (error) {
        console.error('Failed to load passkey data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [service]);

  const handleAddPasskey = async () => {
    if (!service || !newKeyEmail || !newKeyDeviceName) return;

    setAdding(true);
    try {
      const result = await service.registerNewPasskey(
        newKeyEmail,
        newKeyDeviceName,
        newKeyRole
      );

      // Get calldata to add to contract
      const _callData = await service.addPasskeyToContract(result.keyHash, newKeyDeviceName);

      // Here we would execute a UserOp with this callData
      // For now, just show success
      alert(`Passkey registered! Key hash: ${result.keyHash.substring(0, 10)}...

To add this passkey to the wallet, a transaction needs to be signed by an existing owner.`);

      // Refresh keys
      const updatedKeys = await service.getSigningKeys();
      setKeys(updatedKeys);

      setShowAddForm(false);
      setNewKeyEmail('');
      setNewKeyDeviceName('');
      onPasskeyAdded?.();
    } catch (error: any) {
      alert(`Failed to add passkey: ${error.message}`);
    } finally {
      setAdding(false);
    }
  };

  const handleThresholdChange = async (newThreshold: number) => {
    if (!service) return;
    if (newThreshold < 1 || newThreshold > activeKeyCount) {
      alert(`Threshold must be between 1 and ${activeKeyCount}`);
      return;
    }

    try {
      const _callData = await service.setThreshold(newThreshold);
      alert(`Threshold change prepared. A transaction needs to be signed to apply this change.`);
    } catch (error: any) {
      alert(`Failed to set threshold: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-center py-12">
          <SpinnerIcon size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <ShieldIcon size={24} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Multi-Passkey Security</h2>
            <p className="text-sm text-slate-400">Manage corporate wallet signers</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Threshold Status */}
      <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-400">Signature Requirement</span>
          <span className="text-white font-bold text-lg">
            {threshold} of {activeKeyCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-sm">Change threshold:</span>
          <div className="flex gap-1">
            {[1, 2, 3].map((t) => (
              <button
                key={t}
                onClick={() => handleThresholdChange(t)}
                disabled={t > activeKeyCount}
                className={`w-8 h-8 rounded flex items-center justify-center text-sm font-semibold transition-colors ${
                  t === threshold
                    ? 'bg-cyan-500 text-white'
                    : t > activeKeyCount
                    ? 'bg-slate-700/50 text-slate-600 cursor-not-allowed'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {threshold === 1
            ? 'Any single passkey can authorize transactions'
            : `${threshold} different passkeys must approve each transaction`}
        </p>
      </div>

      {/* Passkeys List */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300">Registered Passkeys</h3>
          <span className="text-xs text-slate-500">{activeKeyCount} active</span>
        </div>

        {keys.length === 0 ? (
          <div className="text-center py-8">
            <KeyIcon size={32} className="text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400">No passkeys registered</p>
          </div>
        ) : (
          keys.map((key, index) => (
            <div
              key={key.keyHash}
              className={`flex items-center justify-between p-3 rounded-lg ${
                key.isActive ? 'bg-slate-800/50' : 'bg-slate-800/30 opacity-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                  <UserIcon size={20} className="text-slate-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{key.deviceName}</span>
                    {key.role && (
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ROLE_COLORS[key.role]}`}>
                        {ROLE_LABELS[key.role]}
                      </span>
                    )}
                    {index === 0 && (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-cyan-500/20 text-cyan-400">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    Added {new Date(key.addedAt * 1000).toLocaleDateString()}
                    <span className="mx-2">•</span>
                    {key.keyHash.substring(0, 10)}...
                  </div>
                </div>
              </div>
              {index !== 0 && key.isActive && activeKeyCount > threshold && (
                <button
                  className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                  title="Remove passkey"
                >
                  <TrashIcon size={16} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Passkey Form */}
      {showAddForm ? (
        <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-white mb-3">Add New Passkey</h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Owner Email</label>
              <input
                type="email"
                value={newKeyEmail}
                onChange={(e) => setNewKeyEmail(e.target.value)}
                placeholder="cfo@company.com"
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm placeholder:text-slate-500 outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Device Name</label>
              <input
                type="text"
                value={newKeyDeviceName}
                onChange={(e) => setNewKeyDeviceName(e.target.value)}
                placeholder="CFO's MacBook Pro"
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm placeholder:text-slate-500 outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Role</label>
              <select
                value={newKeyRole}
                onChange={(e) => setNewKeyRole(e.target.value as KeyRole)}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm outline-none focus:border-cyan-500"
              >
                <option value="ceo">CEO</option>
                <option value="cfo">CFO</option>
                <option value="cto">CTO</option>
                <option value="backup">Backup</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleAddPasskey}
                disabled={adding || !newKeyEmail || !newKeyDeviceName}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {adding ? <SpinnerIcon size={16} /> : <KeyIcon size={16} />}
                {adding ? 'Registering...' : 'Register Passkey'}
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewKeyEmail('');
                  setNewKeyDeviceName('');
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-lg transition-colors border border-dashed border-slate-600/50"
        >
          <PlusIcon size={20} />
          Add Passkey
        </button>
      )}

      {/* Info Box */}
      <div className="mt-6 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
        <p className="text-cyan-400 text-sm">
          <strong>2-of-3 Multi-Signature Security</strong>
        </p>
        <p className="text-cyan-300/70 text-xs mt-1">
          For maximum security, add passkeys for CEO, CFO, and CTO. Set threshold to 2 to require
          any two executives to approve transactions. This protects against single points of failure
          and enables recovery if one passkey is lost.
        </p>
      </div>
    </div>
  );
};

export default MultiPasskeyManager;
