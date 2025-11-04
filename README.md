<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1qIbEi5-X1g1NHuMxSE73VUZDDbAPlLUQ

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure environment variables in [.env.local](.env.local) as needed
3. (Optional) Override `VITE_ARC_RPC_URL` in `.env` if you want to point at a custom Arc RPC endpoint. Default is `https://rpc.testnet.arc.network`.
4. (Optional) Point `VITE_PASSKEY_API_URL` to your running passkey backend. Default is `http://localhost:4000`.
5. (Optional) Provide the ERC-4337 entry point contract via `VITE_ARC_ENTRY_POINT` if you are testing on a network that uses a different address.
6. (Optional) Configure a bundler endpoint with `VITE_ARC_BUNDLER_URL` to submit smart-account UserOperations via `eth_sendUserOperation`. The app automatically falls back to direct transactions when the bundler is unavailable.
6. Run the app:
   `npm run dev`

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
