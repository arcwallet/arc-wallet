import { Router } from 'express';
import db from '../db/indexer.js';

export const createHistoryRouter = () => {
    const router = Router();

    /**
     * GET /history/:address
     * Get transaction history for an address
     */
    router.get('/:address', async (req, res) => {
        try {
            const { address } = req.params;
            const limit = parseInt(req.query.limit as string) || 20;
            const offset = parseInt(req.query.offset as string) || 0;

            // Query transactions from database
            const stmt = db.prepare(`
                SELECT * FROM transactions 
                WHERE from_address = ? OR to_address = ?
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            `);

            const transactions = stmt.all(address, address, limit, offset);

            res.json({
                success: true,
                data: transactions,
                pagination: {
                    limit,
                    offset,
                    total: transactions.length
                }
            });
        } catch (error: any) {
            console.error('Error fetching transaction history:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch transaction history'
            });
        }
    });

    return router;
};
