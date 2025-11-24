import crypto from 'crypto';
class OAuthService {
    providers;
    constructor() {
        this.providers = new Map();
        this.initializeProviders();
    }
    initializeProviders() {
        // Google OAuth
        if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
            this.providers.set('google', {
                name: 'google',
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                redirectUri: `${process.env.OAUTH_REDIRECT_BASE_URL || 'http://localhost:3001'}/auth/google/callback`,
                authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                tokenUrl: 'https://oauth2.googleapis.com/token',
                userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
                scopes: ['openid', 'profile', 'email'],
            });
        }
        // Apple OAuth
        if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID) {
            this.providers.set('apple', {
                name: 'apple',
                clientId: process.env.APPLE_CLIENT_ID,
                clientSecret: this.generateAppleClientSecret(),
                redirectUri: `${process.env.OAUTH_REDIRECT_BASE_URL || 'http://localhost:3001'}/auth/apple/callback`,
                authorizationUrl: 'https://appleid.apple.com/auth/authorize',
                tokenUrl: 'https://appleid.apple.com/auth/token',
                userInfoUrl: '', // Apple doesn't have a separate userinfo endpoint
                scopes: ['name', 'email'],
            });
        }
        // Facebook OAuth
        if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
            this.providers.set('facebook', {
                name: 'facebook',
                clientId: process.env.FACEBOOK_APP_ID,
                clientSecret: process.env.FACEBOOK_APP_SECRET,
                redirectUri: `${process.env.OAUTH_REDIRECT_BASE_URL || 'http://localhost:3001'}/auth/facebook/callback`,
                authorizationUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
                tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
                userInfoUrl: 'https://graph.facebook.com/me?fields=id,name,email,picture',
                scopes: ['public_profile', 'email'],
            });
        }
    }
    /**
     * Generate Apple client secret (JWT)
     * Apple requires a JWT signed with your private key
     */
    generateAppleClientSecret() {
        // This is a placeholder - actual implementation requires JWT signing
        // with Apple's private key
        return process.env.APPLE_CLIENT_SECRET || '';
    }
    /**
     * Get provider configuration
     */
    getProvider(provider) {
        return this.providers.get(provider);
    }
    /**
     * Check if provider is enabled
     */
    isProviderEnabled(provider) {
        return this.providers.has(provider);
    }
    /**
     * Generate authorization URL
     */
    getAuthorizationUrl(provider, state) {
        const config = this.providers.get(provider);
        if (!config) {
            throw new Error(`OAuth provider ${provider} not configured`);
        }
        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            response_type: 'code',
            scope: config.scopes.join(' '),
            state,
        });
        // Apple-specific parameters
        if (provider === 'apple') {
            params.append('response_mode', 'form_post');
        }
        return `${config.authorizationUrl}?${params.toString()}`;
    }
    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(provider, code) {
        const config = this.providers.get(provider);
        if (!config) {
            throw new Error(`OAuth provider ${provider} not configured`);
        }
        const params = new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: config.redirectUri,
        });
        const response = await fetch(config.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Token exchange failed: ${error}`);
        }
        const data = await response.json();
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in,
            tokenType: data.token_type || 'Bearer',
        };
    }
    /**
     * Get user info from provider
     */
    async getUserInfo(provider, accessToken, idToken) {
        const config = this.providers.get(provider);
        if (!config) {
            throw new Error(`OAuth provider ${provider} not configured`);
        }
        // Apple uses ID token instead of userinfo endpoint
        if (provider === 'apple' && idToken) {
            return this.parseAppleIdToken(idToken);
        }
        // For Google and Facebook, fetch from userinfo endpoint
        const response = await fetch(config.userInfoUrl, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to get user info: ${error}`);
        }
        const data = await response.json();
        // Normalize user data across providers
        return this.normalizeUserData(provider, data);
    }
    /**
     * Parse Apple ID token (JWT)
     */
    parseAppleIdToken(idToken) {
        // Decode JWT payload (base64)
        const parts = idToken.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid ID token');
        }
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        return {
            providerId: payload.sub,
            provider: 'apple',
            email: payload.email,
            name: payload.name || 'Apple User',
            picture: undefined,
        };
    }
    /**
     * Normalize user data from different providers
     */
    normalizeUserData(provider, data) {
        switch (provider) {
            case 'google':
                return {
                    providerId: data.id,
                    provider: 'google',
                    email: data.email,
                    name: data.name,
                    picture: data.picture,
                };
            case 'facebook':
                return {
                    providerId: data.id,
                    provider: 'facebook',
                    email: data.email,
                    name: data.name,
                    picture: data.picture?.data?.url,
                };
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    }
    /**
     * Generate state token for CSRF protection
     */
    generateStateToken() {
        return crypto.randomBytes(32).toString('hex');
    }
    /**
     * Get list of enabled providers
     */
    getEnabledProviders() {
        return Array.from(this.providers.keys());
    }
}
// Export singleton instance
export const oauthService = new OAuthService();
//# sourceMappingURL=oauthService.js.map