require('dotenv').config();
const { supabase } = require('./index');
const { ProductSchema } = require('../schemas');
const { embedTexts } = require('../services/ai/embeddings');
const { loadFlipkart } = require('./marketplaceSeed/flipkart');
const { toProductRow } = require('./marketplaceSeed/build');

const MERCHANT_ID = 'M-FLIPKART-001';
const DRY_RUN = process.argv.includes('--dry-run');

// Real Flipkart rows genuinely missing from the earlier stratified sample --
// "outfit" requests (t-shirt + jeans) were thin on real matches and a few
// "T-Shirt Bra" rows (a real but wrongly-adjacent product name in the source
// data) were crowding out actual t-shirts in search results. Every name
// below is copied verbatim from data/marketplace_seed/flipkart.csv.gz.
const WANTED_NAMES = [
  "Whistle Solid Men's Round Neck T-Shirt",
  "Candy House Solid Men's Polo Neck T-Shirt",
  "Scorpion Solid Men's Polo Neck T-Shirt",
  "Villagsio Solid Men's Polo Neck T-Shirt",
  "Spur Solid Men's Polo Neck T-Shirt",
  "Black Wing Graphic Print Men's V-neck T-Shirt",
  "Mustard Solid Women's Scoop Neck White T-Shirt",
  "Point Fit Solid Women's V-neck T-Shirt",
  "run of luck Solid Women's Polo Neck Pink T-Shirt",
  "Komnil Solid Women's Polo T-Shirt",
  "Go India Store Solid Women's Polo Neck Red, Black T-Shirt",
  "Go India Store Solid Women's Polo Neck Black, Dark Blue T-Shirt",
  "C9 Solid Women's Round Neck Pink T-Shirt",
  "Roadster Skinny Fit Women's Blue Jeans",
  "HRX by Hrithik Roshan Skinny Fit Women's Blue Jeans",
  "PI ZON Slim Fit Women's Blue Jeans",
  "TIMBERLAKE Slim Fit Fit Women's Blue Jeans",
  "SIESTA Slim Fit Women's Light Blue Jeans",
  "Reckler Slim Fit Men's Jeans",
  "NE Regular Fit Men's Jeans",
  "Lee Men's Jeans",
  "Roadster Skinny Fit Fit Men's Jeans",
  "EVER WEAR REGULAR Fit Women's Black Jeans"
];

async function run() {
  const allRows = loadFlipkart();
  const byName = new Map(allRows.map((r) => [r.name, r]));
  const picked = WANTED_NAMES.map((name) => byName.get(name)).filter(Boolean);
  const missing = WANTED_NAMES.filter((name) => !byName.has(name));
  if (missing.length) console.log(`Not found in the source CSV (skipped): ${missing.join(', ')}`);
  console.log(`Matched ${picked.length}/${WANTED_NAMES.length} curated outfit-basics rows.`);

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
  console.log(`Done: ${data?.length || 0} outfit-basics products seeded under ${MERCHANT_ID}.`);
}

if (require.main === module) {
  run().catch((err) => {
    process.exitCode = 1;
    console.error('Outfit-basics seed failed:', err);
  });
}

module.exports = { run };
