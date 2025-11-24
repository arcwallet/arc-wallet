/**
 * Passkey Diagnostic Utility
 * Based on SendApp's production approach for detecting passkey issues
 * Helps identify high-risk devices and platform limitations
 */
export type PasskeyDiagnosticMode = 'disabled' | 'always' | 'high-risk';
export interface PasskeyDiagnosticResult {
    success: boolean;
    cause?: unknown;
    deviceRisk?: 'low' | 'medium' | 'high';
    platformSupport?: boolean;
    errorMessage?: string;
}
export declare class PasskeyDiagnosticError extends Error {
    cause?: unknown;
    constructor(message: string, options?: {
        cause?: unknown;
    });
}
/**
 * Diagnostic error messages
 */
export declare const PASSKEY_DIAGNOSTIC_MESSAGES: {
    HIGH_RISK_DEVICE: string;
    NO_PLATFORM_SUPPORT: string;
    DIAGNOSTIC_FAILED: string;
};
/**
 * Get diagnostic mode from environment
 */
export declare function getPasskeyDiagnosticMode(): PasskeyDiagnosticMode;
/**
 * Detect if device is from high-risk Android vendor
 */
export declare function isHighRiskDevice(): boolean;
/**
 * Get device risk level
 */
export declare function getDeviceRiskLevel(): 'low' | 'medium' | 'high';
/**
 * Check if platform authenticator is available
 */
export declare function checkPlatformAuthenticatorSupport(): Promise<boolean>;
/**
 * Run passkey diagnostic checks
 */
export declare function runPasskeyDiagnostic(mode?: PasskeyDiagnosticMode): Promise<PasskeyDiagnosticResult>;
/**
 * Get helpful error message based on diagnostic result
 */
export declare function getDiagnosticErrorMessage(result: PasskeyDiagnosticResult): string | null;
