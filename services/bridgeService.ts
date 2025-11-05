import { BridgeKit, Blockchain } from '@circle-fin/bridge-kit';
import { createAdapterFromPrivateKey } from '@circle-fin/adapter-viem-v2';
import { getArcRpcUrl, getSepoliaRpcUrl } from '../config/rpc';
// Amount should be provided as a human-readable decimal string to BridgeKit

const DEBUG = import.meta.env.VITE_BRIDGE_DEBUG === 'true';

export type BridgeDirection = 'arc-to-sepolia' | 'sepolia-to-arc';

export type BridgeProgressStep =
  | { type: 'idle' }
  | { type: 'switch-network' }
  | { type: 'approve'; txHash?: string }
  | { type: 'burn'; txHash?: string }
  | { type: 'mint'; txHash?: string }
  | { type: 'fetch-attestation' }
  | { type: 'completed'; sourceTxHash?: string; receiveTxHash?: string };

export interface BridgeParams {
  privateKey: string;
  amount: string; // human-readable decimal string
  direction: BridgeDirection;
  onProgress?: (step: BridgeProgressStep) => void;
}

export interface BridgeExecutionResult {
  sourceTxHash?: string;
  receiveTxHash?: string;
  raw: unknown;
}

const getChainConfig = (direction: BridgeDirection) => {
  const arcRpcUrl = getArcRpcUrl();
  const sepoliaRpcUrl = getSepoliaRpcUrl();

  if (direction === 'arc-to-sepolia') {
    return {
      fromChain: Blockchain.Arc_Testnet,
      toChain: Blockchain.Ethereum_Sepolia,
      fromRpcUrl: arcRpcUrl,
      toRpcUrl: sepoliaRpcUrl,
    };
  } else {
    return {
      fromChain: Blockchain.Ethereum_Sepolia,
      toChain: Blockchain.Arc_Testnet,
      fromRpcUrl: sepoliaRpcUrl,
      toRpcUrl: arcRpcUrl,
    };
  }
};

export async function bridgeUsdcWithSessionKey({
  privateKey,
  amount,
  direction,
  onProgress,
}: BridgeParams): Promise<BridgeExecutionResult> {
  // Keep chain config in outer scope so catch can reference it for error messages
  let fromRpcUrl: string | undefined;
  let toRpcUrl: string | undefined;
  try {
    if (DEBUG) console.log('🌉 Bridge operation starting:', { direction, amount });

    const kit = new BridgeKit();
    const cfg = getChainConfig(direction);
    const { fromChain, toChain } = cfg;
    fromRpcUrl = cfg.fromRpcUrl;
    toRpcUrl = cfg.toRpcUrl;

    // Create dedicated adapters per chain with explicit RPC URLs
    const adapterFrom = await createAdapterFromPrivateKey({ privateKey, rpcUrl: fromRpcUrl });
    const adapterTo = await createAdapterFromPrivateKey({ privateKey, rpcUrl: toRpcUrl });

    if (DEBUG) {
      console.log('🔗 Chain configuration:', { fromChain, toChain, fromRpcUrl, toRpcUrl });
      console.log('📡 Adapters created');
    }

    const normalizedAmount = Number((amount ?? '').toString());
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new Error('Amount must be a positive number.');
    }
    // BridgeKit expects a decimal string (human units), not atomic units
    const amountString = normalizedAmount.toFixed(2);

    if (DEBUG) console.log('💰 Amount parsed:', { normalizedAmount, atomicAmount: amountString });

    const handler = (payload: { method: string; values?: Record<string, unknown> }) => {
      const method = payload.method;
      const txHash = typeof payload.values?.txHash === 'string' ? (payload.values!.txHash as string) : undefined;

      if (DEBUG) console.log('🔄 Bridge event:', { method, txHash });

      switch (method) {
        case 'approve':
          onProgress?.({ type: 'approve', txHash });
          break;
        case 'burn':
          onProgress?.({ type: 'burn', txHash });
          break;
        case 'mint':
          onProgress?.({ type: 'mint', txHash });
          break;
        case 'fetchAttestation':
          onProgress?.({ type: 'fetch-attestation' });
          break;
        case 'switchChain':
          onProgress?.({ type: 'switch-network' });
          break;
        default:
          if (DEBUG) console.log('❓ Unknown bridge event:', method);
          break;
      }
    };

    kit.on('*', handler);

    try {
      if (DEBUG) console.log('🚀 Making bridge call...');

      const result = await kit.bridge({
        from: {
          adapter: adapterFrom,
          chain: fromChain,
        },
        to: {
          adapter: adapterTo,
          chain: toChain,
        },
        amount: amountString,
      });

      if (DEBUG) console.log('✅ Bridge completed:', result);

      const { sourceTxHash, receiveTxHash } = extractTransactionHashes(result);
      onProgress?.({ type: 'completed', sourceTxHash, receiveTxHash });
      return { sourceTxHash, receiveTxHash, raw: result };
    } finally {
      kit.off('*', handler);
    }
  } catch (error: any) {
    if (DEBUG) console.error('❌ Bridge error:', error);

    // Enhanced error handling
    if (error?.message?.includes('network') || error?.message?.includes('RPC')) {
      throw new Error(`Network connection error: ${fromRpcUrl || 'from-RPC'} or ${toRpcUrl || 'to-RPC'} may be unreachable. Please check RPC endpoints.`);
    } else if (error?.message?.includes('insufficient')) {
      throw new Error('Insufficient USDC balance. Please ensure you have enough USDC in your account.');
    } else if (error?.message?.includes('allowance')) {
      throw new Error('Insufficient USDC allowance. Please increase USDC spending approval for the bridge contract.');
    } else if (error?.message?.includes('unsupported')) {
      throw new Error('Unsupported chain combination. Please check Arc - Sepolia bridge.');
    } else if (error?.code === 'CALL_EXCEPTION') {
      throw new Error('Smart contract call failed. Please check gas fee or contract address.');
    }

    throw new Error(`Bridge operation failed: ${error?.message || 'Unknown error'}`);
  }
}

function extractTransactionHashes(result: unknown): { sourceTxHash?: string; receiveTxHash?: string } {
  const steps = (result as any)?.steps;
  if (!Array.isArray(steps)) {
    return { sourceTxHash: (result as any)?.sourceTxHash, receiveTxHash: (result as any)?.receiveTxHash };
  }

  let sourceTxHash: string | undefined;
  let receiveTxHash: string | undefined;

  for (const step of steps) {
    if (!step || typeof step !== 'object') {
      continue;
    }
    const name = step.name as string | undefined;
    const txHash = step.txHash as string | undefined;
    if (!name) continue;
    if (name === 'burn' && txHash) {
      sourceTxHash = txHash;
    } else if (name === 'mint' && txHash) {
      receiveTxHash = txHash;
    } else if (name === 'approve' && txHash && !sourceTxHash) {
      sourceTxHash = txHash;
    }
  }

  return { sourceTxHash, receiveTxHash };
}
