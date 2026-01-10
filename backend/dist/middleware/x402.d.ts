/**
 * x402 Payment Required Middleware
 *
 * Implements the x402 protocol for Arc Agent micropayments.
 * When a request comes without valid payment, returns 402 with payment requirements.
 * When payment is verified, allows the request to proceed.
 */
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
/**
 * Creates x402 middleware for protecting API endpoints
 */
export declare function x402Middleware(options: X402MiddlewareOptions): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export default x402Middleware;
//# sourceMappingURL=x402.d.ts.map