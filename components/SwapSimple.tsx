import React from 'react';

const SwapSimple: React.FC = () => {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h2>🔄 Swap coming soon</h2>
      <p>We’re polishing the swap experience so you can convert USDC ↔ EURC directly in Arc Wallet.</p>
      <div
        style={{
          marginTop: '24px',
          padding: '20px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '10px',
        }}
      >
        <p>Stay tuned—real-time quotes, Circle liquidity, and slippage controls arrive in the next release.</p>
      </div>
    </div>
  );
};

export default SwapSimple;
