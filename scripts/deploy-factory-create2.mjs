/**
 * Deploy PasskeyAccountFactory to Sepolia using CREATE2 (Deterministic Deployment Proxy)
 *
 * This allows deploying the factory at the SAME address across different chains.
 * The CREATE2 address is: keccak256(0xff, deployer, salt, keccak256(init_code))[12:]
 *
 * We use the Deterministic Deployment Proxy at 0x4e59b44847b379578588920cA78FbF26c0B4956C
 */

import { createWalletClient, createPublicClient, http, keccak256, concat, encodeAbiParameters, parseAbiParameters, getAddress } from 'viem';
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

// Deterministic Deployment Proxy (available on most chains)
const CREATE2_DEPLOYER = '0x4e59b44847b379578588920cA78FbF26c0B4956C';

// Target factory address (from Arc Testnet)
const TARGET_FACTORY_ADDRESS = '0x4C16f269dE57B846309a8Eb3591ddb394aBba488';

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
 * Try different salts to find one that produces the target address
 */
function findSaltForAddress(deployer, initCode, targetAddress, maxAttempts = 100000) {
  console.log('🔍 Searching for salt that produces target address...');
  console.log('   Target:', targetAddress);

  for (let i = 0; i < maxAttempts; i++) {
    const salt = '0x' + i.toString(16).padStart(64, '0');
    const address = computeCreate2Address(deployer, salt, initCode);

    if (i % 10000 === 0) {
      console.log(`   Tried ${i} salts...`);
    }

    if (address.toLowerCase() === targetAddress.toLowerCase()) {
      console.log('✅ Found matching salt:', salt);
      return salt;
    }
  }

  return null;
}

async function main() {
  console.log('🚀 CREATE2 Factory Deployment Analysis\n');

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });

  // Check if CREATE2 deployer exists on Sepolia
  const deployerCode = await publicClient.getCode({ address: CREATE2_DEPLOYER });
  if (!deployerCode || deployerCode === '0x') {
    throw new Error('CREATE2 Deterministic Deployment Proxy not found on Sepolia');
  }
  console.log('✅ CREATE2 Deployer found on Sepolia');

  // Load artifacts
  const PasskeyAccountFactoryArtifact = loadArtifact('PasskeyAccount.sol', 'PasskeyAccountFactory');

  // EntryPoint v0.6 address (used on Arc)
  const ENTRY_POINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

  // Construct init code: bytecode + constructor args
  const constructorArgs = encodeAbiParameters(
    parseAbiParameters('address'),
    [ENTRY_POINT_ADDRESS]
  );
  const initCode = concat([PasskeyAccountFactoryArtifact.bytecode, constructorArgs]);

  console.log('\n📋 Init Code Info:');
  console.log('   Bytecode length:', PasskeyAccountFactoryArtifact.bytecode.length / 2 - 1, 'bytes');
  console.log('   Init code length:', initCode.length / 2 - 1, 'bytes');
  console.log('   Init code hash:', keccak256(initCode));

  // Try to find a salt that produces the target address
  // Note: This is computationally expensive and may not find a match
  // because the original deployment may not have used CREATE2

  console.log('\n⚠️  Note: If the original factory was deployed with regular CREATE (not CREATE2),');
  console.log('   we cannot reproduce the same address on another chain.');
  console.log('   We will try some common salts...\n');

  // Try common salts
  const commonSalts = [
    '0x0000000000000000000000000000000000000000000000000000000000000000',
    '0x0000000000000000000000000000000000000000000000000000000000000001',
  ];

  for (const salt of commonSalts) {
    const address = computeCreate2Address(CREATE2_DEPLOYER, salt, initCode);
    console.log(`Salt ${salt.slice(0, 10)}... => ${address}`);
    if (address.toLowerCase() === TARGET_FACTORY_ADDRESS.toLowerCase()) {
      console.log('✅ Found matching salt!');
    }
  }

  // Calculate what address we WOULD get with salt 0
  const saltZero = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const predictedAddress = computeCreate2Address(CREATE2_DEPLOYER, saltZero, initCode);

  console.log('\n📋 CREATE2 Deployment Preview:');
  console.log('   Salt (0):', saltZero);
  console.log('   Predicted Address:', predictedAddress);
  console.log('   Target Address:', TARGET_FACTORY_ADDRESS);
  console.log('   Match:', predictedAddress.toLowerCase() === TARGET_FACTORY_ADDRESS.toLowerCase());

  // If no match, let's just deploy with salt 0 and update the config
  console.log('\n🔄 Alternative approach:');
  console.log('   Deploy new factory at', predictedAddress);
  console.log('   Update VITE_SEPOLIA_PASSKEY_FACTORY_ADDRESS to this address');
  console.log('   This means Sepolia wallet address will differ from Arc wallet address');
  console.log('   But bridging can still work with address override.\n');

  // Ask if user wants to proceed
  console.log('To deploy at predicted address, run this script with --deploy flag');

  if (process.argv.includes('--deploy')) {
    console.log('\n📦 Deploying via CREATE2...');

    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
    });

    // CREATE2 deployer expects: salt (32 bytes) + init_code
    const deployData = concat([saltZero, initCode]);

    const hash = await walletClient.sendTransaction({
      to: CREATE2_DEPLOYER,
      data: deployData,
      gas: 5000000n,
    });

    console.log('   Transaction hash:', hash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('   Status:', receipt.status);

    if (receipt.status === 'success') {
      // Verify the contract was deployed at predicted address
      const deployedCode = await publicClient.getCode({ address: predictedAddress });
      if (deployedCode && deployedCode !== '0x') {
        console.log('✅ Factory deployed at:', predictedAddress);

        // Save deployment info
        const deploymentsDir = join(__dirname, '..', 'deployments');
        if (!existsSync(deploymentsDir)) {
          mkdirSync(deploymentsDir, { recursive: true });
        }

        const deploymentInfo = {
          network: 'sepolia',
          chainId: 11155111,
          timestamp: new Date().toISOString(),
          deployer: account.address,
          deployMethod: 'CREATE2',
          salt: saltZero,
          contracts: {
            entryPoint: ENTRY_POINT_ADDRESS,
            passkeyAccountFactory: predictedAddress,
          },
        };

        const deploymentPath = join(deploymentsDir, 'sepolia-create2.json');
        writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
        console.log('💾 Saved to:', deploymentPath);

        console.log('\n⚠️  Update .env:');
        console.log(`VITE_SEPOLIA_PASSKEY_FACTORY_ADDRESS=${predictedAddress}`);
      } else {
        console.log('❌ Contract not found at predicted address');
      }
    }
  }
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
