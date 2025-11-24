import { z } from 'zod';
declare const IntentSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
    constructor();
    private getSystemPrompt;
    parseIntent(userMessage: string): Promise<AgentResponse>;
    private mockParseIntent;
}
export declare const geminiService: GeminiService;
export {};
//# sourceMappingURL=geminiService.d.ts.map