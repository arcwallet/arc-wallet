/**
 * Fine-tuning Script for Arc Agent
 *
 * Usage:
 * 1. Set OPENAI_API_KEY in environment
 * 2. Run: npx tsx scripts/fine-tune.ts
 *
 * This will:
 * - Upload training data to OpenAI
 * - Start fine-tuning job
 * - Wait for completion
 * - Output the model ID to use
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const TRAINING_FILE = path.join(__dirname, '../training/crypto_agent_training.jsonl');

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY environment variable is required');
    console.log('\nGet your API key from: https://platform.openai.com/api-keys');
    console.log('Then run: OPENAI_API_KEY=sk-... npx tsx scripts/fine-tune.ts');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });

  console.log('🚀 Arc Agent Fine-tuning\n');

  // Step 1: Upload training file
  console.log('📤 Uploading training data...');

  const file = await openai.files.create({
    file: fs.createReadStream(TRAINING_FILE),
    purpose: 'fine-tune',
  });

  console.log(`   File ID: ${file.id}`);
  console.log(`   Status: ${file.status}`);

  // Step 2: Create fine-tuning job
  console.log('\n🎯 Starting fine-tuning job...');

  const fineTune = await openai.fineTuning.jobs.create({
    training_file: file.id,
    model: 'gpt-4o-mini-2024-07-18', // Cheapest option for fine-tuning
    hyperparameters: {
      n_epochs: 3, // 3 epochs is usually enough
    },
    suffix: 'arc-agent', // Model will be named ft:gpt-4o-mini:...:arc-agent
  });

  console.log(`   Job ID: ${fineTune.id}`);
  console.log(`   Status: ${fineTune.status}`);

  // Step 3: Wait for completion
  console.log('\n⏳ Waiting for fine-tuning to complete...');
  console.log('   (This usually takes 5-15 minutes)\n');

  let job = fineTune;
  let dots = 0;

  while (job.status === 'validating_files' || job.status === 'queued' || job.status === 'running') {
    await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10 seconds
    job = await openai.fineTuning.jobs.retrieve(fineTune.id);

    dots = (dots + 1) % 4;
    process.stdout.write(`\r   Status: ${job.status} ${'.'.repeat(dots)}${' '.repeat(3 - dots)}`);
  }

  console.log('\n');

  if (job.status === 'succeeded') {
    console.log('✅ Fine-tuning completed successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🤖 Your fine-tuned model: ${job.fine_tuned_model}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Add this to your .env file:');
    console.log(`OPENAI_FINE_TUNED_MODEL=${job.fine_tuned_model}\n`);
  } else {
    console.log(`❌ Fine-tuning failed: ${job.status}`);
    if (job.error) {
      console.log(`   Error: ${job.error.message}`);
    }
  }
}

main().catch(console.error);
