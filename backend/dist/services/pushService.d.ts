interface PushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}
declare class PushService {
    private publicKey;
    private privateKey;
    constructor();
    getPublicKey(): string;
    /**
     * Save a subscription for a user
     */
    saveSubscription(userId: string, subscription: PushSubscription): {
        endpoint: string;
        keys: {
            p256dh: string;
            auth: string;
        };
        id: string;
        userId: string;
    };
    /**
     * Remove a subscription
     */
    removeSubscription(endpoint: string): void;
    /**
     * Send a notification to a user
     */
    sendNotification(userId: string, payload: any): Promise<void>;
}
export declare const pushService: PushService;
export {};
//# sourceMappingURL=pushService.d.ts.map