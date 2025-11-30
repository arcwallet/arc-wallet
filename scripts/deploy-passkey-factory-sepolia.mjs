/**
 * Deploy PasskeyAccountFactory to Sepolia
 * This is the factory that uses getAddress(x, y, salt) interface
 */

import { createWalletClient, createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env manually
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

// Load compiled contract artifacts
const artifactsPath = join(__dirname, '..', 'hh-artifacts');

function loadArtifact(contractPath, name) {
  const path = join(artifactsPath, 'contracts', contractPath, `${name}.json`);
  const content = readFileSync(path, 'utf8');
  return JSON.parse(content);
}

async function main() {
  console.log('🚀 Starting PasskeyAccountFactory deployment to Sepolia...\n');

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log('📍 Deployer address:', account.address);
  console.log('💰 Deployer balance:', (Number(balance) / 1e18).toFixed(4), 'ETH\n');

  if (balance === 0n) {
    throw new Error('Deployer has no funds! Please fund the deployer address.');
  }

  // Sepolia EntryPoint address (ERC-4337 v0.6)
  const ENTRY_POINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
  console.log('📝 Using EntryPoint v0.6:', ENTRY_POINT_ADDRESS);

  // Check if EntryPoint exists
  const entryPointCode = await publicClient.getCode({ address: ENTRY_POINT_ADDRESS });
  if (!entryPointCode || entryPointCode === '0x') {
    throw new Error('EntryPoint not found at v0.6 address on Sepolia!');
  }
  console.log('✅ EntryPoint found\n');

  // Load artifacts
  const PasskeyAccountFactoryArtifact = loadArtifact('PasskeyAccount.sol', 'PasskeyAccountFactory');

  // Deploy PasskeyAccountFactory
  console.log('📦 Deploying PasskeyAccountFactory...');
  const factoryHash = await walletClient.deployContract({
    abi: PasskeyAccountFactoryArtifact.abi,
    bytecode: PasskeyAccountFactoryArtifact.bytecode,
    args: [ENTRY_POINT_ADDRESS],
  });
  console.log('   Transaction hash:', factoryHash);

  const factoryReceipt = await publicClient.waitForTransactionReceipt({ hash: factoryHash });
  const factoryAddress = factoryReceipt.contractAddress;
  console.log('✅ PasskeyAccountFactory deployed to:', factoryAddress);

  // Verify by calling getAddress with test data
  console.log('\n📋 Verifying deployment...');

  // User's passkey data
  const PUBLIC_KEY_X = '0x1e0aeb671b3f60fdf21dfd69e7e561a1d50d9e078088129a819ac9984cc35c45';
  const PUBLIC_KEY_Y = '0x43950158bd8e8d371ade62279085fde4d0e99e510c55fb2078bd2475b6264b54';
  const EXPECTED_ADDRESS = '0xE6Dc064dfE85525Bc24Df0Ec415117c9b30dd719';

  const calculatedAddress = await publicClient.readContract({
    address: factoryAddress,
    abi: PasskeyAccountFactoryArtifact.abi,
    functionName: 'getAddress',
    args: [BigInt(PUBLIC_KEY_X), BigInt(PUBLIC_KEY_Y), 0n],
  });

  console.log('   Expected Address:', EXPECTED_ADDRESS);
  console.log('   Calculated Address:', calculatedAddress);

  if (calculatedAddress.toLowerCase() === EXPECTED_ADDRESS.toLowerCase()) {
    console.log('✅ Address matches! Same wallet address on both chains.');
  } else {
    console.log('⚠️  Address does not match. Factory bytecode may be different.');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 DEPLOYMENT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Network:              Sepolia (Chain ID: 11155111)`);
  console.log(`EntryPoint:           ${ENTRY_POINT_ADDRESS}`);
  console.log(`PasskeyAccountFactory: ${factoryAddress}`);
  console.log('='.repeat(60));

  // Save addresses to file
  const deploymentInfo = {
    network: 'sepolia',
    chainId: 11155111,
    timestamp: new Date().toISOString(),
    deployer: account.address,
    contracts: {
      entryPoint: ENTRY_POINT_ADDRESS,
      passkeyAccountFactory: factoryAddress,
    },
  };

  const deploymentsDir = join(__dirname, '..', 'deployments');
  if (!existsSync(deploymentsDir)) {
    mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentPath = join(deploymentsDir, 'sepolia-passkey.json');
  writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n💾 Deployment info saved to: ${deploymentPath}`);

  console.log('\n⚠️  IMPORTANT: Update your .env file with:');
  console.log(`VITE_SEPOLIA_PASSKEY_FACTORY_ADDRESS=${factoryAddress}`);

  console.log('\n✨ Deployment complete!');
}

main().catch(error => {
  console.error('❌ Deployment failed:', error);
  process.exit(1);
});
