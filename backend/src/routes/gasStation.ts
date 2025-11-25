/**
 * Gas Station API Routes
 * Endpoints for gas sponsorship functionality
 */

import { Router, Request, Response } from 'express';
import {
    isGasStationEnabled,
    checkEligibility,
    sponsorGas,
    getStats,
    getSponsorBalance,
} from '../services/gasStation.js';

export const createGasStationRouter = () => {
    const router = Router();

    /**
     * GET /gas-station/health
     * Check if gas station is operational
     */
    router.get('/health', async (req: Request, res: Response) => {
        try {
            const enabled = isGasStationEnabled();

            res.json({
                success: true,
                data: {
                    enabled,
                    status: enabled ? 'operational' : 'disabled',
                    message: enabled
                        ? 'Gas sponsorship is available'
                        : 'Gas sponsorship is not configured',
                },
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message || 'Health check failed',
            });
        }
    });

    /**
     * GET /gas-station/stats
     * Get gas station statistics (admin)
     */
    router.get('/stats', async (req: Request, res: Response) => {
        try {
            const stats = await getStats();

            res.json({
                success: true,
                data: stats,
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to get stats',
            });
        }
    });

    /**
     * GET /gas-station/balance
     * Get sponsor wallet balance
     */
    router.get('/balance', async (req: Request, res: Response) => {
        try {
            if (!isGasStationEnabled()) {
                return res.status(503).json({
                    success: false,
                    error: 'Gas station not configured',
                });
            }

            const balance = await getSponsorBalance();

            res.json({
                success: true,
                data: balance,
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to get balance',
            });
        }
    });

    /**
     * GET /gas-station/eligibility/:address
     * Check if address is eligible for gas sponsorship
     */
    router.get('/eligibility/:address', async (req: Request, res: Response) => {
        try {
            const { address } = req.params;

            if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid address format',
                });
            }

            if (!isGasStationEnabled()) {
                return res.json({
                    success: true,
                    data: {
                        eligible: false,
                        reason: 'Gas sponsorship not available',
                        currentBalance: '0',
                        dailyUsed: '0',
                        dailyLimit: '0',
                    },
                });
            }

            const eligibility = await checkEligibility(address);

            res.json({
                success: true,
                data: eligibility,
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message || 'Eligibility check failed',
            });
        }
    });

    /**
     * POST /gas-station/sponsor
     * Request gas sponsorship for an address
     */
    router.post('/sponsor', async (req: Request, res: Response) => {
        try {
            const { address } = req.body;

            if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid address format',
                });
            }

            if (!isGasStationEnabled()) {
                return res.status(503).json({
                    success: false,
                    error: 'Gas sponsorship not available',
                });
            }

            console.log(`[GasStation API] Sponsorship requested for ${address}`);

            const result = await sponsorGas(address);

            if (result.success) {
                res.json({
                    success: true,
                    data: {
                        txHash: result.txHash,
                        amount: result.amount,
                        message: `Successfully sponsored ${result.amount} USDC for gas`,
                    },
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error,
                });
            }
        } catch (error: any) {
            console.error('[GasStation API] Sponsorship error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Sponsorship request failed',
            });
        }
    });

    /**
     * POST /gas-station/auto-sponsor
     * Automatically sponsor gas if needed before a transaction
     * This is called before user submits a transaction
     */
    router.post('/auto-sponsor', async (req: Request, res: Response) => {
        try {
            const { address, estimatedGas } = req.body;

            if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid address format',
                });
            }

            if (!isGasStationEnabled()) {
                // Gas station not available, user pays own gas
                return res.json({
                    success: true,
                    data: {
                        sponsored: false,
                        reason: 'Gas sponsorship not available',
                    },
                });
            }

            // Check eligibility
            const eligibility = await checkEligibility(address);

            if (!eligibility.eligible) {
                // User either has enough balance or hit limits
                return res.json({
                    success: true,
                    data: {
                        sponsored: false,
                        reason: eligibility.reason,
                        currentBalance: eligibility.currentBalance,
                    },
                });
            }

            // User needs sponsorship - send gas
            const result = await sponsorGas(address);

            res.json({
                success: true,
                data: {
                    sponsored: result.success,
                    txHash: result.txHash,
                    amount: result.amount,
                    reason: result.success
                        ? 'Gas sponsored successfully'
                        : result.error,
                },
            });
        } catch (error: any) {
            console.error('[GasStation API] Auto-sponsor error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Auto-sponsorship failed',
            });
        }
    });

    return router;
};
