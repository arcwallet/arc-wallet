import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import {
  User,
  PasskeyCredential,
  SessionKey,
  WebAuthnChallenge,
  BridgeTransaction,
  MultiSigAccount,
  MultiSigMember,
  MultiSigTransaction,
  MultiSigSignature,
  OAuthAccount,
  OAuthState
} from '../types/index.js';
import { encryptPrivateKey, decryptPrivateKey } from '../utils/encryption.js';

type RunResult = sqlite3.RunResult;

export class Database {
  private db: sqlite3.Database;
  private ready: Promise<void>;
  private encryptionKey: string;

  constructor(dbPath: string, encryptionKey?: string) {
    // Use provided key or fall back to environment variable
    this.encryptionKey = encryptionKey || process.env.DB_ENCRYPTION_KEY || '';

    if (!this.encryptionKey) {
      console.warn('⚠️ WARNING: DB_ENCRYPTION_KEY not set. Private keys will be stored unencrypted!');
    }

    // Ensure directory exists with fallback
    const dir = path.dirname(dbPath);
    let actualDbPath = dbPath;

    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (error) {
      console.warn(`⚠️ Cannot create directory ${dir}, falling back to project data directory`);
      const fallbackPath = path.join(process.cwd(), 'data', 'wallet.db');
      const fallbackDir = path.dirname(fallbackPath);
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
      }
      actualDbPath = fallbackPath;
    }

    console.log(`📁 Main database path: ${actualDbPath}`);

    this.db = new sqlite3.Database(actualDbPath);
    this.ready = this.initialize();
  }

  private async initialize(): Promise<void> {
    const run: any = promisify(this.db.run.bind(this.db));

    // Enable foreign keys
    await run('PRAGMA foreign_keys = ON');

    // Create tables
    await this.createTables();
  }

  private async createTables(): Promise<void> {
    const run: any = promisify(this.db.run.bind(this.db));

    // Users table
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        wallet_address TEXT,
        encrypted_wallet TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: Add encrypted_wallet column if it doesn't exist
    try {
      await run('ALTER TABLE users ADD COLUMN encrypted_wallet TEXT');
    } catch (error) {
      // Ignore error if column already exists
    }

    // Passkey credentials table
    await run(`
      CREATE TABLE IF NOT EXISTS passkey_credentials (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        credential_id TEXT UNIQUE NOT NULL,
        credential_public_key BLOB NOT NULL,
        counter INTEGER NOT NULL DEFAULT 0,
        credential_device_type TEXT NOT NULL,
        credential_backed_up BOOLEAN NOT NULL DEFAULT 0,
        transports TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Session keys table
    await run(`
      CREATE TABLE IF NOT EXISTS session_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        private_key TEXT NOT NULL,
        private_key_iv TEXT,
        address TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Migration: Add private_key_iv column if it doesn't exist
    try {
      await run('ALTER TABLE session_keys ADD COLUMN private_key_iv TEXT');
    } catch (error) {
      // Ignore error if column already exists
    }

    // WebAuthn challenges table
    await run(`
      CREATE TABLE IF NOT EXISTS webauthn_challenges (
        id TEXT PRIMARY KEY,
        challenge TEXT NOT NULL,
        user_id TEXT,
        type TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Bridge transactions table
    await run(`
      CREATE TABLE IF NOT EXISTS bridge_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        session_key_address TEXT NOT NULL,
        amount TEXT NOT NULL,
        direction TEXT NOT NULL,
        token TEXT NOT NULL,
        status TEXT NOT NULL,
        source_tx_hash TEXT,
        destination_tx_hash TEXT,
        attestation TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Recovery tokens table
    await run(`
      CREATE TABLE IF NOT EXISTS recovery_tokens (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        used BOOLEAN NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Used tokens for one-time magic links
    await run(`
      CREATE TABLE IF NOT EXISTS used_tokens (
        token_hash TEXT PRIMARY KEY,
        used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL
      )
    `);

    // Multi-sig accounts table
    await run(`
      CREATE TABLE IF NOT EXISTS multi_sig_accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT UNIQUE,
        required_signatures INT NOT NULL,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id)
      )
    `);

    // Multi-sig members table
    await run(`
      CREATE TABLE IF NOT EXISTS multi_sig_members (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'signer',
        status TEXT NOT NULL DEFAULT 'pending',
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES multi_sig_accounts (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Multi-sig transactions table
    await run(`
      CREATE TABLE IF NOT EXISTS multi_sig_transactions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        submitter_id TEXT NOT NULL,
        target_address TEXT NOT NULL,
        value TEXT NOT NULL,
        token_address TEXT,
        token_symbol TEXT DEFAULT 'ETH',
        data TEXT,
        description TEXT,
        status TEXT DEFAULT 'pending',
        tx_hash TEXT,
        on_chain_tx_id INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY (account_id) REFERENCES multi_sig_accounts (id) ON DELETE CASCADE,
        FOREIGN KEY (submitter_id) REFERENCES users (id)
      )
    `);

    // Multi-sig signatures table
    await run(`
      CREATE TABLE IF NOT EXISTS multi_sig_signatures (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL,
        signer_id TEXT NOT NULL,
        signer_address TEXT NOT NULL,
        status TEXT DEFAULT 'approved',
        signed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transaction_id) REFERENCES multi_sig_transactions (id) ON DELETE CASCADE,
        FOREIGN KEY (signer_id) REFERENCES users (id)
      )
    `);

    // OAuth accounts table
    await run(`
      CREATE TABLE IF NOT EXISTS oauth_accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        email TEXT,
        name TEXT,
        picture TEXT,
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(provider, provider_id)
      )
    `);

    // OAuth state tokens (for CSRF protection)
    await run(`
      CREATE TABLE IF NOT EXISTS oauth_states (
        state TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        redirect_url TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);

    // Token metadata cache table
    await run(`
      CREATE TABLE IF NOT EXISTS token_metadata (
        address TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        decimals INTEGER NOT NULL,
        chain_id INTEGER DEFAULT 1,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Wallet backups table (for multi-device support)
    await run(`
      CREATE TABLE IF NOT EXISTS wallet_backups (
        email TEXT PRIMARY KEY,
        encrypted_wallet TEXT NOT NULL,
        device_id TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await run('CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)');
    await run('CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON passkey_credentials (user_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_passkeys_credential_id ON passkey_credentials (credential_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_session_keys_user_id ON session_keys (user_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_session_keys_expires ON session_keys (expires_at)');
    await run('CREATE INDEX IF NOT EXISTS idx_session_keys_address ON session_keys (address)');
    await run('CREATE INDEX IF NOT EXISTS idx_challenges_expires ON webauthn_challenges (expires_at)');
    await run('CREATE INDEX IF NOT EXISTS idx_bridge_transactions_user_id ON bridge_transactions (user_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_bridge_transactions_status ON bridge_transactions (status)');
    await run('CREATE INDEX IF NOT EXISTS idx_recovery_tokens_email ON recovery_tokens (email)');
    await run('CREATE INDEX IF NOT EXISTS idx_recovery_tokens_token ON recovery_tokens (token)');
    await run('CREATE INDEX IF NOT EXISTS idx_multi_sig_accounts_created_by ON multi_sig_accounts (created_by)');
    await run('CREATE INDEX IF NOT EXISTS idx_multi_sig_members_account ON multi_sig_members (account_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_multi_sig_members_user ON multi_sig_members (user_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_multi_sig_transactions_account ON multi_sig_transactions (account_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_multi_sig_transactions_status ON multi_sig_transactions (status)');
    await run('CREATE INDEX IF NOT EXISTS idx_multi_sig_signatures_transaction ON multi_sig_signatures (transaction_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_token_metadata_address ON token_metadata (address)');
    await run('CREATE INDEX IF NOT EXISTS idx_token_metadata_chain ON token_metadata (chain_id)');
  }

  async waitForReady(): Promise<void> {
    await this.ready;
  }

  // User operations
  async createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));
    const get: any = promisify(this.db.get.bind(this.db));

    const now = new Date();
    await run(
      `INSERT INTO users (id, username, display_name, wallet_address, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user.id, user.username, user.displayName, user.walletAddress, now.toISOString(), now.toISOString()]
    );

    const created = await get('SELECT * FROM users WHERE id = ?', [user.id]);
    return this.mapUser(created);
  }

  async getUserById(id: string): Promise<User | null> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));
    const result = await get('SELECT * FROM users WHERE id = ?', [id]);
    if (!result) return null;

    return {
      id: result.id,
      username: result.username,
      displayName: result.display_name,
      walletAddress: result.wallet_address,
      encryptedWallet: result.encrypted_wallet,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at)
    };
  }

  async getUserByUsername(username: string): Promise<User | null> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));
    const result = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!result) return null;

    return {
      id: result.id,
      username: result.username,
      displayName: result.display_name,
      walletAddress: result.wallet_address,
      encryptedWallet: result.encrypted_wallet,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at)
    };
  }

  async updateEncryptedWallet(userId: string, encryptedWallet: string): Promise<void> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));
    await run(
      'UPDATE users SET encrypted_wallet = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [encryptedWallet, userId]
    );
  }

  async getEncryptedWallet(userId: string): Promise<string | null> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));
    const result = await get('SELECT encrypted_wallet FROM users WHERE id = ?', [userId]);
    return result ? result.encrypted_wallet : null;
  }

  async updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<User | null> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));
    const get: any = promisify(this.db.get.bind(this.db));

    const fields = [];
    const values = [];

    if (updates.username !== undefined) {
      fields.push('username = ?');
      values.push(updates.username);
    }
    if (updates.displayName !== undefined) {
      fields.push('display_name = ?');
      values.push(updates.displayName);
    }
    if (updates.walletAddress !== undefined) {
      fields.push('wallet_address = ?');
      values.push(updates.walletAddress);
    }

    if (fields.length === 0) return this.getUserById(id);

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await run(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.getUserById(id);
  }

  // Passkey operations
  async createPasskeyCredential(credential: Omit<PasskeyCredential, 'createdAt'>): Promise<PasskeyCredential> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));
    const get: any = promisify(this.db.get.bind(this.db));

    const now = new Date();
    await run(
      `INSERT INTO passkey_credentials
       (id, user_id, credential_id, credential_public_key, counter,
        credential_device_type, credential_backed_up, transports, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        credential.id,
        credential.userId,
        credential.credentialID,
        Buffer.from(credential.credentialPublicKey),
        credential.counter,
        credential.credentialDeviceType,
        credential.credentialBackedUp ? 1 : 0,
        credential.transports ? JSON.stringify(credential.transports) : null,
        now.toISOString()
      ]
    );

    const created = await get('SELECT * FROM passkey_credentials WHERE id = ?', [credential.id]);
    return this.mapPasskeyCredential(created);
  }

  async getPasskeysByUserId(userId: string): Promise<PasskeyCredential[]> {
    await this.waitForReady();
    const all: any = promisify(this.db.all.bind(this.db));

    const credentials = await all('SELECT * FROM passkey_credentials WHERE user_id = ?', [userId]);
    return credentials.map((c: any) => this.mapPasskeyCredential(c));
  }

  async getPasskeyByCredentialId(credentialId: string): Promise<PasskeyCredential | null> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));

    const credential = await get('SELECT * FROM passkey_credentials WHERE credential_id = ?', [credentialId]);
    return credential ? this.mapPasskeyCredential(credential) : null;
  }

  async updatePasskeyCounter(credentialId: string, counter: number): Promise<void> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));

    await run(
      'UPDATE passkey_credentials SET counter = ? WHERE credential_id = ?',
      [counter, credentialId]
    );
  }

  // Session key operations
  async createSessionKey(sessionKey: Omit<SessionKey, 'createdAt'>): Promise<SessionKey> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));
    const get: any = promisify(this.db.get.bind(this.db));

    if (!this.encryptionKey) {
      throw new Error('DB_ENCRYPTION_KEY must be set to encrypt session keys.');
    }

    const { encrypted, iv } = encryptPrivateKey(sessionKey.privateKey);

    const now = new Date();
    await run(
      `INSERT INTO session_keys (id, user_id, private_key, private_key_iv, address, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionKey.id,
        sessionKey.userId,
        encrypted,
        iv,
        sessionKey.address,
        sessionKey.expiresAt.toISOString(),
        now.toISOString()
      ]
    );

    const created = await get('SELECT * FROM session_keys WHERE id = ?', [sessionKey.id]);
    return this.mapSessionKey(created);
  }

  async getActiveSessionKeysByUserId(userId: string): Promise<SessionKey[]> {
    await this.waitForReady();
    const all: any = promisify(this.db.all.bind(this.db));

    const sessionKeys = await all(
      'SELECT * FROM session_keys WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC',
      [userId, new Date().toISOString()]
    );
    return sessionKeys.map((k: any) => this.mapSessionKey(k));
  }

  async getActiveSessionKeyByAddress(address: string): Promise<SessionKey | null> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));

    const sessionKey = await get(
      'SELECT * FROM session_keys WHERE LOWER(address) = LOWER(?) AND expires_at > ? ORDER BY created_at DESC LIMIT 1',
      [address, new Date().toISOString()]
    );
    return sessionKey ? this.mapSessionKey(sessionKey) : null;
  }

  async getSessionKeyById(id: string): Promise<SessionKey | null> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));

    const sessionKey = await get('SELECT * FROM session_keys WHERE id = ?', [id]);
    return sessionKey ? this.mapSessionKey(sessionKey) : null;
  }

  async revokeSessionKey(id: string): Promise<void> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));

    await run('DELETE FROM session_keys WHERE id = ?', [id]);
  }

  async cleanupExpiredSessionKeys(): Promise<void> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));

    await run('DELETE FROM session_keys WHERE expires_at <= ?', [new Date().toISOString()]);
  }

  // Challenge operations
  async createChallenge(challenge: Omit<WebAuthnChallenge, 'createdAt'>): Promise<WebAuthnChallenge> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));
    const get: any = promisify(this.db.get.bind(this.db));

    const now = new Date();
    await run(
      `INSERT INTO webauthn_challenges (id, challenge, user_id, type, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        challenge.id,
        challenge.challenge,
        challenge.userId,
        challenge.type,
        challenge.expiresAt.toISOString(),
        now.toISOString()
      ]
    );

    const created = await get('SELECT * FROM webauthn_challenges WHERE id = ?', [challenge.id]);
    return this.mapChallenge(created);
  }

  async getChallenge(id: string): Promise<WebAuthnChallenge | null> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));

    const challenge = await get('SELECT * FROM webauthn_challenges WHERE id = ?', [id]);
    return challenge ? this.mapChallenge(challenge) : null;
  }

  async getLatestChallengeByType(type: 'registration' | 'authentication'): Promise<WebAuthnChallenge | null> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));

    const row = await get(
      'SELECT * FROM webauthn_challenges WHERE type = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1',
      [type, new Date().toISOString()]
    );
    return row ? this.mapChallenge(row) : null;
  }

  async getChallengeByValue(challengeValue: string, type?: 'registration' | 'authentication'): Promise<WebAuthnChallenge | null> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));

    const params: any[] = [challengeValue, new Date().toISOString()];
    let query = 'SELECT * FROM webauthn_challenges WHERE challenge = ? AND expires_at > ?';
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    query += ' ORDER BY created_at DESC LIMIT 1';

    const row = await get(query, params);
    return row ? this.mapChallenge(row) : null;
  }

  async deleteChallenge(id: string): Promise<void> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));

    await run('DELETE FROM webauthn_challenges WHERE id = ?', [id]);
  }

  async cleanupExpiredChallenges(): Promise<void> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));

    await run('DELETE FROM webauthn_challenges WHERE expires_at <= ?', [new Date().toISOString()]);
  }

  // Mapping functions
  private mapUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      walletAddress: row.wallet_address,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapPasskeyCredential(row: any): PasskeyCredential {
    return {
      id: row.id,
      userId: row.user_id,
      credentialID: row.credential_id,
      credentialPublicKey: new Uint8Array(row.credential_public_key),
      counter: row.counter,
      credentialDeviceType: row.credential_device_type,
      credentialBackedUp: row.credential_backed_up === 1,
      transports: row.transports ? JSON.parse(row.transports) : undefined,
      createdAt: new Date(row.created_at)
    };
  }

  private mapSessionKey(row: any): SessionKey {
    // Decrypt private key when retrieving
    let privateKey = row.private_key;
    if (this.encryptionKey && privateKey && row.private_key_iv) {
      try {
        privateKey = decryptPrivateKey(privateKey, row.private_key_iv);
      } catch (error) {
        console.error('FATAL: Failed to decrypt private key for session key ID:', row.id, error);
        // In a real app, you might want to handle this more gracefully,
        // but failing to decrypt is a critical error.
        throw new Error('Could not decrypt session key. Check encryption key and data integrity.');
      }
    } else if (this.encryptionKey && privateKey && !row.private_key_iv) {
      // This case handles data that was encrypted with the old, insecure method.
      // It's a migration path. For new data, this branch won't be hit.
      console.warn(`WARNING: Session key ${row.id} is using legacy encryption. It should be re-encrypted.`);
      try {
        // Assuming the old decrypt function is available for migration.
        // If not, this will fail. Let's assume it is not for now.
        // privateKey = oldDecrypt(privateKey, this.encryptionKey);
        throw new Error(`Legacy key found but no migration path for decryption is available for key ID: ${row.id}`);
      } catch (error) {
        console.error(`FATAL: Failed to decrypt legacy key ${row.id}`, error);
        throw new Error('Could not decrypt legacy session key.');
      }
    }


    return {
      id: row.id,
      userId: row.user_id,
      privateKey: privateKey,
      address: row.address,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at)
    };
  }

  async getActiveSessionKeyByAddressAndPrivateKey(address: string, privateKey: string): Promise<SessionKey | null> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));

    const row = await get(
      'SELECT * FROM session_keys WHERE address = ? AND private_key = ? AND expires_at > ? LIMIT 1',
      [address, privateKey, new Date().toISOString()]
    );

    return row ? this.mapSessionKey(row) : null;
  }

  private mapChallenge(row: any): WebAuthnChallenge {
    return {
      id: row.id,
      challenge: row.challenge,
      userId: row.user_id,
      type: row.type,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at)
    };
  }

  // Bridge transaction operations
  async createBridgeTransaction(transaction: Omit<BridgeTransaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<BridgeTransaction> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));

    const now = new Date().toISOString();

    // Use custom promise to get lastID from sqlite3 run callback
    const lastID = await new Promise<number>((resolve, reject) => {
      this.db.run(
        `INSERT INTO bridge_transactions
         (user_id, session_key_address, amount, direction, token, status,
          source_tx_hash, destination_tx_hash, attestation, error_message, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transaction.userId,
          transaction.sessionKeyAddress,
          transaction.amount,
          transaction.direction,
          transaction.token,
          transaction.status,
          transaction.sourceTxHash || null,
          transaction.destinationTxHash || null,
          transaction.attestation || null,
          transaction.errorMessage || null,
          now,
          now
        ],
        function (this: RunResult, err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    const created = await get('SELECT * FROM bridge_transactions WHERE id = ?', [lastID]);
    return this.mapBridgeTransaction(created);
  }

  async getBridgeTransaction(id: number): Promise<BridgeTransaction | null> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));

    const transaction = await get('SELECT * FROM bridge_transactions WHERE id = ?', [id]);
    return transaction ? this.mapBridgeTransaction(transaction) : null;
  }

  async updateBridgeTransaction(
    id: number,
    updates: Partial<Pick<BridgeTransaction, 'status' | 'sourceTxHash' | 'destinationTxHash' | 'attestation' | 'errorMessage'>>
  ): Promise<BridgeTransaction | null> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));

    const fields = [];
    const values = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.sourceTxHash !== undefined) {
      fields.push('source_tx_hash = ?');
      values.push(updates.sourceTxHash);
    }
    if (updates.destinationTxHash !== undefined) {
      fields.push('destination_tx_hash = ?');
      values.push(updates.destinationTxHash);
    }
    if (updates.attestation !== undefined) {
      fields.push('attestation = ?');
      values.push(updates.attestation);
    }
    if (updates.errorMessage !== undefined) {
      fields.push('error_message = ?');
      values.push(updates.errorMessage);
    }

    if (fields.length === 0) return this.getBridgeTransaction(id);

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await run(
      `UPDATE bridge_transactions SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.getBridgeTransaction(id);
  }

  async getBridgeHistory(userId: string, limit: number = 50, offset: number = 0): Promise<BridgeTransaction[]> {
    await this.waitForReady();
    const all: any = promisify(this.db.all.bind(this.db));

    const transactions = await all(
      'SELECT * FROM bridge_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
    return transactions.map(this.mapBridgeTransaction);
  }

  private mapBridgeTransaction(row: any): BridgeTransaction {
    return {
      id: row.id,
      userId: row.user_id,
      sessionKeyAddress: row.session_key_address,
      amount: row.amount,
      direction: row.direction,
      token: row.token,
      status: row.status,
      sourceTxHash: row.source_tx_hash,
      destinationTxHash: row.destination_tx_hash,
      attestation: row.attestation,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // Recovery token operations
  async createRecoveryToken(data: { id: string; email: string; token: string; expiresAt: Date }): Promise<void> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));

    await run(
      'INSERT INTO recovery_tokens (id, email, token, expires_at) VALUES (?, ?, ?, ?)',
      [data.id, data.email.toLowerCase(), data.token, data.expiresAt.toISOString()]
    );
  }

  async getRecoveryToken(token: string): Promise<{ id: string; email: string; token: string; expiresAt: Date; used: boolean } | null> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));

    const row = await get(
      'SELECT * FROM recovery_tokens WHERE token = ? AND used = 0 AND expires_at > ?',
      [token, new Date().toISOString()]
    );

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      token: row.token,
      expiresAt: new Date(row.expires_at),
      used: Boolean(row.used)
    };
  }

  async markRecoveryTokenUsed(token: string): Promise<void> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));

    await run('UPDATE recovery_tokens SET used = 1 WHERE token = ?', [token]);
  }

  async deletePasskeysByEmail(email: string): Promise<number> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));

    // Find user by username (email)
    const user = await this.getUserByUsername(email.toLowerCase());
    if (!user) return 0;

    // Delete all passkeys for this user
    const result: any = await new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM passkey_credentials WHERE user_id = ?',
        [user.id],
        function (err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    return result.changes;
  }

  // OAuth operations
  async createOAuthAccount(account: OAuthAccount): Promise<void> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));

    await run(
      `INSERT INTO oauth_accounts (
        id, user_id, provider, provider_id, email, name, picture,
        access_token, refresh_token, token_expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        account.id,
        account.userId,
        account.provider,
        account.providerId,
        account.email,
        account.name,
        account.picture,
        account.accessToken,
        account.refreshToken,
        account.tokenExpiresAt,
        account.createdAt,
        account.updatedAt
      ]
    );
  }

  async getOAuthAccount(provider: string, providerId: string): Promise<OAuthAccount | null> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));

    const row = await get(
      'SELECT * FROM oauth_accounts WHERE provider = ? AND provider_id = ?',
      [provider, providerId]
    );

    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      providerId: row.provider_id,
      email: row.email,
      name: row.name,
      picture: row.picture,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenExpiresAt: row.token_expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async getOAuthAccountsByUserId(userId: string): Promise<OAuthAccount[]> {
    await this.waitForReady();
    const all: any = promisify(this.db.all.bind(this.db));

    const rows = await all('SELECT * FROM oauth_accounts WHERE user_id = ?', [userId]);

    return rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      providerId: row.provider_id,
      email: row.email,
      name: row.name,
      picture: row.picture,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenExpiresAt: row.token_expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async updateOAuthTokens(accountId: string, tokens: { accessToken: string; refreshToken?: string; expiresAt?: number }): Promise<void> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));

    const updates = ['access_token = ?', 'updated_at = ?'];
    const values = [tokens.accessToken, Date.now()];

    if (tokens.refreshToken) {
      updates.push('refresh_token = ?');
      values.push(tokens.refreshToken);
    }

    if (tokens.expiresAt) {
      updates.push('token_expires_at = ?');
      values.push(tokens.expiresAt);
    }

    values.push(accountId);

    await run(
      `UPDATE oauth_accounts SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }

  async deleteOAuthAccount(userId: string, provider: string): Promise<void> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));

    await run(
      'DELETE FROM oauth_accounts WHERE user_id = ? AND provider = ?',
      [userId, provider]
    );
  }

  async createOAuthState(state: OAuthState): Promise<void> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));

    await run(
      `INSERT INTO oauth_states (state, provider, redirect_url, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [state.state, state.provider, state.redirectUrl, state.createdAt, state.expiresAt]
    );
  }

  async getOAuthState(state: string): Promise<OAuthState | null> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));

    const row = await get('SELECT * FROM oauth_states WHERE state = ?', [state]);

    if (!row) return null;

    return {
      state: row.state,
      provider: row.provider,
      redirectUrl: row.redirect_url,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    };
  }

  async deleteOAuthState(state: string): Promise<void> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));

    await run('DELETE FROM oauth_states WHERE state = ?', [state]);
  }

  async cleanupExpiredOAuthStates(): Promise<void> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));

    await run('DELETE FROM oauth_states WHERE expires_at <= ?', [Date.now()]);
  }

  async deleteSessionKeysByEmail(email: string): Promise<number> {
    await this.waitForReady();

    // Find user by username (email)
    const user = await this.getUserByUsername(email.toLowerCase());
    if (!user) return 0;

    // Delete all session keys for this user
    const result: any = await new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM session_keys WHERE user_id = ?',
        [user.id],
        function (err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    return result.changes || 0;
  }

  async cleanupExpiredRecoveryTokens(): Promise<void> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));

    await run('DELETE FROM recovery_tokens WHERE expires_at < ? OR used = 1', [new Date().toISOString()]);
  }

  // One-time token operations
  async markTokenUsed(tokenHash: string, expiresAt: Date): Promise<void> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));
    await run(
      'INSERT INTO used_tokens (token_hash, expires_at) VALUES (?, ?)',
      [tokenHash, expiresAt.toISOString()]
    );
  }

  async isTokenUsed(tokenHash: string): Promise<boolean> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));
    const result = await get(
      'SELECT * FROM used_tokens WHERE token_hash = ? AND expires_at > ?',
      [tokenHash, new Date().toISOString()]
    );
    return !!result;
  }

  // Multi-sig account operations
  async createMultiSigAccount(account: Omit<MultiSigAccount, 'createdAt'>): Promise<MultiSigAccount> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));
    const get: any = promisify(this.db.get.bind(this.db));

    await run(
      'INSERT INTO multi_sig_accounts (id, name, address, required_signatures, created_by) VALUES (?, ?, ?, ?, ?)',
      [account.id, account.name, account.address, account.requiredSignatures, account.createdBy]
    );

    const created = await get('SELECT * FROM multi_sig_accounts WHERE id = ?', [account.id]);
    return this.mapMultiSigAccount(created);
  }

  async getMultiSigAccount(id: string): Promise<MultiSigAccount | null> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));

    const account = await get('SELECT * FROM multi_sig_accounts WHERE id = ?', [id]);
    return account ? this.mapMultiSigAccount(account) : null;
  }

  async getMultiSigAccountsByUser(userId: string): Promise<MultiSigAccount[]> {
    await this.waitForReady();
    const all: any = promisify(this.db.all.bind(this.db));

    const accounts = await all(
      `SELECT DISTINCT a.* FROM multi_sig_accounts a
       INNER JOIN multi_sig_members m ON a.id = m.account_id
       WHERE m.user_id = ? AND m.status = 'active'
       ORDER BY a.created_at DESC`,
      [userId]
    );
    return accounts.map((a: any) => this.mapMultiSigAccount(a));
  }

  async updateMultiSigAccount(id: string, updates: Partial<Pick<MultiSigAccount, 'name' | 'address' | 'requiredSignatures'>>): Promise<MultiSigAccount | null> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));

    const fields = [];
    const values = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.address !== undefined) {
      fields.push('address = ?');
      values.push(updates.address);
    }
    if (updates.requiredSignatures !== undefined) {
      fields.push('required_signatures = ?');
      values.push(updates.requiredSignatures);
    }

    if (fields.length === 0) return this.getMultiSigAccount(id);

    values.push(id);
    await run(`UPDATE multi_sig_accounts SET ${fields.join(', ')} WHERE id = ?`, values);

    return this.getMultiSigAccount(id);
  }

  // Multi-sig member operations
  async addMultiSigMember(member: Omit<MultiSigMember, 'addedAt'>): Promise<MultiSigMember> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));
    const get: any = promisify(this.db.get.bind(this.db));

    await run(
      'INSERT INTO multi_sig_members (id, account_id, user_id, email, role, status) VALUES (?, ?, ?, ?, ?, ?)',
      [member.id, member.accountId, member.userId, member.email, member.role, member.status]
    );

    const created = await get('SELECT * FROM multi_sig_members WHERE id = ?', [member.id]);
    return this.mapMultiSigMember(created);
  }

  async getMultiSigMembers(accountId: string): Promise<MultiSigMember[]> {
    await this.waitForReady();
    const all: any = promisify(this.db.all.bind(this.db));

    const members = await all(
      'SELECT * FROM multi_sig_members WHERE account_id = ? ORDER BY added_at ASC',
      [accountId]
    );
    return members.map((m: any) => this.mapMultiSigMember(m));
  }

  async updateMultiSigMemberStatus(id: string, status: 'pending' | 'active' | 'removed'): Promise<void> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));

    await run('UPDATE multi_sig_members SET status = ? WHERE id = ?', [status, id]);
  }

  // Multi-sig transaction operations
  async createMultiSigTransaction(tx: Omit<MultiSigTransaction, 'createdAt'>): Promise<MultiSigTransaction> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));
    const get: any = promisify(this.db.get.bind(this.db));

    await run(
      `INSERT INTO multi_sig_transactions
       (id, account_id, submitter_id, target_address, value, token_address, token_symbol, data, description, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tx.id, tx.accountId, tx.submitterId, tx.targetAddress, tx.value, tx.tokenAddress, tx.tokenSymbol, tx.data, tx.description, tx.status, tx.expiresAt.toISOString()]
    );

    const created = await get('SELECT * FROM multi_sig_transactions WHERE id = ?', [tx.id]);
    return this.mapMultiSigTransaction(created);
  }

  async getMultiSigTransaction(id: string): Promise<MultiSigTransaction | null> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));

    const tx = await get('SELECT * FROM multi_sig_transactions WHERE id = ?', [id]);
    return tx ? this.mapMultiSigTransaction(tx) : null;
  }

  async getMultiSigTransactionsByAccount(accountId: string, status?: string): Promise<MultiSigTransaction[]> {
    await this.waitForReady();
    const all: any = promisify(this.db.all.bind(this.db));

    let query = 'SELECT * FROM multi_sig_transactions WHERE account_id = ?';
    const params: any[] = [accountId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const txs = await all(query, params);
    return txs.map((t: any) => this.mapMultiSigTransaction(t));
  }

  async updateMultiSigTransaction(id: string, updates: Partial<Pick<MultiSigTransaction, 'status' | 'txHash' | 'onChainTxId'>>): Promise<void> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));

    const fields = [];
    const values = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.txHash !== undefined) {
      fields.push('tx_hash = ?');
      values.push(updates.txHash);
    }
    if (updates.onChainTxId !== undefined) {
      fields.push('on_chain_tx_id = ?');
      values.push(updates.onChainTxId);
    }

    if (fields.length === 0) return;

    values.push(id);
    await run(`UPDATE multi_sig_transactions SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  async expireOldMultiSigTransactions(): Promise<number> {
    await this.waitForReady();

    const result: any = await new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE multi_sig_transactions SET status = 'expired' WHERE status = 'pending' AND expires_at < ?`,
        [new Date().toISOString()],
        function (err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    return result.changes || 0;
  }

  // Multi-sig signature operations
  async addMultiSigSignature(sig: Omit<MultiSigSignature, 'signedAt'>): Promise<MultiSigSignature> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));
    const get: any = promisify(this.db.get.bind(this.db));

    await run(
      'INSERT INTO multi_sig_signatures (id, transaction_id, signer_id, signer_address, status) VALUES (?, ?, ?, ?, ?)',
      [sig.id, sig.transactionId, sig.signerId, sig.signerAddress, sig.status]
    );

    const created = await get('SELECT * FROM multi_sig_signatures WHERE id = ?', [sig.id]);
    return this.mapMultiSigSignature(created);
  }

  async getMultiSigSignatures(transactionId: string): Promise<MultiSigSignature[]> {
    await this.waitForReady();
    const all: any = promisify(this.db.all.bind(this.db));

    const sigs = await all(
      'SELECT * FROM multi_sig_signatures WHERE transaction_id = ? ORDER BY signed_at ASC',
      [transactionId]
    );
    return sigs.map((s: any) => this.mapMultiSigSignature(s));
  }

  async getApprovalCount(transactionId: string): Promise<number> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));

    const result = await get(
      `SELECT COUNT(*) as count FROM multi_sig_signatures WHERE transaction_id = ? AND status = 'approved'`,
      [transactionId]
    );
    return result?.count || 0;
  }

  // Mapper functions
  private mapMultiSigAccount(row: any): MultiSigAccount {
    return {
      id: row.id,
      name: row.name,
      address: row.address,
      requiredSignatures: row.required_signatures,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at)
    };
  }

  private mapMultiSigMember(row: any): MultiSigMember {
    return {
      id: row.id,
      accountId: row.account_id,
      userId: row.user_id,
      email: row.email,
      role: row.role,
      status: row.status,
      addedAt: new Date(row.added_at)
    };
  }

  private mapMultiSigTransaction(row: any): MultiSigTransaction {
    return {
      id: row.id,
      accountId: row.account_id,
      submitterId: row.submitter_id,
      targetAddress: row.target_address,
      value: row.value,
      tokenAddress: row.token_address,
      tokenSymbol: row.token_symbol,
      data: row.data,
      description: row.description,
      status: row.status,
      txHash: row.tx_hash,
      onChainTxId: row.on_chain_tx_id,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at)
    };
  }

  private mapMultiSigSignature(row: any): MultiSigSignature {
    return {
      id: row.id,
      transactionId: row.transaction_id,
      signerId: row.signer_id,
      signerAddress: row.signer_address,
      status: row.status,
      signedAt: new Date(row.signed_at)
    };
  }

  // Token metadata operations
  async getTokenMetadata(address: string): Promise<any | null> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));

    const normalized = address.toLowerCase();
    const row = await get('SELECT * FROM token_metadata WHERE address = ?', [normalized]);

    if (!row) return null;

    return {
      address: row.address,
      symbol: row.symbol,
      name: row.name,
      decimals: row.decimals,
      chainId: row.chain_id,
      lastUpdated: new Date(row.last_updated),
      createdAt: new Date(row.created_at)
    };
  }

  async saveTokenMetadata(metadata: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    chainId?: number;
  }): Promise<void> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));

    const normalized = metadata.address.toLowerCase();
    const now = new Date().toISOString();

    await run(
      `INSERT OR REPLACE INTO token_metadata 
       (address, symbol, name, decimals, chain_id, last_updated, created_at)
       VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM token_metadata WHERE address = ?), ?))`,
      [
        normalized,
        metadata.symbol,
        metadata.name,
        metadata.decimals,
        metadata.chainId || 1,
        now,
        normalized,
        now
      ]
    );
  }

  async getAllTokenMetadata(): Promise<any[]> {
    await this.waitForReady();
    const all: any = promisify(this.db.all.bind(this.db));

    const rows = await all('SELECT * FROM token_metadata ORDER BY created_at DESC');

    return rows.map((row: any) => ({
      address: row.address,
      symbol: row.symbol,
      name: row.name,
      decimals: row.decimals,
      chainId: row.chain_id,
      lastUpdated: new Date(row.last_updated),
      createdAt: new Date(row.created_at)
    }));
  }

  async close(): Promise<void> {
    await this.waitForReady();
    const close: any = promisify(this.db.close.bind(this.db));
    await close();
  }

  /**
   * ADMIN ONLY: Reset all user data for testing
   * WARNING: This deletes ALL users, passkeys, sessions, etc.
   */
  async resetAllUserData(): Promise<{ users: number; passkeys: number; sessions: number; challenges: number }> {
    await this.waitForReady();
    const run: any = promisify(this.db.run.bind(this.db));
    const get: any = promisify(this.db.get.bind(this.db));

    // Get counts before deletion
    const userCount = await get('SELECT COUNT(*) as count FROM users');
    const passkeyCount = await get('SELECT COUNT(*) as count FROM passkey_credentials');
    const sessionCount = await get('SELECT COUNT(*) as count FROM session_keys');
    const challengeCount = await get('SELECT COUNT(*) as count FROM challenges');

    // Delete in order (foreign key constraints)
    await run('DELETE FROM session_keys');
    await run('DELETE FROM passkey_credentials');
    await run('DELETE FROM challenges');
    await run('DELETE FROM recovery_tokens');
    await run('DELETE FROM users');

    return {
      users: userCount?.count || 0,
      passkeys: passkeyCount?.count || 0,
      sessions: sessionCount?.count || 0,
      challenges: challengeCount?.count || 0
    };
  }
}
