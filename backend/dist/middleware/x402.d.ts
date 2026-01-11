import { Request, Response, NextFunction } from 'express';
export interface X402PaymentRequirements {
    price: string;
    token: string;
    recipient: string;
    network: string;
    description?: string;
    validUntil?: number;
}
export interface X402MiddlewareOptions {
    price: string;
    recipient: string;
    description?: string;
    validitySeconds?: number;
}
export declare function x402Middleware(options: X402MiddlewareOptions): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export default x402Middleware;
//# sourceMappingURL=x402.d.ts.map