/**
 * Email Service for Multi-Sig Member Invitations
 * Uses SendGrid or similar service for transactional emails
 */
export interface InvitationEmailParams {
    toEmail: string;
    inviterName: string;
    accountName: string;
    role: string;
    inviteLink: string;
}
export interface TransactionNotificationParams {
    toEmail: string;
    accountName: string;
    transactionDescription: string;
    amount: string;
    tokenSymbol: string;
    approvalCount: number;
    requiredSignatures: number;
    approveLink: string;
}
export declare class EmailService {
    private sendgridApiKey;
    private fromEmail;
    private appUrl;
    constructor();
    /**
     * Send member invitation email
     */
    sendInvitation(params: InvitationEmailParams): Promise<boolean>;
    /**
     * Send transaction approval notification
     */
    sendTransactionNotification(params: TransactionNotificationParams): Promise<boolean>;
    /**
     * Send transaction executed notification
     */
    sendTransactionExecuted(toEmail: string, accountName: string, txHash: string, amount: string, tokenSymbol: string): Promise<boolean>;
    /**
     * Core email sending function
     */
    private sendEmail;
    private generateInvitationHtml;
    private generateTransactionNotificationHtml;
}
export declare const getEmailService: () => EmailService;
export default EmailService;
//# sourceMappingURL=EmailService.d.ts.map