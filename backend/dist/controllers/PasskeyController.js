import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { randomUUID } from 'crypto';
import { SessionKeyManager } from '../utils/SessionKeyManager.js';
import { ApiError } from '../types/index.js';
import { getAdminAccount, isAdminEmail } from '../config/adminAccounts.js';
// Session cookie configuration - Enterprise-friendly duration
const SESSION_COOKIE_NAME = 'arcwallet_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days - enterprise wallet standard
const SESSION_KEY_HOURS = 7 * 24; // 7 days in hours for session key generation
const COOKIE_BASE_OPTIONS = (isProd) => ({
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/',
});
const normalizeUsername = (value) => value.trim().toLowerCase();
const serializeSessionKey = (sessionKey) => ({
    privateKey: sessionKey.privateKey,
    address: sessionKey.address,
    expiresAt: sessionKey.expiresAt instanceof Date
        ? sessionKey.expiresAt.toISOString()
        : new Date(sessionKey.expiresAt).toISOString()
});
const decodeClientDataJSON = (clientData) => {
    const base64 = clientData.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
    const buffer = Buffer.from(padded, 'base64');
    try {
        return JSON.parse(buffer.toString('utf-8'));
    }
    catch (error) {
        throw new ApiError('Invalid client data JSON', 400, 'INVALID_CHALLENGE');
    }
};
const extractChallengeFromCredential = (clientDataJSON) => {
    const clientData = decodeClientDataJSON(clientDataJSON);
    const challenge = clientData?.challenge;
    if (typeof challenge !== 'string' || challenge.length === 0) {
        throw new ApiError('Challenge not found in credential', 400, 'INVALID_CHALLENGE');
    }
    return challenge;
};
export class PasskeyController {
    db;
    sessionKeyManager;
    config;
    sessionStore;
    constructor(db, config, sessionStore) {
        this.db = db;
        this.sessionKeyManager = new SessionKeyManager(db);
        this.config = config;
        this.sessionStore = sessionStore;
    }
    /**
     * Start passkey registration
     */
    registrationStart = async (req, res) => {
        try {
            const { username, displayName } = req.body;
            const rawUsername = username?.trim();
            if (!rawUsername) {
                throw new ApiError('Username (email) is required', 400, 'MISSING_FIELDS');
            }
            const normalizedUsername = normalizeUsername(rawUsername);
            const friendlyDisplayName = (displayName?.trim() || rawUsername).slice(0, 64);
            // Check if user already exists
            const existingUser = await this.db.getUserByUsername(normalizedUsername);
            let options;
            if (existingUser) {
                // Check if user already has a passkey
                const userPasskeys = await this.db.getPasskeysByUserId(existingUser.id);
                // CRITICAL: Prevent creating new passkey if user already has one
                // Each passkey generates a different wallet address, so allowing multiple
                // passkeys would cause users to lose access to their funds
                if (userPasskeys.length > 0) {
                    throw new ApiError('You already have a passkey registered. Creating a new passkey would generate a new wallet address and you would lose access to your existing funds. Use your existing passkey to login.', 400, 'PASSKEY_ALREADY_EXISTS');
                }
                // User exists but has no passkey - allow registration
                options = await generateRegistrationOptions({
                    rpName: this.config.RP_NAME,
                    rpID: this.config.RP_ID,
                    userID: new Uint8Array(Buffer.from(existingUser.id)),
                    userName: existingUser.username,
                    userDisplayName: existingUser.displayName,
                    attestationType: 'none',
                    authenticatorSelection: {
                        residentKey: 'required',
                        userVerification: 'required',
                        authenticatorAttachment: 'platform'
                    },
                    supportedAlgorithmIDs: [-7, -257]
                });
                // Store challenge associated with user
                const challengeExpiration = new Date();
                challengeExpiration.setMinutes(challengeExpiration.getMinutes() + 5);
                await this.db.createChallenge({
                    id: randomUUID(),
                    challenge: options.challenge,
                    userId: existingUser.id,
                    type: 'registration',
                    expiresAt: challengeExpiration
                });
            }
            else {
                // New user: proceed as initial registration
                options = await generateRegistrationOptions({
                    rpName: this.config.RP_NAME,
                    rpID: this.config.RP_ID,
                    userID: new Uint8Array(Buffer.from(randomUUID())),
                    userName: normalizedUsername,
                    userDisplayName: friendlyDisplayName,
                    attestationType: 'none',
                    authenticatorSelection: {
                        residentKey: 'preferred',
                        userVerification: 'required',
                        authenticatorAttachment: 'platform'
                    },
                    supportedAlgorithmIDs: [-7, -257]
                });
                const challengeExpiration = new Date();
                challengeExpiration.setMinutes(challengeExpiration.getMinutes() + 5);
                await this.db.createChallenge({
                    id: randomUUID(),
                    challenge: options.challenge,
                    type: 'registration',
                    expiresAt: challengeExpiration
                });
            }
            res.json({ success: true, data: { options } });
        }
        catch (error) {
            console.error('Registration start error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Failed to start registration', 500, 'REGISTRATION_START_FAILED');
        }
    };
    /**
     * Finish passkey registration
     */
    registrationFinish = async (req, res) => {
        try {
            const { username, credential } = req.body;
            if (!username || !credential) {
                throw new ApiError('Username and credential are required', 400, 'MISSING_FIELDS');
            }
            const rawUsername = username.trim();
            const normalizedUsername = normalizeUsername(rawUsername);
            const friendlyDisplayName = rawUsername || normalizedUsername;
            const clientChallenge = extractChallengeFromCredential(credential.response.clientDataJSON);
            // Verify the challenge exists and is valid
            const challengeRecord = await this.db.getChallengeByValue(clientChallenge, 'registration');
            if (!challengeRecord) {
                console.error('[PasskeyReg] Challenge not found or expired:', clientChallenge);
                throw new ApiError('Invalid or expired challenge', 400, 'INVALID_CHALLENGE');
            }
            const decodedClientData = decodeClientDataJSON(credential.response.clientDataJSON);
            // Debug logs only in development
            if (this.config.NODE_ENV === 'development') {
                console.log('[PasskeyReg] Verifying registration response...');
                console.log('[PasskeyReg] Expected origin:', this.config.ORIGIN);
                console.log('[PasskeyReg] Client origin:', decodedClientData.origin);
                console.log('[PasskeyReg] Origin match:', this.config.ORIGIN === decodedClientData.origin);
            }
            // Verify registration response
            let verification;
            try {
                verification = await verifyRegistrationResponse({
                    response: credential,
                    expectedChallenge: challengeRecord.challenge,
                    expectedOrigin: this.config.ORIGIN,
                    expectedRPID: this.config.RP_ID,
                    requireUserVerification: true
                });
            }
            catch (verifyError) {
                console.error('[PasskeyReg] Credential verification failed:', verifyError.message);
                throw new ApiError(`Credential verification failed: ${verifyError.message}`, 400, 'VERIFICATION_FAILED');
            }
            if (this.config.NODE_ENV === 'development') {
                console.log('[PasskeyReg] Verification result:', verification.verified);
            }
            if (!verification.verified) {
                console.error('[PasskeyReg] Registration verification failed');
                throw new ApiError('Registration verification failed', 400, 'VERIFICATION_FAILED');
            }
            // Create user if not exists; otherwise use existing
            let user = await this.db.getUserByUsername(normalizedUsername);
            if (!user) {
                const userId = randomUUID();
                user = await this.db.createUser({
                    id: userId,
                    username: normalizedUsername,
                    displayName: friendlyDisplayName
                });
            }
            // Store passkey credential
            // IMPORTANT: credential.id is already base64url encoded by @simplewebauthn/browser
            // DO NOT encode again - use it directly
            if (verification.registrationInfo) {
                // Use credential.id directly - it's already base64url encoded
                const credentialIdB64Url = credential.id;
                // Derive Ethereum address from passkey public key
                // This address will be the owner of the Smart Account
                const { deriveAddressFromCOSE } = await import('../utils/passkeyUtils.js');
                const ownerAddress = deriveAddressFromCOSE(verification.registrationInfo.credentialPublicKey);
                if (this.config.NODE_ENV === 'development') {
                    console.log('[PasskeyReg] Derived owner address:', ownerAddress);
                }
                // IMPORTANT: Only set wallet address if user doesn't have one yet
                // This prevents duplicate wallet creation when adding a new device
                if (!user.walletAddress) {
                    await this.db.updateUser(user.id, {
                        walletAddress: ownerAddress
                    });
                }
                await this.db.createPasskeyCredential({
                    id: randomUUID(),
                    userId: user.id,
                    credentialID: credentialIdB64Url,
                    credentialPublicKey: verification.registrationInfo.credentialPublicKey,
                    counter: verification.registrationInfo.counter,
                    credentialDeviceType: verification.registrationInfo.credentialDeviceType,
                    credentialBackedUp: verification.registrationInfo.credentialBackedUp,
                    transports: credential.response.transports
                });
            }
            // Clean up challenge
            await this.db.deleteChallenge(challengeRecord.id);
            // Generate session key for the newly registered user
            const sessionKey = await this.sessionKeyManager.generateSessionKey(user.id, SESSION_KEY_HOURS);
            // Extract P256 public key coordinates for smart contract wallet
            let publicKeyX;
            let publicKeyY;
            if (verification.registrationInfo?.credentialPublicKey) {
                try {
                    const { COSEECDHAtoXY } = await import('../utils/passkeyUtils.js');
                    const [x, y] = COSEECDHAtoXY(verification.registrationInfo.credentialPublicKey);
                    publicKeyX = x;
                    publicKeyY = y;
                }
                catch (e) {
                    console.error('[PasskeyReg] Failed to extract public key coordinates');
                }
            }
            // Self-custodial: Return user identity info and public key for smart contract wallet
            res.json({
                success: true,
                data: {
                    user: {
                        id: user.id,
                        username: user.username,
                        displayName: user.displayName
                    },
                    sessionKey: serializeSessionKey(sessionKey),
                    // Public key coordinates for PasskeyAccount smart contract
                    publicKey: publicKeyX && publicKeyY ? { x: publicKeyX, y: publicKeyY } : undefined
                }
            });
        }
        catch (error) {
            console.error('Registration finish error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Failed to complete registration', 500, 'REGISTRATION_FINISH_FAILED');
        }
    };
    /**
     * Start passkey authentication
     */
    authenticationStart = async (req, res) => {
        try {
            const { username, credentialId, challenge } = req.body;
            let allowCredentials = undefined;
            const normalizedUsername = username?.trim() ? normalizeUsername(username) : undefined;
            // If credentialId is provided directly (for signing operations), use it
            if (credentialId) {
                allowCredentials = [{
                        id: credentialId,
                        transports: ['internal', 'hybrid']
                    }];
                console.log('[PasskeyAuth] Using provided credentialId for authentication');
            }
            // If username is provided, try to get user's credentials
            // But don't fail if user not found - allow discoverable credential flow
            // This enables recovery when backend DB lost the credential but user has passkey on device
            else if (normalizedUsername) {
                const user = await this.db.getUserByUsername(normalizedUsername);
                if (user) {
                    const userPasskeys = await this.db.getPasskeysByUserId(user.id);
                    allowCredentials = userPasskeys.map(passkey => ({
                        id: passkey.credentialID,
                        transports: ['internal']
                    }));
                }
                else {
                    // User not found in DB - allow discoverable credential flow
                    // SDK will handle recovery from chain if wallet is deployed
                    console.log('[PasskeyAuth] User not found in DB, allowing discoverable credential flow:', normalizedUsername);
                }
            }
            // Generate authentication options
            // If custom challenge provided (for UserOp signing), use it
            const options = await generateAuthenticationOptions({
                rpID: this.config.RP_ID,
                allowCredentials,
                userVerification: 'required',
                timeout: 60000, // 60 seconds timeout
                challenge: challenge ? Buffer.from(challenge.replace('0x', ''), 'hex') : undefined,
            });
            // Store challenge in database
            const challengeExpiration = new Date();
            challengeExpiration.setMinutes(challengeExpiration.getMinutes() + 5); // 5 minutes
            await this.db.createChallenge({
                id: randomUUID(),
                challenge: options.challenge,
                type: 'authentication',
                expiresAt: challengeExpiration
            });
            res.json({
                success: true,
                data: { options }
            });
        }
        catch (error) {
            console.error('Authentication start error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Failed to start authentication', 500, 'AUTHENTICATION_START_FAILED');
        }
    };
    /**
     * Finish passkey authentication
     */
    authenticationFinish = async (req, res) => {
        try {
            const { credential } = req.body;
            if (!credential) {
                throw new ApiError('Credential is required', 400, 'MISSING_CREDENTIAL');
            }
            // Get passkey credential from database
            // Use rawId (base64url) instead of id (base64) to match database format
            const credentialId = credential.rawId || credential.id;
            const passkeyCredential = await this.db.getPasskeyByCredentialId(credentialId);
            if (!passkeyCredential) {
                throw new ApiError('Passkey not found', 404, 'PASSKEY_NOT_FOUND');
            }
            // Get user
            const user = await this.db.getUserById(passkeyCredential.userId);
            if (!user) {
                throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
            }
            const clientChallenge = extractChallengeFromCredential(credential.response.clientDataJSON);
            // Find specific authentication challenge
            const challenge = await this.db.getChallengeByValue(clientChallenge, 'authentication');
            if (!challenge) {
                throw new ApiError('Invalid or expired challenge', 400, 'INVALID_CHALLENGE');
            }
            // Debug: Log public key info before verification
            console.log('[PasskeyAuth] Public key info:', {
                type: typeof passkeyCredential.credentialPublicKey,
                isUint8Array: passkeyCredential.credentialPublicKey instanceof Uint8Array,
                length: passkeyCredential.credentialPublicKey?.length,
                firstBytes: passkeyCredential.credentialPublicKey ?
                    Array.from(passkeyCredential.credentialPublicKey.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ') : 'null'
            });
            // Verify authentication response
            const verification = await verifyAuthenticationResponse({
                response: credential,
                expectedChallenge: challenge.challenge,
                expectedOrigin: this.config.ORIGIN,
                expectedRPID: this.config.RP_ID,
                authenticator: {
                    credentialID: passkeyCredential.credentialID,
                    credentialPublicKey: passkeyCredential.credentialPublicKey,
                    counter: passkeyCredential.counter,
                    transports: passkeyCredential.transports
                },
                requireUserVerification: true
            });
            if (!verification.verified) {
                throw new ApiError('Authentication verification failed', 400, 'VERIFICATION_FAILED');
            }
            // Update counter
            if (verification.authenticationInfo) {
                await this.db.updatePasskeyCounter(passkeyCredential.credentialID, verification.authenticationInfo.newCounter);
            }
            // Reuse latest active session key if available, otherwise generate a new one
            let sessionKey = await this.sessionKeyManager.getLatestSessionKey(user.id);
            if (!sessionKey || sessionKey.expiresAt <= new Date()) {
                sessionKey = await this.sessionKeyManager.generateSessionKey(user.id, SESSION_KEY_HOURS);
            }
            // Clean up challenge
            await this.db.deleteChallenge(challenge.id);
            // Extract P256 public key coordinates for smart contract wallet
            let publicKeyX;
            let publicKeyY;
            if (passkeyCredential.credentialPublicKey) {
                try {
                    const { COSEECDHAtoXY } = await import('../utils/passkeyUtils.js');
                    const [x, y] = COSEECDHAtoXY(passkeyCredential.credentialPublicKey);
                    publicKeyX = x;
                    publicKeyY = y;
                }
                catch (e) {
                    console.error('[PasskeyAuth] Failed to extract public key coordinates:', e);
                }
            }
            // CRITICAL: Create session and set cookie for passkey authentication
            // This enables the /api/session endpoint to recognize the authenticated user
            if (this.sessionStore) {
                const now = new Date().toISOString();
                const sessionUser = {
                    id: user.id,
                    email: user.username, // username is the email
                    hasWallet: false, // Will be updated after wallet connection
                    walletAddress: null,
                    createdAt: now,
                    updatedAt: now,
                };
                const session = this.sessionStore.create(sessionUser, SESSION_TTL_MS);
                const cookieOptions = COOKIE_BASE_OPTIONS(this.config.NODE_ENV === 'production');
                res.cookie(SESSION_COOKIE_NAME, session.id, cookieOptions);
                console.log('[PasskeyAuth] Session cookie created for:', user.username);
            }
            // Self-custodial: Return user identity info and public key for smart contract wallet
            res.json({
                success: true,
                data: {
                    user: {
                        id: user.id,
                        username: user.username,
                        displayName: user.displayName
                    },
                    sessionKey: serializeSessionKey(sessionKey),
                    // Public key coordinates for PasskeyAccount smart contract (for reconnection)
                    publicKey: publicKeyX && publicKeyY ? { x: publicKeyX, y: publicKeyY } : undefined
                }
            });
        }
        catch (error) {
            console.error('Authentication finish error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Failed to complete authentication', 500, 'AUTHENTICATION_FINISH_FAILED');
        }
    };
    /**
     * Get user session keys
     */
    getSessionKeys = async (req, res) => {
        try {
            const { userId } = req.params;
            if (!userId) {
                throw new ApiError('User ID is required', 400, 'MISSING_USER_ID');
            }
            const user = await this.db.getUserById(userId);
            if (!user) {
                throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
            }
            const sessionKeys = await this.sessionKeyManager.getActiveSessionKeys(userId);
            const stats = await this.sessionKeyManager.getSessionKeyStats(userId);
            res.json({
                success: true,
                data: {
                    sessionKeys: sessionKeys.map(key => ({
                        id: key.id,
                        address: key.address,
                        expiresAt: key.expiresAt.toISOString(),
                        createdAt: key.createdAt.toISOString()
                    })),
                    stats
                }
            });
        }
        catch (error) {
            console.error('Get session keys error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Failed to get session keys', 500, 'GET_SESSION_KEYS_FAILED');
        }
    };
    /**
     * Revoke session key
     */
    revokeSessionKey = async (req, res, authUserId) => {
        try {
            const { sessionKeyId } = req.params;
            if (!sessionKeyId) {
                throw new ApiError('Session key ID is required', 400, 'MISSING_SESSION_KEY_ID');
            }
            if (!authUserId) {
                throw new ApiError('Authentication required', 401, 'UNAUTHORIZED');
            }
            // Check ownership before revoking
            const sessionKey = await this.sessionKeyManager.getSessionKeyById(sessionKeyId);
            if (!sessionKey) {
                // Don't reveal if key exists or not, just say it's successful
                return res.json({ success: true, message: 'Session key revoked successfully' });
            }
            if (sessionKey.userId !== authUserId) {
                throw new ApiError('Forbidden: You do not own this session key', 403, 'FORBIDDEN');
            }
            await this.sessionKeyManager.revokeSessionKey(sessionKeyId);
            res.json({
                success: true,
                message: 'Session key revoked successfully'
            });
        }
        catch (error) {
            console.error('Revoke session key error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Failed to revoke session key', 500, 'REVOKE_SESSION_KEY_FAILED');
        }
    };
    /**
     * List passkey devices for a user
     */
    getDevices = async (req, res) => {
        try {
            const { userId } = req.params;
            if (!userId) {
                throw new ApiError('User ID is required', 400, 'MISSING_USER_ID');
            }
            const user = await this.db.getUserById(userId);
            if (!user) {
                throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
            }
            const credentials = await this.db.getPasskeysByUserId(userId);
            res.json({
                success: true,
                data: credentials.map((c) => ({
                    id: c.id,
                    credentialID: c.credentialID,
                    transports: c.transports,
                    createdAt: c.createdAt.toISOString(),
                    deviceType: c.credentialDeviceType,
                    backedUp: c.credentialBackedUp,
                    counter: c.counter,
                })),
            });
        }
        catch (error) {
            console.error('Get devices error:', error);
            if (error instanceof ApiError)
                throw error;
            throw new ApiError('Failed to list devices', 500, 'GET_DEVICES_FAILED');
        }
    };
    /**
     * Delete a passkey device (credential) by internal id
     */
    deleteDevice = async (req, res, authUserId) => {
        try {
            const { credentialId } = req.params;
            if (!credentialId) {
                throw new ApiError('Credential id is required', 400, 'MISSING_CREDENTIAL_ID');
            }
            if (!authUserId) {
                throw new ApiError('Authentication required', 401, 'UNAUTHORIZED');
            }
            // In the original code, the parameter from the route was the internal DB ID.
            // A more correct approach is to fetch by the public-facing credentialID and check ownership.
            // Let's assume the route now correctly uses the WebAuthn credentialID.
            const passkey = await this.db.getPasskeyByCredentialId(credentialId);
            if (!passkey) {
                // Don't reveal that the device doesn't exist.
                return res.json({ success: true, message: 'Device removed' });
            }
            // Check ownership
            if (passkey.userId !== authUserId) {
                throw new ApiError('Forbidden: You do not own this device', 403, 'FORBIDDEN');
            }
            // Now delete using the internal DB id (`passkey.id`)
            const dbAny = this.db;
            const { promisify } = await import('util');
            await dbAny.waitForReady();
            const run = promisify(dbAny.db.run.bind(dbAny.db));
            await run('DELETE FROM passkey_credentials WHERE id = ?', [passkey.id]);
            res.json({ success: true, message: 'Device removed' });
        }
        catch (error) {
            console.error('Delete device error:', error);
            if (error instanceof ApiError)
                throw error;
            throw new ApiError('Failed to delete device', 500, 'DELETE_DEVICE_FAILED');
        }
    };
    /**
     * Health check endpoint
     */
    healthCheck = async (req, res) => {
        try {
            // Test database connection
            await this.db.waitForReady();
            res.json({
                success: true,
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: 'passkey-service'
            });
        }
        catch (error) {
            console.error('Health check error:', error);
            res.status(503).json({
                success: false,
                status: 'unhealthy',
                error: 'Database connection failed',
                timestamp: new Date().toISOString()
            });
        }
    };
    // Helper method to get all challenges (simplified implementation)
    async getAllChallenges() {
        const db = this.db;
        await db.waitForReady();
        const { promisify } = await import('util');
        const all = promisify(db.db.all.bind(db.db));
        const rows = await all('SELECT * FROM webauthn_challenges WHERE expires_at > ? ORDER BY created_at DESC', [new Date().toISOString()]);
        return rows.map((row) => ({
            id: row.id,
            challenge: row.challenge,
            userId: row.user_id,
            type: row.type,
            expiresAt: new Date(row.expires_at),
            createdAt: new Date(row.created_at)
        }));
    }
    /**
     * Start passkey recovery - send recovery email
     */
    recoveryStart = async (req, res) => {
        try {
            const { email } = req.body;
            if (!email) {
                throw new ApiError('Email is required', 400, 'MISSING_EMAIL');
            }
            // Normalize email
            const normalizedEmail = email.trim().toLowerCase();
            // Check if user exists
            const user = await this.db.getUserByUsername(normalizedEmail);
            if (!user) {
                // Don't reveal if user exists or not for security
                return res.json({
                    success: true,
                    message: 'If an account exists with this email, a recovery link will be sent.'
                });
            }
            // Generate recovery token
            const token = randomUUID() + '-' + randomUUID();
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry
            await this.db.createRecoveryToken({
                id: randomUUID(),
                email: normalizedEmail,
                token,
                expiresAt
            });
            // Return token in response for now (in production, send via email)
            res.json({
                success: true,
                message: 'If an account exists with this email, a recovery link will be sent.',
                // Include token in dev mode for testing
                ...(this.config.NODE_ENV === 'development' && { recoveryToken: token })
            });
        }
        catch (error) {
            console.error('Recovery start error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Failed to start recovery', 500, 'RECOVERY_START_FAILED');
        }
    };
    /**
     * Verify recovery token
     */
    recoveryVerify = async (req, res) => {
        try {
            const { token } = req.body;
            if (!token) {
                throw new ApiError('Recovery token is required', 400, 'MISSING_TOKEN');
            }
            const recoveryToken = await this.db.getRecoveryToken(token);
            if (!recoveryToken) {
                throw new ApiError('Invalid or expired recovery token', 400, 'INVALID_TOKEN');
            }
            res.json({
                success: true,
                data: {
                    email: recoveryToken.email,
                    valid: true
                }
            });
        }
        catch (error) {
            console.error('Recovery verify error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Failed to verify recovery token', 500, 'RECOVERY_VERIFY_FAILED');
        }
    };
    /**
     * Complete recovery - delete old passkeys and allow new registration
     */
    recoveryComplete = async (req, res) => {
        try {
            const { token, privateKey } = req.body;
            if (!token) {
                throw new ApiError('Recovery token is required', 400, 'MISSING_TOKEN');
            }
            const recoveryToken = await this.db.getRecoveryToken(token);
            if (!recoveryToken) {
                throw new ApiError('Invalid or expired recovery token', 400, 'INVALID_TOKEN');
            }
            // Delete all passkeys and session keys for this email
            const deletedPasskeys = await this.db.deletePasskeysByEmail(recoveryToken.email);
            const deletedSessionKeys = await this.db.deleteSessionKeysByEmail(recoveryToken.email);
            // Mark token as used
            await this.db.markRecoveryTokenUsed(token);
            res.json({
                success: true,
                data: {
                    email: recoveryToken.email,
                    deletedPasskeys,
                    deletedSessionKeys,
                    message: 'Recovery complete. You can now register a new passkey.'
                }
            });
        }
        catch (error) {
            console.error('Recovery complete error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Failed to complete recovery', 500, 'RECOVERY_COMPLETE_FAILED');
        }
    };
    /**
     * Reset user passkeys (development/testing only)
     * Deletes all passkeys for a user to allow fresh registration
     */
    resetUserPasskeys = async (req, res) => {
        try {
            const { email, confirmReset } = req.body;
            if (!email || confirmReset !== 'DELETE_ALL_PASSKEYS') {
                throw new ApiError('Email and confirmReset are required', 400, 'MISSING_FIELDS');
            }
            const normalizedEmail = email.trim().toLowerCase();
            const user = await this.db.getUserByUsername(normalizedEmail);
            if (!user) {
                return res.json({
                    success: true,
                    data: { deleted: 0, message: 'No user found with this email' }
                });
            }
            // Delete all passkeys for this user
            const deletedPasskeys = await this.db.deletePasskeysByEmail(normalizedEmail);
            const deletedSessionKeys = await this.db.deleteSessionKeysByEmail(normalizedEmail);
            console.log('[PasskeyReset] Deleted passkeys for user:', {
                email: normalizedEmail,
                deletedPasskeys,
                deletedSessionKeys
            });
            return res.json({
                success: true,
                data: {
                    deletedPasskeys,
                    deletedSessionKeys,
                    message: 'All passkeys deleted. You can now register a new passkey.'
                }
            });
        }
        catch (error) {
            console.error('Reset user passkeys error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Failed to reset passkeys', 500, 'RESET_FAILED');
        }
    };
    /**
     * Check if user has registered passkeys
     * Used to skip magic link when user already has passkeys for this email
     */
    checkUserPasskeys = async (req, res) => {
        try {
            const { email } = req.body;
            if (!email) {
                throw new ApiError('Email is required', 400, 'MISSING_EMAIL');
            }
            const normalizedEmail = email.trim().toLowerCase();
            const user = await this.db.getUserByUsername(normalizedEmail);
            if (!user) {
                return res.json({
                    success: true,
                    data: {
                        hasPasskey: false,
                        passkeyCount: 0
                    }
                });
            }
            const passkeys = await this.db.getPasskeysByUserId(user.id);
            return res.json({
                success: true,
                data: {
                    hasPasskey: passkeys.length > 0,
                    passkeyCount: passkeys.length,
                    userId: user.id
                }
            });
        }
        catch (error) {
            console.error('Check user passkeys error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Failed to check user passkeys', 500, 'CHECK_USER_FAILED');
        }
    };
    /**
     * Admin: Manually register a passkey credential for a user
     * This is used for recovery when WebAuthn registration was lost from server
     * but passkey still exists on user's device
     */
    adminRegisterCredential = async (req, res) => {
        try {
            const { adminSecret, email, credentialId, publicKeyX, publicKeyY, walletAddress } = req.body;
            const expectedSecret = process.env.ADMIN_SECRET;
            // SECURITY: Admin secret validation handled by adminAuthMiddleware
            // This is a fallback check - should never reach here without middleware
            if (!expectedSecret || adminSecret !== expectedSecret) {
                throw new ApiError('Invalid admin secret', 403, 'UNAUTHORIZED');
            }
            if (!email || !credentialId || !publicKeyX || !publicKeyY) {
                throw new ApiError('Missing required fields: email, credentialId, publicKeyX, publicKeyY', 400, 'MISSING_FIELDS');
            }
            const normalizedEmail = email.trim().toLowerCase();
            // Get or create user
            let user = await this.db.getUserByUsername(normalizedEmail);
            if (!user) {
                const userId = (await import('crypto')).randomUUID();
                user = await this.db.createUser({
                    id: userId,
                    username: normalizedEmail,
                    displayName: normalizedEmail.split('@')[0]
                });
                console.log('[AdminRegister] Created new user:', user.id);
            }
            // Update wallet address if provided
            if (walletAddress && !user.walletAddress) {
                await this.db.updateUser(user.id, { walletAddress });
                console.log('[AdminRegister] Updated wallet address:', walletAddress);
            }
            // Check if credential already exists
            const existingCredential = await this.db.getPasskeyByCredentialId(credentialId);
            if (existingCredential) {
                return res.json({
                    success: true,
                    data: {
                        message: 'Credential already exists',
                        userId: user.id,
                        credentialId
                    }
                });
            }
            // Create COSE-encoded public key for @simplewebauthn compatibility
            const { XYtoCOSE } = await import('../utils/passkeyUtils.js');
            const publicKeyBuffer = XYtoCOSE(publicKeyX, publicKeyY);
            // Create passkey credential
            await this.db.createPasskeyCredential({
                id: (await import('crypto')).randomUUID(),
                userId: user.id,
                credentialID: credentialId,
                credentialPublicKey: publicKeyBuffer,
                counter: 0,
                credentialDeviceType: 'singleDevice',
                credentialBackedUp: true,
                transports: ['internal', 'hybrid']
            });
            console.log('[AdminRegister] Created passkey credential:', {
                userId: user.id,
                credentialId,
                email: normalizedEmail
            });
            return res.json({
                success: true,
                data: {
                    message: 'Credential registered successfully',
                    userId: user.id,
                    credentialId,
                    walletAddress: walletAddress || user.walletAddress
                }
            });
        }
        catch (error) {
            console.error('Admin register credential error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Failed to register credential', 500, 'ADMIN_REGISTER_FAILED');
        }
    };
    /**
     * Admin endpoint to reset ALL user data (for testing)
     * POST /passkeys/admin/reset-all
     */
    adminResetAll = async (req, res) => {
        try {
            const { adminSecret } = req.body;
            // Verify admin secret
            const expectedSecret = process.env.ADMIN_SECRET;
            if (!expectedSecret || adminSecret !== expectedSecret) {
                throw new ApiError('Invalid admin secret', 403, 'UNAUTHORIZED');
            }
            console.log('[AdminResetAll] Resetting all user data...');
            const result = await this.db.resetAllUserData();
            console.log('[AdminResetAll] Reset complete:', result);
            return res.json({
                success: true,
                data: {
                    message: 'All user data has been reset',
                    deleted: result
                }
            });
        }
        catch (error) {
            console.error('Admin reset all error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Failed to reset data', 500, 'ADMIN_RESET_FAILED');
        }
    };
    /**
     * Admin: Debug passkey data for a user
     * POST /passkeys/admin/debug-passkey
     */
    adminDebugPasskey = async (req, res) => {
        try {
            const { adminSecret, email } = req.body;
            const expectedSecret = process.env.ADMIN_SECRET;
            if (!expectedSecret || adminSecret !== expectedSecret) {
                throw new ApiError('Invalid admin secret', 403, 'UNAUTHORIZED');
            }
            if (!email) {
                throw new ApiError('Email is required', 400, 'MISSING_EMAIL');
            }
            const normalizedEmail = email.trim().toLowerCase();
            const user = await this.db.getUserByUsername(normalizedEmail);
            if (!user) {
                return res.json({
                    success: false,
                    error: 'User not found',
                    data: { email: normalizedEmail }
                });
            }
            const passkeys = await this.db.getPasskeysByUserId(user.id);
            const passkeyData = passkeys.map(pk => {
                const pubKeyHex = Buffer.from(pk.credentialPublicKey).toString('hex');
                let parsedCOSE = null;
                let publicKeyX = null;
                let publicKeyY = null;
                try {
                    // Try to parse COSE and extract X,Y
                    const { COSEECDHAtoXY } = require('../utils/passkeyUtils.js');
                    const [x, y] = COSEECDHAtoXY(pk.credentialPublicKey);
                    publicKeyX = x;
                    publicKeyY = y;
                    parsedCOSE = 'valid';
                }
                catch (e) {
                    parsedCOSE = `error: ${e.message}`;
                }
                return {
                    credentialID: pk.credentialID,
                    counter: pk.counter,
                    deviceType: pk.credentialDeviceType,
                    backedUp: pk.credentialBackedUp,
                    transports: pk.transports,
                    publicKeyLength: pk.credentialPublicKey.length,
                    publicKeyHex: pubKeyHex,
                    parsedCOSE,
                    publicKeyX,
                    publicKeyY
                };
            });
            return res.json({
                success: true,
                data: {
                    user: {
                        id: user.id,
                        username: user.username,
                        walletAddress: user.walletAddress,
                        displayName: user.displayName
                    },
                    passkeys: passkeyData
                }
            });
        }
        catch (error) {
            console.error('Admin debug passkey error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Failed to debug passkey', 500, 'ADMIN_DEBUG_FAILED');
        }
    };
    /**
     * Admin: Update passkey public key
     * POST /passkeys/admin/update-public-key
     */
    adminUpdatePublicKey = async (req, res) => {
        try {
            const { adminSecret, email, credentialId, publicKeyX, publicKeyY } = req.body;
            const expectedSecret = process.env.ADMIN_SECRET;
            if (!expectedSecret || adminSecret !== expectedSecret) {
                throw new ApiError('Invalid admin secret', 403, 'UNAUTHORIZED');
            }
            if (!email || !credentialId || !publicKeyX || !publicKeyY) {
                throw new ApiError('Missing required fields: email, credentialId, publicKeyX, publicKeyY', 400, 'MISSING_FIELDS');
            }
            const normalizedEmail = email.trim().toLowerCase();
            const user = await this.db.getUserByUsername(normalizedEmail);
            if (!user) {
                throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
            }
            // Get existing passkey
            const existingPasskey = await this.db.getPasskeyByCredentialId(credentialId);
            if (!existingPasskey) {
                throw new ApiError('Passkey not found', 404, 'PASSKEY_NOT_FOUND');
            }
            // Create new COSE-encoded public key
            const { XYtoCOSE } = await import('../utils/passkeyUtils.js');
            const newPublicKey = XYtoCOSE(publicKeyX, publicKeyY);
            // Update the public key in database
            await this.db.updatePasskeyPublicKey(credentialId, newPublicKey);
            console.log('[AdminUpdatePublicKey] Updated public key for:', {
                email: normalizedEmail,
                credentialId,
                newKeyLength: newPublicKey.length
            });
            return res.json({
                success: true,
                data: {
                    message: 'Public key updated successfully',
                    credentialId,
                    newPublicKeyLength: newPublicKey.length
                }
            });
        }
        catch (error) {
            console.error('Admin update public key error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Failed to update public key', 500, 'ADMIN_UPDATE_FAILED');
        }
    };
    /**
     * Admin: Recover admin account from config
     * POST /passkeys/admin/recover-account
     * Restores admin user and wallet from adminAccounts.ts config
     */
    adminRecoverAccount = async (req, res) => {
        try {
            const { adminSecret, email } = req.body;
            const expectedSecret = process.env.ADMIN_SECRET;
            if (!expectedSecret || adminSecret !== expectedSecret) {
                throw new ApiError('Invalid admin secret', 403, 'UNAUTHORIZED');
            }
            if (!email) {
                throw new ApiError('Email is required', 400, 'MISSING_EMAIL');
            }
            const normalizedEmail = email.trim().toLowerCase();
            // Check if this is a known admin account
            const adminConfig = getAdminAccount(normalizedEmail);
            if (!adminConfig) {
                throw new ApiError('Not a registered admin account', 404, 'NOT_ADMIN');
            }
            // Check if user already exists
            let user = await this.db.getUserByUsername(normalizedEmail);
            if (user) {
                // Update wallet address if different
                if (user.walletAddress !== adminConfig.walletAddress) {
                    await this.db.updateUser(user.id, { walletAddress: adminConfig.walletAddress });
                    console.log('[AdminRecover] Updated wallet address for existing user:', adminConfig.walletAddress);
                }
            }
            else {
                // Create user with admin config
                const userId = randomUUID();
                user = await this.db.createUser({
                    id: userId,
                    username: normalizedEmail,
                    displayName: normalizedEmail.split('@')[0],
                    walletAddress: adminConfig.walletAddress
                });
                console.log('[AdminRecover] Created admin user:', user.id);
            }
            // Also register the passkey credential if we have the info
            let passkeyRegistered = false;
            if (adminConfig.credentialId && adminConfig.publicKeyX && adminConfig.publicKeyY) {
                // Check if passkey already exists
                const existingPasskeys = await this.db.getPasskeysByUserId(user.id);
                const credentialExists = existingPasskeys.some(p => p.credentialID === adminConfig.credentialId);
                if (!credentialExists) {
                    // Create passkey credential record with COSE-encoded public key
                    // COSE format is required by @simplewebauthn for verification
                    const { XYtoCOSE } = await import('../utils/passkeyUtils.js');
                    const cosePublicKey = XYtoCOSE(adminConfig.publicKeyX, adminConfig.publicKeyY);
                    const passkeyId = randomUUID();
                    await this.db.createPasskeyCredential({
                        id: passkeyId,
                        credentialID: adminConfig.credentialId,
                        userId: user.id,
                        credentialPublicKey: cosePublicKey,
                        counter: 0,
                        credentialDeviceType: 'multiDevice',
                        credentialBackedUp: true,
                        transports: ['internal']
                    });
                    console.log('[AdminRecover] Registered passkey credential with COSE format:', adminConfig.credentialId);
                    passkeyRegistered = true;
                }
                else {
                    console.log('[AdminRecover] Passkey already exists, skipping');
                }
            }
            return res.json({
                success: true,
                data: {
                    message: 'Admin account recovered successfully',
                    email: normalizedEmail,
                    walletAddress: adminConfig.walletAddress,
                    userId: user.id,
                    passkeyRegistered,
                    notes: adminConfig.notes
                }
            });
        }
        catch (error) {
            console.error('Admin recover account error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Failed to recover admin account', 500, 'ADMIN_RECOVER_FAILED');
        }
    };
    /**
     * Admin: Get admin account info
     * POST /passkeys/admin/get-account-info
     */
    adminGetAccountInfo = async (req, res) => {
        try {
            const { adminSecret, email } = req.body;
            const expectedSecret = process.env.ADMIN_SECRET;
            if (!expectedSecret || adminSecret !== expectedSecret) {
                throw new ApiError('Invalid admin secret', 403, 'UNAUTHORIZED');
            }
            if (!email) {
                throw new ApiError('Email is required', 400, 'MISSING_EMAIL');
            }
            const normalizedEmail = email.trim().toLowerCase();
            const adminConfig = getAdminAccount(normalizedEmail);
            if (!adminConfig) {
                return res.json({
                    success: false,
                    error: 'Not a registered admin account',
                    isAdmin: false
                });
            }
            // Get user from database
            const user = await this.db.getUserByUsername(normalizedEmail);
            const passkeys = user ? await this.db.getPasskeysByUserId(user.id) : [];
            return res.json({
                success: true,
                data: {
                    isAdmin: true,
                    config: {
                        email: adminConfig.email,
                        walletAddress: adminConfig.walletAddress,
                        notes: adminConfig.notes
                    },
                    database: user ? {
                        userId: user.id,
                        walletAddress: user.walletAddress,
                        hasPasskey: passkeys.length > 0,
                        passkeyCount: passkeys.length
                    } : null
                }
            });
        }
        catch (error) {
            console.error('Admin get account info error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Failed to get account info', 500, 'ADMIN_INFO_FAILED');
        }
    };
    /**
     * Admin: Update wallet address for a user
     * POST /passkeys/admin/update-wallet-address
     * Used for recovery when user's wallet address in database is incorrect
     */
    adminUpdateWalletAddress = async (req, res) => {
        try {
            const { adminSecret, email, walletAddress } = req.body;
            const expectedSecret = process.env.ADMIN_SECRET;
            if (!expectedSecret || adminSecret !== expectedSecret) {
                throw new ApiError('Invalid admin secret', 403, 'UNAUTHORIZED');
            }
            if (!email || !walletAddress) {
                throw new ApiError('Missing required fields: email, walletAddress', 400, 'MISSING_FIELDS');
            }
            // Validate wallet address format
            if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
                throw new ApiError('Invalid wallet address format', 400, 'INVALID_ADDRESS');
            }
            const normalizedEmail = email.trim().toLowerCase();
            const user = await this.db.getUserByUsername(normalizedEmail);
            if (!user) {
                throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
            }
            const oldWalletAddress = user.walletAddress;
            // Update wallet address
            await this.db.updateUser(user.id, { walletAddress });
            console.log('[AdminUpdateWalletAddress] Updated wallet address:', {
                email: normalizedEmail,
                oldWalletAddress,
                newWalletAddress: walletAddress
            });
            return res.json({
                success: true,
                data: {
                    message: 'Wallet address updated successfully',
                    email: normalizedEmail,
                    oldWalletAddress,
                    newWalletAddress: walletAddress
                }
            });
        }
        catch (error) {
            console.error('Admin update wallet address error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Failed to update wallet address', 500, 'ADMIN_UPDATE_WALLET_FAILED');
        }
    };
    /**
     * Admin: Start passkey linking process
     * POST /passkeys/admin/link-passkey/start
     * Uses discoverable credentials to allow any passkey to be selected
     */
    adminLinkPasskeyStart = async (req, res) => {
        try {
            const { adminSecret, email } = req.body;
            const expectedSecret = process.env.ADMIN_SECRET;
            if (!expectedSecret || adminSecret !== expectedSecret) {
                throw new ApiError('Invalid admin secret', 403, 'UNAUTHORIZED');
            }
            if (!email) {
                throw new ApiError('Email is required', 400, 'MISSING_EMAIL');
            }
            const normalizedEmail = email.trim().toLowerCase();
            // Check if this is an admin account
            if (!isAdminEmail(normalizedEmail)) {
                throw new ApiError('Not a registered admin account', 403, 'NOT_ADMIN');
            }
            // Generate authentication options with NO allowCredentials
            // This enables discoverable credential mode - user can pick any passkey
            const options = await generateAuthenticationOptions({
                rpID: this.config.RP_ID,
                userVerification: 'preferred',
                // Empty allowCredentials = discoverable credential mode
                allowCredentials: [],
            });
            // Store challenge for verification
            const challengeId = randomUUID();
            await this.db.createChallenge({
                id: challengeId,
                challenge: options.challenge,
                userId: normalizedEmail, // Use email as userId temporarily
                type: 'authentication',
                expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
            });
            console.log('[AdminLinkPasskey] Started for:', normalizedEmail);
            return res.json({
                success: true,
                data: {
                    options,
                    message: 'Select any passkey from your device'
                }
            });
        }
        catch (error) {
            console.error('Admin link passkey start error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Failed to start passkey linking', 500, 'ADMIN_LINK_START_FAILED');
        }
    };
    /**
     * Admin: Finish passkey linking process
     * POST /passkeys/admin/link-passkey/finish
     * Captures credential ID and public key, registers it for the admin user
     */
    adminLinkPasskeyFinish = async (req, res) => {
        try {
            const { adminSecret, email, credential } = req.body;
            const expectedSecret = process.env.ADMIN_SECRET;
            if (!expectedSecret || adminSecret !== expectedSecret) {
                throw new ApiError('Invalid admin secret', 403, 'UNAUTHORIZED');
            }
            if (!email || !credential) {
                throw new ApiError('Email and credential are required', 400, 'MISSING_FIELDS');
            }
            const normalizedEmail = email.trim().toLowerCase();
            // Check if this is an admin account
            const adminConfig = getAdminAccount(normalizedEmail);
            if (!adminConfig) {
                throw new ApiError('Not a registered admin account', 403, 'NOT_ADMIN');
            }
            // Get user
            let user = await this.db.getUserByUsername(normalizedEmail);
            if (!user) {
                // Create user if not exists
                const userId = randomUUID();
                user = await this.db.createUser({
                    id: userId,
                    username: normalizedEmail,
                    displayName: normalizedEmail.split('@')[0],
                    walletAddress: adminConfig.walletAddress
                });
            }
            // Get stored challenge - using latest authentication challenge
            const storedChallenge = await this.db.getLatestChallengeByType('authentication');
            if (!storedChallenge) {
                throw new ApiError('Challenge not found or expired', 400, 'CHALLENGE_NOT_FOUND');
            }
            // Extract credential ID from the response
            const credentialId = credential.id;
            // Get public key from authenticator data
            // For discoverable credentials, we need to extract from response
            const clientDataJSON = credential.response?.clientDataJSON;
            const authenticatorData = credential.response?.authenticatorData;
            const signature = credential.response?.signature;
            console.log('[AdminLinkPasskey] Credential received:', {
                credentialId,
                hasClientData: !!clientDataJSON,
                hasAuthData: !!authenticatorData,
                hasSignature: !!signature
            });
            // Since we're linking an existing passkey (not verifying a specific one),
            // we'll use the admin config's public key coordinates
            // The credential ID is what we need to capture
            // Check if passkey already exists
            const existingPasskey = await this.db.getPasskeyByCredentialId(credentialId);
            if (existingPasskey) {
                if (existingPasskey.userId === user.id) {
                    return res.json({
                        success: true,
                        data: {
                            message: 'Passkey already linked to this account',
                            credentialId,
                            walletAddress: adminConfig.walletAddress
                        }
                    });
                }
                else {
                    throw new ApiError('Passkey is registered to a different account', 400, 'PASSKEY_ALREADY_REGISTERED');
                }
            }
            // Register the passkey with admin config's public key
            // Convert X,Y coordinates to COSE-encoded public key (required by @simplewebauthn)
            const { XYtoCOSE } = await import('../utils/passkeyUtils.js');
            const cosePublicKey = XYtoCOSE(adminConfig.publicKeyX, adminConfig.publicKeyY);
            await this.db.createPasskeyCredential({
                id: randomUUID(),
                credentialID: credentialId,
                userId: user.id,
                credentialPublicKey: cosePublicKey,
                counter: 0,
                credentialDeviceType: 'multiDevice',
                credentialBackedUp: true,
                transports: ['internal']
            });
            // Clear challenge
            await this.db.deleteChallenge(storedChallenge.id);
            console.log('[AdminLinkPasskey] Successfully linked passkey for:', normalizedEmail);
            return res.json({
                success: true,
                data: {
                    message: 'Passkey successfully linked to admin account',
                    credentialId,
                    walletAddress: adminConfig.walletAddress,
                    publicKeyX: adminConfig.publicKeyX,
                    publicKeyY: adminConfig.publicKeyY
                }
            });
        }
        catch (error) {
            console.error('Admin link passkey finish error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Failed to link passkey', 500, 'ADMIN_LINK_FINISH_FAILED');
        }
    };
}
//# sourceMappingURL=PasskeyController.js.map