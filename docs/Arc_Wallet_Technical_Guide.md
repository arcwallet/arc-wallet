# Arc Wallet - Kapsamlı Teknik Kılavuz

**Versiyon:** 1.0
**Tarih:** Aralık 2025
**Yazar:** Arc Wallet Team

---

## İçindekiler

1. [Giriş](#1-giriş)
2. [Temel Kavramlar](#2-temel-kavramlar)
   - 2.1 Blockchain Nedir?
   - 2.2 Cüzdan (Wallet) Nedir?
   - 2.3 Akıllı Sözleşme (Smart Contract) Nedir?
3. [Kriptografik Temeller](#3-kriptografik-temeller)
   - 3.1 Public Key / Private Key
   - 3.2 Dijital İmza
   - 3.3 Eliptik Eğri Kriptografisi (ECC)
   - 3.4 P256 vs secp256k1
4. [WebAuthn ve Passkey](#4-webauthn-ve-passkey)
   - 4.1 WebAuthn Nedir?
   - 4.2 Passkey Nedir?
   - 4.3 Secure Enclave / TEE
   - 4.4 Registration ve Authentication Akışı
5. [Account Abstraction (ERC-4337)](#5-account-abstraction-erc-4337)
   - 5.1 EOA vs Smart Contract Wallet
   - 5.2 UserOperation
   - 5.3 Bundler
   - 5.4 Paymaster
   - 5.5 EntryPoint Contract
6. [Modular Smart Accounts (ERC-6900)](#6-modular-smart-accounts-erc-6900)
   - 6.1 Modüler Mimari
   - 6.2 Plugin Sistemi
   - 6.3 Validation Hooks
7. [Circle Modular Wallet SDK](#7-circle-modular-wallet-sdk)
   - 7.1 Circle Altyapısı
   - 7.2 SDK Bileşenleri
   - 7.3 Passkey Transport
   - 7.4 Bundler ve Paymaster Servisleri
8. [CCTP (Cross-Chain Transfer Protocol)](#8-cctp-cross-chain-transfer-protocol)
   - 8.1 CCTP Nedir?
   - 8.2 Burn ve Mint Mekanizması
   - 8.3 Attestation Süreci
   - 8.4 MessageTransmitter Contract
9. [Arc Network](#9-arc-network)
   - 9.1 Arc Network Özellikleri
   - 9.2 USDC Native Gas
   - 9.3 Chain Konfigürasyonu
10. [Güvenlik Mimarisi](#10-güvenlik-mimarisi)
    - 10.1 Trusted Execution Environment (TEE)
    - 10.2 Multi-Party Computation (MPC)
    - 10.3 Fully Homomorphic Encryption (FHE)
    - 10.4 AWS Nitro Enclaves
11. [Arc Wallet Mimarisi](#11-arc-wallet-mimarisi)
    - 11.1 Frontend Yapısı
    - 11.2 Backend Servisleri
    - 11.3 Akış Diyagramları
12. [Gelecek Vizyonu](#12-gelecek-vizyonu)
    - 12.1 TEE ile Key Recovery
    - 12.2 Önerilen Mimari

---

## 1. Giriş

Arc Wallet, Circle Modular Wallet SDK üzerine inşa edilmiş, passkey tabanlı self-custodial (kullanıcı kontrolünde) bir akıllı sözleşme cüzdanıdır.

**Temel Özellikler:**
- Şifresiz giriş (Passkey/WebAuthn)
- Seed phrase yok
- USDC ile gas ödemesi
- Cross-chain bridge (CCTP)
- Enterprise multi-sig desteği

**Neden Önemli?**

Geleneksel kripto cüzdanlarında:
- 12/24 kelimelik seed phrase ezberlemek gerekir
- Seed phrase çalınırsa tüm varlıklar kaybedilir
- Private key yönetimi karmaşıktır

Arc Wallet'ta:
- Parmak izi veya yüz tanıma ile giriş
- Private key cihazın güvenli alanında saklanır
- Kullanıcı hiçbir zaman private key görmez

---

## 2. Temel Kavramlar

### 2.1 Blockchain Nedir?

Blockchain, dağıtık ve değiştirilemez bir veri tabanıdır.

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Block 1 │───►│ Block 2 │───►│ Block 3 │───►│ Block 4 │
│         │    │         │    │         │    │         │
│ Hash: A │    │ Hash: B │    │ Hash: C │    │ Hash: D │
│ Prev: 0 │    │ Prev: A │    │ Prev: B │    │ Prev: C │
│ Data:.. │    │ Data:.. │    │ Data:.. │    │ Data:.. │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
```

**Özellikler:**
- **Dağıtık:** Binlerce bilgisayarda aynı kopya
- **Değiştirilemez:** Bir blok değişirse hash değişir, zincir bozulur
- **Şeffaf:** Herkes tüm işlemleri görebilir
- **Merkeziyetsiz:** Tek bir kontrol noktası yok

### 2.2 Cüzdan (Wallet) Nedir?

Kripto cüzdanı aslında "para" saklamaz. Blockchain'deki varlıklarınıza erişim anahtarlarını saklar.

```
┌────────────────────────────────────────┐
│              CÜZDAN                     │
├────────────────────────────────────────┤
│                                        │
│  Private Key (Gizli)                   │
│  ─────────────────────                 │
│  "Banka kartı PIN'i gibi"              │
│  Sadece siz bilmelisiniz               │
│                                        │
│           │                            │
│           ▼ (matematiksel türetme)     │
│                                        │
│  Public Key (Açık)                     │
│  ─────────────────────                 │
│  "IBAN numarası gibi"                  │
│  Herkesle paylaşılabilir               │
│                                        │
│           │                            │
│           ▼ (hash)                     │
│                                        │
│  Adres: 0x8229AfE4159...               │
│  ─────────────────────                 │
│  "Hesap numarası gibi"                 │
│                                        │
└────────────────────────────────────────┘
```

**İki Tip Cüzdan:**

| Özellik | EOA (Externally Owned Account) | Smart Contract Wallet |
|---------|--------------------------------|----------------------|
| Kontrol | Private key | Akıllı sözleşme kodu |
| Esneklik | Düşük | Yüksek |
| Recovery | Seed phrase | Çoklu yöntem |
| Gas | ETH ile | Herhangi token ile |
| Örnek | MetaMask | Arc Wallet, Safe |

### 2.3 Akıllı Sözleşme (Smart Contract) Nedir?

Blockchain üzerinde çalışan, koşullar sağlandığında otomatik çalışan programlardır.

```solidity
// Basit bir akıllı sözleşme örneği
contract SimpleWallet {
    address public owner;

    // Sadece sahibi para çekebilir
    function withdraw(uint amount) public {
        require(msg.sender == owner, "Not owner");
        payable(owner).transfer(amount);
    }
}
```

**Özellikler:**
- Kod bir kez deploy edilir, değiştirilemez
- Herkes kodu görebilir (şeffaflık)
- Koşullar sağlanınca otomatik çalışır
- "Aracı" ihtiyacını ortadan kaldırır

---

## 3. Kriptografik Temeller

### 3.1 Public Key / Private Key

Asimetrik kriptografi, iki matematiksel olarak bağlantılı anahtar kullanır.

```
PRIVATE KEY (Gizli Anahtar)
────────────────────────────
• 256 bit rastgele sayı
• Sadece sahibi bilmeli
• İmza oluşturmak için kullanılır
• Kaybedilirse erişim kaybolur

Örnek: 0x4c0883a69102937d6231471b5dbb6204fe512961...

              │
              │ Matematiksel işlem (Eliptik Eğri)
              │ (tersine çevrilemez)
              ▼

PUBLIC KEY (Açık Anahtar)
────────────────────────────
• Private key'den türetilir
• Herkesle paylaşılabilir
• İmza doğrulamak için kullanılır
• Public key'den private key bulunamaz

Örnek: 0x04bfcab4d28c921a5e2d...
```

**Kritik Nokta:** Private key → Public key türetilebilir, ama tersi matematiksel olarak imkansızdır.

### 3.2 Dijital İmza

Dijital imza, bir mesajın belirli bir private key sahibi tarafından oluşturulduğunu kanıtlar.

```
İMZA OLUŞTURMA (Signing)
─────────────────────────

   Mesaj: "10 USDC gönder"
              │
              ▼
   ┌─────────────────┐
   │  Hash Fonksiyonu │
   └────────┬────────┘
            │
            ▼
   Hash: 0x7f83b165...
              │
              │ + Private Key
              ▼
   ┌─────────────────┐
   │  İmza Algoritması│
   └────────┬────────┘
            │
            ▼
   Signature: (r, s, v)


İMZA DOĞRULAMA (Verification)
─────────────────────────────

   Mesaj + Signature + Public Key
              │
              ▼
   ┌─────────────────┐
   │ Doğrulama       │
   │ Algoritması     │
   └────────┬────────┘
            │
            ▼
   Sonuç: ✓ Geçerli / ✗ Geçersiz
```

### 3.3 Eliptik Eğri Kriptografisi (ECC)

ECC, public key kriptografisinin temelini oluşturur.

```
Eliptik Eğri Denklemi: y² = x³ + ax + b

                    │
                 ●  │      ●
               ●    │        ●
              ●     │         ●
             ●      │          ●
            ●       │           ●
           ●        │            ●
          ●         │             ●
         ●          │              ●
        ●           │               ●
       ●            │                ●
    ───●────────────┼─────────────────●───
                    │
                    │
```

**Neden ECC?**
- RSA'dan çok daha küçük anahtar boyutu
- Aynı güvenlik için daha az hesaplama
- Mobil cihazlar için ideal

| Güvenlik Seviyesi | RSA Key | ECC Key |
|-------------------|---------|---------|
| 80 bit | 1024 bit | 160 bit |
| 128 bit | 3072 bit | 256 bit |
| 256 bit | 15360 bit | 512 bit |

### 3.4 P256 vs secp256k1

İki farklı eliptik eğri standardı:

```
secp256k1 (Koblitz Curve)
─────────────────────────
• Bitcoin ve Ethereum tarafından kullanılır
• Satoshi Nakamoto'nun tercihi
• NSA tarafından tasarlanmadı (bağımsız)
• Daha hızlı hesaplama

Kullanım: MetaMask, Trust Wallet, vb.


P256 / secp256r1 (NIST Curve)
─────────────────────────────
• NIST (ABD standart kurumu) tarafından belirlendi
• WebAuthn/Passkey standardı
• Apple Secure Enclave, Android Keystore
• Donanım güvenlik modüllerinde yaygın

Kullanım: Passkey cüzdanlar, güvenlik anahtarları
```

**Arc Wallet'ta:**
- Passkey → P256 (secp256r1) kullanır
- Ethereum → secp256k1 bekler
- Çözüm → Smart contract içinde P256 imza doğrulama (RIP-7212)

---

## 4. WebAuthn ve Passkey

### 4.1 WebAuthn Nedir?

WebAuthn (Web Authentication), W3C tarafından geliştirilen şifresiz kimlik doğrulama standardıdır.

```
┌─────────────────────────────────────────────────────────┐
│                    WebAuthn Ekosistemi                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐     ┌─────────────┐     ┌───────────┐ │
│  │   Kullanıcı  │     │   Tarayıcı   │     │  Sunucu   │ │
│  │   (Client)   │     │  (Browser)   │     │ (Server)  │ │
│  └──────┬──────┘     └──────┬──────┘     └─────┬─────┘ │
│         │                   │                   │       │
│         │  Parmak izi /     │                   │       │
│         │  Yüz tanıma       │                   │       │
│         ▼                   │                   │       │
│  ┌─────────────┐           │                   │       │
│  │Authenticator│◄──────────┤                   │       │
│  │(Secure Area)│           │                   │       │
│  └─────────────┘           │                   │       │
│         │                   │                   │       │
│         │ Signature         │                   │       │
│         └───────────────────┼──────────────────►│       │
│                             │                   │       │
└─────────────────────────────────────────────────────────┘
```

**Avantajlar:**
- Şifre yok → Phishing riski düşük
- Private key cihazda kalır → Sunucu saldırıları etkisiz
- Biyometrik doğrulama → Kullanımı kolay

### 4.2 Passkey Nedir?

Passkey, WebAuthn'un kullanıcı dostu uygulamasıdır.

```
PASSKEY ÖZELLİKLERİ
───────────────────

┌────────────────────────────────────────┐
│           Cihaz (iPhone/Android)        │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────────────────────────────┐ │
│  │        Secure Enclave / TEE       │ │
│  │  ┌────────────────────────────┐  │ │
│  │  │      Private Key            │  │ │
│  │  │  (Asla dışarı çıkmaz!)      │  │ │
│  │  └────────────────────────────┘  │ │
│  └──────────────────────────────────┘ │
│                                        │
│  Biyometrik Doğrulama:                 │
│  • Face ID / Touch ID (Apple)          │
│  • Fingerprint / Face (Android)        │
│  • Windows Hello (Windows)             │
│                                        │
└────────────────────────────────────────┘

SENKRONIZASYON
──────────────
• iCloud Keychain (Apple cihazlar arası)
• Google Password Manager (Android/Chrome)
• Platform bağımsız sync mümkün
```

**Passkey vs Şifre:**

| Özellik | Şifre | Passkey |
|---------|-------|---------|
| Phishing riski | Yüksek | Yok |
| Tekrar kullanım | Yaygın sorun | İmkansız |
| Sunucuda saklanan | Hash'lenmiş şifre | Sadece public key |
| Kullanıcı deneyimi | Ezber gerekli | Parmak izi yeterli |
| Brute force | Mümkün | İmkansız |

### 4.3 Secure Enclave / TEE

TEE (Trusted Execution Environment), ana işlemciden izole, güvenli bir hesaplama alanıdır.

```
┌─────────────────────────────────────────────────────────┐
│                      ANA İŞLEMCİ                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Normal Dünya (Rich OS)     │   Güvenli Dünya (TEE)   │
│   ─────────────────────      │   ─────────────────────  │
│                              │                          │
│   ┌─────────────────────┐   │   ┌──────────────────┐   │
│   │    Uygulamalar      │   │   │  Güvenli Uygulama │   │
│   │  (Bankacılık, vs)   │   │   │  (Key Management) │   │
│   └─────────────────────┘   │   └──────────────────┘   │
│                              │                          │
│   ┌─────────────────────┐   │   ┌──────────────────┐   │
│   │   İşletim Sistemi   │   │   │   Güvenli OS     │   │
│   │   (iOS/Android)     │   │   │   (Trusted OS)   │   │
│   └─────────────────────┘   │   └──────────────────┘   │
│                              │                          │
│           ▲                  │           ▲              │
│           │                  │           │              │
│           │    Sınırlı API   │           │              │
│           └──────────────────┼───────────┘              │
│                              │                          │
└─────────────────────────────────────────────────────────┘

Örnekler:
• Apple: Secure Enclave
• Android: TrustZone + StrongBox
• Intel: SGX (Software Guard Extensions)
• AWS: Nitro Enclaves
```

**TEE Güvenlik Garantileri:**
1. **İzolasyon:** Ana OS hacklense bile TEE güvende
2. **Şifreli bellek:** RAM'deki veriler şifreli
3. **Attestation:** Kodun değiştirilmediğini kanıtlama
4. **Secure boot:** Sadece imzalı kod çalışır

### 4.4 Registration ve Authentication Akışı

**Registration (Kayıt) - Passkey Oluşturma:**

```
┌────────┐      ┌──────────┐      ┌────────────┐      ┌────────┐
│ Kullanıcı │    │  Tarayıcı │      │ Authenticator│      │ Sunucu │
└────┬───┘      └────┬─────┘      └──────┬─────┘      └───┬────┘
     │               │                    │                │
     │  1. Kayıt ol  │                    │                │
     │──────────────►│                    │                │
     │               │                    │                │
     │               │  2. Challenge iste │                │
     │               │────────────────────────────────────►│
     │               │                    │                │
     │               │  3. Challenge      │                │
     │               │◄────────────────────────────────────│
     │               │                    │                │
     │               │  4. Credential iste│                │
     │               │───────────────────►│                │
     │               │                    │                │
     │  5. Biyometrik│                    │                │
     │◄──────────────┼────────────────────│                │
     │               │                    │                │
     │  6. Onayla    │                    │                │
     │──────────────►│                    │                │
     │               │                    │                │
     │               │  7. Key pair oluştur                │
     │               │                    │  (TEE içinde)  │
     │               │                    │                │
     │               │  8. Public Key +   │                │
     │               │     Credential ID  │                │
     │               │◄───────────────────│                │
     │               │                    │                │
     │               │  9. Kaydet         │                │
     │               │────────────────────────────────────►│
     │               │                    │                │
     │  10. Başarılı │                    │                │
     │◄──────────────│                    │                │
     │               │                    │                │
```

**Authentication (Doğrulama) - Giriş Yapma:**

```
┌────────┐      ┌──────────┐      ┌────────────┐      ┌────────┐
│ Kullanıcı │    │  Tarayıcı │      │ Authenticator│      │ Sunucu │
└────┬───┘      └────┬─────┘      └──────┬─────┘      └───┬────┘
     │               │                    │                │
     │  1. Giriş yap │                    │                │
     │──────────────►│                    │                │
     │               │                    │                │
     │               │  2. Challenge iste │                │
     │               │────────────────────────────────────►│
     │               │                    │                │
     │               │  3. Challenge +    │                │
     │               │     Credential ID  │                │
     │               │◄────────────────────────────────────│
     │               │                    │                │
     │               │  4. İmza iste      │                │
     │               │───────────────────►│                │
     │               │                    │                │
     │  5. Biyometrik│                    │                │
     │◄──────────────┼────────────────────│                │
     │               │                    │                │
     │  6. Onayla    │                    │                │
     │──────────────►│                    │                │
     │               │                    │                │
     │               │  7. Challenge'ı    │                │
     │               │     imzala (TEE)   │                │
     │               │◄───────────────────│                │
     │               │                    │                │
     │               │  8. Signature      │                │
     │               │────────────────────────────────────►│
     │               │                    │                │
     │               │  9. Public key ile │                │
     │               │     doğrula        │                │
     │               │                    │                │
     │  10. Giriş OK │                    │                │
     │◄──────────────│                    │                │
     │               │                    │                │
```

---

## 5. Account Abstraction (ERC-4337)

### 5.1 EOA vs Smart Contract Wallet

```
EOA (Externally Owned Account)
──────────────────────────────
┌─────────────────────────────┐
│  Private Key                │
│  ──────────                 │
│  Tek kontrol noktası        │
│  Kaybedilirse = Game Over   │
└─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Ethereum Address           │
│  0x123...                   │
│  ──────────────────         │
│  • ETH ile gas öde          │
│  • Tek imza yeterli         │
│  • Programlanamaz           │
└─────────────────────────────┘


Smart Contract Wallet (ERC-4337)
────────────────────────────────
┌─────────────────────────────┐
│  Smart Contract Kodu        │
│  ──────────────────         │
│  • Çoklu imza               │
│  • Sosyal recovery          │
│  • Harcama limiti           │
│  • Herhangi token ile gas   │
│  • Session keys             │
└─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Contract Address           │
│  0x456...                   │
│  ──────────────────         │
│  • Programlanabilir         │
│  • Upgrade edilebilir       │
│  • Özelleştirilebilir       │
└─────────────────────────────┘
```

### 5.2 UserOperation

ERC-4337'de işlemler "UserOperation" yapısı ile gönderilir.

```
┌─────────────────────────────────────────────────────────┐
│                    UserOperation                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  sender          : 0x8229AfE4159...  // Cüzdan adresi  │
│  nonce           : 5                  // İşlem sırası   │
│  initCode        : 0x...              // İlk deploy     │
│  callData        : 0x...              // Ne yapılacak   │
│  callGasLimit    : 100000             // İşlem gas'ı    │
│  verificationGas : 50000              // Doğrulama gas  │
│  preVerificationGas: 21000            // Ön gas         │
│  maxFeePerGas    : 20 gwei            // Max gas fiyatı │
│  maxPriorityFee  : 2 gwei             // Öncelik ücreti │
│  paymasterAndData: 0x...              // Sponsor bilgisi│
│  signature       : 0x...              // İmza           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 5.3 Bundler

Bundler, UserOperation'ları toplar ve blockchain'e gönderir.

```
┌─────────────────────────────────────────────────────────┐
│                    BUNDLER AKIŞI                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Kullanıcı A ──► UserOp A ──┐                          │
│                              │                          │
│  Kullanıcı B ──► UserOp B ──┼──► ┌─────────────┐       │
│                              │    │   BUNDLER    │       │
│  Kullanıcı C ──► UserOp C ──┼──► │             │       │
│                              │    │  • Topla     │       │
│  Kullanıcı D ──► UserOp D ──┘    │  • Doğrula   │       │
│                                   │  • Paketlenmiş│      │
│                                   │    TX oluştur│       │
│                                   └──────┬──────┘       │
│                                          │              │
│                                          ▼              │
│                                   ┌─────────────┐       │
│                                   │ EntryPoint  │       │
│                                   │  Contract   │       │
│                                   └──────┬──────┘       │
│                                          │              │
│                                          ▼              │
│                                   ┌─────────────┐       │
│                                   │ Blockchain  │       │
│                                   └─────────────┘       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Bundler'ın görevleri:**
1. UserOperation'ları mempool'dan toplar
2. Simülasyon yaparak geçerli olanları seçer
3. Tek bir transaction'a paketler
4. EntryPoint contract'a gönderir
5. Gas ücretini tahsil eder

### 5.4 Paymaster

Paymaster, kullanıcı yerine gas ücretini ödeyen sözleşmedir.

```
PAYMASTER TÜRLERİ
─────────────────

1. Verifying Paymaster (Sponsorluk)
   ────────────────────────────────
   • Şirket kullanıcıların gas'ını öder
   • "Ücretsiz işlem" deneyimi

   Kullanıcı ──► UserOp ──► Paymaster öder ──► Blockchain

2. ERC-20 Paymaster (Token ile ödeme)
   ──────────────────────────────────
   • Kullanıcı USDC/DAI ile gas öder
   • Paymaster ETH'ye çevirir

   Kullanıcı ──► USDC ──► Paymaster ──► ETH ──► Blockchain

3. Deposit Paymaster (Ön ödemeli)
   ─────────────────────────────
   • Kullanıcı önceden deposit yapar
   • Her işlemde bakiye düşer
```

**Arc Wallet'ta:**
- Circle Paymaster kullanılır
- USDC ile gas ödemesi
- Arc Network'te USDC native gas token

### 5.5 EntryPoint Contract

EntryPoint, ERC-4337'nin merkezi sözleşmesidir.

```
┌─────────────────────────────────────────────────────────┐
│                   ENTRYPOINT CONTRACT                    │
│                   (Singleton - Tek instance)             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  handleOps(UserOperation[] ops, address payable beneficiary)
│  ───────────────────────────────────────────────────────│
│                                                         │
│  Her UserOperation için:                                │
│                                                         │
│  1. validateUserOp()                                    │
│     └─► Wallet contract'ın imzayı doğrulaması          │
│                                                         │
│  2. validatePaymasterUserOp() (varsa)                   │
│     └─► Paymaster'ın ödemeyi onaylaması                │
│                                                         │
│  3. executeUserOp()                                     │
│     └─► Wallet contract'ın işlemi çalıştırması         │
│                                                         │
│  4. postOp() (paymaster için)                           │
│     └─► Gas ücretinin tahsili                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Modular Smart Accounts (ERC-6900)

### 6.1 Modüler Mimari

ERC-6900, smart account'lara plugin ekleme standardıdır.

```
┌─────────────────────────────────────────────────────────┐
│              MODULAR SMART ACCOUNT (MSCA)                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │                 ACCOUNT CORE                      │   │
│  │  • Temel fonksiyonlar                            │   │
│  │  • Plugin yönetimi                               │   │
│  │  • Storage                                       │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│           ┌─────────────┼─────────────┐                │
│           │             │             │                │
│           ▼             ▼             ▼                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│  │  Validation │ │  Execution  │ │    Hooks    │      │
│  │   Plugin    │ │   Plugin    │ │   Plugin    │      │
│  │             │ │             │ │             │      │
│  │ • Passkey   │ │ • Token     │ │ • Spending  │      │
│  │ • Multi-sig │ │   Transfer  │ │   Limit     │      │
│  │ • Session   │ │ • Swap      │ │ • Time Lock │      │
│  └─────────────┘ └─────────────┘ └─────────────┘      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Plugin Sistemi

```
PLUGIN TÜRLERİ
──────────────

1. Validation Plugin
   ─────────────────
   İmza doğrulama yöntemi belirler

   • SingleOwnerPlugin: Tek imza
   • WebAuthnPlugin: Passkey imza
   • MultisigPlugin: Çoklu imza

2. Execution Plugin
   ────────────────
   Yeni fonksiyonlar ekler

   • TokenRecoveryPlugin: Kayıp token kurtarma
   • SwapPlugin: DEX entegrasyonu

3. Hook Plugin
   ───────────
   İşlem öncesi/sonrası kontroller

   • SpendingLimitHook: Günlük limit
   • WhitelistHook: Sadece beyaz listeye transfer
```

### 6.3 Validation Hooks

Arc Wallet'ta WebAuthn validation kullanılır:

```
┌─────────────────────────────────────────────────────────┐
│           WEBAUTHN VALIDATION FLOW                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  UserOperation.signature                                │
│         │                                               │
│         ▼                                               │
│  ┌─────────────────────────────────────────┐           │
│  │  WebAuthn Signature Decode               │           │
│  │  ─────────────────────────              │           │
│  │  • authenticatorData                     │           │
│  │  • clientDataJSON                        │           │
│  │  • signature (r, s)                      │           │
│  └────────────────────┬────────────────────┘           │
│                       │                                 │
│                       ▼                                 │
│  ┌─────────────────────────────────────────┐           │
│  │  P256 Signature Verification             │           │
│  │  ───────────────────────────            │           │
│  │  • RIP-7212 precompile (ucuz)           │           │
│  │  • veya Solidity library (pahalı)       │           │
│  └────────────────────┬────────────────────┘           │
│                       │                                 │
│                       ▼                                 │
│              ✓ Valid / ✗ Invalid                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Circle Modular Wallet SDK

### 7.1 Circle Altyapısı

Circle, USDC'nin arkasındaki şirkettir ve Web3 altyapı hizmetleri sunar.

```
┌─────────────────────────────────────────────────────────┐
│                  CIRCLE EKOSISTEMI                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │    USDC     │  │   CCTP      │  │  Modular    │     │
│  │  Stablecoin │  │   Bridge    │  │  Wallets    │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Bundler   │  │  Paymaster  │  │  Passkey    │     │
│  │   Service   │  │   Service   │  │  Service    │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 7.2 SDK Bileşenleri

```typescript
// Circle Modular Wallet SDK Kullanımı

import {
  toWebAuthnAccount,
  toCircleSmartAccount,
  createBundlerClient
} from '@circle-fin/modular-wallets-sdk';

// 1. Passkey hesabı oluştur
const webAuthnAccount = await toWebAuthnAccount({
  transport: passkeyTransport,
  credential: { id: credentialId, publicKey }
});

// 2. Smart account oluştur
const smartAccount = await toCircleSmartAccount({
  client: publicClient,
  owner: webAuthnAccount
});

// 3. Bundler client oluştur
const bundlerClient = createBundlerClient({
  account: smartAccount,
  chain: arcTestnet,
  transport: http(BUNDLER_URL),
  paymaster: paymasterClient
});

// 4. İşlem gönder
const txHash = await bundlerClient.sendUserOperation({
  calls: [{ to: recipient, value: amount }]
});
```

### 7.3 Passkey Transport

Circle'ın passkey transport'u WebAuthn işlemlerini yönetir:

```
┌─────────────────────────────────────────────────────────┐
│                 PASSKEY TRANSPORT                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Frontend (Browser)                  │   │
│  │                                                  │   │
│  │  passkeyTransport = toPasskeyTransport({        │   │
│  │    rpId: 'arcwallet.network',                   │   │
│  │    rpName: 'Arc Wallet'                         │   │
│  │  });                                            │   │
│  │                                                  │   │
│  └──────────────────────┬──────────────────────────┘   │
│                         │                               │
│                         ▼                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │            Circle Backend                        │   │
│  │                                                  │   │
│  │  • Credential ID saklama                        │   │
│  │  • Public key saklama                           │   │
│  │  • Challenge oluşturma                          │   │
│  │                                                  │   │
│  └──────────────────────┬──────────────────────────┘   │
│                         │                               │
│                         ▼                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Device Authenticator                     │   │
│  │                                                  │   │
│  │  • Private key (Secure Enclave'de)              │   │
│  │  • Biyometrik doğrulama                         │   │
│  │  • İmza oluşturma                               │   │
│  │                                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 7.4 Bundler ve Paymaster Servisleri

```
CIRCLE BUNDLER
──────────────
Endpoint: https://api.circle.com/v1/bundler/arc-testnet

Desteklenen zincirler:
• Arc Testnet ✓
• Ethereum Mainnet ✓
• Base ✓
• Polygon ✓
• Arbitrum ✓
• Sepolia ✗ (desteklenmiyor)


CIRCLE PAYMASTER
────────────────
• Gas sponsorship (ücretsiz işlem)
• ERC-20 ile gas ödeme
• USDC native gas (Arc Network)

Konfigürasyon:
{
  sponsorshipPolicy: "sp_arc_testnet_xxxxx",
  paymasterUrl: "https://api.circle.com/v1/paymaster"
}
```

---

## 8. CCTP (Cross-Chain Transfer Protocol)

### 8.1 CCTP Nedir?

CCTP, Circle'ın native USDC bridge protokolüdür. Wrapped token yerine gerçek USDC kullanır.

```
GELENEKSEl BRIDGE vs CCTP
─────────────────────────

Geleneksel Bridge:
──────────────────
Chain A                              Chain B
┌─────────┐                         ┌─────────┐
│  USDC   │ ───► Lock ───────────► │ wUSDC   │
│  100$   │                         │  100$   │
└─────────┘      (wrapped token)    └─────────┘

Sorunlar:
• Wrapped token = ekstra risk
• Her bridge'in kendi token'ı
• Likidite fragmentasyonu


CCTP (Circle):
──────────────
Chain A                              Chain B
┌─────────┐                         ┌─────────┐
│  USDC   │ ───► Burn ────────────► │  USDC   │
│  100$   │       │                 │  100$   │
└─────────┘       │                 └─────────┘
                  │
           Circle Attestation
           (Burn onayı)

Avantajlar:
• Native USDC (wrapped değil)
• Circle garantisi
• Tek standart
```

### 8.2 Burn ve Mint Mekanizması

```
┌─────────────────────────────────────────────────────────┐
│                    CCTP AKIŞI                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  KAYNAK ZİNCİR (Arc Testnet)                            │
│  ────────────────────────────                           │
│                                                         │
│  1. Kullanıcı USDC'yi TokenMessenger'a gönderir        │
│                                                         │
│  2. TokenMessenger:                                     │
│     • USDC'yi burn eder (yok eder)                     │
│     • Burn mesajı oluşturur                            │
│     • MessageTransmitter'a gönderir                    │
│                                                         │
│  3. MessageTransmitter:                                 │
│     • Mesajı kaydeder                                  │
│     • Event emit eder                                  │
│                                                         │
│                         │                               │
│                         ▼                               │
│           ┌─────────────────────────┐                  │
│           │    CIRCLE ATTESTATION   │                  │
│           │    ───────────────────  │                  │
│           │                         │                  │
│           │  • Burn event'i izler   │                  │
│           │  • Mesajı doğrular      │                  │
│           │  • İmza oluşturur       │                  │
│           │  • ~15-20 dakika        │                  │
│           │                         │                  │
│           └───────────┬─────────────┘                  │
│                       │                                 │
│                       ▼                                 │
│  HEDEF ZİNCİR (Sepolia)                                │
│  ─────────────────────                                 │
│                                                         │
│  4. receiveMessage() çağrılır:                         │
│     • Message + Attestation gönderilir                 │
│     • MessageTransmitter doğrular                      │
│                                                         │
│  5. TokenMessenger:                                     │
│     • Yeni USDC mint eder                              │
│     • Alıcıya gönderir                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 8.3 Attestation Süreci

Circle'ın Iris API'si attestation sağlar:

```
ATTESTATION API (V2)
────────────────────

Endpoint: https://iris-api-sandbox.circle.com/v2/messages/{sourceDomain}

Request:
GET /v2/messages/26?transactionHash=0x123...

Response:
{
  "messages": [{
    "status": "complete",
    "attestation": "0x...",      // Circle imzası
    "message": "0x...",          // Orijinal mesaj
    "sourceDomain": 26,          // Arc Testnet
    "destinationDomain": 0,      // Ethereum
    "amount": "1000000",         // 1 USDC (6 decimal)
    "sender": "0x...",
    "recipient": "0x..."
  }]
}
```

**Domain ID'leri:**

| Chain | Domain ID |
|-------|-----------|
| Ethereum | 0 |
| Avalanche | 1 |
| Optimism | 2 |
| Arbitrum | 3 |
| Base | 6 |
| Polygon | 7 |
| Arc Testnet | 26 |

### 8.4 MessageTransmitter Contract

```solidity
// MessageTransmitter V2 Interface

interface IMessageTransmitterV2 {
    // Mesaj gönder (kaynak zincir)
    function sendMessage(
        uint32 destinationDomain,
        bytes32 recipient,
        bytes calldata messageBody
    ) external returns (uint64 nonce);

    // Mesaj al (hedef zincir)
    function receiveMessage(
        bytes calldata message,
        bytes calldata attestation
    ) external returns (bool success);

    // Mesaj kullanıldı mı kontrol
    function usedNonces(
        bytes32 sourceAndNonce
    ) external view returns (bool);
}
```

**Contract Adresleri:**

| Contract | Arc Testnet | Sepolia |
|----------|-------------|---------|
| MessageTransmitterV2 | 0xE737e5c... | 0xE737e5c... |
| TokenMessengerV2 | 0x8FE6b99... | 0x8FE6b99... |
| USDC | 0x...(native) | 0x1c7D4B... |

---

## 9. Arc Network

### 9.1 Arc Network Özellikleri

Arc Network, USDC-native bir EVM uyumlu blockchain'dir.

```
ARC NETWORK ÖZELLİKLERİ
───────────────────────

┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Chain ID: 5042002                                      │
│  Native Token: USDC (gas için)                         │
│  Consensus: [Belirtilecek]                             │
│  Block Time: [Belirtilecek]                            │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              USDC-NATIVE GAS                     │   │
│  │              ───────────────                     │   │
│  │                                                  │   │
│  │  Geleneksel:  ETH → Gas ödemesi                 │   │
│  │  Arc Network: USDC → Gas ödemesi                │   │
│  │                                                  │   │
│  │  Avantajlar:                                    │   │
│  │  • Stablecoin ile ödeme (volatilite yok)       │   │
│  │  • ETH bridge'e gerek yok                       │   │
│  │  • Daha iyi UX                                  │   │
│  │                                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 9.2 USDC Native Gas

```
USDC NATIVE GAS MEKANİZMASI
───────────────────────────

Normal EVM Chain:
─────────────────
Transaction Fee = Gas Used × Gas Price (in ETH)

Kullanıcı ETH'ye sahip olmalı


Arc Network:
────────────
Transaction Fee = Gas Used × Gas Price (in USDC)

Kullanıcı sadece USDC'ye sahip olmalı


┌─────────────────────────────────────────┐
│  Örnek İşlem                             │
├─────────────────────────────────────────┤
│  Gas Used: 21,000                        │
│  Gas Price: 0.000001 USDC                │
│  ─────────────────────                   │
│  Fee: 0.021 USDC (~2 cent)               │
└─────────────────────────────────────────┘
```

### 9.3 Chain Konfigürasyonu

```typescript
// Arc Testnet Chain Config

export const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc-testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arcscan',
      url: 'https://testnet.arcscan.app',
    },
  },
  contracts: {
    // ERC-4337 Contracts
    entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',

    // CCTP Contracts
    messageTransmitterV2: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    tokenMessengerV2: '0x8FE6b999dc680ccfdd5bf7eb0974218be2542daa',
  },
};
```

---

## 10. Güvenlik Mimarisi

### 10.1 Trusted Execution Environment (TEE)

```
TEE MİMARİSİ
────────────

┌─────────────────────────────────────────────────────────┐
│                     DONANIM                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────┐  ┌───────────────────────┐  │
│  │    Normal World       │  │    Secure World       │  │
│  │    ────────────       │  │    ────────────       │  │
│  │                       │  │                       │  │
│  │  ┌─────────────────┐ │  │ ┌─────────────────┐   │  │
│  │  │  Uygulamalar    │ │  │ │ Trusted App     │   │  │
│  │  │  (Arc Wallet)   │ │  │ │ (Key Manager)   │   │  │
│  │  └─────────────────┘ │  │ └─────────────────┘   │  │
│  │                       │  │                       │  │
│  │  ┌─────────────────┐ │  │ ┌─────────────────┐   │  │
│  │  │  İşletim Sistemi│ │  │ │  Trusted OS     │   │  │
│  │  │  (iOS/Android)  │ │  │ │  (OP-TEE, etc)  │   │  │
│  │  └─────────────────┘ │  │ └─────────────────┘   │  │
│  │                       │  │                       │  │
│  │  Erişim: Normal      │  │  Erişim: Kısıtlı     │  │
│  │  Güvenlik: Standart  │  │  Güvenlik: Yüksek    │  │
│  │                       │  │                       │  │
│  └───────────────────────┘  └───────────────────────┘  │
│                                                         │
│                    DONANIM SEVİYESİ İZOLASYON          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**TEE Sağlayıcıları:**

| Platform | TEE Çözümü | Kullanım |
|----------|------------|----------|
| Apple | Secure Enclave | iPhone/Mac |
| Android | TrustZone + StrongBox | Android cihazlar |
| Intel | SGX | Sunucular |
| AMD | SEV | Sunucular |
| AWS | Nitro Enclaves | Cloud |
| Azure | Confidential Computing | Cloud |

### 10.2 Multi-Party Computation (MPC)

MPC, private key'i birden fazla parçaya böler.

```
MPC KEY SHARING
───────────────

Geleneksel:
───────────
Private Key: 0x4c0883a69102937d6231471b5dbb6204fe512961...
             │
             └── Tek nokta hatası (single point of failure)


MPC:
────
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Private Key                                            │
│       │                                                 │
│       ▼                                                 │
│  ┌─────────┐                                           │
│  │ Shamir  │                                           │
│  │ Secret  │                                           │
│  │ Sharing │                                           │
│  └────┬────┘                                           │
│       │                                                 │
│  ┌────┴────┬────────┬────────┐                        │
│  ▼         ▼        ▼        ▼                         │
│                                                         │
│  Share 1   Share 2  Share 3  Share 4                   │
│  (User)    (Server) (Cloud)  (Backup)                  │
│                                                         │
│  İmza için: Herhangi 2/4 share yeterli (threshold)     │
│  Güvenlik: Tek share ele geçirilse bile key güvende    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**MPC Avantajları:**
- Tek nokta hatası yok
- Key parçaları farklı lokasyonlarda
- Threshold imza (2/3, 3/5, vb.)

**MPC Dezavantajları:**
- Karmaşık koordinasyon
- Gecikme (multiple round trip)
- Setup karmaşıklığı

### 10.3 Fully Homomorphic Encryption (FHE)

FHE, şifreli veri üzerinde işlem yapmayı sağlar.

```
FHE KONSEPTI
────────────

Normal Şifreleme:
─────────────────
Plaintext ──► Encrypt ──► Ciphertext ──► Decrypt ──► Plaintext
                              │
                              └── İşlem yapmak için decrypt gerekli


FHE:
────
Plaintext ──► Encrypt ──► Ciphertext ──► Compute ──► Ciphertext' ──► Decrypt ──► Result
                              │            │
                              │            └── Şifreli halde işlem!
                              │
                              └── Key hiç açığa çıkmıyor


Örnek:
──────
x = 5, y = 3

Normal:
  decrypt(x) + decrypt(y) = 5 + 3 = 8

FHE:
  encrypt(x) + encrypt(y) = encrypt(8)
  decrypt(encrypt(8)) = 8

Veriler hiç açık metin olarak görünmedi!
```

**FHE Kullanım Alanları:**
- Private smart contracts
- Confidential DeFi
- Encrypted ML

**FHE Limitasyonları:**
- Çok yavaş (1000x+ overhead)
- Büyük ciphertext boyutu
- Henüz production-ready değil

### 10.4 AWS Nitro Enclaves

```
AWS NITRO ENCLAVES MİMARİSİ
───────────────────────────

┌─────────────────────────────────────────────────────────┐
│                     EC2 INSTANCE                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │                Parent Instance                   │   │
│  │                                                  │   │
│  │  ┌────────────────┐    ┌────────────────────┐  │   │
│  │  │  Application   │    │   vsock proxy      │  │   │
│  │  │  (API Server)  │◄──►│   (KMS bağlantısı) │  │   │
│  │  └────────┬───────┘    └────────────────────┘  │   │
│  │           │                                     │   │
│  │           │ vsock (local socket)               │   │
│  │           │                                     │   │
│  └───────────┼─────────────────────────────────────┘   │
│              │                                          │
│  ┌───────────▼─────────────────────────────────────┐   │
│  │                  ENCLAVE                         │   │
│  │           (İzole VM - No network,                │   │
│  │            No disk, No SSH)                      │   │
│  │                                                  │   │
│  │  ┌────────────────────────────────────────┐    │   │
│  │  │         Enclave Application            │    │   │
│  │  │                                         │    │   │
│  │  │  • Private key işlemleri               │    │   │
│  │  │  • Signature oluşturma                 │    │   │
│  │  │  • Decrypt (KMS ile)                   │    │   │
│  │  │                                         │    │   │
│  │  └────────────────────────────────────────┘    │   │
│  │                                                  │   │
│  │  Güvenlik:                                      │   │
│  │  • Şifreli bellek                              │   │
│  │  • Attestation (PCR değerleri)                 │   │
│  │  • Root bile erişemez                          │   │
│  │                                                  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Attestation Flow:**

```
┌─────────┐         ┌─────────┐         ┌─────────┐
│ Enclave │         │   KMS   │         │  Client │
└────┬────┘         └────┬────┘         └────┬────┘
     │                   │                   │
     │  1. Attestation   │                   │
     │     Document      │                   │
     │   (PCR values +   │                   │
     │    public key)    │                   │
     │──────────────────►│                   │
     │                   │                   │
     │  2. Verify PCR    │                   │
     │     matches       │                   │
     │     policy        │                   │
     │                   │                   │
     │  3. Encrypt       │                   │
     │     with enclave  │                   │
     │     public key    │                   │
     │◄──────────────────│                   │
     │                   │                   │
     │  4. Only this     │                   │
     │     enclave can   │                   │
     │     decrypt       │                   │
     │                   │                   │
```

---

## 11. Arc Wallet Mimarisi

### 11.1 Frontend Yapısı

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND STACK                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Framework: React + TypeScript + Vite                   │
│  Styling: Tailwind CSS                                  │
│  State: React Context + Local Storage                   │
│                                                         │
│  src/                                                   │
│  ├── components/                                        │
│  │   ├── WalletDashboard.tsx    # Ana cüzdan UI        │
│  │   ├── Bridge.tsx             # CCTP bridge UI        │
│  │   ├── SendTransaction.tsx    # Transfer UI          │
│  │   └── PasskeyAuth.tsx        # Login/Register UI    │
│  │                                                      │
│  ├── services/                                          │
│  │   ├── circleWalletService.ts # Circle SDK wrapper   │
│  │   ├── bridgeService.ts       # CCTP bridge logic    │
│  │   └── balanceService.ts      # Bakiye sorgulama     │
│  │                                                      │
│  ├── contexts/                                          │
│  │   └── WalletContext.tsx      # Global wallet state  │
│  │                                                      │
│  └── config/                                            │
│      └── chains.ts              # Chain konfigürasyonu │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 11.2 Backend Servisleri

```
┌─────────────────────────────────────────────────────────┐
│                    BACKEND STACK                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Framework: Node.js + Express + TypeScript              │
│  Database: [Varsa belirtilecek]                        │
│  Hosting: Render.com                                    │
│                                                         │
│  backend/                                               │
│  ├── src/                                               │
│  │   ├── index.ts               # Express app          │
│  │   │                                                  │
│  │   ├── routes/                                        │
│  │   │   ├── bridge.ts          # Bridge endpoints     │
│  │   │   ├── agent.ts           # AI agent endpoints   │
│  │   │   └── passkeys.ts        # Passkey endpoints    │
│  │   │                                                  │
│  │   ├── services/                                      │
│  │   │   └── bridgeCompleterService.ts  # Auto-claim   │
│  │   │                                                  │
│  │   └── middleware/                                    │
│  │       ├── csrf.ts            # CSRF protection      │
│  │       └── rateLimit.ts       # Rate limiting        │
│  │                                                      │
│  └── Endpoints:                                         │
│      POST /bridge/complete      # Bridge claim         │
│      GET  /bridge/completer/status  # Relayer status   │
│      POST /api/agent            # AI agent             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 11.3 Akış Diyagramları

**Wallet Oluşturma:**

```
┌────────┐      ┌──────────┐      ┌────────┐      ┌────────┐
│ Kullanıcı│      │ Frontend │      │ Circle │      │Blockchain│
└────┬───┘      └────┬─────┘      └───┬────┘      └───┬────┘
     │               │                │                │
     │ 1. Email gir  │                │                │
     │──────────────►│                │                │
     │               │                │                │
     │               │ 2. OTP iste    │                │
     │               │───────────────►│                │
     │               │                │                │
     │ 3. OTP al     │                │                │
     │◄──────────────┼────────────────│                │
     │               │                │                │
     │ 4. OTP doğrula│                │                │
     │──────────────►│───────────────►│                │
     │               │                │                │
     │               │ 5. Passkey     │                │
     │               │    oluştur     │                │
     │◄──────────────│                │                │
     │               │                │                │
     │ 6. Biyometrik │                │                │
     │    onayla     │                │                │
     │──────────────►│                │                │
     │               │                │                │
     │               │ 7. Public key  │                │
     │               │    + Cred ID   │                │
     │               │───────────────►│                │
     │               │                │                │
     │               │ 8. Wallet addr │                │
     │               │    (CREATE2)   │                │
     │               │◄───────────────│                │
     │               │                │                │
     │ 9. Wallet     │                │                │
     │    hazır!     │                │                │
     │◄──────────────│                │                │
     │               │                │                │
```

**USDC Transfer:**

```
┌────────┐      ┌──────────┐      ┌────────┐      ┌────────┐
│ Kullanıcı│      │ Frontend │      │ Bundler│      │Blockchain│
└────┬───┘      └────┬─────┘      └───┬────┘      └───┬────┘
     │               │                │                │
     │ 1. Transfer   │                │                │
     │    bilgileri  │                │                │
     │──────────────►│                │                │
     │               │                │                │
     │               │ 2. UserOp      │                │
     │               │    oluştur     │                │
     │               │                │                │
     │ 3. İmza iste  │                │                │
     │◄──────────────│                │                │
     │               │                │                │
     │ 4. Passkey    │                │                │
     │    ile imzala │                │                │
     │──────────────►│                │                │
     │               │                │                │
     │               │ 5. UserOp +    │                │
     │               │    Signature   │                │
     │               │───────────────►│                │
     │               │                │                │
     │               │                │ 6. Validate    │
     │               │                │    + Execute   │
     │               │                │───────────────►│
     │               │                │                │
     │               │                │ 7. TX hash     │
     │               │                │◄───────────────│
     │               │                │                │
     │               │ 8. TX hash     │                │
     │               │◄───────────────│                │
     │               │                │                │
     │ 9. Başarılı!  │                │                │
     │◄──────────────│                │                │
     │               │                │                │
```

**CCTP Bridge (Arc → Sepolia):**

```
┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐
│Kullanıcı│   │Frontend│   │Arc Net │   │ Circle │   │Sepolia │
└───┬────┘   └───┬────┘   └───┬────┘   └───┬────┘   └───┬────┘
    │            │            │            │            │
    │ 1. Bridge  │            │            │            │
    │    10 USDC │            │            │            │
    │───────────►│            │            │            │
    │            │            │            │            │
    │            │ 2. Burn TX │            │            │
    │            │───────────►│            │            │
    │            │            │            │            │
    │            │            │ 3. Burn    │            │
    │            │            │    event   │            │
    │            │            │───────────►│            │
    │            │            │            │            │
    │            │            │ 4. Attestation          │
    │            │            │    oluştur │            │
    │            │            │    (~15 dk)│            │
    │            │            │            │            │
    │            │ 5. Poll    │            │            │
    │            │    attestation          │            │
    │            │────────────────────────►│            │
    │            │            │            │            │
    │            │ 6. Attestation          │            │
    │            │◄────────────────────────│            │
    │            │            │            │            │
    │            │ 7. receiveMessage       │            │
    │            │    (Backend relayer)    │            │
    │            │─────────────────────────────────────►│
    │            │            │            │            │
    │            │            │            │   8. Mint  │
    │            │            │            │      USDC  │
    │            │            │            │            │
    │ 9. Bridge  │            │            │            │
    │    tamamlandı           │            │            │
    │◄───────────│            │            │            │
    │            │            │            │            │
```

---

## 12. Gelecek Vizyonu

### 12.1 TEE ile Key Recovery

WebAuthn'un bilinen bir kısıtlaması: Credential ID'den public key sorgulama yapılamaz.

**Problem:**
```
Kullanıcı yeni cihaza geçti
       │
       ▼
Credential ID var (iCloud sync)
       │
       ▼
Ama public key nerede?
       │
       ▼
WebAuthn API: "Public key vermem, privacy!"
       │
       ▼
Cüzdana erişim sorunu
```

**Çözüm: TEE-based Key Recovery**

```
┌─────────────────────────────────────────────────────────┐
│              TEE KEY RECOVERY ÖNERİSİ                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  REGISTRATION:                                          │
│  ────────────                                           │
│                                                         │
│  1. Passkey oluştur (normal WebAuthn)                  │
│  2. Public key'i al                                     │
│  3. TEE'ye gönder → şifreli sakla                      │
│  4. Credential ID → Encrypted Public Key mapping       │
│                                                         │
│                                                         │
│  RECOVERY (Yeni cihaz):                                │
│  ─────────────────────                                  │
│                                                         │
│  1. Kullanıcı authenticate olur (credential ID ile)    │
│  2. WebAuthn signature alınır                          │
│  3. TEE'ye gönder: credential ID + signature           │
│  4. TEE içinde:                                        │
│     a. Encrypted public key'i decrypt et               │
│     b. Signature'ı public key ile verify et            │
│     c. Eğer geçerliyse → public key'i döndür          │
│     d. Eğer geçersizse → hiçbir şey döndürme          │
│  5. Public key ile cüzdana erişim sağlanır            │
│                                                         │
│                                                         │
│  GÜVENLİK:                                             │
│  ─────────                                              │
│  • Signature olmadan public key alınamaz               │
│  • Cross-site tracking engellenmiş                     │
│  • TEE dışında key açık metin olarak bulunmaz         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 12.2 Önerilen Mimari

```
┌─────────────────────────────────────────────────────────┐
│            GELECEK ARC WALLET MİMARİSİ                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                     ┌─────────────┐                    │
│                     │   Kullanıcı  │                    │
│                     └──────┬──────┘                    │
│                            │                            │
│                            ▼                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │              ARC WALLET FRONTEND                 │   │
│  │                                                  │   │
│  │  • Passkey Authentication (WebAuthn)            │   │
│  │  • Transaction Builder                          │   │
│  │  • Bridge UI                                    │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                               │
│            ┌────────────┼────────────┐                 │
│            │            │            │                 │
│            ▼            ▼            ▼                 │
│  ┌──────────────┐ ┌──────────┐ ┌──────────────┐       │
│  │   Circle     │ │  TEE     │ │   Backend    │       │
│  │   Services   │ │  Service │ │   Services   │       │
│  │              │ │  (NEW)   │ │              │       │
│  │  • Bundler   │ │          │ │  • Relayer   │       │
│  │  • Paymaster │ │  • Key   │ │  • AI Agent  │       │
│  │  • Passkey   │ │  Recovery│ │  • Analytics │       │
│  │    Backend   │ │  • Secure│ │              │       │
│  │              │ │  Storage │ │              │       │
│  └──────┬───────┘ └────┬─────┘ └──────┬───────┘       │
│         │              │              │                │
│         └──────────────┼──────────────┘                │
│                        │                               │
│                        ▼                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │              BLOCKCHAIN LAYER                    │   │
│  │                                                  │   │
│  │  ┌─────────────┐    ┌─────────────┐             │   │
│  │  │ Arc Network │◄──►│   Sepolia   │             │   │
│  │  │             │CCTP│   / Base    │             │   │
│  │  │ Smart       │    │             │             │   │
│  │  │ Contract    │    │             │             │   │
│  │  │ Wallet      │    │             │             │   │
│  │  └─────────────┘    └─────────────┘             │   │
│  │                                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Roadmap:**

| Faz | Özellik | Durum |
|-----|---------|-------|
| 1 | Passkey wallet + Circle SDK | ✅ Tamamlandı |
| 2 | CCTP Bridge | ✅ Tamamlandı |
| 3 | Backend Relayer | ✅ Tamamlandı |
| 4 | TEE Key Recovery | 📋 Planlanan |
| 5 | Multi-sig (ERC-6900) | 📋 Planlanan |
| 6 | Mainnet Launch | 📋 Planlanan |

---

## Sözlük

| Terim | Açıklama |
|-------|----------|
| **EOA** | Externally Owned Account - Private key ile kontrol edilen hesap |
| **Smart Contract Wallet** | Akıllı sözleşme ile kontrol edilen hesap |
| **ERC-4337** | Account Abstraction standardı |
| **ERC-6900** | Modular Smart Account standardı |
| **UserOperation** | ERC-4337'de işlem yapısı |
| **Bundler** | UserOperation'ları toplayan servis |
| **Paymaster** | Gas ödemesini üstlenen sözleşme |
| **EntryPoint** | ERC-4337 merkezi sözleşmesi |
| **WebAuthn** | Şifresiz kimlik doğrulama standardı |
| **Passkey** | WebAuthn'un kullanıcı dostu uygulaması |
| **TEE** | Trusted Execution Environment - Güvenli hesaplama alanı |
| **Secure Enclave** | Apple'ın TEE implementasyonu |
| **P256/secp256r1** | WebAuthn'un kullandığı eliptik eğri |
| **secp256k1** | Ethereum'un kullandığı eliptik eğri |
| **CCTP** | Circle Cross-Chain Transfer Protocol |
| **Attestation** | Circle'ın burn onay belgesi |
| **MPC** | Multi-Party Computation - Dağıtık anahtar yönetimi |
| **FHE** | Fully Homomorphic Encryption - Şifreli veri üzerinde işlem |
| **AWS Nitro Enclaves** | AWS'nin TEE çözümü |
| **RIP-7212** | P256 signature verification precompile |

---

## Kaynaklar

**Resmi Dokümantasyon:**
- [Circle Developer Docs](https://developers.circle.com)
- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [ERC-6900 Specification](https://eips.ethereum.org/EIPS/eip-6900)
- [WebAuthn Guide](https://webauthn.guide)
- [AWS Nitro Enclaves](https://aws.amazon.com/ec2/nitro/nitro-enclaves/)

**GitHub Repositories:**
- [Arc Wallet](https://github.com/arcwallet)
- [AWS Nitro Enclave Blockchain Wallet](https://github.com/aws-samples/aws-nitro-enclave-blockchain-wallet)
- [P256 Verifier (Daimo)](https://github.com/daimo-eth/p256-verifier)

**Makaleler:**
- [Powering Coinbase Wallets with AWS Nitro Enclaves](https://aws.amazon.com/blogs/web3/powering-programmable-crypto-wallets-at-coinbase-with-aws-nitro-enclaves/)
- [TEEs: A Primer (a16z)](https://a16zcrypto.com/posts/article/trusted-execution-environments-tees-primer/)

---

*Bu doküman Arc Wallet ekibi tarafından hazırlanmıştır.*
*Son güncelleme: Aralık 2025*
