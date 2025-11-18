import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import {
  User,
  PasskeyCredential,
  SessionKey,
  WebAuthnChallenge,
  BridgeTransaction
} from '../types/index.js';

export class Database {
  private db: sqlite3.Database;
  private ready: Promise<void>;

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new sqlite3.Database(dbPath);
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

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
        address TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

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

    const user = await get('SELECT * FROM users WHERE id = ?', [id]);
    return user ? this.mapUser(user) : null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    await this.waitForReady();
    const get: any = promisify(this.db.get.bind(this.db));

    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    return user ? this.mapUser(user) : null;
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
    return credentials.map(this.mapPasskeyCredential);
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

    const now = new Date();
    await run(
      `INSERT INTO session_keys (id, user_id, private_key, address, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        sessionKey.id,
        sessionKey.userId,
        sessionKey.privateKey,
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
    return sessionKeys.map(this.mapSessionKey);
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
    return {
      id: row.id,
      userId: row.user_id,
      privateKey: row.private_key,
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
    const run: any = promisify(this.db.run.bind(this.db));
    const get: any = promisify(this.db.get.bind(this.db));

    const now = new Date().toISOString();
    const result = await run(
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
      ]
    );

    const created = await get('SELECT * FROM bridge_transactions WHERE id = ?', [result.lastID]);
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

  async close(): Promise<void> {
    await this.waitForReady();
    const close: any = promisify(this.db.close.bind(this.db));
    await close();
  }
}