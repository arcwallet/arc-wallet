import { geminiService } from './geminiService.js';
import { z } from 'zod';
// Intent schemas (exported for reuse across the project)
export const SendIntentSchema = z.object({
    type: z.literal('SEND'),
    params: z.object({
        token: z.string(),
        amount: z.string(),
        recipient: z.string(),
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
    SwapIntentSchema,
    CheckBalanceIntentSchema,
    BridgeIntentSchema,
    AnalyzeWalletIntentSchema,
    GetPriceIntentSchema,
    GetNewsIntentSchema,
    UnknownIntentSchema,
]);
class AIService {
    async parseIntent(message) {
        // Delegate parsing to Gemini service; it handles both real and mock responses
        return geminiService.parseIntent(message);
    }
    isReady() {
        // Consider the service ready if the Gemini instance exists
        return !!geminiService;
    }
}
export const aiService = new AIService();
//# sourceMappingURL=aiService.js.map