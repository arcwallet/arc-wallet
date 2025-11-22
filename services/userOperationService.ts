import { AbiCoder, Contract, JsonRpcProvider, Wallet, keccak256, parseUnits, toBeHex, Interface } from 'ethers';
import { ARC_SMART_ACCOUNT_ABI } from './smartAccountService.ts';
import { getProvider, getFeeSettings, RPC_URL } from './transactionService.ts';

const runtimeEnv =
  typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined'
    ? (import.meta.env as Record<string, string | undefined>)
    : (process.env as Record<string, string | undefined>);

const ENTRY_POINT_ENV = runtimeEnv?.VITE_ARC_ENTRY_POINT ?? runtimeEnv?.ARC_ENTRY_POINT;
const BUNDLER_URL_ENV = runtimeEnv?.VITE_ARC_BUNDLER_URL ?? runtimeEnv?.ARC_BUNDLER_URL;

export const ENTRY_POINT =
  ENTRY_POINT_ENV && ENTRY_POINT_ENV !== '' ? ENTRY_POINT_ENV : '0x0000000000000000000000000000000000000000';
export const BUNDLER_URL = BUNDLER_URL_ENV && BUNDLER_URL_ENV !== '' ? BUNDLER_URL_ENV : null;

const abiCoder = new AbiCoder();

export interface UserOperation {
  sender: string;
  nonce: bigint;
  initCode: string;
  callData: string;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: string;
  signature: string;
}

interface SendUserOperationParams {
  sessionPrivateKey: string;
  smartAccountAddress: string;
  to?: string;
  amount?: string;
  data?: string;
  transactions?: {
    to: string;
    value: bigint;
    data: string;
  }[];
}

const DEFAULT_VERIFICATION_GAS_LIMIT = 200_000n;
const DEFAULT_PRE_VERIFICATION_GAS = 50_000n;

const hashBytes = (value: string) => keccak256(value === '0x' ? new Uint8Array() : value);

const packUserOp = (op: UserOperation) => {
  return abiCoder.encode(
    [
      'address',
      'uint256',
      'bytes32',
      'bytes32',
      'uint256',
      'uint256',
      'uint256',
      'uint256',
      'uint256',
      'bytes32',
    ],
    [
      op.sender,
      op.nonce,
      hashBytes(op.initCode),
      hashBytes(op.callData),
      op.callGasLimit,
      op.verificationGasLimit,
      op.preVerificationGas,
      op.maxFeePerGas,
      op.maxPriorityFeePerGas,
      hashBytes(op.paymasterAndData),
    ],
  );
};

const getUserOpHash = (op: UserOperation, entryPoint: string, chainId: bigint) => {
  const userOpPackHash = keccak256(packUserOp(op));
  return keccak256(
    abiCoder.encode(['bytes32', 'address', 'uint256'], [userOpPackHash, entryPoint, chainId]),
  );
};

const serializeUserOp = (op: UserOperation) => ({
  sender: op.sender,
  nonce: toBeHex(op.nonce),
  initCode: op.initCode,
  callData: op.callData,
  callGasLimit: toBeHex(op.callGasLimit),
  verificationGasLimit: toBeHex(op.verificationGasLimit),
  preVerificationGas: toBeHex(op.preVerificationGas),
  maxFeePerGas: toBeHex(op.maxFeePerGas),
  maxPriorityFeePerGas: toBeHex(op.maxPriorityFeePerGas),
  paymasterAndData: op.paymasterAndData,
  signature: op.signature,
});

export async function sendSmartAccountUserOperation(
  params: SendUserOperationParams,
): Promise<{ userOpHash: string; bundlerResponse: unknown }> {
  if (ENTRY_POINT === '0x0000000000000000000000000000000000000000' || !BUNDLER_URL) {
    throw new Error('ENTRY_POINT is not configured. Set VITE_ARC_ENTRY_POINT before using bundler flow.');
  }

  const provider = new JsonRpcProvider(RPC_URL);
  const entryPointContract = new Contract(ENTRY_POINT, ['function getNonce(address,uint192) view returns (uint256)'], provider);
  const nonce = await entryPointContract.getNonce(params.smartAccountAddress, 0);

  let callData: string;
  const smartAccount = new Contract(params.smartAccountAddress, ARC_SMART_ACCOUNT_ABI, provider); // Keep smartAccount for gas estimation

  if (params.transactions && params.transactions.length > 0) {
    // Batch execution
    const { batchService } = await import('./batchService.ts');
    callData = batchService.encodeBatchData(params.transactions);
  } else if (params.to && params.amount) {
    // Single execution
    const accountInterface = new Interface(ARC_SMART_ACCOUNT_ABI);
    callData = accountInterface.encodeFunctionData('execute', [
      params.to,
      parseUnits(params.amount, 18),
      params.data ?? '0x',
    ]);
  } else {
    throw new Error('Invalid parameters: Provide either transactions array or to/amount');
  }

  const initCode = '0x'; // Account assumed deployedunt.getUserOpNonce();
  const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeSettings(provider);

  let callGasLimit = DEFAULT_VERIFICATION_GAS_LIMIT;
  try {
    // Adjust gas estimation based on execution type
    if (params.transactions && params.transactions.length > 0) {
      // For batch execution, estimate gas for executeBatch
      const { batchService } = await import('./batchService.ts');
      const encodedBatchData = batchService.encodeBatchData(params.transactions);
      const estimate = await smartAccount.estimateGas.executeBatch(encodedBatchData);
      callGasLimit = estimate;
    } else if (params.to && params.amount) {
      // For single execution, estimate gas for execute
      const value = parseUnits(params.amount || '0', 18);
      const estimate = await smartAccount.estimateGas.execute(params.to, value, params.data ?? '0x');
      callGasLimit = estimate;
    }
  } catch (error) {
    console.warn('Failed to estimate userOp call gas limit, using default', error);
  }

  const network = await provider.getNetwork();
  const userOp: UserOperation = {
    sender: params.smartAccountAddress,
    nonce,
    initCode: '0x',
    callData,
    callGasLimit,
    verificationGasLimit: DEFAULT_VERIFICATION_GAS_LIMIT,
    preVerificationGas: DEFAULT_PRE_VERIFICATION_GAS,
    maxFeePerGas,
    maxPriorityFeePerGas,
    paymasterAndData: '0x',
    signature: '0x',
  };

  const userOpHash = getUserOpHash(userOp, ENTRY_POINT, network.chainId);
  const sessionWallet = new Wallet(params.sessionPrivateKey);
  userOp.signature = sessionWallet.signingKey.sign(userOpHash).serialized;

  const payload = {
    jsonrpc: '2.0',
    id: Number(Date.now().toString().slice(-6)),
    method: 'eth_sendUserOperation',
    params: [serializeUserOp(userOp), ENTRY_POINT],
  };

  const bundlerUrl = BUNDLER_URL as string;
  const response = await fetch(bundlerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok || (parsed && parsed.error)) {
    const message =
      parsed?.error?.message ??
      parsed?.error ??
      `Bundler request failed (${response.status}): ${response.statusText}`;
    throw new Error(message);
  }

  return {
    userOpHash: parsed?.result ?? '',
    bundlerResponse: parsed,
  };
}

export const isBundlerConfigured = (): boolean =>
  ENTRY_POINT !== '0x0000000000000000000000000000000000000000' && Boolean(BUNDLER_URL);
