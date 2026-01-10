import { z } from 'zod';
export declare const SendIntentSchema: z.ZodObject<{
    type: z.ZodLiteral<"SEND">;
    params: z.ZodObject<{
        token: z.ZodString;
        amount: z.ZodString;
        recipient: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const SwapIntentSchema: z.ZodObject<{
    type: z.ZodLiteral<"SWAP">;
    params: z.ZodObject<{
        fromToken: z.ZodString;
        toToken: z.ZodString;
        amount: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const CheckBalanceIntentSchema: z.ZodObject<{
    type: z.ZodLiteral<"CHECK_BALANCE">;
    params: z.ZodObject<{
        token: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const BridgeIntentSchema: z.ZodObject<{
    type: z.ZodLiteral<"BRIDGE">;
    params: z.ZodObject<{
        fromChain: z.ZodOptional<z.ZodString>;
        toChain: z.ZodOptional<z.ZodString>;
        amount: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const AnalyzeWalletIntentSchema: z.ZodObject<{
    type: z.ZodLiteral<"ANALYZE_WALLET">;
    params: z.ZodObject<{
        address: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const GetPriceIntentSchema: z.ZodObject<{
    type: z.ZodLiteral<"GET_PRICE">;
    params: z.ZodObject<{
        token: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const GetNewsIntentSchema: z.ZodObject<{
    type: z.ZodLiteral<"GET_NEWS">;
    params: z.ZodObject<{}, z.core.$strip>;
}, z.core.$strip>;
export declare const UnknownIntentSchema: z.ZodObject<{
    type: z.ZodLiteral<"UNKNOWN">;
    params: z.ZodObject<{}, z.core.$strip>;
}, z.core.$strip>;
export declare const IntentSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"SEND">;
    params: z.ZodObject<{
        token: z.ZodString;
        amount: z.ZodString;
        recipient: z.ZodString;
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
    type: z.ZodLiteral<"UNKNOWN">;
    params: z.ZodObject<{}, z.core.$strip>;
}, z.core.$strip>], "type">;
export type Intent = z.infer<typeof IntentSchema>;
export interface AgentResponse {
    message: string;
    intent: Intent;
    confidence: number;
}
declare class AIService {
    parseIntent(message: string): Promise<AgentResponse>;
    isReady(): boolean;
}
export declare const aiService: AIService;
export {};
//# sourceMappingURL=aiService.d.ts.map