import { logger } from './logger';

export type ScheduledTransactionStatus =
  | 'pending'      // Waiting to execute
  | 'executing'    // Currently executing
  | 'completed'    // Successfully executed
  | 'failed'       // Execution failed
  | 'cancelled';   // Cancelled by user

export interface ScheduledTransaction {
  id: string;
  type: 'SEND' | 'SWAP' | 'BRIDGE';
  params: {
    token: string;
    amount: string;
    recipient?: string;
    fromToken?: string;
    toToken?: string;
    toChain?: string;
  };
  createdAt: number;
  executeAt: number;
  status: ScheduledTransactionStatus;
  txHash?: string;
  error?: string;
  walletAddress: string;
}

export interface ScheduledTransactionCreateParams {
  type: 'SEND' | 'SWAP' | 'BRIDGE';
  params: ScheduledTransaction['params'];
  delayMinutes: number;
  walletAddress: string;
}

const STORAGE_KEY = 'arc_scheduled_transactions';
const CHECK_INTERVAL = 10000; // Check every 10 seconds
const MAX_PENDING_TRANSACTIONS = 10;

class ScheduledTransactionService {
  private transactions: Map<string, ScheduledTransaction> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private executeCallback: ((tx: ScheduledTransaction) => Promise<string>) | null = null;
  private isInitialized = false;

  initialize(executeCallback: (tx: ScheduledTransaction) => Promise<string>): void {
    if (this.isInitialized) return;

    this.executeCallback = executeCallback;
    this.loadFromStorage();
    this.startCheckInterval();
    this.scheduleAllPending();
    this.isInitialized = true;

    logger.info('ScheduledTransactionService initialized', {
      component: 'ScheduledTransactionService',
      pendingCount: this.getPendingTransactions().length,
    });
  }

  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.isInitialized = false;
  }

  create(params: ScheduledTransactionCreateParams): ScheduledTransaction {
    // Check limit
    const pending = this.getPendingTransactions();
    if (pending.length >= MAX_PENDING_TRANSACTIONS) {
      throw new Error(`Maximum ${MAX_PENDING_TRANSACTIONS} pending transactions allowed`);
    }

    const now = Date.now();
    const executeAt = now + (params.delayMinutes * 60 * 1000);

    const tx: ScheduledTransaction = {
      id: `stx_${now}_${Math.random().toString(36).slice(2, 10)}`,
      type: params.type,
      params: params.params,
      createdAt: now,
      executeAt,
      status: 'pending',
      walletAddress: params.walletAddress,
    };

    this.transactions.set(tx.id, tx);
    this.saveToStorage();
    this.scheduleExecution(tx);

    logger.info('Scheduled transaction created', {
      component: 'ScheduledTransactionService',
      txId: tx.id,
      executeAt: new Date(executeAt).toISOString(),
    });

    return tx;
  }

  cancel(txId: string): boolean {
    const tx = this.transactions.get(txId);
    if (!tx) return false;

    if (tx.status !== 'pending') {
      throw new Error(`Cannot cancel transaction with status: ${tx.status}`);
    }

    // Clear timer
    const timer = this.timers.get(txId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(txId);
    }

    tx.status = 'cancelled';
    this.saveToStorage();

    logger.info('Scheduled transaction cancelled', {
      component: 'ScheduledTransactionService',
      txId,
    });

    return true;
  }

  getTransactions(walletAddress?: string): ScheduledTransaction[] {
    const all = Array.from(this.transactions.values());
    if (walletAddress) {
      return all.filter((tx) => tx.walletAddress === walletAddress);
    }
    return all;
  }

  getPendingTransactions(walletAddress?: string): ScheduledTransaction[] {
    return this.getTransactions(walletAddress).filter((tx) => tx.status === 'pending');
  }

  getTransaction(txId: string): ScheduledTransaction | undefined {
    return this.transactions.get(txId);
  }

  cleanup(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    let cleaned = 0;

    this.transactions.forEach((tx, id) => {
      if (tx.status !== 'pending' && tx.createdAt < cutoff) {
        this.transactions.delete(id);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      this.saveToStorage();
      logger.info('Cleaned up old transactions', {
        component: 'ScheduledTransactionService',
        count: cleaned,
      });
    }
  }

  // ============================================
  // Private Methods
  // ============================================

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as ScheduledTransaction[];
        data.forEach((tx) => this.transactions.set(tx.id, tx));

        logger.info('Loaded transactions from storage', {
          component: 'ScheduledTransactionService',
          count: data.length,
        });
      }
    } catch (error) {
      logger.error('Failed to load transactions from storage', {
        component: 'ScheduledTransactionService',
        error: (error as Error).message,
      });
    }
  }

  private saveToStorage(): void {
    try {
      const data = Array.from(this.transactions.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      logger.error('Failed to save transactions to storage', {
        component: 'ScheduledTransactionService',
        error: (error as Error).message,
      });
    }
  }

  private startCheckInterval(): void {
    // Periodic check for missed executions
    this.checkInterval = setInterval(() => {
      this.checkMissedExecutions();
    }, CHECK_INTERVAL);
  }

  private checkMissedExecutions(): void {
    const now = Date.now();
    const pending = this.getPendingTransactions();

    pending.forEach((tx) => {
      // If execution time passed and no timer exists
      if (tx.executeAt <= now && !this.timers.has(tx.id)) {
        logger.info('Found missed execution, executing now', {
          component: 'ScheduledTransactionService',
          txId: tx.id,
        });
        this.executeTransaction(tx);
      }
    });
  }

  private scheduleAllPending(): void {
    const pending = this.getPendingTransactions();
    pending.forEach((tx) => this.scheduleExecution(tx));
  }

  private scheduleExecution(tx: ScheduledTransaction): void {
    const now = Date.now();
    const delay = Math.max(0, tx.executeAt - now);

    // If already past execution time, execute immediately
    if (delay === 0) {
      this.executeTransaction(tx);
      return;
    }

    const timer = setTimeout(() => {
      this.timers.delete(tx.id);
      this.executeTransaction(tx);
    }, delay);

    this.timers.set(tx.id, timer);
  }

  private async executeTransaction(tx: ScheduledTransaction): Promise<void> {
    if (tx.status !== 'pending') return;
    if (!this.executeCallback) {
      logger.error('No execute callback registered', {
        component: 'ScheduledTransactionService',
        txId: tx.id,
      });
      return;
    }

    tx.status = 'executing';
    this.saveToStorage();

    logger.info('Executing scheduled transaction', {
      component: 'ScheduledTransactionService',
      txId: tx.id,
      type: tx.type,
    });

    try {
      const txHash = await this.executeCallback(tx);
      tx.status = 'completed';
      tx.txHash = txHash;

      logger.info('Scheduled transaction completed', {
        component: 'ScheduledTransactionService',
        txId: tx.id,
        txHash,
      });
    } catch (error: any) {
      tx.status = 'failed';
      tx.error = error.message;

      logger.error('Scheduled transaction failed', {
        component: 'ScheduledTransactionService',
        txId: tx.id,
        error: error.message,
      });
    }

    this.saveToStorage();
  }
}

// Export singleton
export const scheduledTransactionService = new ScheduledTransactionService();
