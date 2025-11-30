/**
 * Deploy ArcAccount smart contracts to Sepolia using viem
 */

import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
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

function loadArtifact(name) {
  const path = join(artifactsPath, 'contracts', `${name}.sol`, `${name}.json`);
  const content = readFileSync(path, 'utf8');
  return JSON.parse(content);
}

async function main() {
  console.log('🚀 Starting ArcAccount deployment to Sepolia...\n');

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

  // Sepolia EntryPoint address (ERC-4337 v0.7)
  const ENTRY_POINT_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
  console.log('📝 Using EntryPoint:', ENTRY_POINT_ADDRESS);

  // Check if EntryPoint exists
  const entryPointCode = await publicClient.getCode({ address: ENTRY_POINT_ADDRESS });
  if (!entryPointCode || entryPointCode === '0x') {
    throw new Error('EntryPoint not found at canonical address on Sepolia!');
  }
  console.log('✅ EntryPoint found at canonical address\n');

  // Load artifacts
  const P256VerifierArtifact = loadArtifact('P256Verifier');
  const ArcAccountFactoryArtifact = loadArtifact('ArcAccountFactory');

  // Deploy P256Verifier
  console.log('📦 Deploying P256Verifier...');
  const p256VerifierHash = await walletClient.deployContract({
    abi: P256VerifierArtifact.abi,
    bytecode: P256VerifierArtifact.bytecode,
  });
  console.log('   Transaction hash:', p256VerifierHash);

  const p256VerifierReceipt = await publicClient.waitForTransactionReceipt({ hash: p256VerifierHash });
  const p256VerifierAddress = p256VerifierReceipt.contractAddress;
  console.log('✅ P256Verifier deployed to:', p256VerifierAddress);

  // Deploy ArcAccountFactory
  console.log('\n📦 Deploying ArcAccountFactory...');
  const factoryHash = await walletClient.deployContract({
    abi: ArcAccountFactoryArtifact.abi,
    bytecode: ArcAccountFactoryArtifact.bytecode,
    args: [ENTRY_POINT_ADDRESS],
  });
  console.log('   Transaction hash:', factoryHash);

  const factoryReceipt = await publicClient.waitForTransactionReceipt({ hash: factoryHash });
  const factoryAddress = factoryReceipt.contractAddress;
  console.log('✅ ArcAccountFactory deployed to:', factoryAddress);

  // Get implementation address from factory
  const implementationAddress = await publicClient.readContract({
    address: factoryAddress,
    abi: ArcAccountFactoryArtifact.abi,
    functionName: 'accountImplementation',
  });
  console.log('✅ ArcAccount implementation:', implementationAddress);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 DEPLOYMENT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Network:              Sepolia (Chain ID: 11155111)`);
  console.log(`EntryPoint:           ${ENTRY_POINT_ADDRESS}`);
  console.log(`P256Verifier:         ${p256VerifierAddress}`);
  console.log(`ArcAccountFactory:    ${factoryAddress}`);
  console.log(`ArcAccount (impl):    ${implementationAddress}`);
  console.log('='.repeat(60));

  // Save addresses to file
  const deploymentInfo = {
    network: 'sepolia',
    chainId: 11155111,
    timestamp: new Date().toISOString(),
    deployer: account.address,
    contracts: {
      entryPoint: ENTRY_POINT_ADDRESS,
      p256Verifier: p256VerifierAddress,
      arcAccountFactory: factoryAddress,
      arcAccountImplementation: implementationAddress,
    },
  };

  const deploymentsDir = join(__dirname, '..', 'deployments');
  if (!existsSync(deploymentsDir)) {
    mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentPath = join(deploymentsDir, 'sepolia.json');
  writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n💾 Deployment info saved to: ${deploymentPath}`);

  console.log('\n⚠️  IMPORTANT: Update your .env file with:');
  console.log(`VITE_SEPOLIA_PASSKEY_FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`VITE_SEPOLIA_P256_VERIFIER_ADDRESS=${p256VerifierAddress}`);

  console.log('\n✨ Deployment complete!');
}

main().catch(error => {
  console.error('❌ Deployment failed:', error);
  process.exit(1);
});
