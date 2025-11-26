/**
 * Network Selector Component
 * Dropdown for switching between EVM networks
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNetwork } from '../contexts/NetworkContext';
import { NetworkConfig, isArcNetwork } from '../config/networks';
import { ChevronDownIcon } from './Icons';

interface NetworkSelectorProps {
  compact?: boolean;
  className?: string;
}

const NetworkSelector: React.FC<NetworkSelectorProps> = ({ compact = false, className = '' }) => {
  const { currentNetwork, networks, switchNetwork, isLoading, error } = useNetwork();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNetworkSelect = async (network: NetworkConfig) => {
    try {
      await switchNetwork(network.id);
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to switch network:', err);
    }
  };

  // Get network icon or fallback
  const getNetworkIcon = (network: NetworkConfig) => {
    // Use colored circles as fallback icons
    const colors: Record<string, string> = {
      'arc-testnet': 'bg-purple-500',
      'ethereum': 'bg-blue-500',
      'sepolia': 'bg-blue-400',
      'base': 'bg-blue-600',
      'base-sepolia': 'bg-blue-500',
      'arbitrum': 'bg-sky-500',
      'arbitrum-sepolia': 'bg-sky-400',
      'optimism': 'bg-red-500',
      'optimism-sepolia': 'bg-red-400',
      'polygon': 'bg-purple-600',
      'polygon-amoy': 'bg-purple-500',
      'avalanche': 'bg-red-600',
      'avalanche-fuji': 'bg-red-500',
      'bsc': 'bg-yellow-500',
      'bsc-testnet': 'bg-yellow-400',
    };

    const colorClass = colors[network.id] || 'bg-gray-500';

    return (
      <div className={`w-5 h-5 rounded-full ${colorClass} flex items-center justify-center`}>
        <span className="text-[10px] font-bold text-white">
          {network.shortName.charAt(0)}
        </span>
      </div>
    );
  };

  if (compact) {
    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-600/50 hover:border-slate-500 transition-all disabled:opacity-50"
        >
          {getNetworkIcon(currentNetwork)}
          <span className="text-sm font-medium text-slate-200">{currentNetwork.shortName}</span>
          <ChevronDownIcon size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-700 shadow-xl z-50 overflow-hidden">
            <div className="p-2 border-b border-slate-700">
              <p className="text-xs text-slate-400 px-2">Select Network</p>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {networks.map((network) => (
                <button
                  key={network.id}
                  onClick={() => handleNetworkSelect(network)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    currentNetwork.id === network.id
                      ? 'bg-slate-700/80 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {getNetworkIcon(network)}
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{network.name}</p>
                    <p className="text-xs text-slate-500">{network.nativeCurrency.symbol}</p>
                  </div>
                  {currentNetwork.id === network.id && (
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full-size selector
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-600/50 hover:border-slate-500 transition-all disabled:opacity-50"
      >
        <div className="flex items-center gap-3">
          {getNetworkIcon(currentNetwork)}
          <div className="text-left">
            <p className="text-sm font-semibold text-white">{currentNetwork.name}</p>
            <p className="text-xs text-slate-400">
              {isArcNetwork(currentNetwork) ? 'USDC Gas' : currentNetwork.nativeCurrency.symbol}
              {currentNetwork.testnet && ' • Testnet'}
            </p>
          </div>
        </div>
        <ChevronDownIcon size={18} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {error && (
        <p className="text-xs text-red-400 mt-1 px-2">{error}</p>
      )}

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-slate-900 border border-slate-700 shadow-xl z-50 overflow-hidden">
          <div className="p-3 border-b border-slate-700">
            <p className="text-sm font-medium text-slate-300">Select Network</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {/* Group by mainnet/testnet */}
            {networks.some(n => !n.testnet) && (
              <>
                <div className="px-3 py-2 bg-slate-800/50">
                  <p className="text-xs font-medium text-slate-500 uppercase">Mainnets</p>
                </div>
                {networks.filter(n => !n.testnet).map((network) => (
                  <NetworkOption
                    key={network.id}
                    network={network}
                    isSelected={currentNetwork.id === network.id}
                    onSelect={() => handleNetworkSelect(network)}
                    getIcon={getNetworkIcon}
                  />
                ))}
              </>
            )}

            {networks.some(n => n.testnet) && (
              <>
                <div className="px-3 py-2 bg-slate-800/50">
                  <p className="text-xs font-medium text-slate-500 uppercase">Testnets</p>
                </div>
                {networks.filter(n => n.testnet).map((network) => (
                  <NetworkOption
                    key={network.id}
                    network={network}
                    isSelected={currentNetwork.id === network.id}
                    onSelect={() => handleNetworkSelect(network)}
                    getIcon={getNetworkIcon}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Network option item
interface NetworkOptionProps {
  network: NetworkConfig;
  isSelected: boolean;
  onSelect: () => void;
  getIcon: (network: NetworkConfig) => React.ReactNode;
}

const NetworkOption: React.FC<NetworkOptionProps> = ({ network, isSelected, onSelect, getIcon }) => {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-3 transition-all ${
        isSelected
          ? 'bg-slate-700/60 border-l-2 border-blue-500'
          : 'hover:bg-slate-800/60 border-l-2 border-transparent'
      }`}
    >
      {getIcon(network)}
      <div className="flex-1 text-left">
        <p className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>
          {network.name}
        </p>
        <p className="text-xs text-slate-500">
          Chain ID: {network.chainId} • {network.nativeCurrency.symbol}
        </p>
      </div>
      {isSelected && (
        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
};

export default NetworkSelector;
