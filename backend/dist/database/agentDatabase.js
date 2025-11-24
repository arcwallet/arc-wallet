import Database from 'better-sqlite3';
import path from 'path';
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'wallet.db');
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
export function saveConversation(conversation) {
    const stmt = db.prepare(`
    INSERT INTO agent_conversations (id, user_id, message, response, intent_type, intent_params, confidence, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(conversation.id, conversation.userId, conversation.message, conversation.response, conversation.intentType, conversation.intentParams, conversation.confidence, conversation.createdAt || Date.now());
}
export function getUserConversations(userId, limit = 50) {
    const stmt = db.prepare(`
    SELECT id, user_id as userId, message, response, intent_type as intentType, 
           intent_params as intentParams, confidence, created_at as createdAt
    FROM agent_conversations
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);
    return stmt.all(userId, limit);
}
export function clearUserHistory(userId) {
    const stmt = db.prepare('DELETE FROM agent_conversations WHERE user_id = ?');
    stmt.run(userId);
}
export function getConversationStats(userId) {
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM agent_conversations WHERE user_id = ?');
    const total = totalStmt.get(userId).count;
    const intentStmt = db.prepare(`
    SELECT intent_type, COUNT(*) as count 
    FROM agent_conversations 
    WHERE user_id = ? AND intent_type IS NOT NULL
    GROUP BY intent_type
  `);
    const intents = intentStmt.all(userId);
    const intentBreakdown = {};
    for (const intent of intents) {
        intentBreakdown[intent.intent_type] = intent.count;
    }
    return {
        totalConversations: total,
        intentBreakdown,
    };
}
//# sourceMappingURL=agentDatabase.js.map