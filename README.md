# Arc Wallet

A modern Web3 wallet built for Arc Network with support for multiple stablecoins (USDC, EURC), cross-chain bridging, and passkey authentication.

## Features

- **Multi-Token Support**: USDC and EURC stablecoins
- **Cross-Chain Bridging**: Bridge tokens between Arc Testnet and Ethereum Sepolia
- **Passkey Authentication**: Secure WebAuthn-based authentication
- **Smart Account Integration**: ERC-4337 account abstraction support
- **Real-time Balances**: Live token balance updates
- **Professional UI**: Modern, responsive interface

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure environment variables in [.env.local](.env.local) as needed.
3. Set `VITE_WALLET_ENCRYPTION_SECRET` to a secret string (minimum 16 characters) in both your local `.env` and any deployment platform (Vercel/Render) so encrypted wallet backups can be restored per email login.
4. (Optional) Override `VITE_ARC_RPC_URL` in `.env` if you want to point at a custom Arc RPC endpoint. Default is `https://rpc.testnet.arc.network`.
5. (Optional) Point `VITE_PASSKEY_API_URL` to your running passkey backend. Default is `http://localhost:4000`.
6. (Optional) Provide the ERC-4337 entry point contract via `VITE_ARC_ENTRY_POINT` if you are testing on a network that uses a different address.
7. (Optional) Configure a bundler endpoint with `VITE_ARC_BUNDLER_URL` to submit smart-account UserOperations via `eth_sendUserOperation`. The app automatically falls back to direct transactions when the bundler is unavailable.
8. Run the app:
   `npm run dev`

## Magic Link Email Delivery (SendGrid)

1. **Verify the sending domain** inside SendGrid → *Settings → Sender Authentication* and create the three CNAMEs + DMARC TXT that Render already lists (`em4148…`, `s1._domainkey…`, `s2._domainkey…`, `_dmarc…`). Wait for SendGrid to mark them as verified.
2. **Create a Mail Send API key** (Full Access or restricted to “Mail Send”) and copy it once.
3. **Configure backend env vars** (Render → Environment):
   - `SENDGRID_API_KEY=<copied-key>`
   - `EMAIL_FROM_ADDRESS=support@arcwallet.network` (must be within the verified domain)
   - `EMAIL_FROM_NAME=Arc Wallet`
   - `MAGIC_LINK_BASE_URL=https://app.arcwallet.network/auth/callback`
4. **Frontend env vars** (Vercel → Settings → Environment Variables):
   - `VITE_API_BASE_URL=https://arcwallet-backend.onrender.com`
   - `VITE_PASSKEY_API_URL=https://arcwallet-backend.onrender.com`
   - `VITE_WALLET_ENCRYPTION_SECRET=<same secret as local>`
5. Redeploy backend first (Render) and then frontend (Vercel). The backend logs will print the generated magic link URL so you can confirm it matches the production domain. If the SendGrid API call fails you will see the error stack trace in Render logs.

## Deployment Environment Checklist

| Layer | Required variables | Notes |
| --- | --- | --- |
| **Frontend (Vercel)** | `VITE_API_BASE_URL`, `VITE_PASSKEY_API_URL`, `VITE_WALLET_ENCRYPTION_SECRET`, `VITE_ARC_RPC_URL` (optional), bundle debug flags | Use exactly the same `VITE_WALLET_ENCRYPTION_SECRET` everywhere so encrypted wallets can be restored. |
| **Backend (Render)** | `NODE_ENV=production`, `PORT=10000`, `ALLOWED_ORIGINS=https://app.arcwallet.network`, `RP_ID=app.arcwallet.network`, `ORIGIN=https://app.arcwallet.network`, `MAGIC_LINK_BASE_URL=https://app.arcwallet.network/auth/callback`, `SENDGRID_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `SESSION_SECRET`, `JWT_SECRET` | Use long random strings for `SESSION_SECRET` / `JWT_SECRET`; Render automatically injects `PORT` but we pin it to 10000 to match logs. |
| **Shared** | DNS per SendGrid instructions, verified domain | Without DNS verification SendGrid will drop the email. |

## Testing & QA

### Automated (planned)
1. **Playwright happy-path**: login page → request magic link (mock SendGrid) → simulate `/auth/callback?token=...` → verify dashboard loads previous wallet for that email. This ensures regressions in token verification or wallet restore are caught.
2. **Playwright multi-user**: create wallets for email A and B, ensure switching `currentEmail` loads the right encrypted wallet and never leaks data to the other.
3. **API smoke tests**: run a small Vitest suite hitting `/api/send-link` and `/api/verify` with fake SendGrid client to guarantee 15‑minute expiry logic.

### Manual QA checklist
1. Request a magic link, open email, ensure the button contains the correct link and the plain URL is hidden.
2. Click the link in the same browser → you should land directly inside the dashboard with the previously created wallet (no redirect loop to `/login`).
3. Repeat in a fresh browser profile: login should prompt setup again (encrypted cache is per browser/email).
4. Sign out via dashboard footer; session cookie should clear and `/api/session` returns 401 until you re-login.
5. On failure scenarios (expired token, invalid token) the frontend should display the backend error message and stay on the login screen.

## Passkey Backend (Proof of Concept)

A lightweight Express service under `backend/` handles WebAuthn registration and authentication flows and mints short-lived session keys for the smart account workflow.

1. Install backend dependencies: `cd backend && npm install`
2. Copy `.env.example` to `.env` and adjust the relying party info (`RP_ID`, `ORIGIN`, etc.) if needed.
3. Start the server: `npm run dev`
4. API endpoints:
   - `POST /passkeys/register/start` – begin passkey enrollment
   - `POST /passkeys/register/finish` – verify enrollment response
   - `POST /passkeys/auth/start` – begin authentication
   - `POST /passkeys/auth/finish` – verify assertion, returns session key

The front-end talks to this service via `VITE_PASSKEY_API_URL`, so make sure the value matches the backend host/port when running locally or in development containers.

## Smart Account Contract

`contracts/ArcSmartAccount.sol` introduces a minimal account abstraction wallet that authorises short-lived session keys (backed by passkeys). It can execute arbitrary calls via `execute` and is structured to plug into ERC-4337 entry points. More details and next steps live in `docs/account-abstraction.md`. The dashboard now exposes actions to deploy the contract and authorise the current session key.

See `docs/passkey-architecture.md` for the full integration blueprint.
