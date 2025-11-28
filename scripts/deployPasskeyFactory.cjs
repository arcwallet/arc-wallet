/**
 * Deploy PasskeyAccountFactory to Arc Testnet
 *
 * Usage: npx hardhat run scripts/deployPasskeyFactory.cjs --network arcTestnet --config hardhat.config.cjs
 */

const { ethers } = require('hardhat');

// Arc Testnet EntryPoint address (ERC-4337 v0.6)
const ENTRY_POINT = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

async function main() {
  console.log('Deploying PasskeyAccountFactory to Arc Testnet...');

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
  const p256Verifier = '0xc2b78104907F722DABAc4C69f826a522B2754De4';
  const code = await ethers.provider.getCode(p256Verifier);
  console.log('P256 Verifier exists:', code !== '0x');

  console.log('\n--- Deployment Summary ---');
  console.log('PasskeyAccountFactory:', factoryAddress);
  console.log('EntryPoint:', ENTRY_POINT);
  console.log('P256 Verifier:', p256Verifier);
  console.log('\nAdd this to your config:');
  console.log('PASSKEY_FACTORY_ADDRESS=' + factoryAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
