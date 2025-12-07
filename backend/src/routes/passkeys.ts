import { Router, Request, Response, NextFunction } from 'express';
import { PasskeyController } from '../controllers/PasskeyController.js';
import { Database } from '../models/Database.js';
import {
  rateLimitMiddleware,
  validateRequestBody,
  sanitizeInput,
  adminAuthMiddleware
} from '../middleware/security.js';
import { authMiddleware } from '../middleware/auth.js';
import { EnvConfig } from '../types/index.js';
import { MagicSessionStore } from '../magicLink/SessionStore.js';

export function createPasskeyRoutes(db: Database, config: EnvConfig, sessionStore?: MagicSessionStore): Router {
  const router = Router();
  const passkeyController = new PasskeyController(db, config, sessionStore);

  // Apply middleware to all routes
  router.use(sanitizeInput);

  /**
   * POST /passkeys/register/start
   * Start passkey registration process
   */
  router.post(
    '/register/start',
    rateLimitMiddleware('registration'),
    validateRequestBody(['username', 'displayName']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.registrationStart(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /passkeys/register/finish
   * Complete passkey registration
   */
  router.post(
    '/register/finish',
    rateLimitMiddleware('registration'),
    validateRequestBody(['username', 'credential']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.registrationFinish(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /passkeys/auth/start
   * Start passkey authentication process
   * SECURITY: Rate limited to prevent enumeration attacks
   */
  router.post(
    '/auth/start',
    rateLimitMiddleware('auth'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.authenticationStart(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /passkeys/auth/finish
   * Complete passkey authentication
   * SECURITY: Rate limited to prevent brute force attacks
   */
  router.post(
    '/auth/finish',
    rateLimitMiddleware('auth'),
    validateRequestBody(['credential']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.authenticationFinish(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /passkeys/session-keys/:userId
   * Get active session keys for a user
   */
  router.get(
    '/session-keys/:userId',
    authMiddleware(config.JWT_SECRET, sessionStore),
    rateLimitMiddleware('general'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { userId } = req.params;
    
        // Verify user owns this data
        if (req.user?.id !== userId) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            code: 'FORBIDDEN'
          });
        }

        await passkeyController.getSessionKeys(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /passkeys/session-keys/:sessionKeyId
   * Revoke a session key
   */
  router.delete(
    '/session-keys/:sessionKeyId',
    authMiddleware(config.JWT_SECRET, sessionStore),
    rateLimitMiddleware('general'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Pass authenticated user's ID to the controller for ownership check
        await passkeyController.revokeSessionKey(req, res, req.user?.id);
      } catch (error) {
        next(error);
      }
    }
  );

  // Devices management
  router.get(
    '/devices/:userId',
    authMiddleware(config.JWT_SECRET, sessionStore),
    rateLimitMiddleware('general'),
    async (req, res, next) => {
      try {
        const { userId } = req.params;
    
        // Verify user owns this data
        if (req.user?.id !== userId) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            code: 'FORBIDDEN'
          });
        }

        await passkeyController.getDevices(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    '/devices/:credentialId',
    authMiddleware(config.JWT_SECRET, sessionStore),
    rateLimitMiddleware('general'),
    async (req, res, next) => {
      try {
        await passkeyController.deleteDevice(req, res, req.user?.id);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /passkeys/recovery/start
   * Start passkey recovery process
   */
  router.post(
    '/recovery/start',
    rateLimitMiddleware('recovery'),
    validateRequestBody(['email']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.recoveryStart(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /passkeys/recovery/verify
   * Verify recovery token
   */
  router.post(
    '/recovery/verify',
    rateLimitMiddleware('recovery'),
    validateRequestBody(['token']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.recoveryVerify(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /passkeys/recovery/complete
   * Complete recovery and delete old passkeys
   */
  router.post(
    '/recovery/complete',
    rateLimitMiddleware('recovery'),
    validateRequestBody(['token']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.recoveryComplete(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /passkeys/check-user
   * Check if user has registered passkeys
   */
  router.post(
    '/check-user',
    rateLimitMiddleware('general'),
    validateRequestBody(['email']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.checkUserPasskeys(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /passkeys/reset-user
   * Reset user passkeys (for testing/development)
   */
  router.post(
    '/reset-user',
    rateLimitMiddleware('recovery'),
    validateRequestBody(['email', 'confirmReset']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.resetUserPasskeys(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /passkeys/admin/reset-user
   * Admin endpoint to reset user passkeys (bypasses rate limit)
   * Requires ADMIN_SECRET in request body
   */
  router.post(
    '/admin/reset-user',
    validateRequestBody(['email', 'adminSecret']),
    adminAuthMiddleware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Set confirmReset to required value for admin requests
        req.body.confirmReset = 'DELETE_ALL_PASSKEYS';
        await passkeyController.resetUserPasskeys(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /passkeys/health
   * Health check for passkey service
   */
  router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await passkeyController.healthCheck(req, res);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /passkeys/public-admin-recover
   * Public endpoint to recover admin account from config
   * No admin secret required - validates against adminAccounts.ts
   */
  router.post(
    '/public-admin-recover',
    rateLimitMiddleware('recovery'),
    validateRequestBody(['email']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.publicAdminRecover(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /passkeys/admin/register-credential
   * Admin endpoint to manually register a passkey credential
   * Used for recovery when passkey exists on device but not in server DB
   */
  router.post(
    '/admin/register-credential',
    validateRequestBody(['adminSecret', 'email', 'credentialId', 'publicKeyX', 'publicKeyY']),
    adminAuthMiddleware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.adminRegisterCredential(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /passkeys/admin/reset-all
   * Admin endpoint to reset ALL user data (for testing)
   * WARNING: This deletes all users, passkeys, sessions, etc.
   */
  router.post(
    '/admin/reset-all',
    validateRequestBody(['adminSecret']),
    adminAuthMiddleware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.adminResetAll(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /passkeys/admin/debug-passkey
   * Admin endpoint to debug passkey data for a user
   */
  router.post(
    '/admin/debug-passkey',
    validateRequestBody(['adminSecret', 'email']),
    adminAuthMiddleware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.adminDebugPasskey(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /passkeys/admin/update-public-key
   * Admin endpoint to update passkey public key
   */
  router.post(
    '/admin/update-public-key',
    validateRequestBody(['adminSecret', 'email', 'credentialId', 'publicKeyX', 'publicKeyY']),
    adminAuthMiddleware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.adminUpdatePublicKey(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /passkeys/admin/update-wallet-address
   * Admin endpoint to update user's wallet address
   * Used for recovery when database has incorrect wallet address
   */
  router.post(
    '/admin/update-wallet-address',
    validateRequestBody(['adminSecret', 'email', 'walletAddress']),
    adminAuthMiddleware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.adminUpdateWalletAddress(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /passkeys/admin/recover-account
   * Admin endpoint to recover admin account from config
   * Creates user with wallet address from adminAccounts.ts
   */
  router.post(
    '/admin/recover-account',
    validateRequestBody(['adminSecret', 'email']),
    adminAuthMiddleware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.adminRecoverAccount(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /passkeys/admin/get-account-info
   * Admin endpoint to get admin account info from config and database
   */
  router.post(
    '/admin/get-account-info',
    validateRequestBody(['adminSecret', 'email']),
    adminAuthMiddleware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.adminGetAccountInfo(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /passkeys/admin/link-passkey/start
   * Admin endpoint to start passkey linking (discoverable credential mode)
   */
  router.post(
    '/admin/link-passkey/start',
    validateRequestBody(['adminSecret', 'email']),
    adminAuthMiddleware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.adminLinkPasskeyStart(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /passkeys/admin/link-passkey/finish
   * Admin endpoint to finish passkey linking and register credential
   */
  router.post(
    '/admin/link-passkey/finish',
    validateRequestBody(['adminSecret', 'email', 'credential']),
    adminAuthMiddleware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.adminLinkPasskeyFinish(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /passkeys/sync-credential
   * Public endpoint to sync credential from frontend to backend
   * Used when frontend recovered credential from chain or localStorage
   * Requires valid session (user must be authenticated)
   */
  router.post(
    '/sync-credential',
    authMiddleware(config.JWT_SECRET, sessionStore),
    rateLimitMiddleware('general'),
    validateRequestBody(['email', 'credentialId', 'publicKeyX', 'publicKeyY', 'walletAddress']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.syncCredential(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}