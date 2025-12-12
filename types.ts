
export enum TransactionStatus {
  Pending = 'Pending',
  Completed = 'Completed',
  Failed = 'Failed',
}

export enum TransactionType {
  Sent = 'Sent',
  Received = 'Received',
  Contract = 'Contract',
  Swap = 'Swap',
  Bridge = 'Bridge',
}

export interface Approval {
  address: string;
  status: 'Approved' | 'Awaiting';
}

export interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  timestamp: string;
  date: Date;
  amount: number;
  currency: string;
  usdValue: number;
  status: TransactionStatus;
  hash: string;
  from: string;
  to: string;
  networkFee: number;
  approvals: {
    required: number;
    list: Approval[];
  };
}

// Types for Multi-Signature Approvals
export enum MultiSigStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

export interface Signer {
  address: string;
  role: 'Owner' | 'Signer' | 'Viewer';
  status: 'Signed' | 'Pending' | 'Rejected';
}

export interface MultiSigTransaction {
  id: string;
  actionType: 'Send' | 'Transfer' | 'Contract Call';
  amount: number;
  currency: string;
  usdValue: number;
  requestedBy: string;
  timestamp: string;
  date: Date;
  status: MultiSigStatus;
  from: string;
  to: string;
  networkFee: number;
  signatures: {
    required: number;
    signers: Signer[];
  };
}

// Type for Faucet Transactions
export interface FaucetTransaction {
  id: string;
  hash: string;
  token: string;
  amount: number;
  timestamp: string;
}

// Type for NFTs
export interface Nft {
  id: string;
  name: string;
  description?: string;
  image: string;
  contractAddress: string;
  tokenId: string;
  collection?: string;
}
