/**
 * Deploy PasskeyAccountFactory directly (not CREATE2) to test bytecode
 */

import { createWalletClient, createPublicClient, http, encodeAbiParameters, parseAbiParameters } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';
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

// ERC-4337 EntryPoint v0.6
const ENTRY_POINT_V06 = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

// Load artifact
const artifactsPath = join(__dirname, '..', 'hh-artifacts');
function loadArtifact(contractPath, name) {
  const path = join(artifactsPath, 'contracts', contractPath, `${name}.json`);
  const content = readFileSync(path, 'utf8');
  return JSON.parse(content);
}

async function main() {
  console.log('🚀 Direct Factory Deployment Test\n');

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
  console.log('📍 Deployer:', account.address);
  console.log('💰 Balance:', (Number(balance) / 1e18).toFixed(4), 'ETH\n');

  const factory = loadArtifact('PasskeyAccount.sol', 'PasskeyAccountFactory');

  console.log('📦 Deploying PasskeyAccountFactory directly...');

  try {
    const hash = await walletClient.deployContract({
      abi: factory.abi,
      bytecode: factory.bytecode,
      args: [ENTRY_POINT_V06],
    });

    console.log('   Tx hash:', hash);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('   Status:', receipt.status);
    console.log('   Contract address:', receipt.contractAddress);

    if (receipt.status === 'success') {
      console.log(`\n✅ Factory deployed at: ${receipt.contractAddress}`);
    }
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    if (error.cause) {
      console.error('   Cause:', error.cause);
    }
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
