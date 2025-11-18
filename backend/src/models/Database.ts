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
  MultiSigSignature
} from '../types/index.js';

type RunResult = sqlite3.RunResult;

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
        function(this: RunResult, err) {
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
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    return result.changes || 0;
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
        function(err) {
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
        function(err) {
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

  async close(): Promise<void> {
    await this.waitForReady();
    const close: any = promisify(this.db.close.bind(this.db));
    await close();
  }
}
