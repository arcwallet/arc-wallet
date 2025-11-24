interface Webhook {
    id: string;
    userId: string;
    url: string;
    events: string[];
    secret: string;
    createdAt: number;
}
declare class WebhookService {
    private isRunning;
    private processingInterval;
    private readonly MAX_RETRIES;
    /**
     * Start the webhook delivery processor
     */
    start(): void;
    stop(): void;
    /**
     * Subscribe to webhooks
     */
    subscribe(userId: string, url: string, events: string[]): Webhook;
    /**
     * Unsubscribe
     */
    unsubscribe(id: string): void;
    /**
     * List webhooks for a user
     */
    listWebhooks(userId: string): Webhook[];
    /**
     * Trigger a webhook event
     */
    trigger(userId: string, eventType: string, payload: any): void;
    /**
     * Process pending deliveries
     */
    private processQueue;
    /**
     * Deliver a single webhook
     */
    private deliver;
    /**
     * Handle delivery failure with exponential backoff
     */
    private handleFailure;
    private updateDeliveryStatus;
    private signPayload;
}
export declare const webhookService: WebhookService;
export {};
//# sourceMappingURL=webhookService.d.ts.map