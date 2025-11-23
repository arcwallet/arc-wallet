/**
 * CCTP Manager - Handles Circle Cross-Chain Transfer Protocol operations
 */

import { Contract, parseUnits, formatUnits, keccak256, getBytes } from 'ethers';
import type { JsonRpcProvider, Wallet } from 'ethers';
import { TOKEN_MESSENGER_ABI, USDC_ABI } from './cctp-abis';
import type {
    CCTPConfig,
    CCTPTransferParams,
    CCTPTransferResult,
    CCTPAttestation,
} from '../types/cctp';
import { DEFAULT_CCTP_CONFIG } from '../types/cctp';

export class CCTPManager {
    private config: CCTPConfig;
    private provider: JsonRpcProvider;

    constructor(provider: JsonRpcProvider, config?: Partial<CCTPConfig>) {
        this.provider = provider;
        this.config = { ...DEFAULT_CCTP_CONFIG, ...config };
    }

    /**
     * Transfer USDC cross-chain using CCTP
     */
    async transferUSDC(
        wallet: Wallet,
        params: CCTPTransferParams
    ): Promise<CCTPTransferResult> {
        try {
            const sourceChainId = Number((await this.provider.getNetwork()).chainId);
            const { destinationChainId, destinationAddress, amount } = params;

            console.log('[CCTP] Starting cross-chain USDC transfer:', {
                from: sourceChainId,
                to: destinationChainId,
                amount,
            });

            // Step 1: Get contract addresses
            const tokenMessengerAddress = this.config.tokenMessengerAddresses[sourceChainId];
            const usdcAddress = this.config.usdcAddresses[sourceChainId];
            const destinationDomain = this.config.domainIds[destinationChainId];

            if (!tokenMessengerAddress || !usdcAddress || destinationDomain === undefined) {
                throw new Error(`CCTP not supported for chain ${sourceChainId}`);
            }

            // Step 2: Parse amount (USDC has 6 decimals)
            const amountInAtomicUnits = parseUnits(amount, 6);

            // Step 3: Check and approve USDC
            const usdcContract = new Contract(usdcAddress, USDC_ABI, wallet);
            const allowance = await usdcContract.allowance(wallet.address, tokenMessengerAddress);

            if (allowance < amountInAtomicUnits) {
                console.log('[CCTP] Approving USDC...');
                const approveTx = await usdcContract.approve(
                    tokenMessengerAddress,
                    amountInAtomicUnits
                );
                await approveTx.wait();
                console.log('[CCTP] USDC approved');
            }

            // Step 4: Convert destination address to bytes32
            const mintRecipient = this.addressToBytes32(destinationAddress);

            // Step 5: Call depositForBurn
            console.log('[CCTP] Calling depositForBurn...');
            const tokenMessenger = new Contract(
                tokenMessengerAddress,
                TOKEN_MESSENGER_ABI,
                wallet
            );

            const tx = await tokenMessenger.depositForBurn(
                amountInAtomicUnits,
                destinationDomain,
                mintRecipient,
                usdcAddress
            );

            const receipt = await tx.wait();
            console.log('[CCTP] Burn transaction confirmed:', receipt.hash);

            // Step 6: Extract message hash from logs
            const messageHash = this.extractMessageHash(receipt);

            // Step 7: Get attestation (async)
            const result: CCTPTransferResult = {
                sourceTxHash: receipt.hash,
                messageHash,
                status: 'pending',
            };

            // Start attestation polling in background
            this.pollForAttestation(messageHash)
                .then((attestation) => {
                    result.attestation = attestation;
                    result.status = 'attested';
                    console.log('[CCTP] Attestation received');
                })
                .catch((error) => {
                    console.error('[CCTP] Attestation failed:', error);
                    result.status = 'failed';
                });

            return result;
        } catch (error: any) {
            console.error('[CCTP] Transfer failed:', error);
            throw new Error(`CCTP transfer failed: ${error.message}`);
        }
    }

    /**
     * Get attestation from Circle's attestation service
     */
    async getAttestation(messageHash: string): Promise<string> {
        const url = `${this.config.attestationServiceUrl}/v1/attestations/${messageHash}`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Attestation not ready yet');
                }
                throw new Error(`Attestation service error: ${response.statusText}`);
            }

            const data: CCTPAttestation = await response.json();

            if (data.status !== 'complete') {
                throw new Error('Attestation not complete');
            }

            return data.attestation;
        } catch (error: any) {
            throw new Error(`Failed to get attestation: ${error.message}`);
        }
    }

    /**
     * Poll for attestation with retries
     */
    private async pollForAttestation(
        messageHash: string,
        maxRetries = 60,
        interval = 5000
    ): Promise<string> {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const attestation = await this.getAttestation(messageHash);
                return attestation;
            } catch (error: any) {
                if (i === maxRetries - 1) {
                    throw error;
                }
                // Wait before retry
                await new Promise((resolve) => setTimeout(resolve, interval));
            }
        }
        throw new Error('Attestation timeout');
    }

    /**
     * Convert Ethereum address to bytes32 format
     */
    private addressToBytes32(address: string): string {
        // Remove 0x prefix if present
        const cleanAddress = address.toLowerCase().replace('0x', '');
        // Pad to 32 bytes (64 hex characters)
        return '0x' + cleanAddress.padStart(64, '0');
    }

    /**
     * Extract message hash from transaction receipt
     */
    private extractMessageHash(receipt: any): string {
        // Look for MessageSent event
        const messageSentTopic = keccak256(
            getBytes(
                'MessageSent(bytes)'
            )
        );

        const log = receipt.logs.find((log: any) => log.topics[0] === messageSentTopic);

        if (!log) {
            throw new Error('MessageSent event not found in transaction');
        }

        // Message hash is keccak256 of the message bytes
        const messageBytes = log.data;
        return keccak256(messageBytes);
    }

    /**
     * Get USDC balance
     */
    async getUSDCBalance(address: string, chainId?: number): Promise<string> {
        const targetChainId = chainId || Number((await this.provider.getNetwork()).chainId);
        const usdcAddress = this.config.usdcAddresses[targetChainId];

        if (!usdcAddress) {
            throw new Error(`USDC not supported on chain ${targetChainId}`);
        }

        const usdcContract = new Contract(usdcAddress, USDC_ABI, this.provider);
        const balance = await usdcContract.balanceOf(address);

        return formatUnits(balance, 6);
    }
}
