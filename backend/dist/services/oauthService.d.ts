/**
 * OAuth Service
 * Handles OAuth 2.0 authentication for Google, Apple, and Facebook
 */
export interface OAuthProvider {
    name: 'google' | 'apple' | 'facebook';
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    authorizationUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
    scopes: string[];
}
export interface OAuthTokens {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    tokenType: string;
}
export interface OAuthUser {
    providerId: string;
    provider: string;
    email: string;
    name: string;
    picture?: string;
}
export interface OAuthAccount {
    id: string;
    userId: string;
    provider: string;
    providerId: string;
    email: string;
    name: string;
    picture?: string;
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt?: number;
    createdAt: number;
    updatedAt: number;
}
declare class OAuthService {
    private providers;
    constructor();
    private initializeProviders;
    /**
     * Generate Apple client secret (JWT)
     * Apple requires a JWT signed with your private key
     */
    private generateAppleClientSecret;
    /**
     * Get provider configuration
     */
    getProvider(provider: string): OAuthProvider | undefined;
    /**
     * Check if provider is enabled
     */
    isProviderEnabled(provider: string): boolean;
    /**
     * Generate authorization URL
     */
    getAuthorizationUrl(provider: string, state: string): string;
    /**
     * Exchange authorization code for access token
     */
    exchangeCodeForToken(provider: string, code: string): Promise<OAuthTokens>;
    /**
     * Get user info from provider
     */
    getUserInfo(provider: string, accessToken: string, idToken?: string): Promise<OAuthUser>;
    /**
     * Parse Apple ID token (JWT)
     */
    private parseAppleIdToken;
    /**
     * Normalize user data from different providers
     */
    private normalizeUserData;
    /**
     * Generate state token for CSRF protection
     */
    generateStateToken(): string;
    /**
     * Get list of enabled providers
     */
    getEnabledProviders(): string[];
}
export declare const oauthService: OAuthService;
export {};
//# sourceMappingURL=oauthService.d.ts.map