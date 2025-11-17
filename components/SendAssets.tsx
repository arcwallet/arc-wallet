import React, { useEffect, useMemo, useState } from 'react';
import { isAddress } from 'ethers';
import { useArcAccount } from '../contexts/ArcAccountContext';
import { useWallet } from '../contexts/WalletContext';
import { useActivity } from '../contexts/ActivityContext';
import { formatUSDCAmount } from '../utils/format';
import {
  estimateNativeTransfer,
  estimateSmartAccountExecute,
} from '../services/transactionService';
import {
  executeNativeTransfer,
  executeSmartAccountTransferWithFallback,
} from '../services/executionRouter';
import { TransactionStatus, TransactionType } from '../types';
import { ExpandIcon, ContactIcon } from './Icons';
import { getAllSupportedTokens, TokenInfo, formatTokenAmount } from '../config/tokens';
import { tokenService } from '../services/tokenService';

const TX_EXPLORER_BASE = 'https://testnet.arcscan.app/tx/';

const SendAssets: React.FC = () => {
  const { snapshot, isLoading } = useArcAccount();
  const { sessionKey, verifyWithPasskey } = useWallet();
  const { addActivity } = useActivity();
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [selectedToken, setSelectedToken] = useState<TokenInfo>(getAllSupportedTokens()[0]);
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [submissionKind, setSubmissionKind] = useState<'transaction' | 'userOp'>('transaction');
  const [feeEstimate, setFeeEstimate] = useState<bigint | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const PASSKEY_REFRESH_BUFFER_MS = 2 * 60 * 1000;

  const sessionExpiresSoon = useMemo(() => {
    if (!sessionKey?.expiresAt) return true;
    const expiresMs = Date.parse(sessionKey.expiresAt);
    if (Number.isNaN(expiresMs)) return true;
    return expiresMs - Date.now() <= PASSKEY_REFRESH_BUFFER_MS;
  }, [sessionKey?.expiresAt]);

  const balance = useMemo(() => {
    return parseFloat(tokenBalance) || 0;
  }, [tokenBalance]);

  const balanceLabel = useMemo(() => {
    const formatted = formatTokenAmount(BigInt(Math.floor(balance * (10 ** selectedToken.decimals))), selectedToken, {
      minimumFractionDigits: 2,
      showSymbol: true
    });
    return formatted.display;
  }, [balance, selectedToken]);

  const listAddresses = () => {
    const addresses: string[] = [];
    if (sessionKey?.address) addresses.push(sessionKey.address);
    return addresses;
  };

  const fetchTotalBalance = async (symbol: string, addresses: string[]): Promise<number> => {
    // Restrict to Arc Testnet only (as per selected network in UI)
    const results: Array<number> = [];
    for (const addr of addresses) {
      try {
        const r = await tokenService.getTokenBalance(symbol, addr, 'testnet', 'arcTestnet');
        const val = r ? parseFloat(r.formattedBalance) : 0;
        if (Number.isFinite(val)) results.push(val);
      } catch (e) {
        // ignore and continue
      }
    }
    return results.reduce((a, b) => a + b, 0);
  };

  // Fetch token balance when selected token or address changes
  useEffect(() => {
    const fetchTokenBalance = async () => {
      const addresses = listAddresses();
      if (addresses.length === 0) {
        setTokenBalance('0');
        return;
      }

      try {
        const total = await fetchTotalBalance(selectedToken.symbol, addresses);
        setTokenBalance(total.toString());
      } catch (error) {
        console.error('Error fetching token balance:', error);
        setTokenBalance('0');
      }
    };

    fetchTokenBalance();
  }, [selectedToken, sessionKey?.address]);

  // On mount or address change: auto-select the token that has non-zero balance on Arc Testnet
  useEffect(() => {
    const chooseTokenWithBalance = async () => {
      const addresses = listAddresses();
      if (addresses.length === 0) return;
      try {
        const tokens = getAllSupportedTokens();
        let best: { token: TokenInfo; qty: number } | null = null;
        for (const t of tokens) {
          const qty = await fetchTotalBalance(t.symbol, addresses);
          if (!best || qty > best.qty) {
            best = { token: t, qty };
          }
        }
        if (best && best.qty > 0 && best.token.symbol !== selectedToken.symbol) {
          setSelectedToken(best.token);
          setTokenBalance(best.qty.toString());
        }
      } catch (e) {
        // ignore
      }
    };
    void chooseTokenWithBalance();
  }, [sessionKey?.address]);
  const amountNumber = parseFloat(amount) || 0;
  const feeDisplay = feeEstimate ? formatUSDCAmount(feeEstimate).display : isEstimating ? 'Estimating…' : '-';
  const feeNumber = feeEstimate ? Number(feeEstimate) / 1e18 : 0;
  const total = amountNumber > 0 ? amountNumber + feeNumber : 0;

  const usingSmartAccount = false;

  useEffect(() => {
    const shouldEstimate = sessionKey && isAddress(recipient) && amountNumber > 0;
    if (!shouldEstimate) {
      setFeeEstimate(null);
      return;
    }
    let cancelled = false;
    setIsEstimating(true);
    const estimatePromise = estimateNativeTransfer({ from: sessionKey.address, to: recipient, amount });

    estimatePromise
      .then((estimate) => {
        if (!cancelled) {
          setFeeEstimate(estimate.totalFeeWei);
        }
      })
      .catch((error) => {
        console.warn('Fee estimation failed', error);
        if (!cancelled) {
          setFeeEstimate(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsEstimating(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionKey, recipient, amount, amountNumber]);

  const isRecipientValid = recipient ? isAddress(recipient) : false;
  const hasSession = Boolean(sessionKey);
  const canSubmit = hasSession && isRecipientValid && amountNumber > 0 && amountNumber <= balance && !isSubmitting;

  const handleSubmit = async () => {
    if (!sessionKey) {
      setSubmitError('Passkey session missing. Please sign in again.');
      return;
    }
    if (!isRecipientValid) {
      setSubmitError('Recipient address is not valid.');
      return;
    }
    if (amountNumber <= 0) {
      setSubmitError('Enter an amount greater than zero.');
      return;
    }
    if (amountNumber > balance) {
      setSubmitError('Amount exceeds available balance.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setTxHash(null);
    try {
      if (sessionExpiresSoon) {
        try {
          await verifyWithPasskey();
        } catch (passkeyError: any) {
          const passkeyMsg = typeof passkeyError?.message === 'string' ? passkeyError.message : '';

          if (passkeyError instanceof DOMException && passkeyError.name === 'NotAllowedError') {
            throw new Error('Passkey verification was cancelled. Please try again and complete the verification.');
          } else if (passkeyMsg.toLowerCase().includes('user not found')) {
            throw new Error('Your passkey is not registered. Please sign out and create a new passkey.');
          } else if (passkeyMsg.toLowerCase().includes('not found') || passkeyMsg.toLowerCase().includes('passkey not found')) {
            throw new Error('Passkey not found. Please sign out and register a new passkey.');
          } else if (passkeyMsg.toLowerCase().includes('challenge')) {
            throw new Error('Authentication challenge expired. Please try again.');
          } else {
            throw new Error(`Passkey verification failed: ${passkeyMsg || 'Unknown error'}`);
          }
        }
      }

      let hash: string;
      let submissionKind: 'transaction' | 'userOp';
      const result = await executeNativeTransfer({
        sessionPrivateKey: sessionKey.privateKey,
        to: recipient,
        amount,
      });
      hash = result.hash;
      submissionKind = result.kind;
      setSubmissionKind(result.kind);

      setTxHash(hash);
      setAmount('');

      if (submissionKind === 'transaction') {
        const activity = {
          id: hash,
          type: TransactionType.Sent,
          description: `Sent ${amountNumber.toFixed(4)} USDC`,
          timestamp: 'Just now',
          date: new Date(),
          amount: -amountNumber,
          currency: 'USDC',
          usdValue: -amountNumber,
          status: TransactionStatus.Completed,
          hash,
          from: sessionKey.address,
          to: recipient,
          networkFee: 0,
          approvals: {
            required: 0,
            list: [],
          },
        };
        addActivity(activity);
      } else {
        const activity = {
          id: hash,
          type: TransactionType.Sent,
          description: `User operation submitted (${hash.slice(0, 10)}…)`,
          timestamp: 'Just now',
          date: new Date(),
          amount: -amountNumber,
          currency: 'USDC',
          usdValue: -amountNumber,
          status: TransactionStatus.Pending,
          hash,
          from: sessionKey.address,
          to: recipient,
          networkFee: 0,
          approvals: {
            required: 0,
            list: [],
          },
        };
        addActivity(activity);
      }
    } catch (error: any) {
      const message = typeof error?.message === 'string' ? error.message : 'Transaction failed';
      if (message.toLowerCase().includes('blocklist')) {
        setSubmitError('Transfer blocked: the sender or recipient is blocklisted.');
      } else if (message.includes('request limit') || error?.code === -32007) {
        setSubmitError('RPC rate limit reached. Please wait a few seconds or upgrade your RPC plan.');
      } else {
        setSubmitError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-12 text-center">
        <p className="text-text-primary text-4xl font-black leading-tight tracking-[-0.033em]">Send Assets</p>
        <p className="text-text-secondary text-base font-normal leading-normal mt-3">Initiate a secure transfer of your digital assets.</p>
      </div>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col w-full">
          <p className="text-sm font-medium leading-normal pb-2 text-text-secondary">Asset</p>
          <div className="relative w-full">
            <select
              value={selectedToken.symbol}
              onChange={(e) => {
                const token = getAllSupportedTokens().find(t => t.symbol === e.target.value);
                if (token) setSelectedToken(token);
              }}
              className="form-select flex w-full appearance-none resize-none overflow-hidden rounded-lg text-text-primary focus:outline-none border border-border-color bg-input-bg h-14 p-3.5 pr-10 text-base font-normal leading-normal focus:border-primary focus:ring-2 focus:ring-primary/50"
            >
              {getAllSupportedTokens().map((token) => (
                <option key={token.symbol} value={token.symbol}>
                  {token.name} ({token.symbol})
                </option>
              ))}
            </select>
            <ExpandIcon size={20} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
          </div>
          <p className="text-xs text-text-secondary mt-1.5 text-right">Balance: {isLoading ? 'Loading…' : balanceLabel}</p>
        </div>
        <label className="flex flex-col w-full">
          <p className="text-sm font-medium leading-normal pb-2 text-text-secondary">Amount</p>
          <div className="relative flex w-full flex-1 items-stretch">
            <input
              className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border-color bg-input-bg h-14 placeholder:text-text-secondary/70 p-3.5 text-base font-normal leading-normal"
              placeholder="0.00"
              step="any"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button
              onClick={() => setAmount(balance.toFixed(6))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
            >
              MAX
            </button>
          </div>
        </label>
        <label className="flex flex-col w-full">
          <p className="text-sm font-medium leading-normal pb-2 text-text-secondary">Send To</p>
          <div className="flex w-full flex-1 items-stretch rounded-lg">
            <input
              className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-l-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border-color bg-input-bg h-14 placeholder:text-text-secondary/70 p-3.5 pr-2 text-base font-normal leading-normal"
              placeholder="Enter recipient wallet address"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
            <div className="text-text-secondary flex items-center justify-center rounded-r-lg border border-l-0 border-border-color bg-input-bg px-3.5">
              <ContactIcon size={20} />
            </div>
          </div>
        </label>
        <div className="mt-2 rounded-lg border border-border-color bg-input-bg/50 p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Transaction Summary</h3>
          <div className="flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Sending</span>
              <span className="text-text-primary font-medium">{amountNumber > 0 ? `${amountNumber} USDC` : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Execution Route</span>
              <span className="text-text-primary font-medium">
                {usingSmartAccount ? 'Smart Account' : 'Signer Wallet'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Network Fee</span>
              <span className="text-text-primary font-medium">{amountNumber > 0 ? feeDisplay : '-'}</span>
            </div>
            <div className="my-2 border-t border-dashed border-border-color" />
            <div className="flex justify-between">
              <span className="text-text-secondary font-medium">Total</span>
              <span className="text-text-primary font-bold">{total > 0 ? `${total.toFixed(4)} USDC` : '-'}</span>
            </div>
          </div>
        </div>
        {!hasSession && (
          <p className="text-sm text-accent-orange text-center">
            Connect with your passkey to send transactions.
          </p>
        )}
        {usingSmartAccount && hasSession && !isAuthorised && !isCheckingAuthorisation && (
          <p className="text-sm text-accent-orange text-center">
            Authorise this session from the smart account panel before executing transfers.
          </p>
        )}
        {usingSmartAccount && isCheckingAuthorisation && (
          <p className="text-sm text-text-secondary text-center">
            Verifying smart account authorisation…
          </p>
        )}
        {submitError && <p className="text-sm text-accent-orange text-center">{submitError}</p>}
        {txHash && (
          submissionKind === 'transaction' ? (
            <p className="text-sm text-primary text-center">
              Transaction submitted:{' '}
              <a className="underline" href={`${TX_EXPLORER_BASE}${txHash}`} target="_blank" rel="noreferrer">
                View on ArcScan
              </a>
            </p>
          ) : (
            <p className="text-sm text-primary text-center">
              User operation submitted: <span className="font-mono">{txHash}</span>
            </p>
          )
        )}
        <div className="mt-6">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-14 bg-primary text-primary-text text-lg font-bold leading-normal tracking-wide transition-all hover:opacity-90 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {sessionExpiresSoon ? 'Verifying & Sending…' : 'Sending…'}
              </span>
            ) : (
              'Send with Passkey'
            )}
          </button>
          <p className="text-xs text-text-secondary text-center mt-3">
            You'll be prompted to verify with your passkey before sending
          </p>
        </div>
      </div>
    </div>
  );
};

export default SendAssets;
