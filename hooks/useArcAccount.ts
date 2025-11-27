/**
 * useArcAccount Hook
 * Manages ArcAccount smart wallet with multi-key support
 */

import { useState, useCallback, useMemo } from 'react';
import { ethers, Contract, keccak256, AbiCoder, solidityPackedKeccak256 } from 'ethers';
import {
  ARC_TESTNET_CONTRACTS,
  ARC_ACCOUNT_FACTORY_ABI,
  ARC_ACCOUNT_ABI,
  KEY_TYPE,
  getContractAddresses,
} from '../config/contracts';

const abiCoder = new AbiCoder();

export interface SigningKey {
  keyHash: string;
  keyType: number;
  isActive: boolean;
  addedAt: number;
  deviceName: string;
}

export interface ArcAccountState {
  address: string | null;
  isDeployed: boolean;
  signingKeys: SigningKey[];
  activeKeyCount: number;
}

interface UseArcAccountReturn {
  state: ArcAccountState;
  loading: boolean;
  error: string | null;

  // Account Management
  getAccountAddress: (keyHash: string, keyType: number, deviceName: string, salt?: bigint) => Promise<string>;
  createAccount: (keyHash: string, keyType: number, deviceName: string, salt?: bigint) => Promise<string>;
  loadAccount: (accountAddress: string) => Promise<void>;

  // Key Management
  addSigningKey: (keyHash: string, keyType: number, deviceName: string) => Promise<void>;
  removeSigningKey: (keyHash: string) => Promise<void>;
  getSigningKeys: () => Promise<SigningKey[]>;

  // Execution
  execute: (target: string, value: bigint, data: string) => Promise<string>;
  executeBatch: (targets: string[], values: bigint[], datas: string[]) => Promise<string>;

  // Utilities
  computeKeyHash: (publicKeyOrAddress: string) => string;
  computeWebAuthnKeyHash: (x: bigint, y: bigint) => string;
}

export function useArcAccount(
  provider: ethers.Provider | null,
  signer: ethers.Signer | null,
  chainId: number = 5042002
): UseArcAccountReturn {
  const [state, setState] = useState<ArcAccountState>({
    address: null,
    isDeployed: false,
    signingKeys: [],
    activeKeyCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get contract addresses for current chain
  const contracts = useMemo(() => {
    try {
      return getContractAddresses(chainId);
    } catch {
      return ARC_TESTNET_CONTRACTS;
    }
  }, [chainId]);

  // Factory contract instance
  const factoryContract = useMemo(() => {
    if (!provider) return null;
    return new Contract(
      contracts.arcAccountFactory,
      ARC_ACCOUNT_FACTORY_ABI,
      provider
    );
  }, [provider, contracts]);

  // Get account contract instance
  const getAccountContract = useCallback((address: string) => {
    if (!provider) return null;
    return new Contract(address, ARC_ACCOUNT_ABI, signer || provider);
  }, [provider, signer]);

  // Compute key hash for ECDSA key (address)
  const computeKeyHash = useCallback((publicKeyOrAddress: string): string => {
    if (publicKeyOrAddress.startsWith('0x') && publicKeyOrAddress.length === 42) {
      // It's an address
      return keccak256(abiCoder.encode(['address'], [publicKeyOrAddress]));
    }
    // It's a public key
    return keccak256(publicKeyOrAddress);
  }, []);

  // Compute key hash for WebAuthn key (P256 coordinates)
  const computeWebAuthnKeyHash = useCallback((x: bigint, y: bigint): string => {
    return solidityPackedKeccak256(['uint256', 'uint256'], [x, y]);
  }, []);

  // Get counterfactual account address
  const getAccountAddress = useCallback(async (
    keyHash: string,
    keyType: number,
    deviceName: string,
    salt: bigint = 0n
  ): Promise<string> => {
    if (!factoryContract) throw new Error('Provider not connected');

    const address = await (factoryContract as any).getAddress(keyHash, keyType, deviceName, salt);
    return address;
  }, [factoryContract]);

  // Create new account
  const createAccount = useCallback(async (
    keyHash: string,
    keyType: number,
    deviceName: string,
    salt: bigint = 0n
  ): Promise<string> => {
    if (!factoryContract || !signer) throw new Error('Signer not connected');

    setLoading(true);
    setError(null);

    try {
      const factoryWithSigner = factoryContract.connect(signer) as Contract;
      const tx = await factoryWithSigner.createAccount(keyHash, keyType, deviceName, salt);
      await tx.wait();

      const address = await (factoryContract as any).getAddress(keyHash, keyType, deviceName, salt);

      setState(prev => ({
        ...prev,
        address,
        isDeployed: true,
        activeKeyCount: 1,
        signingKeys: [{
          keyHash,
          keyType,
          isActive: true,
          addedAt: Math.floor(Date.now() / 1000),
          deviceName,
        }],
      }));

      return address;
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [factoryContract, signer]);

  // Load existing account
  const loadAccount = useCallback(async (accountAddress: string) => {
    if (!provider) throw new Error('Provider not connected');

    setLoading(true);
    setError(null);

    try {
      const code = await provider.getCode(accountAddress);
      const isDeployed = code !== '0x';

      if (!isDeployed) {
        setState({
          address: accountAddress,
          isDeployed: false,
          signingKeys: [],
          activeKeyCount: 0,
        });
        return;
      }

      const account = getAccountContract(accountAddress);
      if (!account) throw new Error('Failed to create contract instance');

      const [keyHashes, keyTypes, isActive, addedAt, deviceNames] = await account.getSigningKeys();
      const activeCount = await account.activeKeyCount();

      const signingKeys: SigningKey[] = keyHashes.map((hash: string, i: number) => ({
        keyHash: hash,
        keyType: Number(keyTypes[i]),
        isActive: isActive[i],
        addedAt: Number(addedAt[i]),
        deviceName: deviceNames[i],
      }));

      setState({
        address: accountAddress,
        isDeployed: true,
        signingKeys,
        activeKeyCount: Number(activeCount),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load account');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [provider, getAccountContract]);

  // Add signing key
  const addSigningKey = useCallback(async (
    keyHash: string,
    keyType: number,
    deviceName: string
  ) => {
    if (!state.address || !signer) throw new Error('Account not loaded or signer not connected');

    setLoading(true);
    setError(null);

    try {
      const account = getAccountContract(state.address);
      if (!account) throw new Error('Failed to create contract instance');

      const accountWithSigner = account.connect(signer) as Contract;
      const tx = await accountWithSigner.addSigningKey(keyHash, keyType, deviceName);
      await tx.wait();

      // Reload account state
      await loadAccount(state.address);
    } catch (err: any) {
      setError(err.message || 'Failed to add signing key');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [state.address, signer, getAccountContract, loadAccount]);

  // Remove signing key
  const removeSigningKey = useCallback(async (keyHash: string) => {
    if (!state.address || !signer) throw new Error('Account not loaded or signer not connected');

    setLoading(true);
    setError(null);

    try {
      const account = getAccountContract(state.address);
      if (!account) throw new Error('Failed to create contract instance');

      const accountWithSigner = account.connect(signer) as Contract;
      const tx = await accountWithSigner.removeSigningKey(keyHash);
      await tx.wait();

      // Reload account state
      await loadAccount(state.address);
    } catch (err: any) {
      setError(err.message || 'Failed to remove signing key');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [state.address, signer, getAccountContract, loadAccount]);

  // Get signing keys
  const getSigningKeys = useCallback(async (): Promise<SigningKey[]> => {
    if (!state.address || !provider) throw new Error('Account not loaded');

    const account = getAccountContract(state.address);
    if (!account) throw new Error('Failed to create contract instance');

    const [keyHashes, keyTypes, isActive, addedAt, deviceNames] = await account.getSigningKeys();

    return keyHashes.map((hash: string, i: number) => ({
      keyHash: hash,
      keyType: Number(keyTypes[i]),
      isActive: isActive[i],
      addedAt: Number(addedAt[i]),
      deviceName: deviceNames[i],
    }));
  }, [state.address, provider, getAccountContract]);

  // Execute transaction
  const execute = useCallback(async (
    target: string,
    value: bigint,
    data: string
  ): Promise<string> => {
    if (!state.address || !signer) throw new Error('Account not loaded or signer not connected');

    setLoading(true);
    setError(null);

    try {
      const account = getAccountContract(state.address);
      if (!account) throw new Error('Failed to create contract instance');

      const accountWithSigner = account.connect(signer) as Contract;
      const tx = await accountWithSigner.execute(target, value, data);
      const receipt = await tx.wait();

      return receipt.hash;
    } catch (err: any) {
      setError(err.message || 'Failed to execute transaction');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [state.address, signer, getAccountContract]);

  // Execute batch
  const executeBatch = useCallback(async (
    targets: string[],
    values: bigint[],
    datas: string[]
  ): Promise<string> => {
    if (!state.address || !signer) throw new Error('Account not loaded or signer not connected');

    setLoading(true);
    setError(null);

    try {
      const account = getAccountContract(state.address);
      if (!account) throw new Error('Failed to create contract instance');

      const accountWithSigner = account.connect(signer) as Contract;
      const tx = await accountWithSigner.executeBatch(targets, values, datas);
      const receipt = await tx.wait();

      return receipt.hash;
    } catch (err: any) {
      setError(err.message || 'Failed to execute batch');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [state.address, signer, getAccountContract]);

  return {
    state,
    loading,
    error,
    getAccountAddress,
    createAccount,
    loadAccount,
    addSigningKey,
    removeSigningKey,
    getSigningKeys,
    execute,
    executeBatch,
    computeKeyHash,
    computeWebAuthnKeyHash,
  };
}

export { KEY_TYPE };
export default useArcAccount;
