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
    private tunedModel: any = null;
    private isTuned: boolean = false;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey && apiKey.startsWith('AIza')) {
            this.client = new GoogleGenerativeAI(apiKey);

            // Check for tuned model first (priority)
            const tunedModelName = process.env.GEMINI_TUNED_MODEL;
            if (tunedModelName) {
                this.tunedModel = this.client.getGenerativeModel({ model: tunedModelName });
                this.isTuned = true;
                if (process.env.NODE_ENV === 'development') {
                    console.log(`✅ Gemini Tuned Model configured: ${tunedModelName}`);
                }
            }

            // Also initialize base model as fallback
            const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
            this.model = this.client.getGenerativeModel({ model: modelName });

            if (process.env.NODE_ENV === 'development' && !this.isTuned) {
                console.log(`✅ Gemini AI configured: ${modelName}`);
            }
        } else if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ GEMINI_API_KEY not configured. Using mock responses.');
        }
    }

    private getSystemPrompt(): string {
        return `You are a crypto wallet AI that extracts transaction intent from natural language in ANY language.

YOUR ONLY JOB: Extract structured data from user messages. Language doesn't matter - understand the INTENT.

## INTENTS AND REQUIRED ENTITIES:

SEND: Transfer tokens
- amount: number (REQUIRED - extract from anywhere in text)
- token: string (default "USDC" if not mentioned)
- recipient: 0x address (REQUIRED - 42 char hex string)

SWAP: Exchange tokens
- amount: number (REQUIRED)
- fromToken: string (default "USDC")
- toToken: string (REQUIRED - what they want to receive)

BRIDGE: Cross-chain transfer to Base Sepolia
- amount: number (REQUIRED)
- fromChain: "arc" (default)
- toChain: "base sepolia" (default)

CHECK_BALANCE: View wallet balance
- token: string (optional)

ANALYZE_WALLET: Risk analysis
- address: 0x address (REQUIRED)

GET_PRICE: Token price lookup
- token: string (REQUIRED)

GET_NEWS: Market news (no params)

UNKNOWN: Can't determine intent

## ENTITY EXTRACTION RULES:
1. Numbers can be anywhere: "göndermek istiyorum 50 usdc" → amount: "50"
2. Addresses are always 0x + 40 hex chars
3. Token names: USDC, EURC, ARC, ETH, BTC (case insensitive)
4. Chain names: arc, base, base sepolia, sepolia

## RESPONSE FORMAT:
{
  "type": "SEND|SWAP|BRIDGE|CHECK_BALANCE|ANALYZE_WALLET|GET_PRICE|GET_NEWS|UNKNOWN",
  "params": { extracted entities },
  "confidence": 0.0-1.0,
  "message": "Response in USER'S LANGUAGE - confirm what you'll do or ask for missing info"
}

## EXAMPLES:

User: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e adresine 25 usdc gönder"
{"type":"SEND","params":{"amount":"25","token":"USDC","recipient":"0x742d35Cc6634C0532925a3b844Bc454e4438f44e"},"confidence":0.95,"message":"25 USDC gönderiyorum 0x742d...f44e adresine"}

User: "quiero enviar 100 dolares a 0xabc123..."
{"type":"SEND","params":{"amount":"100","token":"USDC","recipient":"0xabc123..."},"confidence":0.9,"message":"Enviando 100 USDC a 0xabc1..."}

User: "bridge 50 to base"
{"type":"BRIDGE","params":{"amount":"50","fromChain":"arc","toChain":"base sepolia"},"confidence":0.9,"message":"Bridging 50 USDC from Arc to Base Sepolia"}

User: "bakiyem ne kadar"
{"type":"CHECK_BALANCE","params":{},"confidence":0.95,"message":"Cüzdan bakiyenizi kontrol ediyorum"}

User: "50 tane eurc al"
{"type":"SWAP","params":{"amount":"50","fromToken":"USDC","toToken":"EURC"},"confidence":0.85,"message":"50 USDC'yi EURC'ye çeviriyorum"}`;
    }

    async parseIntent(userMessage: string): Promise<AgentResponse> {
        if (!this.client || (!this.model && !this.tunedModel)) {
            return this.mockParseIntent(userMessage);
        }

        // Try tuned model first if available
        if (this.isTuned && this.tunedModel) {
            try {
                const result = await this.tunedModel.generateContent(userMessage);
                const text = result.response?.text?.() || result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!text) throw new Error('No response from tuned model');

                const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/);
                const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
                const parsed = JSON.parse(jsonStr.trim());

                const intent = IntentSchema.parse({ type: parsed.type, params: parsed.params });
                return {
                    message: parsed.message || 'Processed.',
                    intent,
                    confidence: parsed.confidence ?? 0.95, // Higher confidence for tuned model
                };
            } catch (error) {
                console.warn('Tuned model failed, falling back to base model:', error);
                // Fall through to base model
            }
        }

        // Base model with system prompt
        try {
            const fullPrompt = `${this.getSystemPrompt()}\n\nUser message: "${userMessage}"\n\nRespond with only valid JSON:`;
            const result = await this.model.generateContent(fullPrompt);
            const text = result.response?.text?.() || result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error('No response from Gemini');

            // Extract JSON from response (handle markdown code blocks)
            const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
            const parsed = JSON.parse(jsonStr.trim());

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
        // Multilingual mock parser - fallback when Gemini unavailable
        const lower = input.toLowerCase();
        const addressMatch = input.match(/0x[a-fA-F0-9]{40}/);
        const amountMatch = input.match(/(\d+\.?\d*)/);
        const amount = amountMatch ? amountMatch[1] : '';

        // Detect token from text
        const detectToken = (): string => {
            if (lower.includes('eurc')) return 'EURC';
            if (lower.includes('arc') && !lower.includes('arc ')) return 'ARC';
            if (lower.includes('eth')) return 'ETH';
            if (lower.includes('btc')) return 'BTC';
            return 'USDC';
        };

        // ANALYZE_WALLET - multilingual keywords
        const analyzeKeywords = ['analyze', 'analiz', 'risk', 'güvenli', 'safe', 'check address', 'kontrol', 'analizar', 'sicher'];
        if (addressMatch && analyzeKeywords.some(k => lower.includes(k))) {
            return {
                message: `Analyzing wallet ${addressMatch[0].slice(0, 6)}...${addressMatch[0].slice(-4)}`,
                intent: { type: 'ANALYZE_WALLET', params: { address: addressMatch[0] } },
                confidence: 0.9,
            };
        }

        // GET_PRICE - multilingual keywords
        const priceKeywords = ['price', 'fiyat', 'precio', 'preis', 'worth', 'değer', 'kaç', 'how much is', 'quanto'];
        if (priceKeywords.some(k => lower.includes(k))) {
            return {
                message: `Getting ${detectToken()} price...`,
                intent: { type: 'GET_PRICE', params: { token: detectToken() } },
                confidence: 0.9,
            };
        }

        // GET_NEWS - multilingual keywords
        const newsKeywords = ['news', 'haber', 'noticias', 'nachrichten', 'market', 'piyasa', 'mercado', 'markt'];
        if (newsKeywords.some(k => lower.includes(k))) {
            return {
                message: "Fetching market news...",
                intent: { type: 'GET_NEWS', params: {} },
                confidence: 0.9,
            };
        }

        // BRIDGE - multilingual keywords
        const bridgeKeywords = ['bridge', 'köprü', 'köprüle', 'puente', 'brücke', 'cross-chain', 'to base', 'base sepolia'];
        if (bridgeKeywords.some(k => lower.includes(k))) {
            return {
                message: amount ? `Bridging ${amount} USDC to Base Sepolia...` : 'Please specify amount to bridge',
                intent: { type: 'BRIDGE', params: { fromChain: 'arc', toChain: 'base sepolia', amount } },
                confidence: amount ? 0.85 : 0.5,
            };
        }

        // SEND - multilingual keywords
        const sendKeywords = ['send', 'gönder', 'gonder', 'yolla', 'transfer', 'enviar', 'senden', 'mandar', 'at'];
        if (sendKeywords.some(k => lower.includes(k)) || (addressMatch && amount)) {
            const token = detectToken();
            const recipient = addressMatch ? addressMatch[0] : '';
            return {
                message: recipient
                    ? `Sending ${amount} ${token} to ${recipient.slice(0, 6)}...${recipient.slice(-4)}`
                    : `Please provide recipient address`,
                intent: { type: 'SEND', params: { token, amount, recipient } },
                confidence: recipient && amount ? 0.9 : 0.5,
            };
        }

        // SWAP - multilingual keywords
        const swapKeywords = ['swap', 'takas', 'değiştir', 'degistir', 'çevir', 'cevir', 'exchange', 'convert', 'intercambiar', 'tauschen', 'al ', 'buy'];
        if (swapKeywords.some(k => lower.includes(k))) {
            let fromToken = 'USDC';
            let toToken = 'EURC';
            if (lower.includes('eurc') && (lower.includes('usdc') || lower.includes('dolar'))) {
                // Check order
                if (lower.indexOf('eurc') < lower.indexOf('usdc')) {
                    fromToken = 'EURC'; toToken = 'USDC';
                }
            }
            if (lower.includes('eurc') && !lower.includes('usdc')) toToken = 'EURC';
            return {
                message: `Swapping ${amount} ${fromToken} to ${toToken}...`,
                intent: { type: 'SWAP', params: { fromToken, toToken, amount } },
                confidence: amount ? 0.85 : 0.5,
            };
        }

        // CHECK_BALANCE - multilingual keywords
        const balanceKeywords = ['balance', 'bakiye', 'bakiyem', 'saldo', 'guthaben', 'ne kadar', 'how much do i have', 'cuanto tengo'];
        if (balanceKeywords.some(k => lower.includes(k))) {
            const token = lower.includes('usdc') ? 'USDC' : lower.includes('eurc') ? 'EURC' : undefined;
            return {
                message: 'Checking wallet balance...',
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
