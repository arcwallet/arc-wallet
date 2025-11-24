/**
 * CCTP Configuration Validator
 * Validates Circle CCTP configuration and warns about placeholders
 */
import { CCTPConfig } from '../types/cctp';
export interface CCTPValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
/**
 * Validates CCTP configuration for a specific chain
 */
export declare function validateCCTPConfig(config: CCTPConfig, chainId: number): CCTPValidationResult;
/**
 * Checks if Arc Network CCTP is properly configured
 */
export declare function isArcNetworkConfigured(config: CCTPConfig): boolean;
/**
 * Gets helpful error message for CCTP configuration issues
 */
export declare function getCCTPConfigErrorMessage(chainId: number): string;
