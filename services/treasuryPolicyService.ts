/**
 * Treasury Policy Service
 * Central policy management for enterprise wallet
 *
 * Features:
 * - Token-based spending limits (daily/weekly/monthly)
 * - Amount-based multi-sig approval thresholds
 * - Role-based access control
 * - Treasury-specific rules (liquidity, cooldown, etc.)
 * - Audit log
 */

// ============================================
// TYPES & INTERFACES
// ============================================

export type UserRole = 'admin' | 'treasury_manager' | 'operator' | 'viewer' | 'approver';

export type TransactionType = 'transfer' | 'subscribe' | 'redeem' | 'swap';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'executed';

export interface SpendingLimit {
  amount: number;        // Maximum amount (USD)
  used: number;          // Used amount
  resetAt: Date;         // Reset time
  period: 'daily' | 'weekly' | 'monthly';
}

export interface ApprovalThreshold {
  maxAmount: number;           // Valid up to this threshold
  requiredSignatures: number;  // Required signature count
  requiredRoles?: UserRole[];  // Specific roles may be required
  timeoutHours: number;        // Approval timeout
}

export interface TreasuryRule {
  minLiquidityPercent: number;    // Minimum USDC percentage
  maxSingleSubscribePercent: number; // Max subscribe % per transaction
  maxSingleRedeemPercent: number;    // Max redeem % per transaction
  redeemCooldownMs: number;       // Cooldown between redeems (ms)
  subscribeRequiresApproval: boolean; // Subscribe requires approval
  redeemRequiresApproval: boolean;    // Redeem requires approval
}

export interface RolePermission {
  role: UserRole;
  canView: boolean;
  canTransfer: boolean;
  canSubscribe: boolean;
  canRedeem: boolean;
  canApprove: boolean;
  canModifyPolicy: boolean;
  canAddMembers: boolean;
  maxTransferAmount: number;  // Bu rol için max transfer (0 = unlimited for admin)
}

export interface PendingApproval {
  id: string;
  type: TransactionType;
  amount: number;
  token: string;
  fromAddress: string;
  toAddress?: string;
  requestedBy: string;
  requestedAt: Date;
  expiresAt: Date;
  status: ApprovalStatus;
  requiredSignatures: number;
  currentSignatures: ApprovalSignature[];
  metadata?: Record<string, any>;
}

export interface ApprovalSignature {
  signerId: string;
  signerEmail: string;
  signerRole: UserRole;
  signedAt: Date;
  approved: boolean;
  comment?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  details: Record<string, any>;
  ipAddress?: string;
  success: boolean;
  errorMessage?: string;
}

export interface PolicyValidationResult {
  allowed: boolean;
  requiresApproval: boolean;
  requiredSignatures: number;
  requiredRoles: UserRole[];
  reason?: string;
  warnings: string[];
  approvalId?: string;
}

export interface TreasuryPolicy {
  // Versiyon ve metadata
  version: string;
  updatedAt: Date;
  updatedBy: string;

  // Harcama limitleri (token bazlı)
  spendingLimits: {
    USDC: {
      daily: SpendingLimit;
      weekly: SpendingLimit;
      monthly: SpendingLimit;
    };
    USYC: {
      daily: SpendingLimit;
      weekly: SpendingLimit;
      monthly: SpendingLimit;
    };
    EURC: {
      daily: SpendingLimit;
      weekly: SpendingLimit;
      monthly: SpendingLimit;
    };
  };

  // Tek işlem limitleri
  transactionCaps: {
    USDC: number;
    USYC: number;
    EURC: number;
    subscribe: number;  // USDC → USYC max
    redeem: number;     // USYC → USDC max
  };

  // Onay eşikleri (miktar bazlı)
  approvalThresholds: ApprovalThreshold[];

  // Treasury özel kuralları
  treasuryRules: TreasuryRule;

  // Rol yetkileri
  rolePermissions: RolePermission[];

  // Whitelist (onaylı alıcı adresleri)
  whitelistedAddresses: {
    address: string;
    label: string;
    addedAt: Date;
    addedBy: string;
  }[];

  // Genel ayarlar
  settings: {
    requireWhitelistForTransfers: boolean;
    allowEmergencyBypass: boolean;
    emergencyBypassRoles: UserRole[];
    notifyOnLargeTransactions: boolean;
    largeTransactionThreshold: number;
  };
}

// ============================================
// DEFAULT POLICY
// ============================================

const createDefaultSpendingLimit = (
  amount: number,
  period: 'daily' | 'weekly' | 'monthly'
): SpendingLimit => {
  const now = new Date();
  let resetAt: Date;

  switch (period) {
    case 'daily':
      resetAt = new Date(now);
      resetAt.setHours(24, 0, 0, 0);
      break;
    case 'weekly':
      resetAt = new Date(now);
      resetAt.setDate(resetAt.getDate() + (7 - resetAt.getDay()));
      resetAt.setHours(0, 0, 0, 0);
      break;
    case 'monthly':
      resetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
      break;
  }

  return { amount, used: 0, resetAt, period };
};

export const DEFAULT_POLICY: TreasuryPolicy = {
  version: '1.0.0',
  updatedAt: new Date(),
  updatedBy: 'system',

  spendingLimits: {
    USDC: {
      daily: createDefaultSpendingLimit(50000, 'daily'),
      weekly: createDefaultSpendingLimit(200000, 'weekly'),
      monthly: createDefaultSpendingLimit(500000, 'monthly'),
    },
    USYC: {
      daily: createDefaultSpendingLimit(100000, 'daily'),
      weekly: createDefaultSpendingLimit(400000, 'weekly'),
      monthly: createDefaultSpendingLimit(1000000, 'monthly'),
    },
    EURC: {
      daily: createDefaultSpendingLimit(50000, 'daily'),
      weekly: createDefaultSpendingLimit(200000, 'weekly'),
      monthly: createDefaultSpendingLimit(500000, 'monthly'),
    },
  },

  transactionCaps: {
    USDC: 25000,
    USYC: 50000,
    EURC: 25000,
    subscribe: 100000,
    redeem: 50000,
  },

  approvalThresholds: [
    { maxAmount: 1000, requiredSignatures: 1, timeoutHours: 24 },
    { maxAmount: 10000, requiredSignatures: 2, timeoutHours: 48 },
    { maxAmount: 50000, requiredSignatures: 3, requiredRoles: ['treasury_manager'], timeoutHours: 72 },
    { maxAmount: Infinity, requiredSignatures: 4, requiredRoles: ['admin'], timeoutHours: 96 },
  ],

  treasuryRules: {
    minLiquidityPercent: 20,
    maxSingleSubscribePercent: 50,
    maxSingleRedeemPercent: 80,
    redeemCooldownMs: 24 * 60 * 60 * 1000, // 24 saat
    subscribeRequiresApproval: false,
    redeemRequiresApproval: true,
  },

  rolePermissions: [
    {
      role: 'admin',
      canView: true,
      canTransfer: true,
      canSubscribe: true,
      canRedeem: true,
      canApprove: true,
      canModifyPolicy: true,
      canAddMembers: true,
      maxTransferAmount: 0, // Unlimited
    },
    {
      role: 'treasury_manager',
      canView: true,
      canTransfer: true,
      canSubscribe: true,
      canRedeem: true,
      canApprove: true,
      canModifyPolicy: false,
      canAddMembers: false,
      maxTransferAmount: 50000,
    },
    {
      role: 'operator',
      canView: true,
      canTransfer: true,
      canSubscribe: true,
      canRedeem: false,
      canApprove: false,
      canModifyPolicy: false,
      canAddMembers: false,
      maxTransferAmount: 10000,
    },
    {
      role: 'approver',
      canView: true,
      canTransfer: false,
      canSubscribe: false,
      canRedeem: false,
      canApprove: true,
      canModifyPolicy: false,
      canAddMembers: false,
      maxTransferAmount: 0,
    },
    {
      role: 'viewer',
      canView: true,
      canTransfer: false,
      canSubscribe: false,
      canRedeem: false,
      canApprove: false,
      canModifyPolicy: false,
      canAddMembers: false,
      maxTransferAmount: 0,
    },
  ],

  whitelistedAddresses: [],

  settings: {
    requireWhitelistForTransfers: false,
    allowEmergencyBypass: true,
    emergencyBypassRoles: ['admin'],
    notifyOnLargeTransactions: true,
    largeTransactionThreshold: 10000,
  },
};

// ============================================
// TREASURY POLICY SERVICE
// ============================================

class TreasuryPolicyService {
  private policy: TreasuryPolicy;
  private pendingApprovals: Map<string, PendingApproval> = new Map();
  private auditLog: AuditLogEntry[] = [];
  private lastRedeemTime: Map<string, Date> = new Map(); // walletAddress -> lastRedeem

  constructor() {
    // LocalStorage'dan policy yükle veya default kullan
    const stored = localStorage.getItem('arcwallet:treasury:policy');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Date'leri restore et
        this.policy = this.restoreDates(parsed);
      } catch {
        this.policy = { ...DEFAULT_POLICY };
      }
    } else {
      this.policy = { ...DEFAULT_POLICY };
    }

    // Pending approvals yükle
    const storedApprovals = localStorage.getItem('arcwallet:treasury:approvals');
    if (storedApprovals) {
      try {
        const parsed = JSON.parse(storedApprovals);
        parsed.forEach((approval: PendingApproval) => {
          this.pendingApprovals.set(approval.id, this.restoreApprovalDates(approval));
        });
      } catch {
        // Ignore
      }
    }

    // Audit log yükle
    const storedAudit = localStorage.getItem('arcwallet:treasury:audit');
    if (storedAudit) {
      try {
        this.auditLog = JSON.parse(storedAudit).map((entry: AuditLogEntry) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }));
      } catch {
        // Ignore
      }
    }

    // Limitlieri sıfırlama kontrolü
    this.checkAndResetLimits();
  }

  // ============================================
  // POLICY MANAGEMENT
  // ============================================

  getPolicy(): TreasuryPolicy {
    return { ...this.policy };
  }

  updatePolicy(updates: Partial<TreasuryPolicy>, updatedBy: string): void {
    this.policy = {
      ...this.policy,
      ...updates,
      updatedAt: new Date(),
      updatedBy,
    };
    this.savePolicy();
    this.logAuditEntry('policy_updated', updatedBy, 'admin', { updates }, true);
  }

  // ============================================
  // VALIDATION
  // ============================================

  /**
   * İşlem öncesi validasyon - Tüm kontrolleri yapar
   */
  validateTransaction(
    type: TransactionType,
    amount: number,
    token: string,
    userRole: UserRole,
    userEmail: string,
    walletAddress: string,
    toAddress?: string,
    currentUsdcBalance?: number,
    currentUsycBalance?: number
  ): PolicyValidationResult {
    const warnings: string[] = [];
    let requiresApproval = false;
    let requiredSignatures = 1;
    let requiredRoles: UserRole[] = [];

    // 1. Rol yetkisi kontrolü
    const rolePermission = this.getRolePermission(userRole);
    if (!rolePermission) {
      return {
        allowed: false,
        requiresApproval: false,
        requiredSignatures: 0,
        requiredRoles: [],
        reason: 'Invalid role',
        warnings: [],
      };
    }

    // İşlem türüne göre yetki kontrolü
    if (type === 'transfer' && !rolePermission.canTransfer) {
      return {
        allowed: false,
        requiresApproval: false,
        requiredSignatures: 0,
        requiredRoles: [],
        reason: 'No transfer permission',
        warnings: [],
      };
    }
    if (type === 'subscribe' && !rolePermission.canSubscribe) {
      return {
        allowed: false,
        requiresApproval: false,
        requiredSignatures: 0,
        requiredRoles: [],
        reason: 'No subscribe permission',
        warnings: [],
      };
    }
    if (type === 'redeem' && !rolePermission.canRedeem) {
      return {
        allowed: false,
        requiresApproval: false,
        requiredSignatures: 0,
        requiredRoles: [],
        reason: 'No redeem permission',
        warnings: [],
      };
    }

    // 2. Rol bazlı miktar limiti
    if (rolePermission.maxTransferAmount > 0 && amount > rolePermission.maxTransferAmount) {
      requiresApproval = true;
      warnings.push(`Exceeds your role limit ($${rolePermission.maxTransferAmount}). Approval required.`);
    }

    // 3. Tek işlem limiti kontrolü
    const capKey = type === 'subscribe' ? 'subscribe' : type === 'redeem' ? 'redeem' : token;
    const transactionCap = this.policy.transactionCaps[capKey as keyof typeof this.policy.transactionCaps];
    if (transactionCap && amount > transactionCap) {
      return {
        allowed: false,
        requiresApproval: false,
        requiredSignatures: 0,
        requiredRoles: [],
        reason: `Single transaction limit exceeded. Maximum: $${transactionCap.toLocaleString()}`,
        warnings: [],
      };
    }

    // 4. Günlük/Haftalık/Aylık limit kontrolü
    if (token in this.policy.spendingLimits) {
      const tokenLimits = this.policy.spendingLimits[token as keyof typeof this.policy.spendingLimits];

      // Limitleri sıfırla (gerekirse)
      this.checkAndResetLimits();

      if (tokenLimits.daily.used + amount > tokenLimits.daily.amount) {
        return {
          allowed: false,
          requiresApproval: false,
          requiredSignatures: 0,
          requiredRoles: [],
          reason: `Daily ${token} limit exceeded. Remaining: $${(tokenLimits.daily.amount - tokenLimits.daily.used).toLocaleString()}`,
          warnings: [],
        };
      }
      if (tokenLimits.weekly.used + amount > tokenLimits.weekly.amount) {
        warnings.push(`Approaching weekly limit`);
      }
      if (tokenLimits.monthly.used + amount > tokenLimits.monthly.amount) {
        warnings.push(`Approaching monthly limit`);
      }
    }

    // 5. Treasury özel kuralları
    if (type === 'subscribe' && currentUsdcBalance !== undefined) {
      // Minimum likidite kontrolü
      const afterSubscribe = currentUsdcBalance - amount;
      const totalValue = currentUsdcBalance + (currentUsycBalance || 0);
      const afterLiquidityPercent = (afterSubscribe / totalValue) * 100;

      if (afterLiquidityPercent < this.policy.treasuryRules.minLiquidityPercent) {
        return {
          allowed: false,
          requiresApproval: false,
          requiredSignatures: 0,
          requiredRoles: [],
          reason: `Minimum liquidity rule: At least ${this.policy.treasuryRules.minLiquidityPercent}% USDC must be maintained`,
          warnings: [],
        };
      }

      // Max single subscribe kontrolü
      const subscribePercent = (amount / currentUsdcBalance) * 100;
      if (subscribePercent > this.policy.treasuryRules.maxSingleSubscribePercent) {
        requiresApproval = true;
        warnings.push(`You are subscribing ${subscribePercent.toFixed(0)}% of your USDC. Approval required.`);
      }

      if (this.policy.treasuryRules.subscribeRequiresApproval) {
        requiresApproval = true;
      }
    }

    if (type === 'redeem' && currentUsycBalance !== undefined) {
      // Cooldown kontrolü
      const lastRedeem = this.lastRedeemTime.get(walletAddress);
      if (lastRedeem) {
        const timeSinceLastRedeem = Date.now() - lastRedeem.getTime();
        if (timeSinceLastRedeem < this.policy.treasuryRules.redeemCooldownMs) {
          const remainingHours = Math.ceil((this.policy.treasuryRules.redeemCooldownMs - timeSinceLastRedeem) / (60 * 60 * 1000));
          return {
            allowed: false,
            requiresApproval: false,
            requiredSignatures: 0,
            requiredRoles: [],
            reason: `Redeem cooldown active. Please wait ${remainingHours} hour(s).`,
            warnings: [],
          };
        }
      }

      // Max single redeem kontrolü
      const redeemPercent = (amount / currentUsycBalance) * 100;
      if (redeemPercent > this.policy.treasuryRules.maxSingleRedeemPercent) {
        return {
          allowed: false,
          requiresApproval: false,
          requiredSignatures: 0,
          requiredRoles: [],
          reason: `Maximum ${this.policy.treasuryRules.maxSingleRedeemPercent}% USYC can be redeemed at once`,
          warnings: [],
        };
      }

      if (this.policy.treasuryRules.redeemRequiresApproval) {
        requiresApproval = true;
      }
    }

    // 6. Whitelist kontrolü (transfer için)
    if (type === 'transfer' && toAddress && this.policy.settings.requireWhitelistForTransfers) {
      const isWhitelisted = this.policy.whitelistedAddresses.some(
        (w) => w.address.toLowerCase() === toAddress.toLowerCase()
      );
      if (!isWhitelisted) {
        return {
          allowed: false,
          requiresApproval: false,
          requiredSignatures: 0,
          requiredRoles: [],
          reason: 'Recipient address is not whitelisted',
          warnings: [],
        };
      }
    }

    // 7. Miktar bazlı onay eşiği belirleme
    const threshold = this.getApprovalThreshold(amount);
    if (threshold.requiredSignatures > 1) {
      requiresApproval = true;
      requiredSignatures = threshold.requiredSignatures;
      requiredRoles = threshold.requiredRoles || [];
    }

    // 8. Büyük işlem bildirimi
    if (this.policy.settings.notifyOnLargeTransactions &&
        amount >= this.policy.settings.largeTransactionThreshold) {
      warnings.push('This transaction will be logged as a large transaction');
    }

    return {
      allowed: true,
      requiresApproval,
      requiredSignatures,
      requiredRoles,
      warnings,
    };
  }

  /**
   * Miktar için onay eşiğini belirle
   */
  getApprovalThreshold(amount: number): ApprovalThreshold {
    for (const threshold of this.policy.approvalThresholds) {
      if (amount <= threshold.maxAmount) {
        return threshold;
      }
    }
    // En yüksek eşik
    return this.policy.approvalThresholds[this.policy.approvalThresholds.length - 1];
  }

  /**
   * Rol yetkilerini getir
   */
  getRolePermission(role: UserRole): RolePermission | undefined {
    return this.policy.rolePermissions.find((p) => p.role === role);
  }

  // ============================================
  // APPROVAL WORKFLOW
  // ============================================

  /**
   * Onay talebi oluştur
   */
  createApprovalRequest(
    type: TransactionType,
    amount: number,
    token: string,
    fromAddress: string,
    requestedBy: string,
    requiredSignatures: number,
    toAddress?: string,
    metadata?: Record<string, any>
  ): PendingApproval {
    const threshold = this.getApprovalThreshold(amount);
    const id = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const approval: PendingApproval = {
      id,
      type,
      amount,
      token,
      fromAddress,
      toAddress,
      requestedBy,
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + threshold.timeoutHours * 60 * 60 * 1000),
      status: 'pending',
      requiredSignatures,
      currentSignatures: [],
      metadata,
    };

    this.pendingApprovals.set(id, approval);
    this.saveApprovals();

    this.logAuditEntry(
      'approval_created',
      requestedBy,
      'operator', // Will be updated with actual role
      { approvalId: id, type, amount, token },
      true
    );

    return approval;
  }

  /**
   * Onay ver
   */
  signApproval(
    approvalId: string,
    signerId: string,
    signerEmail: string,
    signerRole: UserRole,
    approved: boolean,
    comment?: string
  ): { success: boolean; executed: boolean; message: string } {
    const approval = this.pendingApprovals.get(approvalId);

    if (!approval) {
      return { success: false, executed: false, message: 'Approval request not found' };
    }

    if (approval.status !== 'pending') {
      return { success: false, executed: false, message: `Request is already ${approval.status}` };
    }

    if (new Date() > approval.expiresAt) {
      approval.status = 'expired';
      this.saveApprovals();
      return { success: false, executed: false, message: 'Approval period has expired' };
    }

    // Daha önce imzalamış mı kontrol et
    if (approval.currentSignatures.some((s) => s.signerId === signerId)) {
      return { success: false, executed: false, message: 'You have already signed' };
    }

    // Rol yetkisi kontrol
    const rolePermission = this.getRolePermission(signerRole);
    if (!rolePermission?.canApprove) {
      return { success: false, executed: false, message: 'You do not have approval permission' };
    }

    // İmza ekle
    approval.currentSignatures.push({
      signerId,
      signerEmail,
      signerRole,
      signedAt: new Date(),
      approved,
      comment,
    });

    // Red kontrolü
    if (!approved) {
      const rejections = approval.currentSignatures.filter((s) => !s.approved).length;
      if (rejections >= 1) { // Tek red yeterli
        approval.status = 'rejected';
        this.saveApprovals();
        this.logAuditEntry('approval_rejected', signerId, signerRole, { approvalId }, true);
        return { success: true, executed: false, message: 'Request rejected' };
      }
    }

    // Onay sayısı kontrolü
    const approvals = approval.currentSignatures.filter((s) => s.approved).length;
    if (approvals >= approval.requiredSignatures) {
      approval.status = 'approved';
      this.saveApprovals();
      this.logAuditEntry('approval_completed', signerId, signerRole, { approvalId }, true);
      return { success: true, executed: false, message: 'Approval completed. Transaction ready.' };
    }

    this.saveApprovals();
    this.logAuditEntry('approval_signed', signerId, signerRole, { approvalId, approved }, true);

    return {
      success: true,
      executed: false,
      message: `Signature added. ${approvals}/${approval.requiredSignatures} approvals`,
    };
  }

  /**
   * Onaylı işlemi yürütüldü olarak işaretle
   */
  markAsExecuted(approvalId: string): void {
    const approval = this.pendingApprovals.get(approvalId);
    if (approval && approval.status === 'approved') {
      approval.status = 'executed';
      this.saveApprovals();
    }
  }

  /**
   * Bekleyen onayları getir
   */
  getPendingApprovals(walletAddress?: string): PendingApproval[] {
    const approvals = Array.from(this.pendingApprovals.values());

    // Süresi dolmuşları güncelle
    approvals.forEach((a) => {
      if (a.status === 'pending' && new Date() > a.expiresAt) {
        a.status = 'expired';
      }
    });
    this.saveApprovals();

    if (walletAddress) {
      return approvals.filter(
        (a) => a.fromAddress.toLowerCase() === walletAddress.toLowerCase() && a.status === 'pending'
      );
    }

    return approvals.filter((a) => a.status === 'pending');
  }

  /**
   * Tüm onayları getir (tarihçe dahil)
   */
  getAllApprovals(limit: number = 50): PendingApproval[] {
    return Array.from(this.pendingApprovals.values())
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime())
      .slice(0, limit);
  }

  // ============================================
  // SPENDING TRACKING
  // ============================================

  /**
   * Harcama kaydet (işlem sonrası)
   */
  recordSpending(walletAddress: string, token: string, amount: number): void {
    if (!(token in this.policy.spendingLimits)) return;

    const limits = this.policy.spendingLimits[token as keyof typeof this.policy.spendingLimits];
    limits.daily.used += amount;
    limits.weekly.used += amount;
    limits.monthly.used += amount;

    this.savePolicy();
  }

  /**
   * Redeem zamanı kaydet
   */
  recordRedeem(walletAddress: string): void {
    this.lastRedeemTime.set(walletAddress, new Date());
  }

  /**
   * Limitleri kontrol et ve sıfırla
   */
  private checkAndResetLimits(): void {
    const now = new Date();

    Object.values(this.policy.spendingLimits).forEach((tokenLimits) => {
      // Daily reset
      if (now >= tokenLimits.daily.resetAt) {
        tokenLimits.daily.used = 0;
        tokenLimits.daily.resetAt = new Date(now);
        tokenLimits.daily.resetAt.setHours(24, 0, 0, 0);
      }

      // Weekly reset
      if (now >= tokenLimits.weekly.resetAt) {
        tokenLimits.weekly.used = 0;
        tokenLimits.weekly.resetAt = new Date(now);
        tokenLimits.weekly.resetAt.setDate(tokenLimits.weekly.resetAt.getDate() + (7 - tokenLimits.weekly.resetAt.getDay()));
        tokenLimits.weekly.resetAt.setHours(0, 0, 0, 0);
      }

      // Monthly reset
      if (now >= tokenLimits.monthly.resetAt) {
        tokenLimits.monthly.used = 0;
        tokenLimits.monthly.resetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
      }
    });

    this.savePolicy();
  }

  /**
   * Kalan limitleri getir
   */
  getRemainingLimits(token: string): { daily: number; weekly: number; monthly: number } | null {
    if (!(token in this.policy.spendingLimits)) return null;

    this.checkAndResetLimits();
    const limits = this.policy.spendingLimits[token as keyof typeof this.policy.spendingLimits];

    return {
      daily: Math.max(0, limits.daily.amount - limits.daily.used),
      weekly: Math.max(0, limits.weekly.amount - limits.weekly.used),
      monthly: Math.max(0, limits.monthly.amount - limits.monthly.used),
    };
  }

  // ============================================
  // WHITELIST MANAGEMENT
  // ============================================

  addToWhitelist(address: string, label: string, addedBy: string): void {
    const existing = this.policy.whitelistedAddresses.find(
      (w) => w.address.toLowerCase() === address.toLowerCase()
    );

    if (!existing) {
      this.policy.whitelistedAddresses.push({
        address,
        label,
        addedAt: new Date(),
        addedBy,
      });
      this.savePolicy();
      this.logAuditEntry('whitelist_added', addedBy, 'admin', { address, label }, true);
    }
  }

  removeFromWhitelist(address: string, removedBy: string): void {
    this.policy.whitelistedAddresses = this.policy.whitelistedAddresses.filter(
      (w) => w.address.toLowerCase() !== address.toLowerCase()
    );
    this.savePolicy();
    this.logAuditEntry('whitelist_removed', removedBy, 'admin', { address }, true);
  }

  isWhitelisted(address: string): boolean {
    return this.policy.whitelistedAddresses.some(
      (w) => w.address.toLowerCase() === address.toLowerCase()
    );
  }

  // ============================================
  // AUDIT LOG
  // ============================================

  private logAuditEntry(
    action: string,
    userId: string,
    userRole: UserRole,
    details: Record<string, any>,
    success: boolean,
    errorMessage?: string
  ): void {
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      action,
      userId,
      userEmail: userId, // Will be the email
      userRole,
      details,
      success,
      errorMessage,
    };

    this.auditLog.unshift(entry);

    // Son 1000 kaydı tut
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(0, 1000);
    }

    this.saveAuditLog();
  }

  getAuditLog(limit: number = 100): AuditLogEntry[] {
    return this.auditLog.slice(0, limit);
  }

  /**
   * Public audit log interface for external services
   */
  addAuditLog(params: {
    action: string;
    performedBy: string;
    details: string;
    transactionId?: string;
  }): void {
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      action: params.action,
      userId: params.performedBy,
      userEmail: params.performedBy,
      userRole: 'admin', // Default role for external calls
      details: { message: params.details, transactionId: params.transactionId },
      success: true,
    };

    this.auditLog.unshift(entry);

    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(0, 1000);
    }

    this.saveAuditLog();
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  private savePolicy(): void {
    localStorage.setItem('arcwallet:treasury:policy', JSON.stringify(this.policy));
  }

  private saveApprovals(): void {
    const approvals = Array.from(this.pendingApprovals.values());
    localStorage.setItem('arcwallet:treasury:approvals', JSON.stringify(approvals));
  }

  private saveAuditLog(): void {
    localStorage.setItem('arcwallet:treasury:audit', JSON.stringify(this.auditLog));
  }

  private restoreDates(policy: any): TreasuryPolicy {
    // Spending limits dates
    Object.values(policy.spendingLimits || {}).forEach((tokenLimits: any) => {
      ['daily', 'weekly', 'monthly'].forEach((period) => {
        if (tokenLimits[period]?.resetAt) {
          tokenLimits[period].resetAt = new Date(tokenLimits[period].resetAt);
        }
      });
    });

    // Whitelist dates
    policy.whitelistedAddresses?.forEach((w: any) => {
      if (w.addedAt) w.addedAt = new Date(w.addedAt);
    });

    // Updated at
    if (policy.updatedAt) policy.updatedAt = new Date(policy.updatedAt);

    return policy;
  }

  private restoreApprovalDates(approval: any): PendingApproval {
    return {
      ...approval,
      requestedAt: new Date(approval.requestedAt),
      expiresAt: new Date(approval.expiresAt),
      currentSignatures: approval.currentSignatures.map((s: any) => ({
        ...s,
        signedAt: new Date(s.signedAt),
      })),
    };
  }

  // ============================================
  // UTILITY
  // ============================================

  /**
   * Policy'yi varsayılana sıfırla
   */
  resetToDefault(): void {
    this.policy = { ...DEFAULT_POLICY };
    this.savePolicy();
  }

  /**
   * Tüm verileri temizle
   */
  clearAll(): void {
    this.policy = { ...DEFAULT_POLICY };
    this.pendingApprovals.clear();
    this.auditLog = [];
    this.lastRedeemTime.clear();
    localStorage.removeItem('arcwallet:treasury:policy');
    localStorage.removeItem('arcwallet:treasury:approvals');
    localStorage.removeItem('arcwallet:treasury:audit');
  }
}

// Singleton instance
export const treasuryPolicyService = new TreasuryPolicyService();
export default treasuryPolicyService;
