import { Request, Response } from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';
import {
  RegistrationResponseJSON,
  AuthenticationResponseJSON
} from '@simplewebauthn/types';
import { randomUUID } from 'crypto';
import { Database } from '../models/Database.js';
import { SessionKeyManager } from '../utils/SessionKeyManager.js';
import { MagicSessionStore } from '../magicLink/SessionStore.js';
import {
  ApiError,
  RegistrationStartRequest,
  RegistrationFinishRequest,
  AuthenticationStartRequest,
  AuthenticationFinishRequest,
  EnvConfig,
  SessionKey
} from '../types/index.js';

// Session cookie configuration (same as circleOtp.ts)
const SESSION_COOKIE_NAME = 'arcwallet_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const COOKIE_BASE_OPTIONS = (isProd: boolean) => ({
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' as const : 'lax' as const,
  maxAge: SESSION_TTL_MS,
  path: '/',
});

const normalizeUsername = (value: string) => value.trim().toLowerCase();

const serializeSessionKey = (sessionKey: SessionKey) => ({
  privateKey: sessionKey.privateKey,
  address: sessionKey.address,
  expiresAt: sessionKey.expiresAt instanceof Date
    ? sessionKey.expiresAt.toISOString()
    : new Date(sessionKey.expiresAt).toISOString()
});

const decodeClientDataJSON = (clientData: string): Record<string, any> => {
  const base64 = clientData.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  const buffer = Buffer.from(padded, 'base64');
  try {
    return JSON.parse(buffer.toString('utf-8'));
  } catch (error) {
    throw new ApiError('Invalid client data JSON', 400, 'INVALID_CHALLENGE');
  }
};

const extractChallengeFromCredential = (clientDataJSON: string): string => {
  const clientData = decodeClientDataJSON(clientDataJSON);
  const challenge = clientData?.challenge;
  if (typeof challenge !== 'string' || challenge.length === 0) {
    throw new ApiError('Challenge not found in credential', 400, 'INVALID_CHALLENGE');
  }
  return challenge;
};

export class PasskeyController {
  private db: Database;
  private sessionKeyManager: SessionKeyManager;
  private config: EnvConfig;
  private sessionStore?: MagicSessionStore;

  constructor(db: Database, config: EnvConfig, sessionStore?: MagicSessionStore) {
    this.db = db;
    this.sessionKeyManager = new SessionKeyManager(db);
    this.config = config;
    this.sessionStore = sessionStore;
  }

  /**
   * Start passkey registration
   */
  registrationStart = async (req: Request, res: Response) => {
    try {
      const { username, displayName }: RegistrationStartRequest = req.body;
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
          throw new ApiError(
            'You already have a passkey registered. Creating a new passkey would generate a new wallet address and you would lose access to your existing funds. Use your existing passkey to login.',
            400,
            'PASSKEY_ALREADY_EXISTS'
          );
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

      } else {
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

    } catch (error) {
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
  registrationFinish = async (req: Request, res: Response) => {
    try {
      const { username, credential }: RegistrationFinishRequest = req.body;

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
      } catch (verifyError: any) {
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
      const sessionKey = await this.sessionKeyManager.generateSessionKey(user.id, 24); // 24 hours

      // Extract P256 public key coordinates for smart contract wallet
      let publicKeyX: string | undefined;
      let publicKeyY: string | undefined;
      if (verification.registrationInfo?.credentialPublicKey) {
        try {
          const { COSEECDHAtoXY } = await import('../utils/passkeyUtils.js');
          const [x, y] = COSEECDHAtoXY(verification.registrationInfo.credentialPublicKey);
          publicKeyX = x;
          publicKeyY = y;
        } catch (e) {
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

    } catch (error) {
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
  authenticationStart = async (req: Request, res: Response) => {
    try {
      const { username }: AuthenticationStartRequest = req.body;

      let allowCredentials = undefined;
      const normalizedUsername = username?.trim() ? normalizeUsername(username) : undefined;

      // If username is provided, get user's credentials
      if (normalizedUsername) {
        const user = await this.db.getUserByUsername(normalizedUsername);
        if (!user) {
          throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
        }

        const userPasskeys = await this.db.getPasskeysByUserId(user.id);
        allowCredentials = userPasskeys.map(passkey => ({
          id: passkey.credentialID,
          transports: ['internal'] as any
        }));
      }

      // Generate authentication options
      const options = await generateAuthenticationOptions({
        rpID: this.config.RP_ID,
        allowCredentials,
        userVerification: 'required',
        timeout: 60000 // 60 seconds timeout
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

    } catch (error) {
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
  authenticationFinish = async (req: Request, res: Response) => {
    try {
      const { credential }: AuthenticationFinishRequest = req.body;

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
        await this.db.updatePasskeyCounter(
          passkeyCredential.credentialID,
          verification.authenticationInfo.newCounter
        );
      }

      // Reuse latest active session key if available, otherwise generate a new one
      let sessionKey = await this.sessionKeyManager.getLatestSessionKey(user.id);
      if (!sessionKey || sessionKey.expiresAt <= new Date()) {
        sessionKey = await this.sessionKeyManager.generateSessionKey(user.id, 24); // 24 hours
      }

      // Clean up challenge
      await this.db.deleteChallenge(challenge.id);

      // Extract P256 public key coordinates for smart contract wallet
      let publicKeyX: string | undefined;
      let publicKeyY: string | undefined;
      if (passkeyCredential.credentialPublicKey) {
        try {
          const { COSEECDHAtoXY } = await import('../utils/passkeyUtils.js');
          const [x, y] = COSEECDHAtoXY(passkeyCredential.credentialPublicKey);
          publicKeyX = x;
          publicKeyY = y;
        } catch (e) {
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

    } catch (error) {
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
  getSessionKeys = async (req: Request, res: Response) => {
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

    } catch (error) {
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
  revokeSessionKey = async (req: Request, res: Response, authUserId?: string) => {
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

    } catch (error) {
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
  getDevices = async (req: Request, res: Response) => {
    try {
      const { userId } = req.params as { userId?: string };
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
    } catch (error) {
      console.error('Get devices error:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to list devices', 500, 'GET_DEVICES_FAILED');
    }
  };

  /**
   * Delete a passkey device (credential) by internal id
   */
  deleteDevice = async (req: Request, res: Response, authUserId?: string) => {
    try {
      const { credentialId } = req.params as { credentialId?: string };
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
      const dbAny = this.db as any;
      const { promisify } = await import('util');
      await dbAny.waitForReady();
      const run = promisify(dbAny.db.run.bind(dbAny.db));
      await run('DELETE FROM passkey_credentials WHERE id = ?', [passkey.id]);

      res.json({ success: true, message: 'Device removed' });
    } catch (error) {
      console.error('Delete device error:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to delete device', 500, 'DELETE_DEVICE_FAILED');
    }
  };

  /**
   * Health check endpoint
   */
  healthCheck = async (req: Request, res: Response) => {
    try {
      // Test database connection
      await this.db.waitForReady();

      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'passkey-service'
      });

    } catch (error) {
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
  private async getAllChallenges() {
    const db = this.db as any;
    await db.waitForReady();
    const { promisify } = await import('util');
    const all = promisify(db.db.all.bind(db.db));

    const rows = await all(
      'SELECT * FROM webauthn_challenges WHERE expires_at > ? ORDER BY created_at DESC',
      [new Date().toISOString()]
    );

    return rows.map((row: any) => ({
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
  recoveryStart = async (req: Request, res: Response) => {
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

    } catch (error) {
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
  recoveryVerify = async (req: Request, res: Response) => {
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

    } catch (error) {
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
  recoveryComplete = async (req: Request, res: Response) => {
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

    } catch (error) {
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
  resetUserPasskeys = async (req: Request, res: Response) => {
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

    } catch (error) {
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
  checkUserPasskeys = async (req: Request, res: Response) => {
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

    } catch (error) {
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
  adminRegisterCredential = async (req: Request, res: Response) => {
    try {
      const { adminSecret, email, credentialId, publicKeyX, publicKeyY, walletAddress } = req.body;
      const expectedSecret = process.env.ADMIN_SECRET || 'arc-admin-2024-secret';

      if (adminSecret !== expectedSecret) {
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

    } catch (error) {
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
  adminResetAll = async (req: Request, res: Response) => {
    try {
      const { adminSecret } = req.body;

      // Verify admin secret
      const expectedSecret = process.env.ADMIN_SECRET || 'arc-wallet-admin-2024';
      if (adminSecret !== expectedSecret) {
        throw new ApiError('Invalid admin secret', 401, 'UNAUTHORIZED');
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

    } catch (error) {
      console.error('Admin reset all error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to reset data', 500, 'ADMIN_RESET_FAILED');
    }
  };
}