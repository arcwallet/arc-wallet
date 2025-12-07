/**
 * Treasury Settings Component
 * Settings panel for managing corporate treasury policies
 */

import React, { useState, useEffect } from 'react';
import {
  treasuryPolicyService,
  TreasuryPolicy,
  UserRole,
  ApprovalThreshold,
  RolePermission,
  PendingApproval,
  AuditLogEntry,
} from '../services/treasuryPolicyService';
import { SettingsIcon, VerifiedIcon, RefreshIcon } from './Icons';

// ============================================
// ICONS
// ============================================

const ShieldIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const UsersIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ClockIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12,6 12,12 16,14" />
  </svg>
);

const ListIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const CheckIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20,6 9,17 4,12" />
  </svg>
);

const XIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ============================================
// SUB-COMPONENTS
// ============================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
      active
        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

// Spending Limits Tab
const SpendingLimitsTab: React.FC<{ policy: TreasuryPolicy; onUpdate: () => void }> = ({ policy, onUpdate }) => {
  const [editingToken, setEditingToken] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ daily: 0, weekly: 0, monthly: 0 });

  const tokens = ['USDC', 'USYC', 'EURC'] as const;
  const spendingLimits = policy?.spendingLimits;

  // Early return if no spending limits configured
  if (!spendingLimits) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700/50 text-center">
        <p className="text-slate-400">Spending limits not configured</p>
      </div>
    );
  }

  const handleEdit = (token: string) => {
    const limits = spendingLimits[token as keyof typeof spendingLimits];
    if (!limits) return;
    setEditValues({
      daily: limits.daily?.amount || 0,
      weekly: limits.weekly?.amount || 0,
      monthly: limits.monthly?.amount || 0,
    });
    setEditingToken(token);
  };

  const handleSave = () => {
    if (!editingToken) return;

    const currentPolicy = treasuryPolicyService.getPolicy();
    const tokenKey = editingToken as keyof typeof currentPolicy.spendingLimits;

    currentPolicy.spendingLimits[tokenKey].daily.amount = editValues.daily;
    currentPolicy.spendingLimits[tokenKey].weekly.amount = editValues.weekly;
    currentPolicy.spendingLimits[tokenKey].monthly.amount = editValues.monthly;

    treasuryPolicyService.updatePolicy({ spendingLimits: currentPolicy.spendingLimits }, 'admin');
    setEditingToken(null);
    onUpdate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Spending Limits</h3>
          <p className="text-slate-400 text-sm mt-1">Token-based daily, weekly, and monthly limits</p>
        </div>
      </div>

      <div className="grid gap-4">
        {tokens.map((token) => {
          const limits = spendingLimits[token];
          if (!limits) return null;
          const remaining = treasuryPolicyService.getRemainingLimits(token);
          const isEditing = editingToken === token;

          return (
            <div key={token} className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    token === 'USDC' ? 'bg-blue-500/20' :
                    token === 'USYC' ? 'bg-cyan-500/20' : 'bg-purple-500/20'
                  }`}>
                    <span className={`font-bold text-sm ${
                      token === 'USDC' ? 'text-blue-400' :
                      token === 'USYC' ? 'text-cyan-400' : 'text-purple-400'
                    }`}>{token.slice(0, 2)}</span>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">{token}</h4>
                    <p className="text-slate-500 text-xs">Spending Limits</p>
                  </div>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => handleEdit(token)}
                    className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                  >
                    Edit
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-slate-400 text-xs block mb-1">Daily ($)</label>
                      <input
                        type="number"
                        value={editValues.daily}
                        onChange={(e) => setEditValues({ ...editValues, daily: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs block mb-1">Weekly ($)</label>
                      <input
                        type="number"
                        value={editValues.weekly}
                        onChange={(e) => setEditValues({ ...editValues, weekly: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs block mb-1">Monthly ($)</label>
                      <input
                        type="number"
                        value={editValues.monthly}
                        onChange={(e) => setEditValues({ ...editValues, monthly: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingToken(null)}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {(['daily', 'weekly', 'monthly'] as const).map((period) => {
                    const limit = limits[period];
                    if (!limit) return null;
                    const remainingAmount = remaining?.[period] ?? 0;
                    const usedPercent = limit.amount > 0 ? (limit.used / limit.amount) * 100 : 0;

                    return (
                      <div key={period} className="bg-slate-900/50 rounded-lg p-3">
                        <p className="text-slate-400 text-xs capitalize mb-1">
                          {period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : 'Monthly'}
                        </p>
                        <p className="text-white font-semibold">${(limit.amount ?? 0).toLocaleString()}</p>
                        <div className="mt-2">
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                usedPercent > 80 ? 'bg-red-500' :
                                usedPercent > 50 ? 'bg-amber-500' : 'bg-cyan-500'
                              }`}
                              style={{ width: `${Math.min(usedPercent, 100)}%` }}
                            />
                          </div>
                          <p className="text-slate-500 text-xs mt-1">
                            Remaining: ${(remainingAmount ?? 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Transaction Caps */}
      {policy?.transactionCaps && (
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
        <h4 className="text-white font-semibold mb-4">Single Transaction Limits</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(policy.transactionCaps).map(([key, value]) => (
            <div key={key} className="bg-slate-900/50 rounded-lg p-3 text-center">
              <p className="text-slate-400 text-xs uppercase mb-1">{key}</p>
              <p className="text-white font-semibold">${(value ?? 0).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
};

// Approval Thresholds Tab
const ApprovalThresholdsTab: React.FC<{ policy: TreasuryPolicy; onUpdate: () => void }> = ({ policy, onUpdate }) => {
  // Null safety checks
  const thresholds = policy?.approvalThresholds || [];
  const treasuryRules = policy?.treasuryRules;

  if (!treasuryRules) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700/50 text-center">
        <p className="text-slate-400">Treasury rules not configured</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Approval Thresholds</h3>
        <p className="text-slate-400 text-sm mt-1">Amount-based multi-signature requirements</p>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Amount Range</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Required Signatures</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Required Roles</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Timeout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {thresholds.map((threshold, index) => {
              if (!threshold) return null;
              const prevMax = index > 0 ? (thresholds[index - 1]?.maxAmount ?? 0) : 0;
              const maxAmount = threshold.maxAmount ?? Infinity;
              const rangeText = maxAmount === Infinity
                ? `$${(prevMax ?? 0).toLocaleString()}+`
                : `$${(prevMax ?? 0).toLocaleString()} - $${(maxAmount ?? 0).toLocaleString()}`;

              return (
                <tr key={index} className="hover:bg-slate-800/30">
                  <td className="px-4 py-4">
                    <span className="text-white font-medium">{rangeText}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-sm font-bold ${
                        threshold.requiredSignatures === 1 ? 'bg-cyan-500/20 text-cyan-400' :
                        threshold.requiredSignatures === 2 ? 'bg-amber-500/20 text-amber-400' :
                        threshold.requiredSignatures === 3 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {threshold.requiredSignatures ?? 1} Sig
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {threshold.requiredRoles?.length ? (
                      <div className="flex gap-1 flex-wrap">
                        {threshold.requiredRoles.map((role) => (
                          <span key={role} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                            {role}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 text-sm">Any</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-slate-300">{threshold.timeoutHours ?? 24} hours</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Treasury Rules */}
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
        <h4 className="text-white font-semibold mb-4">Treasury Rules</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/50 rounded-lg p-4">
            <p className="text-slate-400 text-xs mb-1">Min Liquidity</p>
            <p className="text-white font-semibold text-xl">{treasuryRules.minLiquidityPercent ?? 20}%</p>
            <p className="text-slate-500 text-xs mt-1">USDC required</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4">
            <p className="text-slate-400 text-xs mb-1">Max Single Subscribe</p>
            <p className="text-white font-semibold text-xl">{treasuryRules.maxSingleSubscribePercent ?? 50}%</p>
            <p className="text-slate-500 text-xs mt-1">of USDC</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4">
            <p className="text-slate-400 text-xs mb-1">Max Single Redeem</p>
            <p className="text-white font-semibold text-xl">{treasuryRules.maxSingleRedeemPercent ?? 80}%</p>
            <p className="text-slate-500 text-xs mt-1">of USYC</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4">
            <p className="text-slate-400 text-xs mb-1">Redeem Cooldown</p>
            <p className="text-white font-semibold text-xl">{(treasuryRules.redeemCooldownMs ?? 86400000) / (60 * 60 * 1000)} hours</p>
            <p className="text-slate-500 text-xs mt-1">Wait period</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4">
            <p className="text-slate-400 text-xs mb-1">Subscribe Approval</p>
            <p className={`font-semibold text-xl ${treasuryRules.subscribeRequiresApproval ? 'text-amber-400' : 'text-cyan-400'}`}>
              {treasuryRules.subscribeRequiresApproval ? 'Required' : 'Not Required'}
            </p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4">
            <p className="text-slate-400 text-xs mb-1">Redeem Approval</p>
            <p className={`font-semibold text-xl ${treasuryRules.redeemRequiresApproval ? 'text-amber-400' : 'text-cyan-400'}`}>
              {treasuryRules.redeemRequiresApproval ? 'Required' : 'Not Required'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Role Permissions Tab
const RolePermissionsTab: React.FC<{ policy: TreasuryPolicy }> = ({ policy }) => {
  const roleLabels: Record<UserRole, string> = {
    admin: 'Admin',
    treasury_manager: 'Treasury Manager',
    operator: 'Operator',
    approver: 'Approver',
    viewer: 'Viewer',
    member: 'Member',
  };

  const roleColors: Record<UserRole, string> = {
    admin: 'bg-red-500/20 text-red-400 border-red-500/30',
    treasury_manager: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    operator: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    approver: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    viewer: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    member: 'bg-green-500/20 text-green-400 border-green-500/30',
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Role Permissions</h3>
        <p className="text-slate-400 text-sm mt-1">Permissions and restrictions for each role</p>
      </div>

      <div className="grid gap-4">
        {policy.rolePermissions.map((permission) => (
          <div key={permission.role} className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-lg text-sm font-semibold border ${roleColors[permission.role]}`}>
                  {roleLabels[permission.role]}
                </span>
                {permission.maxTransferAmount > 0 && (
                  <span className="text-slate-400 text-sm">
                    Max: ${permission.maxTransferAmount.toLocaleString()}
                  </span>
                )}
                {permission.maxTransferAmount === 0 && permission.role === 'admin' && (
                  <span className="text-cyan-400 text-sm">Unlimited</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
              {[
                { key: 'canView', label: 'View' },
                { key: 'canTransfer', label: 'Transfer' },
                { key: 'canSubscribe', label: 'Subscribe' },
                { key: 'canRedeem', label: 'Redeem' },
                { key: 'canApprove', label: 'Approve' },
                { key: 'canModifyPolicy', label: 'Policy' },
                { key: 'canAddMembers', label: 'Add Members' },
              ].map(({ key, label }) => {
                const hasPermission = permission[key as keyof RolePermission];
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      hasPermission ? 'bg-cyan-500/10' : 'bg-slate-900/50'
                    }`}
                  >
                    {hasPermission ? (
                      <CheckIcon size={14} className="text-cyan-400" />
                    ) : (
                      <XIcon size={14} className="text-slate-600" />
                    )}
                    <span className={`text-xs ${hasPermission ? 'text-cyan-400' : 'text-slate-500'}`}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Pending Approvals Tab
const PendingApprovalsTab: React.FC<{
  approvals: PendingApproval[];
  currentUserEmail: string;
  currentUserRole: UserRole;
  onSign: (approvalId: string, approved: boolean) => void;
  onRefresh: () => void;
}> = ({ approvals, currentUserEmail, currentUserRole, onSign, onRefresh }) => {
  const pendingApprovals = approvals.filter((a) => a.status === 'pending');

  const getTimeRemaining = (expiresAt: Date): string => {
    const remaining = expiresAt.getTime() - Date.now();
    if (remaining <= 0) return 'Expired';
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${minutes}m remaining`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Pending Approvals</h3>
          <p className="text-slate-400 text-sm mt-1">Transactions awaiting approval</p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm"
        >
          <RefreshIcon size={14} />
          Refresh
        </button>
      </div>

      {pendingApprovals.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700/50 text-center">
          <ClockIcon size={48} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No pending approvals</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingApprovals.map((approval) => {
            const hasUserSigned = approval.currentSignatures.some((s) => s.signerEmail === currentUserEmail);
            const approvedCount = approval.currentSignatures.filter((s) => s.approved).length;

            return (
              <div key={approval.id} className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                        approval.type === 'subscribe' ? 'bg-cyan-500/20 text-cyan-400' :
                        approval.type === 'redeem' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        {approval.type}
                      </span>
                      <span className="text-slate-400 text-sm">{approval.token}</span>
                    </div>
                    <p className="text-white text-xl font-bold">${approval.amount.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 text-sm">{getTimeRemaining(approval.expiresAt)}</p>
                    <p className="text-slate-500 text-xs mt-1">
                      {approvedCount}/{approval.requiredSignatures} approvals
                    </p>
                  </div>
                </div>

                {/* Signatures */}
                <div className="mb-4">
                  <p className="text-slate-400 text-xs mb-2">Signatures:</p>
                  <div className="flex flex-wrap gap-2">
                    {approval.currentSignatures.map((sig, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-1 rounded text-xs ${
                          sig.approved
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {sig.signerEmail.split('@')[0]} ({sig.approved ? 'Approved' : 'Rejected'})
                      </span>
                    ))}
                    {Array.from({ length: approval.requiredSignatures - approval.currentSignatures.length }).map((_, idx) => (
                      <span key={`empty-${idx}`} className="px-2 py-1 rounded text-xs bg-slate-700/50 text-slate-500">
                        Pending
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                {!hasUserSigned && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onSign(approval.id, true)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium"
                    >
                      <CheckIcon size={16} />
                      Approve
                    </button>
                    <button
                      onClick={() => onSign(approval.id, false)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-400 text-white rounded-lg font-medium"
                    >
                      <XIcon size={16} />
                      Reject
                    </button>
                  </div>
                )}
                {hasUserSigned && (
                  <div className="flex items-center justify-center gap-2 py-2 bg-slate-700/30 rounded-lg">
                    <VerifiedIcon size={16} className="text-slate-400" />
                    <span className="text-slate-400 text-sm">You have already signed</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Audit Log Tab
const AuditLogTab: React.FC<{ logs: AuditLogEntry[] }> = ({ logs }) => {
  const actionLabels: Record<string, string> = {
    policy_updated: 'Policy Updated',
    approval_created: 'Approval Request Created',
    approval_signed: 'Approval Signed',
    approval_completed: 'Approval Completed',
    approval_rejected: 'Approval Rejected',
    whitelist_added: 'Added to Whitelist',
    whitelist_removed: 'Removed from Whitelist',
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Audit Log</h3>
        <p className="text-slate-400 text-sm mt-1">Record of all treasury operations</p>
      </div>

      {logs.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700/50 text-center">
          <ListIcon size={48} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No records yet</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="px-4 py-3 border-b border-slate-700/30 hover:bg-slate-800/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${log.success ? 'bg-cyan-400' : 'bg-red-400'}`} />
                    <span className="text-white font-medium">
                      {actionLabels[log.action] || log.action}
                    </span>
                  </div>
                  <span className="text-slate-500 text-xs">{formatDate(log.timestamp)}</span>
                </div>
                <div className="mt-1 flex items-center gap-4 text-sm">
                  <span className="text-slate-400">{log.userEmail}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-500">{log.userRole}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

interface TreasurySettingsProps {
  userEmail?: string;
  userRole: UserRole;
  onClose?: () => void;
}

const TreasurySettings: React.FC<TreasurySettingsProps> = ({
  userEmail = 'admin@arcwallet.network',
  userRole,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'limits' | 'thresholds' | 'roles' | 'approvals' | 'audit'>('limits');
  const [policy, setPolicy] = useState<TreasuryPolicy>(treasuryPolicyService.getPolicy());
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const loadData = () => {
    setPolicy(treasuryPolicyService.getPolicy());
    setPendingApprovals(treasuryPolicyService.getAllApprovals());
    setAuditLogs(treasuryPolicyService.getAuditLog());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSignApproval = (approvalId: string, approved: boolean) => {
    const result = treasuryPolicyService.signApproval(
      approvalId,
      userEmail,
      userEmail,
      userRole,
      approved
    );

    if (result.success) {
      loadData();
    } else {
      alert(result.message);
    }
  };

  const pendingCount = pendingApprovals.filter((a) => a.status === 'pending').length;

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <SettingsIcon size={20} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Treasury Settings</h2>
            <p className="text-slate-400 text-sm">Policy and limit management</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
          >
            <XIcon size={20} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-4 border-b border-slate-700/50 overflow-x-auto">
        <TabButton
          active={activeTab === 'limits'}
          onClick={() => setActiveTab('limits')}
          icon={<ShieldIcon size={18} />}
          label="Limits"
        />
        <TabButton
          active={activeTab === 'thresholds'}
          onClick={() => setActiveTab('thresholds')}
          icon={<UsersIcon size={18} />}
          label="Thresholds"
        />
        <TabButton
          active={activeTab === 'roles'}
          onClick={() => setActiveTab('roles')}
          icon={<ShieldIcon size={18} />}
          label="Roles"
        />
        <TabButton
          active={activeTab === 'approvals'}
          onClick={() => setActiveTab('approvals')}
          icon={
            <div className="relative">
              <ClockIcon size={18} />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </div>
          }
          label="Approvals"
        />
        <TabButton
          active={activeTab === 'audit'}
          onClick={() => setActiveTab('audit')}
          icon={<ListIcon size={18} />}
          label="Audit Log"
        />
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'limits' && (
          <SpendingLimitsTab policy={policy} onUpdate={loadData} />
        )}
        {activeTab === 'thresholds' && (
          <ApprovalThresholdsTab policy={policy} onUpdate={loadData} />
        )}
        {activeTab === 'roles' && (
          <RolePermissionsTab policy={policy} />
        )}
        {activeTab === 'approvals' && (
          <PendingApprovalsTab
            approvals={pendingApprovals}
            currentUserEmail={userEmail}
            currentUserRole={userRole}
            onSign={handleSignApproval}
            onRefresh={loadData}
          />
        )}
        {activeTab === 'audit' && (
          <AuditLogTab logs={auditLogs} />
        )}
      </div>
    </div>
  );
};

export default TreasurySettings;
