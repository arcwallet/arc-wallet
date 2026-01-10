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

const BridgeIntentSchema = z.object({
    type: z.literal('BRIDGE'),
    params: z.object({
        fromChain: z.string().optional(),
        toChain: z.string().optional(),
        amount: z.string().optional(),
    }),
});

const AnalyzeWalletIntentSchema = z.object({
    type: z.literal('ANALYZE_WALLET'),
    params: z.object({
        address: z.string(),
    }),
});

const GetPriceIntentSchema = z.object({
    type: z.literal('GET_PRICE'),
    params: z.object({
        token: z.string().optional(),
    }),
});

const GetNewsIntentSchema = z.object({
    type: z.literal('GET_NEWS'),
    params: z.object({}),
});

const UnknownIntentSchema = z.object({
    type: z.literal('UNKNOWN'),
    params: z.object({}),
});

const IntentSchema = z.discriminatedUnion('type', [
    SendIntentSchema,
    SwapIntentSchema,
    CheckBalanceIntentSchema,
    BridgeIntentSchema,
    AnalyzeWalletIntentSchema,
    GetPriceIntentSchema,
    GetNewsIntentSchema,
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
            const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
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
1. SEND - token, amount, recipient address (e.g., "send 10 USDC to 0x...")
2. SWAP - fromToken, toToken, amount (e.g., "swap 50 USDC to EURC")
3. CHECK_BALANCE - optional token (e.g., "check my balance")
4. BRIDGE - fromChain, toChain, amount (e.g., "bridge 100 USDC to Base")
5. ANALYZE_WALLET - address (e.g., "analyze 0x..." or "is 0x... safe?")
6. GET_PRICE - token (e.g., "price of ETH" or "what's BTC worth?")
7. GET_NEWS - no params (e.g., "market news" or "crypto news")
8. UNKNOWN - fallback for unclear requests
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
        // Enhanced mock with all intent types
        const lower = input.toLowerCase();

        // ANALYZE_WALLET - check for address analysis requests
        const addressMatch = input.match(/0x[a-fA-F0-9]{40}/);
        if ((lower.includes('analyze') || lower.includes('risk') || lower.includes('check') || lower.includes('safe')) && addressMatch) {
            return {
                message: `I'll analyze the wallet ${addressMatch[0].slice(0, 6)}...${addressMatch[0].slice(-4)} for risk factors.`,
                intent: { type: 'ANALYZE_WALLET', params: { address: addressMatch[0] } },
                confidence: 0.9,
            };
        }

        // GET_PRICE - check for price queries
        if (lower.includes('price') || lower.includes('worth') || lower.includes('cost')) {
            let token = 'USDC';
            if (lower.includes('eth') || lower.includes('ethereum')) token = 'ETH';
            if (lower.includes('btc') || lower.includes('bitcoin')) token = 'BTC';
            if (lower.includes('eurc')) token = 'EURC';
            if (lower.includes('arc')) token = 'ARC';
            return {
                message: `I'll get the current price data for ${token}.`,
                intent: { type: 'GET_PRICE', params: { token } },
                confidence: 0.9,
            };
        }

        // GET_NEWS - check for news requests
        if (lower.includes('news') || lower.includes('market') || lower.includes('headlines') || lower.includes('update')) {
            return {
                message: "I'll fetch the latest market news and sentiment analysis.",
                intent: { type: 'GET_NEWS', params: {} },
                confidence: 0.9,
            };
        }

        // BRIDGE - check for bridge requests
        if (lower.includes('bridge') || lower.includes('transfer to base') || lower.includes('cross-chain')) {
            const amountMatch = input.match(/(\d+\.?\d*)/);
            const amount = amountMatch ? amountMatch[1] : '';
            return {
                message: "I'll help you bridge assets between chains.",
                intent: { type: 'BRIDGE', params: { fromChain: 'arc', toChain: 'base', amount } },
                confidence: 0.8,
            };
        }

        // SEND - check for send requests
        if (lower.includes('send') || lower.includes('transfer')) {
            const amountMatch = input.match(/(\d+\.?\d*)/);
            const amount = amountMatch ? amountMatch[1] : '0';
            let token = 'USDC';
            if (lower.includes('arc')) token = 'ARC';
            if (lower.includes('eurc')) token = 'EURC';
            const recipient = addressMatch ? addressMatch[0] : '';
            return {
                message: recipient ? `I'll help you send ${amount} ${token} to ${recipient.slice(0, 6)}...${recipient.slice(-4)}.` : `I detected you want to send ${amount} ${token}, but need a recipient address.`,
                intent: { type: 'SEND', params: { token, amount, recipient } },
                confidence: recipient ? 0.85 : 0.5,
            };
        }

        // SWAP - check for swap requests
        if (lower.includes('swap') || lower.includes('exchange') || lower.includes('convert')) {
            const amountMatch = input.match(/(\d+\.?\d*)/);
            const amount = amountMatch ? amountMatch[1] : '0';
            let fromToken = 'USDC';
            let toToken = 'EURC';
            if (lower.includes('usdc') && lower.includes('eurc')) {
                if (lower.indexOf('eurc') < lower.indexOf('usdc')) { fromToken = 'EURC'; toToken = 'USDC'; }
            }
            return {
                message: `I'll prepare a swap of ${amount} ${fromToken} for ${toToken}.`,
                intent: { type: 'SWAP', params: { fromToken, toToken, amount } },
                confidence: 0.8,
            };
        }

        // CHECK_BALANCE - check for balance queries
        if (lower.includes('balance') || lower.includes('how much')) {
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

        // UNKNOWN - fallback
        return {
            message: "I can help you with:\n- Sending tokens (e.g., 'send 10 USDC to 0x...')\n- Swapping tokens (e.g., 'swap 50 USDC to EURC')\n- Analyzing wallets (e.g., 'analyze 0x...')\n- Getting prices (e.g., 'price of ETH')\n- Market news (e.g., 'crypto news')\n\nWhat would you like to do?",
            intent: { type: 'UNKNOWN', params: {} },
            confidence: 0.3,
        };
    }
}

export const geminiService = new GeminiService();
