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
  // Mobile restriction disabled - allow all devices
  return <>{children}</>;
};

export default DesktopOnlyGuard;
