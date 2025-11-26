export interface MagicLinkMailerConfig {
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    fromAddress?: string;
    fromName?: string;
    apiKey?: string;
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