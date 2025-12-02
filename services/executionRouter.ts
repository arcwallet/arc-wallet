export type ExecutionResult =
  | { kind: 'transaction'; hash: string }
  | { kind: 'userOp'; hash: string };

type BundlerExecutor = (params: {
  sessionPrivateKey: string;
  smartAccountAddress: string;
  to: string;
  amount: string;
  data?: string;
  transactions?: {
    to: string;
    value: bigint;
    data: string;
  }[];
}) => Promise<{ userOpHash: string }>;

type DirectExecutor = (params: {
  sessionPrivateKey: string;
  smartAccountAddress: string;
  to: string;
  amount: string;
  data?: string;
  transactions?: {
    to: string;
    value: bigint;
    data: string;
  }[];
}) => Promise<string>;

type BundlerAvailability = () => Promise<boolean> | boolean;

const defaultBundlerExecutor: BundlerExecutor = async (params) => {
  const module = await import('./userOperationService.ts');
  return module.sendSmartAccountUserOperation(params);
};

const defaultDirectExecutor: DirectExecutor = async (params) => {
  const module = await import('./transactionService.ts');
  if (params.transactions && params.transactions.length > 0) {
    return module.sendSmartAccountBatchExecute({
      sessionPrivateKey: params.sessionPrivateKey,
      smartAccountAddress: params.smartAccountAddress,
      transactions: params.transactions
    });
  }
  return module.sendSmartAccountExecute({
    sessionPrivateKey: params.sessionPrivateKey,
    smartAccountAddress: params.smartAccountAddress,
    to: params.to,
    amount: params.amount,
    data: params.data
  });
};

const defaultBundlerAvailability: BundlerAvailability = async () => {
  const module = await import('./userOperationService.ts');
  return module.isBundlerConfigured();
};

export async function executeSmartAccountTransferWithFallback(params: {
  sessionPrivateKey: string;
  smartAccountAddress: string;
  to: string;
  amount: string;
  data?: string;
  transactions?: {
    to: string;
    value: bigint;
    data: string;
  }[];
  forceBundler?: boolean;
  bundlerExecutor?: BundlerExecutor;
  directExecutor?: DirectExecutor;
  bundlerAvailability?: BundlerAvailability;
}): Promise<ExecutionResult> {
  const {
    sessionPrivateKey,
    smartAccountAddress,
    to,
    amount,
    data,
    transactions,
    forceBundler,
    bundlerExecutor = defaultBundlerExecutor,
    directExecutor = defaultDirectExecutor,
    bundlerAvailability = defaultBundlerAvailability,
  } = params;

  const bundlerEnabled =
    typeof forceBundler === 'boolean' ? forceBundler : await bundlerAvailability();

  if (bundlerEnabled) {
    try {
      const { userOpHash } = await bundlerExecutor({
        sessionPrivateKey,
        smartAccountAddress,
        to,
        amount,
        data,
        transactions,
      });
      return { kind: 'userOp', hash: userOpHash };
    } catch (error) {
      console.warn('Bundler submission failed, falling back to direct execute', error);
    }
  }

  const txHash = await directExecutor({
    sessionPrivateKey,
    smartAccountAddress,
    to,
    amount,
    data,
    transactions, // Pass transactions parameter
  });
  return { kind: 'transaction', hash: txHash };
}

export async function executeNativeTransfer(params: {
  sessionPrivateKey: string;
  to: string;
  amount: string;
}): Promise<ExecutionResult> {
  const module = await import('./transactionService.ts');
  const hash = await module.sendNativeTransfer(params);
  return { kind: 'transaction', hash };
}

/**
 * Execute ERC20 token transfer from EOA wallet (not Smart Account)
 */
export async function executeERC20Transfer(params: {
  privateKey: string;
  tokenAddress: string;
  to: string;
  amount: string;
  decimals: number;
}): Promise<ExecutionResult> {
  const module = await import('./transactionService.ts');
  const hash = await module.sendERC20Transfer(params);
  return { kind: 'transaction', hash };
}

// ============================================================================
// ERC-4337 Smart Account Execution (Phase 2)
// ============================================================================

/**
 * Execute transfer via ERC-4337 Smart Account
 * Uses Arc's own bundler for UserOperation submission
 */
export async function executeViaSmartAccount(params: {
  privateKey: string;
  to: string;
  amount: string;
  data?: string;
  sponsored?: boolean;
}): Promise<ExecutionResult> {
  const { Wallet } = await import('ethers');
  const { erc4337Service } = await import('./erc4337Service');
  const { RPC_URL } = await import('../config/app.config');
  const { JsonRpcProvider } = await import('ethers');

  const provider = new JsonRpcProvider(RPC_URL);
  const signer = new Wallet(params.privateKey, provider);

  const result = await erc4337Service.executeTransaction(
    signer,
    params.to,
    params.amount,
    params.data || '0x',
    params.sponsored ?? true
  );

  return {
    kind: 'userOp',
    hash: result.txHash || result.userOpHash,
  };
}

/**
 * Execute batch transactions via ERC-4337 Smart Account
 */
export async function executeBatchViaSmartAccount(params: {
  privateKey: string;
  transactions: { to: string; value?: string; data?: string }[];
  sponsored?: boolean;
}): Promise<ExecutionResult> {
  const { Wallet } = await import('ethers');
  const { erc4337Service } = await import('./erc4337Service');
  const { RPC_URL } = await import('../config/app.config');
  const { JsonRpcProvider } = await import('ethers');

  const provider = new JsonRpcProvider(RPC_URL);
  const signer = new Wallet(params.privateKey, provider);

  const result = await erc4337Service.executeBatch(
    signer,
    params.transactions,
    params.sponsored ?? true
  );

  return {
    kind: 'userOp',
    hash: result.txHash || result.userOpHash,
  };
}

/**
 * Check if ERC-4337 bundler is available
 */
export async function isERC4337Available(): Promise<boolean> {
  const { erc4337Service } = await import('./erc4337Service');
  return erc4337Service.isAvailable();
}

/**
 * Get Smart Account address for an EOA owner
 */
export async function getSmartAccountAddress(ownerAddress: string): Promise<string> {
  const { erc4337Service } = await import('./erc4337Service');
  return erc4337Service.getSmartAccountAddress(ownerAddress);
}

/**
 * Get Smart Account info
 */
export async function getSmartAccountInfo(ownerAddress: string): Promise<{
  address: string;
  owner: string;
  isDeployed: boolean;
  balance: string;
  balanceFormatted: string;
}> {
  const { erc4337Service } = await import('./erc4337Service');
  return erc4337Service.getAccountInfo(ownerAddress);
}
