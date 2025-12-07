/**
 * Passkey Execution Router
 *
 * ALL transactions go through PasskeyAccountManager with WebAuthn/P256 signatures.
 * NO private keys, NO EOA, NO session keys.
 *
 * This is the ONLY way to execute transactions in ArcWallet.
 */

import type { PasskeyAccountManager } from './passkeyAccountManager';

export type ExecutionResult = {
  success: boolean;
  hash: string;
  userOpHash?: string;
};

export interface TransactionParams {
  to: string;
  value: bigint;
  data: string;
}

/**
 * Check if passkey manager is connected (has account address)
 */
function checkConnected(passkeyManager: PasskeyAccountManager): void {
  if (!passkeyManager.getAccountAddress()) {
    throw new Error('PasskeyAccount not connected. Please authenticate first.');
  }
}

/**
 * Execute a single transaction via PasskeyAccount
 * Signs with WebAuthn passkey and submits UserOperation to bundler
 */
export async function executeTransaction(
  passkeyManager: PasskeyAccountManager,
  to: string,
  value: bigint,
  data: string = '0x'
): Promise<ExecutionResult> {
  checkConnected(passkeyManager);

  const result = await passkeyManager.executeTransaction(to, value, data);

  return {
    success: true,
    hash: result.hash,
    userOpHash: result.userOpHash,
  };
}

/**
 * Execute batch transactions via PasskeyAccount
 * All transactions signed with single WebAuthn passkey prompt
 */
export async function executeBatchTransaction(
  passkeyManager: PasskeyAccountManager,
  transactions: TransactionParams[]
): Promise<ExecutionResult> {
  checkConnected(passkeyManager);

  if (transactions.length === 0) {
    throw new Error('No transactions provided');
  }

  if (transactions.length === 1) {
    // Single transaction, use regular execute
    const tx = transactions[0];
    return executeTransaction(passkeyManager, tx.to, tx.value, tx.data);
  }

  const result = await passkeyManager.executeBatchTransaction(transactions);

  return {
    success: true,
    hash: result.hash,
    userOpHash: result.userOpHash,
  };
}

/**
 * Execute native token (ETH/ARC) transfer
 */
export async function executeNativeTransfer(
  passkeyManager: PasskeyAccountManager,
  to: string,
  amountWei: bigint
): Promise<ExecutionResult> {
  return executeTransaction(passkeyManager, to, amountWei, '0x');
}

/**
 * Execute ERC20 token transfer
 */
export async function executeERC20Transfer(
  passkeyManager: PasskeyAccountManager,
  tokenAddress: string,
  to: string,
  amount: bigint
): Promise<ExecutionResult> {
  const { Interface } = await import('ethers');

  const erc20Interface = new Interface([
    'function transfer(address to, uint256 amount) returns (bool)',
  ]);

  const data = erc20Interface.encodeFunctionData('transfer', [to, amount]);

  return executeTransaction(passkeyManager, tokenAddress, 0n, data);
}

/**
 * Execute ERC20 approve
 */
export async function executeERC20Approve(
  passkeyManager: PasskeyAccountManager,
  tokenAddress: string,
  spender: string,
  amount: bigint
): Promise<ExecutionResult> {
  const { Interface } = await import('ethers');

  const erc20Interface = new Interface([
    'function approve(address spender, uint256 amount) returns (bool)',
  ]);

  const data = erc20Interface.encodeFunctionData('approve', [spender, amount]);

  return executeTransaction(passkeyManager, tokenAddress, 0n, data);
}

/**
 * Execute approve + transfer in single batch (1 passkey signature)
 */
export async function executeApproveAndTransfer(
  passkeyManager: PasskeyAccountManager,
  tokenAddress: string,
  spender: string,
  approveAmount: bigint,
  to: string,
  transferAmount: bigint
): Promise<ExecutionResult> {
  const { Interface } = await import('ethers');

  const erc20Interface = new Interface([
    'function approve(address spender, uint256 amount) returns (bool)',
    'function transfer(address to, uint256 amount) returns (bool)',
  ]);

  const approveData = erc20Interface.encodeFunctionData('approve', [spender, approveAmount]);
  const transferData = erc20Interface.encodeFunctionData('transfer', [to, transferAmount]);

  return executeBatchTransaction(passkeyManager, [
    { to: tokenAddress, value: 0n, data: approveData },
    { to: tokenAddress, value: 0n, data: transferData },
  ]);
}

/**
 * Execute arbitrary contract call
 */
export async function executeContractCall(
  passkeyManager: PasskeyAccountManager,
  contractAddress: string,
  abi: string[],
  functionName: string,
  args: unknown[],
  value: bigint = 0n
): Promise<ExecutionResult> {
  const { Interface } = await import('ethers');

  const contractInterface = new Interface(abi);
  const data = contractInterface.encodeFunctionData(functionName, args);

  return executeTransaction(passkeyManager, contractAddress, value, data);
}

/**
 * Get account address (no signature needed)
 */
export function getAccountAddress(passkeyManager: PasskeyAccountManager): string | null {
  return passkeyManager.getAccountAddress();
}

/**
 * Check if account is connected
 */
export function isConnected(passkeyManager: PasskeyAccountManager): boolean {
  return passkeyManager.getAccountAddress() !== null;
}

/**
 * Check if account is deployed on-chain
 */
export async function isAccountDeployed(passkeyManager: PasskeyAccountManager): Promise<boolean> {
  return passkeyManager.isAccountDeployed();
}
