import { Router } from 'express';
import { ethers } from 'ethers';
import { rateLimitMiddleware, validateRequestBody, sanitizeInput } from '../middleware/security.js';
const ENTRY_POINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const RPC_URL = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
// EntryPoint ABI for handleOps
const ENTRY_POINT_ABI = [
    'function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address beneficiary) external',
    'function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)',
];
export function createRelayRoutes() {
    const router = Router();
    // Apply middleware
    router.use(sanitizeInput);
    /**
     * POST /relay/user-operation
     * Relay a signed UserOperation to the EntryPoint
     */
    router.post('/user-operation', rateLimitMiddleware('general'), validateRequestBody(['userOp']), async (req, res, next) => {
        try {
            const { userOp } = req.body;
            // Validate required fields
            const requiredFields = ['sender', 'nonce', 'initCode', 'callData', 'callGasLimit',
                'verificationGasLimit', 'preVerificationGas', 'maxFeePerGas', 'maxPriorityFeePerGas',
                'paymasterAndData', 'signature'];
            for (const field of requiredFields) {
                if (userOp[field] === undefined) {
                    return res.status(400).json({
                        success: false,
                        error: `Missing required field: ${field}`,
                        code: 'INVALID_USER_OP'
                    });
                }
            }
            // Get relay wallet from env (this wallet will pay gas and be reimbursed)
            const relayPrivateKey = process.env.RELAY_PRIVATE_KEY;
            if (!relayPrivateKey) {
                console.error('[Relay] RELAY_PRIVATE_KEY not configured');
                return res.status(500).json({
                    success: false,
                    error: 'Relay service not configured',
                    code: 'RELAY_NOT_CONFIGURED'
                });
            }
            // Setup provider and wallet
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            const relayWallet = new ethers.Wallet(relayPrivateKey, provider);
            const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, ENTRY_POINT_ABI, relayWallet);
            console.log('[Relay] Submitting UserOperation:', {
                sender: userOp.sender,
                nonce: userOp.nonce,
                relayAddress: relayWallet.address
            });
            // Convert hex strings to proper format for contract call
            const userOpForContract = {
                sender: userOp.sender,
                nonce: BigInt(userOp.nonce),
                initCode: userOp.initCode,
                callData: userOp.callData,
                callGasLimit: BigInt(userOp.callGasLimit),
                verificationGasLimit: BigInt(userOp.verificationGasLimit),
                preVerificationGas: BigInt(userOp.preVerificationGas),
                maxFeePerGas: BigInt(userOp.maxFeePerGas),
                maxPriorityFeePerGas: BigInt(userOp.maxPriorityFeePerGas),
                paymasterAndData: userOp.paymasterAndData,
                signature: userOp.signature,
            };
            // Call handleOps with the UserOperation
            // beneficiary is the relay wallet (receives gas refund)
            const tx = await entryPoint.handleOps([userOpForContract], relayWallet.address, {
                gasLimit: 2000000n, // Conservative gas limit
            });
            console.log('[Relay] Transaction submitted:', tx.hash);
            // Wait for transaction
            const receipt = await tx.wait();
            console.log('[Relay] Transaction confirmed:', {
                hash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString()
            });
            return res.status(200).json({
                success: true,
                data: {
                    transactionHash: receipt.hash,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed.toString(),
                }
            });
        }
        catch (error) {
            console.error('[Relay] Error:', error);
            // Parse common errors
            let errorMessage = 'Transaction relay failed';
            let errorCode = 'RELAY_FAILED';
            if (error.message?.includes('insufficient funds')) {
                errorMessage = 'Relay wallet has insufficient funds';
                errorCode = 'INSUFFICIENT_RELAY_FUNDS';
            }
            else if (error.message?.includes('AA')) {
                // ERC-4337 specific errors
                errorMessage = `UserOperation validation failed: ${error.message}`;
                errorCode = 'USER_OP_VALIDATION_FAILED';
            }
            else if (error.message?.includes('reverted')) {
                errorMessage = `Transaction reverted: ${error.reason || error.message}`;
                errorCode = 'TRANSACTION_REVERTED';
            }
            return res.status(500).json({
                success: false,
                error: errorMessage,
                code: errorCode,
                details: error.message
            });
        }
    });
    /**
     * GET /relay/status
     * Check relay service status
     */
    router.get('/status', async (req, res) => {
        try {
            const relayPrivateKey = process.env.RELAY_PRIVATE_KEY;
            if (!relayPrivateKey) {
                return res.status(200).json({
                    success: true,
                    data: {
                        available: false,
                        reason: 'Relay wallet not configured'
                    }
                });
            }
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            const relayWallet = new ethers.Wallet(relayPrivateKey, provider);
            const balance = await provider.getBalance(relayWallet.address);
            return res.status(200).json({
                success: true,
                data: {
                    available: true,
                    relayAddress: relayWallet.address,
                    balance: ethers.formatUnits(balance, 6), // USDC has 6 decimals on Arc
                    balanceWei: balance.toString()
                }
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                error: 'Failed to check relay status',
                details: error.message
            });
        }
    });
    return router;
}
//# sourceMappingURL=relay.js.map