import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'indexer.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db: Database.Database = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

export const initIndexerDB = () => {
  // Blocks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS blocks (
      number INTEGER PRIMARY KEY,
      hash TEXT NOT NULL,
      parent_hash TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      processed_at INTEGER NOT NULL
    )
  `);

  // Transactions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      hash TEXT PRIMARY KEY,
      block_number INTEGER NOT NULL,
      from_address TEXT NOT NULL,
      to_address TEXT,
      value TEXT NOT NULL,
      data TEXT,
      nonce INTEGER NOT NULL,
      gas_limit TEXT NOT NULL,
      gas_price TEXT,
      timestamp INTEGER NOT NULL,
      status INTEGER NOT NULL, -- 1 = success, 0 = failed
      FOREIGN KEY (block_number) REFERENCES blocks(number)
    )
  `);

  // Events table (for ERC20 transfers, etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_hash TEXT NOT NULL,
      block_number INTEGER NOT NULL,
      event_type TEXT NOT NULL, -- 'Transfer', 'Approval', 'UserOperation'
      from_address TEXT,
      to_address TEXT,
      amount TEXT,
      token_address TEXT,
      data TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (transaction_hash) REFERENCES transactions(hash)
    )
  `);

  // Webhooks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL, -- Can be wallet address
      url TEXT NOT NULL,
      events TEXT NOT NULL, -- JSON array of event types
      secret TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  // Webhook Deliveries table (for tracking attempts)
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id TEXT PRIMARY KEY,
      webhook_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL, -- 'pending', 'success', 'failed'
      response_code INTEGER,
      attempt_count INTEGER DEFAULT 0,
      next_retry_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
    )
  `);

  // Push Subscriptions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // Create indexes for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_address);
    CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_address);
    CREATE INDEX IF NOT EXISTS idx_transactions_block ON transactions(block_number);
    CREATE INDEX IF NOT EXISTS idx_events_from ON events(from_address);
    CREATE INDEX IF NOT EXISTS idx_events_to ON events(to_address);
    CREATE INDEX IF NOT EXISTS idx_events_token ON events(token_address);
    CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_status ON webhook_deliveries(status);
    CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
  `);

  console.log('✅ Indexer database initialized');
};

export default db;
