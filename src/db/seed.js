const fs = require('fs');
const path = require('path');
const { supabase } = require('./index');
const { ProductSchema } = require('../schemas');
const { embedTexts } = require('../services/ai/embeddings');

const merchantId = 'M-HOTWHEELS-001';
const USD_TO_INR = 83;

const SEED_DATA_PATH = path.join(__dirname, '..', '..', 'hotwheels_products.json');
const UPSERT_BATCH_SIZE = 100;

const OLD_SEED_PRODUCT_IDS = [
  'HW-R33-001', 'HW-R34-001', 'HW-R32-001', 'HW-SUPRA-001', 'HW-RX7-001', 'DISP-CASE-64',
  ...Array.from({ length: 25 }, (_, i) => `HW-FILLER-${String(i + 1).padStart(3, '0')}`)
];

const TWO_WORD_MANUFACTURERS = ['Land Rover'];
const CUSTOM_BUILD_PREFIX = 'Custom';
const CUSTOM_BUILD_LABEL = 'Custom Builds';

function deriveManufacturer(model) {
  for (const make of TWO_WORD_MANUFACTURERS) {
    if (model.startsWith(make)) return make;
  }
  const firstWord = model.split(' ')[0];
  if (firstWord === CUSTOM_BUILD_PREFIX) return CUSTOM_BUILD_LABEL;
  return firstWord;
}

function loadSourceProducts() {
  const raw = JSON.parse(fs.readFileSync(SEED_DATA_PATH, 'utf8'));
  return raw.map((p) => ({
    product_id: p.product_id,
    name: p.name,
    category: p.category,
    brand: p.brand,
    model: p.model,
    variant: p.variant,
    specifications: { ...p.specifications, manufacturer: deriveManufacturer(p.model) },
    description: p.description,
    tags: p.tags,
    price: Math.round(p.price * USD_TO_INR),
    currency: 'INR',
    stock: p.stock,
    images: [p.images.main, ...(p.images.gallery || [])],
    product_relationships: [],
    compatibility: [],
    bundle_relationships: [],
    merchant_id: merchantId,
    updated_at: new Date().toISOString()
  }));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function seed() {
  console.log('Loading + validating products against Zod schema...');
  const products = loadSourceProducts();
  const validatedProducts = products.map((p) => ProductSchema.parse(p));

  console.log(`Attempting to insert ${validatedProducts.length} products...`);

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials. Seed aborted.');
    console.log('Sample of data that would be inserted:', JSON.stringify(validatedProducts.slice(0, 2), null, 2));
    return;
  }

  console.log(`Deleting ${OLD_SEED_PRODUCT_IDS.length} old seed products (scoped by id)...`);
  const { error: deleteError } = await supabase.from('products').delete().in('product_id', OLD_SEED_PRODUCT_IDS);
  if (deleteError) {
    console.error('Error deleting old seed products:', deleteError);
    return;
  }

  console.log('Generating embeddings for retrieval (batched, ~100 per API call)...');
  const embeddingTexts = validatedProducts.map((p) => `${p.name}. ${p.description} Tags: ${p.tags.join(', ')}`);
  const embeddings = await embedTexts(embeddingTexts);
  const productsWithEmbeddings = validatedProducts.map((p, i) => ({ ...p, embedding: embeddings[i] }));

  let totalInserted = 0;
  for (const batch of chunk(productsWithEmbeddings, UPSERT_BATCH_SIZE)) {
    const { data, error } = await supabase.from('products').upsert(batch).select();
    if (error) {
      console.error('Error seeding products batch:', error);
      return;
    }
    totalInserted += data?.length || 0;
    console.log(`  ${totalInserted}/${productsWithEmbeddings.length} upserted`);
  }

  console.log('Successfully seeded products:', totalInserted);
}

if (require.main === module) {
  seed().catch((err) => {
    process.exitCode = 1; // Must exit(1) on failure or CI sees a false success.
    console.error('Seed failed:', err);
  });
}

module.exports = { seed };
