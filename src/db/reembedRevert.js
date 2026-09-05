require('dotenv').config();
const fs = require('fs');
const { supabase } = require('./index');
const { embedTexts } = require('../services/ai/embeddings');

const SOURCE_PROGRESS_PATH = '/private/tmp/claude-501/-Users-avirizzz-7-projects-Shopitforme/e602f414-7bde-4e89-a75d-83f881cae178/scratchpad/reembed_progress.json';
const REVERT_PROGRESS_PATH = '/private/tmp/claude-501/-Users-avirizzz-7-projects-Shopitforme/e602f414-7bde-4e89-a75d-83f881cae178/scratchpad/reembed_revert_progress.json';
const BATCH_SIZE = 90;
const INTER_BATCH_COOLDOWN_MS = 75000;
const DRY_RUN = process.argv.includes('--dry-run');

function loadJsonSet(path) {
  try {
    return new Set(JSON.parse(fs.readFileSync(path, 'utf8')));
  } catch {
    return new Set();
  }
}
function saveJsonSet(path, set) {
  fs.writeFileSync(path, JSON.stringify([...set]));
}

async function run() {
  const targetIds = [...loadJsonSet(SOURCE_PROGRESS_PATH)];
  if (!targetIds.length) {
    console.error(`No product_ids found in ${SOURCE_PROGRESS_PATH} -- nothing to revert.`);
    return;
  }
  console.log(`Reverting exactly ${targetIds.length} product_ids back onto gemini-embedding-001.`);

  const alreadyDone = loadJsonSet(REVERT_PROGRESS_PATH);
  const remainingIds = targetIds.filter((id) => !alreadyDone.has(id));
  if (alreadyDone.size) console.log(`Resume: ${alreadyDone.size} already reverted in a prior run, skipping (${targetIds.length} -> ${remainingIds.length} remaining)`);
  if (!remainingIds.length) {
    console.log('Nothing left to revert -- already done.');
    return;
  }

  const { data: products, error } = await supabase
    .from('products')
    .select('product_id, name, description, tags')
    .in('product_id', remainingIds);
  if (error) throw error;
  console.log(`Fetched ${products.length} of ${remainingIds.length} rows to revert (any gap means a product_id no longer exists -- fine, nothing to do for it).`);

  if (DRY_RUN) {
    console.log(`\n--dry-run: stopping before spending any embedding quota. Would re-embed ${products.length} products back onto gemini-embedding-001.`);
    return;
  }

  const batches = [];
  for (let i = 0; i < products.length; i += BATCH_SIZE) batches.push(products.slice(i, i + BATCH_SIZE));

  let total = 0;
  for (let i = 0; i < batches.length; i++) {
    if (i > 0) {
      console.log(`  cooling down ${INTER_BATCH_COOLDOWN_MS / 1000}s before the next batch...`);
      await new Promise((r) => setTimeout(r, INTER_BATCH_COOLDOWN_MS));
    }
    const batch = batches[i];
    const texts = batch.map((p) => `${p.name}. ${p.description || ''} Tags: ${(p.tags || []).join(', ')}`);
    const embeddings = await embedTexts(texts);

    for (let j = 0; j < batch.length; j++) {
      const { error: updErr } = await supabase.from('products').update({ embedding: embeddings[j] }).eq('product_id', batch[j].product_id);
      if (updErr) {
        console.error(`  update failed for ${batch[j].product_id}:`, updErr.message);
        continue;
      }
      total++;
      alreadyDone.add(batch[j].product_id);
      saveJsonSet(REVERT_PROGRESS_PATH, alreadyDone);
    }
    console.log(`  batch ${i + 1}/${batches.length}: ${total}/${products.length} reverted this run (${alreadyDone.size}/${targetIds.length} of the whole set)`);
  }
  console.log(`\nDone: ${total} products reverted to gemini-embedding-001 this run.`);
}

if (require.main === module) {
  run().catch((err) => {
    process.exitCode = 1;
    console.error('Revert failed:', err);
  });
}

module.exports = { run };
