import hardhat from 'hardhat';

const { ethers } = hardhat;

/**
 * Deploy ArcAccount smart contracts to Sepolia
 *
 * Contracts deployed:
 * 1. P256Verifier - WebAuthn signature verification
 * 2. ArcAccountFactory - Factory for creating smart wallets
 *
 * The ArcAccount implementation is deployed inside the factory constructor.
 */
async function main() {
  console.log('🚀 Starting ArcAccount deployment to Sepolia...\n');

  const [deployer] = await ethers.getSigners();
  const balance = await deployer.provider!.getBalance(deployer.address);

  console.log('📍 Deployer address:', deployer.address);
  console.log('💰 Deployer balance:', ethers.formatEther(balance), 'ETH\n');

  if (balance === 0n) {
    throw new Error('Deployer has no funds! Please fund the deployer address.');
  }

  // Sepolia EntryPoint address (ERC-4337 v0.7)
  // This is the canonical EntryPoint address for ERC-4337
  const ENTRY_POINT_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

  console.log('📝 Using EntryPoint:', ENTRY_POINT_ADDRESS);

  // Check if EntryPoint exists
  const entryPointCode = await deployer.provider!.getCode(ENTRY_POINT_ADDRESS);
  if (entryPointCode === '0x') {
    throw new Error('EntryPoint not found at canonical address on Sepolia!');
  } else {
    console.log('✅ EntryPoint found at canonical address\n');
  }

  // Deploy P256Verifier
  console.log('📦 Deploying P256Verifier...');
  const P256Verifier = await ethers.getContractFactory('P256Verifier');
  const p256Verifier = await P256Verifier.deploy();
  await p256Verifier.waitForDeployment();
  const p256VerifierAddress = await p256Verifier.getAddress();
  console.log('✅ P256Verifier deployed to:', p256VerifierAddress);

  // Deploy ArcAccountFactory
  console.log('\n📦 Deploying ArcAccountFactory...');
  const ArcAccountFactory = await ethers.getContractFactory('ArcAccountFactory');
  const factory = await ArcAccountFactory.deploy(ENTRY_POINT_ADDRESS);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log('✅ ArcAccountFactory deployed to:', factoryAddress);

  // Get implementation address
  const implementationAddress = await factory.accountImplementation();
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
    deployer: deployer.address,
    contracts: {
      entryPoint: ENTRY_POINT_ADDRESS,
      p256Verifier: p256VerifierAddress,
      arcAccountFactory: factoryAddress,
      arcAccountImplementation: implementationAddress,
    },
  };

  const fs = await import('fs');
  const path = await import('path');

  const deploymentsDir = path.join(process.cwd(), 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentPath = path.join(deploymentsDir, 'sepolia.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n💾 Deployment info saved to: ${deploymentPath}`);

  console.log('\n⚠️  IMPORTANT: Update your .env file with:');
  console.log(`VITE_SEPOLIA_PASSKEY_FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`VITE_SEPOLIA_P256_VERIFIER_ADDRESS=${p256VerifierAddress}`);

  console.log('\n✨ Deployment complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
