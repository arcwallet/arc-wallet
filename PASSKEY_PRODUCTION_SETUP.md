# Passkey Production Setup Guide

This guide explains how to configure Arc Wallet for production deployment with Passkey authentication.

## 🎯 Production URLs

- **Frontend (Vercel)**: https://app.arcwallet.network
- **Backend (Render)**: https://arcwallet-backend.onrender.com

## 📋 Required Environment Variables

### Frontend (.env on Vercel)

```bash
# Backend URLs - MUST point to Render backend
VITE_BACKEND_URL=https://arcwallet-backend.onrender.com
VITE_PASSKEY_API_URL=https://arcwallet-backend.onrender.com

# Blockchain RPCs
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
VITE_SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com

# Circle API (get from https://console.circle.com)
VITE_CIRCLE_API_KEY=your_circle_api_key_here
VITE_CIRCLE_ENTITY_SECRET=your_circle_entity_secret_here

# Wallet Encryption
VITE_WALLET_ENCRYPTION_SECRET=generate_random_string_min_16_chars

# Entry Point
VITE_ARC_ENTRY_POINT=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
VITE_EXPLORER_URL=https://testnet.arcscan.app
```

### Backend (.env on Render)

```bash
# Server
PORT=4000
NODE_ENV=production

# CORS - MUST include frontend domain
ALLOWED_ORIGINS=https://app.arcwallet.network

# WebAuthn/Passkey Configuration
# RP_ID must match frontend domain (without https://)
RP_ID=app.arcwallet.network
RP_NAME=Arc Wallet
ORIGIN=https://app.arcwallet.network

# Magic Link
MAGIC_LINK_BASE_URL=https://app.arcwallet.network

# Security (REQUIRED in production)
SESSION_SECRET=generate_random_32_char_secret
JWT_SECRET=generate_random_32_char_secret
DB_ENCRYPTION_KEY=generate_random_32_char_secret

# Database
DB_PATH=/opt/render/project/data/wallet.db

# Email (SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_FROM_ADDRESS=no-reply@arcwallet.network
EMAIL_FROM_NAME=Arc Wallet

# Blockchain
ARC_RPC_URL=https://rpc-testnet.arc.network
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

## 🔧 Key Configuration Points

### 1. **Backend URL (Frontend)**
   - Must be set to Render backend URL
   - Default fallback to localhost won't work in production
   - Set `VITE_PASSKEY_API_URL=https://arcwallet-backend.onrender.com`

### 2. **RP_ID (Backend)**
   - Must match frontend hostname (without protocol)
   - For `https://app.arcwallet.network`, use: `RP_ID=app.arcwallet.network`
   - WebAuthn requires exact match

### 3. **CORS Origins (Backend)**
   - Must include frontend URL
   - Format: `ALLOWED_ORIGINS=https://app.arcwallet.network`
   - No trailing slash

### 4. **CSRF Protection**
   - Passkey endpoints are CSRF-exempt (WebAuthn provides cryptographic security)
   - Cross-origin cookies handled automatically

## 🚀 Deployment Steps

### Step 1: Update Frontend .env
```bash
cd /Users/seher/Desktop/arcwallet
# .env file already updated with production URLs
git add .env
git commit -m "Configure production backend URLs"
```

### Step 2: Deploy Frontend to Vercel
```bash
# Vercel will automatically pick up .env variables
git push origin main

# Or use Vercel CLI
vercel --prod
```

### Step 3: Configure Render Environment Variables
Go to Render Dashboard → Your Service → Environment → Add:
- `NODE_ENV=production`
- `ALLOWED_ORIGINS=https://app.arcwallet.network`
- `RP_ID=app.arcwallet.network`
- `ORIGIN=https://app.arcwallet.network`
- `MAGIC_LINK_BASE_URL=https://app.arcwallet.network`
- `SESSION_SECRET=<generate-random>`
- `JWT_SECRET=<generate-random>`
- `DB_ENCRYPTION_KEY=<generate-random>`

### Step 4: Verify Deployment
1. Open https://app.arcwallet.network
2. Open browser console (F12)
3. Look for log: `[SDK] Initializing with: { backendUrl: 'https://arcwallet-backend.onrender.com', rpId: 'app.arcwallet.network' }`
4. Try creating a passkey wallet

## 🐛 Troubleshooting

### Error: "Failed to get registration options"
- **Cause**: Frontend can't reach backend
- **Fix**: Check `VITE_PASSKEY_API_URL` is set correctly in Vercel

### Error: "CORS policy blocked"
- **Cause**: Backend ALLOWED_ORIGINS doesn't include frontend domain
- **Fix**: Add `https://app.arcwallet.network` to Render environment variable `ALLOWED_ORIGINS`

### Error: "Invalid RP_ID"
- **Cause**: RP_ID mismatch between frontend and backend
- **Fix**: Set `RP_ID=app.arcwallet.network` in Render (without `https://`)

### Error: "CSRF token validation failed"
- **Cause**: Should not happen (passkey routes are exempt)
- **Fix**: Check `/backend/src/middleware/csrf.ts` has `/passkeys` in exempt list

## ✅ Verification Checklist

- [ ] Frontend deployed to Vercel
- [ ] Backend deployed to Render
- [ ] `VITE_PASSKEY_API_URL` points to Render backend
- [ ] Render environment has `NODE_ENV=production`
- [ ] Render environment has `ALLOWED_ORIGINS` with frontend domain
- [ ] Render environment has `RP_ID` matching frontend hostname
- [ ] Browser console shows correct backend URL in SDK initialization
- [ ] Passkey creation works without CORS errors
- [ ] Passkey authentication works

## 🔒 Security Notes

1. **Never commit `.env` files** - they contain secrets
2. **Rotate Circle API keys** if accidentally exposed
3. **Use strong secrets** for SESSION_SECRET, JWT_SECRET, DB_ENCRYPTION_KEY
4. **Enable HTTPS** - Required for WebAuthn (automatic on Vercel/Render)
5. **Backup database** - Render ephemeral storage, use persistent disk or backup solution

## 📚 Related Files

- Frontend config: `/contexts/SelfCustodialWalletContext.tsx`
- Backend config: `/backend/src/utils/config.ts`
- CSRF middleware: `/backend/src/middleware/csrf.ts`
- SDK WebAuthn: `/packages/sdk/src/core/webauthn.ts`
