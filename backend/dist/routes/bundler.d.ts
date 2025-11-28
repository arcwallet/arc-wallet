/**
 * ERC-4337 Bundler JSON-RPC Routes
 *
 * Implements the standard ERC-4337 bundler RPC methods:
 * - eth_sendUserOperation
 * - eth_getUserOperationByHash
 * - eth_getUserOperationReceipt
 * - eth_estimateUserOperationGas
 * - eth_supportedEntryPoints
 * - eth_chainId
 *
 * Also includes admin endpoints for monitoring.
 */
import { Router } from 'express';
declare const router: import("express-serve-static-core").Router;
export declare function createBundlerRouter(): Router;
export default router;
//# sourceMappingURL=bundler.d.ts.map