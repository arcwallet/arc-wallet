import webpush from 'web-push';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/indexer.js';
// Clean VAPID key - remove quotes, whitespace, and validate
function cleanVapidKey(key) {
    if (!key)
        return undefined;
    // Remove quotes, whitespace, newlines
    const cleaned = key.trim().replace(/^["']|["']$/g, '').trim();
    // VAPID keys should be URL-safe Base64 (no =, +, /)
    // Valid chars: A-Z, a-z, 0-9, -, _
    if (!/^[A-Za-z0-9_-]+$/.test(cleaned)) {
        console.error('❌ Invalid VAPID key format. Must be URL-safe Base64.');
        return undefined;
    }
    return cleaned;
}
class PushService {
    publicKey;
    privateKey;
    constructor() {
        // Clean and validate env vars
        const envPublicKey = cleanVapidKey(process.env.VAPID_PUBLIC_KEY);
        const envPrivateKey = cleanVapidKey(process.env.VAPID_PRIVATE_KEY);
        // Check if keys exist in env and are valid
        if (envPublicKey && envPrivateKey) {
            this.publicKey = envPublicKey;
            this.privateKey = envPrivateKey;
            console.log('✅ VAPID keys loaded from environment');
        }
        else {
            // Generate new keys (Note: This means clients need to re-subscribe if server restarts without persistence)
            // In production, set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars
            console.warn('⚠️ VAPID keys not configured or invalid. Generating new keys...');
            const keys = webpush.generateVAPIDKeys();
            this.publicKey = keys.publicKey;
            this.privateKey = keys.privateKey;
            console.log('📌 Generated VAPID_PUBLIC_KEY:', this.publicKey);
            console.log('📌 Generated VAPID_PRIVATE_KEY:', this.privateKey);
            console.warn('⚠️ Save these to Render environment variables for persistence!');
        }
        webpush.setVapidDetails('mailto:admin@arcwallet.com', this.publicKey, this.privateKey);
    }
    getPublicKey() {
        return this.publicKey;
    }
    /**
     * Save a subscription for a user
     */
    saveSubscription(userId, subscription) {
        const id = uuidv4();
        const createdAt = Date.now();
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, createdAt);
        return { id, userId, ...subscription };
    }
    /**
     * Remove a subscription
     */
    removeSubscription(endpoint) {
        const stmt = db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?');
        stmt.run(endpoint);
    }
    /**
     * Send a notification to a user
     */
    async sendNotification(userId, payload) {
        const stmt = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?');
        const subscriptions = stmt.all(userId);
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
                }
                else {
                    console.error('Error sending push notification:', error);
                }
            });
        });
        await Promise.all(notifications);
    }
}
export const pushService = new PushService();
//# sourceMappingURL=pushService.js.map