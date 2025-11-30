/**
 * Deploy PasskeyAccountFactory using CREATE2 for deterministic cross-chain addresses
 * Using Hardhat for better gas estimation and error handling
 */

import { ethers } from 'hardhat';

// Deterministic Deployment Proxy (available on most chains)
const CREATE2_DEPLOYER = '0x4e59b44847b379578588920cA78FbF26c0B4956C';

// ERC-4337 EntryPoint v0.6 (canonical address on all chains)
const ENTRY_POINT_V06 = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

// Salt for CREATE2 - using a unique identifier for Arc Wallet
const DEPLOYMENT_SALT = ethers.zeroPadValue(
  ethers.toUtf8Bytes('ArcWallet_PasskeyAccountFactory_v1'),
  32
);

function computeCreate2Address(deployer: string, salt: string, initCodeHash: string): string {
  const data = ethers.concat(['0xff', deployer, salt, initCodeHash]);
  const hash = ethers.keccak256(data);
  return ethers.getAddress('0x' + hash.slice(-40));
}

async function main() {
  console.log('🚀 CREATE2 Factory Deployment via Hardhat\n');

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log('📋 Configuration:');
  console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`   Deployer: ${deployer.address}`);
  console.log(`   Salt: ${DEPLOYMENT_SALT.slice(0, 20)}...`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`   Balance: ${ethers.formatEther(balance)} ETH\n`);

  // Check if CREATE2 deployer exists
  const deployerCode = await ethers.provider.getCode(CREATE2_DEPLOYER);
  if (deployerCode === '0x') {
    throw new Error('CREATE2 Deterministic Deployment Proxy not found on this network');
  }
  console.log('✅ CREATE2 Deployer found');

  // Check if EntryPoint exists
  const entryPointCode = await ethers.provider.getCode(ENTRY_POINT_V06);
  if (entryPointCode === '0x') {
    console.log('⚠️  Warning: EntryPoint v0.6 not found. Factory will deploy but accounts may not work.');
  } else {
    console.log('✅ EntryPoint v0.6 found');
  }

  // Get factory bytecode
  const PasskeyAccountFactory = await ethers.getContractFactory('PasskeyAccountFactory');
  const constructorArgs = ethers.AbiCoder.defaultAbiCoder().encode(['address'], [ENTRY_POINT_V06]);
  const initCode = ethers.concat([PasskeyAccountFactory.bytecode, constructorArgs]);
  const initCodeHash = ethers.keccak256(initCode);

  console.log(`\n📋 Init Code Info:`);
  console.log(`   Init code length: ${(initCode.length - 2) / 2} bytes`);
  console.log(`   Init code hash: ${initCodeHash}`);

  // Calculate expected address
  const expectedAddress = computeCreate2Address(CREATE2_DEPLOYER, DEPLOYMENT_SALT, initCodeHash);
  console.log(`\n🎯 Expected Factory Address: ${expectedAddress}`);

  // Check if already deployed
  const existingCode = await ethers.provider.getCode(expectedAddress);
  if (existingCode !== '0x') {
    console.log('✅ Factory already deployed at expected address!');
    return;
  }

  // Deploy via CREATE2
  console.log('\n📤 Sending deployment transaction...');
  const deployData = ethers.concat([DEPLOYMENT_SALT, initCode]);

  // Estimate gas first
  try {
    const gasEstimate = await ethers.provider.estimateGas({
      to: CREATE2_DEPLOYER,
      data: deployData,
      from: deployer.address,
    });
    console.log(`   Estimated gas: ${gasEstimate.toString()}`);

    // Add 20% buffer
    const gasLimit = (gasEstimate * 120n) / 100n;

    const tx = await deployer.sendTransaction({
      to: CREATE2_DEPLOYER,
      data: deployData,
      gasLimit,
    });

    console.log(`   Transaction hash: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`   Status: ${receipt?.status === 1 ? 'success' : 'failed'}`);
    console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);

    if (receipt?.status === 1) {
      // Verify deployment
      const deployedCode = await ethers.provider.getCode(expectedAddress);
      if (deployedCode !== '0x') {
        console.log(`\n✅ Factory deployed at: ${expectedAddress}`);
        console.log(`\n⚠️  UPDATE YOUR .env FILE:`);
        console.log(`VITE_PASSKEY_FACTORY_ADDRESS=${expectedAddress}`);
        console.log(`VITE_SEPOLIA_PASSKEY_FACTORY_ADDRESS=${expectedAddress}`);
      } else {
        console.log('❌ Deployment verification failed - no code at expected address');
      }
    }
  } catch (error: any) {
    console.error('❌ Deployment failed:', error.message);

    // Try to get more info
    if (error.data) {
      console.error('Error data:', error.data);
    }
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
