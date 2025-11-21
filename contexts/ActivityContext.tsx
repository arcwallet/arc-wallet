import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { JsonRpcProvider, formatUnits } from 'ethers';
import type { Transaction } from '../types';
import { TransactionStatus, TransactionType } from '../types';
import { RPC_URL } from '../services/transactionService';
import { fetchRecentTransactions, RateLimitError } from '../services/activityService';
import { useWallet } from './WalletContext';

interface ActivityContextValue {
  activities: Transaction[];
  addActivity: (activity: Transaction) => void;
  clear: () => void;
}

const STORAGE_KEY = 'arcwallet:activity-log';

const ActivityContext = createContext<ActivityContextValue | undefined>(undefined);

const providerCache: { current?: JsonRpcProvider } = {};

function getProvider(): JsonRpcProvider {
  if (!providerCache.current) {
    providerCache.current = new JsonRpcProvider(RPC_URL);
  }
  return providerCache.current;
}

type StoredTransaction = Omit<Transaction, 'date'> & { date: string };

const serialise = (activities: Transaction[]): StoredTransaction[] =>
  activities.map((tx) => ({
    ...tx,
    date: tx.date.toISOString(),
  }));

const deserialise = (data: StoredTransaction[]): Transaction[] =>
  data.map((tx) => ({
    ...tx,
    date: new Date(tx.date),
  }));

const usePersistedActivities = (): [Transaction[], React.Dispatch<React.SetStateAction<Transaction[]>>] => {
  const [activities, setActivities] = useState<Transaction[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as StoredTransaction[];
      return deserialise(parsed);
    } catch (error) {
      console.warn('Failed to parse stored activity log', error);
      window.localStorage.removeItem(STORAGE_KEY);
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialise(activities)));
    } catch (error) {
      console.warn('Failed to persist activity log', error);
    }
  }, [activities]);

  return [activities, setActivities];
};

export const ActivityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { address } = useWallet();
  const [activities, setActivities] = usePersistedActivities();
  const pendingRef = useRef(new Set<string>());
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const cooldownRef = useRef<number | null>(null);

  useEffect(() => {
    cooldownRef.current = cooldownUntil;
  }, [cooldownUntil]);

  useEffect(() => {
    if (!address) {
      setActivities([]);
      pendingRef.current.clear();
      return;
    }

    let cancelled = false;

    const load = async () => {
      if (cooldownRef.current && Date.now() < cooldownRef.current) {
        return;
      }
      try {
        const history = await fetchRecentTransactions(address, {
          maxTransactions: 50,
          maxBlocks: 500,
        });

        if (cancelled) return;

        setActivities((current) => {
          const historyMap = new Map(history.map((tx) => [tx.id, tx]));
          const pending = current.filter((tx) =>
            tx.status === TransactionStatus.Pending && !historyMap.has(tx.id),
          );
          const merged = [...history, ...pending];
          merged.sort((a, b) => b.date.getTime() - a.date.getTime());
          pendingRef.current = new Set(merged.filter((tx) => tx.status === TransactionStatus.Pending).map((tx) => tx.hash));
          return merged;
        });
      } catch (error) {
        console.error('❌ [Activity] Failed to load activities:', error);
        if (error instanceof RateLimitError) {
          const until = Date.now() + 60_000;
          cooldownRef.current = until;
          setCooldownUntil(until);
          console.warn('⏸️ [Activity] Rate limited, cooling down for 60s');
        }
      }
    };

    void load();

    const interval = window.setInterval(load, 180_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [address, setActivities]);

  useEffect(() => {
    // Filter pending transactions but exclude bridge transactions (they're cross-chain)
    const pending = activities.filter((tx) =>
      tx.status === TransactionStatus.Pending &&
      tx.hash &&
      tx.type !== TransactionType.Bridge // Don't poll bridge transactions - they're on different chains
    );
    pendingRef.current = new Set(pending.map((tx) => tx.hash));
  }, [activities]);

  useEffect(() => {
    if (pendingRef.current.size === 0) {
      return;
    }
    let cancelled = false;
    const provider = getProvider();

    const poll = async () => {
      const pendingHashes = Array.from(pendingRef.current.values());
      if (pendingHashes.length === 0) {
        return;
      }

      const updates: Array<{ hash: string; status: TransactionStatus; date?: Date; fee?: number }> = [];

      await Promise.all(
        pendingHashes.map(async (hash: string) => {
          try {
            const receipt = await provider.getTransactionReceipt(hash);
            if (!receipt) {
              return;
            }
            const block = await provider.getBlock(receipt.blockNumber);
            const status =
              receipt.status === 0 ? TransactionStatus.Failed : TransactionStatus.Completed;
            const fee =
              receipt.gasUsed && receipt.gasPrice
                ? parseFloat(
                  formatUnits(receipt.gasUsed * receipt.gasPrice, 18),
                )
                : undefined;
            updates.push({
              hash,
              status,
              date: block ? new Date(block.timestamp * 1000) : new Date(),
              fee,
            });
          } catch (error) {
            console.warn('Failed to refresh transaction status', hash, error);
          }
        }),
      );

      if (updates.length === 0) {
        return;
      }

      if (cancelled) {
        return;
      }

      setActivities((current) =>
        current.map((tx) => {
          const update = updates.find((u) => u.hash === tx.hash);
          if (!update) {
            return tx;
          }
          return {
            ...tx,
            status: update.status,
            date: update.date ?? tx.date,
            networkFee:
              typeof update.fee === 'number' ? update.fee : tx.networkFee ?? undefined,
          };
        }),
      );

      updates.forEach((update) => {
        pendingRef.current.delete(update.hash);
      });
    };

    const interval = window.setInterval(poll, 10_000);
    void poll();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []); // Empty deps - setActivities is stable, pendingRef is a ref


  const addActivity = useCallback(
    (activity: Transaction) => {
      setActivities((current) => {
        const filtered = current.filter((tx) => tx.id !== activity.id);
        const updated = [activity, ...filtered];
        updated.sort((a, b) => b.date.getTime() - a.date.getTime());
        return updated;
      });
      if (activity.status === TransactionStatus.Pending && activity.hash) {
        pendingRef.current.add(activity.hash);
      }
    },
    [setActivities],
  );

  const clear = useCallback(() => {
    setActivities([]);
    pendingRef.current.clear();
  }, [setActivities]);

  const value = useMemo<ActivityContextValue>(
    () => ({
      activities,
      addActivity,
      clear,
    }),
    [activities, addActivity, clear],
  );

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
};

export const useActivity = (): ActivityContextValue => {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error('useActivity must be used within an ActivityProvider');
  }
  return context;
};
