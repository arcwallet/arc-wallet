# Production Deployment Guide

## Domains
- Frontend: https://app.arcwallet.network
- Backend: Deploy separately (e.g., Render) → you will get a URL like https://arcwallet-backend.onrender.com

## 1) Deploy Backend on Render (one-click)
- In Render: New → Blueprint → Connect this repo → choose `render.yaml`
- Render will create a Web Service named `arcwallet-backend` with:
  - Build: `npm ci && npm run build`
  - Start: `npm run start`
  - Env vars (from render.yaml):
    - NODE_ENV=production
    - RP_ID=app.arcwallet.network
    - ORIGIN=https://app.arcwallet.network
    - ALLOWED_ORIGINS=https://app.arcwallet.network
    - SESSION_SECRET, JWT_SECRET auto-generated
- After deploy, copy the Service URL (e.g., `https://arcwallet-backend.onrender.com`). Verify `GET /health` returns healthy.

## 2) Configure Frontend (Vercel)
- In Vercel → Project Settings → Environment Variables:
  - Set `VITE_PASSKEY_API_URL` = backend URL from step 1 (e.g., `https://arcwallet-backend.onrender.com`)
- Redeploy the frontend (app.arcwallet.network).
- Note: We removed the hardcoded `/api` rewrite to avoid 502 if backend is missing. Using `VITE_PASSKEY_API_URL` is the simplest and most explicit wiring.

## 3) Browser Cleanup (first time only)
- Chrome: chrome://settings/passkeys → remove old entries for `app.arcwallet.network`
- App Settings → Passkey Devices: Remove old devices
- Reload → Create New Passkey → then Sign in

## 4) Backend .env (if you deploy somewhere else)
Set at minimum:
- NODE_ENV=production
- RP_ID=app.arcwallet.network
- ORIGIN=https://app.arcwallet.network
- ALLOWED_ORIGINS=https://app.arcwallet.network
- SESSION_SECRET=strong random
- JWT_SECRET=strong random

## Notes
- RP_ID must be your exact domain without protocol (`app.arcwallet.network`).
- ORIGIN must match the frontend origin exactly (`https://app.arcwallet.network`).
