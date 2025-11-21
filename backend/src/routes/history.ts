import { Router } from 'express';
import { indexerService } from '../services/indexerService';

export const createHistoryRouter = () => {
    const router = Router();

    /**
     * GET /history/:address
     * Get transaction history for an address
     */
    router.get('/:address', async (req, res) => {
        const { address } = req.params;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = parseInt(req.query.offset as string) || 0;

        try {
            const history = indexerService.getHistory(address, limit, offset);
            res.json({
                success: true,
                data: history,
                pagination: {
                    limit,
                    offset,
                    hasMore: history.length === limit
                }
            });
        } catch (error) {
            console.error('Error fetching history:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch history' });
        }
    });

    return router;
};
