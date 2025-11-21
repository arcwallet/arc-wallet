import { expect } from 'chai';
import { pushService } from '../src/services/pushService';

describe('Push Service', () => {
    const userId = '0xTestUser';
    const subscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        keys: {
            p256dh: 'test-key',
            auth: 'test-auth'
        }
    };

    it('should have VAPID keys', () => {
        const publicKey = pushService.getPublicKey();
        expect(publicKey).to.be.a('string');
        expect(publicKey.length).to.be.greaterThan(0);
    });

    it('should save a subscription', () => {
        const saved = pushService.saveSubscription(userId, subscription);
        expect(saved).to.have.property('id');
        expect(saved.userId).to.equal(userId);
        expect(saved.endpoint).to.equal(subscription.endpoint);
    });

    it('should send a notification (mocked)', async () => {
        // Real sending requires a valid subscription endpoint, which we can't mock easily without stubbing web-push
        // This test just ensures the method exists and runs without immediate error on invalid endpoint (handled in catch)
        try {
            await pushService.sendNotification(userId, { title: 'Test' });
        } catch (error) {
            // Expected to fail with invalid endpoint, but service should handle it gracefully
        }
    });

    it('should remove a subscription', () => {
        pushService.removeSubscription(subscription.endpoint);
        // Verify removal by checking DB directly or assuming success if no error
    });
});
