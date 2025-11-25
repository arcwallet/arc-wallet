/**
 * Gas Station Service
 * Provides gas sponsorship for users on Arc Testnet
 *
 * Phase 1: Simple gas top-up model
 * - Backend wallet sends USDC (native gas on Arc) to users
 * - Tracks daily spending limits per user
 * - Configurable thresholds and amounts
 */

import { ethers, JsonRpcProvider, Wallet, formatUnits, parseUnits } from 'ethers';

// Configuration
const config = {
    rpcUrl: process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network',
    chainId: 5042002,
    // Sponsor wallet private key (should be in env)
    sponsorPrivateKey: process.env.GAS_SPONSOR_PRIVATE_KEY || '',
    // Limits (in USDC micro units, 6 decimals)
    maxDailyPerUser: 1_000_000,    // $1 USDC per user per day
    minBalanceThreshold: 100_000,  // Sponsor if balance < $0.10 USDC
    topUpAmount: 500_000,          // Top up $0.50 USDC
    // Global daily limit
    maxDailyTotal: 100_000_000,    // $100 USDC total per day
};

// In-memory tracking (replace with database in production)
interface UserSpending {
    total: bigint;
    lastReset: number;
    transactions: number;
}

const userSpending = new Map<string, UserSpending>();
let globalDailySpending = 0n;
let lastGlobalReset = Date.now();

// Provider and wallet instances
let provider: JsonRpcProvider | null = null;
let sponsorWallet: Wallet | null = null;

/**
 * Initialize the Gas Station service
 */
export function initGasStation(): boolean {
    try {
        if (!config.sponsorPrivateKey) {
            console.warn('[GasStation] No sponsor private key configured. Gas sponsorship disabled.');
            return false;
        }

        provider = new JsonRpcProvider(config.rpcUrl);
        sponsorWallet = new Wallet(config.sponsorPrivateKey, provider);

        console.log('[GasStation] Initialized with sponsor wallet:', sponsorWallet.address);
        return true;
    } catch (error) {
        console.error('[GasStation] Failed to initialize:', error);
        return false;
    }
}

/**
 * Check if gas station is operational
 */
export function isGasStationEnabled(): boolean {
    return sponsorWallet !== null && provider !== null;
}

/**
 * Get sponsor wallet balance
 */
export async function getSponsorBalance(): Promise<{
    balance: string;
    balanceFormatted: string;
    address: string;
}> {
    if (!sponsorWallet || !provider) {
        throw new Error('Gas station not initialized');
    }

    const balance = await provider.getBalance(sponsorWallet.address);

    return {
        balance: balance.toString(),
        balanceFormatted: formatUnits(balance, 6), // USDC has 6 decimals on Arc
        address: sponsorWallet.address,
    };
}

/**
 * Reset daily spending counters if needed
 */
function checkAndResetDailyLimits(): void {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // Reset global counter
    if (now - lastGlobalReset > oneDayMs) {
        globalDailySpending = 0n;
        lastGlobalReset = now;
        console.log('[GasStation] Reset global daily spending counter');
    }

    // Reset per-user counters
    for (const [address, spending] of userSpending.entries()) {
        if (now - spending.lastReset > oneDayMs) {
            userSpending.set(address, {
                total: 0n,
                lastReset: now,
                transactions: 0,
            });
        }
    }
}

/**
 * Check if user is eligible for gas sponsorship
 */
export async function checkEligibility(userAddress: string): Promise<{
    eligible: boolean;
    reason: string;
    currentBalance: string;
    dailyUsed: string;
    dailyLimit: string;
}> {
    if (!provider) {
        return {
            eligible: false,
            reason: 'Gas station not initialized',
            currentBalance: '0',
            dailyUsed: '0',
            dailyLimit: '0',
        };
    }

    checkAndResetDailyLimits();

    const normalizedAddress = userAddress.toLowerCase();

    // Get user's current balance
    const balance = await provider.getBalance(userAddress);
    const balanceNumber = BigInt(balance.toString());

    // Get user's daily spending
    const spending = userSpending.get(normalizedAddress) || {
        total: 0n,
        lastReset: Date.now(),
        transactions: 0,
    };

    // Check if user has enough balance (no sponsorship needed)
    if (balanceNumber >= BigInt(config.minBalanceThreshold)) {
        return {
            eligible: false,
            reason: 'User has sufficient balance',
            currentBalance: formatUnits(balance, 6),
            dailyUsed: formatUnits(spending.total, 6),
            dailyLimit: formatUnits(config.maxDailyPerUser, 6),
        };
    }

    // Check daily limit
    if (spending.total >= BigInt(config.maxDailyPerUser)) {
        return {
            eligible: false,
            reason: 'Daily sponsorship limit reached',
            currentBalance: formatUnits(balance, 6),
            dailyUsed: formatUnits(spending.total, 6),
            dailyLimit: formatUnits(config.maxDailyPerUser, 6),
        };
    }

    // Check global daily limit
    if (globalDailySpending >= BigInt(config.maxDailyTotal)) {
        return {
            eligible: false,
            reason: 'Global daily sponsorship limit reached',
            currentBalance: formatUnits(balance, 6),
            dailyUsed: formatUnits(spending.total, 6),
            dailyLimit: formatUnits(config.maxDailyPerUser, 6),
        };
    }

    return {
        eligible: true,
        reason: 'User eligible for gas sponsorship',
        currentBalance: formatUnits(balance, 6),
        dailyUsed: formatUnits(spending.total, 6),
        dailyLimit: formatUnits(config.maxDailyPerUser, 6),
    };
}

/**
 * Sponsor gas for a user (send USDC for gas)
 */
export async function sponsorGas(userAddress: string): Promise<{
    success: boolean;
    txHash?: string;
    amount?: string;
    error?: string;
}> {
    if (!sponsorWallet || !provider) {
        return { success: false, error: 'Gas station not initialized' };
    }

    const normalizedAddress = userAddress.toLowerCase();

    // Check eligibility first
    const eligibility = await checkEligibility(userAddress);
    if (!eligibility.eligible) {
        return { success: false, error: eligibility.reason };
    }

    try {
        // Send gas to user
        const amount = BigInt(config.topUpAmount);

        console.log(`[GasStation] Sponsoring ${formatUnits(amount, 6)} USDC to ${userAddress}`);

        const tx = await sponsorWallet.sendTransaction({
            to: userAddress,
            value: amount,
        });

        console.log(`[GasStation] Transaction sent: ${tx.hash}`);

        // Wait for confirmation
        const receipt = await tx.wait();

        if (!receipt || receipt.status !== 1) {
            throw new Error('Transaction failed');
        }

        // Update spending trackers
        const spending = userSpending.get(normalizedAddress) || {
            total: 0n,
            lastReset: Date.now(),
            transactions: 0,
        };

        userSpending.set(normalizedAddress, {
            total: spending.total + amount,
            lastReset: spending.lastReset,
            transactions: spending.transactions + 1,
        });

        globalDailySpending += amount;

        console.log(`[GasStation] Successfully sponsored ${formatUnits(amount, 6)} USDC to ${userAddress}`);

        return {
            success: true,
            txHash: tx.hash,
            amount: formatUnits(amount, 6),
        };
    } catch (error: any) {
        console.error('[GasStation] Sponsorship failed:', error);
        return {
            success: false,
            error: error.message || 'Transaction failed',
        };
    }
}

/**
 * Get gas station statistics
 */
export async function getStats(): Promise<{
    enabled: boolean;
    sponsorAddress: string | null;
    sponsorBalance: string;
    globalDailySpent: string;
    globalDailyLimit: string;
    totalUsers: number;
    config: {
        minBalanceThreshold: string;
        topUpAmount: string;
        maxDailyPerUser: string;
    };
}> {
    const enabled = isGasStationEnabled();

    let sponsorBalance = '0';
    let sponsorAddress: string | null = null;

    if (enabled && sponsorWallet && provider) {
        const balance = await provider.getBalance(sponsorWallet.address);
        sponsorBalance = formatUnits(balance, 6);
        sponsorAddress = sponsorWallet.address;
    }

    return {
        enabled,
        sponsorAddress,
        sponsorBalance,
        globalDailySpent: formatUnits(globalDailySpending, 6),
        globalDailyLimit: formatUnits(config.maxDailyTotal, 6),
        totalUsers: userSpending.size,
        config: {
            minBalanceThreshold: formatUnits(config.minBalanceThreshold, 6),
            topUpAmount: formatUnits(config.topUpAmount, 6),
            maxDailyPerUser: formatUnits(config.maxDailyPerUser, 6),
        },
    };
}

// Initialize on module load
initGasStation();
