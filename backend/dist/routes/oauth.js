import express from 'express';
import { oauthService } from '../services/oauthService.js';
import { v4 as uuidv4 } from 'uuid';
export function createOAuthRouter(db, config, sessionStore) {
    const router = express.Router();
    // Initiate OAuth flow
    router.get('/:provider', async (req, res) => {
        const { provider } = req.params;
        const { redirect_url } = req.query;
        if (!oauthService.isProviderEnabled(provider)) {
            return res.status(400).json({
                success: false,
                error: `Provider ${provider} not enabled`
            });
        }
        try {
            // Generate state token for CSRF protection
            const state = oauthService.generateStateToken();
            // Store state in database
            await db.createOAuthState({
                state,
                provider,
                redirectUrl: redirect_url,
                createdAt: Date.now(),
                expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
            });
            // Get authorization URL
            const authUrl = oauthService.getAuthorizationUrl(provider, state);
            // Redirect user
            res.redirect(authUrl);
        }
        catch (error) {
            console.error('OAuth initiation error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to initiate OAuth flow'
            });
        }
    });
    // OAuth callback handler
    router.get('/:provider/callback', async (req, res) => {
        const { provider } = req.params;
        const { code, state, error } = req.query;
        if (error) {
            return res.redirect(`${config.ORIGIN}/login?error=${encodeURIComponent(error)}`);
        }
        if (!code || !state) {
            return res.redirect(`${config.ORIGIN}/login?error=Invalid callback parameters`);
        }
        try {
            // Validate state token
            const stateRecord = await db.getOAuthState(state);
            if (!stateRecord || stateRecord.expiresAt < Date.now()) {
                return res.redirect(`${config.ORIGIN}/login?error=Invalid or expired state token`);
            }
            // Delete state token (one-time use)
            await db.deleteOAuthState(state);
            // Exchange code for tokens
            const tokens = await oauthService.exchangeCodeForToken(provider, code);
            // Get user info
            const userInfo = await oauthService.getUserInfo(provider, tokens.accessToken);
            // Check if OAuth account already exists
            let oauthAccount = await db.getOAuthAccount(provider, userInfo.providerId);
            let user;
            if (oauthAccount) {
                // Update tokens
                await db.updateOAuthTokens(oauthAccount.id, {
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    expiresAt: tokens.expiresIn ? Date.now() + tokens.expiresIn * 1000 : undefined
                });
                // Get existing user
                user = await db.getUserById(oauthAccount.userId);
            }
            else {
                // Check if user exists with same email
                // Note: In a real app, we should verify email ownership before linking
                // For now, we'll create a new user if no OAuth account exists
                // Create new user
                const userId = uuidv4();
                user = await db.createUser({
                    id: userId,
                    username: userInfo.email, // Use email as username for OAuth users
                    displayName: userInfo.name,
                    walletAddress: undefined, // Will be created later
                });
                // Create OAuth account
                await db.createOAuthAccount({
                    id: uuidv4(),
                    userId: user.id,
                    provider,
                    providerId: userInfo.providerId,
                    email: userInfo.email,
                    name: userInfo.name,
                    picture: userInfo.picture,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    tokenExpiresAt: tokens.expiresIn ? Date.now() + tokens.expiresIn * 1000 : undefined,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });
            }
            if (!user) {
                throw new Error('User not found');
            }
            // Create session
            const sessionId = uuidv4();
            // Store session in MagicSessionStore (reusing existing session mechanism)
            // Note: This is a simplification. Ideally we'd have a unified session manager.
            // For now, we'll redirect with a session token or similar mechanism
            // Redirect to dashboard or original redirect URL
            const targetUrl = stateRecord.redirectUrl || `${config.ORIGIN}/dashboard`;
            // We need to pass the session to the frontend. 
            // Since we're redirecting, we can use a query param or set a cookie.
            // Setting a cookie is safer.
            res.cookie('session_id', sessionId, {
                httpOnly: true,
                secure: config.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });
            res.redirect(targetUrl);
        }
        catch (error) {
            console.error('OAuth callback error:', error);
            res.redirect(`${config.ORIGIN}/login?error=Authentication failed`);
        }
    });
    // Link OAuth account
    router.post('/link/:provider', async (req, res) => {
        // This would require authentication middleware
        // Implementation for linking accounts to existing session
        res.status(501).json({ error: 'Not implemented' });
    });
    // Unlink OAuth account
    router.delete('/unlink/:provider', async (req, res) => {
        // This would require authentication middleware
        res.status(501).json({ error: 'Not implemented' });
    });
    // Get linked accounts
    router.get('/linked-accounts', async (req, res) => {
        // This would require authentication middleware
        res.status(501).json({ error: 'Not implemented' });
    });
    return router;
}
//# sourceMappingURL=oauth.js.map