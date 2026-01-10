/**
 * Agent Memory & Learning Service
 *
 * Stores successful interactions to improve future responses.
 * Learns user preferences, common addresses, and language patterns.
 */
import Database from 'better-sqlite3';
import path from 'path';
class AgentMemoryService {
    db;
    constructor() {
        const dbPath = process.env.AGENT_MEMORY_DB || path.join(process.cwd(), 'data', 'agent_memory.db');
        this.db = new Database(dbPath);
        this.initDatabase();
    }
    initDatabase() {
        // Interaction history - learns from successful transactions
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_address TEXT NOT NULL,
        user_input TEXT NOT NULL,
        detected_intent TEXT NOT NULL,
        params TEXT NOT NULL,
        success INTEGER DEFAULT 1,
        user_language TEXT DEFAULT 'en',
        feedback TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // User preferences - learned over time
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        wallet_address TEXT PRIMARY KEY,
        preferred_language TEXT DEFAULT 'en',
        favorite_tokens TEXT DEFAULT '[]',
        frequent_addresses TEXT DEFAULT '[]',
        total_transactions INTEGER DEFAULT 0,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Custom examples - user corrections become training data
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS learned_examples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        input_pattern TEXT NOT NULL,
        correct_intent TEXT NOT NULL,
        correct_params TEXT NOT NULL,
        language TEXT DEFAULT 'en',
        times_used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Create indexes
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_interactions_wallet ON interactions(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_interactions_intent ON interactions(detected_intent);
    `);
        console.log('✅ Agent memory database initialized');
    }
    /**
     * Record a successful interaction for learning
     */
    recordInteraction(walletAddress, userInput, intent, params, success = true, language = 'en') {
        const stmt = this.db.prepare(`
      INSERT INTO interactions (wallet_address, user_input, detected_intent, params, success, user_language)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(walletAddress, userInput, intent, JSON.stringify(params), success ? 1 : 0, language);
        // Update user preferences
        this.updateUserPreferences(walletAddress, intent, params, language);
    }
    /**
     * Update user preferences based on interaction
     */
    updateUserPreferences(walletAddress, intent, params, language) {
        // Get or create user preferences
        let prefs = this.db.prepare('SELECT * FROM user_preferences WHERE wallet_address = ?').get(walletAddress);
        if (!prefs) {
            this.db.prepare(`
        INSERT INTO user_preferences (wallet_address, preferred_language)
        VALUES (?, ?)
      `).run(walletAddress, language);
            prefs = { favorite_tokens: '[]', frequent_addresses: '[]', total_transactions: 0 };
        }
        // Parse existing data
        const favoriteTokens = JSON.parse(prefs.favorite_tokens || '[]');
        const frequentAddresses = JSON.parse(prefs.frequent_addresses || '[]');
        // Update favorite tokens
        if (params.token && !favoriteTokens.includes(params.token)) {
            favoriteTokens.push(params.token);
        }
        // Update frequent addresses
        if (params.recipient) {
            const existing = frequentAddresses.find(a => a.address === params.recipient);
            if (existing) {
                existing.count++;
            }
            else {
                frequentAddresses.push({ address: params.recipient, count: 1 });
            }
            // Sort by frequency
            frequentAddresses.sort((a, b) => b.count - a.count);
        }
        // Update database
        this.db.prepare(`
      UPDATE user_preferences
      SET preferred_language = ?,
          favorite_tokens = ?,
          frequent_addresses = ?,
          total_transactions = total_transactions + 1,
          last_active = CURRENT_TIMESTAMP
      WHERE wallet_address = ?
    `).run(language, JSON.stringify(favoriteTokens), JSON.stringify(frequentAddresses), walletAddress);
    }
    /**
     * Add a learned example from user correction
     */
    addLearnedExample(inputPattern, correctIntent, correctParams, language = 'en') {
        this.db.prepare(`
      INSERT INTO learned_examples (input_pattern, correct_intent, correct_params, language)
      VALUES (?, ?, ?, ?)
    `).run(inputPattern, correctIntent, JSON.stringify(correctParams), language);
    }
    /**
     * Get user preferences for context
     */
    getUserPreferences(walletAddress) {
        const row = this.db.prepare('SELECT * FROM user_preferences WHERE wallet_address = ?').get(walletAddress);
        if (!row)
            return null;
        return {
            wallet_address: row.wallet_address,
            preferred_language: row.preferred_language,
            favorite_tokens: JSON.parse(row.favorite_tokens || '[]'),
            frequent_addresses: JSON.parse(row.frequent_addresses || '[]'),
            total_transactions: row.total_transactions,
            last_active: row.last_active,
        };
    }
    /**
     * Get recent successful interactions as examples
     */
    getRecentExamples(walletAddress, limit = 5) {
        const rows = this.db.prepare(`
      SELECT user_input, detected_intent, params, user_language
      FROM interactions
      WHERE wallet_address = ? AND success = 1
      ORDER BY created_at DESC
      LIMIT ?
    `).all(walletAddress, limit);
        return rows.map(row => ({
            input: row.user_input,
            intent: row.detected_intent,
            params: JSON.parse(row.params),
            language: row.user_language,
        }));
    }
    /**
     * Get learned examples (from corrections)
     */
    getLearnedExamples(limit = 10) {
        const rows = this.db.prepare(`
      SELECT input_pattern, correct_intent, correct_params, language
      FROM learned_examples
      ORDER BY times_used DESC, created_at DESC
      LIMIT ?
    `).all(limit);
        return rows.map(row => ({
            input: row.input_pattern,
            intent: row.correct_intent,
            params: JSON.parse(row.correct_params),
            language: row.language,
        }));
    }
    /**
     * Build context prompt for Gemini based on user history
     */
    buildContextPrompt(walletAddress) {
        const prefs = this.getUserPreferences(walletAddress);
        const recentExamples = this.getRecentExamples(walletAddress, 3);
        const learnedExamples = this.getLearnedExamples(5);
        let context = '';
        // User preferences
        if (prefs) {
            context += `\n## USER CONTEXT:\n`;
            context += `- Preferred language: ${prefs.preferred_language}\n`;
            if (prefs.favorite_tokens.length > 0) {
                context += `- Favorite tokens: ${prefs.favorite_tokens.join(', ')}\n`;
            }
            if (prefs.frequent_addresses.length > 0) {
                const topAddresses = prefs.frequent_addresses.slice(0, 3);
                context += `- Frequent addresses: ${topAddresses.map(a => a.address.slice(0, 10) + '...').join(', ')}\n`;
            }
            context += `- Total transactions: ${prefs.total_transactions}\n`;
        }
        // Recent examples from this user
        if (recentExamples.length > 0) {
            context += `\n## THIS USER'S RECENT PATTERNS:\n`;
            recentExamples.forEach(ex => {
                context += `Input: "${ex.input}" → ${ex.intent} ${JSON.stringify(ex.params)}\n`;
            });
        }
        // Learned examples from corrections
        if (learnedExamples.length > 0) {
            context += `\n## LEARNED CORRECTIONS:\n`;
            learnedExamples.forEach(ex => {
                context += `"${ex.input}" → ${ex.intent} ${JSON.stringify(ex.params)}\n`;
            });
        }
        return context;
    }
    /**
     * Detect language from text (simple heuristic)
     */
    detectLanguage(text) {
        const lower = text.toLowerCase();
        // Turkish indicators
        if (/[ğüşıöç]/.test(lower) || /\b(gönder|yolla|bakiye|köprü|fiyat|kadar)\b/.test(lower)) {
            return 'tr';
        }
        // Spanish indicators
        if (/[ñáéíóú]/.test(lower) || /\b(enviar|precio|cuanto|quiero)\b/.test(lower)) {
            return 'es';
        }
        // German indicators
        if (/[äöüß]/.test(lower) || /\b(senden|preis|guthaben)\b/.test(lower)) {
            return 'de';
        }
        // Portuguese indicators
        if (/[ãõ]/.test(lower) || /\b(enviar|preço|quanto)\b/.test(lower)) {
            return 'pt';
        }
        // French indicators
        if (/[àâçéèêëïîôùûü]/.test(lower) || /\b(envoyer|prix|combien)\b/.test(lower)) {
            return 'fr';
        }
        return 'en';
    }
    /**
     * Get stats for dashboard
     */
    getStats() {
        const stats = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT wallet_address) as users,
        AVG(success) as success_rate
      FROM interactions
    `).get();
        return {
            totalInteractions: stats.total || 0,
            uniqueUsers: stats.users || 0,
            successRate: (stats.success_rate || 0) * 100,
        };
    }
}
export const agentMemory = new AgentMemoryService();
export default agentMemory;
//# sourceMappingURL=agentMemory.js.map