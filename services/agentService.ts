export interface AgentResponse {
    message: string;
    action?: {
        type: 'SEND' | 'SWAP' | 'CHECK_BALANCE';
        params?: any;
    };
}

class AgentService {
    async parseIntent(input: string): Promise<AgentResponse> {
        // Simulate AI processing delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const lowerInput = input.toLowerCase();

        if (lowerInput.includes('send')) {
            // Mock parsing: "Send 10 USDC to Bob"
            const amount = lowerInput.match(/\d+/)?.[0] || '0';
            const token = lowerInput.includes('usdc') ? 'USDC' : 'ARC';

            return {
                message: `I've prepared a transaction to send ${amount} ${token}. Shall I proceed?`,
                action: {
                    type: 'SEND',
                    params: { amount, token, recipient: 'Bob' }
                }
            };
        }

        if (lowerInput.includes('swap')) {
            return {
                message: "Opening the swap interface for you.",
                action: { type: 'SWAP' }
            };
        }

        if (lowerInput.includes('balance')) {
            return {
                message: "Checking your latest balance...",
                action: { type: 'CHECK_BALANCE' }
            };
        }

        return {
            message: "I'm not sure how to help with that yet. Try asking me to 'send money' or 'swap tokens'.",
        };
    }
}

export const agentService = new AgentService();
