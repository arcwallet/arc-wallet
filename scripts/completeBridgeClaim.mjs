/**
 * Complete pending bridge claim on Sepolia
 * Run with: node scripts/completeBridgeClaim.mjs
 */

import { ethers, JsonRpcProvider, Wallet, Interface } from 'ethers';
import 'dotenv/config';

const ATTESTATION_API = 'https://iris-api-sandbox.circle.com';

const SEPOLIA_CONFIG = {
  chainId: 11155111,
  rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
  messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
};

const MESSAGE_TRANSMITTER_ABI = [
  'function receiveMessage(bytes message, bytes attestation) returns (bool success)',
];

async function completeBridgeClaim(sourceTxHash, sourceDomain) {
  console.log('🌉 Completing bridge claim...');
  console.log('Source TX:', sourceTxHash);
  console.log('Source Domain:', sourceDomain);

  // Get attestation
  console.log('\n📡 Fetching attestation from Circle...');
  const response = await fetch(
    `${ATTESTATION_API}/v2/messages/${sourceDomain}?transactionHash=${sourceTxHash}`
  );

  if (!response.ok) {
    throw new Error('Attestation not available');
  }

  const data = await response.json();

  if (!data.messages || data.messages.length === 0) {
    throw new Error('No messages found for this transaction');
  }

  const msg = data.messages[0];

  if (msg.status !== 'complete' || !msg.attestation) {
    throw new Error(`Attestation not ready. Status: ${msg.status}`);
  }

  console.log('✅ Attestation received!');
  console.log('Recipient:', msg.decodedMessage?.decodedMessageBody?.mintRecipient);
  console.log('Amount:', Number(msg.decodedMessage?.decodedMessageBody?.amount) / 1e6, 'USDC');

  // Setup wallet
  const privateKey = process.env.BUNDLER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('BUNDLER_PRIVATE_KEY not set');
  }

  const provider = new JsonRpcProvider(SEPOLIA_CONFIG.rpcUrl);
  const wallet = new Wallet(privateKey, provider);

  console.log('\n💼 Completer address:', wallet.address);

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log('ETH Balance:', ethers.formatEther(balance), 'ETH');

  if (balance < ethers.parseEther('0.001')) {
    throw new Error('Insufficient ETH for gas');
  }

  // Execute receiveMessage
  console.log('\n🚀 Executing receiveMessage on Sepolia...');

  // Encode function call
  const iface = new Interface(MESSAGE_TRANSMITTER_ABI);
  const txData = iface.encodeFunctionData('receiveMessage', [msg.message, msg.attestation]);

  console.log('Encoded data:', txData.slice(0, 50) + '...');

  const tx = await wallet.sendTransaction({
    to: SEPOLIA_CONFIG.messageTransmitter,
    data: txData,
    gasLimit: 500000n,
  });

  console.log('TX submitted:', tx.hash);
  console.log('Waiting for confirmation...');

  const receipt = await tx.wait();
  console.log('\n✅ Bridge claim completed!');
  console.log('Block:', receipt?.blockNumber);
  console.log('Gas used:', receipt?.gasUsed?.toString());
  console.log('\n🔗 Sepolia TX:', `https://sepolia.etherscan.io/tx/${tx.hash}`);
}

// Run with hardcoded values for the pending transaction
const SOURCE_TX_HASH = '0x44daf4c6d7732ead32a1b701d98294eadd666032c586e37e987f8d987f95155e';
const SOURCE_DOMAIN = 26; // Arc Testnet

completeBridgeClaim(SOURCE_TX_HASH, SOURCE_DOMAIN).catch(console.error);
