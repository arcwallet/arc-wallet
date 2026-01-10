/**
 * Agent Memory & Learning Service
 *
 * Stores successful interactions to improve future responses.
 * Learns user preferences, common addresses, and language patterns.
 */
interface UserPreference {
    wallet_address: string;
    preferred_language: string;
    favorite_tokens: string[];
    frequent_addresses: {
        address: string;
        label?: string;
    }[];
    total_transactions: number;
    last_active: string;
}
interface LearnedExample {
    input: string;
    intent: string;
    params: Record<string, any>;
    language: string;
}
declare class AgentMemoryService {
    private db;
    constructor();
    private initDatabase;
    /**
     * Record a successful interaction for learning
     */
    recordInteraction(walletAddress: string, userInput: string, intent: string, params: Record<string, any>, success?: boolean, language?: string): void;
    /**
     * Update user preferences based on interaction
     */
    private updateUserPreferences;
    /**
     * Add a learned example from user correction
     */
    addLearnedExample(inputPattern: string, correctIntent: string, correctParams: Record<string, any>, language?: string): void;
    /**
     * Get user preferences for context
     */
    getUserPreferences(walletAddress: string): UserPreference | null;
    /**
     * Get recent successful interactions as examples
     */
    getRecentExamples(walletAddress: string, limit?: number): LearnedExample[];
    /**
     * Get learned examples (from corrections)
     */
    getLearnedExamples(limit?: number): LearnedExample[];
    /**
     * Build context prompt for Gemini based on user history
     */
    buildContextPrompt(walletAddress: string): string;
    /**
     * Detect language from text (simple heuristic)
     */
    detectLanguage(text: string): string;
    /**
     * Get stats for dashboard
     */
    getStats(): {
        totalInteractions: number;
        uniqueUsers: number;
        successRate: number;
    };
}
export declare const agentMemory: AgentMemoryService;
export default agentMemory;
//# sourceMappingURL=agentMemory.d.ts.map