export interface MagicLinkMailerConfig {
    apiKey?: string;
    fromAddress?: string;
    fromName?: string;
}
export interface MagicLinkMessage {
    to: string;
    url: string;
}
export interface MagicLinkMailer {
    sendMagicLink: (message: MagicLinkMessage) => Promise<void>;
    isConfigured: () => boolean;
}
export declare const createMagicLinkMailer: (config: MagicLinkMailerConfig) => MagicLinkMailer;
//# sourceMappingURL=magicLinkMailer.d.ts.map