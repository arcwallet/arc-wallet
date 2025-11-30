/**
 * Sepolia ERC-4337 Bundler JSON-RPC Routes
 *
 * Implements the standard ERC-4337 bundler RPC methods for Sepolia chain:
 * - eth_sendUserOperation
 * - eth_getUserOperationByHash
 * - eth_getUserOperationReceipt
 * - eth_estimateUserOperationGas
 * - eth_supportedEntryPoints
 * - eth_chainId
 */

import { Router, Request, Response } from 'express';
import { getSepoliaBundlerService, UserOperation } from '../services/sepoliaBundlerService.js';

const router = Router();

// JSON-RPC Error Codes
const JSONRPC_ERRORS = {
    PARSE_ERROR: { code: -32700, message: 'Parse error' },
    INVALID_REQUEST: { code: -32600, message: 'Invalid Request' },
    METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
    INVALID_PARAMS: { code: -32602, message: 'Invalid params' },
    INTERNAL_ERROR: { code: -32603, message: 'Internal error' },
    REJECTED_BY_EP_OR_ACCOUNT: { code: -32500, message: 'Rejected by entryPoint or account' },
    REJECTED_BY_PAYMASTER: { code: -32501, message: 'Rejected by paymaster' },
    SIGNATURE_VALIDATION_FAILED: { code: -32507, message: 'Signature validation failed' },
};

/**
 * Create JSON-RPC success response
 */
function jsonRpcSuccess(id: number | string | null, result: any) {
    return {
        jsonrpc: '2.0',
        id,
        result,
    };
}

/**
 * Create JSON-RPC error response
 */
function jsonRpcError(id: number | string | null, error: { code: number; message: string; data?: any }) {
    return {
        jsonrpc: '2.0',
        id,
        error,
    };
}

/**
 * Main JSON-RPC endpoint for Sepolia
 * POST /api/bundler/sepolia/rpc
 */
router.post('/rpc', async (req: Request, res: Response) => {
    const { jsonrpc, id, method, params } = req.body;

    // Validate JSON-RPC format
    if (jsonrpc !== '2.0') {
        return res.json(jsonRpcError(id, JSONRPC_ERRORS.INVALID_REQUEST));
    }

    const bundler = getSepoliaBundlerService();

    try {
        let result: any;

        switch (method) {
            case 'eth_sendUserOperation': {
                if (!params || params.length < 2) {
                    return res.json(jsonRpcError(id, JSONRPC_ERRORS.INVALID_PARAMS));
                }
                const [userOp, entryPoint] = params as [UserOperation, string];
                result = await bundler.sendUserOperation(userOp, entryPoint);
                break;
            }

            case 'eth_getUserOperationByHash': {
                if (!params || params.length < 1) {
                    return res.json(jsonRpcError(id, JSONRPC_ERRORS.INVALID_PARAMS));
                }
                const [userOpHash] = params as [string];
                result = await bundler.getUserOperationByHash(userOpHash);
                break;
            }

            case 'eth_getUserOperationReceipt': {
                if (!params || params.length < 1) {
                    return res.json(jsonRpcError(id, JSONRPC_ERRORS.INVALID_PARAMS));
                }
                const [hash] = params as [string];
                result = await bundler.getUserOperationReceipt(hash);
                break;
            }

            case 'eth_estimateUserOperationGas': {
                if (!params || params.length < 2) {
                    return res.json(jsonRpcError(id, JSONRPC_ERRORS.INVALID_PARAMS));
                }
                const [partialOp, ep] = params as [Partial<UserOperation>, string];
                result = await bundler.estimateUserOperationGas(partialOp, ep);
                break;
            }

            case 'eth_supportedEntryPoints': {
                result = bundler.getSupportedEntryPoints();
                break;
            }

            case 'eth_chainId': {
                result = bundler.getChainId();
                break;
            }

            case 'debug_bundler_status': {
                result = bundler.getStatus();
                break;
            }

            case 'debug_bundler_getBalance': {
                result = await bundler.getBalance();
                break;
            }

            default:
                return res.json(jsonRpcError(id, JSONRPC_ERRORS.METHOD_NOT_FOUND));
        }

        return res.json(jsonRpcSuccess(id, result));

    } catch (error: any) {
        console.error(`[Sepolia] Bundler RPC error (${method}):`, error.message);

        let rpcError = JSONRPC_ERRORS.INTERNAL_ERROR;
        let errorData = error.message;

        if (error.message.includes('Unsupported EntryPoint')) {
            rpcError = JSONRPC_ERRORS.INVALID_PARAMS;
        } else if (error.message.includes('signature') || error.message.includes('Signature')) {
            rpcError = JSONRPC_ERRORS.SIGNATURE_VALIDATION_FAILED;
        } else if (error.message.includes('paymaster') || error.message.includes('Paymaster')) {
            rpcError = JSONRPC_ERRORS.REJECTED_BY_PAYMASTER;
        } else if (error.message.includes('insufficient') || error.message.includes('prefund')) {
            rpcError = JSONRPC_ERRORS.REJECTED_BY_EP_OR_ACCOUNT;
        }

        return res.json(jsonRpcError(id, { ...rpcError, data: errorData }));
    }
});

/**
 * Health check endpoint for Sepolia bundler
 * GET /api/bundler/sepolia/health
 */
router.get('/health', async (req: Request, res: Response) => {
    try {
        const bundler = getSepoliaBundlerService();
        const status = bundler.getStatus();
        const balance = await bundler.getBalance();

        res.json({
            success: true,
            status: 'healthy',
            chain: 'sepolia',
            bundler: {
                ...status,
                balance: `${balance} ETH`,
            },
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            chain: 'sepolia',
            error: error.message,
        });
    }
});

/**
 * Get Sepolia bundler status
 * GET /api/bundler/sepolia/status
 */
router.get('/status', async (req: Request, res: Response) => {
    try {
        const bundler = getSepoliaBundlerService();
        const status = bundler.getStatus();
        const balance = await bundler.getBalance();

        res.json({
            success: true,
            chain: 'sepolia',
            ...status,
            balance,
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            chain: 'sepolia',
            error: error.message,
        });
    }
});

export function createSepoliaBundlerRouter(): Router {
    return router;
}

export default router;
