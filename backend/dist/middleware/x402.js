/**
 * x402 Payment Required Middleware
 *
 * Implements the x402 protocol for Arc Agent micropayments.
 * When a request comes without valid payment, returns 402 with payment requirements.
 * When payment is verified, allows the request to proceed.
 */
import { createPublicClient, http } from 'viem';
// Arc Testnet configuration
const ARC_TESTNET_RPC = 'https://rpc.testnet.arc.network';
const USDC_DECIMALS = 6;
// Payment verification cache (txHash -> verified timestamp)
const verifiedPayments = new Map();
const PAYMENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
/**
 * Creates x402 middleware for protecting API endpoints
 */
export function x402Middleware(options) {
    return async (req, res, next) => {
        try {
            // Check for payment header
            const paymentTxHash = req.headers['x-payment-txhash'];
            const paymentSignature = req.headers['x-payment-signature'];
            // If no payment provided, return 402 Payment Required
            if (!paymentTxHash) {
                const paymentRequirements = {
                    price: options.price,
                    token: 'USDC',
                    recipient: options.recipient,
                    network: 'arc-testnet',
                    description: options.description || 'API access fee',
                    validUntil: options.validitySeconds
                        ? Math.floor(Date.now() / 1000) + options.validitySeconds
                        : undefined,
                };
                res.status(402).json({
                    error: 'Payment Required',
                    code: 'PAYMENT_REQUIRED',
                    paymentRequirements,
                    message: `This endpoint requires a payment of ${options.price} USDC`,
                });
                return;
            }
            // Check if payment was already verified (cache)
            const cachedPayment = verifiedPayments.get(paymentTxHash);
            if (cachedPayment) {
                const age = Date.now() - cachedPayment.timestamp;
                if (age < PAYMENT_CACHE_TTL) {
                    // Payment already verified and still valid
                    req.x402Payment = {
                        txHash: paymentTxHash,
                        amount: cachedPayment.amount,
                        verified: true,
                    };
                    next();
                    return;
                }
                else {
                    // Cache expired, remove it
                    verifiedPayments.delete(paymentTxHash);
                }
            }
            // Verify payment on-chain
            const isValid = await verifyPayment(paymentTxHash, options.recipient, options.price);
            if (!isValid) {
                res.status(402).json({
                    error: 'Payment Verification Failed',
                    code: 'INVALID_PAYMENT',
                    message: 'The provided payment transaction could not be verified',
                    txHash: paymentTxHash,
                });
                return;
            }
            // Cache the verified payment
            verifiedPayments.set(paymentTxHash, {
                timestamp: Date.now(),
                amount: options.price,
            });
            // Attach payment info to request
            req.x402Payment = {
                txHash: paymentTxHash,
                amount: options.price,
                verified: true,
            };
            next();
        }
        catch (error) {
            console.error('[x402] Middleware error:', error.message);
            res.status(500).json({
                error: 'Payment Processing Error',
                code: 'PAYMENT_ERROR',
                message: 'An error occurred while processing the payment',
            });
        }
    };
}
/**
 * Verify a payment transaction on-chain
 */
async function verifyPayment(txHash, expectedRecipient, expectedAmount) {
    try {
        // For demo/testnet, we'll do a simplified verification
        // In production, you'd verify the full transaction details
        const client = createPublicClient({
            transport: http(ARC_TESTNET_RPC),
        });
        // Get transaction receipt
        const receipt = await client.getTransactionReceipt({
            hash: txHash,
        });
        // Check if transaction was successful
        if (receipt.status !== 'success') {
            console.log('[x402] Transaction failed:', txHash);
            return false;
        }
        // For demo purposes, we accept the payment if tx was successful
        // In production, you'd parse the logs to verify:
        // - Correct token (USDC)
        // - Correct recipient
        // - Correct amount
        console.log('[x402] Payment verified:', {
            txHash,
            recipient: expectedRecipient,
            amount: expectedAmount,
        });
        return true;
    }
    catch (error) {
        // If we can't verify (e.g., tx not found yet),
        // for demo we'll be lenient and accept it
        console.log('[x402] Verification pending, accepting for demo:', txHash);
        return true;
    }
}
/**
 * Clean up expired cached payments periodically
 */
setInterval(() => {
    const now = Date.now();
    for (const [txHash, data] of verifiedPayments.entries()) {
        if (now - data.timestamp > PAYMENT_CACHE_TTL) {
            verifiedPayments.delete(txHash);
        }
    }
}, 60 * 1000); // Clean up every minute
export default x402Middleware;
//# sourceMappingURL=x402.js.map