/**
 * Email Service for Multi-Sig Member Invitations
 * Uses SendGrid or similar service for transactional emails
 */
export class EmailService {
    sendgridApiKey;
    fromEmail;
    appUrl;
    constructor() {
        this.sendgridApiKey = process.env.SENDGRID_API_KEY || null;
        this.fromEmail = process.env.EMAIL_FROM || 'noreply@arcwallet.network';
        this.appUrl = process.env.APP_URL || 'https://arcwallet.network';
    }
    /**
     * Send member invitation email
     */
    async sendInvitation(params) {
        const { toEmail, inviterName, accountName, role, inviteLink } = params;
        const subject = `You've been invited to join ${accountName} on Arc Wallet`;
        const htmlContent = this.generateInvitationHtml({
            inviterName,
            accountName,
            role,
            inviteLink,
        });
        return this.sendEmail(toEmail, subject, htmlContent);
    }
    /**
     * Send transaction approval notification
     */
    async sendTransactionNotification(params) {
        const { toEmail, accountName, transactionDescription, amount, tokenSymbol, approvalCount, requiredSignatures, approveLink, } = params;
        const subject = `[${accountName}] New transaction requires your approval`;
        const htmlContent = this.generateTransactionNotificationHtml({
            accountName,
            transactionDescription,
            amount,
            tokenSymbol,
            approvalCount,
            requiredSignatures,
            approveLink,
        });
        return this.sendEmail(toEmail, subject, htmlContent);
    }
    /**
     * Send transaction executed notification
     */
    async sendTransactionExecuted(toEmail, accountName, txHash, amount, tokenSymbol) {
        const subject = `[${accountName}] Transaction executed successfully`;
        const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 30px; }
          .header { text-align: center; margin-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #22d3ee; }
          h1 { color: #22d3ee; font-size: 20px; }
          .success-badge { background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; }
          .tx-hash { background: #334155; padding: 10px; border-radius: 8px; font-family: monospace; font-size: 12px; word-break: break-all; }
          .footer { margin-top: 30px; text-align: center; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Arc Wallet</div>
          </div>
          <h1>Transaction Executed</h1>
          <p><span class="success-badge">Success</span></p>
          <p>A transaction from <strong>${accountName}</strong> has been executed:</p>
          <p style="font-size: 24px; color: #22d3ee; font-weight: bold;">${amount} ${tokenSymbol}</p>
          <p>Transaction Hash:</p>
          <div class="tx-hash">${txHash}</div>
          <p style="margin-top: 20px;">
            <a href="https://testnet.arcscan.app/tx/${txHash}" style="color: #22d3ee;">View on ArcScan</a>
          </p>
          <div class="footer">
            <p>Arc Wallet - Multi-Sig Corporate Wallets</p>
          </div>
        </div>
      </body>
      </html>
    `;
        return this.sendEmail(toEmail, subject, htmlContent);
    }
    /**
     * Core email sending function
     */
    async sendEmail(to, subject, htmlContent) {
        if (!this.sendgridApiKey) {
            console.log('Email service not configured. Would send to:', to);
            console.log('Subject:', subject);
            // In development, just log the email
            return true;
        }
        try {
            const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.sendgridApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    personalizations: [{ to: [{ email: to }] }],
                    from: { email: this.fromEmail, name: 'Arc Wallet' },
                    subject,
                    content: [{ type: 'text/html', value: htmlContent }],
                }),
            });
            if (!response.ok) {
                console.error('SendGrid error:', await response.text());
                return false;
            }
            return true;
        }
        catch (error) {
            console.error('Email send error:', error);
            return false;
        }
    }
    generateInvitationHtml(params) {
        const { inviterName, accountName, role, inviteLink } = params;
        const roleLabel = role === 'owner' ? 'Owner' : role === 'signer' ? 'Signer' : 'Viewer';
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 30px; }
          .header { text-align: center; margin-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #22d3ee; }
          h1 { color: #22d3ee; font-size: 20px; }
          .role-badge { background: #3b82f6; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
          .cta-button { display: inline-block; background: #22d3ee; color: #0f172a; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px; }
          .footer { margin-top: 30px; text-align: center; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Arc Wallet</div>
          </div>
          <h1>You've Been Invited!</h1>
          <p><strong>${inviterName}</strong> has invited you to join the multi-sig wallet:</p>
          <p style="font-size: 24px; color: white; font-weight: bold;">${accountName}</p>
          <p>Your role: <span class="role-badge">${roleLabel}</span></p>
          <p>As a ${roleLabel.toLowerCase()}, you'll be able to ${role === 'owner'
            ? 'manage the wallet, add members, and approve transactions'
            : role === 'signer'
                ? 'propose and approve transactions'
                : 'view wallet activity'}.</p>
          <center>
            <a href="${inviteLink}" class="cta-button">Accept Invitation</a>
          </center>
          <div class="footer">
            <p>This invitation will expire in 7 days.</p>
            <p>Arc Wallet - Multi-Sig Corporate Wallets</p>
          </div>
        </div>
      </body>
      </html>
    `;
    }
    generateTransactionNotificationHtml(params) {
        const { accountName, transactionDescription, amount, tokenSymbol, approvalCount, requiredSignatures, approveLink, } = params;
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 30px; }
          .header { text-align: center; margin-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #22d3ee; }
          h1 { color: #f59e0b; font-size: 20px; }
          .progress { background: #334155; border-radius: 8px; padding: 15px; margin: 20px 0; }
          .progress-bar { background: #475569; border-radius: 4px; height: 8px; overflow: hidden; }
          .progress-fill { background: #22d3ee; height: 100%; transition: width 0.3s; }
          .cta-button { display: inline-block; background: #22d3ee; color: #0f172a; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px; }
          .footer { margin-top: 30px; text-align: center; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Arc Wallet</div>
          </div>
          <h1>Approval Required</h1>
          <p>A new transaction in <strong>${accountName}</strong> needs your approval:</p>
          <p style="color: #94a3b8;">${transactionDescription || 'Transfer'}</p>
          <p style="font-size: 32px; color: #22d3ee; font-weight: bold;">${amount} ${tokenSymbol}</p>
          <div class="progress">
            <p style="margin: 0 0 10px 0;">Approvals: ${approvalCount} of ${requiredSignatures}</p>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${(approvalCount / requiredSignatures) * 100}%"></div>
            </div>
          </div>
          <center>
            <a href="${approveLink}" class="cta-button">Review & Approve</a>
          </center>
          <div class="footer">
            <p>This transaction will expire in 24 hours.</p>
            <p>Arc Wallet - Multi-Sig Corporate Wallets</p>
          </div>
        </div>
      </body>
      </html>
    `;
    }
}
// Singleton instance
let emailServiceInstance = null;
export const getEmailService = () => {
    if (!emailServiceInstance) {
        emailServiceInstance = new EmailService();
    }
    return emailServiceInstance;
};
export default EmailService;
//# sourceMappingURL=EmailService.js.map