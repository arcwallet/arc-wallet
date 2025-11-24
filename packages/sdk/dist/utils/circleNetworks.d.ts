/**
 * Circle-compatible network configurations
 */
export interface CircleNetwork {
    chainId: number;
    name: string;
    isTestnet: boolean;
    nativeUSDC: boolean;
    cctpSupported: boolean;
    rpcUrl?: string;
}
export declare const CIRCLE_NETWORKS: Record<number, CircleNetwork>;
export declare function getCircleNetwork(chainId: number): CircleNetwork | undefined;
export declare function isCCTPSupported(chainId: number): boolean;
export declare function isNativeUSDC(chainId: number): boolean;
