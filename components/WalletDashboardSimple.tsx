import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';

const WalletDashboardSimple: React.FC = () => {
  const { sessionKey, address } = useWallet();
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      color: 'white',
      fontFamily: 'system-ui'
    }}>
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h1>🚀 Arc Wallet Dashboard</h1>
        <p>Welcome to your Arc Wallet!</p>
        {sessionKey && (
          <p style={{ fontSize: '12px', opacity: 0.8 }}>
            Address: {sessionKey.address.slice(0, 6)}...{sessionKey.address.slice(-4)}
          </p>
        )}
      </div>

      {/* Navigation */}
      <div style={{ padding: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {['home', 'send', 'receive', 'swap', 'bridge', 'settings'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              background: activeTab === tab ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '20px',
              color: 'white',
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '20px' }}>
        {activeTab === 'home' && (
          <div style={{ textAlign: 'center' }}>
            <h2>💰 Portfolio</h2>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '20px',
              borderRadius: '10px',
              margin: '20px 0'
            }}>
              <h3>Total Balance</h3>
              <p style={{ fontSize: '24px' }}>$0.00 USD</p>
              <p style={{ opacity: 0.8 }}>No tokens detected</p>
            </div>
          </div>
        )}

        {activeTab === 'send' && (
          <div style={{ textAlign: 'center' }}>
            <h2>📤 Send Assets</h2>
            <p>Send functionality coming soon</p>
          </div>
        )}

        {activeTab === 'receive' && (
          <div style={{ textAlign: 'center' }}>
            <h2>📥 Receive Assets</h2>
            <p>Receive functionality coming soon</p>
          </div>
        )}

        {activeTab === 'swap' && (
          <div style={{ textAlign: 'center' }}>
            <h2>🔄 Swap Assets</h2>
            <p>Swap functionality coming soon</p>
          </div>
        )}

        {activeTab === 'bridge' && (
          <div style={{ textAlign: 'center' }}>
            <h2>🌉 Bridge Assets</h2>
            <p>Bridge functionality coming soon</p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div style={{ textAlign: 'center' }}>
            <h2>⚙️ Settings</h2>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '20px',
              borderRadius: '10px',
              textAlign: 'left'
            }}>
              <h3>Wallet Info</h3>
              {sessionKey && (
                <>
                  <p><strong>Address:</strong> {sessionKey.address}</p>
                  <p><strong>Network:</strong> Arc Testnet</p>
                  <p><strong>Status:</strong> ✅ Connected</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletDashboardSimple;