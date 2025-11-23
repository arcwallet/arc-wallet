/**
 * Passkey Diagnostic Utility
 * Based on SendApp's production approach for detecting passkey issues
 * Helps identify high-risk devices and platform limitations
 */

import { logger } from './logger';

export type PasskeyDiagnosticMode = 'disabled' | 'always' | 'high-risk';

export interface PasskeyDiagnosticResult {
    success: boolean;
    cause?: unknown;
    deviceRisk?: 'low' | 'medium' | 'high';
    platformSupport?: boolean;
    errorMessage?: string;
}

export class PasskeyDiagnosticError extends Error {
    cause?: unknown;

    constructor(message: string, options?: { cause?: unknown }) {
        super(message);
        this.name = 'PasskeyDiagnosticError';
        if (options?.cause) {
            this.cause = options.cause;
        }
    }
}

// High-risk Android OEM builds known to have WebAuthn issues
// Derived from community bug reports and SendApp's production data
const HIGH_RISK_ANDROID_VENDORS = [
    'vivo',
    'iqoo',
    'oppo',
    'realme',
    'oneplus',
    'xiaomi',
    'redmi',
    'poco',
    'miui',
    'huawei',
    'honor',
    'harmonyos',
    'zte',
    'nubia',
    'meizu',
    'lenovo',
    'moto',
    'motorola',
    'tecno',
    'infinix',
    'funtouch',
    'coloros',
    'oxygenos',
    'originos',
];

/**
 * Diagnostic error messages
 */
export const PASSKEY_DIAGNOSTIC_MESSAGES = {
    HIGH_RISK_DEVICE:
        'Passkey creation may not be reliable on this device. ' +
        'Try using a device with iCloud Keychain (iOS) or ' +
        'Google Password Manager (Android) for best results.',

    NO_PLATFORM_SUPPORT:
        'Your browser does not support passkeys. ' +
        'Please use a modern browser like Chrome, Safari, or Edge.',

    DIAGNOSTIC_FAILED:
        'Passkey health check failed. ' +
        'Try creating your passkey on a different device or browser.',
};

/**
 * Get diagnostic mode from environment
 */
export function getPasskeyDiagnosticMode(): PasskeyDiagnosticMode {
    if (typeof window === 'undefined') return 'disabled';

    const mode = process.env.PASSKEY_DIAGNOSTIC_MODE?.toLowerCase() || 'high-risk';

    if (mode === 'always') return 'always';
    if (mode === 'disabled') return 'disabled';
    return 'high-risk';
}

/**
 * Detect if device is from high-risk Android vendor
 */
export function isHighRiskDevice(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return false;
    }

    const userAgent = navigator.userAgent.toLowerCase();
    const vendor = navigator.vendor?.toLowerCase() || '';
    const platform = navigator.platform?.toLowerCase() || '';

    // Check if any high-risk vendor is mentioned
    return HIGH_RISK_ANDROID_VENDORS.some(riskVendor => {
        return userAgent.includes(riskVendor) ||
            vendor.includes(riskVendor) ||
            platform.includes(riskVendor);
    });
}

/**
 * Get device risk level
 */
export function getDeviceRiskLevel(): 'low' | 'medium' | 'high' {
    if (isHighRiskDevice()) {
        return 'high';
    }

    // Check for older iOS versions (< iOS 16)
    if (typeof navigator !== 'undefined') {
        const ua = navigator.userAgent;
        const iosMatch = ua.match(/OS (\d+)_/);
        if (iosMatch && parseInt(iosMatch[1]) < 16) {
            return 'medium';
        }
    }

    return 'low';
}

/**
 * Check if platform authenticator is available
 */
export async function checkPlatformAuthenticatorSupport(): Promise<boolean> {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
        return false;
    }

    try {
        // Check if platform authenticator is available
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

        logger.debug('Platform authenticator check', {
            component: 'PasskeyDiagnostic',
            available,
        });

        return available;
    } catch (error) {
        logger.warn('Failed to check platform authenticator', {
            component: 'PasskeyDiagnostic',
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}

/**
 * Run passkey diagnostic checks
 */
export async function runPasskeyDiagnostic(
    mode: PasskeyDiagnosticMode = 'high-risk'
): Promise<PasskeyDiagnosticResult> {
    // Skip if disabled
    if (mode === 'disabled') {
        return { success: true, deviceRisk: 'low', platformSupport: true };
    }

    const deviceRisk = getDeviceRiskLevel();
    const platformSupport = await checkPlatformAuthenticatorSupport();

    logger.info('Running passkey diagnostic', {
        component: 'PasskeyDiagnostic',
        mode,
        deviceRisk,
        platformSupport,
    });

    // Always run mode - check everything
    if (mode === 'always') {
        if (!platformSupport) {
            return {
                success: false,
                deviceRisk,
                platformSupport: false,
                errorMessage: PASSKEY_DIAGNOSTIC_MESSAGES.NO_PLATFORM_SUPPORT,
            };
        }

        if (deviceRisk === 'high') {
            return {
                success: false,
                deviceRisk,
                platformSupport,
                errorMessage: PASSKEY_DIAGNOSTIC_MESSAGES.HIGH_RISK_DEVICE,
            };
        }
    }

    // High-risk mode - only warn on high-risk devices
    if (mode === 'high-risk' && deviceRisk === 'high') {
        logger.warn('High-risk device detected', {
            component: 'PasskeyDiagnostic',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        });

        return {
            success: true, // Allow but warn
            deviceRisk,
            platformSupport,
            errorMessage: PASSKEY_DIAGNOSTIC_MESSAGES.HIGH_RISK_DEVICE,
        };
    }

    // All checks passed
    return {
        success: true,
        deviceRisk,
        platformSupport,
    };
}

/**
 * Get helpful error message based on diagnostic result
 */
export function getDiagnosticErrorMessage(result: PasskeyDiagnosticResult): string | null {
    if (result.success && !result.errorMessage) {
        return null;
    }

    if (result.errorMessage) {
        return result.errorMessage;
    }

    if (!result.platformSupport) {
        return PASSKEY_DIAGNOSTIC_MESSAGES.NO_PLATFORM_SUPPORT;
    }

    if (result.deviceRisk === 'high') {
        return PASSKEY_DIAGNOSTIC_MESSAGES.HIGH_RISK_DEVICE;
    }

    return PASSKEY_DIAGNOSTIC_MESSAGES.DIAGNOSTIC_FAILED;
}
