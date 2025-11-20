import express from 'express';
import { paymasterService } from '../services/paymasterService';
import { policyEngine } from '../services/policyEngine';
import { ethers } from 'ethers';

const router = express.Router();

/**
 * GET /api/paymaster/stats
 * Get paymaster statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await paymasterService.getStats();
        const config = await paymasterService.getConfig();

        res.json({
            success: true,
            data: {
                balance: stats.balance.toString(),
                balanceFormatted: ethers.formatEther(stats.balance),
                dailySpent: stats.dailySpent.toString(),
                dailySpentFormatted: ethers.formatEther(stats.dailySpent),
                totalSponsored: stats.totalSponsored,
                totalCost: stats.totalCost.toString(),
                totalCostFormatted: ethers.formatEther(stats.totalCost),
                topSpenders: stats.topSpenders,
                config,
            },
        });
    } catch (error) {
        console.error('Error getting paymaster stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get paymaster stats',
        });
    }
});

/**
 * GET /api/paymaster/balance
 * Get paymaster balance
 */
router.get('/balance', async (req, res) => {
    try {
        const balance = await paymasterService.getBalance();

        res.json({
            success: true,
            data: {
                balance: balance.toString(),
                balanceFormatted: ethers.formatEther(balance),
                needsFunding: await paymasterService.needsFunding(),
            },
        });
    } catch (error) {
        console.error('Error getting paymaster balance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get paymaster balance',
        });
    }
});

/**
 * POST /api/paymaster/whitelist
 * Add or remove addresses from whitelist
 */
router.post('/whitelist', async (req, res) => {
    try {
        const { addresses, enabled } = req.body;

        if (!Array.isArray(addresses)) {
            return res.status(400).json({
                success: false,
                error: 'addresses must be an array',
            });
        }

        // Update policy engine
        for (const address of addresses) {
            if (enabled) {
                policyEngine.addToWhitelist(address);
            } else {
                policyEngine.removeFromWhitelist(address);
            }
        }

        res.json({
            success: true,
            message: `${addresses.length} addresses ${enabled ? 'added to' : 'removed from'} whitelist`,
        });
    } catch (error) {
        console.error('Error updating whitelist:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update whitelist',
        });
    }
});

/**
 * PUT /api/paymaster/policies
 * Update paymaster policies
 */
router.put('/policies', async (req, res) => {
    try {
        const { whitelist, rateLimit, budget } = req.body;

        // Update whitelist policy
        if (whitelist !== undefined) {
            policyEngine.setWhitelistPolicy(whitelist.enabled);
        }

        // Update rate limit policy
        if (rateLimit !== undefined) {
            policyEngine.setRateLimitPolicy(
                rateLimit.enabled,
                rateLimit.maxOpsPerHour
            );
        }

        // Update budget policy
        if (budget !== undefined) {
            policyEngine.setBudgetPolicy(
                budget.enabled,
                budget.maxCostPerOp ? BigInt(budget.maxCostPerOp) : undefined,
                budget.dailyBudget ? BigInt(budget.dailyBudget) : undefined
            );
        }

        res.json({
            success: true,
            message: 'Policies updated successfully',
            config: policyEngine.getConfig(),
        });
    } catch (error) {
        console.error('Error updating policies:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update policies',
        });
    }
});

/**
 * GET /api/paymaster/can-sponsor/:address
 * Check if an address can be sponsored
 */
router.get('/can-sponsor/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const { estimatedCost } = req.query;

        if (!ethers.isAddress(address)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid address',
            });
        }

        const cost = estimatedCost
            ? BigInt(estimatedCost as string)
            : ethers.parseEther('0.01'); // Default 0.01 ETH

        const canSponsor = await paymasterService.canSponsor(address, cost);

        res.json({
            success: true,
            data: {
                canSponsor,
                address,
                estimatedCost: cost.toString(),
            },
        });
    } catch (error) {
        console.error('Error checking sponsorship:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check sponsorship eligibility',
        });
    }
});

/**
 * GET /api/paymaster/config
 * Get current policy configuration
 */
router.get('/config', async (req, res) => {
    try {
        const config = policyEngine.getConfig();

        res.json({
            success: true,
            data: {
                whitelist: {
                    enabled: config.whitelist.enabled,
                    count: config.whitelist.addresses.size,
                },
                rateLimit: {
                    enabled: config.rateLimit.enabled,
                    maxOpsPerHour: config.rateLimit.maxOpsPerHour,
                },
                budget: {
                    enabled: config.budget.enabled,
                    maxCostPerOp: config.budget.maxCostPerOp.toString(),
                    maxCostPerOpFormatted: ethers.formatEther(config.budget.maxCostPerOp),
                    dailyBudget: config.budget.dailyBudget.toString(),
                    dailyBudgetFormatted: ethers.formatEther(config.budget.dailyBudget),
                    dailySpent: config.budget.dailySpent.toString(),
                    dailySpentFormatted: ethers.formatEther(config.budget.dailySpent),
                },
            },
        });
    } catch (error) {
        console.error('Error getting config:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get configuration',
        });
    }
});

export default router;
