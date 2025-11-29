process.env.TS_NODE_PROJECT = 'tsconfig.hardhat.json';
require('ts-node').register({
  transpileOnly: true,
  files: true,
});
require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-chai-matchers');
const fs = require('fs');
const path = require('path');

// Load .env manually
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

/** @type {import('hardhat/config').HardhatUserConfig} */
const config = {
  solidity: {
    version: '0.8.23',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: 'paris',
    },
  },
  paths: {
    sources: './contracts',
    tests: 'test',
    cache: './hh-cache',
    artifacts: './hh-artifacts',
  },
  networks: {
    arcTestnet: {
      url: 'https://rpc.testnet.arc.network',
      chainId: 5042002,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    sepolia: {
      url: 'https://ethereum-sepolia-rpc.publicnode.com',
      chainId: 11155111,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
  },
};

module.exports = config;
