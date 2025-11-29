import { Router } from 'express';
import { PasskeyController } from '../controllers/PasskeyController.js';
import { rateLimitMiddleware, validateRequestBody, sanitizeInput } from '../middleware/security.js';
import { authMiddleware } from '../middleware/auth.js';
export function createPasskeyRoutes(db, config, sessionStore) {
    const router = Router();
    const passkeyController = new PasskeyController(db, config, sessionStore);
    // Apply middleware to all routes
    router.use(sanitizeInput);
    /**
     * POST /passkeys/register/start
     * Start passkey registration process
     */
    router.post('/register/start', rateLimitMiddleware('registration'), validateRequestBody(['username', 'displayName']), async (req, res, next) => {
        try {
            await passkeyController.registrationStart(req, res);
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /passkeys/register/finish
     * Complete passkey registration
     */
    router.post('/register/finish', rateLimitMiddleware('registration'), validateRequestBody(['username', 'credential']), async (req, res, next) => {
        try {
            await passkeyController.registrationFinish(req, res);
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /passkeys/auth/start
     * Start passkey authentication process
     */
    router.post('/auth/start', rateLimitMiddleware('auth'), async (req, res, next) => {
        try {
            await passkeyController.authenticationStart(req, res);
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /passkeys/auth/finish
     * Complete passkey authentication
     */
    router.post('/auth/finish', rateLimitMiddleware('auth'), validateRequestBody(['credential']), async (req, res, next) => {
        try {
            await passkeyController.authenticationFinish(req, res);
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * GET /passkeys/session-keys/:userId
     * Get active session keys for a user
     */
    router.get('/session-keys/:userId', authMiddleware(config.JWT_SECRET, sessionStore), rateLimitMiddleware('general'), async (req, res, next) => {
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
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * DELETE /passkeys/session-keys/:sessionKeyId
     * Revoke a session key
     */
    router.delete('/session-keys/:sessionKeyId', authMiddleware(config.JWT_SECRET, sessionStore), rateLimitMiddleware('general'), async (req, res, next) => {
        try {
            // Pass authenticated user's ID to the controller for ownership check
            await passkeyController.revokeSessionKey(req, res, req.user?.id);
        }
        catch (error) {
            next(error);
        }
    });
    // Devices management
    router.get('/devices/:userId', authMiddleware(config.JWT_SECRET, sessionStore), rateLimitMiddleware('general'), async (req, res, next) => {
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
        }
        catch (error) {
            next(error);
        }
    });
    router.delete('/devices/:credentialId', authMiddleware(config.JWT_SECRET, sessionStore), rateLimitMiddleware('general'), async (req, res, next) => {
        try {
            await passkeyController.deleteDevice(req, res, req.user?.id);
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /passkeys/recovery/start
     * Start passkey recovery process
     */
    router.post('/recovery/start', rateLimitMiddleware('recovery'), validateRequestBody(['email']), async (req, res, next) => {
        try {
            await passkeyController.recoveryStart(req, res);
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /passkeys/recovery/verify
     * Verify recovery token
     */
    router.post('/recovery/verify', rateLimitMiddleware('recovery'), validateRequestBody(['token']), async (req, res, next) => {
        try {
            await passkeyController.recoveryVerify(req, res);
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /passkeys/recovery/complete
     * Complete recovery and delete old passkeys
     */
    router.post('/recovery/complete', rateLimitMiddleware('recovery'), validateRequestBody(['token']), async (req, res, next) => {
        try {
            await passkeyController.recoveryComplete(req, res);
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /passkeys/check-user
     * Check if user has registered passkeys
     */
    router.post('/check-user', rateLimitMiddleware('general'), validateRequestBody(['email']), async (req, res, next) => {
        try {
            await passkeyController.checkUserPasskeys(req, res);
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /passkeys/reset-user
     * Reset user passkeys (for testing/development)
     */
    router.post('/reset-user', rateLimitMiddleware('recovery'), validateRequestBody(['email', 'confirmReset']), async (req, res, next) => {
        try {
            await passkeyController.resetUserPasskeys(req, res);
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /passkeys/admin/reset-user
     * Admin endpoint to reset user passkeys (bypasses rate limit)
     * Requires ADMIN_SECRET in request body
     */
    router.post('/admin/reset-user', validateRequestBody(['email', 'adminSecret']), async (req, res, next) => {
        try {
            const { adminSecret } = req.body;
            const expectedSecret = process.env.ADMIN_SECRET || 'arc-admin-2024-secret';
            if (adminSecret !== expectedSecret) {
                return res.status(403).json({
                    success: false,
                    error: 'Invalid admin secret',
                    code: 'UNAUTHORIZED'
                });
            }
            // Set confirmReset to true for admin requests
            req.body.confirmReset = true;
            await passkeyController.resetUserPasskeys(req, res);
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * GET /passkeys/health
     * Health check for passkey service
     */
    router.get('/health', async (req, res, next) => {
        try {
            await passkeyController.healthCheck(req, res);
        }
        catch (error) {
            next(error);
        }
    });
    /**
     * POST /passkeys/admin/register-credential
     * Admin endpoint to manually register a passkey credential
     * Used for recovery when passkey exists on device but not in server DB
     */
    router.post('/admin/register-credential', validateRequestBody(['adminSecret', 'email', 'credentialId', 'publicKeyX', 'publicKeyY']), async (req, res, next) => {
        try {
            await passkeyController.adminRegisterCredential(req, res);
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
//# sourceMappingURL=passkeys.js.map