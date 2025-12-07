// Frontend service to communicate with Arc Agent backend

// Base URL for backend API (can be overridden via VITE env variable)
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export interface AgentResponse {
    message: string;
    intent: {
        type: 'SEND' | 'SWAP' | 'CHECK_BALANCE' | 'UNKNOWN';
        params: any;
    };
    confidence: number;
    id?: string;
    aiConfigured?: boolean;
}

class AgentService {
    /** Parse user intent by calling the backend */
    async parseIntent(input: string): Promise<AgentResponse> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/agent/parse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ message: input }),
            });

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error('Rate limit exceeded. Please wait a moment.');
                }
                throw new Error('Failed to parse intent');
            }

            const data = await response.json();
            return {
                message: data.message,
                intent: data.intent,
                confidence: data.confidence,
                id: data.id,
                aiConfigured: data.aiConfigured,
            } as AgentResponse;
        } catch (error: any) {
            console.error('Agent service error:', error);
            return {
                message: error.message || "I'm having trouble connecting right now. Please try again.",
                intent: { type: 'UNKNOWN', params: {} },
                confidence: 0,
            } as AgentResponse;
        }
    }

    /** Retrieve conversation history */
    async getHistory(limit: number = 50): Promise<any[]> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/agent/history?limit=${limit}`, {
                credentials: 'include',
            });
            if (!response.ok) {
                throw new Error('Failed to fetch history');
            }
            const data = await response.json();
            return data.conversations || [];
        } catch (error) {
            console.error('Failed to fetch agent history:', error);
            return [];
        }
    }

    /** Clear conversation history */
    async clearHistory(): Promise<void> {
        try {
            await fetch(`${API_BASE_URL}/api/agent/history`, {
                method: 'DELETE',
                credentials: 'include',
            });
        } catch (error) {
            console.error('Failed to clear agent history:', error);
        }
    }
}

export const agentService = new AgentService();
