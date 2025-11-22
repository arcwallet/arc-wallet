import React, { useState } from 'react';
import { KeyIcon } from './Icons';
import { useWallet } from '../contexts/WalletContext';
import { WaveBackground } from './WaveBackground';
import arcLogo from '../assets/arclogo.png';

interface WalletSelectionScreenProps {
  onConnect: () => void;
  isConnecting?: boolean;
  onUseRecovery?: () => void;
  email?: string | null;
}

const WalletSelectionScreen: React.FC<WalletSelectionScreenProps> = ({
  onConnect,
  isConnecting = false,
  onUseRecovery,
  email,
}) => {
  const { registerPasskeyForCurrentUser } = useWallet();
  const [isRegistering, setIsRegistering] = useState(false);
  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-transparent">
      {/* Background Pattern */}
      <div className="absolute inset-0 z-0">
        <WaveBackground />
      </div>

      {/* Top Left Logo */}
      <div className="absolute top-8 left-8 z-20 opacity-90 hover:opacity-100 transition-opacity cursor-pointer">
        <img src={arcLogo} alt="Arc Wallet" className="w-20 h-20 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]" />
      </div>

      <div className="relative z-20 flex flex-1 justify-center items-center py-5 px-4 w-full">
        <div className="layout-content-container flex flex-col max-w-md w-full animate-in fade-in zoom-in duration-700">
          <div className="flex flex-col gap-8 rounded-xl bg-slate-900/60 backdrop-blur-sm border border-slate-500/50 p-8 text-center shadow-xl">
            {/* PageHeading */}
            <div className="flex flex-col items-center gap-3">
              <p className="text-slate-100 text-4xl font-light leading-tight tracking-tight drop-shadow-lg">Access Wallet</p>
              <p className="text-slate-400 text-base font-normal leading-normal">Your wallet is protected with Passkey security.</p>
              {email && (
                <p className="text-sm font-mono text-slate-400">
                  Signed in as <span className="text-blue-400">{email}</span>
                </p>
              )}
            </div>
            {/* SingleButton */}
            <div className="flex flex-col gap-4">
              <button
                onClick={onConnect}
                disabled={isConnecting}
                className="flex min-w-[84px] max-w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 flex-1 bg-slate-200 hover:bg-white text-slate-900 gap-2 text-base font-semibold leading-normal tracking-[0.015em] transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <KeyIcon size={20} className="text-slate-900" />
                <span className="truncate">{isConnecting ? 'Connecting…' : 'Sign in with Passkey'}</span>
              </button>
              <button
                onClick={async () => {
                  setIsRegistering(true);
                  try {
                    // registerPasskeyForCurrentUser now handles both registration and session creation
                    await registerPasskeyForCurrentUser();
                    // No need to call onConnect() - registration now returns session key
                  } catch (e: any) {
                    alert(e?.message || 'Failed to register with passkey.');
                  } finally {
                    setIsRegistering(false);
                  }
                }}
                disabled={isRegistering}
                className="flex min-w-[84px] max-w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 flex-1 bg-slate-900/60 text-slate-300 border border-slate-500/50 hover:bg-white/10 hover:text-white hover:border-slate-400 text-base font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="truncate">{isRegistering ? 'Registering…' : 'Create New Passkey'}</span>
              </button>

              {/* BodyText */}
              <p className="text-slate-400 text-sm font-normal leading-normal text-center">
                No seed phrase required. Your identity is verified using your device's secure hardware enclave.
              </p>
              <p className="text-slate-500 text-xs font-normal leading-normal text-center">
                Beta note: until passkey attestation is wired up, the passkey backend is used to mint a short-lived session key.
              </p>
            </div>
            {/* MetaText */}
            <div className="pt-2">
              <button
                type="button"
                className="text-slate-400 hover:text-blue-400 text-sm font-medium leading-normal text-center hover:underline cursor-pointer transition-colors"
                onClick={onUseRecovery}
              >
                Use Recovery Access
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletSelectionScreen;
