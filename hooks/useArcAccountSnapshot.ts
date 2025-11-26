import { useCallback, useEffect, useMemo, useState } from 'react';
import { arcRpcClient, type AccountSnapshot, type BlockHeader } from '../services/arcRpcClient';
import { formatUSDCAmount } from '../utils/format';

export interface UseArcAccountSnapshotState {
  snapshot: AccountSnapshot | null;
  formattedBalance: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastUpdated: number | null;
}

export function useArcAccountSnapshot(address: string | null | undefined): UseArcAccountSnapshotState {
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadSnapshot = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (address) {
        // Full snapshot with balance
        const data = await arcRpcClient.getAccountSnapshot(address);
        setSnapshot(data);
      } else {
        // No address - just get block info for header display
        const [latestBlock, chainId] = await Promise.all([
          arcRpcClient.getLatestBlock(),
          arcRpcClient.getChainId(),
        ]);
        setSnapshot({
          address: '',
          balanceWei: 0n,
          nonce: 0,
          chainId,
          latestBlock,
          fetchedAt: Date.now(),
        });
      }
    } catch (err) {
      console.error('Failed to load Arc account snapshot', err);
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void loadSnapshot();
    // Always poll for block updates, even without address
    const interval = window.setInterval(loadSnapshot, 15_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [address, loadSnapshot]);

  const formattedBalance = useMemo(() => {
    if (!snapshot) return null;
    return formatUSDCAmount(snapshot.balanceWei).display;
  }, [snapshot]);

  return {
    snapshot,
    formattedBalance,
    isLoading,
    error,
    refresh: loadSnapshot,
    lastUpdated: snapshot?.fetchedAt ?? null,
  };
}
