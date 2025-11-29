/**
 * Deploy PasskeyAccountFactory to Sepolia using direct ethers.js
 *
 * Usage: node scripts/deploySepoliaFactory.cjs
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Configuration
const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const PRIVATE_KEY = '0x1cfc5ebc34046358111997fded4a97f418284d8ac530f328860197c9e2d6268e';
const ENTRY_POINT = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const P256_VERIFIER = '0xc2b78104907F722DABAc4C69f826a522B2754De4';

async function main() {
  console.log('Deploying PasskeyAccountFactory to Sepolia...\n');

  // Load artifact
  const artifactPath = path.join(__dirname, '../hh-artifacts/contracts/PasskeyAccount.sol/PasskeyAccountFactory.json');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  // Connect to Sepolia
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log('Deployer:', wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH');

  if (balance < ethers.parseEther('0.01')) {
    throw new Error('Insufficient ETH balance for deployment');
  }

  // Check dependencies exist on Sepolia
  const epCode = await provider.getCode(ENTRY_POINT);
  const p256Code = await provider.getCode(P256_VERIFIER);

  console.log('EntryPoint exists:', epCode !== '0x');
  console.log('P256 Verifier exists:', p256Code !== '0x');

  if (epCode === '0x') {
    throw new Error('EntryPoint not deployed on Sepolia');
  }

  // Deploy factory
  console.log('\nDeploying factory...');

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(ENTRY_POINT);

  console.log('Deployment tx:', contract.deploymentTransaction().hash);
  console.log('Waiting for confirmation...');

  await contract.waitForDeployment();

  const factoryAddress = await contract.getAddress();

  console.log('\n=== DEPLOYMENT SUCCESSFUL ===');
  console.log('Network: Sepolia');
  console.log('Chain ID: 11155111');
  console.log('PasskeyAccountFactory:', factoryAddress);
  console.log('EntryPoint:', ENTRY_POINT);
  console.log('P256 Verifier:', P256_VERIFIER);
  console.log('\nAdd this to your .env:');
  console.log(`VITE_SEPOLIA_PASSKEY_FACTORY_ADDRESS=${factoryAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
