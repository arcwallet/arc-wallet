import { Router } from 'express';
import { webhookService } from '../services/webhookService.js';

export const createWebhookRouter = () => {
    const router = Router();

    /**
     * GET /webhooks/:userId
     * List webhooks for a user
     */
    router.get('/:userId', (req, res) => {
        const { userId } = req.params;
        try {
            const webhooks = webhookService.listWebhooks(userId);
            res.json({ success: true, data: webhooks });
        } catch (error) {
            console.error('Error listing webhooks:', error);
            res.status(500).json({ success: false, error: 'Failed to list webhooks' });
        }
    });

    /**
     * POST /webhooks
     * Create a new webhook
     */
    router.post('/', (req, res) => {
        const { userId, url, events } = req.body;

        if (!userId || !url || !events || !Array.isArray(events)) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        try {
            const webhook = webhookService.subscribe(userId, url, events);
            res.json({ success: true, data: webhook });
        } catch (error) {
            console.error('Error creating webhook:', error);
            res.status(500).json({ success: false, error: 'Failed to create webhook' });
        }
    });

    /**
     * DELETE /webhooks/:id
     * Delete a webhook
     */
    router.delete('/:id', (req, res) => {
        const { id } = req.params;
        try {
            webhookService.unsubscribe(id);
            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting webhook:', error);
            res.status(500).json({ success: false, error: 'Failed to delete webhook' });
        }
    });

    /**
     * POST /webhooks/:id/test
     * Send a test ping
     */
    router.post('/:id/test', (req, res) => {
        const { id } = req.params;
        const { userId } = req.body; // Need userId to trigger

        try {
            webhookService.trigger(userId, 'ping', {
                message: 'This is a test webhook event',
                timestamp: Date.now()
            });
            res.json({ success: true, message: 'Test event queued' });
        } catch (error) {
            console.error('Error testing webhook:', error);
            res.status(500).json({ success: false, error: 'Failed to test webhook' });
        }
    });

    return router;
};
