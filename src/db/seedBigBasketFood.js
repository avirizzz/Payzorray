require('dotenv').config();
const { supabase } = require('./index');
const { ProductSchema } = require('../schemas');
const { embedTexts } = require('../services/ai/embeddings');
const { loadBigBasket } = require('./marketplaceSeed/bigbasket');
const { stratifiedSample } = require('./marketplaceSeed/sample');
const { toProductRow } = require('./marketplaceSeed/build');

const MERCHANT_ID = 'M-BIGBASKET-001';
const UPSERT_BATCH_SIZE = 100;
const INTER_BATCH_COOLDOWN_MS = 45000;
const DRY_RUN = process.argv.includes('--dry-run');

const INCLUDED_CATEGORIES = new Set([
  'Foodgrains, Oil & Masala',
  'Gourmet & World Food',
  'Snacks & Branded Foods',
  'Eggs, Meat & Fish',
  'Bakery, Cakes & Dairy',
  'Beverages',
  'Fruits & Vegetables'
]);

async function run() {
  const allRows = loadBigBasket();
  const scoped = allRows.filter((r) => INCLUDED_CATEGORIES.has(r.category));
  console.log(`BigBasket: ${allRows.length} cleaned rows total, ${scoped.length} in food/recipe categories`);

  const { picked, droppedCategories, categoryCounts } = stratifiedSample(scoped, {
    categoryOf: (r) => r.category,
    floor: 10,
    targetTotal: 260,
    capPerCategory: 90,
    seed: 7
  });

  console.log(`\nPicked ${picked.length} across ${categoryCounts.length} categories:`);
  for (const [cat, n] of categoryCounts) console.log(`  ${String(n).padStart(4)}  ${cat}`);
  if (droppedCategories.length) {
    console.log(`Dropped (below floor of 10): ${droppedCategories.map((d) => `${d.cat} (${d.count})`).join(', ')}`);
  }

  const products = picked.map((cleaned, i) => toProductRow(cleaned, MERCHANT_ID, i));

  console.log('\nValidating against ProductSchema...');
  const validated = [];
  const rejected = [];
  for (const p of products) {
    const result = ProductSchema.safeParse(p);
    if (result.success) validated.push(result.data);
    else rejected.push({ id: p.product_id, error: result.error.issues[0] });
  }
  console.log(`  ${validated.length} valid, ${rejected.length} rejected`);
  if (rejected.length) console.log('  sample rejects:', JSON.stringify(rejected.slice(0, 5), null, 2));

  if (DRY_RUN) {
    console.log(`\n--dry-run: stopping before spending any embedding quota. Would seed ${validated.length} products under merchant_id ${MERCHANT_ID}.`);
    return;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials. Aborting before spending embedding quota.');
    return;
  }

  const { data: existingRows, error: existingError } = await supabase.from('products').select('product_id').eq('merchant_id', MERCHANT_ID);
  let remaining = validated;
  if (existingError) {
    console.error('Could not check existing rows, proceeding without resume:', existingError);
  } else {
    const existingIds = new Set((existingRows || []).map((r) => r.product_id));
    remaining = validated.filter((p) => !existingIds.has(p.product_id));
    if (existingIds.size) console.log(`\nResume: ${existingIds.size} products already exist under this merchant, skipping any that overlap (${validated.length} -> ${remaining.length} remaining)`);
  }

  if (!remaining.length) {
    console.log('\nNothing left to seed -- all candidate products already exist.');
    return;
  }

  console.log(`\nGenerating embeddings + upserting ${remaining.length} products, ${UPSERT_BATCH_SIZE}/upsert-batch...`);
  const batches = [];
  for (let i = 0; i < remaining.length; i += UPSERT_BATCH_SIZE) batches.push(remaining.slice(i, i + UPSERT_BATCH_SIZE));

  let total = 0;
  for (let i = 0; i < batches.length; i++) {
    if (i > 0) {
      console.log(`  cooling down ${INTER_BATCH_COOLDOWN_MS / 1000}s before the next batch (per-minute embedding quota)...`);
      await new Promise((r) => setTimeout(r, INTER_BATCH_COOLDOWN_MS));
    }
    const batch = batches[i];
    const texts = batch.map((p) => `${p.name}. ${p.description} Tags: ${p.tags.join(', ')}`);
    const embeddings = await embedTexts(texts);
    const withEmbeddings = batch.map((p, j) => ({ ...p, embedding: embeddings[j] }));

    const { data, error } = await supabase.from('products').upsert(withEmbeddings).select();
    if (error) {
      console.error(`Upsert batch ${i + 1}/${batches.length} failed:`, error);
      console.error(`  ${total} products already committed before this failure -- safe to fix and re-run.`);
      return;
    }
    total += data?.length || 0;
    console.log(`  batch ${i + 1}/${batches.length}: ${total}/${remaining.length} upserted`);
  }
  console.log(`\nDone: ${total} BigBasket food/recipe products seeded under ${MERCHANT_ID}.`);
}

if (require.main === module) {
  run().catch((err) => {
    process.exitCode = 1;
    console.error('BigBasket food seed failed:', err);
  });
}

module.exports = { run };
