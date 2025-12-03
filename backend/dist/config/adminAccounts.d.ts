/**
 * Admin Accounts Configuration
 *
 * Bu dosya admin kullanıcılarının kritik bilgilerini saklar.
 * Cüzdan kurtarma veya passkey sorunlarında kullanılır.
 *
 * GÜVENLIK: Bu dosya production'da .env'den okunmalı
 */
export interface AdminAccountConfig {
    email: string;
    walletAddress: string;
    publicKeyX: string;
    publicKeyY: string;
    credentialId?: string;
    notes: string;
}
export declare const ADMIN_ACCOUNTS: AdminAccountConfig[];
/**
 * Email ile admin hesabını bul
 */
export declare function getAdminAccount(email: string): AdminAccountConfig | undefined;
/**
 * Wallet adresi ile admin hesabını bul
 */
export declare function getAdminByWallet(walletAddress: string): AdminAccountConfig | undefined;
/**
 * Email'in admin olup olmadığını kontrol et
 */
export declare function isAdminEmail(email: string): boolean;
//# sourceMappingURL=adminAccounts.d.ts.map