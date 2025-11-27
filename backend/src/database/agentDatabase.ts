import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Determine database path with fallback
function getDatabasePath(): string {
    const envPath = process.env.DB_PATH;
    const defaultPath = path.join(process.cwd(), 'data', 'wallet.db');

    // If DB_PATH is set, try to use it
    if (envPath) {
        const envDir = path.dirname(envPath);
        try {
            if (!fs.existsSync(envDir)) {
                fs.mkdirSync(envDir, { recursive: true });
            }
            return envPath;
        } catch (error) {
            console.warn(`⚠️ Cannot create directory ${envDir}, falling back to project data directory`);
        }
    }

    // Fallback: use project's data directory
    const defaultDir = path.dirname(defaultPath);
    if (!fs.existsSync(defaultDir)) {
        fs.mkdirSync(defaultDir, { recursive: true });
    }
    return defaultPath;
}

const DB_PATH = getDatabasePath();
console.log(`📁 Agent database path: ${DB_PATH}`);

const db = new Database(DB_PATH);

// Initialize agent tables
export function initializeAgentDatabase() {
    // Create agent_conversations table
    db.exec(`
    CREATE TABLE IF NOT EXISTS agent_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      message TEXT NOT NULL,
      response TEXT NOT NULL,
      intent_type TEXT,
      intent_params TEXT,
      confidence REAL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_agent_user_id ON agent_conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_agent_created_at ON agent_conversations(created_at);
  `);

    console.log('✅ Agent database initialized');
}

export interface AgentConversation {
    id: string;
    userId: string;
    message: string;
    response: string;
    intentType: string | null;
    intentParams: string | null;
    confidence: number | null;
    createdAt: number;
}

export function saveConversation(conversation: Omit<AgentConversation, 'createdAt'> & { createdAt?: number }): void {
    const stmt = db.prepare(`
    INSERT INTO agent_conversations (id, user_id, message, response, intent_type, intent_params, confidence, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

    stmt.run(
        conversation.id,
        conversation.userId,
        conversation.message,
        conversation.response,
        conversation.intentType,
        conversation.intentParams,
        conversation.confidence,
        conversation.createdAt || Date.now()
    );
}

export function getUserConversations(userId: string, limit: number = 50): AgentConversation[] {
    const stmt = db.prepare(`
    SELECT id, user_id as userId, message, response, intent_type as intentType, 
           intent_params as intentParams, confidence, created_at as createdAt
    FROM agent_conversations
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

    return stmt.all(userId, limit) as AgentConversation[];
}

export function clearUserHistory(userId: string): void {
    const stmt = db.prepare('DELETE FROM agent_conversations WHERE user_id = ?');
    stmt.run(userId);
}

export function getConversationStats(userId: string): {
    totalConversations: number;
    intentBreakdown: Record<string, number>;
} {
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM agent_conversations WHERE user_id = ?');
    const total = (totalStmt.get(userId) as { count: number }).count;

    const intentStmt = db.prepare(`
    SELECT intent_type, COUNT(*) as count 
    FROM agent_conversations 
    WHERE user_id = ? AND intent_type IS NOT NULL
    GROUP BY intent_type
  `);

    const intents = intentStmt.all(userId) as { intent_type: string; count: number }[];
    const intentBreakdown: Record<string, number> = {};

    for (const intent of intents) {
        intentBreakdown[intent.intent_type] = intent.count;
    }

    return {
        totalConversations: total,
        intentBreakdown,
    };
}
