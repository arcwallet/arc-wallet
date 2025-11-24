import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import db from '../db/indexer.js';
class WebhookService {
    isRunning = false;
    processingInterval = null;
    MAX_RETRIES = 5;
    /**
     * Start the webhook delivery processor
     */
    start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        console.log('🚀 Webhook service started');
        this.processQueue();
    }
    stop() {
        this.isRunning = false;
        if (this.processingInterval) {
            clearTimeout(this.processingInterval);
            this.processingInterval = null;
        }
    }
    /**
     * Subscribe to webhooks
     */
    subscribe(userId, url, events) {
        const id = uuidv4();
        const secret = crypto.randomBytes(32).toString('hex');
        const createdAt = Date.now();
        const stmt = db.prepare(`
      INSERT INTO webhooks (id, user_id, url, events, secret, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, userId, url, JSON.stringify(events), secret, createdAt);
        return { id, userId, url, events, secret, createdAt };
    }
    /**
     * Unsubscribe
     */
    unsubscribe(id) {
        const stmt = db.prepare('DELETE FROM webhooks WHERE id = ?');
        stmt.run(id);
    }
    /**
     * List webhooks for a user
     */
    listWebhooks(userId) {
        const stmt = db.prepare('SELECT * FROM webhooks WHERE user_id = ?');
        const rows = stmt.all(userId);
        return rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            url: row.url,
            events: JSON.parse(row.events),
            secret: row.secret,
            createdAt: row.created_at
        }));
    }
    /**
     * Trigger a webhook event
     */
    trigger(userId, eventType, payload) {
        // Find matching webhooks
        const webhooks = this.listWebhooks(userId);
        const matchingWebhooks = webhooks.filter(wh => wh.events.includes(eventType) || wh.events.includes('*'));
        if (matchingWebhooks.length === 0)
            return;
        const eventId = uuidv4();
        const stmt = db.prepare(`
      INSERT INTO webhook_deliveries (
        id, webhook_id, event_id, event_type, payload, status, attempt_count, next_retry_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const now = Date.now();
        db.transaction(() => {
            for (const wh of matchingWebhooks) {
                const deliveryId = uuidv4();
                stmt.run(deliveryId, wh.id, eventId, eventType, JSON.stringify(payload), 'pending', 0, now, // Ready immediately
                now);
            }
        })();
    }
    /**
     * Process pending deliveries
     */
    async processQueue() {
        if (!this.isRunning)
            return;
        try {
            const now = Date.now();
            const stmt = db.prepare(`
        SELECT wd.*, w.url, w.secret 
        FROM webhook_deliveries wd
        JOIN webhooks w ON wd.webhook_id = w.id
        WHERE wd.status = 'pending' AND wd.next_retry_at <= ?
        LIMIT 10
      `);
            const deliveries = stmt.all(now);
            for (const delivery of deliveries) {
                await this.deliver(delivery);
            }
        }
        catch (error) {
            console.error('Error processing webhook queue:', error);
        }
        // Schedule next check
        this.processingInterval = setTimeout(() => this.processQueue(), 1000);
    }
    /**
     * Deliver a single webhook
     */
    async deliver(delivery) {
        try {
            const payload = JSON.parse(delivery.payload);
            const signature = this.signPayload(payload, delivery.secret);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
            const response = await fetch(delivery.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Arc-Webhook-ID': delivery.webhook_id,
                    'X-Arc-Event-ID': delivery.event_id,
                    'X-Arc-Event-Type': delivery.event_type,
                    'X-Arc-Signature': signature
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            const success = response.ok;
            const status = success ? 'success' : 'pending'; // Keep pending if failed to retry
            if (success) {
                this.updateDeliveryStatus(delivery.id, 'success', response.status);
            }
            else {
                this.handleFailure(delivery, response.status);
            }
        }
        catch (error) {
            this.handleFailure(delivery, 0);
        }
    }
    /**
     * Handle delivery failure with exponential backoff
     */
    handleFailure(delivery, responseCode) {
        const attemptCount = delivery.attempt_count + 1;
        if (attemptCount >= this.MAX_RETRIES) {
            this.updateDeliveryStatus(delivery.id, 'failed', responseCode, attemptCount);
        }
        else {
            // Exponential backoff: 10s, 30s, 1m, 5m, 15m
            const backoff = [10000, 30000, 60000, 300000, 900000][attemptCount - 1] || 60000;
            const nextRetry = Date.now() + backoff;
            const stmt = db.prepare(`
        UPDATE webhook_deliveries 
        SET attempt_count = ?, next_retry_at = ?, response_code = ?
        WHERE id = ?
      `);
            stmt.run(attemptCount, nextRetry, responseCode, delivery.id);
        }
    }
    updateDeliveryStatus(id, status, responseCode, attemptCount) {
        let sql = 'UPDATE webhook_deliveries SET status = ?, response_code = ?';
        const params = [status, responseCode];
        if (attemptCount !== undefined) {
            sql += ', attempt_count = ?';
            params.push(attemptCount);
        }
        sql += ' WHERE id = ?';
        params.push(id);
        const stmt = db.prepare(sql);
        stmt.run(...params);
    }
    signPayload(payload, secret) {
        return crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
    }
}
export const webhookService = new WebhookService();
//# sourceMappingURL=webhookService.js.map