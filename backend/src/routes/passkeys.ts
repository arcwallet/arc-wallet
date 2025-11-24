import { Router, Request, Response, NextFunction } from 'express';
import { PasskeyController } from '../controllers/PasskeyController.js';
import { Database } from '../models/Database.js';
import {
  rateLimitMiddleware,
  validateRequestBody,
  sanitizeInput
} from '../middleware/security.js';
import { authMiddleware } from '../middleware/auth.js';
import { EnvConfig } from '../types/index.js';

export function createPasskeyRoutes(db: Database, config: EnvConfig): Router {
  const router = Router();
  const passkeyController = new PasskeyController(db, config);

  // Apply middleware to all routes
  router.use(sanitizeInput);

  /**
   * POST /passkeys/register/options
   * Start passkey registration process (get options)
   */
  router.post(
    '/register/options',
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
   * POST /passkeys/register/verify
   * Complete passkey registration (verify credential)
   */
  router.post(
    '/register/verify',
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
   * POST /passkeys/login/options
   * Start passkey authentication process (get options)
   */
  router.post(
    '/login/options',
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
   * POST /passkeys/login/verify
   * Complete passkey authentication (verify credential)
   */
  router.post(
    '/login/verify',
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
    authMiddleware(config.JWT_SECRET),
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
    authMiddleware(config.JWT_SECRET),
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
    authMiddleware(config.JWT_SECRET),
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
    authMiddleware(config.JWT_SECRET),
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

  return router;
}