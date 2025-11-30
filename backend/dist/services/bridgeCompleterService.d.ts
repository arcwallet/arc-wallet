/**
 * BridgeCompleterService - Auto-complete CCTP bridge claims
 *
 * This service monitors pending bridge transactions and automatically
 * completes the claim (receiveMessage) on the destination chain when
 * the Circle attestation is ready.
 *
 * ENTERPRISE WALLET APPROACH:
 * - User initiates burn on source chain
 * - Backend monitors Circle attestation API
 * - Backend auto-executes receiveMessage on destination chain
 * - User receives USDC without manual claim
 */
export declare class BridgeCompleterService {
    private pendingBridges;
    private isRunning;
    private checkInterval;
    private arcWallet;
    private sepoliaWallet;
    constructor();
    /**
     * Start the bridge completer service
     */
    start(): void;
    /**
     * Stop the service
     */
    stop(): void;
    /**
     * Register a bridge transaction for auto-completion
     */
    registerBridge(params: {
        sourceTxHash: string;
        direction: 'arc-to-sepolia' | 'sepolia-to-arc';
        recipientAddress: string;
        amount: string;
    }): void;
    /**
     * Check all pending bridges for attestation
     */
    private checkPendingBridges;
    /**
     * Check a single bridge for attestation and complete if ready
     */
    private checkBridge;
    /**
     * Complete bridge by calling receiveMessage on destination chain
     */
    private completeBridge;
    /**
     * Manually complete a bridge (for recovery/admin)
     */
    manualComplete(sourceTxHash: string, sourceDomain: number): Promise<{
        success: boolean;
        txHash?: string;
        error?: string;
    }>;
    /**
     * Get service status
     */
    getStatus(): {
        isRunning: boolean;
        pendingCount: number;
        completerAddress: string;
    };
}
export declare function getBridgeCompleterService(): BridgeCompleterService;
//# sourceMappingURL=bridgeCompleterService.d.ts.map