import webpush from 'web-push';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/indexer.js';

interface PushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

class PushService {
    private publicKey: string;
    private privateKey: string;

    constructor() {
        // In a real app, these should be loaded from env vars or generated once and stored
        // For this demo, we'll generate them if missing, but they won't persist across restarts unless we save them
        // Ideally: process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY

        // Check if keys exist in env
        if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
            this.publicKey = process.env.VAPID_PUBLIC_KEY;
            this.privateKey = process.env.VAPID_PRIVATE_KEY;
        } else {
            // Generate new keys (Note: This means clients need to re-subscribe if server restarts without persistence)
            // In production, set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars
            const keys = webpush.generateVAPIDKeys();
            this.publicKey = keys.publicKey;
            this.privateKey = keys.privateKey;
            // Never log private keys in production!
            if (process.env.NODE_ENV === 'development') {
                console.warn('⚠️ VAPID keys not configured. Push notifications may not persist across restarts.');
            }
        }

        webpush.setVapidDetails(
            'mailto:admin@arcwallet.com',
            this.publicKey,
            this.privateKey
        );
    }

    getPublicKey() {
        return this.publicKey;
    }

    /**
     * Save a subscription for a user
     */
    saveSubscription(userId: string, subscription: PushSubscription) {
        const id = uuidv4();
        const createdAt = Date.now();

        const stmt = db.prepare(`
      INSERT OR REPLACE INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            id,
            userId,
            subscription.endpoint,
            subscription.keys.p256dh,
            subscription.keys.auth,
            createdAt
        );

        return { id, userId, ...subscription };
    }

    /**
     * Remove a subscription
     */
    removeSubscription(endpoint: string) {
        const stmt = db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?');
        stmt.run(endpoint);
    }

    /**
     * Send a notification to a user
     */
    async sendNotification(userId: string, payload: any) {
        const stmt = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?');
        const subscriptions = stmt.all(userId) as any[];

        const notifications = subscriptions.map(sub => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };

            return webpush.sendNotification(pushSubscription, JSON.stringify(payload))
                .catch(error => {
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        // Subscription has expired or is no longer valid
                        console.log(`Subscription expired for user ${userId}, removing...`);
                        this.removeSubscription(sub.endpoint);
                    } else {
                        console.error('Error sending push notification:', error);
                    }
                });
        });

        await Promise.all(notifications);
    }
}

export const pushService = new PushService();
