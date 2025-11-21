import { ethers } from 'ethers';

/**
 * Paymaster Service
 * Handles gas sponsorship for user operations
 */

interface PaymasterData {
    paymasterAddress: string;
    paymasterVerificationGasLimit: bigint;
    postOpGasLimit: bigint;
    paymasterData: string;
}

interface PaymasterStats {
    totalSponsored: number;
    totalCost: bigint;
    dailySpent: bigint;
    balance: bigint;
    topSpenders: Array<{ address: string; count: number; cost: bigint }>;
}

interface PaymasterConfig {
    whitelistEnabled: boolean;
    budgetEnabled: boolean;
    rateLimitEnabled: boolean;
    maxCostPerOp: bigint;
    dailyBudget: bigint;
    maxOpsPerHour: number;
}

class PaymasterService {
    private provider: ethers.Provider;
    private paymasterContract: ethers.Contract;
    private paymasterAddress: string;

    // ABI for ArcPaymaster
    private paymasterABI = [
        'function validatePaymasterUserOp(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash, uint256 maxCost) external returns (bytes memory context, uint256 validationData)',
        'function postOp(uint8 mode, bytes calldata context, uint256 actualGasCost, uint256 actualUserOpFeePerGas) external',
        'function getBalance() external view returns (uint256)',
        'function getStats() external view returns (uint256 totalSponsored, uint256 totalCost, uint256 dailySpent, uint256 balance)',
        'function canSponsor(address sender, uint256 estimatedCost) external view returns (bool)',
        'function deposit() external payable',
        'function withdrawTo(address payable withdrawAddress, uint256 amount) external',
        'function setWhitelist(address[] calldata addresses, bool enabled) external',
        'function config() external view returns (bool whitelistEnabled, bool budgetEnabled, bool rateLimitEnabled, uint256 maxCostPerOp, uint256 dailyBudget, uint256 maxOpsPerHour)',
    ];

    constructor() {
        // Initialize provider
        const rpcUrl = process.env.ARC_RPC_URL || 'http://localhost:8545';
        this.provider = new ethers.JsonRpcProvider(rpcUrl);

        // Paymaster address (will be set after deployment)
        this.paymasterAddress = process.env.PAYMASTER_ADDRESS || '';

        if (!this.paymasterAddress) {
            console.warn('⚠️  PAYMASTER_ADDRESS not set. Paymaster features disabled.');
            // Don't initialize contract with empty address - causes ENS error
            this.paymasterContract = null as any; // Will be checked in isEnabled()
            return;
        }

        // Initialize contract only if address is set
        this.paymasterContract = new ethers.Contract(
            this.paymasterAddress,
            this.paymasterABI,
            this.provider
        );
    }

    /**
     * Check if paymaster is enabled
     */
    isEnabled(): boolean {
        return !!this.paymasterAddress;
    }

    /**
     * Generate paymaster data for a UserOperation
     */
    async getPaymasterData(
        sender: string,
        estimatedCost: bigint
    ): Promise<PaymasterData | null> {
        if (!this.isEnabled()) {
            return null;
        }

        try {
            // Check if this operation can be sponsored
            const canSponsor = await this.canSponsor(sender, estimatedCost);

            if (!canSponsor) {
                console.log(`❌ Cannot sponsor for ${sender}: Policy check failed`);
                return null;
            }

            // Generate paymaster data
            const paymasterData: PaymasterData = {
                paymasterAddress: this.paymasterAddress,
                paymasterVerificationGasLimit: 100000n, // 100k gas for validation
                postOpGasLimit: 50000n,                 // 50k gas for postOp
                paymasterData: '0x',                    // No additional data needed
            };

            console.log(`✅ Sponsorship approved for ${sender}`);
            return paymasterData;
        } catch (error) {
            console.error('Error generating paymaster data:', error);
            return null;
        }
    }

    /**
     * Check if a UserOperation can be sponsored
     */
    async canSponsor(sender: string, estimatedCost: bigint): Promise<boolean> {
        if (!this.isEnabled()) {
            return false;
        }

        try {
            const canSponsor = await this.paymasterContract.canSponsor(sender, estimatedCost);
            return canSponsor;
        } catch (error) {
            console.error('Error checking sponsorship eligibility:', error);
            return false;
        }
    }

    /**
     * Get current paymaster balance
     */
    async getBalance(): Promise<bigint> {
        if (!this.isEnabled()) {
            return 0n;
        }

        try {
            const balance = await this.paymasterContract.getBalance();
            return balance;
        } catch (error) {
            console.error('Error getting paymaster balance:', error);
            return 0n;
        }
    }

    /**
     * Get paymaster statistics
     */
    async getStats(): Promise<PaymasterStats> {
        if (!this.isEnabled()) {
            return {
                totalSponsored: 0,
                totalCost: 0n,
                dailySpent: 0n,
                balance: 0n,
                topSpenders: [],
            };
        }

        try {
            const stats = await this.paymasterContract.getStats();

            return {
                totalSponsored: Number(stats[0]),
                totalCost: stats[1],
                dailySpent: stats[2],
                balance: stats[3],
                topSpenders: [], // TODO: Implement top spenders tracking
            };
        } catch (error) {
            console.error('Error getting paymaster stats:', error);
            return {
                totalSponsored: 0,
                totalCost: 0n,
                dailySpent: 0n,
                balance: 0n,
                topSpenders: [],
            };
        }
    }

    /**
     * Get paymaster configuration
     */
    async getConfig(): Promise<PaymasterConfig | null> {
        if (!this.isEnabled()) {
            return null;
        }

        try {
            const config = await this.paymasterContract.config();

            return {
                whitelistEnabled: config[0],
                budgetEnabled: config[1],
                rateLimitEnabled: config[2],
                maxCostPerOp: config[3],
                dailyBudget: config[4],
                maxOpsPerHour: Number(config[5]),
            };
        } catch (error) {
            console.error('Error getting paymaster config:', error);
            return null;
        }
    }

    /**
     * Encode paymaster data for UserOperation
     */
    encodePaymasterData(data: PaymasterData): string {
        // Format: paymasterAddress (20 bytes) + paymasterVerificationGasLimit (16 bytes) + postOpGasLimit (16 bytes) + paymasterData
        const paymasterAddress = data.paymasterAddress.toLowerCase().replace('0x', '');
        const verificationGasLimit = data.paymasterVerificationGasLimit.toString(16).padStart(32, '0');
        const postOpGasLimit = data.postOpGasLimit.toString(16).padStart(32, '0');
        const paymasterData = data.paymasterData.replace('0x', '');

        return '0x' + paymasterAddress + verificationGasLimit + postOpGasLimit + paymasterData;
    }

    /**
     * Check if paymaster needs funding (balance < 1 ETH)
     */
    async needsFunding(): Promise<boolean> {
        const balance = await this.getBalance();
        const threshold = ethers.parseEther('1'); // 1 ETH threshold
        return balance < threshold;
    }

    /**
     * Monitor paymaster balance and alert if low
     */
    async monitorBalance(): Promise<void> {
        if (!this.isEnabled()) {
            return;
        }

        const balance = await this.getBalance();
        const threshold = ethers.parseEther('1');

        if (balance < threshold) {
            console.error(`🚨 ALERT: Paymaster balance is low! Current: ${ethers.formatEther(balance)} ETH`);
            // TODO: Send alert via email/Slack/PagerDuty
        } else {
            console.log(`✅ Paymaster balance healthy: ${ethers.formatEther(balance)} ETH`);
        }
    }
}

// Export singleton instance
export const paymasterService = new PaymasterService();
