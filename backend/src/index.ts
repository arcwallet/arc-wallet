#!/usr/bin/env node

import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Database } from './models/Database.js';
import { SessionKeyManager } from './utils/SessionKeyManager.js';
import { createPasskeyRoutes } from './routes/passkeys.js';
import { createCircleOtpRouter } from './routes/circleOtp.js';
import { createWalletRouter } from './routes/wallet.js';
import { createWalletBackupRouter } from './routes/walletBackup.js';
import { createBridgeRoutes } from './routes/bridge.js';
import { createMultiSigRoutes } from './routes/multiSig.js';
import { createTreasuryRoutes } from './routes/treasury.js';
import { createOAuthRouter } from './routes/oauth.js';
import paymasterRouter from './routes/paymaster.js';
import { createHistoryRouter } from './routes/history.js';
import { createWebhookRouter } from './routes/webhooks.js';
import { createGasStationRouter } from './routes/gasStation.js';
import { createBundlerRouter } from './routes/bundler.js';
import { createSepoliaBundlerRouter } from './routes/sepoliaBundler.js';
import { WalletBackupService } from './services/walletBackupService.js';
import { IndexerService } from './services/indexerService.js';
import { getBundlerService } from './services/bundlerService.js';
import { getSepoliaBundlerService } from './services/sepoliaBundlerService.js';
import { webhookService } from './services/webhookService.js';
import { initIndexerDB } from './db/indexer.js';
import { MagicSessionStore } from './magicLink/SessionStore.js';
// Agent temporarily disabled - will integrate new AI solution
// import agentRouter from './controllers/agentController.js';
// import { initializeAgentDatabase } from './database/agentDatabase.js';
import { loadConfig, validateConfig } from './utils/config.js';
import { cookieMiddleware } from './middleware/cookies.js';
import { setCsrfCookie, validateCsrfToken } from './middleware/csrf.js';
import {
  errorHandler,
  securityHeaders,
  requestLogger,
  healthCheck,
  rateLimitMiddleware
} from './middleware/security.js';

// Load and validate configuration
const config = loadConfig();
validateConfig(config);

// Initialize database
const db = new Database(config.DB_PATH);
const sessionKeyManager = new SessionKeyManager(db);
const walletBackupService = new WalletBackupService(db);
const magicSessionStore = new MagicSessionStore();

// Create Express app
const app = express();

// Trust proxy (important for rate limiting and IP detection)
app.set('trust proxy', 1);

// Security middleware with hardened CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],  // Removed unsafe-inline for better XSS protection
      imgSrc: ["'self'", "data:", "https:"],  // Allow HTTPS images
      connectSrc: ["'self'", "https://api.circle.com", "wss:"],  // Allow Circle API and WebSocket
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],  // Prevent clickjacking
      baseUri: ["'self'"],  // Prevent base tag hijacking
      formAction: ["'self'"],  // Restrict form submissions
      upgradeInsecureRequests: [],  // Force HTTPS
    }
  },
  crossOriginEmbedderPolicy: false,
  // Additional security headers
  hsts: {
    maxAge: 31536000,  // 1 year
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,
  xssFilter: true,
  hidePoweredBy: true
}));

// CORS configuration
app.use(cors({
  origin: config.ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-CSRF-Token']
}));

// Request parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieMiddleware);
app.use(setCsrfCookie);
app.use(validateCsrfToken);

// Security headers
app.use(securityHeaders);

// Request logging
if (config.NODE_ENV === 'development') {
  app.use(requestLogger);
}

// Health check
app.use(healthCheck);

// General rate limiting
app.use(rateLimitMiddleware('general'));

// Routes - OTP authentication only (Magic Link removed)
app.use(createCircleOtpRouter(config, db, magicSessionStore));
app.use('/api/wallet', createWalletRouter(db, config, magicSessionStore));
app.use('/api/wallet-backup', createWalletBackupRouter(walletBackupService));
app.use('/passkeys', createPasskeyRoutes(db, config, magicSessionStore));
app.use(createBridgeRoutes(db, {
  NODE_ENV: config.NODE_ENV,
  ARC_RPC_URL: config.ARC_RPC_URL,
  SEPOLIA_RPC_URL: config.SEPOLIA_RPC_URL,
}, magicSessionStore));
app.use('/auth', createOAuthRouter(db, config, magicSessionStore));
app.use('/multisig', createMultiSigRoutes(db, config, magicSessionStore));
app.use('/treasury', createTreasuryRoutes(db, config, magicSessionStore));
app.use('/api/paymaster', paymasterRouter);
app.use('/api/history', createHistoryRouter());
app.use('/api/webhooks', createWebhookRouter());
app.use('/api/gas-station', createGasStationRouter());
app.use('/api/bundler', createBundlerRouter());
app.use('/api/bundler/sepolia', createSepoliaBundlerRouter());
// Agent temporarily disabled - will integrate new AI solution
// app.use('/api/agent', agentRouter);

// Initialize indexer database
console.log('🔧 Initializing indexer database...');
initIndexerDB();

// Agent database temporarily disabled - will integrate new AI solution
// console.log('🔧 Initializing agent database...');
// initializeAgentDatabase();

// Initialize and start indexer service (optional - can be disabled via env)
const INDEXER_ENABLED = process.env.INDEXER_ENABLED !== 'false';
if (INDEXER_ENABLED) {
  console.log('🚀 Starting indexer service...');
  const indexerService = new IndexerService(db);
  indexerService.start();
} else {
  console.log('⏸️ Indexer service disabled (INDEXER_ENABLED=false)');
}
webhookService.start();

// Initialize and start bundler services (optional - can be disabled via env)
const BUNDLER_ENABLED = process.env.BUNDLER_ENABLED === 'true';
if (BUNDLER_ENABLED && process.env.BUNDLER_PRIVATE_KEY) {
  console.log('🚀 Starting bundler services...');
  try {
    // Arc bundler
    const bundlerService = getBundlerService();
    bundlerService.start();
    console.log('✅ Arc bundler started');

    // Sepolia bundler
    const sepoliaBundlerService = getSepoliaBundlerService();
    sepoliaBundlerService.start();
    console.log('✅ Sepolia bundler started');
  } catch (error: any) {
    console.error('❌ Failed to start bundler service:', error.message);
  }
} else {
  console.log('⏸️ Bundler services disabled (BUNDLER_ENABLED=false or no private key)');
}

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Arc Wallet Passkey Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      passkeys: '/passkeys',
      bridge: '/bridge',
      registration: {
        start: 'POST /passkeys/register/start',
        finish: 'POST /passkeys/register/finish'
      },
      authentication: {
        start: 'POST /passkeys/auth/start',
        finish: 'POST /passkeys/auth/finish'
      },
      sessionKeys: {
        get: 'GET /passkeys/session-keys/:userId',
        revoke: 'DELETE /passkeys/session-keys/:sessionKeyId'
      },
      bridgeOperations: {
        start: 'POST /bridge/start',
        status: 'GET /bridge/status/:transactionId',
        history: 'GET /bridge/history/:userId'
      },
      multiSig: {
        createAccount: 'POST /multisig/accounts',
        getAccounts: 'GET /multisig/accounts/user/:userId',
        getAccount: 'GET /multisig/accounts/:accountId',
        updateAccount: 'PUT /multisig/accounts/:accountId',
        addMember: 'POST /multisig/accounts/:accountId/members',
        removeMember: 'DELETE /multisig/accounts/:accountId/members/:memberId',
        createTransaction: 'POST /multisig/transactions',
        getTransaction: 'GET /multisig/transactions/:transactionId',
        getTransactions: 'GET /multisig/accounts/:accountId/transactions',
        approveTransaction: 'POST /multisig/transactions/:transactionId/approve',
        rejectTransaction: 'POST /multisig/transactions/:transactionId/reject',
        deployContract: 'POST /multisig/accounts/:accountId/deploy'
      },
      gasStation: {
        health: 'GET /api/gas-station/health',
        stats: 'GET /api/gas-station/stats',
        balance: 'GET /api/gas-station/balance',
        eligibility: 'GET /api/gas-station/eligibility/:address',
        sponsor: 'POST /api/gas-station/sponsor',
        autoSponsor: 'POST /api/gas-station/auto-sponsor'
      }
    }
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND'
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Cleanup function
async function cleanup() {
  console.log('Shutting down gracefully...');

  try {
    // Cleanup expired session keys
    await sessionKeyManager.cleanupExpiredKeys();

    // Cleanup expired challenges
    await db.cleanupExpiredChallenges();

    // Close database connection
    await db.close();

    console.log('Cleanup completed');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }

  process.exit(0);
}

// Graceful shutdown handlers
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Unhandled error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
async function startServer() {
  try {
    // Wait for database to be ready
    await db.waitForReady();
    console.log('Database initialized successfully');

    // Start periodic cleanup
    setInterval(async () => {
      try {
        await sessionKeyManager.cleanupExpiredKeys();
        await db.cleanupExpiredChallenges();
      } catch (error) {
        console.error('Periodic cleanup error:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    // Start listening
    const server = app.listen(config.PORT, () => {
      console.log(`🚀 Arc Wallet Backend running on port ${config.PORT}`);
      console.log(`📱 Passkey service available at http://localhost:${config.PORT}/passkeys`);
      console.log(`🏥 Health check at http://localhost:${config.PORT}/health`);
      console.log(`🌍 Environment: ${config.NODE_ENV}`);
      console.log(`🔒 CORS origins: ${config.ALLOWED_ORIGINS.join(', ')}`);
    });

    // Graceful shutdown for server
    const gracefulShutdown = () => {
      server.close(async () => {
        console.log('HTTP server closed');
        await cleanup();
      });
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
startServer().catch(error => {
  console.error('Application startup error:', error);
  process.exit(1);
});
