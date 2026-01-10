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
    UnknownIntentSchema,
]);
class AIService {
    openai = null;
    provider = 'gemini';
    fineTunedModel = null;
    constructor() {
        this.initializeProviders();
    }
    initializeProviders() {
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
    getProvider() {
        return this.provider;
    }
    async parseIntent(message) {
        try {
            // Use fine-tuned model if available
            if (this.provider === 'openai-finetuned' && this.openai && this.fineTunedModel) {
                return await this.parseWithFineTunedModel(message);
            }
            // Use standard OpenAI
            if (this.provider === 'openai' && this.openai) {
                return await this.parseWithOpenAI(message);
            }
            // Fallback to Gemini
            return geminiService.parseIntent(message);
        }
        catch (error) {
            console.error('AI parsing error, falling back to Gemini:', error);
            return geminiService.parseIntent(message);
        }
    }
    /**
     * Parse with fine-tuned model - BEST ACCURACY
     * The model was trained specifically for crypto wallet intents
     */
    async parseWithFineTunedModel(message) {
        if (!this.openai || !this.fineTunedModel) {
            throw new Error('Fine-tuned model not configured');
        }
        const response = await this.openai.chat.completions.create({
            model: this.fineTunedModel,
            messages: [
                {
                    role: 'system',
                    content: 'You are Arc Agent, a crypto wallet AI. Extract intent and respond in user\'s language.',
                },
                {
                    role: 'user',
                    content: message,
                },
            ],
            temperature: 0.2, // Low temperature for consistent outputs
            max_tokens: 500,
        });
        const content = response.choices[0]?.message?.content;
        if (!content)
            throw new Error('No response from fine-tuned model');
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
    async parseWithOpenAI(message) {
        if (!this.openai)
            throw new Error('OpenAI not configured');
        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `You are a crypto wallet AI. Extract intent from user message in ANY language.
Return JSON: {"type":"SEND|SWAP|BRIDGE|CHECK_BALANCE|ANALYZE_WALLET|GET_PRICE|GET_NEWS|UNKNOWN","params":{...},"confidence":0-1,"message":"response in user's language"}
- SEND: {token, amount, recipient}
- SWAP: {fromToken, toToken, amount}
- BRIDGE: {amount, fromChain, toChain}
Default token is USDC. Extract numbers and 0x addresses from anywhere.`,
                },
                {
                    role: 'user',
                    content: message,
                },
            ],
            temperature: 0.3,
            max_tokens: 500,
            response_format: { type: 'json_object' },
        });
        const content = response.choices[0]?.message?.content;
        if (!content)
            throw new Error('No response from OpenAI');
        const parsed = JSON.parse(content.trim());
        const intent = IntentSchema.parse({ type: parsed.type, params: parsed.params || {} });
        return {
            message: parsed.message || 'Processing...',
            intent,
            confidence: parsed.confidence ?? 0.85,
        };
    }
    isReady() {
        return this.provider !== 'mock';
    }
}
export const aiService = new AIService();
//# sourceMappingURL=aiService.js.map