import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

// Reuse intent schemas from aiService (they are exported separately if needed)
// For simplicity, we duplicate them here
const SendIntentSchema = z.object({
    type: z.literal('SEND'),
    params: z.object({
        token: z.string(),
        amount: z.string(),
        recipient: z.string(),
    }),
});

const SwapIntentSchema = z.object({
    type: z.literal('SWAP'),
    params: z.object({
        fromToken: z.string(),
        toToken: z.string(),
        amount: z.string(),
    }),
});

const CheckBalanceIntentSchema = z.object({
    type: z.literal('CHECK_BALANCE'),
    params: z.object({
        token: z.string().optional(),
    }),
});

const UnknownIntentSchema = z.object({
    type: z.literal('UNKNOWN'),
    params: z.object({}),
});

const IntentSchema = z.discriminatedUnion('type', [
    SendIntentSchema,
    SwapIntentSchema,
    CheckBalanceIntentSchema,
    UnknownIntentSchema,
]);

type Intent = z.infer<typeof IntentSchema>;

export interface AgentResponse {
    message: string;
    intent: Intent;
    confidence: number;
}

class GeminiService {
    private client: any = null;
    private model: any = null;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey && apiKey.startsWith('AIza')) {
            this.client = new GoogleGenerativeAI(apiKey);
            const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
            this.model = this.client.getGenerativeModel({ model: modelName });
            // Don't log in production
            if (process.env.NODE_ENV === 'development') {
                console.log('✅ Gemini AI configured');
            }
        } else if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ GEMINI_API_KEY not configured. Using mock responses.');
        }
    }

    private getSystemPrompt(): string {
        return `You are Arc Agent, an AI assistant for Arc Wallet on the Arc blockchain.
Supported operations:
1. SEND - token, amount, recipient address
2. SWAP - fromToken, toToken, amount
3. CHECK_BALANCE - optional token
4. UNKNOWN - fallback
Return a JSON object with fields: type, params, confidence (0-1), message.`;
    }

    async parseIntent(userMessage: string): Promise<AgentResponse> {
        if (!this.client || !this.model) {
            return this.mockParseIntent(userMessage);
        }
        try {
            const result = await this.model.generateContent([
                { role: 'system', parts: [{ text: this.getSystemPrompt() }] },
                { role: 'user', parts: [{ text: userMessage }] },
            ]);
            const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (!text) throw new Error('No response from Gemini');
            const parsed = JSON.parse(text);
            const intent = IntentSchema.parse({ type: parsed.type, params: parsed.params });
            return {
                message: parsed.message || 'Processed.',
                intent,
                confidence: parsed.confidence ?? 0.8,
            };
        } catch (error) {
            console.error('Gemini parsing error:', error);
            return this.mockParseIntent(userMessage);
        }
    }

    private mockParseIntent(input: string): AgentResponse {
        // Simple mock similar to previous implementation
        const lower = input.toLowerCase();
        if (lower.includes('send')) {
            const amountMatch = input.match(/(\d+\.?\d*)/);
            const amount = amountMatch ? amountMatch[1] : '0';
            let token = 'USDC';
            if (lower.includes('arc')) token = 'ARC';
            if (lower.includes('eurc')) token = 'EURC';
            const addressMatch = input.match(/0x[a-fA-F0-9]{40}/);
            const recipient = addressMatch ? addressMatch[0] : '';
            return {
                message: recipient ? `I'll help you send ${amount} ${token} to ${recipient.slice(0, 6)}...${recipient.slice(-4)}.` : `I detected you want to send ${amount} ${token}, but need a recipient address.`,
                intent: { type: 'SEND', params: { token, amount, recipient } },
                confidence: recipient ? 0.85 : 0.5,
            };
        }
        if (lower.includes('swap')) {
            const amountMatch = input.match(/(\d+\.?\d*)/);
            const amount = amountMatch ? amountMatch[1] : '0';
            let fromToken = 'ARC';
            let toToken = 'USDC';
            if (lower.includes('usdc') && lower.includes('arc')) {
                if (lower.indexOf('usdc') < lower.indexOf('arc')) { fromToken = 'USDC'; toToken = 'ARC'; }
            }
            return {
                message: `I'll prepare a swap of ${amount} ${fromToken} for ${toToken}.`,
                intent: { type: 'SWAP', params: { fromToken, toToken, amount } },
                confidence: 0.8,
            };
        }
        if (lower.includes('balance')) {
            let token: string | undefined;
            if (lower.includes('usdc')) token = 'USDC';
            if (lower.includes('arc')) token = 'ARC';
            if (lower.includes('eurc')) token = 'EURC';
            return {
                message: token ? `Checking your ${token} balance...` : 'Checking your wallet balance...',
                intent: { type: 'CHECK_BALANCE', params: { token } },
                confidence: 0.9,
            };
        }
        return {
            message: "I'm not sure how to help with that. Try asking me to 'send tokens', 'swap tokens', or 'check balance'.",
            intent: { type: 'UNKNOWN', params: {} },
            confidence: 0.3,
        };
    }
}

export const geminiService = new GeminiService();
