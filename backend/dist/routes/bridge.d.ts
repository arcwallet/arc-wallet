import { Router } from 'express';
import { Database } from '../models/Database.js';
import { MagicSessionStore } from '../magicLink/SessionStore.js';
export interface BridgeConfig {
    NODE_ENV: string;
    ARC_RPC_URL: string;
    BASE_SEPOLIA_RPC_URL: string;
}
/**
 * Bridge Routes
 * Status tracking for cross-chain USDC transfers
 *
 * SELF-CUSTODIAL ARCHITECTURE:
 * All transaction signing happens on the client-side.
 * Backend only tracks transaction status and history.
 * Private keys NEVER leave the browser.
 */
export declare function createBridgeRoutes(db: Database, config: BridgeConfig, sessionStore: MagicSessionStore): Router;
//# sourceMappingURL=bridge.d.ts.map