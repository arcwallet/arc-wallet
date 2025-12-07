/**
 * Recovery Routes
 * API endpoints for wallet recovery operations
 */
import { Router } from 'express';
import { Database } from '../models/Database.js';
import { EnvConfig } from '../types/index.js';
import { MagicSessionStore } from '../magicLink/SessionStore.js';
export declare function createRecoveryRoutes(db: Database, config: EnvConfig, sessionStore?: MagicSessionStore): Router;
//# sourceMappingURL=recovery.d.ts.map