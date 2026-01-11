import { z } from 'zod';
declare const IntentSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"SEND">;
    params: z.ZodObject<{
        token: z.ZodString;
        amount: z.ZodString;
        recipient: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"SCHEDULED_SEND">;
    params: z.ZodObject<{
        token: z.ZodString;
        amount: z.ZodString;
        recipient: z.ZodString;
        delayMinutes: z.ZodNumber;
        scheduledTime: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"SWAP">;
    params: z.ZodObject<{
        fromToken: z.ZodString;
        toToken: z.ZodString;
        amount: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"CHECK_BALANCE">;
    params: z.ZodObject<{
        token: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"BRIDGE">;
    params: z.ZodObject<{
        fromChain: z.ZodOptional<z.ZodString>;
        toChain: z.ZodOptional<z.ZodString>;
        amount: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"ANALYZE_WALLET">;
    params: z.ZodObject<{
        address: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"GET_PRICE">;
    params: z.ZodObject<{
        token: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"GET_NEWS">;
    params: z.ZodObject<{}, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"GET_TRANSACTIONS">;
    params: z.ZodObject<{
        address: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"UNKNOWN">;
    params: z.ZodObject<{}, z.core.$strip>;
}, z.core.$strip>], "type">;
type Intent = z.infer<typeof IntentSchema>;
export interface AgentResponse {
    message: string;
    intent: Intent;
    confidence: number;
}
declare class GeminiService {
    private client;
    private model;
    private tunedModel;
    private isTuned;
    constructor();
    private getSystemPrompt;
    parseIntent(userMessage: string, conversationHistory?: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>): Promise<AgentResponse>;
    private mockParseIntent;
}
export declare const geminiService: GeminiService;
export {};
//# sourceMappingURL=geminiService.d.ts.map