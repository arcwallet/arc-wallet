/**
 * Deploy ArcAccount + ArcAccountFactory to Arc Testnet
 * Uses viem for deployment (ESM compatible)
 */

import { createWalletClient, createPublicClient, http, defineChain } from 'viem';
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

// Arc Testnet chain definition
const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
});

// ERC-4337 EntryPoint v0.7
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

// Load artifacts
const artifactsPath = join(__dirname, '..', 'hh-artifacts');
function loadArtifact(contractPath, name) {
  const path = join(artifactsPath, 'contracts', contractPath, `${name}.json`);
  const content = readFileSync(path, 'utf8');
  return JSON.parse(content);
}

async function main() {
  console.log('🚀 ArcAccount Deployment to Arc Testnet\n');

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log('📍 Deployer:', account.address);
  console.log('💰 Balance:', (Number(balance) / 1e18).toFixed(6), 'ETH\n');

  if (balance === 0n) {
    throw new Error('Deployer has no funds! Please fund the deployer address.');
  }

  // Check EntryPoint
  const entryPointCode = await publicClient.getBytecode({ address: ENTRY_POINT_V07 });
  if (!entryPointCode || entryPointCode === '0x') {
    console.log('⚠️  Warning: EntryPoint not found at canonical address.');
    console.log('   Proceeding anyway...\n');
  } else {
    console.log('✅ EntryPoint found at:', ENTRY_POINT_V07, '\n');
  }

  // Deploy P256Verifier
  console.log('📦 Deploying P256Verifier...');
  const p256Artifact = loadArtifact('P256Verifier.sol', 'P256Verifier');

  const p256Hash = await walletClient.deployContract({
    abi: p256Artifact.abi,
    bytecode: p256Artifact.bytecode,
    args: [],
  });
  console.log('   Tx hash:', p256Hash);

  const p256Receipt = await publicClient.waitForTransactionReceipt({ hash: p256Hash });
  const p256Address = p256Receipt.contractAddress;
  console.log('✅ P256Verifier deployed to:', p256Address);

  // Deploy ArcAccountFactory
  console.log('\n📦 Deploying ArcAccountFactory...');
  const factoryArtifact = loadArtifact('ArcAccountFactory.sol', 'ArcAccountFactory');

  const factoryHash = await walletClient.deployContract({
    abi: factoryArtifact.abi,
    bytecode: factoryArtifact.bytecode,
    args: [ENTRY_POINT_V07],
  });
  console.log('   Tx hash:', factoryHash);

  const factoryReceipt = await publicClient.waitForTransactionReceipt({ hash: factoryHash });
  const factoryAddress = factoryReceipt.contractAddress;
  console.log('✅ ArcAccountFactory deployed to:', factoryAddress);

  // Get implementation address
  const implementationAddress = await publicClient.readContract({
    address: factoryAddress,
    abi: factoryArtifact.abi,
    functionName: 'accountImplementation',
  });
  console.log('✅ ArcAccount implementation:', implementationAddress);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 DEPLOYMENT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Network:              Arc Testnet (Chain ID: 5042002)`);
  console.log(`EntryPoint:           ${ENTRY_POINT_V07}`);
  console.log(`P256Verifier:         ${p256Address}`);
  console.log(`ArcAccountFactory:    ${factoryAddress}`);
  console.log(`ArcAccount (impl):    ${implementationAddress}`);
  console.log('='.repeat(60));

  // Save deployment info
  const deploymentInfo = {
    network: 'arcTestnet',
    chainId: 5042002,
    timestamp: new Date().toISOString(),
    deployer: account.address,
    contracts: {
      entryPoint: ENTRY_POINT_V07,
      p256Verifier: p256Address,
      arcAccountFactory: factoryAddress,
      arcAccountImplementation: implementationAddress,
    },
  };

  const deploymentsDir = join(__dirname, '..', 'deployments');
  if (!existsSync(deploymentsDir)) {
    mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentPath = join(deploymentsDir, 'arc-testnet-multisig.json');
  writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n💾 Deployment info saved to: ${deploymentPath}`);

  console.log('\n✨ Deployment complete!');
}

main().catch(error => {
  console.error('❌ Deployment failed:', error);
  process.exit(1);
});
