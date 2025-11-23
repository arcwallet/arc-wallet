/**
 * CCTP Configuration Validator
 * Validates Circle CCTP configuration and warns about placeholders
 */

import { CCTPConfig } from '../types/cctp';
import { logger } from './logger';

const PLACEHOLDER_ADDRESS = '0x0000000000000000000000000000000000000000';
const PLACEHOLDER_PATTERN = /^0x\.\.\.$/;

export interface CCTPValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validates CCTP configuration for a specific chain
 */
export function validateCCTPConfig(
    config: CCTPConfig,
    chainId: number
): CCTPValidationResult {
    const result: CCTPValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
    };

    // Check if chain is supported
    const tokenMessenger = config.tokenMessengerAddresses?.[chainId];
    const usdcAddress = config.usdcAddresses?.[chainId];
    const domainId = config.domainIds?.[chainId];

    if (!tokenMessenger) {
        result.errors.push(
            `TokenMessenger address not configured for chain ID ${chainId}`
        );
        result.isValid = false;
    }

    if (!usdcAddress) {
        result.errors.push(`USDC address not configured for chain ID ${chainId}`);
        result.isValid = false;
    }

    if (domainId === undefined) {
        result.errors.push(`Domain ID not configured for chain ID ${chainId}`);
        result.isValid = false;
    }

    // Check for placeholder values (Arc Network specific)
    if (chainId === 412346) {
        // Arc Testnet
        if (
            tokenMessenger === PLACEHOLDER_ADDRESS ||
            PLACEHOLDER_PATTERN.test(tokenMessenger || '')
        ) {
            result.warnings.push(
                '⚠️  Arc Network TokenMessenger address is a PLACEHOLDER. ' +
                'Cross-chain transfers will FAIL. ' +
                'Please obtain the correct address from the Arc Network team.'
            );
            result.isValid = false;
        }

        if (
            usdcAddress === PLACEHOLDER_ADDRESS ||
            PLACEHOLDER_PATTERN.test(usdcAddress || '')
        ) {
            result.warnings.push(
                '⚠️  Arc Network USDC address is a PLACEHOLDER. ' +
                'Cross-chain transfers will FAIL. ' +
                'Please obtain the correct address from the Arc Network team.'
            );
            result.isValid = false;
        }

        // Domain ID 7 is suspicious but might be correct
        if (domainId === 7) {
            result.warnings.push(
                'ℹ️  Arc Network domain ID (7) should be verified with Circle team. ' +
                'Incorrect domain ID will cause transfer failures.'
            );
        }
    }

    // Log warnings
    if (result.warnings.length > 0) {
        result.warnings.forEach((warning) => {
            logger.warn(warning, {
                component: 'CCTPValidator',
                chainId,
            });
        });
    }

    // Log errors
    if (result.errors.length > 0) {
        result.errors.forEach((error) => {
            logger.error(error, undefined, {
                component: 'CCTPValidator',
                chainId,
            });
        });
    }

    return result;
}

/**
 * Checks if Arc Network CCTP is properly configured
 */
export function isArcNetworkConfigured(config: CCTPConfig): boolean {
    const validation = validateCCTPConfig(config, 412346);
    return validation.isValid && validation.warnings.length === 0;
}

/**
 * Gets helpful error message for CCTP configuration issues
 */
export function getCCTPConfigErrorMessage(chainId: number): string {
    if (chainId === 412346) {
        return (
            'Arc Network CCTP is not properly configured. ' +
            'Please update the following in your WalletSDK config:\n\n' +
            '```typescript\n' +
            'const sdk = new WalletSDK({\n' +
            '  // ... other config\n' +
            '  cctp: {\n' +
            '    tokenMessengerAddresses: {\n' +
            '      412346: "0x..." // Get from Arc Network team\n' +
            '    },\n' +
            '    usdcAddresses: {\n' +
            '      412346: "0x..." // Get from Arc Network team\n' +
            '    },\n' +
            '    domainIds: {\n' +
            '      412346: 7 // Verify with Circle team\n' +
            '    }\n' +
            '  }\n' +
            '});\n' +
            '```'
        );
    }

    return `CCTP configuration missing for chain ID ${chainId}`;
}
