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
import { SettingsIcon, RefreshIcon } from './Icons';

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
    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
      active
        ? 'bg-[#1A2235] text-white border border-white/[0.1]'
        : 'text-[#6B7280] hover:bg-[#1A2235]/50 hover:text-[#E5E7EB]'
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

  if (!spendingLimits) {
    return (
      <div className="bg-[#0D1321] rounded-xl p-8 border border-white/[0.06] text-center">
        <p className="text-[#6B7280]">Spending limits not configured</p>
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
          <p className="text-[#6B7280] text-sm mt-1">Token-based daily, weekly, and monthly limits</p>
        </div>
      </div>

      <div className="grid gap-4">
        {tokens.map((token) => {
          const limits = spendingLimits[token];
          if (!limits) return null;
          const remaining = treasuryPolicyService.getRemainingLimits(token);
          const isEditing = editingToken === token;

          return (
            <div key={token} className="bg-[#0D1321] rounded-xl p-5 border border-white/[0.06]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#1F2937] flex items-center justify-center">
                    <span className="font-bold text-sm text-[#E5E7EB]">{token.slice(0, 2)}</span>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">{token}</h4>
                    <p className="text-[#5C6370] text-xs">Spending Limits</p>
                  </div>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => handleEdit(token)}
                    className="text-[#6B7280] hover:text-[#E5E7EB] text-sm font-medium transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-[#6B7280] text-xs block mb-1">Daily ($)</label>
                      <input
                        type="number"
                        value={editValues.daily}
                        onChange={(e) => setEditValues({ ...editValues, daily: Number(e.target.value) })}
                        className="w-full bg-[#0A0F1A] border border-[#1F2937] rounded-lg px-3 py-2 text-white text-sm focus:border-[#4A9EFF]/50 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[#6B7280] text-xs block mb-1">Weekly ($)</label>
                      <input
                        type="number"
                        value={editValues.weekly}
                        onChange={(e) => setEditValues({ ...editValues, weekly: Number(e.target.value) })}
                        className="w-full bg-[#0A0F1A] border border-[#1F2937] rounded-lg px-3 py-2 text-white text-sm focus:border-[#4A9EFF]/50 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[#6B7280] text-xs block mb-1">Monthly ($)</label>
                      <input
                        type="number"
                        value={editValues.monthly}
                        onChange={(e) => setEditValues({ ...editValues, monthly: Number(e.target.value) })}
                        className="w-full bg-[#0A0F1A] border border-[#1F2937] rounded-lg px-3 py-2 text-white text-sm focus:border-[#4A9EFF]/50 outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 bg-gradient-to-r from-[#3B82F6] to-[#2563EB] text-white rounded-lg text-sm font-medium transition-all shadow-[0_4px_14px_rgba(59,130,246,0.3)]"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingToken(null)}
                      className="px-4 py-2 bg-[#1F2937] border border-[#374151] hover:border-[#4B5563] text-[#9CA3AF] hover:text-white rounded-lg text-sm font-medium transition-colors"
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
                      <div key={period} className="bg-[#0A0F1A] rounded-lg p-3 border border-white/[0.06]">
                        <p className="text-[#6B7280] text-xs capitalize mb-1">
                          {period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : 'Monthly'}
                        </p>
                        <p className="text-white font-semibold">${(limit.amount ?? 0).toLocaleString()}</p>
                        <div className="mt-2">
                          <div className="h-1.5 bg-[#1E293B] rounded-full overflow-hidden relative">
                            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                            <div
                              className={`h-full rounded-full transition-all ${
                                usedPercent > 80 ? 'bg-[#F87171]' :
                                usedPercent > 50 ? 'bg-gradient-to-r from-[#E2E8F0] to-[#94A3B8]' : 'bg-gradient-to-r from-[#3A7ACC] to-[#4A9EFF]'
                              }`}
                              style={{ width: `${Math.min(usedPercent, 100)}%` }}
                            />
                          </div>
                          <p className="text-[#5C6370] text-xs mt-1">
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
      <div className="bg-[#0D1321] rounded-xl p-5 border border-white/[0.06]">
        <h4 className="text-white font-semibold mb-4">Single Transaction Limits</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(policy.transactionCaps).map(([key, value]) => (
            <div key={key} className="bg-[#0A0F1A] rounded-lg p-3 text-center border border-white/[0.06]">
              <p className="text-[#6B7280] text-xs uppercase mb-1">{key}</p>
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
  const thresholds = policy?.approvalThresholds || [];
  const treasuryRules = policy?.treasuryRules;

  if (!treasuryRules) {
    return (
      <div className="bg-[#0D1321] rounded-xl p-8 border border-white/[0.06] text-center">
        <p className="text-[#6B7280]">Treasury rules not configured</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Approval Thresholds</h3>
        <p className="text-[#6B7280] text-sm mt-1">Amount-based multi-signature requirements</p>
      </div>

      <div className="bg-[#0D1321] rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#0A0F1A]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase">Amount Range</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase">Required Signatures</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase">Required Roles</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase">Timeout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {thresholds.map((threshold, index) => {
              if (!threshold) return null;
              const prevMax = index > 0 ? (thresholds[index - 1]?.maxAmount ?? 0) : 0;
              const maxAmount = threshold.maxAmount ?? Infinity;
              const rangeText = maxAmount === Infinity
                ? `$${(prevMax ?? 0).toLocaleString()}+`
                : `$${(prevMax ?? 0).toLocaleString()} - $${(maxAmount ?? 0).toLocaleString()}`;

              return (
                <tr key={index} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-4">
                    <span className="text-white font-medium">{rangeText}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded text-xs font-semibold bg-[#4A9EFF]/10 text-[#93C5FD] border border-[#4A9EFF]/20">
                        {threshold.requiredSignatures ?? 1} Sig
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {threshold.requiredRoles?.length ? (
                      <div className="flex gap-1 flex-wrap">
                        {threshold.requiredRoles.map((role) => (
                          <span key={role} className="px-2 py-0.5 bg-[#1F2937] text-[#9CA3AF] rounded text-xs border border-white/[0.06]">
                            {role}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[#5C6370] text-sm">Any</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-[#9CA3AF]">{threshold.timeoutHours ?? 24} hours</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Treasury Rules */}
      <div className="bg-[#0D1321] rounded-xl p-5 border border-white/[0.06]">
        <h4 className="text-white font-semibold mb-4">Treasury Rules</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-[#0A0F1A] rounded-lg p-4 border border-white/[0.06]">
            <p className="text-[#6B7280] text-xs mb-1">Min Liquidity</p>
            <p className="text-white font-semibold text-xl">{treasuryRules.minLiquidityPercent ?? 20}%</p>
            <p className="text-[#5C6370] text-xs mt-1">USDC required</p>
          </div>
          <div className="bg-[#0A0F1A] rounded-lg p-4 border border-white/[0.06]">
            <p className="text-[#6B7280] text-xs mb-1">Max Single Subscribe</p>
            <p className="text-white font-semibold text-xl">{treasuryRules.maxSingleSubscribePercent ?? 50}%</p>
            <p className="text-[#5C6370] text-xs mt-1">of USDC</p>
          </div>
          <div className="bg-[#0A0F1A] rounded-lg p-4 border border-white/[0.06]">
            <p className="text-[#6B7280] text-xs mb-1">Max Single Redeem</p>
            <p className="text-white font-semibold text-xl">{treasuryRules.maxSingleRedeemPercent ?? 80}%</p>
            <p className="text-[#5C6370] text-xs mt-1">of USYC</p>
          </div>
          <div className="bg-[#0A0F1A] rounded-lg p-4 border border-white/[0.06]">
            <p className="text-[#6B7280] text-xs mb-1">Redeem Cooldown</p>
            <p className="text-white font-semibold text-xl">{(treasuryRules.redeemCooldownMs ?? 86400000) / (60 * 60 * 1000)} hours</p>
            <p className="text-[#5C6370] text-xs mt-1">Wait period</p>
          </div>
          <div className="bg-[#0A0F1A] rounded-lg p-4 border border-white/[0.06]">
            <p className="text-[#6B7280] text-xs mb-1">Subscribe Approval</p>
            <p className={`font-semibold text-xl ${treasuryRules.subscribeRequiresApproval ? 'text-[#9CA3AF]' : 'text-[#E5E7EB]'}`}>
              {treasuryRules.subscribeRequiresApproval ? 'Required' : 'Not Required'}
            </p>
          </div>
          <div className="bg-[#0A0F1A] rounded-lg p-4 border border-white/[0.06]">
            <p className="text-[#6B7280] text-xs mb-1">Redeem Approval</p>
            <p className={`font-semibold text-xl ${treasuryRules.redeemRequiresApproval ? 'text-[#9CA3AF]' : 'text-[#E5E7EB]'}`}>
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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Role Permissions</h3>
        <p className="text-[#6B7280] text-sm mt-1">Permissions and restrictions for each role</p>
      </div>

      <div className="grid gap-4">
        {policy.rolePermissions.map((permission) => (
          <div key={permission.role} className="bg-[#0D1321] rounded-xl p-5 border border-white/[0.06]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#1F2937] text-[#E5E7EB] border border-white/[0.06]">
                  {roleLabels[permission.role]}
                </span>
                {permission.maxTransferAmount > 0 && (
                  <span className="text-[#9CA3AF] text-sm">
                    Max: ${permission.maxTransferAmount.toLocaleString()}
                  </span>
                )}
                {permission.maxTransferAmount === 0 && permission.role === 'admin' && (
                  <span className="text-[#9CA3AF] text-sm">Unlimited</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
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
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${
                      hasPermission
                        ? 'bg-[#4A9EFF]/5 border-[#4A9EFF]/20'
                        : 'bg-[#0A0F1A] border-white/[0.06]'
                    }`}
                  >
                    {hasPermission ? (
                      <CheckIcon size={12} className="text-[#93C5FD]" />
                    ) : (
                      <XIcon size={12} className="text-[#4B5563]" />
                    )}
                    <span className={`text-xs ${hasPermission ? 'text-[#93C5FD]' : 'text-[#4B5563]'}`}>
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
          <p className="text-[#6B7280] text-sm mt-1">Transactions awaiting approval</p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-3 py-2 bg-[#1F2937] border border-white/[0.06] hover:border-white/[0.12] rounded-lg text-[#9CA3AF] hover:text-white text-sm transition-colors"
        >
          <RefreshIcon size={14} />
          Refresh
        </button>
      </div>

      {pendingApprovals.length === 0 ? (
        <div className="bg-[#0D1321] rounded-xl p-8 border border-white/[0.06] text-center">
          <div className="w-12 h-12 rounded-full bg-[#1F2937]/50 flex items-center justify-center mx-auto mb-3">
            <ClockIcon size={24} className="text-[#6B7280]" />
          </div>
          <p className="text-[#9CA3AF]">No pending approvals</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingApprovals.map((approval) => {
            const hasUserSigned = approval.currentSignatures.some((s) => s.signerEmail === currentUserEmail);
            const approvedCount = approval.currentSignatures.filter((s) => s.approved).length;

            return (
              <div key={approval.id} className="bg-[#0D1321] rounded-xl p-5 border border-white/[0.06]">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold uppercase bg-[#1F2937] text-[#E5E7EB] border border-white/[0.06]">
                        {approval.type}
                      </span>
                      <span className="text-[#9CA3AF] text-sm">{approval.token}</span>
                    </div>
                    <p className="text-white text-xl font-bold">${approval.amount.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#6B7280] text-sm">{getTimeRemaining(approval.expiresAt)}</p>
                    <p className="text-[#5C6370] text-xs mt-1">
                      {approvedCount}/{approval.requiredSignatures} approvals
                    </p>
                  </div>
                </div>

                {/* Signatures */}
                <div className="mb-4">
                  <p className="text-[#6B7280] text-xs mb-2">Signatures:</p>
                  <div className="flex flex-wrap gap-2">
                    {approval.currentSignatures.map((sig, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-1 rounded text-xs ${
                          sig.approved
                            ? 'bg-[#4A9EFF]/10 text-[#93C5FD] border border-[#4A9EFF]/20'
                            : 'bg-[#1F2937]/50 text-[#F87171] border border-[#374151]/50'
                        }`}
                      >
                        {sig.signerEmail.split('@')[0]} ({sig.approved ? 'Approved' : 'Rejected'})
                      </span>
                    ))}
                    {Array.from({ length: approval.requiredSignatures - approval.currentSignatures.length }).map((_, idx) => (
                      <span key={`empty-${idx}`} className="px-2 py-1 rounded text-xs bg-[#1F2937]/50 text-[#4B5563] border border-white/[0.06]">
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
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#3B82F6] to-[#2563EB] text-white rounded-lg font-medium transition-all shadow-[0_4px_14px_rgba(59,130,246,0.3)]"
                    >
                      <CheckIcon size={16} />
                      Approve
                    </button>
                    <button
                      onClick={() => onSign(approval.id, false)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#1F2937]/50 hover:bg-[#1F2937] text-[#F87171] border border-[#374151]/50 rounded-lg font-medium transition-colors"
                    >
                      <XIcon size={16} />
                      Reject
                    </button>
                  </div>
                )}
                {hasUserSigned && (
                  <div className="flex items-center justify-center gap-2 py-2 bg-[#4A9EFF]/5 border border-[#4A9EFF]/20 rounded-lg">
                    <CheckIcon size={16} className="text-[#93C5FD]" />
                    <span className="text-[#93C5FD] text-sm">You have already signed</span>
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
        <p className="text-[#6B7280] text-sm mt-1">Record of all treasury operations</p>
      </div>

      {logs.length === 0 ? (
        <div className="bg-[#0D1321] rounded-xl p-8 border border-white/[0.06] text-center">
          <div className="w-12 h-12 rounded-full bg-[#1F2937]/50 flex items-center justify-center mx-auto mb-3">
            <ListIcon size={24} className="text-[#6B7280]" />
          </div>
          <p className="text-[#9CA3AF]">No records yet</p>
        </div>
      ) : (
        <div className="bg-[#0D1321] rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="px-4 py-3 border-b border-white/[0.06] hover:bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${log.success ? 'bg-[#93C5FD]' : 'bg-[#F87171]'}`} />
                    <span className="text-white font-medium">
                      {actionLabels[log.action] || log.action}
                    </span>
                  </div>
                  <span className="text-[#5C6370] text-xs">{formatDate(log.timestamp)}</span>
                </div>
                <div className="mt-1 flex items-center gap-4 text-sm">
                  <span className="text-[#9CA3AF]">{log.userEmail}</span>
                  <span className="text-[#374151]">|</span>
                  <span className="text-[#6B7280]">{log.userRole}</span>
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
    <div className="relative bg-gradient-to-b from-[#0F1629] to-[#0A0F1A] backdrop-blur-md rounded-2xl border border-white/[0.08] overflow-hidden">
      {/* Top highlight line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1F2937] flex items-center justify-center border border-white/[0.06]">
            <SettingsIcon size={20} className="text-[#9CA3AF]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Treasury Settings</h2>
            <p className="text-[#6B7280] text-sm">Policy and limit management</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/[0.05] rounded-lg text-[#6B7280] hover:text-[#E5E7EB] transition-colors"
          >
            <XIcon size={20} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-4 border-b border-white/[0.06] overflow-x-auto">
        <TabButton
          active={activeTab === 'limits'}
          onClick={() => setActiveTab('limits')}
          icon={<ShieldIcon size={16} />}
          label="Limits"
        />
        <TabButton
          active={activeTab === 'thresholds'}
          onClick={() => setActiveTab('thresholds')}
          icon={<UsersIcon size={16} />}
          label="Thresholds"
        />
        <TabButton
          active={activeTab === 'roles'}
          onClick={() => setActiveTab('roles')}
          icon={<ShieldIcon size={16} />}
          label="Roles"
        />
        <TabButton
          active={activeTab === 'approvals'}
          onClick={() => setActiveTab('approvals')}
          icon={
            <div className="relative">
              <ClockIcon size={16} />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#4A9EFF] rounded-full text-xs text-white flex items-center justify-center font-medium">
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
          icon={<ListIcon size={16} />}
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
