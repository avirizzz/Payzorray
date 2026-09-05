require('dotenv').config();
const fs = require('fs');
const { supabase } = require('./index');
const { embedTexts } = require('../services/ai/embeddings');
const { stratifiedSample } = require('./marketplaceSeed/sample');

const PROGRESS_PATH = '/private/tmp/claude-501/-Users-avirizzz-7-projects-Shopitforme/e602f414-7bde-4e89-a75d-83f881cae178/scratchpad/reembed_progress.json';
function loadProgress() {
  try {
    return new Set(JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8')));
  } catch {
    return new Set();
  }
}
function saveProgress(doneSet) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify([...doneSet]));
}

const TARGET_TOTAL = 480;
const BATCH_SIZE = 90;
const INTER_BATCH_COOLDOWN_MS = 66000;
const DRY_RUN = process.argv.includes('--dry-run');

const EXCLUDED_MERCHANTS = new Set(['M-HOTWHEELS-001']);

// PostgREST caps select() at 1000 rows without .range().
async function fetchAllProducts() {
  const PAGE = 1000;
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('products')
      .select('product_id, name, description, tags, category, merchant_id')
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

async function run() {
  const allProducts = await fetchAllProducts();
  const products = allProducts.filter((p) => !EXCLUDED_MERCHANTS.has(p.merchant_id));
  console.log(`Catalog: ${allProducts.length} real products total, ${products.length} after excluding ${[...EXCLUDED_MERCHANTS].join(', ')}`);

  const { picked, categoryCounts } = stratifiedSample(products, {
    categoryOf: (p) => `${p.merchant_id}::${p.category}`,
    floor: 3,
    targetTotal: TARGET_TOTAL,
    capPerCategory: 60,
    seed: 99
  });

  console.log(`\nPicked ${picked.length} across ${categoryCounts.length} (merchant, category) groups:`);
  for (const [group, n] of categoryCounts) console.log(`  ${String(n).padStart(3)}  ${group}`);

  if (DRY_RUN) {
    console.log(`\n--dry-run: stopping before spending any embedding quota. Would re-embed ${picked.length} existing products (UPDATE only, no inserts).`);
    return;
  }

  const done = loadProgress();
  const remaining = picked.filter((p) => !done.has(p.product_id));
  if (done.size) console.log(`\nResume: ${done.size} already re-embedded in a prior run of this exact set, skipping them (${picked.length} -> ${remaining.length} remaining)`);
  if (!remaining.length) {
    console.log('\nNothing left to re-embed -- this whole picked set is already done.');
    return;
  }

  console.log(`\nRe-embedding ${remaining.length} products under gemini-embedding-2 -- ${BATCH_SIZE}/batch, ${INTER_BATCH_COOLDOWN_MS / 1000}s cooldown between batches...`);
  const batches = [];
  for (let i = 0; i < remaining.length; i += BATCH_SIZE) batches.push(remaining.slice(i, i + BATCH_SIZE));

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
      done.add(batch[j].product_id);
      saveProgress(done);
    }
    console.log(`  batch ${i + 1}/${batches.length}: ${total}/${remaining.length} re-embedded this run (${done.size}/${picked.length} of the whole picked set)`);
  }
  console.log(`\nDone: ${total} existing products re-embedded this run under gemini-embedding-2 (0 new rows created).`);
}

if (require.main === module) {
  run().catch((err) => {
    process.exitCode = 1;
    console.error('Re-embed failed:', err);
  });
}

module.exports = { run };
