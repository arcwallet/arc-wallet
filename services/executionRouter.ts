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
  return module.sendSmartAccountExecute(params);
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
