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
export const UnknownIntentSchema = z.object({
    type: z.literal('UNKNOWN'),
    params: z.object({}),
});
export const IntentSchema = z.discriminatedUnion('type', [
    SendIntentSchema,
    SwapIntentSchema,
    CheckBalanceIntentSchema,
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