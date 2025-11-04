// Simple script to test bridge service
import { Wallet } from 'ethers';

console.log('🧪 Bridge test starting...');

// Create test wallet
const testWallet = Wallet.createRandom();
console.log('📝 Test wallet created:', testWallet.address);

// Test RPC endpoints
const arcRpc = 'https://rpc.testnet.arc.network';
const sepoliaRpc = 'https://ethereum-sepolia-rpc.publicnode.com';

console.log('\n🔌 Testing RPC endpoints...');

async function testRpcEndpoint(url, name) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      })
    });

    const data = await response.json();
    if (data.result) {
      console.log(`✅ ${name}: Block ${parseInt(data.result, 16)}`);
      return true;
    } else {
      console.log(`❌ ${name}: ${data.error?.message || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    return false;
  }
}

Promise.all([
  testRpcEndpoint(arcRpc, 'Arc Testnet'),
  testRpcEndpoint(sepoliaRpc, 'Sepolia')
]).then(results => {
  const [arcOk, sepoliaOk] = results;

  if (arcOk && sepoliaOk) {
    console.log('\n🎉 All RPC endpoints are working!');
  } else {
    console.log('\n⚠️  Some RPC endpoints have issues');
  }

  console.log('\n📋 Bridge usage recommendations:');
  console.log('1. Make sure VITE_BRIDGE_DEBUG=true in .env.local file');
  console.log('2. Follow bridge logs in browser console');
  console.log('3. Use small amounts for testing (1-5 USDC)');
  console.log('4. Make sure your session key has USDC balance on both chains');
});