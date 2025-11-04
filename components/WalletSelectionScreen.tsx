import React from 'react';
import { KeyIcon } from './Icons';

interface WalletSelectionScreenProps {
  onConnect: () => void;
  isConnecting?: boolean;
}

const WalletSelectionScreen: React.FC<WalletSelectionScreenProps> = ({ onConnect, isConnecting = false }) => {
  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col">
      <div className="flex flex-1 justify-center items-center py-5 px-4">
        <div className="layout-content-container flex flex-col max-w-md w-full">
          <div className="flex flex-col gap-8 rounded-xl bg-surface border border-border-divider-strong p-8 text-center">
            {/* PageHeading */}
            <div className="flex flex-col items-center gap-3">
              <p className="text-text-primary text-4xl font-black leading-tight tracking-[-0.033em]">Access Wallet</p>
              <p className="text-text-secondary text-base font-normal leading-normal">Your wallet is protected with Passkey security.</p>
            </div>
            {/* SingleButton */}
            <div className="flex flex-col gap-4">
              <button
                onClick={onConnect}
                disabled={isConnecting}
                className="flex min-w-[84px] max-w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 flex-1 bg-primary hover:bg-primary/90 text-primary-text gap-2 text-base font-semibold leading-normal tracking-[0.015em] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <KeyIcon size={20} className="text-primary-text" />
                <span className="truncate">{isConnecting ? 'Connecting…' : 'Sign in with Passkey'}</span>
              </button>
              {/* BodyText */}
              <p className="text-text-secondary text-sm font-normal leading-normal text-center">
                No seed phrase required. Your identity is verified using your device's secure hardware enclave.
              </p>
              <p className="text-text-secondary text-xs font-normal leading-normal text-center">
                Beta note: until passkey attestation is wired up, the passkey backend is used to mint a short-lived session key.
              </p>
            </div>
            {/* MetaText */}
            <div className="pt-2">
              <p className="text-text-secondary hover:text-primary text-sm font-normal leading-normal text-center hover:underline cursor-pointer">Use Recovery Access</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletSelectionScreen;
