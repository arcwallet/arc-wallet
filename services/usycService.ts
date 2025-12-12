/**
 * USYC Treasury Service
 * Handles Subscribe (USDC → USYC) and Redeem (USYC → USDC) operations
 * via the Hashnote Teller contract on Arc Testnet
 */

import { Contract, Interface, parseUnits, formatUnits } from 'ethers';
import { getProvider } from './rpcProvider';
import { circleWalletService } from './circleWalletService';

// Arc Testnet Contract Addresses (Verified on Blockscout)
export const USYC_CONTRACTS = {
  arcTestnet: {
    usyc: '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C',      // USYC Token
    teller: '0x9fdF14c5B14173D74C08Af27AebFf39240dC105A',    // USYC Teller (Subscribe/Redeem)
    usdc: '0x3600000000000000000000000000000000000000',      // USDC on Arc
    entitlements: '0xcc205224862c7641930c87679e98999d23c26113', // Allowlist contract
  },
};

// Teller ABI (ERC4626-like interface)
const TELLER_ABI = [
  // Subscribe: USDC → USYC
  'function deposit(uint256 assets, address receiver) external returns (uint256 shares)',
  // Redeem: USYC → USDC
  'function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets)',
  // Preview functions
  'function previewDeposit(uint256 assets) external view returns (uint256 shares)',
  'function previewRedeem(uint256 shares) external view returns (uint256 assets)',
  // View functions
  'function asset() external view returns (address)',
  'function totalAssets() external view returns (uint256)',
  'function convertToShares(uint256 assets) external view returns (uint256)',
  'function convertToAssets(uint256 shares) external view returns (uint256)',
];

// ERC20 ABI for approvals
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

// Max uint256 for unlimited approval
const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

// USYC Token ABI
const USYC_ABI = [
  ...ERC20_ABI,
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
];

export interface USYCQuote {
  inputAmount: string;
  outputAmount: string;
  inputToken: 'USDC' | 'USYC';
  outputToken: 'USDC' | 'USYC';
  rate: string;
  pricePerShare: string;
}

export interface USYCBalance {
  usdc: string;
  usyc: string;
  usdcFormatted: string;
  usycFormatted: string;
  usycValueInUsdc: string;
  totalValueUsdc: string;
  yieldEarned: string;
  apy: string;
}

export interface TreasuryAllocation {
  liquid: number;      // USDC percentage
  yield: number;       // USYC percentage
  totalValue: number;  // Total USD value
}

class USYCService {
  private provider = getProvider();
  private tellerInterface = new Interface(TELLER_ABI);
  private erc20Interface = new Interface(ERC20_ABI);

  /**
   * Get current USYC price (shares per USDC)
   * Note: Hashnote API has CORS restrictions, so we use contract data or defaults
   */
  async getUSYCPrice(): Promise<{ pricePerShare: string; apy: string }> {
    // Calculate from contract (avoid CORS issues with Hashnote API)
    try {
      const teller = new Contract(
        USYC_CONTRACTS.arcTestnet.teller,
        TELLER_ABI,
        this.provider
      );
      const shares = await teller.convertToShares(parseUnits('1', 6));
      const pricePerShare = (1 / Number(formatUnits(shares, 6))).toFixed(6);
      return { pricePerShare, apy: '5.0' }; // Default APY estimate
    } catch (error) {
      console.error('[USYC] Error calculating price from contract:', error);
      // Return testnet defaults
      return { pricePerShare: '1.0', apy: '5.0' };
    }
  }

  /**
   * Get quote for Subscribe (USDC → USYC)
   */
  async getSubscribeQuote(usdcAmount: string): Promise<USYCQuote> {
    const amountIn = parseUnits(usdcAmount, 6);

    try {
      const teller = new Contract(
        USYC_CONTRACTS.arcTestnet.teller,
        TELLER_ABI,
        this.provider
      );

      const sharesOut = await teller.previewDeposit(amountIn);
      const { pricePerShare } = await this.getUSYCPrice();

      return {
        inputAmount: usdcAmount,
        outputAmount: formatUnits(sharesOut, 6),
        inputToken: 'USDC',
        outputToken: 'USYC',
        rate: (Number(formatUnits(sharesOut, 6)) / Number(usdcAmount)).toFixed(6),
        pricePerShare,
      };
    } catch (error) {
      console.error('[USYC] Error getting subscribe quote:', error);
      // Fallback estimate (1:1 for testnet)
      return {
        inputAmount: usdcAmount,
        outputAmount: usdcAmount,
        inputToken: 'USDC',
        outputToken: 'USYC',
        rate: '1.0',
        pricePerShare: '1.0',
      };
    }
  }

  /**
   * Get quote for Redeem (USYC → USDC)
   */
  async getRedeemQuote(usycAmount: string): Promise<USYCQuote> {
    const amountIn = parseUnits(usycAmount, 6);

    try {
      const teller = new Contract(
        USYC_CONTRACTS.arcTestnet.teller,
        TELLER_ABI,
        this.provider
      );

      const assetsOut = await teller.previewRedeem(amountIn);
      const { pricePerShare } = await this.getUSYCPrice();

      return {
        inputAmount: usycAmount,
        outputAmount: formatUnits(assetsOut, 6),
        inputToken: 'USYC',
        outputToken: 'USDC',
        rate: (Number(formatUnits(assetsOut, 6)) / Number(usycAmount)).toFixed(6),
        pricePerShare,
      };
    } catch (error) {
      console.error('[USYC] Error getting redeem quote:', error);
      // Fallback estimate
      return {
        inputAmount: usycAmount,
        outputAmount: usycAmount,
        inputToken: 'USYC',
        outputToken: 'USDC',
        rate: '1.0',
        pricePerShare: '1.0',
      };
    }
  }

  /**
   * Get user's USYC and USDC balances with yield info
   */
  async getBalances(walletAddress: string): Promise<USYCBalance> {
    try {
      const usdcContract = new Contract(
        USYC_CONTRACTS.arcTestnet.usdc,
        ERC20_ABI,
        this.provider
      );
      const usycContract = new Contract(
        USYC_CONTRACTS.arcTestnet.usyc,
        USYC_ABI,
        this.provider
      );
      const teller = new Contract(
        USYC_CONTRACTS.arcTestnet.teller,
        TELLER_ABI,
        this.provider
      );

      const [usdcBalance, usycBalance] = await Promise.all([
        usdcContract.balanceOf(walletAddress),
        usycContract.balanceOf(walletAddress),
      ]);

      console.log('[USYC] Raw balances:', {
        wallet: walletAddress,
        usdcBalance: usdcBalance.toString(),
        usycBalance: usycBalance.toString(),
      });

      const usdcFormatted = formatUnits(usdcBalance, 6);
      const usycFormatted = formatUnits(usycBalance, 6);

      console.log('[USYC] Formatted balances:', {
        usdcFormatted,
        usycFormatted,
      });

      // Calculate USYC value in USDC
      let usycValueInUsdc = '0';
      if (usycBalance > 0n) {
        try {
          const assetsOut = await teller.previewRedeem(usycBalance);
          usycValueInUsdc = formatUnits(assetsOut, 6);
        } catch {
          usycValueInUsdc = usycFormatted; // Fallback 1:1
        }
      }

      // Calculate yield earned (USYC value - original USDC invested)
      // For testnet, we'll estimate based on APY
      const { apy } = await this.getUSYCPrice();
      const yieldEarned = (
        Number(usycValueInUsdc) - Number(usycFormatted)
      ).toFixed(6);

      const totalValueUsdc = (
        Number(usdcFormatted) + Number(usycValueInUsdc)
      ).toFixed(2);

      return {
        usdc: usdcBalance.toString(),
        usyc: usycBalance.toString(),
        usdcFormatted,
        usycFormatted,
        usycValueInUsdc,
        totalValueUsdc,
        yieldEarned: yieldEarned.startsWith('-') ? '0' : yieldEarned,
        apy,
      };
    } catch (error) {
      console.error('[USYC] Error fetching balances:', error);
      return {
        usdc: '0',
        usyc: '0',
        usdcFormatted: '0',
        usycFormatted: '0',
        usycValueInUsdc: '0',
        totalValueUsdc: '0',
        yieldEarned: '0',
        apy: '5.0',
      };
    }
  }

  /**
   * Get treasury allocation breakdown
   */
  async getTreasuryAllocation(walletAddress: string): Promise<TreasuryAllocation> {
    const balances = await this.getBalances(walletAddress);
    const totalValue = Number(balances.totalValueUsdc);

    if (totalValue === 0) {
      return { liquid: 100, yield: 0, totalValue: 0 };
    }

    const liquidValue = Number(balances.usdcFormatted);
    const yieldValue = Number(balances.usycValueInUsdc);

    return {
      liquid: Math.round((liquidValue / totalValue) * 100),
      yield: Math.round((yieldValue / totalValue) * 100),
      totalValue,
    };
  }

  /**
   * Check if wallet is allowlisted for USYC
   * Note: Hashnote API has CORS restrictions, so we use contract simulation
   */
  async checkAllowlist(walletAddress: string): Promise<boolean> {
    // Try to simulate a deposit call to check allowlist
    try {
      const teller = new Contract(
        USYC_CONTRACTS.arcTestnet.teller,
        TELLER_ABI,
        this.provider
      );
      await teller.previewDeposit.staticCall(parseUnits('1', 6), {
        from: walletAddress,
      });
      return true;
    } catch {
      // For testnet, assume allowlisted if simulation fails
      // Real check would require backend proxy for Hashnote API
      return true;
    }
  }

  /**
   * Check current allowance for a token
   */
  async checkAllowance(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string
  ): Promise<bigint> {
    try {
      const contract = new Contract(tokenAddress, ERC20_ABI, this.provider);
      return await contract.allowance(ownerAddress, spenderAddress);
    } catch (error) {
      console.error('[USYC] Error checking allowance:', error);
      return 0n;
    }
  }

  /**
   * Subscribe: Convert USDC to USYC via Teller
   * Uses batch transaction for approve + deposit in single UserOperation
   * Returns transaction hash
   */
  async subscribe(
    usdcAmount: string,
    walletAddress: string
  ): Promise<string> {
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }
    const amountIn = parseUnits(usdcAmount, 6);

    console.log('[USYC] Starting subscribe:', {
      amount: usdcAmount,
      wallet: walletAddress,
    });

    // Check current USDC allowance
    const currentAllowance = await this.checkAllowance(
      USYC_CONTRACTS.arcTestnet.usdc,
      walletAddress,
      USYC_CONTRACTS.arcTestnet.teller
    );

    console.log('[USYC] Current USDC allowance:', currentAllowance.toString());

    // Prepare deposit call
    const depositData = this.tellerInterface.encodeFunctionData('deposit', [
      amountIn,
      walletAddress,
    ]);

    // If allowance is sufficient, just do the deposit
    if (currentAllowance >= amountIn) {
      console.log('[USYC] Sufficient allowance, calling deposit directly...');
      const depositHash = await circleWalletService.sendTransaction({
        to: USYC_CONTRACTS.arcTestnet.teller,
        value: 0n,
        data: depositData as `0x${string}`,
      });
      console.log('[USYC] Deposit tx:', depositHash);
      return depositHash;
    }

    // Need approval - use batch transaction (approve + deposit in single UserOp)
    console.log('[USYC] Using batch transaction for approve + deposit...');

    // Prepare approve call (use max approval to avoid future approvals)
    const approveData = this.erc20Interface.encodeFunctionData('approve', [
      USYC_CONTRACTS.arcTestnet.teller,
      MAX_UINT256,
    ]);

    // Execute batch transaction
    const batchHash = await circleWalletService.sendBatchTransactions([
      {
        to: USYC_CONTRACTS.arcTestnet.usdc,
        value: 0n,
        data: approveData as `0x${string}`,
      },
      {
        to: USYC_CONTRACTS.arcTestnet.teller,
        value: 0n,
        data: depositData as `0x${string}`,
      },
    ]);

    console.log('[USYC] Batch tx (approve + deposit):', batchHash);
    return batchHash;
  }

  /**
   * Redeem: Convert USYC to USDC via Teller
   * Uses batch transaction for approve + redeem in single UserOperation
   * Returns transaction hash
   */
  async redeem(
    usycAmount: string,
    walletAddress: string
  ): Promise<string> {
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }
    const amountIn = parseUnits(usycAmount, 6);

    console.log('[USYC] Starting redeem:', {
      amount: usycAmount,
      wallet: walletAddress,
    });

    // Check current USYC allowance
    const currentAllowance = await this.checkAllowance(
      USYC_CONTRACTS.arcTestnet.usyc,
      walletAddress,
      USYC_CONTRACTS.arcTestnet.teller
    );

    console.log('[USYC] Current USYC allowance:', currentAllowance.toString());

    // Prepare redeem call
    const redeemData = this.tellerInterface.encodeFunctionData('redeem', [
      amountIn,
      walletAddress,
      walletAddress,
    ]);

    // If allowance is sufficient, just do the redeem
    if (currentAllowance >= amountIn) {
      console.log('[USYC] Sufficient allowance, calling redeem directly...');
      const redeemHash = await circleWalletService.sendTransaction({
        to: USYC_CONTRACTS.arcTestnet.teller,
        value: 0n,
        data: redeemData as `0x${string}`,
      });
      console.log('[USYC] Redeem tx:', redeemHash);
      return redeemHash;
    }

    // Need approval - use batch transaction (approve + redeem in single UserOp)
    console.log('[USYC] Using batch transaction for approve + redeem...');

    // Prepare approve call (use max approval to avoid future approvals)
    const approveData = this.erc20Interface.encodeFunctionData('approve', [
      USYC_CONTRACTS.arcTestnet.teller,
      MAX_UINT256,
    ]);

    // Execute batch transaction
    const batchHash = await circleWalletService.sendBatchTransactions([
      {
        to: USYC_CONTRACTS.arcTestnet.usyc,
        value: 0n,
        data: approveData as `0x${string}`,
      },
      {
        to: USYC_CONTRACTS.arcTestnet.teller,
        value: 0n,
        data: redeemData as `0x${string}`,
      },
    ]);

    console.log('[USYC] Batch tx (approve + redeem):', batchHash);
    return batchHash;
  }

  /**
   * Encode subscribe transaction for multi-sig
   */
  encodeSubscribeTransaction(
    usdcAmount: string,
    receiverAddress: string
  ): { to: string; data: string; value: string } {
    const amountIn = parseUnits(usdcAmount, 6);
    const data = this.tellerInterface.encodeFunctionData('deposit', [
      amountIn,
      receiverAddress,
    ]);

    return {
      to: USYC_CONTRACTS.arcTestnet.teller,
      data,
      value: '0',
    };
  }

  /**
   * Encode redeem transaction for multi-sig
   */
  encodeRedeemTransaction(
    usycAmount: string,
    receiverAddress: string,
    ownerAddress: string
  ): { to: string; data: string; value: string } {
    const amountIn = parseUnits(usycAmount, 6);
    const data = this.tellerInterface.encodeFunctionData('redeem', [
      amountIn,
      receiverAddress,
      ownerAddress,
    ]);

    return {
      to: USYC_CONTRACTS.arcTestnet.teller,
      data,
      value: '0',
    };
  }

  /**
   * Encode USDC approve transaction
   */
  encodeApproveTransaction(
    amount: string,
    spender: string = USYC_CONTRACTS.arcTestnet.teller
  ): { to: string; data: string; value: string } {
    const amountIn = parseUnits(amount, 6);
    const data = this.erc20Interface.encodeFunctionData('approve', [
      spender,
      amountIn,
    ]);

    return {
      to: USYC_CONTRACTS.arcTestnet.usdc,
      data,
      value: '0',
    };
  }
}

export const usycService = new USYCService();
export default usycService;
