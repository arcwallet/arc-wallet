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
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="font-family:Arial,Helvetica,sans-serif;">
            <tr>
              <td style="padding:20px 0;color:#eef3f8;">
                <p style="margin:0 0 16px;">Hello,</p>
                <p style="margin:0 0 16px;">Click the button below to sign in to Arc Wallet. This link expires in 15 minutes.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;">
                  <tr>
                    <td style="border-radius:32px;" bgcolor="#5c7cfa">
                      <a href="${url}" style="font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;padding:14px 28px;display:inline-block;border-radius:32px;">
                        Sign in
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin-top:12px;">
                  If the button above does not work, copy and paste this URL into your browser:<br />
                  <a href="${url}" style="color:#5c7cfa;">${url}</a>
                </p>
                <p style="margin:24px 0 0;">If you did not request this email, you can safely ignore it.</p>
              </td>
            </tr>
          </table>
        `,
      };

      await sgMail.send(msg);
      console.log('✉️  Magic link email sent to', to);
    },
  };
};
