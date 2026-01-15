import { geminiService } from './geminiService.js';
import { z } from 'zod';
import OpenAI from 'openai';

// Intent schemas (exported for reuse across the project)
export const SendIntentSchema = z.object({
    type: z.literal('SEND'),
    params: z.object({
        token: z.string(),
        amount: z.string(),
        recipient: z.string(),
    }),
});

export const ScheduledSendIntentSchema = z.object({
    type: z.literal('SCHEDULED_SEND'),
    params: z.object({
        token: z.string(),
        amount: z.string(),
        recipient: z.string(),
        delayMinutes: z.number(),
        scheduledTime: z.string().optional(),
    }),
});

export const SwapIntentSchema = z.object({
    type: z.literal('SWAP'),
    params: z.object({
        fromToken: z.string(),
        toToken: z.string(),
        amount: z.string(),
    }),
});

export const CheckBalanceIntentSchema = z.object({
    type: z.literal('CHECK_BALANCE'),
    params: z.object({
        token: z.string().optional(),
    }),
});

export const BridgeIntentSchema = z.object({
    type: z.literal('BRIDGE'),
    params: z.object({
        fromChain: z.string().optional(),
        toChain: z.string().optional(),
        amount: z.string().optional(),
    }),
});

export const AnalyzeWalletIntentSchema = z.object({
    type: z.literal('ANALYZE_WALLET'),
    params: z.object({
        address: z.string(),
    }),
});

export const GetPriceIntentSchema = z.object({
    type: z.literal('GET_PRICE'),
    params: z.object({
        token: z.string().optional(),
    }),
});

export const GetNewsIntentSchema = z.object({
    type: z.literal('GET_NEWS'),
    params: z.object({}),
});

export const GetTransactionsIntentSchema = z.object({
    type: z.literal('GET_TRANSACTIONS'),
    params: z.object({
        address: z.string(),
    }),
});

export const UnknownIntentSchema = z.object({
    type: z.literal('UNKNOWN'),
    params: z.object({}),
});

export const IntentSchema = z.discriminatedUnion('type', [
    SendIntentSchema,
    ScheduledSendIntentSchema,
    SwapIntentSchema,
    CheckBalanceIntentSchema,
    BridgeIntentSchema,
    AnalyzeWalletIntentSchema,
    GetPriceIntentSchema,
    GetNewsIntentSchema,
    GetTransactionsIntentSchema,
    UnknownIntentSchema,
]);

export type Intent = z.infer<typeof IntentSchema>;

export interface AgentResponse {
    message: string;
    intent: Intent;
    confidence: number;
}

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
}

type AIProvider = 'openai-finetuned' | 'openai' | 'gemini' | 'mock';

class AIService {
    private openai: OpenAI | null = null;
    private provider: AIProvider = 'gemini';
    private fineTunedModel: string | null = null;

    constructor() {
        this.initializeProviders();
    }

    private initializeProviders(): void {
        const openaiKey = process.env.OPENAI_API_KEY;
        const fineTunedModel = process.env.OPENAI_FINE_TUNED_MODEL;

        // Priority 1: Fine-tuned OpenAI model (best for our use case)
        if (openaiKey && fineTunedModel) {
            this.openai = new OpenAI({ apiKey: openaiKey });
            this.fineTunedModel = fineTunedModel;
            this.provider = 'openai-finetuned';
            console.log(`🧠 AI Service: Using FINE-TUNED model (${fineTunedModel.slice(0, 40)}...)`);
            return;
        }

        // Priority 2: Standard OpenAI (good multilingual support)
        if (openaiKey) {
            this.openai = new OpenAI({ apiKey: openaiKey });
            this.provider = 'openai';
            console.log('🤖 AI Service: Using OpenAI GPT-4o-mini');
            return;
        }

        // Priority 3: Gemini (default)
        this.provider = 'gemini';
        console.log('✨ AI Service: Using Gemini');
    }

    getProvider(): AIProvider {
        return this.provider;
    }

    async parseIntent(message: string, conversationHistory?: ConversationMessage[]): Promise<AgentResponse> {
        try {
            // Use fine-tuned model if available
            if (this.provider === 'openai-finetuned' && this.openai && this.fineTunedModel) {
                return await this.parseWithFineTunedModel(message, conversationHistory);
            }

            // Use standard OpenAI
            if (this.provider === 'openai' && this.openai) {
                return await this.parseWithOpenAI(message, conversationHistory);
            }

            // Fallback to Gemini
            return geminiService.parseIntent(message, conversationHistory);
        } catch (error) {
            console.error('AI parsing error, falling back to Gemini:', error);
            return geminiService.parseIntent(message, conversationHistory);
        }
    }

    /**
     * Parse with fine-tuned model - BEST ACCURACY
     * The model was trained specifically for crypto wallet intents
     */
    private async parseWithFineTunedModel(message: string, conversationHistory?: ConversationMessage[]): Promise<AgentResponse> {
        if (!this.openai || !this.fineTunedModel) {
            throw new Error('Fine-tuned model not configured');
        }

        // Build messages array with conversation history
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            {
                role: 'system',
                content: `You are Arc Agent, a crypto wallet AI. Extract intent from user messages.
Intent types: SEND, SCHEDULED_SEND, SWAP, BRIDGE, CHECK_BALANCE, ANALYZE_WALLET, GET_PRICE, GET_NEWS, GET_TRANSACTIONS, UNKNOWN
Use SCHEDULED_SEND when user wants to send later: "in X minutes", "after X hours", "later", "schedule"
SCHEDULED_SEND params: {token, amount, recipient, delayMinutes}
Use GET_TRANSACTIONS when user pastes a wallet address or asks about transaction history: "0x...", "transactions", "history"
GET_TRANSACTIONS params: {address}
IMPORTANT: Use conversation history to understand context. If user refers to "same address", "to them", "there", look at previous messages for the address/token/amount.`,
            },
        ];

        // Add conversation history (last 10 messages for context)
        if (conversationHistory && conversationHistory.length > 0) {
            const recentHistory = conversationHistory.slice(-10);
            for (const msg of recentHistory) {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content,
                });
            }
        }

        // Add current message
        messages.push({ role: 'user', content: message });

        const response = await this.openai.chat.completions.create({
            model: this.fineTunedModel,
            messages,
            temperature: 0.2, // Low temperature for consistent outputs
            max_tokens: 500,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error('No response from fine-tuned model');

        const parsed = JSON.parse(content.trim());
        const intent = IntentSchema.parse({ type: parsed.type, params: parsed.params || {} });

        return {
            message: parsed.message || 'Processing...',
            intent,
            confidence: parsed.confidence ?? 0.95, // Fine-tuned model is more accurate
        };
    }

    /**
     * Parse with standard OpenAI model
     */
    private async parseWithOpenAI(message: string, conversationHistory?: ConversationMessage[]): Promise<AgentResponse> {
        if (!this.openai) throw new Error('OpenAI not configured');

        // Build messages array with conversation history
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            {
                role: 'system',
                content: `You are a crypto wallet AI. Extract intent from user messages.
Return JSON: {"type":"SEND|SCHEDULED_SEND|SWAP|BRIDGE|CHECK_BALANCE|ANALYZE_WALLET|GET_PRICE|GET_NEWS|GET_TRANSACTIONS|UNKNOWN","params":{...},"confidence":0-1,"message":"response message"}
- SEND: {token, amount, recipient} - Immediate transfer
- SCHEDULED_SEND: {token, amount, recipient, delayMinutes} - Transfer after delay. Use when user says "in X minutes", "later", "after X min", "schedule"
  * "in 10 minutes" = delayMinutes: 10
  * "in 1 hour" = delayMinutes: 60
  * "tomorrow" = delayMinutes: 1440
- SWAP: {fromToken, toToken, amount}
- BRIDGE: {amount, fromChain, toChain}
- GET_TRANSACTIONS: {address} - When user pastes a 0x address or asks for transaction history
Default token is USDC. Extract numbers and 0x addresses from anywhere.

IMPORTANT: Use conversation history to understand context references like:
- "same address" - use address from previous messages
- "to them", "there" - refer to previous recipient
- "same amount" - use amount from previous messages
- "again" - repeat previous action`,
            },
        ];

        // Add conversation history (last 6 messages for context, fewer for JSON mode)
        if (conversationHistory && conversationHistory.length > 0) {
            const recentHistory = conversationHistory.slice(-6);
            for (const msg of recentHistory) {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content,
                });
            }
        }

        // Add current message
        messages.push({ role: 'user', content: message });

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.3,
            max_tokens: 500,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error('No response from OpenAI');

        const parsed = JSON.parse(content.trim());
        const intent = IntentSchema.parse({ type: parsed.type, params: parsed.params || {} });

        return {
            message: parsed.message || 'Processing...',
            intent,
            confidence: parsed.confidence ?? 0.85,
        };
    }

    isReady(): boolean {
        return this.provider !== 'mock';
    }
}

export const aiService = new AIService();
