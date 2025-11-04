const DEFAULT_RPC_URL = import.meta.env.VITE_ARC_RPC_URL ?? 'https://capable-tame-glitter.arc-testnet.quiknode.pro/96002201d9f8c9d93fcb9ec6bfdb069d3e8f3ef0';

type JsonRpcSuccess<T> = {
  jsonrpc: '2.0';
  id: number;
  result: T;
};

type JsonRpcError = {
  jsonrpc: '2.0';
  id: number;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
};

type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcError;

export interface BlockHeader {
  number: number;
  hash: string;
  timestamp: number;
  finalized: boolean;
}

export interface AccountSnapshot {
  address: string;
  balanceWei: bigint;
  nonce: number;
  chainId: number;
  latestBlock: BlockHeader;
  fetchedAt: number;
}

class ArcRpcClient {
  private rpcUrl: string;
  private requestId = 0;

  constructor(rpcUrl = DEFAULT_RPC_URL) {
    this.rpcUrl = rpcUrl;
  }

  setRpcUrl(url: string) {
    this.rpcUrl = url;
  }

  private async call<T>(method: string, params: unknown[]): Promise<T> {
    const body = {
      jsonrpc: '2.0' as const,
      id: ++this.requestId,
      method,
      params,
    };

    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`RPC request failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as JsonRpcResponse<T>;
    if ('error' in payload) {
      throw new Error(`RPC error ${payload.error.code}: ${payload.error.message}`);
    }

    return payload.result;
  }

  async getChainId(): Promise<number> {
    const result = await this.call<string>('eth_chainId', []);
    return Number.parseInt(result, 16);
  }

  async getBalance(address: string, block: 'latest' | 'finalized' = 'finalized'): Promise<bigint> {
    try {
      const balanceHex = await this.call<string>('eth_getBalance', [address, block]);
      return BigInt(balanceHex);
    } catch (error) {
      if (block === 'finalized') {
        return this.getBalance(address, 'latest');
      }
      throw error instanceof Error ? error : new Error('Failed to fetch balance');
    }
  }

  async getNonce(address: string, block: 'latest' | 'finalized' = 'finalized'): Promise<number> {
    try {
      const nonceHex = await this.call<string>('eth_getTransactionCount', [address, block]);
      return Number.parseInt(nonceHex, 16);
    } catch (error) {
      if (block === 'finalized') {
        return this.getNonce(address, 'latest');
      }
      throw error instanceof Error ? error : new Error('Failed to fetch nonce');
    }
  }

  async getLatestBlock(): Promise<BlockHeader> {
    try {
      const rawBlock = await this.call<any>('eth_getBlockByNumber', ['finalized', false]);
      if (!rawBlock) {
        throw new Error('Unable to fetch latest block');
      }
      return {
        number: Number.parseInt(rawBlock.number, 16),
        hash: rawBlock.hash,
        timestamp: Number.parseInt(rawBlock.timestamp, 16),
        finalized: true,
      };
    } catch (error) {
      const rawBlock = await this.call<any>('eth_getBlockByNumber', ['latest', false]);
      if (!rawBlock) {
        throw new Error('Unable to fetch latest block');
      }
      return {
        number: Number.parseInt(rawBlock.number, 16),
        hash: rawBlock.hash,
        timestamp: Number.parseInt(rawBlock.timestamp, 16),
        finalized: false,
      };
    }
  }

  async getAccountSnapshot(address: string): Promise<AccountSnapshot> {
    const [chainId, latestBlock, balanceWei, nonce] = await Promise.all([
      this.getChainId(),
      this.getLatestBlock(),
      this.getBalance(address),
      this.getNonce(address),
    ]);

    return {
      address,
      balanceWei,
      nonce,
      chainId,
      latestBlock,
      fetchedAt: Date.now(),
    };
  }
}

export const arcRpcClient = new ArcRpcClient();
