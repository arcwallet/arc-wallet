// Fix: Import the Nft type
import { Transaction, TransactionStatus, TransactionType, MultiSigTransaction, MultiSigStatus, FaucetTransaction, Nft } from './types';

export const TRANSACTIONS: Transaction[] = [];

export const MULTI_SIG_TRANSACTIONS: MultiSigTransaction[] = [];

export const FAUCET_TRANSACTIONS: FaucetTransaction[] = [];

// Fix: Add and export NFTS constant
export const NFTS: Nft[] = [];
