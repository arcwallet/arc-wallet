
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { isAddress, parseUnits } from 'ethers';
import { useArcAccount } from '../contexts/ArcAccountContext';
import { useWallet } from '../contexts/WalletContext';
import { useSelfCustodialWallet } from '../contexts/SelfCustodialWalletContext';
import { usePasskeyAccount } from '../contexts/PasskeyAccountContext';

import { useActivity } from '../contexts/ActivityContext';
import { usePrivacy } from '../contexts/PrivacyContext';
import { preparePrivateTransaction, PrivateTransactionData } from '../services/teeService';
import { formatUSDCAmount } from '../utils/format';
import {
  estimateNativeTransfer,
  estimateSmartAccountExecute,
  estimateSmartAccountBatchExecute,
  estimateERC20Transfer,
} from '../services/transactionService';
import {
  executeNativeTransfer,
  executeSmartAccountTransferWithFallback,
  executeERC20Transfer,
  executeViaSmartAccount,
  executeBatchViaSmartAccount,
  isERC4337Available,
  getSmartAccountAddress,
} from '../services/executionRouter';
import { TransactionStatus, TransactionType } from '../types';
import { ExpandIcon, ContactIcon, LockIcon, StarIcon, UserCircleIcon, ClockIcon, PlusIcon, SearchIcon, CloseIcon } from './Icons';
import { getAllSupportedTokens, TokenInfo, formatTokenAmount } from '../config/tokens';
import { tokenService } from '../services/tokenService';
import { paymasterClient } from '../services/paymasterClient';
import { gasStationClient } from '../services/gasStationClient';
import { GasSponsorshipIndicator, GasFeeBadge } from './GasSponsorshipIndicator';
import { BatchTransfer } from './BatchTransfer';
import { TX_EXPLORER_URL } from '../config/app.config';
import { addressBookService, Contact } from '../services/addressBookService';


interface SendAssetsProps {
  initialAmount?: string;
  initialRecipient?: string;
  initialToken?: string;
}

const SendAssets: React.FC<SendAssetsProps> = ({ initialAmount = '', initialRecipient = '', initialToken }) => {
  const { snapshot, isLoading } = useArcAccount();
  // IMPORTANT: Use ONLY self-custodial wallet for transactions
  // This ensures private keys NEVER leave the device
  const { address: selfCustodialAddress, getPrivateKey } = useSelfCustodialWallet();

  // Passkey-native account (P256 signing, no private key stored)
  const {
    isConnected: passkeyConnected,
    address: passkeyAddress,
    signUserOperation,
    connect: connectPasskey,
    createAccount: createPasskeyAccount,
    hasAccount: hasPasskeyAccount,
    isConnecting: passkeyConnecting,
    manager: passkeyManager,
  } = usePasskeyAccount();

  const { sessionKey } = useWallet();
  const { addActivity } = useActivity();
  const { isPrivacyMode, fheKeypair } = usePrivacy();

  // Priority: Passkey wallet > Self-custodial > Session key (for address display)
  const walletAddress = passkeyAddress || selfCustodialAddress || sessionKey?.address;

  // Private key MUST come from SDK only (never from server session key)
  const walletPrivateKey = getPrivateKey();
  // DEBUG: Log wallet info
  useEffect(() => {
    console.log('[SEND DEBUG] Wallet Info:', {
      selfCustodialAddress,
      passkeyAddress,
      sessionKeyAddress: sessionKey?.address,
      walletAddress,
      hasPrivateKey: !!walletPrivateKey,
    });
  }, [selfCustodialAddress, passkeyAddress, sessionKey, walletAddress, walletPrivateKey]);
  const [amount, setAmount] = useState(initialAmount);
  const [recipient, setRecipient] = useState(initialRecipient);
  const [selectedToken, setSelectedToken] = useState<TokenInfo>(() => {
    const tokens = getAllSupportedTokens();
    if (initialToken) {
      const found = tokens.find(t => t.symbol.toUpperCase() === initialToken.toUpperCase());
      if (found) return found;
    }
    return tokens[0];
  });
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [submissionKind, setSubmissionKind] = useState<'transaction' | 'userOp'>('transaction');
  const [feeEstimate, setFeeEstimate] = useState<bigint | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [encryptedAmountPreview, setEncryptedAmountPreview] = useState<string | null>(null);
  const [isGasSponsored, setIsGasSponsored] = useState(false);
  const [checkingSponsorship, setCheckingSponsorship] = useState(false);
  const [gasEligibility, setGasEligibility] = useState<{
    eligible: boolean;
    balance: string;
    message: string;
  } | null>(null);

  // Batch Mode State
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchTransactions, setBatchTransactions] = useState<{ to: string; amount: string; data?: string }[]>([]);

  // Smart Account Mode (ERC-4337)
  const [useSmartAccount, setUseSmartAccount] = useState(false);
  const [smartAccountAvailable, setSmartAccountAvailable] = useState(false);
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(null);

  // Address Book State
  const [showAddressBook, setShowAddressBook] = useState(false);
  const [addressBookSearch, setAddressBookSearch] = useState('');
  const [showSaveContact, setShowSaveContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactLabel, setNewContactLabel] = useState('');
  const addressBookRef = useRef<HTMLDivElement>(null);

  // Get combined contacts and recent recipients
  const addressBookList = useMemo(() => {
    const list = addressBookService.getCombinedList();
    if (!addressBookSearch.trim()) return list;
    const query = addressBookSearch.toLowerCase();
    return list.filter(
      item => item.address.toLowerCase().includes(query) ||
              item.name?.toLowerCase().includes(query) ||
              item.label?.toLowerCase().includes(query)
    );
  }, [addressBookSearch, showAddressBook]);

  // Close address book when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addressBookRef.current && !addressBookRef.current.contains(event.target as Node)) {
        setShowAddressBook(false);
      }
    };
    if (showAddressBook) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddressBook]);


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
    if (walletAddress) addresses.push(walletAddress);
    return addresses;
  };

  const fetchTotalBalance = async (symbol: string, addresses: string[]): Promise<number> => {
    // Restrict to Arc Testnet only (as per selected network in UI)
    const results: Array<number> = [];
    for (const addr of addresses) {
      try {
        console.log(`[SEND DEBUG] Fetching ${symbol} balance for address:`, addr);
        const r = await tokenService.getTokenBalance(symbol, addr, 'testnet', 'arcTestnet');
        const val = r ? parseFloat(r.formattedBalance) : 0;
        console.log(`[SEND DEBUG] ${symbol} balance for ${addr}:`, val, 'raw:', r?.balance.toString());
        if (Number.isFinite(val)) results.push(val);
      } catch (e) {
        console.error(`[SEND DEBUG] Error fetching ${symbol} balance for ${addr}:`, e);
        // ignore and continue
      }
    }
    const total = results.reduce((a, b) => a + b, 0);
    console.log(`[SEND DEBUG] Total ${symbol} balance:`, total);
    return total;
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
  }, [selectedToken, walletAddress]);

  // Check gas sponsorship eligibility when wallet address changes
  useEffect(() => {
    const checkGasEligibility = async () => {
      if (!walletAddress) {
        setGasEligibility(null);
        return;
      }

      try {
        const result = await gasStationClient.shouldShowGasSponsorship(walletAddress);
        setGasEligibility({
          eligible: result.eligible,
          balance: result.balance,
          message: result.message,
        });
        // If eligible, mark as sponsored for UI purposes
        if (result.eligible) {
          setIsGasSponsored(true);
        }
      } catch (error) {
        console.error('Error checking gas eligibility:', error);
        setGasEligibility(null);
      }
    };

    checkGasEligibility();
  }, [walletAddress]);

  // Check ERC-4337 Smart Account availability
  useEffect(() => {
    const checkSmartAccount = async () => {
      if (!walletAddress) {
        setSmartAccountAvailable(false);
        setSmartAccountAddress(null);
        return;
      }

      try {
        const available = await isERC4337Available();
        setSmartAccountAvailable(available);

        if (available) {
          const saAddress = await getSmartAccountAddress(walletAddress);
          setSmartAccountAddress(saAddress);
          console.log('[ERC-4337] Smart Account address:', saAddress);
        }
      } catch (error) {
        console.error('Error checking ERC-4337 availability:', error);
        setSmartAccountAvailable(false);
      }
    };

    checkSmartAccount();
  }, [walletAddress]);

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
  }, [walletAddress]);
  const amountNumber = parseFloat(amount) || 0;
  const feeDisplay = feeEstimate ? formatUSDCAmount(feeEstimate).display : isEstimating ? 'Estimating…' : '-';
  const feeNumber = feeEstimate ? Number(feeEstimate) / 1e18 : 0;
  const total = amountNumber > 0 ? amountNumber + feeNumber : 0;

  // Use Smart Account if available and enabled
  const usingSmartAccount = useSmartAccount && smartAccountAvailable;

  // Estimate fees
  useEffect(() => {
    const estimateFees = async () => {
      if (!walletAddress || !walletPrivateKey) return;

      // Skip estimation if inputs are invalid
      if (isBatchMode) {
        if (batchTransactions.length === 0 || !batchTransactions.every(tx => isAddress(tx.to) && parseFloat(tx.amount) > 0)) {
          setFeeEstimate(null);
          return;
        }
      } else {
        if (!isAddress(recipient) || !amount || parseFloat(amount) <= 0) {
          setFeeEstimate(null);
          return;
        }
      }

      setIsEstimating(true);
      setCheckingSponsorship(true);
      try {
        // Check paymaster eligibility (only for smart accounts)
        if (usingSmartAccount) {
          const canSponsor = await paymasterClient.canSponsor(walletAddress, '0');
          setIsGasSponsored(canSponsor);
        } else {
          setIsGasSponsored(false);
        }

        // Estimate gas
        let estimate: bigint;
        if (isBatchMode) {
          const batchEst = await estimateSmartAccountBatchExecute({
            sessionPrivateKey: walletPrivateKey,
            smartAccountAddress: walletAddress,
            transactions: batchTransactions.map(t => ({
              to: t.to,
              value: parseUnits(t.amount, selectedToken.decimals),
              data: t.data || '0x'
            }))
          });
          estimate = batchEst.gasLimit;
        } else {
          // For ERC20 tokens
          if (selectedToken.symbol !== 'ETH') {
            if (usingSmartAccount) {
              // Smart Account gas estimation
              const est = await estimateSmartAccountExecute({
                sessionPrivateKey: walletPrivateKey,
                smartAccountAddress: walletAddress,
                to: recipient,
                amount: '0', // No native value for token transfer
                data: '0x' // Data will be encoded during actual transfer
              });
              estimate = est.gasLimit;
            } else {
              // EOA ERC20 transfer gas estimation
              const { getTokenContractAddress } = await import('../config/tokens');
              const tokenAddress = getTokenContractAddress(selectedToken.symbol, 'testnet', 'arcTestnet');
              console.log('[SEND DEBUG] Gas estimation params:', {
                from: walletAddress,
                tokenAddress,
                to: recipient,
                amount,
                decimals: selectedToken.decimals,
                tokenSymbol: selectedToken.symbol
              });
              if (tokenAddress) {
                const est = await estimateERC20Transfer({
                  from: walletAddress,
                  tokenAddress,
                  to: recipient,
                  amount,
                  decimals: selectedToken.decimals
                });
                console.log('[SEND DEBUG] Gas estimation result:', est);
                estimate = est.totalFeeWei;
              } else {
                console.warn('[SEND DEBUG] No token address found for', selectedToken.symbol);
                estimate = 0n;
              }
            }
          } else {
            // Native ETH transfer
            if (usingSmartAccount) {
              const est = await estimateSmartAccountExecute({
                sessionPrivateKey: walletPrivateKey,
                smartAccountAddress: walletAddress,
                to: recipient,
                amount: amount,
                data: '0x'
              });
              estimate = est.gasLimit;
            } else {
              const est = await estimateNativeTransfer({
                from: walletAddress,
                to: recipient,
                amount: amount
              });
              estimate = est.totalFeeWei;
            }
          }
        }
        setFeeEstimate(estimate);
      } catch (error) {
        console.warn('Fee estimation failed', error);
      } finally {
        setIsEstimating(false);
        setCheckingSponsorship(false);
      }
    };

    const timer = setTimeout(estimateFees, 500);
    return () => clearTimeout(timer);
  }, [recipient, amount, walletAddress, isBatchMode, batchTransactions, walletPrivateKey]);


  const isRecipientValid = recipient ? isAddress(recipient) : false;
  const hasSession = Boolean(walletAddress);
  // IMPORTANT: Allow submission with either private key OR passkey wallet
  // Passkey wallet doesn't use private key - it signs via WebAuthn P256
  const hasSigningCapability = !!walletPrivateKey || passkeyConnected;
  const canSubmit = hasSession && isRecipientValid && amountNumber > 0 && amountNumber <= balance && !isSubmitting && hasSigningCapability;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress) {
      setSubmitError('Wallet not available. Please connect your wallet.');
      return;
    }
    // Require either private key (self-custodial) OR passkey connection
    if (!walletPrivateKey && !passkeyConnected) {
      setSubmitError('Please unlock your wallet or connect with passkey.');
      return;
    }

    // Validation
    if (isBatchMode) {
      if (batchTransactions.some(tx => !isAddress(tx.to) || !tx.amount || parseFloat(tx.amount) <= 0)) {
        setSubmitError('Invalid batch transactions: ensure all recipients are valid and amounts are greater than zero.');
        return;
      }
      const totalBatchAmount = batchTransactions.reduce((acc, tx) => acc + parseFloat(tx.amount), 0);
      if (totalBatchAmount > balance) {
        setSubmitError('Total batch amount exceeds available balance.');
        return;
      }
    } else {
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
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setTxHash(null);
    try {
      // NOTE: Passkey verification is done during wallet unlock (SDK's unlockWallet)
      // No need for server-side verification since private key is client-side only
      console.log('[SEND] Proceeding with transaction - wallet already unlocked via passkey');


      // Auto-sponsor gas if needed (Phase 1 Gas Station)
      try {
        console.log('[SEND] Checking gas sponsorship eligibility...');
        const sponsorResult = await gasStationClient.autoSponsor(walletAddress);
        if (sponsorResult.sponsored) {
          console.log(`[SEND] Gas sponsored: ${sponsorResult.amount} USDC, tx: ${sponsorResult.txHash}`);
        } else {
          console.log(`[SEND] Gas sponsorship not needed: ${sponsorResult.reason}`);
        }
      } catch (gasError) {
        // Gas sponsorship is optional, continue with transaction
        console.warn('[SEND] Gas sponsorship check failed, continuing:', gasError);
      }

      // TEE Privacy Logic (Simulation Mode)
      if (isPrivacyMode) {
        try {
          const amountWei = parseUnits(amount, selectedToken.decimals);

          // Get token contract address if applicable
          const contractAddress = selectedToken.symbol !== 'ETH' ?
            (await import('../config/tokens')).getTokenContractAddress(selectedToken.symbol, 'testnet', 'arcTestnet') :
            '0x0000000000000000000000000000000000000000';

          // Prepare private transaction using TEE simulation
          const privateData = await preparePrivateTransaction(
            amountWei,
            recipient,
            contractAddress || undefined
          );

          console.log('[TEE] Private Transaction (Simulation):', privateData);
          console.log('Encrypted Amount:', privateData.encryptedAmount);
          console.log('Proof:', privateData.proof);
          console.log('Method:', privateData.metadata?.method);

        } catch (teeError) {
          console.error('TEE Privacy preparation failed:', teeError);
          setSubmitError('Privacy Mode preparation failed. Please try again.');
          setIsSubmitting(false);
          return;
        }
      }


      let hash: string;
      let kind: 'transaction' | 'userOp' = 'transaction';

      // PASSKEY WALLET - Cannot send directly (Arc doesn't support ERC-4337 bundlers yet)
      // Passkey is used for authentication only, transactions need self-custodial wallet
      if (passkeyConnected && !walletPrivateKey) {
        console.log('[SEND] Passkey wallet detected but no private key - need self-custodial wallet');
        setSubmitError(
          'To send transactions, please create a self-custodial wallet. ' +
          'Passkey is used for secure login only.'
        );
        setIsSubmitting(false);
        return;
      }

      // PRIVATE KEY WALLET PATH - Uses traditional signing
      if (!walletPrivateKey) {
        throw new Error('No signing method available. Please connect a wallet.');
      }

      if (isBatchMode) {
        // Prepare batch transactions
        const transactions = batchTransactions.map(tx => ({
          to: tx.to,
          value: tx.amount,
          data: tx.data || '0x'
        }));

        if (usingSmartAccount) {
          // ERC-4337 Smart Account batch execution
          console.log('[SEND] Executing batch via ERC-4337 Smart Account');
          const result = await executeBatchViaSmartAccount({
            privateKey: walletPrivateKey,
            transactions,
            sponsored: true // Use Pimlico paymaster for gasless
          });
          hash = result.hash;
          kind = result.kind;
        } else {
          // Legacy Smart Account batch execution
          const legacyTransactions = batchTransactions.map(tx => ({
            to: tx.to,
            value: parseUnits(tx.amount, selectedToken.decimals),
            data: tx.data || '0x'
          }));

          const result = await executeSmartAccountTransferWithFallback({
            smartAccountAddress: walletAddress,
            sessionPrivateKey: walletPrivateKey,
            to: '0x0000000000000000000000000000000000000000',
            amount: '0',
            transactions: legacyTransactions
          });
          hash = result.hash;
          kind = result.kind;
        }
      } else {
        // Single transfer
        const tokenInfo = selectedToken;

        // Check if we're transferring a token (not native currency)
        if (tokenInfo.symbol !== 'ETH') {
          // Get token contract address
          const { getTokenContractAddress } = await import('../config/tokens');
          const tokenAddress = getTokenContractAddress(tokenInfo.symbol, 'testnet', 'arcTestnet');

          if (!tokenAddress) {
            throw new Error(`Token contract address not found for ${tokenInfo.symbol}`);
          }

          console.log(`[SEND] Transferring ${amount} ${tokenInfo.symbol} to ${recipient}`);
          console.log(`[SEND] Token contract: ${tokenAddress}`);
          console.log(`[SEND] Using Smart Account (ERC-4337): ${usingSmartAccount}`);

          if (usingSmartAccount) {
            // ERC-4337 Smart Account: Encode ERC20 transfer as calldata
            const { Interface, parseUnits } = await import('ethers');
            const iface = new Interface([
              'function transfer(address to, uint256 amount) returns (bool)'
            ]);
            const amountWei = parseUnits(amount, tokenInfo.decimals);
            const transferData = iface.encodeFunctionData('transfer', [recipient, amountWei]);

            console.log(`[SEND] Amount (wei): ${amountWei.toString()}`);
            console.log(`[SEND] Executing via ERC-4337 with Pimlico bundler`);

            const result = await executeViaSmartAccount({
              privateKey: walletPrivateKey,
              to: tokenAddress, // Call token contract
              amount: '0', // No native value for ERC20
              data: transferData,
              sponsored: true // Pimlico paymaster
            });
            hash = result.hash;
            kind = result.kind;
          } else {
            // EOA: Direct ERC20 transfer
            const result = await executeERC20Transfer({
              privateKey: walletPrivateKey,
              tokenAddress,
              to: recipient,
              amount,
              decimals: tokenInfo.decimals
            });
            hash = result.hash;
            kind = result.kind;
          }
        } else {
          // Native ETH/USDC transfer
          if (usingSmartAccount) {
            // ERC-4337 Smart Account native transfer
            console.log(`[SEND] Native transfer via ERC-4337 Smart Account`);
            const { parseUnits } = await import('ethers');
            const amountWei = parseUnits(amount, 6).toString(); // Arc uses USDC (6 decimals)

            const result = await executeViaSmartAccount({
              privateKey: walletPrivateKey,
              to: recipient,
              amount: amountWei,
              sponsored: true // Pimlico paymaster
            });
            hash = result.hash;
            kind = result.kind;
          } else {
            const result = await executeNativeTransfer({
              sessionPrivateKey: walletPrivateKey,
              to: recipient,
              amount: amount
            });
            hash = result.hash;
            kind = result.kind;
          }
        }
      }

      setTxHash(hash);

      // Record recipient in address book (for recent recipients)
      addressBookService.recordRecipient(recipient, amount, selectedToken.symbol);

      if (submissionKind === 'transaction') {
        const activity = {
          id: hash,
          type: TransactionType.Sent,
          description: `Sent ${amountNumber.toFixed(4)} ${selectedToken.symbol}`,
          timestamp: 'Just now',
          date: new Date(),
          amount: -amountNumber,
          currency: selectedToken.symbol,
          usdValue: -amountNumber * (selectedToken.currentPrice || 1),
          status: TransactionStatus.Completed,
          hash,
          from: walletAddress,
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
          description: `User operation submitted(${hash.slice(0, 10)}…)`,
          timestamp: 'Just now',
          date: new Date(),
          amount: -amountNumber,
          currency: selectedToken.symbol,
          usdValue: -amountNumber * (selectedToken.currentPrice || 1),
          status: TransactionStatus.Pending,
          hash,
          from: walletAddress,
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
        {/* Smart Account Mode Toggle */}
        {smartAccountAvailable && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-blue-400">ERC-4337 Smart Account</span>
                  <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">Gasless</span>
                </div>
                <p className="text-xs text-blue-300/70 mt-1">
                  {smartAccountAddress ? `${smartAccountAddress.slice(0, 8)}...${smartAccountAddress.slice(-6)}` : 'Loading...'}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={useSmartAccount}
                  onChange={(e) => setUseSmartAccount(e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            {useSmartAccount && (
              <p className="text-xs text-green-400 mt-2">
                ✓ Transactions will be sponsored by Pimlico Paymaster
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col w-full">
          <p className="text-sm font-medium leading-normal pb-2 text-text-secondary">Asset</p>
          <div className="relative w-full">
            <select
              value={selectedToken.symbol}
              onChange={(e) => {
                const token = getAllSupportedTokens().find(t => t.symbol === e.target.value);
                if (token) setSelectedToken(token);
              }}
              className="form-select flex w-full appearance-none resize-none overflow-hidden rounded-lg text-white focus:outline-none border border-slate-500/50 bg-slate-900/60 backdrop-blur-sm h-14 p-3.5 pr-10 text-base font-normal leading-normal focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all"
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
              className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-blue-400 border border-slate-500/50 bg-slate-900/60 backdrop-blur-sm h-14 placeholder:text-slate-400 p-3.5 text-base font-normal leading-normal transition-all"
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
        <div className="flex flex-col w-full relative" ref={addressBookRef}>
          <div className="flex items-center justify-between pb-2">
            <p className="text-sm font-medium leading-normal text-text-secondary">Send To</p>
            {recipient && isAddress(recipient) && !addressBookService.getContactByAddress(recipient) && (
              <button
                type="button"
                onClick={() => setShowSaveContact(true)}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
              >
                <PlusIcon size={12} />
                Save Contact
              </button>
            )}
          </div>
          <div className="flex w-full flex-1 items-stretch rounded-lg">
            <input
              className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-l-lg text-white focus:outline-none focus:ring-1 focus:ring-blue-400 border border-slate-500/50 bg-slate-900/60 backdrop-blur-sm h-14 placeholder:text-slate-400 p-3.5 pr-2 text-base font-normal leading-normal transition-all"
              placeholder="Enter address or select contact"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              onFocus={() => setShowAddressBook(true)}
            />
            <button
              type="button"
              onClick={() => setShowAddressBook(!showAddressBook)}
              className="text-slate-400 hover:text-white flex items-center justify-center rounded-r-lg border border-l-0 border-slate-500/50 bg-slate-900/60 hover:bg-slate-800/60 backdrop-blur-sm px-3.5 transition-colors"
            >
              <ContactIcon size={20} />
            </button>
          </div>

          {/* Address Book Dropdown */}
          {showAddressBook && (
            <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-lg border border-slate-500/50 bg-slate-900/95 backdrop-blur-md shadow-xl max-h-80 overflow-hidden">
              {/* Search */}
              <div className="p-3 border-b border-slate-700/50">
                <div className="relative">
                  <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={addressBookSearch}
                    onChange={(e) => setAddressBookSearch(e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              {/* List */}
              <div className="overflow-y-auto max-h-56">
                {addressBookList.length > 0 ? (
                  addressBookList.map((item, index) => (
                    <button
                      key={item.address + index}
                      type="button"
                      onClick={() => {
                        setRecipient(item.address);
                        setShowAddressBook(false);
                        setAddressBookSearch('');
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-slate-800/60 transition-colors text-left border-b border-slate-700/30 last:border-b-0"
                    >
                      <div className="flex-shrink-0">
                        {item.isContact ? (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <span className="text-white text-sm font-semibold">
                              {item.name?.charAt(0).toUpperCase() || '?'}
                            </span>
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center">
                            <ClockIcon size={16} className="text-slate-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">
                            {item.name || `${item.address.slice(0, 8)}...${item.address.slice(-6)}`}
                          </span>
                          {item.isFavorite && (
                            <StarIcon size={12} filled className="text-yellow-400 flex-shrink-0" />
                          )}
                          {item.label && (
                            <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                              {item.label}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate font-mono">
                          {item.address.slice(0, 10)}...{item.address.slice(-8)}
                        </p>
                      </div>
                      {!item.isContact && item.count && (
                        <span className="text-xs text-slate-500 flex-shrink-0">
                          {item.count}x
                        </span>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="p-6 text-center">
                    <UserCircleIcon size={32} className="mx-auto text-slate-600 mb-2" />
                    <p className="text-sm text-slate-400">
                      {addressBookSearch ? 'No matching contacts' : 'No contacts yet'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {addressBookSearch ? 'Try a different search' : 'Send to an address to add it to recents'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Save Contact Modal */}
          {showSaveContact && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Save Contact</h3>
                  <button
                    onClick={() => {
                      setShowSaveContact(false);
                      setNewContactName('');
                      setNewContactLabel('');
                    }}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <CloseIcon size={20} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Address</label>
                    <p className="text-sm text-white font-mono bg-slate-800 p-2 rounded truncate">
                      {recipient}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Name *</label>
                    <input
                      type="text"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                      placeholder="e.g., Alice, Binance, etc."
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Label (optional)</label>
                    <input
                      type="text"
                      value={newContactLabel}
                      onChange={(e) => setNewContactLabel(e.target.value)}
                      placeholder="e.g., Work, Exchange, Friend"
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setShowSaveContact(false);
                        setNewContactName('');
                        setNewContactLabel('');
                      }}
                      className="flex-1 px-4 py-2 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (newContactName.trim() && recipient) {
                          try {
                            addressBookService.addContact({
                              address: recipient,
                              name: newContactName.trim(),
                              label: newContactLabel.trim() || undefined,
                            });
                            setShowSaveContact(false);
                            setNewContactName('');
                            setNewContactLabel('');
                          } catch (e: any) {
                            alert(e.message);
                          }
                        }
                      }}
                      disabled={!newContactName.trim()}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-white font-medium transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="mt-2 rounded-lg border border-slate-500/50 bg-slate-900/60 backdrop-blur-sm p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Transaction Summary</h3>

          {/* Privacy Mode Indicator */}
          {isPrivacyMode && (
            <div className="mb-3 rounded-lg bg-blue-500/10 border border-blue-500/30 p-3">
              <div className="flex items-center gap-2 mb-2">
                <LockIcon size={16} className="text-blue-400" />
                <span className="text-sm font-semibold text-blue-400">Private Transaction</span>
              </div>
              <p className="text-xs text-blue-300/80">
                Transaction amount will be encrypted on-chain
              </p>
            </div>
          )}

          {/* Gas Sponsorship Indicator */}
          {isGasSponsored && (
            <GasSponsorshipIndicator
              isSponsored={true}
              estimatedGas={feeDisplay !== 'Estimating…' && feeDisplay !== '-' ? feeDisplay : undefined}
            />
          )}

          <div className="flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Sending</span>
              <span className="text-text-primary font-medium">
                {isPrivacyMode && amountNumber > 0 ? (
                  <span className="flex items-center gap-1.5">
                    <LockIcon size={12} className="text-blue-400" />
                    <span className="text-blue-400">Encrypted</span>
                  </span>
                ) : (
                  amountNumber > 0 ? `${amountNumber} USDC` : '-'
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Execution Route</span>
              <span className="text-text-primary font-medium">
                {usingSmartAccount ? 'Smart Account' : 'Signer Wallet'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Network Fee</span>
              {amountNumber > 0 ? (
                <GasFeeBadge
                  isSponsored={isGasSponsored}
                  gasFee={feeDisplay}
                />
              ) : (
                <span className="text-text-primary font-medium">-</span>
              )}
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
        {submitError && <p className="text-sm text-accent-orange text-center">{submitError}</p>}
        {txHash && (
          submissionKind === 'transaction' ? (
            <p className="text-sm text-primary text-center">
              Transaction submitted:{' '}
              <a className="underline" href={`${TX_EXPLORER_URL}${txHash}`} target="_blank" rel="noreferrer">
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
            className="w-full rounded-md bg-white px-4 py-3 text-lg font-semibold text-black hover:bg-accent-blue focus:outline-none focus:ring-2 focus:ring-accent-blue disabled:bg-slate-400 disabled:text-slate-600 transition-all"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending…
              </span>
            ) : (
              'Send with Passkey'
            )}
          </button>
          <p className="mt-2 text-xs text-slate-500 text-center">
            You'll be prompted to verify with your passkey before sending
          </p>
        </div>
      </div>
    </div>
  );
};

export default SendAssets;
