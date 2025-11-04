process.env.TS_NODE_PROJECT = 'tsconfig.hardhat.json';
require('ts-node').register({
  transpileOnly: true,
  files: true,
});
require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-chai-matchers');

/** @type {import('hardhat/config').HardhatUserConfig} */
const config = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: './contracts',
    tests: 'test',
    cache: './hh-cache',
    artifacts: './hh-artifacts',
  },
};

module.exports = config;
