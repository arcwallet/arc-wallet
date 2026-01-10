import React from 'react';
import {
  DashboardIcon,
  SendIcon,
  ReceiveIcon,
  SwapIcon,
  BridgeIcon,
  TransactionsIcon,
  MultiSigIcon,
  FaucetIcon,
  VerifiedIcon,
  RobotIcon,
  SettingsIcon
} from './Icons';

// Treasury Icon
const TreasuryNavIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </svg>
);

interface NavItemProps {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}

const getIconComponent = (iconName: string) => {
  const iconProps = { size: 20, className: "flex-shrink-0" };

  switch (iconName) {
    case 'dashboard': return <DashboardIcon {...iconProps} />;
    case 'arrow_upward': return <SendIcon {...iconProps} />;
    case 'arrow_downward': return <ReceiveIcon {...iconProps} />;
    case 'swap_horiz': return <SwapIcon {...iconProps} />;
    case 'link': return <BridgeIcon {...iconProps} />;
    case 'receipt_long': return <TransactionsIcon {...iconProps} />;
    case 'group': return <MultiSigIcon {...iconProps} />;
    case 'treasury': return <TreasuryNavIcon {...iconProps} />;
    case 'water_drop': return <FaucetIcon {...iconProps} />;
    case 'verified': return <VerifiedIcon {...iconProps} />;
    case 'smart_toy': return <RobotIcon {...iconProps} />;
    case 'settings': return <SettingsIcon {...iconProps} />;
    default: return <DashboardIcon {...iconProps} />;
  }
};

const NavItem: React.FC<NavItemProps> = ({ icon, label, active = false, onClick }) => {
  const activeClasses = 'bg-blue-500/10 text-blue-400 border-l-2 border-blue-400 font-semibold';
  const inactiveClasses = 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium border-l-2 border-transparent';

  return (
    <a onClick={onClick} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all ${active ? activeClasses : inactiveClasses}`}>
      {getIconComponent(icon)}
      <p className="text-sm">{label}</p>
    </a>
  );
};

interface SideNavBarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}


const SideNavBar: React.FC<SideNavBarProps> = ({ currentPage, onNavigate }) => {
  const navItems = [
    { id: 'Dashboard', icon: 'dashboard', label: 'Dashboard' },
    { id: 'Send', icon: 'arrow_upward', label: 'Send' },
    { id: 'Receive', icon: 'arrow_downward', label: 'Receive' },
    { id: 'Swap', icon: 'swap_horiz', label: 'Swap' },
    { id: 'Bridge', icon: 'link', label: 'Bridge' },
    { id: 'Treasury', icon: 'treasury', label: 'Treasury' },
    { id: 'History', icon: 'receipt_long', label: 'History' },
    { id: 'Multi-Sig', icon: 'group', label: 'Multi-Sig' },
    { id: 'Faucet', icon: 'water_drop', label: 'Faucet' },
  ];

  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-slate-500/30 bg-slate-900/80 backdrop-blur-md">
      <div className="flex items-center justify-start p-6 pl-4 border-b border-slate-500/30">
        <img src="/arclogo.png" alt="Arc Wallet" className="h-20 w-auto object-contain" />
      </div>
      <nav className="mt-6 flex flex-1 flex-col gap-1">
        {navItems.map(item => (
          <NavItem key={item.id} icon={item.icon} label={item.label} active={currentPage === item.id} onClick={() => onNavigate(item.id)} />
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-2">
        {/* Arc Agent Page Link */}
        <a
          onClick={() => onNavigate('Agent')}
          className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all ${
            currentPage === 'Agent'
              ? 'bg-gradient-to-r from-[#4A9EFF]/20 to-[#6366F1]/20 text-[#4A9EFF] border-l-2 border-[#4A9EFF] font-semibold'
              : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium border-l-2 border-transparent'
          }`}
        >
          <RobotIcon size={20} className="flex-shrink-0" />
          <p className="text-sm">Arc Agent</p>
          <span className="ml-auto text-[10px] font-medium bg-gradient-to-r from-[#4A9EFF] to-[#6366F1] text-white px-1.5 py-0.5 rounded">AI</span>
        </a>
        <NavItem icon="settings" label="Settings" active={currentPage === 'Settings'} onClick={() => onNavigate('Settings')} />
      </div>
    </aside>
  );
};

export default SideNavBar;
