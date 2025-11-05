import { Router, Request, Response, NextFunction } from 'express';
import { PasskeyController } from '../controllers/PasskeyController.js';
import { Database } from '../models/Database.js';
import {
  rateLimitMiddleware,
  validateRequestBody,
  sanitizeInput
} from '../middleware/security.js';
import { EnvConfig } from '../types/index.js';

export function createPasskeyRoutes(db: Database, config: EnvConfig): Router {
  const router = Router();
  const passkeyController = new PasskeyController(db, config);

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
    rateLimitMiddleware('general'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
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
    rateLimitMiddleware('general'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await passkeyController.revokeSessionKey(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  // Devices management
  router.get(
    '/devices/:userId',
    rateLimitMiddleware('general'),
    async (req, res, next) => {
      try {
        await passkeyController.getDevices(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    '/devices/:credentialId',
    rateLimitMiddleware('general'),
    async (req, res, next) => {
      try {
        await passkeyController.deleteDevice(req, res);
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