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
import { Router } from 'express';
declare const router: import("express-serve-static-core").Router;
export declare function createSepoliaBundlerRouter(): Router;
export default router;
//# sourceMappingURL=sepoliaBundler.d.ts.map