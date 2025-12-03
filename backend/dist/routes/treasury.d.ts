import { Router } from 'express';
import { Database } from '../models/Database.js';
import { EnvConfig } from '../types/index.js';
import { MagicSessionStore } from '../magicLink/SessionStore.js';
export declare function createTreasuryRoutes(db: Database, config: EnvConfig, sessionStore?: MagicSessionStore): Router;
//# sourceMappingURL=treasury.d.ts.map