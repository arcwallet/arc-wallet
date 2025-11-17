# Bridge API Documentation

## Overview

The Bridge API enables secure cross-chain USDC transfers between Arc Testnet and Ethereum Sepolia using Circle's Cross-Chain Transfer Protocol (CCTP).

## Security Model

**Important:** Private keys are stored securely in the backend database and never exposed to the frontend. This prevents:
- Private key exposure in browser memory
- Man-in-the-middle attacks
- Browser extension compromises
- Client-side key theft

## Endpoints

### 1. Start Bridge Transaction

Initiate a cross-chain USDC transfer.

```http
POST /bridge/start
Content-Type: application/json

{
  "userId": "user-123",
  "sessionKeyAddress": "0x1234...abcd",
  "amount": "10.50",
  "direction": "arc-to-sepolia",
  "token": "USDC"
}
```

**Parameters:**
- `userId` (string, required): User ID from session
- `sessionKeyAddress` (string, required): Ethereum address of the session key
- `amount` (string, required): Amount in decimal format (e.g., "10.50")
- `direction` (string, required): Either "arc-to-sepolia" or "sepolia-to-arc"
- `token` (string, required): Currently only "USDC" is supported

**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "transactionId": 42,
    "status": "pending",
    "message": "Bridge transaction initiated. Check status for updates."
  }
}
```

**Errors:**
- `400` - Invalid parameters
- `404` - Session key not found or expired
- `500` - Internal server error

---

### 2. Get Bridge Status

Check the status of a bridge transaction.

```http
GET /bridge/status/:transactionId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 42,
    "status": "completed",
    "amount": "10.50",
    "direction": "arc-to-sepolia",
    "token": "USDC",
    "sourceTxHash": "0xabc...",
    "destinationTxHash": "0xdef...",
    "errorMessage": null,
    "createdAt": "2025-01-17T12:00:00Z",
    "updatedAt": "2025-01-17T12:05:00Z"
  }
}
```

**Status Values:**
- `pending` - Bridge transaction initiated
- `burn_complete` - USDC burned on source chain
- `attestation_fetched` - Circle attestation received
- `mint_complete` - USDC minted on destination chain
- `completed` - Transaction fully completed
- `failed` - Transaction failed (check errorMessage)

---

### 3. Get Bridge History

Retrieve user's bridge transaction history.

```http
GET /bridge/history/:userId?limit=50&offset=0
```

**Query Parameters:**
- `limit` (number, optional): Number of transactions to return (default: 50)
- `offset` (number, optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": 42,
        "status": "completed",
        "amount": "10.50",
        "direction": "arc-to-sepolia",
        "token": "USDC",
        "sourceTxHash": "0xabc...",
        "destinationTxHash": "0xdef...",
        "errorMessage": null,
        "createdAt": "2025-01-17T12:00:00Z"
      }
    ],
    "limit": 50,
    "offset": 0
  }
}
```

---

## How It Works

### Bridge Flow (Arc → Sepolia)

1. **Frontend Request**
   - User initiates bridge from frontend
   - Frontend sends request to `/bridge/start`
   - Backend validates session key

2. **Backend Processing**
   - Retrieves user's private key from secure database
   - Creates Circle Bridge Kit adapters
   - Initiates burn transaction on Arc Testnet

3. **CCTP Process**
   - USDC burned on source chain (Arc)
   - Circle's Attestation Service validates burn
   - USDC minted on destination chain (Sepolia)

4. **Status Updates**
   - Frontend polls `/bridge/status/:id`
   - Backend updates status as bridge progresses
   - Transaction completes with destination tx hash

### Database Schema

```sql
CREATE TABLE bridge_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  session_key_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  direction TEXT NOT NULL,
  token TEXT NOT NULL,
  status TEXT NOT NULL,
  source_tx_hash TEXT,
  destination_tx_hash TEXT,
  attestation TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## Error Handling

### Common Errors

**Insufficient Balance**
```json
{
  "success": false,
  "error": "Insufficient USDC balance",
  "code": "INSUFFICIENT_BALANCE"
}
```

**Session Key Expired**
```json
{
  "success": false,
  "error": "Session key not found or expired",
  "code": "SESSION_KEY_NOT_FOUND"
}
```

**Network Error**
```json
{
  "success": false,
  "error": "Network connection error: RPC may be unreachable",
  "code": "NETWORK_ERROR"
}
```

---

## Environment Variables

Required environment variables for backend:

```bash
# RPC URLs
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
VITE_SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com

# Database
DB_PATH=./data/wallet.db

# Node Environment
NODE_ENV=production
```

---

## Testing

### Local Testing

```bash
# Start backend
cd backend
npm install
npm run dev

# Test bridge endpoint
curl -X POST http://localhost:4000/bridge/start \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "sessionKeyAddress": "0x...",
    "amount": "1.00",
    "direction": "arc-to-sepolia",
    "token": "USDC"
  }'
```

### Check Status

```bash
curl http://localhost:4000/bridge/status/1
```

### Get History

```bash
curl http://localhost:4000/bridge/history/test-user
```

---

## Security Best Practices

1. **Private Key Storage**
   - ✅ Private keys stored encrypted in backend database
   - ✅ Never transmitted to frontend
   - ✅ Session keys have expiration times
   - ✅ Automatic cleanup of expired keys

2. **Input Validation**
   - ✅ express-validator for all inputs
   - ✅ Amount format validation
   - ✅ Address checksums validated
   - ✅ Direction enum validation

3. **Rate Limiting**
   - ✅ Rate limiting on all endpoints
   - ✅ Prevents bridge spamming
   - ✅ Protects against DoS

4. **Error Messages**
   - ✅ Generic error messages to frontend
   - ✅ Detailed logging in backend
   - ✅ No sensitive info in errors

---

## Monitoring

### Logs

Bridge operations log to console with transaction ID:

```
🌉 [BRIDGE 42] Starting bridge operation
🌉 [BRIDGE 42] Adapters created
🌉 [BRIDGE 42] Bridge completed: {...}
✅ [BRIDGE 42] Transaction completed successfully
```

Failed bridges:

```
❌ [BRIDGE 42] Bridge failed: Insufficient balance
```

### Metrics to Monitor

- Bridge transaction count per direction
- Success vs failure rate
- Average completion time
- Failed transaction reasons
- RPC endpoint latency

---

## Production Deployment

### Render Configuration

Add to `render.yaml`:

```yaml
envVars:
  - key: VITE_ARC_RPC_URL
    value: https://rpc.testnet.arc.network
  - key: VITE_SEPOLIA_RPC_URL
    value: https://ethereum-sepolia-rpc.publicnode.com
```

### Database Persistence

Ensure `./data/wallet.db` is in a persistent volume on production servers.

---

## Support

For issues or questions:
- Check backend logs for detailed error messages
- Verify RPC endpoints are accessible
- Ensure session keys haven't expired
- Check USDC balance on source chain

## References

- [Circle CCTP Documentation](https://developers.circle.com/stablecoins/docs/cctp-getting-started)
- [Bridge Kit SDK](https://developers.circle.com/bridge-kit)
- [Arc Testnet Explorer](https://explorer.testnet.arc.network)
- [Sepolia Explorer](https://sepolia.etherscan.io)
