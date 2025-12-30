/**
 * Wallet Recovery Component
 * Allows corporate wallet recovery using 2-of-3 passkeys
 *
 * Recovery Scenarios:
 * 1. Lost Device: Use 2 other passkeys to add a new key
 * 2. Key Rotation: Use 2 passkeys to replace a compromised key
 * 3. Emergency Access: 2 executives can recover if one is unavailable
 */

import React, { useState } from 'react';
import { SpinnerIcon } from './Icons';

// Icons
const ShieldOffIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19.69 14a6.9 6.9 0 0 0 .31-2V5l-8-3-3.16 1.18" />
    <path d="M4.73 4.73L4 5v7c0 6 8 10 8 10a20.29 20.29 0 0 0 5.62-4.38" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const RefreshIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const UserPlusIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="20" y1="8" x2="20" y2="14" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
);

const AlertTriangleIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const CheckCircleIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

type RecoveryStep = 'select' | 'verify1' | 'verify2' | 'newkey' | 'complete';

interface WalletRecoveryProps {
  walletAddress: string;
  availableKeys: Array<{
    keyHash: string;
    deviceName: string;
    role: string;
    isActive: boolean;
  }>;
  onRecoveryComplete?: () => void;
  onClose?: () => void;
}

const WalletRecovery: React.FC<WalletRecoveryProps> = ({
  walletAddress,
  availableKeys,
  onRecoveryComplete,
  onClose,
}) => {
  const [step, setStep] = useState<RecoveryStep>('select');
  const [recoveryType, setRecoveryType] = useState<'add' | 'replace' | null>(null);
  const [verifiedKeys, setVerifiedKeys] = useState<string[]>([]);
  const [selectedKeyToReplace, setSelectedKeyToReplace] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // New key form
  const [newKeyEmail, setNewKeyEmail] = useState('');
  const [newKeyDeviceName, setNewKeyDeviceName] = useState('');
  const [newKeyRole, setNewKeyRole] = useState('backup');

  const handleVerifyKey = async (keyHash: string) => {
    setLoading(true);
    try {
      // In real implementation, this would trigger WebAuthn authentication
      // and verify the signature on-chain
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate

      setVerifiedKeys([...verifiedKeys, keyHash]);

      // Move to next step if 2 keys verified
      if (verifiedKeys.length === 0) {
        setStep('verify2');
      } else if (verifiedKeys.length === 1) {
        setStep('newkey');
      }
    } catch (error) {
      alert('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewKey = async () => {
    if (!newKeyEmail || !newKeyDeviceName) {
      alert('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      // In real implementation:
      // 1. Create new passkey
      // 2. Build UserOp for addSigningKey
      // 3. Sign with both verified keys
      // 4. Submit to bundler
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate

      setStep('complete');
      onRecoveryComplete?.();
    } catch (error) {
      alert('Failed to add new key. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const activeKeys = availableKeys.filter(k => k.isActive);
  const unverifiedKeys = activeKeys.filter(k => !verifiedKeys.includes(k.keyHash));

  return (
    <div className="bg-[#091325] backdrop-blur-sm rounded-xl border border-slate-500/50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <ShieldOffIcon size={24} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#E6EEF3]">Wallet Recovery</h2>
            <p className="text-sm text-amber-400">2-of-3 Multi-Sig Recovery</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[#A7B4C8] hover:text-[#E6EEF3] transition-colors p-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* Step: Select Recovery Type */}
      {step === 'select' && (
        <div className="space-y-4">
          <p className="text-[#A7B4C8] text-sm mb-4">
            Select the recovery action you need to perform:
          </p>

          <button
            onClick={() => {
              setRecoveryType('add');
              setStep('verify1');
            }}
            className="w-full flex items-center gap-4 p-4 bg-[#151A22] hover:bg-[#151A22]/80 rounded-lg border border-slate-500/30 hover:border-slate-400 transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 border border-blue-500/20">
              <UserPlusIcon size={24} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-[#E6EEF3] font-semibold">Add New Passkey</h3>
              <p className="text-[#A7B4C8] text-sm">
                Lost a device? Add a new passkey with approval from 2 existing signers
              </p>
            </div>
          </button>

          <button
            onClick={() => {
              setRecoveryType('replace');
              setStep('verify1');
            }}
            className="w-full flex items-center gap-4 p-4 bg-[#151A22] hover:bg-[#151A22]/80 rounded-lg border border-slate-500/30 hover:border-slate-400 transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 border border-amber-500/20">
              <RefreshIcon size={24} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-[#E6EEF3] font-semibold">Replace Compromised Key</h3>
              <p className="text-[#A7B4C8] text-sm">
                Key compromised? Remove it and add a replacement with 2-of-3 approval
              </p>
            </div>
          </button>

          <div className="mt-6 p-3 bg-[#151A22] rounded-lg border border-slate-500/20">
            <p className="text-[#A7B4C8] text-xs">
              <strong className="text-[#E6EEF3]">Security Note:</strong> Recovery requires verification
              from 2 of your 3 registered passkeys. Each signer must authenticate with their device.
            </p>
          </div>
        </div>
      )}

      {/* Step: Verify First Key */}
      {step === 'verify1' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <span className="text-blue-400 font-bold text-sm">1</span>
            </div>
            <span className="text-[#E6EEF3] font-semibold">First Signer Verification</span>
          </div>

          <p className="text-[#A7B4C8] text-sm mb-4">
            Select a passkey to verify your identity:
          </p>

          <div className="space-y-2">
            {unverifiedKeys.map((key) => (
              <button
                key={key.keyHash}
                onClick={() => handleVerifyKey(key.keyHash)}
                disabled={loading}
                className="w-full flex items-center justify-between p-3 bg-[#151A22] hover:bg-[#151A22]/80 rounded-lg border border-slate-500/30 hover:border-slate-400 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-500/10 flex items-center justify-center border border-slate-500/20">
                    <span className="text-[#A7B4C8] text-sm font-bold">
                      {key.role[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="text-[#E6EEF3] font-medium">{key.deviceName}</p>
                    <p className="text-[#A7B4C8]/70 text-xs">{key.role.toUpperCase()}</p>
                  </div>
                </div>
                {loading ? (
                  <SpinnerIcon size={20} />
                ) : (
                  <span className="text-[#A7B4C8] hover:text-[#E6EEF3] text-sm">Verify →</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: Verify Second Key */}
      {step === 'verify2' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
              <CheckCircleIcon size={16} className="text-green-400" />
            </div>
            <span className="text-green-400 text-sm">First signer verified</span>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <span className="text-blue-400 font-bold text-sm">2</span>
            </div>
            <span className="text-[#E6EEF3] font-semibold">Second Signer Verification</span>
          </div>

          <p className="text-[#A7B4C8] text-sm mb-4">
            Now verify with a different passkey:
          </p>

          <div className="space-y-2">
            {unverifiedKeys.map((key) => (
              <button
                key={key.keyHash}
                onClick={() => handleVerifyKey(key.keyHash)}
                disabled={loading}
                className="w-full flex items-center justify-between p-3 bg-[#151A22] hover:bg-[#151A22]/80 rounded-lg border border-slate-500/30 hover:border-slate-400 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-500/10 flex items-center justify-center border border-slate-500/20">
                    <span className="text-[#A7B4C8] text-sm font-bold">
                      {key.role[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="text-[#E6EEF3] font-medium">{key.deviceName}</p>
                    <p className="text-[#A7B4C8]/70 text-xs">{key.role.toUpperCase()}</p>
                  </div>
                </div>
                {loading ? (
                  <SpinnerIcon size={20} />
                ) : (
                  <span className="text-[#A7B4C8] hover:text-[#E6EEF3] text-sm">Verify →</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: Add New Key */}
      {step === 'newkey' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircleIcon size={20} className="text-green-400" />
            <span className="text-green-400 text-sm">2 of 3 signers verified</span>
          </div>

          {recoveryType === 'replace' && (
            <div className="mb-4">
              <label className="text-xs text-[#A7B4C8] mb-1 block">
                Select key to replace:
              </label>
              <select
                value={selectedKeyToReplace || ''}
                onChange={(e) => setSelectedKeyToReplace(e.target.value)}
                className="w-full px-3 py-2 bg-[#151A22] border border-slate-500/50 rounded-lg text-[#E6EEF3] text-sm outline-none focus:border-slate-400"
              >
                <option value="">Select a key...</option>
                {activeKeys
                  .filter(k => !verifiedKeys.includes(k.keyHash))
                  .map((key) => (
                    <option key={key.keyHash} value={key.keyHash}>
                      {key.deviceName} ({key.role})
                    </option>
                  ))}
              </select>
            </div>
          )}

          <h3 className="text-[#E6EEF3] font-semibold">Register New Passkey</h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#A7B4C8] mb-1 block">Owner Email</label>
              <input
                type="email"
                value={newKeyEmail}
                onChange={(e) => setNewKeyEmail(e.target.value)}
                placeholder="newuser@company.com"
                className="w-full px-3 py-2 bg-[#151A22] border border-slate-500/50 rounded-lg text-[#E6EEF3] text-sm placeholder:text-[#A7B4C8]/50 outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="text-xs text-[#A7B4C8] mb-1 block">Device Name</label>
              <input
                type="text"
                value={newKeyDeviceName}
                onChange={(e) => setNewKeyDeviceName(e.target.value)}
                placeholder="CFO's New MacBook"
                className="w-full px-3 py-2 bg-[#151A22] border border-slate-500/50 rounded-lg text-[#E6EEF3] text-sm placeholder:text-[#A7B4C8]/50 outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="text-xs text-[#A7B4C8] mb-1 block">Role</label>
              <select
                value={newKeyRole}
                onChange={(e) => setNewKeyRole(e.target.value)}
                className="w-full px-3 py-2 bg-[#151A22] border border-slate-500/50 rounded-lg text-[#E6EEF3] text-sm outline-none focus:border-slate-400"
              >
                <option value="ceo">CEO</option>
                <option value="cfo">CFO</option>
                <option value="cto">CTO</option>
                <option value="backup">Backup</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangleIcon size={20} className="text-amber-400 flex-shrink-0" />
            <p className="text-amber-300/80 text-xs">
              This action will {recoveryType === 'replace' ? 'replace the compromised key with' : 'add'} a new passkey.
              The new owner must register their passkey on this device.
            </p>
          </div>

          <button
            onClick={handleAddNewKey}
            disabled={loading || !newKeyEmail || !newKeyDeviceName}
            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-200 hover:bg-white text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <SpinnerIcon size={20} />
                Processing Recovery...
              </>
            ) : (
              <>
                <UserPlusIcon size={20} />
                Complete Recovery
              </>
            )}
          </button>
        </div>
      )}

      {/* Step: Complete */}
      {step === 'complete' && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4 border border-green-500/20">
            <CheckCircleIcon size={40} className="text-green-400" />
          </div>
          <h3 className="text-xl font-bold text-[#E6EEF3] mb-2">Recovery Complete!</h3>
          <p className="text-[#A7B4C8] mb-6">
            The new passkey has been added to your wallet.
            {recoveryType === 'replace' && ' The compromised key has been removed.'}
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 hover:bg-white text-slate-900 font-semibold rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      )}

      {/* Progress Indicator */}
      {step !== 'select' && step !== 'complete' && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {['verify1', 'verify2', 'newkey'].map((s, i) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full ${
                ['verify1', 'verify2', 'newkey'].indexOf(step) >= i
                  ? 'bg-blue-400'
                  : 'bg-slate-600'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default WalletRecovery;
