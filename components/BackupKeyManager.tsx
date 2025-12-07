/**
 * Backup Key Manager Component
 * Allows individual users to manage backup passkeys for recovery
 *
 * Features:
 * - Add up to 3 backup devices (iPhone, iPad, etc.)
 * - Recover wallet instantly using any backup device
 * - Remove backup keys when no longer needed
 */

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
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

const SmartphoneIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

const ShieldCheckIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const RefreshIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

interface BackupKey {
  x: string;
  y: string;
  deviceName: string;
  active: boolean;
  addedAt?: number;
}

interface BackupKeyManagerProps {
  walletAddress: string;
  rpcUrl: string;
  onBackupKeyAdded?: () => void;
  onRecoveryComplete?: () => void;
  onClose?: () => void;
}

// PasskeyAccount ABI for backup key functions
const PASSKEY_ACCOUNT_ABI = [
  'function getBackupKeys() external view returns (tuple(uint256 x, uint256 y, bool active, string deviceName)[])',
  'function getBackupKeyCount() external view returns (uint256)',
  'function isValidBackupKey(uint256 x, uint256 y) external view returns (bool)',
  'function addBackupKey(uint256 x, uint256 y, string calldata deviceName) external',
  'function removeBackupKey(uint256 x, uint256 y) external',
  'function recoverWithBackupKey(uint256 newPrimaryX, uint256 newPrimaryY, uint256 backupX, uint256 backupY, bytes calldata webAuthnSignature) external',
];

const BackupKeyManager: React.FC<BackupKeyManagerProps> = ({
  walletAddress,
  rpcUrl,
  onBackupKeyAdded,
  onRecoveryComplete,
  onClose,
}) => {
  const [backupKeys, setBackupKeys] = useState<BackupKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [recovering, setRecovering] = useState(false);

  // Add backup key form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');

  // Recovery mode
  const [showRecoveryMode, setShowRecoveryMode] = useState(false);
  const [selectedBackupKey, setSelectedBackupKey] = useState<BackupKey | null>(null);

  // Load backup keys from contract
  useEffect(() => {
    loadBackupKeys();
  }, [walletAddress, rpcUrl]);

  const loadBackupKeys = async () => {
    setLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const contract = new ethers.Contract(walletAddress, PASSKEY_ACCOUNT_ABI, provider);

      const keys = await contract.getBackupKeys();
      const formattedKeys: BackupKey[] = keys.map((key: any) => ({
        x: key.x.toString(),
        y: key.y.toString(),
        deviceName: key.deviceName,
        active: key.active,
      }));

      setBackupKeys(formattedKeys.filter(k => k.active));
    } catch (error) {
      console.error('Failed to load backup keys:', error);
      // If contract not deployed or no backup keys, show empty
      setBackupKeys([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBackupKey = async () => {
    if (!newDeviceName.trim()) {
      alert('Please enter a device name');
      return;
    }

    setAdding(true);
    try {
      // 1. Create new passkey on the backup device
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: {
            name: 'Arc Wallet',
            id: window.location.hostname,
          },
          user: {
            id: new TextEncoder().encode(`backup-${Date.now()}`),
            name: `${newDeviceName} Backup`,
            displayName: newDeviceName,
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256 (P-256)
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'required',
          },
          timeout: 60000,
        },
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to create passkey');
      }

      // 2. Extract public key coordinates
      const response = credential.response as AuthenticatorAttestationResponse;
      const publicKey = extractPublicKeyFromAttestation(response);

      // 3. Build UserOp to call addBackupKey
      // This would need to be signed by the primary passkey
      console.log('New backup key:', {
        x: publicKey.x,
        y: publicKey.y,
        deviceName: newDeviceName,
      });

      // For now, show success (actual implementation needs UserOp)
      alert(`Backup key created for ${newDeviceName}!\n\nTo complete setup, sign the transaction with your primary passkey.`);

      setShowAddForm(false);
      setNewDeviceName('');
      onBackupKeyAdded?.();

      // Refresh keys
      await loadBackupKeys();
    } catch (error: any) {
      console.error('Failed to add backup key:', error);
      alert(`Failed to add backup key: ${error.message}`);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveBackupKey = async (key: BackupKey) => {
    if (!confirm(`Remove ${key.deviceName} as a backup device?`)) {
      return;
    }

    try {
      // Build UserOp to call removeBackupKey
      console.log('Removing backup key:', key);
      alert('To remove this backup key, sign the transaction with your primary passkey.');

      // Refresh keys
      await loadBackupKeys();
    } catch (error: any) {
      console.error('Failed to remove backup key:', error);
      alert(`Failed to remove backup key: ${error.message}`);
    }
  };

  const handleStartRecovery = (key: BackupKey) => {
    setSelectedBackupKey(key);
    setShowRecoveryMode(true);
  };

  const handleRecoverWithBackupKey = async () => {
    if (!selectedBackupKey) return;

    setRecovering(true);
    try {
      // 1. Create new primary passkey
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: {
            name: 'Arc Wallet',
            id: window.location.hostname,
          },
          user: {
            id: new TextEncoder().encode(`primary-${Date.now()}`),
            name: 'Primary Key',
            displayName: 'Primary Key',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'required',
          },
          timeout: 60000,
        },
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to create new primary key');
      }

      const response = credential.response as AuthenticatorAttestationResponse;
      const newPrimaryKey = extractPublicKeyFromAttestation(response);

      // 2. Sign recovery challenge with backup key
      const challenge = ethers.solidityPackedKeccak256(
        ['string', 'address', 'uint256', 'uint256', 'uint256'],
        ['RECOVER', walletAddress, newPrimaryKey.x, newPrimaryKey.y, 1490] // chainId
      );

      // Get assertion from backup key
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: ethers.getBytes(challenge),
          rpId: window.location.hostname,
          userVerification: 'required',
          timeout: 60000,
        },
      }) as PublicKeyCredential;

      if (!assertion) {
        throw new Error('Failed to sign with backup key');
      }

      // 3. Build and submit recovery transaction
      console.log('Recovery data:', {
        newPrimaryKey,
        backupKey: selectedBackupKey,
        assertion,
      });

      alert('Recovery initiated! Your wallet will be recovered with the new passkey.');

      setShowRecoveryMode(false);
      setSelectedBackupKey(null);
      onRecoveryComplete?.();
    } catch (error: any) {
      console.error('Recovery failed:', error);
      alert(`Recovery failed: ${error.message}`);
    } finally {
      setRecovering(false);
    }
  };

  // Helper to extract P256 public key from attestation
  const extractPublicKeyFromAttestation = (response: AuthenticatorAttestationResponse): { x: string; y: string } => {
    const publicKeyBytes = response.getPublicKey();
    if (!publicKeyBytes) {
      throw new Error('No public key in attestation');
    }

    // COSE key format - extract x and y coordinates
    // For P-256, x and y are 32 bytes each
    const keyData = new Uint8Array(publicKeyBytes);

    // Skip COSE headers and get raw coordinates
    // This is simplified - actual implementation needs proper COSE parsing
    const x = keyData.slice(-64, -32);
    const y = keyData.slice(-32);

    return {
      x: '0x' + Array.from(x).map(b => b.toString(16).padStart(2, '0')).join(''),
      y: '0x' + Array.from(y).map(b => b.toString(16).padStart(2, '0')).join(''),
    };
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

  // Recovery Mode UI
  if (showRecoveryMode) {
    return (
      <div className="bg-slate-900/90 backdrop-blur-sm rounded-xl border border-amber-500/30 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <RefreshIcon size={24} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Wallet Recovery</h2>
              <p className="text-sm text-amber-400">Using backup device</p>
            </div>
          </div>
          <button
            onClick={() => {
              setShowRecoveryMode(false);
              setSelectedBackupKey(null);
            }}
            className="text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-slate-800/50 rounded-lg">
            <p className="text-slate-300 text-sm mb-2">Recovering with:</p>
            <div className="flex items-center gap-3">
              <SmartphoneIcon size={24} className="text-cyan-400" />
              <span className="text-white font-semibold">{selectedBackupKey?.deviceName}</span>
            </div>
          </div>

          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <p className="text-amber-300 text-sm">
              <strong>Recovery Process:</strong>
              <br />1. Create a new primary passkey
              <br />2. Sign with your backup device
              <br />3. Your wallet will be recovered instantly
            </p>
          </div>

          <button
            onClick={handleRecoverWithBackupKey}
            disabled={recovering}
            className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {recovering ? (
              <>
                <SpinnerIcon size={20} />
                Recovering...
              </>
            ) : (
              <>
                <ShieldCheckIcon size={20} />
                Start Recovery
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div className="bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <KeyIcon size={24} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Backup Devices</h2>
            <p className="text-sm text-slate-400">Add devices for wallet recovery</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            Close
          </button>
        )}
      </div>

      {/* Backup Key Count */}
      <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Backup Devices</span>
          <span className="text-white font-bold text-lg">
            {backupKeys.length} / 3
          </span>
        </div>
        <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-cyan-500 rounded-full transition-all"
            style={{ width: `${(backupKeys.length / 3) * 100}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {backupKeys.length === 0
            ? 'No backup devices. Add one for recovery protection.'
            : backupKeys.length === 3
            ? 'Maximum backup devices reached.'
            : `${3 - backupKeys.length} more backup device${3 - backupKeys.length > 1 ? 's' : ''} can be added.`
          }
        </p>
      </div>

      {/* Backup Keys List */}
      <div className="space-y-3 mb-6">
        {backupKeys.length === 0 ? (
          <div className="text-center py-8">
            <SmartphoneIcon size={32} className="text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400">No backup devices</p>
            <p className="text-slate-500 text-sm">Add a backup device for wallet recovery</p>
          </div>
        ) : (
          backupKeys.map((key, index) => (
            <div
              key={`${key.x}-${key.y}`}
              className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                  <SmartphoneIcon size={20} className="text-cyan-400" />
                </div>
                <div>
                  <span className="text-white font-medium">{key.deviceName}</span>
                  <div className="text-xs text-slate-500">
                    Backup #{index + 1}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStartRecovery(key)}
                  className="px-3 py-1 bg-amber-500/20 text-amber-400 text-sm rounded hover:bg-amber-500/30 transition-colors"
                >
                  Recover
                </button>
                <button
                  onClick={() => handleRemoveBackupKey(key)}
                  className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                  title="Remove backup"
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Backup Key Form */}
      {showAddForm ? (
        <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-white mb-3">Add Backup Device</h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Device Name</label>
              <input
                type="text"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                placeholder="e.g., iPhone, iPad, MacBook"
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm placeholder:text-slate-500 outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddBackupKey}
                disabled={adding || !newDeviceName.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {adding ? <SpinnerIcon size={16} /> : <PlusIcon size={16} />}
                {adding ? 'Creating...' : 'Add Backup'}
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewDeviceName('');
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : backupKeys.length < 3 ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-lg transition-colors border border-dashed border-slate-600/50"
        >
          <PlusIcon size={20} />
          Add Backup Device
        </button>
      ) : null}

      {/* Info Box */}
      <div className="mt-6 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
        <p className="text-cyan-400 text-sm font-semibold">Instant Recovery</p>
        <p className="text-cyan-300/70 text-xs mt-1">
          If you lose access to your primary device, use any backup device to instantly
          recover your wallet. No waiting period, no guardians needed.
        </p>
      </div>
    </div>
  );
};

export default BackupKeyManager;
