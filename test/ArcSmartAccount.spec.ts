import chai from 'chai';
import hardhat from 'hardhat';
import { AbiCoder, keccak256 } from 'ethers';

const { expect } = chai;
const { ethers, network } = hardhat;

const abiCoder = new AbiCoder();

type UserOperation = {
  sender: string;
  nonce: bigint;
  initCode: string;
  callData: string;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: string;
  signature: string;
};

const hashBytes = (value: string) =>
  keccak256(value === '0x' || value === '' ? new Uint8Array() : value);

const packUserOp = (op: UserOperation) =>
  abiCoder.encode(
    [
      'address',
      'uint256',
      'bytes32',
      'bytes32',
      'uint256',
      'uint256',
      'uint256',
      'uint256',
      'uint256',
      'bytes32',
    ],
    [
      op.sender,
      op.nonce,
      hashBytes(op.initCode),
      hashBytes(op.callData),
      op.callGasLimit,
      op.verificationGasLimit,
      op.preVerificationGas,
      op.maxFeePerGas,
      op.maxPriorityFeePerGas,
      hashBytes(op.paymasterAndData),
    ],
  );

const getUserOpHash = (op: UserOperation, entryPoint: string, chainId: bigint) =>
  keccak256(
    abiCoder.encode(
      ['bytes32', 'address', 'uint256'],
      [keccak256(packUserOp(op)), entryPoint, chainId],
    ),
  );

describe('ArcSmartAccount.validateUserOp', () => {
  const ZERO_SIG = '0x';

  async function setup() {
    const [deployer, entryPointSigner] = await ethers.getSigners();
    const provider = deployer.provider!;

    const ownerWallet = ethers.Wallet.createRandom().connect(provider);
    const sessionWallet = ethers.Wallet.createRandom().connect(provider);

    await deployer.sendTransaction({ to: ownerWallet.address, value: ethers.parseEther('10') });
    await deployer.sendTransaction({ to: sessionWallet.address, value: ethers.parseEther('10') });

    const ArcSmartAccount = await ethers.getContractFactory('ArcSmartAccount', deployer);
    const smartAccount = await ArcSmartAccount.deploy(
      await entryPointSigner.getAddress(),
      ownerWallet.address,
    );
    await smartAccount.waitForDeployment();

    return {
      deployer,
      entryPointSigner,
      smartAccount,
      ownerWallet,
      sessionWallet,
      provider,
    };
  }

  const baseUserOp = (sender: string, nonce: bigint): UserOperation => ({
    sender,
    nonce,
    initCode: '0x',
    callData: '0x',
    callGasLimit: 100_000n,
    verificationGasLimit: 200_000n,
    preVerificationGas: 50_000n,
    maxFeePerGas: ethers.parseUnits('1', 9),
    maxPriorityFeePerGas: ethers.parseUnits('1', 9),
    paymasterAndData: '0x',
    signature: ZERO_SIG,
  });

  it('accepts owner-signed user operation and increments nonce', async () => {
    const { smartAccount, ownerWallet, entryPointSigner } = await setup();
    const chainId = (await smartAccount.runner!.provider!.getNetwork()).chainId;
    const entryPointAddress = await entryPointSigner.getAddress();

    const nonce = await smartAccount.getUserOpNonce();
    const userOp: UserOperation = baseUserOp(
      await smartAccount.getAddress(),
      nonce,
    );

    const userOpHash = getUserOpHash(userOp, entryPointAddress, chainId);
    userOp.signature = ownerWallet.signingKey.sign(userOpHash).serialized;

    await expect(
      smartAccount.connect(entryPointSigner).validateUserOp(userOp, userOpHash, 0),
    ).to.not.be.reverted;

    expect(await smartAccount.getUserOpNonce()).to.equal(nonce + 1n);
  });

  it('rejects calls from non-entrypoint', async () => {
    const { smartAccount, ownerWallet, deployer, entryPointSigner } = await setup();
    const chainId = (await smartAccount.runner!.provider!.getNetwork()).chainId;
    const entryPointAddress = await entryPointSigner.getAddress();

    const nonce = await smartAccount.getUserOpNonce();
    const userOp: UserOperation = baseUserOp(
      await smartAccount.getAddress(),
      nonce,
    );
    const userOpHash = getUserOpHash(userOp, entryPointAddress, chainId);
    userOp.signature = ownerWallet.signingKey.sign(userOpHash).serialized;

    await expect(
      smartAccount.connect(deployer).validateUserOp(userOp, userOpHash, 0),
    ).to.be.revertedWithCustomError(smartAccount, 'InvalidCaller');
  });

  it('allows authorised session key signatures', async () => {
    const { smartAccount, ownerWallet, sessionWallet, entryPointSigner } = await setup();
    const expiry = Math.floor(Date.now() / 1000) + 600;
    await smartAccount
      .connect(ownerWallet)
      .authorizeSessionKey(sessionWallet.address, BigInt(expiry));

    const chainId = (await smartAccount.runner!.provider!.getNetwork()).chainId;
    const entryPointAddress = await entryPointSigner.getAddress();
    const nonce = await smartAccount.getUserOpNonce();
    const userOp: UserOperation = baseUserOp(await smartAccount.getAddress(), nonce);
    const userOpHash = getUserOpHash(userOp, entryPointAddress, chainId);
    userOp.signature = sessionWallet.signingKey.sign(userOpHash).serialized;

    await expect(
      smartAccount.connect(entryPointSigner).validateUserOp(userOp, userOpHash, 0),
    ).to.not.be.reverted;
  });

  it('rejects expired session keys', async () => {
    const { smartAccount, ownerWallet, sessionWallet, entryPointSigner } = await setup();
    const now = Math.floor(Date.now() / 1000);
    await smartAccount
      .connect(ownerWallet)
      .authorizeSessionKey(sessionWallet.address, BigInt(now + 1));

    await network.provider.send('evm_increaseTime', [120]);
    await network.provider.send('evm_mine');

    const chainId = (await smartAccount.runner!.provider!.getNetwork()).chainId;
    const entryPointAddress = await entryPointSigner.getAddress();
    const nonce = await smartAccount.getUserOpNonce();
    const userOp: UserOperation = baseUserOp(await smartAccount.getAddress(), nonce);
    const userOpHash = getUserOpHash(userOp, entryPointAddress, chainId);
    userOp.signature = sessionWallet.signingKey.sign(userOpHash).serialized;

    await expect(
      smartAccount.connect(entryPointSigner).validateUserOp(userOp, userOpHash, 0),
    ).to.be.revertedWithCustomError(smartAccount, 'SessionKeyExpired');
  });

  it('transfers missing funds to entry point', async () => {
    const { smartAccount, ownerWallet, entryPointSigner } = await setup();
    const entryPointAddress = await entryPointSigner.getAddress();
    const chainId = (await smartAccount.runner!.provider!.getNetwork()).chainId;

    await ownerWallet.sendTransaction({
      to: await smartAccount.getAddress(),
      value: ethers.parseEther('1'),
    });

    const nonce = await smartAccount.getUserOpNonce();
    const userOp: UserOperation = baseUserOp(await smartAccount.getAddress(), nonce);
    const userOpHash = getUserOpHash(userOp, entryPointAddress, chainId);
    userOp.signature = ownerWallet.signingKey.sign(userOpHash).serialized;

    const before = await entryPointSigner.provider!.getBalance(entryPointAddress);

    const missingFunds = ethers.parseEther('0.1');
    const tx = await smartAccount
      .connect(entryPointSigner)
      .validateUserOp(userOp, userOpHash, missingFunds);
    const receipt = await tx.wait();
    const gasPrice = receipt.gasPrice ?? tx.gasPrice ?? 0n;
    const gasCost = receipt.gasUsed * gasPrice;

    const after = await entryPointSigner.provider!.getBalance(entryPointAddress);
    expect(after + gasCost - before).to.equal(missingFunds);
  });
});
