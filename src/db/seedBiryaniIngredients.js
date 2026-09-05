require('dotenv').config();
const { supabase } = require('./index');
const { ProductSchema } = require('../schemas');
const { embedTexts } = require('../services/ai/embeddings');
const { loadBigBasket } = require('./marketplaceSeed/bigbasket');
const { toProductRow } = require('./marketplaceSeed/build');

const MERCHANT_ID = 'M-BIGBASKET-001';
const DRY_RUN = process.argv.includes('--dry-run');

// Real BigBasket rows genuinely missing from the earlier stratified sample --
// biryani searches were returning near-misses or unrelated products because
// these specific ingredients were never picked. No fabricated products: every
// name below is copied verbatim from data/marketplace_seed/bigbasket.csv.
const WANTED_NAMES = [
  'Cow Ghee/Tuppa Desi (500 ml)',
  'Cow Ghee/Tuppa - Organic Bilona (250 ml)',
  'A2 Desi Cow Ghee (453 g)',
  'Biryani Basmati Rice/Basmati Akki - Extra Long (5 kg)',
  'Biryani Basmati Rice - Extra Long (2x1 Kg)',
  'Biryani Basamti Rice/Akki (1 kg)',
  'Biriyani masala (50 g)',
  'Garam Masala (50 g)',
  'Shahi Garam Masala - With Exotic Spices (100 g)',
  'Coriander Seeds/Kottambari Beeja (200 g)',
  'Coriander/Dhania Powder (100 g)',
  'Organic - Cardamom/Elachi Green (2x50 g)',
  'Cardamom/Elaichi - Black (100 g)',
  'Mint Leaves - Cleaned, without roots (100 g)',
  'Farm Fresh Curd/Dahi - Premium, No Preservatives (500 g)',
  'Organic Curd (200 g)'
];

async function run() {
  const allRows = loadBigBasket();
  const byName = new Map(allRows.map((r) => [r.name, r]));
  const picked = WANTED_NAMES.map((name) => byName.get(name)).filter(Boolean);
  const missing = WANTED_NAMES.filter((name) => !byName.has(name));
  if (missing.length) console.log(`Not found in the source CSV (skipped): ${missing.join(', ')}`);
  console.log(`Matched ${picked.length}/${WANTED_NAMES.length} curated biryani-ingredient rows.`);

  const products = picked.map((cleaned, i) => toProductRow(cleaned, MERCHANT_ID, i));

  const validated = [];
  for (const p of products) {
    const result = ProductSchema.safeParse(p);
    if (result.success) validated.push(result.data);
    else console.log(`  rejected ${p.product_id}:`, result.error.issues[0]);
  }
  console.log(`${validated.length} valid against ProductSchema.`);

  if (DRY_RUN) {
    console.log(`\n--dry-run: would seed these ${validated.length} products:`);
    validated.forEach((p) => console.log(`  ${p.product_id}  ${p.name}  (${p.category})`));
    return;
  }

  const { data: existingRows, error: existingError } = await supabase.from('products').select('product_id').eq('merchant_id', MERCHANT_ID);
  let remaining = validated;
  if (existingError) {
    console.error('Could not check existing rows, proceeding without resume:', existingError);
  } else {
    const existingIds = new Set((existingRows || []).map((r) => r.product_id));
    remaining = validated.filter((p) => !existingIds.has(p.product_id));
    if (validated.length !== remaining.length) console.log(`Resume: ${validated.length - remaining.length} already exist, skipping.`);
  }

  if (!remaining.length) {
    console.log('Nothing left to seed -- all candidates already exist.');
    return;
  }

  console.log(`Generating embeddings + upserting ${remaining.length} products...`);
  const texts = remaining.map((p) => `${p.name}. ${p.description} Tags: ${p.tags.join(', ')}`);
  const embeddings = await embedTexts(texts);
  const withEmbeddings = remaining.map((p, j) => ({ ...p, embedding: embeddings[j] }));

  const { data, error } = await supabase.from('products').upsert(withEmbeddings).select();
  if (error) throw error;
  console.log(`Done: ${data?.length || 0} biryani-ingredient products seeded under ${MERCHANT_ID}.`);
}

if (require.main === module) {
  run().catch((err) => {
    process.exitCode = 1;
    console.error('Biryani-ingredient seed failed:', err);
  });
}

module.exports = { run };
