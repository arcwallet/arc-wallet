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

export const ADMIN_ACCOUNTS: AdminAccountConfig[] = [
  {
    email: 'seher@arcwallet.network',
    walletAddress: '0x72c90791145C55966903D661Fc286eBbbB47f151',
    publicKeyX: '0xa60c860ef7d5cc3a725eedcf05709c0793f1eb1c673e5a272edc5f8cde13eb08',
    publicKeyY: '0x9fbc5dd1b24f071d7eb13e78b55297ca7d88c5ce6932799ca247883214d2f88e',
    credentialId: 'N1wTvQCqlG3jaUcpSxAsAQ',
    notes: 'Ana admin hesabı - Mac passkey ile oluşturuldu. Arc Testnet üzerinde deploy edilmiş cüzdan.'
  },
  {
    email: 'sehereroglu786@gmail.com',
    walletAddress: '0x72c90791145C55966903D661Fc286eBbbB47f151',
    publicKeyX: '0xa60c860ef7d5cc3a725eedcf05709c0793f1eb1c673e5a272edc5f8cde13eb08',
    publicKeyY: '0x9fbc5dd1b24f071d7eb13e78b55297ca7d88c5ce6932799ca247883214d2f88e',
    credentialId: 'N1wTvQCqlG3jaUcpSxAsAQ',
    notes: 'Gmail hesabı - aynı cüzdan, aynı passkey'
  }
];

/**
 * Email ile admin hesabını bul
 */
export function getAdminAccount(email: string): AdminAccountConfig | undefined {
  return ADMIN_ACCOUNTS.find(a => a.email.toLowerCase() === email.toLowerCase());
}

/**
 * Wallet adresi ile admin hesabını bul
 */
export function getAdminByWallet(walletAddress: string): AdminAccountConfig | undefined {
  return ADMIN_ACCOUNTS.find(a => a.walletAddress.toLowerCase() === walletAddress.toLowerCase());
}

/**
 * Email'in admin olup olmadığını kontrol et
 */
export function isAdminEmail(email: string): boolean {
  return ADMIN_ACCOUNTS.some(a => a.email.toLowerCase() === email.toLowerCase());
}
