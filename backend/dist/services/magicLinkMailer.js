import sgMail from '@sendgrid/mail';
export const createMagicLinkMailer = (config) => {
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
                    email: config.fromAddress,
                    name: config.fromName ?? 'Arc Wallet',
                },
                subject: 'Sign in to Arc Wallet - Your secure access link',
                text: `Hello,\n\nClick the link below to sign in to your Arc Wallet account:\n\n${url}\n\nThis link is valid for 15 minutes and can only be used once.\n\nIf you did not request this email, you can safely ignore it.\n\nBest regards,\nArc Wallet Team`,
                html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta name="x-apple-disable-message-reformatting">
            <title>Sign in to Arc Wallet</title>
            <!--[if mso]>
            <style type="text/css">
              body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
            </style>
            <![endif]-->
          </head>
          <body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f4f4f7;">
              <tr>
                <td align="center" style="padding:40px 20px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                    <!-- Header -->
                    <tr>
                      <td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #e8e8e8;">
                        <h1 style="margin:0;font-size:24px;font-weight:700;color:#1a1a1a;">Arc Wallet</h1>
                      </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                      <td style="padding:32px;">
                        <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#1a1a1a;">Sign in to your account</h2>
                        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a5568;">
                          Click the button below to securely access your Arc Wallet account. This link is valid for <strong>15 minutes</strong> and can only be used once.
                        </p>
                        <!-- Button -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                          <tr>
                            <td style="border-radius:8px;background:linear-gradient(135deg, #6c7cff, #4aa9ff);">
                              <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                                Sign in to Arc Wallet
                              </a>
                            </td>
                          </tr>
                        </table>
                        <!-- Divider -->
                        <div style="margin:32px 0;border-top:1px solid #e8e8e8;"></div>
                        <!-- Alternative link -->
                        <p style="margin:0 0 8px;font-size:13px;color:#718096;">
                          If the button doesn't work, copy and paste this link into your browser:
                        </p>
                        <p style="margin:0;font-size:13px;word-break:break-all;">
                          <a href="${url}" target="_blank" style="color:#6c7cff;text-decoration:none;">${url}</a>
                        </p>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="padding:24px 32px;background-color:#f9fafb;border-top:1px solid #e8e8e8;border-radius:0 0 8px 8px;">
                        <p style="margin:0 0 8px;font-size:13px;color:#718096;line-height:1.5;">
                          If you did not request this email, you can safely ignore it. No changes will be made to your account.
                        </p>
                        <p style="margin:0;font-size:12px;color:#a0aec0;">
                          © ${new Date().getFullYear()} Arc Wallet. All rights reserved.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
            };
            await sgMail.send(msg);
            console.log('✉️  Magic link email sent to', to);
        },
    };
};
//# sourceMappingURL=magicLinkMailer.js.map