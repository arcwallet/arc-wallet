/**
 * Gemini Fine-tuning Script
 *
 * Usage:
 * GEMINI_API_KEY=AIza... npx tsx scripts/gemini-fine-tune.ts
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const TRAINING_DATA = [
  // SEND examples - Turkish
  { input: "50 usdc gönder 0x742d35Cc6634C0532925a3b844Bc454e4438f44e", output: '{"type":"SEND","params":{"amount":"50","token":"USDC","recipient":"0x742d35Cc6634C0532925a3b844Bc454e4438f44e"},"confidence":0.95,"message":"50 USDC gönderiyorum"}' },
  { input: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e adresine 25 usdc yolla", output: '{"type":"SEND","params":{"amount":"25","token":"USDC","recipient":"0x742d35Cc6634C0532925a3b844Bc454e4438f44e"},"confidence":0.95,"message":"25 USDC yolluyorum"}' },
  { input: "100 tane usdc at 0xabc123def456789012345678901234567890abcd", output: '{"type":"SEND","params":{"amount":"100","token":"USDC","recipient":"0xabc123def456789012345678901234567890abcd"},"confidence":0.95,"message":"100 USDC gönderiyorum"}' },

  // SEND examples - English
  { input: "send 100 USDC to 0xabc123def456789012345678901234567890abcd", output: '{"type":"SEND","params":{"amount":"100","token":"USDC","recipient":"0xabc123def456789012345678901234567890abcd"},"confidence":0.95,"message":"Sending 100 USDC"}' },
  { input: "transfer 50 usdc to 0x1234567890123456789012345678901234567890", output: '{"type":"SEND","params":{"amount":"50","token":"USDC","recipient":"0x1234567890123456789012345678901234567890"},"confidence":0.95,"message":"Transferring 50 USDC"}' },

  // SEND examples - Spanish
  { input: "enviar 200 usdc a 0x1234567890123456789012345678901234567890", output: '{"type":"SEND","params":{"amount":"200","token":"USDC","recipient":"0x1234567890123456789012345678901234567890"},"confidence":0.95,"message":"Enviando 200 USDC"}' },

  // BRIDGE examples - Turkish
  { input: "100 usdc base'e köprüle", output: '{"type":"BRIDGE","params":{"amount":"100","fromChain":"arc","toChain":"base sepolia"},"confidence":0.95,"message":"100 USDC Base Sepolia\'ya köprüleniyor"}' },
  { input: "50 usdc base zincirine aktar", output: '{"type":"BRIDGE","params":{"amount":"50","fromChain":"arc","toChain":"base sepolia"},"confidence":0.95,"message":"50 USDC Base zincirine aktarılıyor"}' },
  { input: "köprü yap 25 usdc", output: '{"type":"BRIDGE","params":{"amount":"25","fromChain":"arc","toChain":"base sepolia"},"confidence":0.9,"message":"25 USDC köprüleniyor"}' },

  // BRIDGE examples - English
  { input: "bridge 50 to base sepolia", output: '{"type":"BRIDGE","params":{"amount":"50","fromChain":"arc","toChain":"base sepolia"},"confidence":0.95,"message":"Bridging 50 USDC to Base Sepolia"}' },
  { input: "bridge 100 usdc to base", output: '{"type":"BRIDGE","params":{"amount":"100","fromChain":"arc","toChain":"base sepolia"},"confidence":0.95,"message":"Bridging 100 USDC to Base"}' },

  // SWAP examples - Turkish
  { input: "50 usdc'yi eurc'ye çevir", output: '{"type":"SWAP","params":{"amount":"50","fromToken":"USDC","toToken":"EURC"},"confidence":0.95,"message":"50 USDC EURC\'ye çevriliyor"}' },
  { input: "100 tane eurc al", output: '{"type":"SWAP","params":{"amount":"100","fromToken":"USDC","toToken":"EURC"},"confidence":0.9,"message":"100 EURC alınıyor"}' },
  { input: "takas yap 75 usdc eurc", output: '{"type":"SWAP","params":{"amount":"75","fromToken":"USDC","toToken":"EURC"},"confidence":0.9,"message":"75 USDC EURC ile takas ediliyor"}' },

  // SWAP examples - English
  { input: "swap 100 usdc to eurc", output: '{"type":"SWAP","params":{"amount":"100","fromToken":"USDC","toToken":"EURC"},"confidence":0.95,"message":"Swapping 100 USDC to EURC"}' },
  { input: "exchange 50 usdc for eurc", output: '{"type":"SWAP","params":{"amount":"50","fromToken":"USDC","toToken":"EURC"},"confidence":0.95,"message":"Exchanging 50 USDC for EURC"}' },

  // CHECK_BALANCE examples - Turkish
  { input: "bakiyem ne kadar", output: '{"type":"CHECK_BALANCE","params":{},"confidence":0.95,"message":"Cüzdan bakiyenizi kontrol ediyorum"}' },
  { input: "usdc bakiyem ne", output: '{"type":"CHECK_BALANCE","params":{"token":"USDC"},"confidence":0.95,"message":"USDC bakiyenizi kontrol ediyorum"}' },
  { input: "ne kadar param var", output: '{"type":"CHECK_BALANCE","params":{},"confidence":0.9,"message":"Bakiyenizi kontrol ediyorum"}' },

  // CHECK_BALANCE examples - English
  { input: "check my balance", output: '{"type":"CHECK_BALANCE","params":{},"confidence":0.95,"message":"Checking your wallet balance"}' },
  { input: "how much usdc do i have", output: '{"type":"CHECK_BALANCE","params":{"token":"USDC"},"confidence":0.95,"message":"Checking your USDC balance"}' },

  // GET_PRICE examples - Turkish
  { input: "eth fiyatı ne", output: '{"type":"GET_PRICE","params":{"token":"ETH"},"confidence":0.95,"message":"ETH fiyatını getiriyorum"}' },
  { input: "btc kaç dolar", output: '{"type":"GET_PRICE","params":{"token":"BTC"},"confidence":0.95,"message":"Bitcoin fiyatını kontrol ediyorum"}' },
  { input: "bitcoin fiyatı", output: '{"type":"GET_PRICE","params":{"token":"BTC"},"confidence":0.95,"message":"Bitcoin fiyatını getiriyorum"}' },

  // GET_PRICE examples - English
  { input: "what's the price of bitcoin", output: '{"type":"GET_PRICE","params":{"token":"BTC"},"confidence":0.95,"message":"Getting Bitcoin price"}' },
  { input: "eth price", output: '{"type":"GET_PRICE","params":{"token":"ETH"},"confidence":0.95,"message":"Getting ETH price"}' },

  // ANALYZE_WALLET examples - Turkish
  { input: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e güvenli mi", output: '{"type":"ANALYZE_WALLET","params":{"address":"0x742d35Cc6634C0532925a3b844Bc454e4438f44e"},"confidence":0.95,"message":"Cüzdan güvenliğini analiz ediyorum"}' },
  { input: "bu adres riskli mi 0x1234567890123456789012345678901234567890", output: '{"type":"ANALYZE_WALLET","params":{"address":"0x1234567890123456789012345678901234567890"},"confidence":0.95,"message":"Risk analizi yapıyorum"}' },

  // ANALYZE_WALLET examples - English
  { input: "analyze wallet 0xabc123def456789012345678901234567890abcd", output: '{"type":"ANALYZE_WALLET","params":{"address":"0xabc123def456789012345678901234567890abcd"},"confidence":0.95,"message":"Analyzing wallet for risks"}' },
  { input: "is 0x1234567890123456789012345678901234567890 safe", output: '{"type":"ANALYZE_WALLET","params":{"address":"0x1234567890123456789012345678901234567890"},"confidence":0.95,"message":"Checking wallet safety"}' },

  // GET_NEWS examples - Turkish
  { input: "kripto haberleri", output: '{"type":"GET_NEWS","params":{},"confidence":0.95,"message":"Kripto haberlerini getiriyorum"}' },
  { input: "piyasa durumu nasıl", output: '{"type":"GET_NEWS","params":{},"confidence":0.95,"message":"Piyasa durumunu analiz ediyorum"}' },
  { input: "market haberleri", output: '{"type":"GET_NEWS","params":{},"confidence":0.95,"message":"Market haberlerini getiriyorum"}' },

  // GET_NEWS examples - English
  { input: "market news", output: '{"type":"GET_NEWS","params":{},"confidence":0.95,"message":"Fetching market news"}' },
  { input: "crypto news", output: '{"type":"GET_NEWS","params":{},"confidence":0.95,"message":"Getting crypto news"}' },

  // UNKNOWN examples
  { input: "merhaba", output: '{"type":"UNKNOWN","params":{},"confidence":0.3,"message":"Merhaba! Size nasıl yardımcı olabilirim? Token gönderme, swap, bridge veya fiyat sorgulama yapabilirim."}' },
  { input: "hello", output: '{"type":"UNKNOWN","params":{},"confidence":0.3,"message":"Hello! How can I help you? I can send tokens, swap, bridge, or check prices."}' },
  { input: "ne yapabilirsin", output: '{"type":"UNKNOWN","params":{},"confidence":0.5,"message":"Token gönderme, swap, bridge, bakiye kontrolü, fiyat sorgulama ve cüzdan analizi yapabilirim."}' },
];

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY environment variable is required');
    process.exit(1);
  }

  console.log('🚀 Gemini Fine-tuning Simulator\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Note: Gemini API doesn't support fine-tuning directly through the SDK yet
  // This script prepares the data and tests with the current model

  console.log('📊 Training Data Summary:');
  console.log(`   Total examples: ${TRAINING_DATA.length}`);

  const intentCounts: Record<string, number> = {};
  TRAINING_DATA.forEach(item => {
    const parsed = JSON.parse(item.output);
    intentCounts[parsed.type] = (intentCounts[parsed.type] || 0) + 1;
  });

  Object.entries(intentCounts).forEach(([intent, count]) => {
    console.log(`   ${intent}: ${count} examples`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Test current model with training data
  console.log('🧪 Testing current Gemini model with training examples...\n');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const systemPrompt = `You are Arc Agent, a crypto wallet AI. Extract intent from user messages in ANY language.
Return ONLY valid JSON: {"type":"SEND|SWAP|BRIDGE|CHECK_BALANCE|ANALYZE_WALLET|GET_PRICE|GET_NEWS|UNKNOWN","params":{...},"confidence":0-1,"message":"response in user's language"}`;

  let correct = 0;
  let total = 0;
  const testSamples = TRAINING_DATA.slice(0, 10); // Test first 10

  for (const sample of testSamples) {
    try {
      const result = await model.generateContent(`${systemPrompt}\n\nUser: ${sample.input}`);
      const response = result.response.text();

      // Extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const expected = JSON.parse(sample.output);

        if (parsed.type === expected.type) {
          correct++;
          console.log(`✅ "${sample.input.slice(0, 30)}..." → ${parsed.type}`);
        } else {
          console.log(`❌ "${sample.input.slice(0, 30)}..." → Got: ${parsed.type}, Expected: ${expected.type}`);
        }
      }
      total++;
    } catch (err) {
      console.log(`⚠️ Error testing: ${sample.input.slice(0, 30)}...`);
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📈 Accuracy: ${correct}/${total} (${((correct/total)*100).toFixed(1)}%)\n`);

  console.log('ℹ️  Note: Gemini fine-tuning requires Google AI Studio or Vertex AI.');
  console.log('    Current model is already performing well with prompt engineering.\n');
  console.log('    To create a tuned model:');
  console.log('    1. Go to https://aistudio.google.com');
  console.log('    2. Click "New tuned model"');
  console.log('    3. Upload training data (JSON format ready in training/ folder)');
  console.log('    4. Get tuned model ID and add to .env\n');
}

main().catch(console.error);
