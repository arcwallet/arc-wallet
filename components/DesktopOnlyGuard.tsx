import React, { useState, useEffect } from 'react';

const MonitorIcon = ({ size = 64 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const ArcLogo = () => (
  <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" stroke="url(#gradient)" strokeWidth="3" fill="none" />
    <path d="M30 65 L50 25 L70 65" stroke="url(#gradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M37 55 L63 55" stroke="url(#gradient)" strokeWidth="3" strokeLinecap="round" />
    <defs>
      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="100%" stopColor="#a78bfa" />
      </linearGradient>
    </defs>
  </svg>
);

interface DesktopOnlyGuardProps {
  children: React.ReactNode;
}

const DesktopOnlyGuard: React.FC<DesktopOnlyGuardProps> = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkDevice = () => {
      // Check screen width (mobile/tablet threshold: 1024px)
      const isSmallScreen = window.innerWidth < 1024;
      // Consider mobile if screen is small (primary check)
      // Touch alone doesn't make it mobile (laptops have touch too)
      setIsMobile(isSmallScreen);
      setIsChecking(false);
    };

    checkDevice();

    // Listen for resize (e.g., rotating tablet)
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="animate-pulse">
          <ArcLogo />
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0f1a] via-[#111827] to-[#0a0f1a] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <ArcLogo />
          </div>

          {/* Desktop Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-500/30">
              <MonitorIcon size={48} />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-3">
            Desktop Only
          </h1>

          {/* Description */}
          <p className="text-slate-400 mb-6 leading-relaxed">
            Arc Wallet is currently optimized for desktop browsers.
            Please access from a computer for the best experience.
          </p>

          {/* Feature badges */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-sm rounded-full border border-blue-500/20">
              Passkey Authentication
            </span>
            <span className="px-3 py-1 bg-purple-500/10 text-purple-400 text-sm rounded-full border border-purple-500/20">
              Smart Contract Wallet
            </span>
          </div>

          {/* Info box */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
            <p className="text-slate-300 text-sm">
              <span className="font-semibold text-white">Why desktop?</span>
              <br />
              Passkey authentication requires a secure hardware authenticator
              (like Touch ID, Face ID, or a security key) which works best on desktop browsers.
            </p>
          </div>

          {/* Coming soon badge */}
          <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full border border-blue-500/20">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-slate-300 text-sm">Mobile app coming soon</span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default DesktopOnlyGuard;
