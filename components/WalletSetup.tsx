/**
 * Wallet Setup Component
 * Self-custodial wallet creation and import
 */

import React, { useState, useEffect } from 'react';
import { useSelfCustodialWallet } from '../contexts/SelfCustodialWalletContext';

import { validatePassword, getPasswordStrengthLabel, getPasswordStrengthColor } from '../utils/passwordValidation';
import { WaveBackground } from './WaveBackground';
import arcLogo from '../assets/arclogo.png';

type SetupStep = 'choice' | 'create' | 'import' | 'backup';

interface WalletSetupProps {
  onComplete: () => void;
}

const WalletSetup: React.FC<WalletSetupProps> = ({ onComplete }) => {
  const {
    createWallet,
    importWallet,
    needsBackup,
    getMnemonic,
    markBackedUp,
    isConnecting
  } = useSelfCustodialWallet();

  const [step, setStep] = useState<SetupStep>('choice');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [importInput, setImportInput] = useState('');
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ isValid: false, score: 0, feedback: [] as string[] });

  // Update password strength on password change
  useEffect(() => {
    if (password) {
      setPasswordStrength(validatePassword(password));
    } else {
      setPasswordStrength({ isValid: false, score: 0, feedback: [] });
    }
  }, [password]);

  // Check for existing mnemonic needing backup and URL errors
  useEffect(() => {
    if (needsBackup) {
      const existingMnemonic = getMnemonic();
      if (existingMnemonic) {
        setMnemonic(existingMnemonic);
        setStep('backup');
      }
    }

    // Check for error in URL (e.g. from OAuth failure)
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [needsBackup, getMnemonic]);

  // Handle wallet creation
  const handleCreate = async () => {
    setError(null);

    if (!passwordStrength.isValid) {
      setError('Password does not meet security requirements');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const result = await createWallet(password);
      if (result.mnemonic) {
        setMnemonic(result.mnemonic);
        setStep('backup');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create wallet');
    }
  };

  // Handle wallet import
  const handleImport = async () => {
    setError(null);

    if (!importInput.trim()) {
      setError('Please enter a seed phrase or private key');
      return;
    }

    if (!passwordStrength.isValid) {
      setError('Password does not meet security requirements');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      await importWallet(importInput.trim(), password);
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to import wallet');
    }
  };

  // Handle backup confirmation
  const handleBackupConfirm = () => {
    if (!backupConfirmed) {
      setError('Please confirm you have saved your backup');
      return;
    }
    markBackedUp();
    onComplete();
  };

  // Render choice step
  const renderChoice = () => (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-light text-slate-100 tracking-tight drop-shadow-lg">
          Setup Your Wallet
        </h2>
        <p className="text-slate-400 text-lg">
          Your keys, your crypto. Create a new wallet or import an existing one.
        </p>
      </div>

      <div className="space-y-4">
        <button
          onClick={() => setStep('create')}
          className="w-full p-6 rounded-lg border border-slate-500/50 bg-slate-900/60 hover:border-blue-400 hover:bg-slate-900/80 transition-all backdrop-blur-sm text-left group"
        >
          <p className="font-semibold text-slate-100 text-lg mb-2">Create New Wallet</p>
          <p className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
            Generate a new wallet with a secure seed phrase
          </p>
        </button>

        <button
          onClick={() => setStep('import')}
          className="w-full p-6 rounded-lg border border-slate-500/50 bg-slate-900/60 hover:border-blue-400 hover:bg-slate-900/80 transition-all backdrop-blur-sm text-left group"
        >
          <p className="font-semibold text-slate-100 text-lg mb-2">Import Existing Wallet</p>
          <p className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
            Restore using seed phrase or private key
          </p>
        </button>
      </div>



      <div className="p-4 rounded-lg bg-amber-900/20 border border-amber-500/50 backdrop-blur-sm">
        <p className="text-sm text-amber-200">
          <strong>Self-Custodial:</strong> Your private keys are encrypted and stored only on this device.
          We never have access to your keys.
        </p>
      </div>
    </div>
  );

  // Render create step
  const renderCreate = () => (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-light text-slate-100 tracking-tight drop-shadow-lg">
          Create New Wallet
        </h2>
        <p className="text-slate-400 text-lg">
          Set a strong password to encrypt your wallet
        </p>
      </div>

      <div className="space-y-6">
        <div className="group">
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full bg-slate-900/60 border border-slate-500/50 rounded-lg px-4 py-4 text-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all backdrop-blur-sm"
            />
            <div className="absolute inset-0 rounded-lg bg-blue-500/5 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-500" />
          </div>
          {password && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${(passwordStrength.score / 4) * 100}%`,
                      backgroundColor: getPasswordStrengthColor(passwordStrength.score)
                    }}
                  />
                </div>
                <span
                  className="text-xs font-medium"
                  style={{ color: getPasswordStrengthColor(passwordStrength.score) }}
                >
                  {getPasswordStrengthLabel(passwordStrength.score)}
                </span>
              </div>
              {passwordStrength.feedback.length > 0 && (
                <ul className="text-xs text-slate-400 space-y-1">
                  {passwordStrength.feedback.map((msg, i) => (
                    <li key={i}>• {msg}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="group">
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full bg-slate-900/60 border border-slate-500/50 rounded-lg px-4 py-4 text-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all backdrop-blur-sm"
            />
            <div className="absolute inset-0 rounded-lg bg-blue-500/5 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-500" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="text-sm text-slate-400 hover:text-blue-400 transition-colors"
        >
          {showPassword ? 'Hide' : 'Show'} passwords
        </button>

        {error && (
          <div className="p-3 rounded-lg backdrop-blur-sm border bg-red-900/20 border-red-500/50 text-red-200 text-center text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setStep('choice')}
            className="flex-1 bg-transparent border border-slate-500/50 text-slate-300 hover:text-white hover:border-slate-400 font-medium text-lg py-3.5 rounded-lg transition-all duration-200"
          >
            Back
          </button>
          <button
            onClick={handleCreate}
            disabled={isConnecting}
            className="flex-1 bg-slate-200 hover:bg-white text-slate-900 font-medium text-lg py-3.5 rounded-lg transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Creating...' : 'Create Wallet'}
          </button>
        </div>
      </div>
    </div>
  );

  // Render import step
  const renderImport = () => (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-light text-slate-100 tracking-tight drop-shadow-lg">
          Import Wallet
        </h2>
        <p className="text-slate-400 text-lg">
          Enter your seed phrase or private key
        </p>
      </div>

      <div className="space-y-6">
        <div className="group">
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Seed Phrase or Private Key
          </label>
          <div className="relative">
            <textarea
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder="Enter 12 or 24 word seed phrase, or private key (0x...)"
              rows={4}
              className="w-full bg-slate-900/60 border border-slate-500/50 rounded-lg px-4 py-4 text-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all backdrop-blur-sm font-mono resize-none"
            />
            <div className="absolute inset-0 rounded-lg bg-blue-500/5 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-500" />
          </div>
        </div>

        <div className="group">
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Encryption Password
          </label>
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Set a password for this device"
              className="w-full bg-slate-900/60 border border-slate-500/50 rounded-lg px-4 py-4 text-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all backdrop-blur-sm"
            />
            <div className="absolute inset-0 rounded-lg bg-blue-500/5 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-500" />
          </div>
          {password && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${(passwordStrength.score / 4) * 100}%`,
                      backgroundColor: getPasswordStrengthColor(passwordStrength.score)
                    }}
                  />
                </div>
                <span
                  className="text-xs font-medium"
                  style={{ color: getPasswordStrengthColor(passwordStrength.score) }}
                >
                  {getPasswordStrengthLabel(passwordStrength.score)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="group">
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full bg-slate-900/60 border border-slate-500/50 rounded-lg px-4 py-4 text-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all backdrop-blur-sm"
            />
            <div className="absolute inset-0 rounded-lg bg-blue-500/5 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-500" />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg backdrop-blur-sm border bg-red-900/20 border-red-500/50 text-red-200 text-center text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setStep('choice')}
            className="flex-1 bg-transparent border border-slate-500/50 text-slate-300 hover:text-white hover:border-slate-400 font-medium text-lg py-3.5 rounded-lg transition-all duration-200"
          >
            Back
          </button>
          <button
            onClick={handleImport}
            disabled={isConnecting}
            className="flex-1 bg-slate-200 hover:bg-white text-slate-900 font-medium text-lg py-3.5 rounded-lg transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Importing...' : 'Import Wallet'}
          </button>
        </div>
      </div>
    </div>
  );

  // Render backup step
  const renderBackup = () => (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-light text-slate-100 tracking-tight drop-shadow-lg">
          Backup Your Wallet
        </h2>
        <p className="text-slate-400 text-lg">
          Write down your seed phrase and store it safely
        </p>
      </div>

      <div className="p-6 rounded-lg bg-amber-900/20 border border-amber-500/50 backdrop-blur-sm">
        <p className="text-sm text-amber-200 mb-4">
          <strong>⚠️ Important:</strong> This is the ONLY way to recover your wallet. Never share it with anyone.
        </p>
      </div>

      {mnemonic && (
        <div className="p-6 rounded-lg bg-slate-900/60 border border-slate-500/50 backdrop-blur-sm">
          <div className="grid grid-cols-3 gap-3">
            {mnemonic.split(' ').map((word, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-3 rounded bg-slate-800/60 border border-slate-600/30"
              >
                <span className="text-xs text-slate-500 font-mono">{index + 1}.</span>
                <span className="text-sm text-slate-100 font-mono">{word}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <label className="flex items-start gap-3 p-4 rounded-lg border border-slate-500/50 bg-slate-900/40 hover:bg-slate-900/60 cursor-pointer transition-all group">
          <input
            type="checkbox"
            checked={backupConfirmed}
            onChange={(e) => setBackupConfirmed(e.target.checked)}
            className="mt-1 w-5 h-5 rounded border-slate-500 bg-slate-800 checked:bg-blue-500 focus:ring-2 focus:ring-blue-400 focus:ring-offset-0"
          />
          <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors">
            I have safely stored my seed phrase. I understand that if I lose it, I will not be able to recover my wallet.
          </span>
        </label>

        {error && (
          <div className="p-3 rounded-lg backdrop-blur-sm border bg-red-900/20 border-red-500/50 text-red-200 text-center text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleBackupConfirm}
          disabled={!backupConfirmed}
          className="w-full bg-slate-200 hover:bg-white text-slate-900 font-medium text-lg py-3.5 rounded-lg transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center overflow-hidden bg-transparent">
      {/* Background Pattern */}
      <div className="absolute inset-0 z-0">
        <WaveBackground />
      </div>

      {/* Top Left Logo */}
      <div className="absolute top-8 left-8 z-20 opacity-90 hover:opacity-100 transition-opacity cursor-pointer">
        <img src={arcLogo} alt="Arc Wallet" className="w-20 h-20 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]" />
      </div>

      {/* Setup Container */}
      <div className="relative z-20 w-full max-w-lg px-4 animate-in fade-in zoom-in duration-700">
        {step === 'choice' && renderChoice()}
        {step === 'create' && renderCreate()}
        {step === 'import' && renderImport()}
        {step === 'backup' && renderBackup()}
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes zoom-in {
          from {
            transform: scale(0.95);
          }
          to {
            transform: scale(1);
          }
        }
        .animate-in {
          animation: fade-in 0.7s ease-out, zoom-in 0.7s ease-out;
        }
      `}</style>
    </div>
  );
};

export default WalletSetup;
