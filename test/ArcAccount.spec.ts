import chai from 'chai';
import hardhat from 'hardhat';
import { AbiCoder, keccak256, Wallet, solidityPackedKeccak256 } from 'ethers';

const { expect } = chai;
const { ethers, network } = hardhat;

const abiCoder = new AbiCoder();

/**
 * WebAuthn P256 Mock for Testing
 * Simulates WebAuthn authenticator behavior for smart contract testing
 */
class WebAuthnMock {
  private privateKey: bigint;
  public publicKeyX: bigint;
  public publicKeyY: bigint;

  constructor() {
    // Generate mock P256 key pair
    // In real implementation, this would be actual P256 curve operations
    this.privateKey = BigInt('0x' + Buffer.from(ethers.randomBytes(32)).toString('hex'));
    // Mock public key coordinates (in real P256, these would be derived from private key)
    this.publicKeyX = BigInt('0x' + Buffer.from(ethers.randomBytes(32)).toString('hex'));
    this.publicKeyY = BigInt('0x' + Buffer.from(ethers.randomBytes(32)).toString('hex'));
  }

  /**
   * Compute key hash from public key coordinates
   */
  getKeyHash(): string {
    return solidityPackedKeccak256(
      ['uint256', 'uint256'],
      [this.publicKeyX, this.publicKeyY]
    );
  }

  /**
   * Generate mock authenticator data
   * - rpIdHash: 32 bytes (SHA-256 of relying party ID)
   * - flags: 1 byte (bit 0 = UP, bit 2 = UV, bit 6 = AT, bit 7 = ED)
   * - signCount: 4 bytes (big-endian)
   */
  generateAuthenticatorData(flags = 0x01): string {
    // rpIdHash (mock)
    const rpIdHash = ethers.sha256(ethers.toUtf8Bytes('arcwallet.network'));
    // flags (User Present = 0x01)
    const flagsByte = ethers.toBeHex(flags, 1);
    // signCount (4 bytes, mock value)
    const signCount = ethers.toBeHex(1, 4);

    return rpIdHash + flagsByte.slice(2) + signCount.slice(2);
  }

  /**
   * Generate mock clientDataJSON
   */
  generateClientDataJSON(challenge: string): string {
    const clientData = {
      type: 'webauthn.get',
      challenge: Buffer.from(challenge.slice(2), 'hex').toString('base64url'),
      origin: 'https://arcwallet.network',
      crossOrigin: false,
    };
    return ethers.hexlify(ethers.toUtf8Bytes(JSON.stringify(clientData)));
  }

  /**
   * Sign a challenge (mock WebAuthn signature)
   * Returns encoded signature for smart contract verification
   */
  sign(challenge: string): {
    authenticatorData: string;
    clientDataJSON: string;
    r: bigint;
    s: bigint;
    signature: string;
  } {
    const authenticatorData = this.generateAuthenticatorData();
    const clientDataJSON = this.generateClientDataJSON(challenge);

    // Mock r and s values (in real P256, these would be actual signature components)
    const r = BigInt('0x' + Buffer.from(ethers.randomBytes(32)).toString('hex'));
    const s = BigInt('0x' + Buffer.from(ethers.randomBytes(32)).toString('hex'));

    // Encode signature for contract
    const signature = abiCoder.encode(
      ['bytes', 'bytes', 'uint256', 'uint256'],
      [authenticatorData, clientDataJSON, r, s]
    );

    return {
      authenticatorData,
      clientDataJSON,
      r,
      s,
      signature,
    };
  }
}

/**
 * Pack UserOperation for hashing (ERC-4337 v0.7 format)
 */
type PackedUserOperation = {
  sender: string;
  nonce: bigint;
  initCode: string;
  callData: string;
  accountGasLimits: string; // bytes32: callGasLimit (16 bytes) || verificationGasLimit (16 bytes)
  preVerificationGas: bigint;
  gasFees: string; // bytes32: maxPriorityFeePerGas (16 bytes) || maxFeePerGas (16 bytes)
  paymasterAndData: string;
  signature: string;
};

const packUserOpV07 = (op: PackedUserOperation): string => {
  return abiCoder.encode(
    [
      'address', // sender
      'uint256', // nonce
      'bytes32', // initCode hash
      'bytes32', // callData hash
      'bytes32', // accountGasLimits
      'uint256', // preVerificationGas
      'bytes32', // gasFees
      'bytes32', // paymasterAndData hash
    ],
    [
      op.sender,
      op.nonce,
      keccak256(op.initCode || '0x'),
      keccak256(op.callData || '0x'),
      op.accountGasLimits,
      op.preVerificationGas,
      op.gasFees,
      keccak256(op.paymasterAndData || '0x'),
    ]
  );
};

const getUserOpHashV07 = (
  op: PackedUserOperation,
  entryPoint: string,
  chainId: bigint
): string => {
  return keccak256(
    abiCoder.encode(
      ['bytes32', 'address', 'uint256'],
      [keccak256(packUserOpV07(op)), entryPoint, chainId]
    )
  );
};

describe('ArcAccount - Multi-Key Support', () => {
  const KEY_TYPE_ECDSA = 1;
  const KEY_TYPE_WEBAUTHN = 2;

  async function deployFixture() {
    const [deployer, entryPointSigner] = await ethers.getSigners();
    const provider = deployer.provider!;

    // Create wallets
    const ownerWallet = Wallet.createRandom().connect(provider);
    const secondaryWallet = Wallet.createRandom().connect(provider);

    // Fund wallets
    await deployer.sendTransaction({
      to: ownerWallet.address,
      value: ethers.parseEther('10'),
    });
    await deployer.sendTransaction({
      to: secondaryWallet.address,
      value: ethers.parseEther('10'),
    });

    // Deploy EntryPoint mock
    const entryPointAddress = await entryPointSigner.getAddress();

    // Deploy ArcAccountFactory
    const ArcAccountFactory = await ethers.getContractFactory('ArcAccountFactory', deployer);
    const factory = await ArcAccountFactory.deploy(entryPointAddress);
    await factory.waitForDeployment();

    // Create initial signing key hash (ECDSA)
    const initialKeyHash = keccak256(
      abiCoder.encode(['address'], [ownerWallet.address])
    );

    // Deploy account through factory
    const salt = 0n;
    await factory.createAccount(initialKeyHash, KEY_TYPE_ECDSA, 'Primary Device', salt);
    const accountAddress = await factory.getAddress(initialKeyHash, KEY_TYPE_ECDSA, 'Primary Device', salt);

    const ArcAccount = await ethers.getContractFactory('ArcAccount', deployer);
    const account = ArcAccount.attach(accountAddress);

    // Fund the smart account
    await deployer.sendTransaction({
      to: accountAddress,
      value: ethers.parseEther('5'),
    });

    return {
      deployer,
      entryPointSigner,
      factory,
      account,
      ownerWallet,
      secondaryWallet,
      initialKeyHash,
      provider,
    };
  }

  describe('Initialization', () => {
    it('should initialize with primary signing key', async () => {
      const { account, initialKeyHash } = await deployFixture();

      expect(await account.isValidSigner(initialKeyHash)).to.be.true;
      expect(await account.activeKeyCount()).to.equal(1);
    });

    it('should return correct signing key details', async () => {
      const { account, initialKeyHash } = await deployFixture();

      const [keyHashes, keyTypes, isActive, , deviceNames] = await account.getSigningKeys();

      expect(keyHashes[0]).to.equal(initialKeyHash);
      expect(keyTypes[0]).to.equal(KEY_TYPE_ECDSA);
      expect(isActive[0]).to.be.true;
      expect(deviceNames[0]).to.equal('Primary Device');
    });
  });

  describe('Key Management', () => {
    it('should add a new ECDSA signing key', async () => {
      const { account, secondaryWallet, entryPointSigner } = await deployFixture();

      const newKeyHash = keccak256(
        abiCoder.encode(['address'], [secondaryWallet.address])
      );

      // Add key (simulating EntryPoint call)
      await account.connect(entryPointSigner).addSigningKey(
        newKeyHash,
        KEY_TYPE_ECDSA,
        'Secondary Device'
      );

      expect(await account.isValidSigner(newKeyHash)).to.be.true;
      expect(await account.activeKeyCount()).to.equal(2);
    });

    it('should add a WebAuthn (P256) signing key', async () => {
      const { account, entryPointSigner } = await deployFixture();

      const webAuthnMock = new WebAuthnMock();
      const webAuthnKeyHash = webAuthnMock.getKeyHash();

      await account.connect(entryPointSigner).addSigningKey(
        webAuthnKeyHash,
        KEY_TYPE_WEBAUTHN,
        'Passkey Device'
      );

      expect(await account.isValidSigner(webAuthnKeyHash)).to.be.true;

      const [, keyTypes] = await account.getSigningKeys();
      expect(keyTypes[1]).to.equal(KEY_TYPE_WEBAUTHN);
    });

    it('should remove a signing key', async () => {
      const { account, secondaryWallet, entryPointSigner } = await deployFixture();

      // Add a second key first
      const newKeyHash = keccak256(
        abiCoder.encode(['address'], [secondaryWallet.address])
      );

      await account.connect(entryPointSigner).addSigningKey(
        newKeyHash,
        KEY_TYPE_ECDSA,
        'To Be Removed'
      );

      expect(await account.activeKeyCount()).to.equal(2);

      // Remove the key
      await account.connect(entryPointSigner).removeSigningKey(newKeyHash);

      expect(await account.isValidSigner(newKeyHash)).to.be.false;
      expect(await account.activeKeyCount()).to.equal(1);
    });

    it('should not allow removing the last key', async () => {
      const { account, initialKeyHash, entryPointSigner } = await deployFixture();

      await expect(
        account.connect(entryPointSigner).removeSigningKey(initialKeyHash)
      ).to.be.revertedWithCustomError(account, 'CannotRemoveLastKey');
    });

    it('should reject duplicate key addition', async () => {
      const { account, initialKeyHash, entryPointSigner } = await deployFixture();

      await expect(
        account.connect(entryPointSigner).addSigningKey(
          initialKeyHash,
          KEY_TYPE_ECDSA,
          'Duplicate'
        )
      ).to.be.revertedWithCustomError(account, 'KeyAlreadyExists');
    });

    it('should reject invalid key types', async () => {
      const { account, entryPointSigner } = await deployFixture();

      const randomKeyHash = keccak256(ethers.randomBytes(32));

      await expect(
        account.connect(entryPointSigner).addSigningKey(
          randomKeyHash,
          3, // Invalid key type
          'Invalid'
        )
      ).to.be.revertedWithCustomError(account, 'InvalidKeyType');
    });
  });

  describe('Access Control', () => {
    it('should reject key management from unauthorized callers', async () => {
      const { account, deployer } = await deployFixture();

      const randomKeyHash = keccak256(ethers.randomBytes(32));

      await expect(
        account.connect(deployer).addSigningKey(
          randomKeyHash,
          KEY_TYPE_ECDSA,
          'Unauthorized'
        )
      ).to.be.revertedWithCustomError(account, 'OnlyEntryPointOrSelf');
    });
  });

  describe('Execution', () => {
    it('should execute a transaction', async () => {
      const { account, entryPointSigner, deployer } = await deployFixture();

      const recipient = Wallet.createRandom().address;
      const amount = ethers.parseEther('0.1');

      const balanceBefore = await deployer.provider!.getBalance(recipient);

      await account.connect(entryPointSigner).execute(
        recipient,
        amount,
        '0x'
      );

      const balanceAfter = await deployer.provider!.getBalance(recipient);
      expect(balanceAfter - balanceBefore).to.equal(amount);
    });

    it('should execute a batch of transactions', async () => {
      const { account, entryPointSigner, deployer } = await deployFixture();

      const recipients = [
        Wallet.createRandom().address,
        Wallet.createRandom().address,
      ];
      const amounts = [
        ethers.parseEther('0.1'),
        ethers.parseEther('0.2'),
      ];

      await account.connect(entryPointSigner).executeBatch(
        recipients,
        amounts,
        ['0x', '0x']
      );

      expect(await deployer.provider!.getBalance(recipients[0])).to.equal(amounts[0]);
      expect(await deployer.provider!.getBalance(recipients[1])).to.equal(amounts[1]);
    });
  });

  describe('WebAuthn Mock', () => {
    it('should generate valid authenticator data', () => {
      const mock = new WebAuthnMock();
      const authData = mock.generateAuthenticatorData();

      // Should be at least 37 bytes (rpIdHash[32] + flags[1] + signCount[4])
      expect(ethers.dataLength(authData)).to.be.gte(37);

      // Check User Present flag is set
      const flags = parseInt(authData.slice(66, 68), 16);
      expect(flags & 0x01).to.equal(0x01);
    });

    it('should generate valid clientDataJSON', () => {
      const mock = new WebAuthnMock();
      const challenge = keccak256(ethers.toUtf8Bytes('test challenge'));
      const clientDataJSON = mock.generateClientDataJSON(challenge);

      const decoded = JSON.parse(
        Buffer.from(clientDataJSON.slice(2), 'hex').toString('utf8')
      );

      expect(decoded.type).to.equal('webauthn.get');
      expect(decoded.origin).to.equal('https://arcwallet.network');
    });

    it('should generate consistent key hash', () => {
      const mock = new WebAuthnMock();
      const hash1 = mock.getKeyHash();
      const hash2 = mock.getKeyHash();

      expect(hash1).to.equal(hash2);
    });

    it('should produce valid signature structure', () => {
      const mock = new WebAuthnMock();
      const challenge = keccak256(ethers.toUtf8Bytes('test challenge'));
      const result = mock.sign(challenge);

      expect(result.authenticatorData).to.match(/^0x[a-fA-F0-9]+$/);
      expect(result.clientDataJSON).to.match(/^0x[a-fA-F0-9]+$/);
      expect(result.r).to.be.gt(0n);
      expect(result.s).to.be.gt(0n);
      expect(result.signature).to.match(/^0x[a-fA-F0-9]+$/);
    });
  });
});

describe('P256Verifier', () => {
  async function deployVerifier() {
    const [deployer] = await ethers.getSigners();

    const P256Verifier = await ethers.getContractFactory('P256Verifier', deployer);
    const verifier = await P256Verifier.deploy();
    await verifier.waitForDeployment();

    return { verifier };
  }

  it('should compute key hash correctly', async () => {
    const { verifier } = await deployVerifier();

    const x = BigInt('0x' + Buffer.from(ethers.randomBytes(32)).toString('hex'));
    const y = BigInt('0x' + Buffer.from(ethers.randomBytes(32)).toString('hex'));

    const contractHash = await verifier.computeKeyHash(x, y);
    const expectedHash = solidityPackedKeccak256(['uint256', 'uint256'], [x, y]);

    expect(contractHash).to.equal(expectedHash);
  });
});
