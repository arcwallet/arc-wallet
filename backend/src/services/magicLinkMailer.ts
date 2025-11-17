import sgMail from '@sendgrid/mail';

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

export const createMagicLinkMailer = (config: MagicLinkMailerConfig): MagicLinkMailer => {
  const hasCreds = Boolean(config.apiKey && config.fromAddress);

  if (config.apiKey) {
    sgMail.setApiKey(config.apiKey);
  }

  return {
    isConfigured: () => hasCreds,
    async sendMagicLink({ to, url }) {
      if (!hasCreds) {
        console.log('📬 [Magic Link Preview]', to, url);
        return;
      }

      const msg = {
        to,
        from: {
          email: config.fromAddress!,
          name: config.fromName ?? 'Arc Wallet',
        },
        subject: 'Your Arc Wallet magic link',
        text: `Click the link below to sign in:\n${url}\n\nThis link expires in 15 minutes.`,
        html: `
          <p>Hello,</p>
          <p>Click the button below to sign in to Arc Wallet. This link expires in 15 minutes.</p>
          <p><a href="${url}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#5c7cfa;color:#fff;text-decoration:none;">Sign in</a></p>
          <p>If you did not request this email, you can safely ignore it.</p>
        `,
      };

      await sgMail.send(msg);
    },
  };
};
