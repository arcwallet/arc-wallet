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
import { RPC_URL } from '../services/rpcProvider';
import { fetchRecentTransactions, RateLimitError } from '../services/activityService';
import { useCircleWallet } from './CircleWalletContext';
import { API_ENDPOINTS } from '../config/app.config';

interface ActivityContextValue {
  activities: Transaction[];
  addActivity: (activity: Transaction) => void;
  clear: () => void;
}

const STORAGE_KEY_PREFIX = 'arcwallet:activity-log:';

const getStorageKey = (address: string | null): string => {
  if (!address) return `${STORAGE_KEY_PREFIX}anonymous`;
  return `${STORAGE_KEY_PREFIX}${address.toLowerCase()}`;
};

const ActivityContext = createContext<ActivityContextValue | undefined>(undefined);

const providerCache: { current?: JsonRpcProvider } = {};

function getProvider(): JsonRpcProvider {
  if (!providerCache.current) {
    providerCache.current = new JsonRpcProvider(RPC_URL);
  }
  return providerCache.current;
}

// Helper function to send notification
async function sendActivityNotification(userId: string, activity: Transaction) {
  try {
    const notificationBody = getNotificationMessage(activity);
    if (!notificationBody) return; // Skip if no notification needed

    await fetch(API_ENDPOINTS.notifications.test(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        title: notificationBody.title,
        body: notificationBody.body,
        icon: '/icon-192x192.png'
      })
    });
  } catch (error) {
    console.warn('Failed to send activity notification:', error);
    // Don't throw - notifications are non-critical
  }
}

function getNotificationMessage(activity: Transaction): { title: string; body: string } | null {
  const amount = Math.abs(activity.amount).toFixed(4);
  const currency = activity.currency;

  switch (activity.type) {
    case TransactionType.Received:
      return {
        title: '💰 Funds Received',
        body: `You received ${amount} ${currency}`
      };
    case TransactionType.Sent:
      if (activity.status === TransactionStatus.Completed) {
        return {
          title: '✅ Transfer Completed',
          body: `Sent ${amount} ${currency} successfully`
        };
      } else if (activity.status === TransactionStatus.Failed) {
        return {
          title: '❌ Transfer Failed',
          body: `Failed to send ${amount} ${currency}`
        };
      }
      break;
    case TransactionType.Swap:
      if (activity.status === TransactionStatus.Completed) {
        return {
          title: '🔄 Swap Completed',
          body: `Swapped ${amount} ${currency} successfully`
        };
      } else if (activity.status === TransactionStatus.Failed) {
        return {
          title: '❌ Swap Failed',
          body: `Failed to swap ${amount} ${currency}`
        };
      }
      break;
    case TransactionType.Bridge:
      if (activity.status === TransactionStatus.Completed) {
        return {
          title: '🌉 Bridge Completed',
          body: `Bridged ${amount} ${currency} successfully`
        };
      } else if (activity.status === TransactionStatus.Failed) {
        return {
          title: '❌ Bridge Failed',
          body: `Failed to bridge ${amount} ${currency}`
        };
      }
      break;
  }
  return null;
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

const loadActivitiesFromStorage = (address: string | null): Transaction[] => {
  if (typeof window === 'undefined') return [];

  const key = getStorageKey(address);
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as StoredTransaction[];
    return deserialise(parsed);
  } catch (error) {
    console.warn('Failed to parse stored activity log', error);
    window.localStorage.removeItem(key);
    return [];
  }
};

const saveActivitiesToStorage = (address: string | null, activities: Transaction[]): void => {
  if (typeof window === 'undefined') return;

  const key = getStorageKey(address);
  try {
    window.localStorage.setItem(key, JSON.stringify(serialise(activities)));
  } catch (error) {
    console.warn('Failed to persist activity log', error);
  }
};

export const ActivityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { address } = useCircleWallet();
  const [activities, setActivities] = useState<Transaction[]>([]);
  const pendingRef = useRef(new Set<string>());
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const cooldownRef = useRef<number | null>(null);
  const prevAddressRef = useRef<string | null>(null);

  useEffect(() => {
    cooldownRef.current = cooldownUntil;
  }, [cooldownUntil]);

  // Load activities from localStorage when address changes
  useEffect(() => {
    // Load from storage for this address
    const storedActivities = loadActivitiesFromStorage(address);
    setActivities(storedActivities);
    pendingRef.current = new Set(
      storedActivities
        .filter((tx) => tx.status === TransactionStatus.Pending)
        .map((tx) => tx.hash)
    );
    prevAddressRef.current = address;
  }, [address]);

  // Save to localStorage whenever activities change
  useEffect(() => {
    if (prevAddressRef.current !== null || address !== null) {
      saveActivitiesToStorage(address, activities);
    }
  }, [activities, address]);

  // Fetch activities from blockchain API
  useEffect(() => {
    if (!address) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      console.log('🔄 [Activity] Starting fetch for address:', address?.slice(0, 10) + '...');

      if (cooldownRef.current && Date.now() < cooldownRef.current) {
        console.log('⏸️ [Activity] Still in cooldown, skipping');
        return;
      }
      try {
        const history = await fetchRecentTransactions(address, {
          maxTransactions: 100,
          maxBlocks: 50000,
        });

        console.log('✅ [Activity] Fetched', history.length, 'transactions');

        if (cancelled) return;

        setActivities((current) => {
          const historyMap = new Map(history.map((tx) => [tx.id, tx]));
          const pending = current.filter((tx) =>
            tx.status === TransactionStatus.Pending && !historyMap.has(tx.id),
          );
          const merged = [...history, ...pending];
          merged.sort((a, b) => b.date.getTime() - a.date.getTime());
          pendingRef.current = new Set(merged.filter((tx) => tx.status === TransactionStatus.Pending).map((tx) => tx.hash));
          console.log('📊 [Activity] Total activities after merge:', merged.length);
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
  }, [address]);

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

      setActivities((current) => {
        const updated = current.map((tx) => {
          const update = updates.find((u) => u.hash === tx.hash);
          if (!update) {
            return tx;
          }
          const updatedTx = {
            ...tx,
            status: update.status,
            date: update.date ?? tx.date,
            networkFee:
              typeof update.fee === 'number' ? update.fee : tx.networkFee ?? undefined,
          };

          // Send notification when status changes to completed or failed
          if (tx.status === TransactionStatus.Pending && update.status !== TransactionStatus.Pending) {
            if (address) {
              void sendActivityNotification(address, updatedTx);
            }
          }

          return updatedTx;
        });
        return updated;
      });

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

      // Send notification for new activity
      if (address) {
        void sendActivityNotification(address, activity);
      }
    },
    [setActivities, address],
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
