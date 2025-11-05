import { Contract, JsonRpcProvider, Wallet, parseUnits } from 'ethers';
import { ARC_SMART_ACCOUNT_ABI } from './smartAccountService.ts';
import { getArcRpcUrl } from '../config/rpc';

export const RPC_URL = getArcRpcUrl();

export const getProvider = () => new JsonRpcProvider(RPC_URL);

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
