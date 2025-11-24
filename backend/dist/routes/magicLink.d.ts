import { EnvConfig } from '../types/index.js';
import { MagicSessionStore } from '../magicLink/SessionStore.js';
import { MagicLinkMailer } from '../services/magicLinkMailer.js';
import { Database } from '../models/Database.js';
export declare const createMagicLinkRouter: (config: EnvConfig, mailer: MagicLinkMailer, db: Database, sessionStore: MagicSessionStore) => import("express-serve-static-core").Router;
//# sourceMappingURL=magicLink.d.ts.map