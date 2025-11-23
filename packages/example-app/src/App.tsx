import { useState } from 'react';
import { WalletSDK } from '@arc/wallet-sdk';
import type { WalletAccount } from '@arc/wallet-sdk';
import './App.css';

// Initialize SDK
const sdk = new WalletSDK({
  appName: 'Arc Wallet Demo',
  rpId: 'localhost',
  rpcUrl: 'https://rpc.testnet.arc.network',
  backendUrl: 'http://localhost:4000',
  theme: 'dark',
});

function App() {
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleCreateWallet = async () => {
    setLoading(true);
    setError(null);

    try {
      const userId = `user_${Date.now()}`;
      const userName = 'Demo User';

      const newAccount = await sdk.createWallet(userId, userName);
      setAccount(newAccount);

      console.log('Wallet created:', newAccount);
    } catch (err: any) {
      setError(err.message);
      console.error('Create wallet failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    setError(null);

    try {
      const connectedAccount = await sdk.connect();
      setAccount(connectedAccount);

      console.log('Connected:', connectedAccount);
    } catch (err: any) {
      setError(err.message);
      console.error('Connect failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTransaction = async () => {
    if (!account) return;

    setLoading(true);
    setError(null);
    setTxHash(null);

    try {
      const result = await sdk.signTransaction({
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', // Example address
        value: '1000000', // 1 USDC (6 decimals)
        data: '0x',
      });

      setTxHash(result.hash);
      console.log('Transaction sent:', result);
    } catch (err: any) {
      setError(err.message);
      console.error('Transaction failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    sdk.disconnect();
    setAccount(null);
    setTxHash(null);
  };

  return (
    <div className="app">
      <header>
        <h1>Arc Wallet SDK Demo</h1>
        <p>Passkey-based Ethereum Wallet</p>
      </header>

      <main>
        {!account ? (
          <div className="connect-section">
            <h2>Connect Your Wallet</h2>
            <p>Use your device's biometrics (FaceID/TouchID) or passcode</p>

            <div className="button-group">
              <button
                onClick={handleCreateWallet}
                disabled={loading}
                className="primary-button"
              >
                {loading ? 'Creating...' : 'Create New Wallet'}
              </button>

              <button
                onClick={handleConnect}
                disabled={loading}
                className="secondary-button"
              >
                {loading ? 'Connecting...' : 'Connect Existing Wallet'}
              </button>
            </div>

            {error && (
              <div className="error-box">
                ❌ {error}
              </div>
            )}
          </div>
        ) : (
          <div className="wallet-section">
            <div className="wallet-info">
              <h2>Wallet Connected</h2>
              <div className="address-box">
                <span className="label">Address:</span>
                <code>{account.address}</code>
              </div>
              <div className="credential-box">
                <span className="label">Credential ID:</span>
                <code>{account.credentialId.slice(0, 20)}...</code>
              </div>
            </div>

            <div className="actions">
              <h3>Actions</h3>

              <button
                onClick={handleSendTransaction}
                disabled={loading}
                className="action-button"
              >
                {loading ? 'Signing...' : 'Send Test Transaction'}
              </button>

              <button
                onClick={handleDisconnect}
                className="disconnect-button"
              >
                Disconnect
              </button>
            </div>

            {txHash && (
              <div className="success-box">
                Transaction Sent!
                <br />
                <a
                  href={`https://testnet.arcscan.app/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on Explorer →
                </a>
              </div>
            )}

            {error && (
              <div className="error-box">
                ❌ {error}
              </div>
            )}
          </div>
        )}
      </main>

      <footer>
        <p>Powered by Arc Wallet SDK v1.0.0</p>
      </footer>
    </div>
  );
}

export default App;
