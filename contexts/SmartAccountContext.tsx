import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Wallet, keccak256, toUtf8Bytes, parseUnits } from 'ethers';
import { useWallet } from './WalletContext';
import {
  deploySmartAccount,
  authorizeSessionKey,
  isSessionKeyAuthorised,
  readSmartAccountOwner,
} from '../services/smartAccountService';
import { ensureAccountHasBalance } from '../services/transactionService';

interface SmartAccountContextValue {
  smartAccountAddress: string | null;
  ownerAddress: string | null;
  isDeploying: boolean;
  isAuthorising: boolean;
  isCheckingAuthorisation: boolean;
  isSessionAuthorised: boolean;
  authorisationExpiresAt: number | null;
  error: string | null;
  deploy: () => Promise<void>;
  authoriseCurrentSession: (expiresInMinutes?: number) => Promise<void>;
  refreshAuthorisation: () => Promise<void>;
  clearError: () => void;
}

type StoredSmartAccount = {
  owner: string;
  address: string;
};

const STORAGE_KEY = 'arcwallet:smart-account:v2';
const MIN_OWNER_BALANCE_WEI = parseUnits('0.01', 18);
const OWNER_TOP_UP_WEI = parseUnits('0.05', 18);

const SmartAccountContext = createContext<SmartAccountContextValue | undefined>(undefined);

export const SmartAccountProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { sessionKey, userId } = useWallet();

  const ownerWallet = useMemo(() => {
    if (!userId) return null;
    try {
      const privateKey = keccak256(toUtf8Bytes(`arcwallet-owner:${userId}`));
      return new Wallet(privateKey);
    } catch (error) {
      console.error('Failed to derive owner wallet', error);
      return null;
    }
  }, [userId]);

  const ownerAddress = ownerWallet?.address ?? null;

  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(null);
  const [initialRecord, setInitialRecord] = useState<StoredSmartAccount | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isAuthorising, setIsAuthorising] = useState(false);
  const [isCheckingAuthorisation, setIsCheckingAuthorisation] = useState(false);
  const [isSessionAuthorised, setIsSessionAuthorised] = useState(false);
  const [authorisationExpiresAt, setAuthorisationExpiresAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as StoredSmartAccount;
      setInitialRecord(parsed);
    } catch (err) {
      console.warn('Failed to parse smart account cache', err);
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!ownerAddress || !initialRecord) return;
    if (initialRecord.owner.toLowerCase() === ownerAddress.toLowerCase()) {
      setSmartAccountAddress(initialRecord.address);
    } else if (typeof window !== 'undefined') {
      console.warn('Discarding cached smart account for different owner identity');
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setInitialRecord(null);
  }, [ownerAddress, initialRecord]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (smartAccountAddress && ownerAddress) {
      const payload: StoredSmartAccount = { owner: ownerAddress, address: smartAccountAddress };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } else if (!smartAccountAddress) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [smartAccountAddress, ownerAddress]);

  useEffect(() => {
    if (!smartAccountAddress || !ownerAddress) {
      setIsSessionAuthorised(false);
      setAuthorisationExpiresAt(null);
      return;
    }

    let cancelled = false;

    readSmartAccountOwner(smartAccountAddress)
      .then((onChainOwner) => {
        if (cancelled) return;
        if (onChainOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
          setError('Smart account owner mismatch. Please redeploy.');
          setSmartAccountAddress(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('Failed to read smart account owner', err);
      });

    return () => {
      cancelled = true;
    };
  }, [smartAccountAddress, ownerAddress]);

  const refreshAuthorisation = useCallback(async () => {
    if (!smartAccountAddress || !sessionKey) {
      setIsSessionAuthorised(false);
      setAuthorisationExpiresAt(null);
      setIsCheckingAuthorisation(false);
      return;
    }
    setIsCheckingAuthorisation(true);
    try {
      const { authorised, expiresAt } = await isSessionKeyAuthorised(
        smartAccountAddress,
        sessionKey.address,
      );
      setIsSessionAuthorised(authorised);
      setAuthorisationExpiresAt(authorised && expiresAt > 0n ? Number(expiresAt) : null);
    } catch (err) {
      console.warn('Failed to refresh smart account authorisation', err);
      setIsSessionAuthorised(false);
      setAuthorisationExpiresAt(null);
    } finally {
      setIsCheckingAuthorisation(false);
    }
  }, [smartAccountAddress, sessionKey]);

  useEffect(() => {
    void refreshAuthorisation();
  }, [refreshAuthorisation]);

  const deploy = useCallback(async () => {
    if (!sessionKey) {
      setError('Passkey session missing. Please authenticate again.');
      return;
    }
    if (!ownerAddress) {
      setError('Unable to derive a persistent owner identity. Please retry authentication.');
      return;
    }
    setIsDeploying(true);
    setError(null);
    try {
      const address = await deploySmartAccount(sessionKey.privateKey, ownerAddress);
      setSmartAccountAddress(address);
      setIsSessionAuthorised(false);
      setAuthorisationExpiresAt(null);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to deploy smart account');
    } finally {
      setIsDeploying(false);
    }
  }, [sessionKey, ownerAddress]);

  const authoriseCurrentSession = useCallback(
    async (expiresInMinutes = 10) => {
      if (!sessionKey || !smartAccountAddress || !ownerWallet) {
        setError('Smart account, owner, or session missing.');
        return;
      }
      setIsAuthorising(true);
      setError(null);
      try {
        if (sessionKey.address.toLowerCase() !== ownerWallet.address.toLowerCase()) {
          await ensureAccountHasBalance({
            funderPrivateKey: sessionKey.privateKey,
            targetAddress: ownerWallet.address,
            minBalanceWei: MIN_OWNER_BALANCE_WEI,
            topUpAmountWei: OWNER_TOP_UP_WEI,
          });
        }
        const expiresAt = Math.floor(Date.now() / 1000) + expiresInMinutes * 60;
        await authorizeSessionKey({
          signerPrivateKey: ownerWallet.privateKey,
          smartAccountAddress,
          sessionAddress: sessionKey.address,
          expiresAtSeconds: expiresAt,
        });
        await refreshAuthorisation();
      } catch (err: any) {
        setError(err?.message ?? 'Failed to authorise session key');
      } finally {
        setIsAuthorising(false);
      }
    },
    [sessionKey, smartAccountAddress, ownerWallet, refreshAuthorisation],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<SmartAccountContextValue>(
    () => ({
      smartAccountAddress,
      ownerAddress,
      isDeploying,
      isAuthorising,
      isCheckingAuthorisation,
      isSessionAuthorised,
      authorisationExpiresAt,
      error,
      deploy,
      authoriseCurrentSession,
      refreshAuthorisation,
      clearError,
    }),
    [
      smartAccountAddress,
      ownerAddress,
      isDeploying,
      isAuthorising,
      isCheckingAuthorisation,
      isSessionAuthorised,
      authorisationExpiresAt,
      error,
      deploy,
      authoriseCurrentSession,
      refreshAuthorisation,
      clearError,
    ],
  );

  return <SmartAccountContext.Provider value={value}>{children}</SmartAccountContext.Provider>;
};

export const useSmartAccount = (): SmartAccountContextValue => {
  const context = useContext(SmartAccountContext);
  if (!context) {
    throw new Error('useSmartAccount must be used within a SmartAccountProvider');
  }
  return context;
};
