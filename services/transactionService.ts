import { Contract, JsonRpcProvider, Wallet, parseUnits } from 'ethers';
import { ARC_SMART_ACCOUNT_ABI } from './smartAccountService.ts';

const runtimeEnv =
  typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined'
    ? (import.meta.env as Record<string, string | undefined>)
    : (process.env as Record<string, string | undefined>);

export const RPC_URL =
  runtimeEnv?.VITE_ARC_RPC_URL ?? runtimeEnv?.ARC_RPC_URL ?? 'https://rpc.testnet.arc.network';

let sharedProvider: JsonRpcProvider | null = null;

export const getProvider = () => {
  if (!sharedProvider) {
    sharedProvider = new JsonRpcProvider(RPC_URL);
    sharedProvider.pollingInterval = 6000;
  }
  return sharedProvider;
};

export interface FeeEstimate {
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  totalFeeWei: bigint;
}

const DEFAULT_EOA_GAS_LIMIT = 21_000n;
const DEFAULT_SMART_ACCOUNT_GAS_LIMIT = 120_000n;
const ZERO_DATA = '0x';

export const getFeeSettings = async (provider: JsonRpcProvider) => {
  const feeData = await provider.getFeeData();
  const maxFeePerGas = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? 0n;
  return { maxFeePerGas, maxPriorityFeePerGas };
};

export async function estimateNativeTransfer(params: {
  from: string;
  to: string;
  amount: string;
}): Promise<FeeEstimate> {
  const provider = getProvider();
  const value = parseUnits(params.amount || '0', 18);

  const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeSettings(provider);

  let gasLimit = DEFAULT_EOA_GAS_LIMIT;
  try {
    const estimate = await provider.estimateGas({
      from: params.from,
      to: params.to,
      value,
    });
    gasLimit = estimate;
  } catch (error) {
    console.warn('Gas estimation failed, using default limit', error);
  }

  const totalFeeWei = maxFeePerGas > 0n ? maxFeePerGas * gasLimit : 0n;

  return {
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    totalFeeWei,
  };
}

export async function sendNativeTransfer(params: {
  sessionPrivateKey: string;
  to: string;
  amount: string;
}): Promise<string> {
  const provider = getProvider();
  const wallet = new Wallet(params.sessionPrivateKey, provider);
  const value = parseUnits(params.amount, 18);

  const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeSettings(provider);

  const transaction = await wallet.sendTransaction({
    to: params.to,
    value,
    maxFeePerGas: maxFeePerGas ?? undefined,
    maxPriorityFeePerGas: maxPriorityFeePerGas || undefined,
  });
  const receipt = await transaction.wait();
  return receipt.hash;
}

export async function estimateSmartAccountExecute(params: {
  sessionPrivateKey: string;
  smartAccountAddress: string;
  to: string;
  amount: string;
  data?: string;
}): Promise<FeeEstimate> {
  const provider = getProvider();
  const wallet = new Wallet(params.sessionPrivateKey, provider);
  const contract = new Contract(params.smartAccountAddress, ARC_SMART_ACCOUNT_ABI, wallet);
  const value = parseUnits(params.amount || '0', 18);
  const callData = params.data ?? ZERO_DATA;

  const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeSettings(provider);

  let gasLimit = DEFAULT_SMART_ACCOUNT_GAS_LIMIT;
  try {
    const estimate = await contract.estimateGas.execute(params.to, value, callData);
    gasLimit = estimate;
  } catch (error) {
    console.warn('Smart account gas estimation failed, using default limit', error);
  }

  const totalFeeWei = maxFeePerGas > 0n ? maxFeePerGas * gasLimit : 0n;

  return {
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    totalFeeWei,
  };
}

export async function sendSmartAccountExecute(params: {
  sessionPrivateKey: string;
  smartAccountAddress: string;
  to: string;
  amount: string;
  data?: string;
}): Promise<string> {
  const provider = getProvider();
  const wallet = new Wallet(params.sessionPrivateKey, provider);
  const contract = new Contract(params.smartAccountAddress, ARC_SMART_ACCOUNT_ABI, wallet);
  const value = parseUnits(params.amount, 18);
  const callData = params.data ?? ZERO_DATA;

  const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeSettings(provider);

  const tx = await contract.execute(params.to, value, callData, {
    maxFeePerGas: maxFeePerGas || undefined,
    maxPriorityFeePerGas: maxPriorityFeePerGas || undefined,
  });
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function estimateSmartAccountBatchExecute(params: {
  sessionPrivateKey: string;
  smartAccountAddress: string;
  transactions: {
    to: string;
    value: bigint;
    data: string;
  }[];
}): Promise<FeeEstimate> {
  const provider = getProvider();
  const wallet = new Wallet(params.sessionPrivateKey, provider);
  const contract = new Contract(params.smartAccountAddress, ARC_SMART_ACCOUNT_ABI, wallet);

  const dests = params.transactions.map(t => t.to);
  const values = params.transactions.map(t => t.value);
  const funcs = params.transactions.map(t => t.data);

  const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeSettings(provider);

  let gasLimit = DEFAULT_SMART_ACCOUNT_GAS_LIMIT;
  try {
    const estimate = await contract.estimateGas.executeBatch(dests, values, funcs);
    gasLimit = estimate;
  } catch (error) {
    console.warn('Smart account batch gas estimation failed, using default limit', error);
  }

  const totalFeeWei = maxFeePerGas > 0n ? maxFeePerGas * gasLimit : 0n;

  return {
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    totalFeeWei,
  };
}

export async function sendSmartAccountBatchExecute(params: {
  sessionPrivateKey: string;
  smartAccountAddress: string;
  transactions: {
    to: string;
    value: bigint;
    data: string;
  }[];
}): Promise<string> {
  const provider = getProvider();
  const wallet = new Wallet(params.sessionPrivateKey, provider);
  const contract = new Contract(params.smartAccountAddress, ARC_SMART_ACCOUNT_ABI, wallet);

  const dests = params.transactions.map(t => t.to);
  const values = params.transactions.map(t => t.value);
  const funcs = params.transactions.map(t => t.data);

  const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeSettings(provider);

  const tx = await contract.executeBatch(dests, values, funcs, {
    maxFeePerGas: maxFeePerGas || undefined,
    maxPriorityFeePerGas: maxPriorityFeePerGas || undefined,
  });
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function ensureAccountHasBalance(params: {
  funderPrivateKey: string;
  targetAddress: string;
  minBalanceWei: bigint;
  topUpAmountWei?: bigint;
}): Promise<{ toppedUp: boolean; txHash?: string }> {
  const provider = getProvider();
  const targetBalance = await provider.getBalance(params.targetAddress);
  if (targetBalance >= params.minBalanceWei) {
    return { toppedUp: false };
  }

  const funder = new Wallet(params.funderPrivateKey, provider);
  const funderBalance = await provider.getBalance(funder.address);
  const deficit = params.minBalanceWei - targetBalance;
  const buffer = params.topUpAmountWei ?? deficit;
  const value = buffer > deficit ? buffer : deficit;

  if (funderBalance <= value) {
    throw new Error('Funder account does not have enough balance to top up owner wallet.');
  }

  const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeSettings(provider);

  const tx = await funder.sendTransaction({
    to: params.targetAddress,
    value,
    maxFeePerGas: maxFeePerGas || undefined,
    maxPriorityFeePerGas: maxPriorityFeePerGas || undefined,
  });
  const receipt = await tx.wait();
  return { toppedUp: true, txHash: receipt.hash };
}

// ERC-20 Token ABI for transfer function
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

/**
 * Send ERC20 tokens directly from EOA wallet
 */
export async function sendERC20Transfer(params: {
  privateKey: string;
  tokenAddress: string;
  to: string;
  amount: string; // amount in token's decimals (e.g., for USDC with 6 decimals)
  decimals: number;
}): Promise<string> {
  const provider = getProvider();
  const wallet = new Wallet(params.privateKey, provider);
  const contract = new Contract(params.tokenAddress, ERC20_ABI, wallet);

  // Parse amount according to token decimals
  const amountWei = parseUnits(params.amount, params.decimals);

  const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeSettings(provider);

  const tx = await contract.transfer(params.to, amountWei, {
    maxFeePerGas: maxFeePerGas || undefined,
    maxPriorityFeePerGas: maxPriorityFeePerGas || undefined,
  });

  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Estimate gas for ERC20 token transfer from EOA
 */
export async function estimateERC20Transfer(params: {
  from: string;
  tokenAddress: string;
  to: string;
  amount: string;
  decimals: number;
}): Promise<FeeEstimate> {
  const provider = getProvider();
  const contract = new Contract(params.tokenAddress, ERC20_ABI, provider);

  const amountWei = parseUnits(params.amount, params.decimals);

  const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeSettings(provider);

  let gasLimit = 65000n; // Default gas limit for ERC20 transfer
  try {
    // First check if sender has sufficient balance
    const balance = await contract.balanceOf(params.from);
    if (balance < amountWei) {
      console.warn(`Insufficient balance for gas estimation. Balance: ${balance.toString()}, Required: ${amountWei.toString()}`);
      // Return default gas limit without throwing error
      const totalFeeWei = maxFeePerGas > 0n ? maxFeePerGas * gasLimit : 0n;
      return {
        gasLimit,
        maxFeePerGas,
        maxPriorityFeePerGas,
        totalFeeWei,
      };
    }

    const estimate = await contract.transfer.estimateGas(params.to, amountWei, {
      from: params.from,
    });
    gasLimit = estimate;
  } catch (error) {
    console.warn('ERC20 transfer gas estimation failed, using default limit', error);
    // Don't throw - just use default gas limit
  }

  const totalFeeWei = maxFeePerGas > 0n ? maxFeePerGas * gasLimit : 0n;

  return {
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    totalFeeWei,
  };
}
