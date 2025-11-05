# Production Deployment Guide - Passkey Configuration

## 🌐 Your Domains
- **Frontend**: https://app.arcwallet.network
- **Backend**: https://api.arcwallet.network (önerilen) VEYA https://app.arcwallet.network/api

---

## 📋 Deployment Adımları

### 1️⃣ Backend Deployment

#### Option A: Ayrı subdomain (ÖNERİLEN)
**Backend URL:** `https://api.arcwallet.network`

#### Option B: Aynı domain altında
**Backend URL:** `https://app.arcwallet.network/api`

---

### 2️⃣ Backend Environment Variables (.env)

Backend'inizi deploy ettiğiniz yere (Vercel, Railway, Render, VPS vb.) şu environment variables'ları ekleyin:

```bash
# Server Configuration
PORT=4000
NODE_ENV=production

# CORS Configuration
# Frontend URL'inizi buraya ekleyin
ALLOWED_ORIGINS=https://app.arcwallet.network

# ⚠️ KRİTİK: Passkey Configuration
# RP_ID = Domain adınız (protocol yok, www yok, sadece domain)
RP_ID=arcwallet.network

# Passkey dialog'da görünecek isim
RP_NAME=Arc Wallet

# ORIGIN = Tam frontend URL (protocol ile birlikte)
ORIGIN=https://app.arcwallet.network

# Database
DB_PATH=./data/wallet.db

# ⚠️ KRİTİK: GÜVENLİK - Bu secret'ları DEĞİŞTİRİN!
# Güçlü, rastgele string'ler kullanın (minimum 32 karakter)
SESSION_SECRET=your-production-session-secret-min-32-chars
JWT_SECRET=your-production-jwt-secret-min-32-chars

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Secret Key Oluşturma:
```bash
# Terminal'de çalıştırın:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Her secret için ayrı çalıştırın
```

---

### 3️⃣ Frontend Environment Variables (.env.production)

Frontend build etmeden önce (Vercel, Netlify vb.):

```bash
# Backend URL - Backend'inizi nerede deploy ettiyseniz
VITE_PASSKEY_API_URL=https://api.arcwallet.network

# Diğer ayarlarınız...
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
VITE_CIRCLE_API_KEY=your_circle_api_key
VITE_CIRCLE_ENTITY_SECRET=your_circle_entity_secret
```

---

## 🔐 Passkey Ayarları - ÖNEMLİ!

### RP_ID Kuralları:

✅ **DOĞRU:**
```bash
RP_ID=arcwallet.network
```

❌ **YANLIŞ:**
```bash
RP_ID=https://arcwallet.network      # Protocol OLMAZ
RP_ID=www.arcwallet.network          # www OLMAZ (veya tüm subdomain'lerde çalışmasını istiyorsanız kullanılabilir)
RP_ID=app.arcwallet.network          # Sadece app subdomain'inde çalışır
RP_ID=arcwallet.network:4000         # Port OLMAZ
```

### Domain Seçenekleri:

#### Option 1: Tüm subdomain'lerde çalışsın
```bash
RP_ID=arcwallet.network
# Bu şekilde hem app.arcwallet.network hem www.arcwallet.network çalışır
```

#### Option 2: Sadece belirli subdomain
```bash
RP_ID=app.arcwallet.network
# Sadece app.arcwallet.network'te çalışır
```

**Öneri:** `RP_ID=arcwallet.network` kullanın (esnek olur)

---

## 🚀 Deployment Platformları

### Vercel (Frontend)

1. GitHub'a push yapın
2. Vercel'de projeyi import edin
3. Environment Variables ekleyin:
   ```
   VITE_PASSKEY_API_URL=https://api.arcwallet.network
   ```
4. Deploy edin

### Vercel (Backend)

Backend için Vercel kullanıyorsanız:

1. `vercel.json` oluşturun:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "backend/src/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "backend/src/index.ts"
    }
  ]
}
```

2. Environment Variables ekleyin (Vercel Dashboard)

### Railway / Render (Backend)

1. GitHub repo'nuzu bağlayın
2. Environment Variables ekleyin
3. Build Command: `cd backend && npm install && npm run build`
4. Start Command: `cd backend && npm start`

### VPS (Ubuntu/Linux)

```bash
# Backend klasörüne gidin
cd backend

# Dependencies yükleyin
npm install

# Build edin
npm run build

# PM2 ile çalıştırın
npm install -g pm2
pm2 start dist/index.js --name arcwallet-backend

# Otomatik başlatma
pm2 startup
pm2 save
```

**Nginx Reverse Proxy:**
```nginx
server {
    listen 443 ssl;
    server_name api.arcwallet.network;

    ssl_certificate /etc/letsencrypt/live/api.arcwallet.network/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.arcwallet.network/privkey.pem;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## ✅ Test Etme

Deploy ettikten sonra test edin:

### 1. Backend Health Check
```bash
curl https://api.arcwallet.network/health
# veya
curl https://app.arcwallet.network/api/health
```

Beklenen yanıt:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-11-05T12:00:00.000Z",
  "service": "arc-wallet-backend"
}
```

### 2. Passkey Health Check
```bash
curl https://api.arcwallet.network/passkeys/health
```

### 3. Frontend Test
1. https://app.arcwallet.network açın
2. Browser Console açın (F12)
3. "Create New Passkey" tıklayın
4. Passkey oluşturun
5. Logout yapın
6. "Sign in with Passkey" ile giriş yapın

**Console'da hata varsa:**
- Network tab'ı kontrol edin
- Backend URL'lerini doğrulayın
- CORS ayarlarını kontrol edin

---

## 🐛 Troubleshooting

### Hata: "WebAuthn is not supported"
- ✅ HTTPS kullanmalısınız (localhost hariç)
- ✅ Modern browser kullanın (Chrome, Safari, Edge, Firefox)

### Hata: "Origin does not match"
- Backend `.env` dosyasında `ORIGIN=https://app.arcwallet.network` doğru mu?
- Frontend URL ile backend ORIGIN eşleşiyor mu?

### Hata: "RP_ID does not match"
- `RP_ID=arcwallet.network` doğru mu?
- Protocol veya port eklememişsiniz değil mi?

### Hata: "CORS error"
- Backend `ALLOWED_ORIGINS` frontend URL'ini içeriyor mu?
- Backend CORS middleware çalışıyor mu?

### Hata: "Passkey not found"
- Eski localhost passkey'leri production'da çalışmaz
- Production'da YENİ passkey oluşturun

---

## 📝 Checklist

Deploy etmeden önce:

- [ ] Backend `.env` dosyası hazır
- [ ] `RP_ID=arcwallet.network` doğru ayarlandı
- [ ] `ORIGIN=https://app.arcwallet.network` doğru ayarlandı
- [ ] `SESSION_SECRET` ve `JWT_SECRET` güçlü, rastgele string'ler
- [ ] Frontend `.env.production` hazır
- [ ] `VITE_PASSKEY_API_URL` backend URL'i doğru
- [ ] HTTPS sertifikası aktif
- [ ] Backend health check çalışıyor
- [ ] CORS ayarları doğru

Deploy sonrası test:
- [ ] Health check endpoint'leri çalışıyor
- [ ] Create New Passkey çalışıyor
- [ ] Sign in with Passkey çalışıyor
- [ ] Logout sonrası tekrar giriş yapılabiliyor

---

## 🔒 Güvenlik Notları

1. **Asla** production secret'larını Git'e commit etmeyin
2. Environment variables platformda saklayın (Vercel, Railway vb.)
3. Database'i düzenli yedekleyin
4. Rate limiting aktif olduğundan emin olun
5. HTTPS zorunludur (localhost hariç)
6. `NODE_ENV=production` ayarlı olmalı

---

## 📞 Destek

Sorun yaşarsanız:
1. Backend loglarını kontrol edin
2. Browser console'u kontrol edin
3. Network tab'da request/response'ları kontrol edin
4. `.env` dosyalarını tekrar gözden geçirin

Başarılar! 🚀
