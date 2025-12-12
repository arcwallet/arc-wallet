/**
 * ERC-6900 Multi-Sig Panel
 *
 * Enterprise-grade multi-sig management using Circle's native
 * WeightedWebauthnMultisigPlugin (ERC-6900 compliant).
 */

import React, { useState } from 'react';
import { useERC6900MultiSig } from '../contexts/ERC6900MultiSigContext';
import { useCircleWallet } from '../contexts/CircleWalletContext';
import { formatUnits, parseUnits } from 'ethers';
import type { Address, Hex } from 'viem';
import '../styles/multisig.css';

// Token configuration
const TOKENS = {
  USDC: {
    symbol: 'USDC',
    address: '0x3600000000000000000000000000000000000000' as Address,
    decimals: 6,
  },
  EURC: {
    symbol: 'EURC',
    address: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a' as Address,
    decimals: 6,
  },
};

// Role weights for enterprise setup
const ROLE_WEIGHTS = {
  CEO: 2,
  CFO: 2,
  CTO: 1,
  Treasury: 1,
  Member: 1,
};

const ERC6900MultiSigPanel: React.FC = () => {
  const { address: walletAddress, isConnected } = useCircleWallet();
  const {
    isMultiSigEnabled,
    config,
    pendingTransactions,
    isLoading,
    error,
    addWebAuthnOwners,
    executeTransaction,
    rejectTransaction,
    signTransaction,
    createTransaction,
    clearError,
  } = useERC6900MultiSig();

  // UI State
  const [activeTab, setActiveTab] = useState<'overview' | 'owners' | 'transactions'>('overview');
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [showCreateTx, setShowCreateTx] = useState(false);

  // Add Owner Form
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerRole, setNewOwnerRole] = useState<keyof typeof ROLE_WEIGHTS>('Member');
  const [newThreshold, setNewThreshold] = useState(2);

  // Create Transaction Form
  const [txTo, setTxTo] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txToken, setTxToken] = useState<'USDC' | 'EURC'>('USDC');
  const [txDescription, setTxDescription] = useState('');

  if (!isConnected) {
    return (
      <div className="multisig-panel">
        <div className="empty-state">
          <p>Connect wallet to manage multi-sig</p>
        </div>
      </div>
    );
  }

  const handleCreateTransaction = () => {
    if (!txTo || !txAmount) return;

    const token = TOKENS[txToken];
    const value = parseUnits(txAmount, token.decimals);

    // Encode ERC20 transfer
    const transferData = `0xa9059cbb${txTo.slice(2).padStart(64, '0')}${value.toString(16).padStart(64, '0')}` as Hex;

    createTransaction({
      to: token.address,
      value: 0n,
      data: transferData,
      description: txDescription || `Send ${txAmount} ${txToken}`,
    });

    setShowCreateTx(false);
    setTxTo('');
    setTxAmount('');
    setTxDescription('');
  };

  const formatTimeRemaining = (expiresAt: Date) => {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining <= 0) return 'Expired';
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="multisig-panel erc6900">
      {/* Header */}
      <div className="panel-header">
        <div className="header-title">
          <h3>Enterprise Multi-Sig</h3>
          <span className="badge erc6900-badge">ERC-6900</span>
        </div>
        {isMultiSigEnabled && (
          <div className="threshold-info">
            <span className="threshold-value">{config?.thresholdWeight || 0}</span>
            <span className="threshold-label">Threshold</span>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message" onClick={clearError}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'owners' ? 'active' : ''}`}
          onClick={() => setActiveTab('owners')}
        >
          Owners ({config?.webAuthnOwners.length || 0})
        </button>
        <button
          className={`tab ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          Transactions ({pendingTransactions.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-tab">
            {!isMultiSigEnabled ? (
              <div className="setup-card">
                <div className="setup-icon">🔐</div>
                <h4>Enable Enterprise Multi-Sig</h4>
                <p>Add multiple passkey owners with weighted signatures for enhanced security.</p>
                <ul className="features-list">
                  <li>Weighted signatures (CEO=2, CFO=2, CTO=1)</li>
                  <li>Threshold-based approvals</li>
                  <li>Passkey authentication (no seed phrases)</li>
                  <li>ERC-6900 compliant (audited)</li>
                </ul>
                <button
                  className="btn-primary"
                  onClick={() => {
                    setActiveTab('owners');
                    setShowAddOwner(true);
                  }}
                >
                  Setup Multi-Sig
                </button>
              </div>
            ) : (
              <div className="status-cards">
                <div className="status-card">
                  <div className="status-value">{config?.webAuthnOwners.length || 0}</div>
                  <div className="status-label">Owners</div>
                </div>
                <div className="status-card">
                  <div className="status-value">{config?.thresholdWeight || 0}</div>
                  <div className="status-label">Threshold</div>
                </div>
                <div className="status-card">
                  <div className="status-value">
                    {config?.webAuthnOwners.reduce((sum, o) => sum + o.weight, 0) || 0}
                  </div>
                  <div className="status-label">Total Weight</div>
                </div>
                <div className="status-card">
                  <div className="status-value">{pendingTransactions.length}</div>
                  <div className="status-label">Pending</div>
                </div>
              </div>
            )}

            {/* Wallet Address */}
            <div className="wallet-info">
              <label>Wallet Address</label>
              <div className="address-display">
                {walletAddress?.slice(0, 10)}...{walletAddress?.slice(-8)}
                <button
                  className="copy-btn"
                  onClick={() => navigator.clipboard.writeText(walletAddress || '')}
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Owners Tab */}
        {activeTab === 'owners' && (
          <div className="owners-tab">
            <div className="section-header">
              <h4>Passkey Owners</h4>
              <button
                className="btn-small btn-primary"
                onClick={() => setShowAddOwner(true)}
              >
                + Add Owner
              </button>
            </div>

            {config?.webAuthnOwners.length === 0 ? (
              <div className="empty-state">
                <p>No owners configured yet</p>
              </div>
            ) : (
              <div className="owners-list">
                {config?.webAuthnOwners.map((owner, index) => (
                  <div key={index} className="owner-card">
                    <div className="owner-info">
                      <span className="owner-name">{owner.name || `Owner ${index + 1}`}</span>
                      {owner.role && <span className="owner-role">{owner.role}</span>}
                    </div>
                    <div className="owner-weight">
                      <span className="weight-value">{owner.weight}</span>
                      <span className="weight-label">weight</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Owner Modal */}
            {showAddOwner && (
              <div className="modal-overlay">
                <div className="modal">
                  <h4>Add Passkey Owner</h4>
                  <p className="modal-desc">
                    The new owner will need to register their passkey on this device.
                  </p>

                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      value={newOwnerName}
                      onChange={(e) => setNewOwnerName(e.target.value)}
                      placeholder="e.g., John (CFO)"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Role & Weight</label>
                    <select
                      value={newOwnerRole}
                      onChange={(e) => setNewOwnerRole(e.target.value as keyof typeof ROLE_WEIGHTS)}
                      className="form-select"
                    >
                      {Object.entries(ROLE_WEIGHTS).map(([role, weight]) => (
                        <option key={role} value={role}>
                          {role} (Weight: {weight})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>New Threshold</label>
                    <input
                      type="number"
                      value={newThreshold}
                      onChange={(e) => setNewThreshold(parseInt(e.target.value) || 1)}
                      min={1}
                      className="form-input"
                    />
                    <span className="form-hint">
                      Minimum combined weight required to approve transactions
                    </span>
                  </div>

                  <div className="modal-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => setShowAddOwner(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => {
                        // TODO: Implement passkey registration flow
                        // This would trigger WebAuthn credential creation
                        // Then call addWebAuthnOwners with the new public key
                        alert('Passkey registration flow coming soon');
                        setShowAddOwner(false);
                      }}
                      disabled={isLoading || !newOwnerName}
                    >
                      {isLoading ? 'Adding...' : 'Register Passkey'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="transactions-tab">
            <div className="section-header">
              <h4>Pending Transactions</h4>
              <button
                className="btn-small btn-primary"
                onClick={() => setShowCreateTx(true)}
                disabled={!isMultiSigEnabled}
              >
                + New Transaction
              </button>
            </div>

            {pendingTransactions.length === 0 ? (
              <div className="empty-state">
                <p>No pending transactions</p>
              </div>
            ) : (
              <div className="tx-list">
                {pendingTransactions.map((tx) => (
                  <div key={tx.id} className={`tx-card ${tx.status}`}>
                    <div className="tx-header">
                      <span className="tx-description">
                        {tx.description || 'Transaction'}
                      </span>
                      <span className={`tx-status ${tx.status}`}>
                        {tx.status}
                      </span>
                    </div>

                    <div className="tx-details">
                      <div className="tx-to">
                        To: {tx.to.slice(0, 8)}...{tx.to.slice(-6)}
                      </div>
                      <div className="tx-progress">
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${Math.min(100, (tx.currentWeight / tx.requiredWeight) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="progress-text">
                          {tx.currentWeight}/{tx.requiredWeight} weight
                        </span>
                      </div>
                    </div>

                    <div className="tx-meta">
                      <span className="tx-signatures">
                        {tx.signatures.length} signature(s)
                      </span>
                      <span className="tx-expires">
                        Expires: {formatTimeRemaining(tx.expiresAt)}
                      </span>
                    </div>

                    <div className="tx-actions">
                      {tx.status === 'ready' ? (
                        <button
                          className="btn-small btn-success"
                          onClick={() => executeTransaction(tx.id)}
                          disabled={isLoading}
                        >
                          Execute
                        </button>
                      ) : (
                        <button
                          className="btn-small btn-primary"
                          onClick={() => signTransaction(tx.id, 1)}
                          disabled={isLoading}
                        >
                          Sign
                        </button>
                      )}
                      <button
                        className="btn-small btn-danger"
                        onClick={() => rejectTransaction(tx.id)}
                        disabled={isLoading}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Create Transaction Modal */}
            {showCreateTx && (
              <div className="modal-overlay">
                <div className="modal">
                  <h4>Create Transaction</h4>

                  <div className="form-group">
                    <label>Recipient Address</label>
                    <input
                      type="text"
                      value={txTo}
                      onChange={(e) => setTxTo(e.target.value)}
                      placeholder="0x..."
                      className="form-input"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group flex-1">
                      <label>Amount</label>
                      <input
                        type="number"
                        value={txAmount}
                        onChange={(e) => setTxAmount(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Token</label>
                      <select
                        value={txToken}
                        onChange={(e) => setTxToken(e.target.value as 'USDC' | 'EURC')}
                        className="form-select"
                      >
                        <option value="USDC">USDC</option>
                        <option value="EURC">EURC</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Description (optional)</label>
                    <input
                      type="text"
                      value={txDescription}
                      onChange={(e) => setTxDescription(e.target.value)}
                      placeholder="e.g., Q4 Payroll"
                      className="form-input"
                    />
                  </div>

                  <div className="modal-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => setShowCreateTx(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn-primary"
                      onClick={handleCreateTransaction}
                      disabled={isLoading || !txTo || !txAmount}
                    >
                      {isLoading ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ERC6900MultiSigPanel;
