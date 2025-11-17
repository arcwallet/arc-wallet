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
