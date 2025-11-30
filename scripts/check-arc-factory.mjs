/**
 * Check Arc factory implementation address
 */

import { createPublicClient, http } from 'viem';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Arc factory from .env
const ARC_FACTORY = '0x4C16f269dE57B846309a8Eb3591ddb394aBba488';

// Arc Testnet chain config
const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'ARC', symbol: 'ARC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.arc.testnet.arcology.network/http'] },
  },
};

// Load compiled contract artifacts
const artifactsPath = join(__dirname, '..', 'hh-artifacts');

function loadArtifact(name) {
  const path = join(artifactsPath, 'contracts', `${name}.sol`, `${name}.json`);
  const content = readFileSync(path, 'utf8');
  return JSON.parse(content);
}

async function main() {
  console.log('🔍 Checking Arc factory at:', ARC_FACTORY);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http('https://rpc.arc.testnet.arcology.network/http'),
  });

  const ArcAccountFactoryArtifact = loadArtifact('ArcAccountFactory');

  try {
    // Get implementation address from Arc factory
    const implementationAddress = await publicClient.readContract({
      address: ARC_FACTORY,
      abi: ArcAccountFactoryArtifact.abi,
      functionName: 'accountImplementation',
    });

    console.log('✅ Arc Factory Implementation:', implementationAddress);

    // Get EntryPoint
    const entryPoint = await publicClient.readContract({
      address: ARC_FACTORY,
      abi: ArcAccountFactoryArtifact.abi,
      functionName: 'entryPoint',
    });

    console.log('✅ Arc Factory EntryPoint:', entryPoint);

    // Test getAddress with user's credentials
    const PUBLIC_KEY_X = '0x1e0aeb671b3f60fdf21dfd69e7e561a1d50d9e078088129a819ac9984cc35c45';
    const PUBLIC_KEY_Y = '0x43950158bd8e8d371ade62279085fde4d0e99e510c55fb2078bd2475b6264b54';

    const { keccak256, encodePacked } = await import('viem');
    const keyHash = keccak256(
      encodePacked(
        ['uint256', 'uint256'],
        [BigInt(PUBLIC_KEY_X), BigInt(PUBLIC_KEY_Y)]
      )
    );

    console.log('\n📍 Testing with user credentials:');
    console.log('   Key Hash:', keyHash);

    const calculatedAddress = await publicClient.readContract({
      address: ARC_FACTORY,
      abi: ArcAccountFactoryArtifact.abi,
      functionName: 'getAddress',
      args: [keyHash, 2, 'Default Device', 0n],
    });

    console.log('   Calculated Address:', calculatedAddress);
    console.log('   Expected Address: 0xE6Dc064dfE85525Bc24Df0Ec415117c9b30dd719');
    console.log('   Match:', calculatedAddress.toLowerCase() === '0xE6Dc064dfE85525Bc24Df0Ec415117c9b30dd719'.toLowerCase());

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main().catch(console.error);
