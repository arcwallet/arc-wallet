/**
 * Circle MSCA (Modular Smart Contract Account) Detector
 */
import { Provider } from 'ethers';
/**
 * Detect if an address is a Circle MSCA
 */
export declare function isCircleMSCA(address: string, provider: Provider): Promise<boolean>;
