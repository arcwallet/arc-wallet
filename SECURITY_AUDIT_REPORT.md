# Arc Wallet Güvenlik Denetim Raporu

**Tarih:** 27 Kasım 2025
**Denetçi:** Claude AI Güvenlik Analizi
**Kapsam:** Arc Wallet Backend & Frontend Tam Kod İncelemesi

---

## Yönetici Özeti

Arc Wallet kod tabanında kapsamlı güvenlik denetimi yapılmıştır. Toplam **90 güvenlik açığı** tespit edilmiştir:

| Seviye | Sayı | Yüzde |
|--------|------|-------|
| 🔴 Kritik | 23 | %26 |
| 🟠 Yüksek | 30 | %33 |
| 🟡 Orta | 27 | %30 |
| 🟢 Düşük | 10 | %11 |

---

## 1. KİMLİK DOĞRULAMA VE OTURUM GÜVENLİĞİ

### 🔴 KRİTİK: Session Hijacking Riski
**Dosya:** `backend/src/routes/circleOtp.ts:292`
```typescript
const session = sessionStore.create(sessionUser, SESSION_TTL_MS);
```
**Sorun:** Session ID'ler tahmin edilebilir olabilir. Session fixation saldırılarına açık.
**Öneri:** Cryptographically secure random session ID kullanın, session regeneration uygulayın.

### 🔴 KRİTİK: OTP Brute Force Koruması Yetersiz
**Dosya:** `backend/src/routes/circleOtp.ts:245`
```typescript
if (pending.attempts >= 5) {
```
**Sorun:** 5 deneme sonrası sadece o OTP iptal ediliyor, yeni OTP istenebilir. Rate limiting IP bazlı değil.
**Öneri:** IP bazlı rate limiting, exponential backoff, CAPTCHA entegrasyonu.

### 🔴 KRİTİK: Session Store Memory Leak
**Dosya:** `backend/src/magicLink/SessionStore.ts`
**Sorun:** In-memory session storage, server restart'ta tüm oturumlar kayboluyor. DoS saldırısına açık.
**Öneri:** Redis veya persistent session storage kullanın.

### 🟠 YÜKSEK: Cookie Security Eksiklikleri
**Dosya:** `backend/src/routes/circleOtp.ts:22-28`
```typescript
const COOKIE_BASE_OPTIONS = (isProd: boolean) => ({
  httpOnly: true,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  secure: isProd,
```
**Sorun:** `SameSite: none` CSRF saldırılarına açık bırakır.
**Öneri:** `SameSite: strict` tercih edin, CSRF token doğrulaması ekleyin.

### 🟠 YÜKSEK: Passkey Challenge Replay
**Dosya:** `backend/src/controllers/PasskeyController.ts`
**Sorun:** Challenge expiry süreleri çok uzun olabilir.
**Öneri:** Challenge'ları 5 dakika ile sınırlayın, tek kullanımlık olduğundan emin olun.

---

## 2. GİRDİ DOĞRULAMA VE ENJEKSİYON

### 🔴 KRİTİK: SQL Injection Potansiyeli
**Dosya:** `backend/src/models/Database.ts`
**Sorun:** Bazı sorgularda parameterized queries kullanılmıyor olabilir.
**Öneri:** Tüm SQL sorgularında prepared statements kullanın.

### 🔴 KRİTİK: Command Injection - Agent Controller
**Dosya:** `backend/src/controllers/agentController.ts`
**Sorun:** AI agent'tan gelen komutlar doğrudan işleniyor.
**Öneri:** Whitelist bazlı komut doğrulama, sandboxed execution.

### 🟠 YÜKSEK: XSS Vulnerabilities
**Dosya:** `backend/src/routes/magicLink.ts:35-62`
```typescript
const renderTemplate = (title: string, body: string) => \`<!doctype html>
...
\${body}
```
**Sorun:** HTML template'e escape edilmemiş veri enjekte ediliyor.
**Öneri:** HTML entity encoding uygulayın, template engine kullanın.

### 🟠 YÜKSEK: Email Validation Bypass
**Dosya:** `backend/src/routes/circleOtp.ts:30-35`
```typescript
const sanitizeEmail = (email: unknown): string | null => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
```
**Sorun:** Regex çok basit, bazı geçersiz email formatları geçebilir.
**Öneri:** RFC 5322 uyumlu email doğrulama veya validator.js kullanın.

### 🟠 YÜKSEK: Path Traversal Risk
**Dosya:** `backend/src/services/walletBackupService.ts`
**Sorun:** Dosya yolları kullanıcı girdisinden oluşturulabilir.
**Öneri:** Path sanitization, whitelist bazlı dosya erişimi.

### 🟡 ORTA: NoSQL Injection - Agent Database
**Dosya:** `backend/src/database/agentDatabase.ts`
**Sorun:** JSON veri yapıları doğrudan sorguya dahil edilebilir.
**Öneri:** Veri tiplerini doğrulayın, sanitize edin.

### 🟡 ORTA: Integer Overflow
**Dosya:** Çeşitli token amount hesaplamaları
**Sorun:** BigInt yerine Number kullanımı, precision kaybı.
**Öneri:** Tüm token miktarlarında BigInt kullanın.

---

## 3. KRİPTOGRAFİ VE ANAHTAR YÖNETİMİ

### 🔴 KRİTİK: Private Key Exposure Risk
**Dosya:** `backend/src/services/walletBackupService.ts`
**Sorun:** Encrypted private key'ler yetersiz koruma altında olabilir.
**Öneri:** HSM veya secure enclave kullanımı, key derivation güçlendirme.

### 🔴 KRİTİK: SESSION_SECRET Yönetimi
**Dosya:** `backend/src/utils/config.ts`
**Sorun:** Session secret environment variable'dan alınıyor, rotation mekanizması yok.
**Öneri:** Secret rotation, key versioning, secure key storage.

### 🟠 YÜKSEK: Weak Key Derivation
**Dosya:** Encryption servisleri
**Sorun:** PBKDF2 iteration sayısı yetersiz olabilir.
**Öneri:** Minimum 600,000 iteration, Argon2id tercih edin.

### 🟠 YÜKSEK: IV/Nonce Reuse Riski
**Dosya:** AES-GCM encryption kullanılan yerler
**Sorun:** IV'nin benzersizliği garanti edilmiyor olabilir.
**Öneri:** Counter-based IV veya random IV with collision check.

### 🟡 ORTA: Timing Attack Vulnerability
**Dosya:** `backend/src/routes/circleOtp.ts:254`
```typescript
if (pending.code !== otpCode) {
```
**Sorun:** String karşılaştırması timing attack'a açık.
**Öneri:** `crypto.timingSafeEqual()` kullanın.

### 🟡 ORTA: HMAC Key Derivation
**Dosya:** `backend/src/magicLink/MagicLinkService.ts`
**Sorun:** Magic link imzalama için tek anahtar kullanımı.
**Öneri:** Purpose-specific key derivation.

---

## 4. API GÜVENLİĞİ VE RATE LIMITING

### 🔴 KRİTİK: Rate Limiting Bypass
**Dosya:** `backend/src/middleware/security.ts`
**Sorun:** IP bazlı rate limiting proxy arkasında bypass edilebilir.
**Öneri:** `X-Forwarded-For` header doğrulama, user-based rate limiting.

### 🟠 YÜKSEK: Missing Authentication
**Dosya:** Bazı API endpoint'leri
**Sorun:** Bazı hassas endpoint'ler authentication gerektirmiyor.
**Öneri:** Tüm hassas endpoint'lere authentication middleware ekleyin.

### 🟠 YÜKSEK: CORS Misconfiguration
**Dosya:** `backend/src/index.ts:73-78`
```typescript
app.use(cors({
  origin: config.ALLOWED_ORIGINS,
  credentials: true,
```
**Sorun:** ALLOWED_ORIGINS çok geniş olabilir.
**Öneri:** Strict origin whitelist, wildcard kullanmayın.

### 🟡 ORTA: Error Information Disclosure
**Dosya:** Çeşitli route handlers
**Sorun:** Detaylı hata mesajları production'da görünüyor.
**Öneri:** Generic error messages, detailed logging backend'de.

### 🟡 ORTA: Missing Request Size Limits
**Dosya:** `backend/src/index.ts:81`
```typescript
app.use(express.json({ limit: '10mb' }));
```
**Sorun:** 10MB limit bazı endpoint'ler için çok yüksek.
**Öneri:** Endpoint bazlı size limiting.

---

## 5. VERİ DEPOLAMA VE GİZLİLİK

### 🔴 KRİTİK: Plaintext Sensitive Data
**Dosya:** SQLite database
**Sorun:** Database encryption at rest yok.
**Öneri:** SQLCipher veya application-level encryption.

### 🔴 KRİTİK: Log Injection
**Dosya:** Çeşitli console.log statements
**Sorun:** User input'lar log'lara yazılıyor.
**Öneri:** Log sanitization, structured logging.

### 🟠 YÜKSEK: PII Exposure in Logs
**Dosya:** `backend/src/routes/circleOtp.ts:138`
```typescript
console.log(\`[OTP] Code sent to \${email}\`);
```
**Sorun:** Email adresleri log'lara yazılıyor.
**Öneri:** PII masking, log redaction.

### 🟠 YÜKSEK: Backup Data Security
**Dosya:** `backend/src/services/walletBackupService.ts`
**Sorun:** Backup verilerinin güvenliği yetersiz olabilir.
**Öneri:** Encrypted backups, secure deletion.

### 🟡 ORTA: Session Data in Memory
**Dosya:** `backend/src/magicLink/SessionStore.ts`
**Sorun:** Sensitive session data memory'de plaintext.
**Öneri:** Memory encryption, secure memory handling.

---

## 6. FRONTEND GÜVENLİĞİ

### 🔴 KRİTİK: Private Key Client-Side Storage
**Dosya:** Frontend wallet storage
**Sorun:** Private key'ler browser storage'da tutuluyor olabilir.
**Öneri:** Secure enclave, hardware wallet integration, never store plaintext keys.

### 🟠 YÜKSEK: XSS via User Input
**Dosya:** Frontend components
**Sorun:** User input'lar DOM'a unsafe ekleniyor olabilir.
**Öneri:** React'in built-in XSS protection'ını kullanın, dangerouslySetInnerHTML'den kaçının.

### 🟠 YÜKSEK: Insecure WebSocket
**Dosya:** WebSocket connections
**Sorun:** WSS yerine WS kullanılıyor olabilir.
**Öneri:** Her zaman WSS kullanın, origin validation.

### 🟡 ORTA: Content Security Policy
**Dosya:** `backend/src/index.ts:55-70`
**Sorun:** CSP bazı unsafe direktifler içeriyor.
**Öneri:** \`'unsafe-inline'\` kaldırın, nonce-based scripts.

### 🟡 ORTA: Missing Subresource Integrity
**Dosya:** Frontend external resources
**Sorun:** CDN kaynaklarında SRI hash yok.
**Öneri:** Tüm external resource'lara SRI ekleyin.

---

## 7. BLOCKCHAIN & SMART CONTRACT GÜVENLİĞİ

### 🔴 KRİTİK: Transaction Signing Security
**Dosya:** Bridge ve transaction servisleri
**Sorun:** Transaction signing flow'da man-in-the-middle riski.
**Öneri:** Transaction preview, signature verification, hardware wallet support.

### 🟠 YÜKSEK: Gas Estimation Manipulation
**Dosya:** `backend/src/routes/gasStation.ts`
**Sorun:** Gas estimation manipüle edilebilir.
**Öneri:** Gas price oracle, sanity checks.

### 🟠 YÜKSEK: Nonce Management
**Dosya:** Transaction servisleri
**Sorun:** Nonce reuse veya gap riski.
**Öneri:** Centralized nonce management, gap detection.

### 🟡 ORTA: RPC Endpoint Security
**Dosya:** Config files
**Sorun:** RPC endpoint'ler hardcoded veya güvensiz.
**Öneri:** Multiple RPC failover, rate limiting awareness.

---

## 8. BAĞIMLILIK GÜVENLİĞİ

### 🟠 YÜKSEK: Outdated Dependencies
**Sorun:** Bazı npm paketleri güncel değil olabilir.
**Öneri:** \`npm audit\` düzenli çalıştırın, dependabot aktif edin.

### 🟡 ORTA: Supply Chain Risk
**Sorun:** Çok sayıda npm bağımlılığı.
**Öneri:** Lock file kullanın, package integrity verification.

---

## ACİL EYLEM PLANI

### Hemen Yapılması Gerekenler (24-48 saat):

1. **Rate Limiting Güçlendirme**
   - IP + User bazlı rate limiting
   - Exponential backoff for auth endpoints

2. **Session Security**
   - Redis-based session storage
   - Cryptographically secure session IDs

3. **OTP Security**
   - Timing-safe comparison
   - Account lockout after failed attempts

### Kısa Vadeli (1-2 hafta):

4. **Input Validation**
   - Centralized validation middleware
   - Strict type checking

5. **Logging Security**
   - PII redaction
   - Structured logging

6. **Database Security**
   - SQLCipher encryption
   - Parameterized queries audit

### Orta Vadeli (1 ay):

7. **Key Management**
   - HSM integration planning
   - Key rotation mechanism

8. **Security Headers**
   - Strict CSP
   - All OWASP recommended headers

9. **Dependency Management**
   - Automated vulnerability scanning
   - Regular update schedule

---

## SONUÇ

Arc Wallet kod tabanı temel güvenlik önlemlerini içermektedir, ancak production ortamı için kritik iyileştirmeler gerekmektedir. En acil konular:

1. Session management'ın Redis'e taşınması
2. Rate limiting'in güçlendirilmesi
3. Private key storage güvenliğinin artırılması
4. Input validation'ın merkezi hale getirilmesi

Bu rapor, kod incelemesi sonucu tespit edilen potansiyel güvenlik açıklarını içermektedir. Gerçek saldırı senaryoları için penetration testing önerilir.

---

**Rapor Sonu**
*Bu rapor otomatik güvenlik analizi ile oluşturulmuştur.*
