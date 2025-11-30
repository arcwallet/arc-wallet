/**
 * Verify wallet address calculation on Sepolia
 */

import { createPublicClient, http, keccak256, encodeAbiParameters, encodePacked } from 'viem';
import { sepolia } from 'viem/chains';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// User's passkey data from previous session
const PUBLIC_KEY_X = '0x1e0aeb671b3f60fdf21dfd69e7e561a1d50d9e078088129a819ac9984cc35c45';
const PUBLIC_KEY_Y = '0x43950158bd8e8d371ade62279085fde4d0e99e510c55fb2078bd2475b6264b54';
const EXPECTED_ADDRESS = '0xE6Dc064dfE85525Bc24Df0Ec415117c9b30dd719';

// New Sepolia factory
const SEPOLIA_FACTORY = '0xaad19fd1e49ed5ece26494c74278200966447363';

// Load compiled contract artifacts
const artifactsPath = join(__dirname, '..', 'hh-artifacts');

function loadArtifact(name) {
  const path = join(artifactsPath, 'contracts', `${name}.sol`, `${name}.json`);
  const content = readFileSync(path, 'utf8');
  return JSON.parse(content);
}

async function main() {
  console.log('🔍 Verifying wallet address calculation on Sepolia...\n');

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });

  const ArcAccountFactoryArtifact = loadArtifact('ArcAccountFactory');

  // Calculate keyHash from public key coordinates
  // keyHash = keccak256(abi.encodePacked(x, y))
  const keyHash = keccak256(
    encodePacked(
      ['uint256', 'uint256'],
      [BigInt(PUBLIC_KEY_X), BigInt(PUBLIC_KEY_Y)]
    )
  );

  console.log('📍 Public Key X:', PUBLIC_KEY_X);
  console.log('📍 Public Key Y:', PUBLIC_KEY_Y);
  console.log('📍 Key Hash:', keyHash);

  // keyType = 2 for WebAuthn
  const keyType = 2;
  // deviceName = 'Default Device' (standard)
  const deviceName = 'Default Device';
  // salt = 0 (standard)
  const salt = 0n;

  console.log('📍 Key Type:', keyType, '(WebAuthn)');
  console.log('📍 Device Name:', deviceName);
  console.log('📍 Salt:', salt.toString());

  // Get counterfactual address from factory
  const calculatedAddress = await publicClient.readContract({
    address: SEPOLIA_FACTORY,
    abi: ArcAccountFactoryArtifact.abi,
    functionName: 'getAddress',
    args: [keyHash, keyType, deviceName, salt],
  });

  console.log('\n' + '='.repeat(60));
  console.log('📋 ADDRESS VERIFICATION');
  console.log('='.repeat(60));
  console.log('Expected Address:', EXPECTED_ADDRESS);
  console.log('Calculated Address:', calculatedAddress);
  console.log('='.repeat(60));

  if (calculatedAddress.toLowerCase() === EXPECTED_ADDRESS.toLowerCase()) {
    console.log('✅ MATCH! The new Sepolia factory produces the correct address.');
    console.log('\n🎉 You can now use the same wallet address on both Arc and Sepolia!');
  } else {
    console.log('❌ MISMATCH! The addresses do not match.');
    console.log('\nPossible reasons:');
    console.log('1. Different implementation contract bytecode');
    console.log('2. Different salt used during account creation');
    console.log('3. Different deviceName used');
  }
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
