import { expect } from 'chai';
import { webhookService } from '../src/services/webhookService';

describe('Webhook Service', () => {
    const userId = '0xTestUser';
    const url = 'http://localhost:3000/webhook';
    const events = ['Transfer'];
    let webhookId: string;

    it('should start the service', () => {
        webhookService.start();
        // No easy way to check internal state without exposing it, but ensure no error
    });

    it('should subscribe to a webhook', () => {
        const webhook = webhookService.subscribe(userId, url, events);
        expect(webhook).to.have.property('id');
        expect(webhook.userId).to.equal(userId);
        expect(webhook.url).to.equal(url);
        expect(webhook.events).to.deep.equal(events);
        webhookId = webhook.id;
    });

    it('should list webhooks for a user', () => {
        const webhooks = webhookService.listWebhooks(userId);
        expect(webhooks).to.be.an('array');
        expect(webhooks.length).to.be.greaterThan(0);
        const found = webhooks.find(w => w.id === webhookId);
        expect(found).to.exist;
    });

    it('should trigger a webhook (queuing)', () => {
        // This just tests that trigger runs without error and queues the event
        // Actual delivery requires a running server to receive it
        webhookService.trigger(userId, 'Transfer', { amount: 100 });
    });

    it('should unsubscribe', () => {
        webhookService.unsubscribe(webhookId);
        const webhooks = webhookService.listWebhooks(userId);
        const found = webhooks.find(w => w.id === webhookId);
        expect(found).to.not.exist;
    });

    it('should stop the service', () => {
        webhookService.stop();
    });
});
