/**
 * Deploy PasskeyAccountFactory to Arc Testnet or Sepolia
 *
 * Usage:
 *   npx hardhat run scripts/deployPasskeyFactory.ts --network arcTestnet
 *   npx hardhat run scripts/deployPasskeyFactory.ts --network sepolia
 */

import { ethers } from 'hardhat';

// ERC-4337 EntryPoint v0.6 (same address on all chains)
const ENTRY_POINT = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

// P256 Verifier (RIP-7212 precompile) - same on all chains
const P256_VERIFIER = '0xc2b78104907F722DABAc4C69f826a522B2754De4';

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = network.chainId === 5042002n ? 'Arc Testnet' :
                      network.chainId === 11155111n ? 'Sepolia' :
                      `Chain ${network.chainId}`;

  console.log(`Deploying PasskeyAccountFactory to ${networkName}...`);

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'USDC');

  // Deploy PasskeyAccountFactory
  const PasskeyAccountFactory = await ethers.getContractFactory('PasskeyAccountFactory');
  const factory = await PasskeyAccountFactory.deploy(ENTRY_POINT);
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log('PasskeyAccountFactory deployed to:', factoryAddress);

  // Verify P256 verifier exists
  const code = await ethers.provider.getCode(P256_VERIFIER);
  console.log('P256 Verifier exists:', code !== '0x');

  // Check EntryPoint exists
  const epCode = await ethers.provider.getCode(ENTRY_POINT);
  console.log('EntryPoint exists:', epCode !== '0x');

  console.log('\n--- Deployment Summary ---');
  console.log('Network:', networkName);
  console.log('Chain ID:', network.chainId.toString());
  console.log('PasskeyAccountFactory:', factoryAddress);
  console.log('EntryPoint:', ENTRY_POINT);
  console.log('P256 Verifier:', P256_VERIFIER);

  if (network.chainId === 11155111n) {
    console.log('\nAdd this to your .env for SEPOLIA:');
    console.log(`VITE_SEPOLIA_PASSKEY_FACTORY_ADDRESS=${factoryAddress}`);
  } else {
    console.log('\nAdd this to your .env:');
    console.log(`VITE_PASSKEY_FACTORY_ADDRESS=${factoryAddress}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
