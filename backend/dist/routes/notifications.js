import { Router } from 'express';
import { pushService } from '../services/pushService.js';
export const createNotificationRouter = () => {
    const router = Router();
    /**
     * GET /notifications/vapid-public-key
     * Get VAPID public key for frontend
     */
    router.get('/vapid-public-key', (req, res) => {
        try {
            const publicKey = pushService.getPublicKey();
            res.json({ success: true, publicKey });
        }
        catch (error) {
            console.error('Error getting VAPID key:', error);
            res.status(500).json({ success: false, error: 'Failed to get VAPID key' });
        }
    });
    /**
     * POST /notifications/subscribe
     * Save a push subscription
     */
    router.post('/subscribe', (req, res) => {
        const { userId, subscription } = req.body;
        if (!userId || !subscription || !subscription.endpoint) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        try {
            const saved = pushService.saveSubscription(userId, subscription);
            res.json({ success: true, data: saved });
        }
        catch (error) {
            console.error('Error saving subscription:', error);
            res.status(500).json({ success: false, error: 'Failed to save subscription' });
        }
    });
    /**
     * DELETE /notifications/subscribe
     * Remove a push subscription
     */
    router.delete('/subscribe', (req, res) => {
        const { endpoint } = req.body;
        if (!endpoint) {
            return res.status(400).json({ success: false, error: 'Missing endpoint' });
        }
        try {
            pushService.removeSubscription(endpoint);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error removing subscription:', error);
            res.status(500).json({ success: false, error: 'Failed to remove subscription' });
        }
    });
    /**
     * POST /notifications/test
     * Send a test notification
     */
    router.post('/test', async (req, res) => {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, error: 'Missing userId' });
        }
        try {
            await pushService.sendNotification(userId, {
                title: 'Test Notification',
                body: 'This is a test notification from ArcWallet',
                icon: '/icon-192x192.png'
            });
            res.json({ success: true, message: 'Test notification sent' });
        }
        catch (error) {
            console.error('Error sending test notification:', error);
            res.status(500).json({ success: false, error: 'Failed to send test notification' });
        }
    });
    return router;
};
//# sourceMappingURL=notifications.js.map