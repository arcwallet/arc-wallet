/**
 * Device Management Component
 * Allows users to manage their signing keys (devices/passkeys)
 */

import React, { useState, useEffect } from 'react';
import { SigningKey, KEY_TYPE } from '../hooks/useArcAccount';

interface DeviceManagementProps {
  signingKeys: SigningKey[];
  activeKeyCount: number;
  loading: boolean;
  onAddDevice: (deviceName: string, keyType: number) => Promise<void>;
  onRemoveDevice: (keyHash: string) => Promise<void>;
}

const DeviceManagement: React.FC<DeviceManagementProps> = ({
  signingKeys,
  activeKeyCount,
  loading,
  onAddDevice,
  onRemoveDevice,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [selectedKeyType, setSelectedKeyType] = useState<number>(KEY_TYPE.WEBAUTHN);
  const [removing, setRemoving] = useState<string | null>(null);

  const handleAddDevice = async () => {
    if (!newDeviceName.trim()) return;

    try {
      await onAddDevice(newDeviceName.trim(), selectedKeyType);
      setShowAddModal(false);
      setNewDeviceName('');
    } catch (error) {
      console.error('Failed to add device:', error);
    }
  };

  const handleRemoveDevice = async (keyHash: string) => {
    if (activeKeyCount <= 1) {
      alert('Cannot remove the last signing key');
      return;
    }

    if (!confirm('Are you sure you want to remove this device?')) return;

    setRemoving(keyHash);
    try {
      await onRemoveDevice(keyHash);
    } catch (error) {
      console.error('Failed to remove device:', error);
    } finally {
      setRemoving(null);
    }
  };

  const getKeyTypeLabel = (keyType: number): string => {
    switch (keyType) {
      case KEY_TYPE.ECDSA:
        return 'Wallet';
      case KEY_TYPE.WEBAUTHN:
        return 'Passkey';
      default:
        return 'Unknown';
    }
  };

  const getKeyTypeIcon = (keyType: number): string => {
    switch (keyType) {
      case KEY_TYPE.ECDSA:
        return '🔑';
      case KEY_TYPE.WEBAUTHN:
        return '🔐';
      default:
        return '❓';
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const truncateHash = (hash: string): string => {
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
  };

  return (
    <div className="device-management">
      <div className="device-header">
        <h3>Connected Devices</h3>
        <span className="device-count">{activeKeyCount} active</span>
      </div>

      <div className="device-list">
        {signingKeys.filter(k => k.isActive).map((key) => (
          <div key={key.keyHash} className="device-item">
            <div className="device-icon">
              {getKeyTypeIcon(key.keyType)}
            </div>
            <div className="device-info">
              <div className="device-name">{key.deviceName}</div>
              <div className="device-meta">
                <span className="device-type">{getKeyTypeLabel(key.keyType)}</span>
                <span className="device-date">Added {formatDate(key.addedAt)}</span>
              </div>
              <div className="device-hash">{truncateHash(key.keyHash)}</div>
            </div>
            <button
              className="device-remove"
              onClick={() => handleRemoveDevice(key.keyHash)}
              disabled={loading || removing === key.keyHash || activeKeyCount <= 1}
              title={activeKeyCount <= 1 ? 'Cannot remove last key' : 'Remove device'}
            >
              {removing === key.keyHash ? '...' : '✕'}
            </button>
          </div>
        ))}
      </div>

      <button
        className="add-device-btn"
        onClick={() => setShowAddModal(true)}
        disabled={loading}
      >
        + Add New Device
      </button>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Device</h3>

            <div className="form-group">
              <label>Device Name</label>
              <input
                type="text"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                placeholder="e.g., iPhone 15, MacBook Pro"
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label>Key Type</label>
              <div className="key-type-options">
                <button
                  className={`key-type-btn ${selectedKeyType === KEY_TYPE.WEBAUTHN ? 'selected' : ''}`}
                  onClick={() => setSelectedKeyType(KEY_TYPE.WEBAUTHN)}
                >
                  🔐 Passkey (Recommended)
                </button>
                <button
                  className={`key-type-btn ${selectedKeyType === KEY_TYPE.ECDSA ? 'selected' : ''}`}
                  onClick={() => setSelectedKeyType(KEY_TYPE.ECDSA)}
                >
                  🔑 External Wallet
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button
                className="confirm-btn"
                onClick={handleAddDevice}
                disabled={!newDeviceName.trim() || loading}
              >
                {loading ? 'Adding...' : 'Add Device'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .device-management {
          background: #1a1a2e;
          border-radius: 12px;
          padding: 20px;
          margin: 16px 0;
        }

        .device-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .device-header h3 {
          margin: 0;
          color: #fff;
          font-size: 18px;
        }

        .device-count {
          background: rgba(99, 102, 241, 0.2);
          color: #818cf8;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 14px;
        }

        .device-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 16px;
        }

        .device-item {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 12px;
        }

        .device-icon {
          font-size: 24px;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(99, 102, 241, 0.2);
          border-radius: 8px;
        }

        .device-info {
          flex: 1;
        }

        .device-name {
          color: #fff;
          font-weight: 500;
          margin-bottom: 4px;
        }

        .device-meta {
          display: flex;
          gap: 12px;
          font-size: 12px;
          color: #a0aec0;
        }

        .device-type {
          background: rgba(16, 185, 129, 0.2);
          color: #34d399;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .device-hash {
          font-size: 11px;
          color: #718096;
          font-family: monospace;
          margin-top: 4px;
        }

        .device-remove {
          background: transparent;
          border: none;
          color: #f87171;
          cursor: pointer;
          padding: 8px;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .device-remove:hover:not(:disabled) {
          background: rgba(248, 113, 113, 0.2);
        }

        .device-remove:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .add-device-btn {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          border: none;
          border-radius: 8px;
          color: #fff;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .add-device-btn:hover:not(:disabled) {
          opacity: 0.9;
        }

        .add-device-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: #1a1a2e;
          border-radius: 16px;
          padding: 24px;
          width: 90%;
          max-width: 400px;
        }

        .modal-content h3 {
          margin: 0 0 20px;
          color: #fff;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          color: #a0aec0;
          font-size: 14px;
          margin-bottom: 8px;
        }

        .form-group input {
          width: 100%;
          padding: 12px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          color: #fff;
          font-size: 16px;
        }

        .form-group input:focus {
          outline: none;
          border-color: #6366f1;
        }

        .key-type-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .key-type-btn {
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #fff;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
        }

        .key-type-btn.selected {
          border-color: #6366f1;
          background: rgba(99, 102, 241, 0.2);
        }

        .key-type-btn:hover {
          border-color: #6366f1;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .cancel-btn {
          flex: 1;
          padding: 12px;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 8px;
          color: #fff;
          cursor: pointer;
        }

        .confirm-btn {
          flex: 1;
          padding: 12px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          border: none;
          border-radius: 8px;
          color: #fff;
          cursor: pointer;
        }

        .confirm-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default DeviceManagement;
