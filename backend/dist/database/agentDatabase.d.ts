export declare function initializeAgentDatabase(): void;
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
export declare function saveConversation(conversation: Omit<AgentConversation, 'createdAt'> & {
    createdAt?: number;
}): void;
export declare function getUserConversations(userId: string, limit?: number): AgentConversation[];
export declare function clearUserHistory(userId: string): void;
export declare function getConversationStats(userId: string): {
    totalConversations: number;
    intentBreakdown: Record<string, number>;
};
//# sourceMappingURL=agentDatabase.d.ts.map