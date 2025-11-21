/**
 * Wallet Setup Component
 * Self-custodial wallet creation and import
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSelfCustodialWallet } from '../contexts/SelfCustodialWalletContext';
import { SocialLoginButtons } from './SocialLoginButtons';

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
    markBackedUp
  } = useSelfCustodialWallet();

  const [step, setStep] = useState<SetupStep>('choice');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [importInput, setImportInput] = useState('');
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [backupConfirmed, setBackupConfirmed] = useState(false);

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
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [needsBackup, getMnemonic]);

  // Handle wallet creation
  const handleCreate = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await createWallet(password);
      setMnemonic(result.mnemonic);
      setStep('backup');
    } catch (err: any) {
      setError(err.message || 'Failed to create wallet');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle wallet import
  const handleImport = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!importInput.trim()) {
      setError('Please enter your seed phrase or private key');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await importWallet(importInput.trim(), password);
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to import wallet');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle backup confirmation
  const handleBackupConfirm = () => {
    if (!backupConfirmed) {
      setError('Please confirm you have saved your seed phrase');
      return;
    }

    markBackedUp();
    onComplete();
  };

  // Render choice step
  const renderChoice = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-text-primary">Setup Your Wallet</h2>
        <p className="text-text-secondary">
          Your keys, your crypto. Create a new wallet or import an existing one.
        </p>
      </div>

      <div className="space-y-4">
        <button
          onClick={() => setStep('create')}
          className="w-full p-4 rounded-xl border border-white/10 bg-[#151A22] hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
        >
          <p className="font-semibold text-text-primary">Create New Wallet</p>
          <p className="text-sm text-text-secondary mt-1">
            Generate a new wallet with a secure seed phrase
          </p>
        </button>

        <button
          onClick={() => setStep('import')}
          className="w-full p-4 rounded-xl border border-white/10 bg-[#151A22] hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
        >
          <p className="font-semibold text-text-primary">Import Existing Wallet</p>
          <p className="text-sm text-text-secondary mt-1">
            Restore using seed phrase or private key
          </p>
        </button>
      </div>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-[#0f1729] text-text-secondary">Or continue with</span>
        </div>
      </div>

      <SocialLoginButtons />

      <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 mt-6">
        <p className="text-sm text-amber-200">
          <strong>Self-Custodial:</strong> Your private keys are encrypted and stored only on this device.
          We never have access to your keys.
        </p>
      </div>
    </div>
  );

  // Render create step
  const renderCreate = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-text-primary">Create New Wallet</h2>
        <p className="text-text-secondary">
          Set a strong password to encrypt your wallet
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            className="w-full h-12 rounded-lg border border-white/10 bg-[#0f1729] px-4 text-text-primary focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            className="w-full h-12 rounded-lg border border-white/10 bg-[#0f1729] px-4 text-text-primary focus:border-primary focus:outline-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setStep('choice')}
            className="flex-1 h-12 rounded-lg border border-white/10 text-text-secondary hover:bg-white/5 transition-colors"
          >
            Back
          </button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleCreate}
            disabled={isLoading}
            className="flex-1 h-12 rounded-lg bg-primary text-primary-text font-semibold disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Create Wallet'}
          </motion.button>
        </div>
      </div>
    </div>
  );

  // Render import step
  const renderImport = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-text-primary">Import Wallet</h2>
        <p className="text-text-secondary">
          Enter your seed phrase or private key
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Seed Phrase or Private Key
          </label>
          <textarea
            value={importInput}
            onChange={(e) => setImportInput(e.target.value)}
            placeholder="Enter your 12/24 word seed phrase or private key"
            rows={4}
            className="w-full rounded-lg border border-white/10 bg-[#0f1729] px-4 py-3 text-text-primary focus:border-primary focus:outline-none resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            className="w-full h-12 rounded-lg border border-white/10 bg-[#0f1729] px-4 text-text-primary focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            className="w-full h-12 rounded-lg border border-white/10 bg-[#0f1729] px-4 text-text-primary focus:border-primary focus:outline-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setStep('choice')}
            className="flex-1 h-12 rounded-lg border border-white/10 text-text-secondary hover:bg-white/5 transition-colors"
          >
            Back
          </button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleImport}
            disabled={isLoading}
            className="flex-1 h-12 rounded-lg bg-primary text-primary-text font-semibold disabled:opacity-50"
          >
            {isLoading ? 'Importing...' : 'Import Wallet'}
          </motion.button>
        </div>
      </div>
    </div>
  );

  // Render backup step
  const renderBackup = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-text-primary">Backup Seed Phrase</h2>
        <p className="text-text-secondary">
          Write down these 12 words in order. This is the only way to recover your wallet.
        </p>
      </div>

      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
        <p className="text-sm text-red-200 font-semibold">
          Never share your seed phrase with anyone. Store it offline in a safe place.
        </p>
      </div>

      {mnemonic && (
        <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-[#151A22] border border-white/10">
          {mnemonic.split(' ').map((word, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 rounded bg-[#0f1729]"
            >
              <span className="text-xs text-text-secondary w-5">{index + 1}.</span>
              <span className="text-sm text-text-primary font-mono">{word}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={backupConfirmed}
            onChange={(e) => setBackupConfirmed(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-white/20 bg-[#0f1729] text-primary focus:ring-primary"
          />
          <span className="text-sm text-text-secondary">
            I have written down my seed phrase and stored it in a safe place.
            I understand that if I lose it, I will lose access to my wallet forever.
          </span>
        </label>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleBackupConfirm}
          className="w-full h-12 rounded-lg bg-primary text-primary-text font-semibold"
        >
          I've Backed Up My Seed Phrase
        </motion.button>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-md mx-auto p-6">
      {step === 'choice' && renderChoice()}
      {step === 'create' && renderCreate()}
      {step === 'import' && renderImport()}
      {step === 'backup' && renderBackup()}
    </div>
  );
};

export default WalletSetup;
