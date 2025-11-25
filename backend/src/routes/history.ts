import { Router } from 'express';
import db from '../db/indexer.js';

interface TransactionRow {
    hash: string;
    block_number: number;
    from_address: string;
    to_address: string;
    value: string;
    timestamp: number;
    status: number;
    gas_price?: string;
}

interface EventRow {
    transaction_hash: string;
    block_number: number;
    from_address: string;
    to_address: string;
    amount: string;
    timestamp: number;
    token_address: string;
}

export const createHistoryRouter = () => {
    const router = Router();

    /**
     * GET /history/:address
     * Get transaction history for an address
     */
    router.get('/:address', async (req, res) => {
        try {
            const { address } = req.params;
            const limit = parseInt(req.query.limit as string) || 50;
            const offset = parseInt(req.query.offset as string) || 0;

            // Normalize address to lowercase for case-insensitive matching
            const normalizedAddress = address.toLowerCase();

            // Query transactions from database (case-insensitive)
            const stmt = db.prepare(`
                SELECT * FROM transactions
                WHERE LOWER(from_address) = ? OR LOWER(to_address) = ?
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            `);

            const transactions = stmt.all(normalizedAddress, normalizedAddress, limit, offset) as TransactionRow[];

            // Also fetch ERC20 transfer events
            const eventsStmt = db.prepare(`
                SELECT * FROM events
                WHERE LOWER(from_address) = ? OR LOWER(to_address) = ?
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            `);

            const events = eventsStmt.all(normalizedAddress, normalizedAddress, limit, offset) as EventRow[];

            // Merge and deduplicate by hash, prefer events with token info
            const txMap = new Map();

            // Add regular transactions
            for (const tx of transactions) {
                txMap.set(tx.hash, {
                    ...tx,
                    token_address: null
                });
            }

            // Add/update with ERC20 events (these have token_address)
            for (const event of events) {
                const existing = txMap.get(event.transaction_hash);
                if (existing) {
                    // Update with token info if it's an ERC20 transfer
                    if (event.token_address && event.token_address !== 'NATIVE') {
                        txMap.set(event.transaction_hash, {
                            ...existing,
                            value: event.amount,
                            token_address: event.token_address
                        });
                    }
                } else {
                    // Add event as transaction
                    txMap.set(event.transaction_hash, {
                        hash: event.transaction_hash,
                        block_number: event.block_number,
                        from_address: event.from_address,
                        to_address: event.to_address,
                        value: event.amount,
                        timestamp: event.timestamp,
                        status: 1,
                        token_address: event.token_address === 'NATIVE' ? null : event.token_address
                    });
                }
            }

            // Convert to array and sort by timestamp
            const allTransactions = Array.from(txMap.values())
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .slice(0, limit);

            res.json({
                success: true,
                data: allTransactions,
                pagination: {
                    limit,
                    offset,
                    total: allTransactions.length
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
