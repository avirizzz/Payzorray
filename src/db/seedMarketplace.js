require('dotenv').config();
const { supabase } = require('./index');
const { ProductSchema } = require('../schemas');
const { embedTexts } = require('../services/ai/embeddings');
const { loadBigBasket } = require('./marketplaceSeed/bigbasket');
const { loadAmazon } = require('./marketplaceSeed/amazon');
const { loadFlipkart } = require('./marketplaceSeed/flipkart');
const { stratifiedSample } = require('./marketplaceSeed/sample');
const { toProductRow } = require('./marketplaceSeed/build');

const UPSERT_BATCH_SIZE = 100;
const DRY_RUN = process.argv.includes('--dry-run');

const SOURCE_CONFIGS = [
  { name: 'bigbasket', load: loadBigBasket, merchantId: 'M-BIGBASKET-001', targetTotal: 900, floor: 10, capPerCategory: 300, weightOf: () => 1 },
  { name: 'amazon', load: loadAmazon, merchantId: 'M-AMAZON-001', targetTotal: 700, floor: 10, capPerCategory: 250, weightOf: () => 1 },
  {
    name: 'flipkart',
    load: loadFlipkart,
    merchantId: 'M-FLIPKART-001',
    targetTotal: 2000,
    floor: 10,
    capPerCategory: 220,
    weightOf: (cat) => (cat === 'Beauty and Personal Care' ? 0.4 : 1)
  }
];

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function buildCatalog() {
  let idx = 0;
  const allProducts = [];

  for (const config of SOURCE_CONFIGS) {
    const rows = config.load();
    console.log(`\n${config.name}: ${rows.length} cleaned rows available`);

    const { picked, droppedCategories, categoryCounts } = stratifiedSample(rows, {
      categoryOf: (r) => r.category,
      floor: config.floor,
      targetTotal: config.targetTotal,
      capPerCategory: config.capPerCategory,
      weightOf: config.weightOf
    });

    const droppedRowCount = droppedCategories.reduce((sum, d) => sum + d.count, 0);
    console.log(`  picked ${picked.length} across ${categoryCounts.length} categories`);
    console.log(`  dropped ${droppedCategories.length} categories below the floor of ${config.floor} (${droppedRowCount} rows total)`);
    for (const [cat, n] of categoryCounts) console.log(`    ${String(n).padStart(4)}  ${cat}`);

    for (const cleaned of picked) {
      allProducts.push(toProductRow(cleaned, config.merchantId, idx++));
    }
  }

  return allProducts;
}

async function run() {
  let products = buildCatalog();
  console.log(`\nTotal candidate products: ${products.length}`);

  if (DRY_RUN) {
    products = products.slice(0, 100);
    console.log(`--dry-run: limiting to first ${products.length} products (1 embedding batch)`);
  }

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

  const seenIds = new Set();
  const deduped = validated.filter((p) => {
    if (seenIds.has(p.product_id)) return false;
    seenIds.add(p.product_id);
    return true;
  });
  if (deduped.length !== validated.length) console.log(`  dropped ${validated.length - deduped.length} duplicate product_ids`);

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials. Aborting before spending embedding quota.');
    console.log('Sample of what would be inserted:', JSON.stringify(deduped.slice(0, 2), null, 2));
    return;
  }

  const merchantIds = [...new Set(deduped.map((p) => p.merchant_id))];
  const { data: existingRows, error: existingError } = await supabase.from('products').select('product_id').in('merchant_id', merchantIds);
  let remaining = deduped;
  if (existingError) {
    console.error('Could not check existing rows, proceeding without resume:', existingError);
  } else {
    const existingIds = new Set((existingRows || []).map((r) => r.product_id));
    remaining = deduped.filter((p) => !existingIds.has(p.product_id));
    if (existingIds.size) console.log(`\nResume: ${existingIds.size} products already seeded, skipping them (${deduped.length} -> ${remaining.length} remaining)`);
  }

  console.log(`\nGenerating embeddings + upserting ${remaining.length} products, ${UPSERT_BATCH_SIZE}/batch...`);
  const batches = chunk(remaining, UPSERT_BATCH_SIZE);
  let total = 0;
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const texts = batch.map((p) => `${p.name}. ${p.description} Tags: ${p.tags.join(', ')}`);
    const embeddings = await embedTexts(texts);
    const withEmbeddings = batch.map((p, j) => ({ ...p, embedding: embeddings[j] }));

    const { data, error } = await supabase.from('products').upsert(withEmbeddings).select();
    if (error) {
      console.error(`Upsert batch ${i + 1}/${batches.length} failed:`, error);
      console.error(`  ${total} products already committed before this failure -- safe to fix and re-run the whole script.`);
      return;
    }
    total += data?.length || 0;
    console.log(`  batch ${i + 1}/${batches.length}: ${total}/${remaining.length} upserted`);
  }
  console.log(`\nDone: ${total} marketplace products seeded.`);
}

if (require.main === module) {
  run().catch((err) => {
    process.exitCode = 1;
    console.error('Marketplace seed failed:', err);
  });
}

module.exports = { run, buildCatalog };
