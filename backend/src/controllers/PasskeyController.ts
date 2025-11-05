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
import {
  ApiError,
  RegistrationStartRequest,
  RegistrationFinishRequest,
  AuthenticationStartRequest,
  AuthenticationFinishRequest,
  EnvConfig
} from '../types/index.js';

export class PasskeyController {
  private db: Database;
  private sessionKeyManager: SessionKeyManager;
  private config: EnvConfig;

  constructor(db: Database, config: EnvConfig) {
    this.db = db;
    this.sessionKeyManager = new SessionKeyManager(db);
    this.config = config;
  }

  /**
   * Start passkey registration
   */
  registrationStart = async (req: Request, res: Response) => {
    try {
      const { username, displayName }: RegistrationStartRequest = req.body;

      if (!username || !displayName) {
        throw new ApiError('Username and display name are required', 400, 'MISSING_FIELDS');
      }

      // Check if user already exists
      const existingUser = await this.db.getUserByUsername(username);

      let options;
      if (existingUser) {
        // Existing user: allow adding another passkey, exclude current credentials
        const userPasskeys = await this.db.getPasskeysByUserId(existingUser.id);
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
          excludeCredentials: userPasskeys.map(pk => ({ id: pk.credentialID, transports: pk.transports })),
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
          userName: username,
          userDisplayName: displayName,
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

      // Verify the challenge exists and is valid (latest unexpired registration challenge)
      const challengeRecord = await this.db.getLatestChallengeByType('registration');
      if (!challengeRecord) {
        throw new ApiError('Invalid or expired challenge', 400, 'INVALID_CHALLENGE');
      }

      // Debug: Log incoming credential
      console.log('🔍 Registration Credential:', {
        id: credential.id?.substring(0, 30),
        rawId: (credential as any).rawId?.substring(0, 30),
        idLength: credential.id?.length,
        rawIdLength: (credential as any).rawId?.length
      });

      // Verify registration response
      const verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: this.config.ORIGIN,
        expectedRPID: this.config.RP_ID,
        requireUserVerification: true
      });

      if (!verification.verified) {
        throw new ApiError('Registration verification failed', 400, 'VERIFICATION_FAILED');
      }

      // Create user if not exists; otherwise use existing
      let user = await this.db.getUserByUsername(username);
      if (!user) {
        const userId = randomUUID();
        user = await this.db.createUser({
          id: userId,
          username,
          displayName: username
        });
      }

      // Store passkey credential
      // IMPORTANT: Use credential.rawId directly (already base64url encoded)
      // DO NOT encode again - verification.registrationInfo.credentialID is Uint8Array
      if (verification.registrationInfo) {
        // Use frontend's rawId directly - it's already base64url encoded
        const credentialIdB64Url = (credential as any).rawId || credential.id;

        console.log('✅ Saving Credential ID:', {
          frontendRawId: (credential as any).rawId,
          usingId: credentialIdB64Url,
          length: credentialIdB64Url?.length
        });

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

      res.json({
        success: true,
        data: {
          sessionKey: {
            privateKey: sessionKey.privateKey,
            address: sessionKey.address,
            expiresAt: sessionKey.expiresAt.toISOString()
          },
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName
          }
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

      // If username is provided, get user's credentials
      if (username) {
        const user = await this.db.getUserByUsername(username);
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
        userVerification: 'required'
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

      console.log('🔍 Full Credential Object:', JSON.stringify(credential, null, 2));

      // Get passkey credential from database
      // Use rawId (base64url) instead of id (base64) to match database format
      const credentialId = credential.rawId || credential.id;
      console.log('🔍 Authentication Debug:', {
        credentialId: credentialId?.substring(0, 50),
        hasRawId: !!credential.rawId,
        hasId: !!credential.id,
        rawIdLength: credential.rawId?.length,
        idLength: credential.id?.length
      });
      const passkeyCredential = await this.db.getPasskeyByCredentialId(credentialId);
      if (!passkeyCredential) {
        console.error('❌ Passkey not found in database. Searched for:', credentialId?.substring(0, 30) + '...');
        // List all credentials in database for debugging
        const dbAny = this.db as any;
        await dbAny.waitForReady();
        const { promisify } = await import('util');
        const all = promisify(dbAny.db.all.bind(dbAny.db));
        const allCreds = await all('SELECT credential_id FROM passkey_credentials LIMIT 5');
        console.error('📋 Available credentials in DB:', allCreds.map((c: any) => c.credential_id.substring(0, 30) + '...'));
        throw new ApiError('Passkey not found', 404, 'PASSKEY_NOT_FOUND');
      }
      console.log('✅ Passkey found for user:', passkeyCredential.userId);

      // Get user
      const user = await this.db.getUserById(passkeyCredential.userId);
      if (!user) {
        throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Find latest active authentication challenge
      const challenge = await this.db.getLatestChallengeByType('authentication');

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

      res.json({
        success: true,
        data: {
          sessionKey: {
            privateKey: sessionKey.privateKey,
            address: sessionKey.address,
            expiresAt: sessionKey.expiresAt.toISOString()
          },
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName
          }
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
  revokeSessionKey = async (req: Request, res: Response) => {
    try {
      const { sessionKeyId } = req.params;

      if (!sessionKeyId) {
        throw new ApiError('Session key ID is required', 400, 'MISSING_SESSION_KEY_ID');
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
  deleteDevice = async (req: Request, res: Response) => {
    try {
      const { credentialId } = req.params as { credentialId?: string };
      if (!credentialId) {
        throw new ApiError('Credential id is required', 400, 'MISSING_CREDENTIAL_ID');
      }
      // Simple delete: rely on FK to cascade; we only allow delete by our row id
      const dbAny = this.db as any;
      const { promisify } = await import('util');
      await dbAny.waitForReady();
      const run = promisify(dbAny.db.run.bind(dbAny.db));
      await run('DELETE FROM passkey_credentials WHERE id = ?', [credentialId]);
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
}