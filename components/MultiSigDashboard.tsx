import React, { useState, useEffect } from 'react';
import { useMultiSig } from '../contexts/MultiSigContext';
import { useSession } from '../contexts/SessionContext';
import { formatUnits, parseUnits } from 'ethers';
import '../styles/multisig.css';

// Token addresses
const TOKENS = {
  USDC: {
    symbol: 'USDC',
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    decimals: 6,
  },
  EURC: {
    symbol: 'EURC',
    address: '0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4',
    decimals: 6,
  },
};

interface Member {
  email: string;
  role: 'signer' | 'viewer';
}

const MultiSigDashboard: React.FC = () => {
  const { email: currentEmail } = useSession();
  const {
    accounts,
    selectedAccount,
    transactions,
    isLoading,
    error,
    loadAccounts,
    createAccount,
    selectAccount,
    addMember,
    removeMember,
    createTransaction,
    approveTransaction,
    rejectTransaction,
    updateAccount,
    clearError,
  } = useMultiSig();

  // State for create account form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [threshold, setThreshold] = useState(2);
  const [members, setMembers] = useState<Member[]>([
    { email: currentEmail || '', role: 'signer' },
  ]);
  const [newMemberEmail, setNewMemberEmail] = useState('');

  // State for create transaction form
  const [showTxForm, setShowTxForm] = useState(false);
  const [txTarget, setTxTarget] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txToken, setTxToken] = useState<'USDC' | 'EURC'>('USDC');
  const [txDescription, setTxDescription] = useState('');

  // State for settings
  const [showSettings, setShowSettings] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addMemberRole, setAddMemberRole] = useState<'signer' | 'viewer'>('signer');

  useEffect(() => {
    if (currentEmail && members[0].email !== currentEmail) {
      setMembers([{ email: currentEmail, role: 'signer' }]);
    }
  }, [currentEmail]);

  const handleAddMemberToForm = () => {
    if (newMemberEmail && !members.find((m) => m.email === newMemberEmail)) {
      setMembers([...members, { email: newMemberEmail, role: 'signer' }]);
      setNewMemberEmail('');
    }
  };

  const handleRemoveMemberFromForm = (email: string) => {
    if (email !== currentEmail) {
      setMembers(members.filter((m) => m.email !== email));
    }
  };

  const handleCreateAccount = async () => {
    if (!accountName || members.length < 2 || threshold < 1 || threshold > members.length) {
      return;
    }

    try {
      await createAccount(accountName, threshold, members);
      setShowCreateForm(false);
      setAccountName('');
      setThreshold(2);
      setMembers([{ email: currentEmail || '', role: 'signer' }]);
    } catch (err) {
      // Error is handled by context
    }
  };

  const handleCreateTransaction = async () => {
    if (!selectedAccount || !txTarget || !txAmount) return;

    try {
      const token = TOKENS[txToken];
      const value = parseUnits(txAmount, token.decimals).toString();

      await createTransaction({
        accountId: selectedAccount.id,
        targetAddress: txTarget,
        value,
        tokenAddress: token.address,
        tokenSymbol: token.symbol,
        description: txDescription,
      });

      setShowTxForm(false);
      setTxTarget('');
      setTxAmount('');
      setTxDescription('');
    } catch (err) {
      // Error is handled by context
    }
  };

  const handleAddMemberToAccount = async () => {
    if (!selectedAccount || !addMemberEmail) return;

    try {
      await addMember(selectedAccount.id, addMemberEmail, addMemberRole);
      setAddingMember(false);
      setAddMemberEmail('');
    } catch (err) {
      // Error is handled by context
    }
  };

  const formatTokenAmount = (value: string, symbol: string) => {
    const token = Object.values(TOKENS).find((t) => t.symbol === symbol);
    if (!token) return value;
    try {
      return formatUnits(value, token.decimals);
    } catch {
      return value;
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining <= 0) return 'Expired';
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const handleBack = () => {
    // Clear selection by selecting empty string
    selectAccount('').catch(() => { });
  };

  // Account list view
  if (!selectedAccount) {
    return (
      <div className="multisig-panel">
        <div className="panel-header">
          <h3>Multi-Sig Wallets</h3>
          <button
            className="btn-primary"
            onClick={() => setShowCreateForm(true)}
          >
            + New Wallet
          </button>
        </div>

        {error && (
          <div className="error-message" onClick={clearError}>
            {error}
          </div>
        )}

        {showCreateForm && (
          <div className="create-form">
            <h4>Create Multi-Sig Wallet</h4>

            <input
              type="text"
              placeholder="Wallet Name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="form-input"
            />

            <div className="members-section">
              <h5>Members ({members.length})</h5>
              {members.map((member, index) => (
                <div key={member.email} className="member-item">
                  <span>{member.email}</span>
                  {index > 0 && (
                    <button
                      className="btn-small btn-danger"
                      onClick={() => handleRemoveMemberFromForm(member.email)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}

              <div className="add-member-row">
                <input
                  type="email"
                  placeholder="Add member email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="form-input"
                />
                <button
                  className="btn-small btn-secondary"
                  onClick={handleAddMemberToForm}
                  disabled={!newMemberEmail}
                >
                  Add
                </button>
              </div>
            </div>

            <div className="threshold-section">
              <label>
                Required Signatures: {threshold} of {members.length}
              </label>
              <input
                type="range"
                min="1"
                max={members.length}
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value))}
                className="threshold-slider"
              />
            </div>

            <div className="form-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateAccount}
                disabled={isLoading || members.length < 2}
              >
                {isLoading ? 'Creating...' : 'Create Wallet'}
              </button>
            </div>
          </div>
        )}

        {isLoading && accounts.length === 0 ? (
          <div className="loading">Loading wallets...</div>
        ) : accounts.length === 0 ? (
          <div className="empty-state">
            <p>No multi-sig wallets yet</p>
            <p className="muted">Create one to get started</p>
          </div>
        ) : (
          <div className="account-list">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="account-card"
                onClick={() => selectAccount(account.id)}
              >
                <div className="account-name">{account.name}</div>
                <div className="account-details">
                  <span>{account.requiredSignatures} of {account.members.length} signatures</span>
                  {account.pendingTransactions && account.pendingTransactions > 0 && (
                    <span className="pending-badge">
                      {account.pendingTransactions} pending
                    </span>
                  )}
                </div>
                {account.address && (
                  <div className="account-address">
                    {account.address.slice(0, 6)}...{account.address.slice(-4)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Account detail view
  return (
    <div className="multisig-panel">
      <div className="panel-header">
        <button className="btn-back" onClick={handleBack}>
          ← Back
        </button>
        <h3>{selectedAccount.name}</h3>
        <button
          className="btn-icon"
          onClick={() => setShowSettings(!showSettings)}
        >
          ⚙️
        </button>
      </div>

      {error && (
        <div className="error-message" onClick={clearError}>
          {error}
        </div>
      )}

      {showSettings && (
        <div className="settings-panel">
          <h4>Members</h4>
          {selectedAccount.members.map((member) => (
            <div key={member.id} className="member-item">
              <span>{member.email}</span>
              <span className="role-badge">{member.role}</span>
              <span className={`status-badge ${member.status}`}>
                {member.status}
              </span>
            </div>
          ))}

          {addingMember ? (
            <div className="add-member-form">
              <input
                type="email"
                placeholder="Email"
                value={addMemberEmail}
                onChange={(e) => setAddMemberEmail(e.target.value)}
                className="form-input"
              />
              <select
                value={addMemberRole}
                onChange={(e) => setAddMemberRole(e.target.value as 'signer' | 'viewer')}
                className="form-select"
              >
                <option value="signer">Signer</option>
                <option value="viewer">Viewer</option>
              </select>
              <button className="btn-primary btn-small" onClick={handleAddMemberToAccount}>
                Add
              </button>
              <button className="btn-secondary btn-small" onClick={() => setAddingMember(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="btn-small btn-secondary"
              onClick={() => setAddingMember(true)}
            >
              + Add Member
            </button>
          )}

          <h4 style={{ marginTop: '1rem' }}>Threshold</h4>
          <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
            {selectedAccount.requiredSignatures} of {selectedAccount.members.length} signatures required
          </p>
        </div>
      )}

      <div className="transactions-section">
        <div className="section-header">
          <h4>Transactions</h4>
          <button
            className="btn-primary"
            onClick={() => setShowTxForm(true)}
          >
            + New Transaction
          </button>
        </div>

        {showTxForm && (
          <div className="tx-form">
            <h4>Create Transaction</h4>

            <input
              type="text"
              placeholder="Recipient Address (0x...)"
              value={txTarget}
              onChange={(e) => setTxTarget(e.target.value)}
              className="form-input"
            />

            <div className="amount-row">
              <input
                type="number"
                placeholder="Amount"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                className="form-input"
                step="0.01"
              />
              <select
                value={txToken}
                onChange={(e) => setTxToken(e.target.value as 'USDC' | 'EURC')}
                className="form-select"
              >
                <option value="USDC">USDC</option>
                <option value="EURC">EURC</option>
              </select>
            </div>

            <input
              type="text"
              placeholder="Description (optional)"
              value={txDescription}
              onChange={(e) => setTxDescription(e.target.value)}
              className="form-input"
            />

            <div className="form-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowTxForm(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateTransaction}
                disabled={isLoading || !txTarget || !txAmount}
              >
                {isLoading ? 'Creating...' : 'Submit'}
              </button>
            </div>
          </div>
        )}

        {transactions.length === 0 ? (
          <div className="empty-state">
            <p>No transactions yet</p>
          </div>
        ) : (
          <div className="tx-list">
            {transactions.map((tx) => (
              <div key={tx.id} className={`tx-card ${tx.status}`}>
                <div className="tx-header">
                  <span className="tx-amount">
                    {formatTokenAmount(tx.value, tx.tokenSymbol)} {tx.tokenSymbol}
                  </span>
                  <span className={`tx-status ${tx.status}`}>{tx.status}</span>
                </div>

                <div className="tx-target">
                  To: {tx.targetAddress.slice(0, 8)}...{tx.targetAddress.slice(-6)}
                </div>

                {tx.description && (
                  <div className="tx-description">{tx.description}</div>
                )}

                <div className="tx-approvals">
                  {tx.approvalCount}/{tx.requiredSignatures} approvals
                  {tx.status === 'pending' && (
                    <span className="time-remaining">
                      {getTimeRemaining(tx.expiresAt)}
                    </span>
                  )}
                </div>

                {tx.status === 'pending' && (
                  <div className="tx-actions">
                    <button
                      className="btn-small btn-success"
                      onClick={() => approveTransaction(tx.id)}
                      disabled={isLoading}
                    >
                      Approve
                    </button>
                    <button
                      className="btn-small btn-danger"
                      onClick={() => rejectTransaction(tx.id)}
                      disabled={isLoading}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiSigDashboard;
