/**
 * Deploy PasskeyAccountFactory using CREATE2 for deterministic cross-chain addresses
 *
 * This script deploys the factory at the SAME address on multiple chains using
 * the Deterministic Deployment Proxy (0x4e59b44847b379578588920cA78FbF26c0B4956C)
 *
 * CREATE2 address formula: keccak256(0xff, deployer, salt, keccak256(initCode))[12:]
 * Same salt + same initCode = same address on all chains
 */

import { createWalletClient, createPublicClient, http, keccak256, concat, encodeAbiParameters, parseAbiParameters, getAddress } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env
const envPath = join(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const DEPLOYER_PRIVATE_KEY = env.DEPLOYER_PRIVATE_KEY;
if (!DEPLOYER_PRIVATE_KEY) {
  throw new Error('DEPLOYER_PRIVATE_KEY not found in .env');
}

// Deterministic Deployment Proxy - available on most EVM chains
const CREATE2_DEPLOYER = '0x4e59b44847b379578588920cA78FbF26c0B4956C';

// ERC-4337 EntryPoint v0.6 (canonical address on all chains)
const ENTRY_POINT_V06 = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

// Chain configurations
const CHAINS = {
  sepolia: {
    name: 'Sepolia',
    chainId: 11155111,
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
  },
  arcTestnet: {
    name: 'Arc Testnet',
    chainId: 5042002,
    rpcUrl: 'https://rpc.testnet.arc.network',
    explorerUrl: 'https://testnet.arcscan.io',
  },
};

// Salt for CREATE2 - using a unique identifier for Arc Wallet
// This salt must be the same on all chains to get the same address
// Salt MUST be exactly 32 bytes (64 hex characters)
const saltString = 'ArcWallet_PasskeyFactory_v1'; // Keep under 32 chars
const saltHex = Buffer.from(saltString).toString('hex').padEnd(64, '0');
const DEPLOYMENT_SALT = '0x' + saltHex.slice(0, 64); // Ensure exactly 32 bytes

// Load compiled contract artifacts
const artifactsPath = join(__dirname, '..', 'hh-artifacts');

function loadArtifact(contractPath, name) {
  const path = join(artifactsPath, 'contracts', contractPath, `${name}.json`);
  const content = readFileSync(path, 'utf8');
  return JSON.parse(content);
}

/**
 * Calculate CREATE2 address
 */
function computeCreate2Address(deployer, salt, initCode) {
  const initCodeHash = keccak256(initCode);
  const data = concat(['0xff', deployer, salt, initCodeHash]);
  const hash = keccak256(data);
  return getAddress('0x' + hash.slice(-40));
}

/**
 * Deploy factory to a specific chain
 */
async function deployToChain(chainKey, initCode, expectedAddress) {
  const chain = CHAINS[chainKey];
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 Deploying to ${chain.name} (Chain ID: ${chain.chainId})`);
  console.log('='.repeat(60));

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);

  // Create custom chain config for Arc Testnet
  const chainConfig = chainKey === 'arcTestnet' ? {
    id: chain.chainId,
    name: chain.name,
    nativeCurrency: { name: 'ARC', symbol: 'ARC', decimals: 18 },
    rpcUrls: { default: { http: [chain.rpcUrl] } },
  } : sepolia;

  const publicClient = createPublicClient({
    chain: chainConfig,
    transport: http(chain.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: chainConfig,
    transport: http(chain.rpcUrl),
  });

  // Check deployer balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`📍 Deployer: ${account.address}`);
  console.log(`💰 Balance: ${(Number(balance) / 1e18).toFixed(4)} ${chainKey === 'arcTestnet' ? 'ARC' : 'ETH'}`);

  if (balance === 0n) {
    console.log(`❌ No funds on ${chain.name}. Skipping...`);
    return null;
  }

  // Check if CREATE2 deployer exists
  const deployerCode = await publicClient.getCode({ address: CREATE2_DEPLOYER });
  if (!deployerCode || deployerCode === '0x') {
    console.log(`❌ CREATE2 Deployer not found on ${chain.name}. Skipping...`);
    return null;
  }
  console.log('✅ CREATE2 Deployer found');

  // Check if factory already deployed at expected address
  const existingCode = await publicClient.getCode({ address: expectedAddress });
  if (existingCode && existingCode !== '0x') {
    console.log(`✅ Factory already deployed at ${expectedAddress}`);
    return { address: expectedAddress, alreadyDeployed: true };
  }

  // Check if EntryPoint exists
  const entryPointCode = await publicClient.getCode({ address: ENTRY_POINT_V06 });
  if (!entryPointCode || entryPointCode === '0x') {
    console.log(`⚠️  Warning: EntryPoint v0.6 not found at ${ENTRY_POINT_V06}`);
    console.log('   The factory will be deployed but may not work for account creation.');
  } else {
    console.log('✅ EntryPoint v0.6 found');
  }

  // Deploy via CREATE2
  console.log('\n📤 Sending deployment transaction...');
  const deployData = concat([DEPLOYMENT_SALT, initCode]);

  try {
    // First, try to estimate gas properly
    let gasLimit = 5000000n;
    try {
      const estimated = await publicClient.estimateGas({
        account: account.address,
        to: CREATE2_DEPLOYER,
        data: deployData,
      });
      console.log(`   Estimated gas: ${estimated}`);
      // Add 50% buffer for safety
      gasLimit = (estimated * 150n) / 100n;
    } catch (estError) {
      console.log(`   Gas estimation failed: ${estError.message}`);
      console.log(`   Using default gas limit: ${gasLimit}`);
    }

    const hash = await walletClient.sendTransaction({
      to: CREATE2_DEPLOYER,
      data: deployData,
      gas: gasLimit,
    });
    console.log(`   Tx hash: ${hash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120000 });
    console.log(`   Status: ${receipt.status}`);
    console.log(`   Gas used: ${receipt.gasUsed}`);

    if (receipt.status === 'success') {
      // Verify deployment
      const deployedCode = await publicClient.getCode({ address: expectedAddress });
      if (deployedCode && deployedCode !== '0x') {
        console.log(`✅ Factory deployed at: ${expectedAddress}`);
        console.log(`   Explorer: ${chain.explorerUrl}/address/${expectedAddress}`);
        return { address: expectedAddress, txHash: hash, alreadyDeployed: false };
      } else {
        console.log(`❌ Deployment verification failed - no code at expected address`);
        return null;
      }
    } else {
      console.log(`❌ Transaction failed`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Deployment error:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 CREATE2 Multi-Chain Factory Deployment\n');
  console.log('This script deploys PasskeyAccountFactory at the SAME address');
  console.log('on multiple chains for cross-chain wallet compatibility.\n');

  // Load factory artifact
  const PasskeyAccountFactoryArtifact = loadArtifact('PasskeyAccount.sol', 'PasskeyAccountFactory');

  // Construct init code: bytecode + constructor args
  const constructorArgs = encodeAbiParameters(
    parseAbiParameters('address'),
    [ENTRY_POINT_V06]
  );
  const initCode = concat([PasskeyAccountFactoryArtifact.bytecode, constructorArgs]);

  console.log('📋 Deployment Configuration:');
  console.log(`   Salt: ${DEPLOYMENT_SALT.slice(0, 20)}...`);
  console.log(`   EntryPoint: ${ENTRY_POINT_V06}`);
  console.log(`   Init code hash: ${keccak256(initCode)}`);

  // Calculate expected address
  const expectedAddress = computeCreate2Address(CREATE2_DEPLOYER, DEPLOYMENT_SALT, initCode);
  console.log(`\n🎯 Expected Factory Address: ${expectedAddress}`);
  console.log('   (This will be the same on ALL chains)\n');

  // Deploy to each chain
  const results = {};
  const chainKeys = process.argv.includes('--sepolia-only') ? ['sepolia'] :
                    process.argv.includes('--arc-only') ? ['arcTestnet'] :
                    ['sepolia', 'arcTestnet'];

  for (const chainKey of chainKeys) {
    const result = await deployToChain(chainKey, initCode, expectedAddress);
    results[chainKey] = result;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 DEPLOYMENT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Factory Address: ${expectedAddress}`);
  console.log(`EntryPoint: ${ENTRY_POINT_V06}`);
  console.log(`Salt: ${DEPLOYMENT_SALT}`);
  console.log('');

  for (const [chainKey, result] of Object.entries(results)) {
    const chain = CHAINS[chainKey];
    if (result) {
      const status = result.alreadyDeployed ? '✅ Already deployed' : '✅ Deployed';
      console.log(`${chain.name}: ${status}`);
    } else {
      console.log(`${chain.name}: ❌ Failed or skipped`);
    }
  }

  // Save deployment info
  const deploymentsDir = join(__dirname, '..', 'deployments');
  if (!existsSync(deploymentsDir)) {
    mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentInfo = {
    factoryAddress: expectedAddress,
    entryPoint: ENTRY_POINT_V06,
    salt: DEPLOYMENT_SALT,
    initCodeHash: keccak256(initCode),
    deployMethod: 'CREATE2',
    create2Deployer: CREATE2_DEPLOYER,
    timestamp: new Date().toISOString(),
    chains: {},
  };

  for (const [chainKey, result] of Object.entries(results)) {
    const chain = CHAINS[chainKey];
    if (result) {
      deploymentInfo.chains[chainKey] = {
        name: chain.name,
        chainId: chain.chainId,
        address: result.address,
        txHash: result.txHash || null,
        alreadyDeployed: result.alreadyDeployed || false,
      };
    }
  }

  const deploymentPath = join(deploymentsDir, 'multichain-factory.json');
  writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n💾 Deployment info saved to: ${deploymentPath}`);

  // Output env update instructions
  console.log('\n⚠️  UPDATE YOUR .env FILE:');
  console.log(`VITE_PASSKEY_FACTORY_ADDRESS=${expectedAddress}`);
  console.log(`VITE_SEPOLIA_PASSKEY_FACTORY_ADDRESS=${expectedAddress}`);

  console.log('\n✨ Deployment complete!');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
