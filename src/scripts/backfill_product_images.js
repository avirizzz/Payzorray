require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { supabase } = require('../db/index');

const ARCHIVE_DIR = path.join(__dirname, '..', '..', 'archive');
const IMAGES_PER_PRODUCT = 2;

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function backfill() {
  const files = fs.readdirSync(ARCHIVE_DIR).filter((f) => f.toLowerCase().endsWith('.jpg'));
  const { data: products, error } = await supabase.from('products').select('product_id').order('product_id', { ascending: true });
  if (error) throw error;

  const needed = products.length * IMAGES_PER_PRODUCT;
  if (files.length < needed) {
    throw new Error(`Not enough images: need ${needed} for ${products.length} products at ${IMAGES_PER_PRODUCT} each, found ${files.length}`);
  }

  const shuffled = shuffle(files);

  console.log(`Assigning ${IMAGES_PER_PRODUCT} real photos to each of ${products.length} products (${needed}/${files.length} images used, no repeats)...`);

  let done = 0;
  for (const product of products) {
    const slice = shuffled.slice(done * IMAGES_PER_PRODUCT, (done + 1) * IMAGES_PER_PRODUCT);
    const images = slice.map((f) => `/car-images/${f}`);

    const { error: updateError } = await supabase.from('products').update({ images }).eq('product_id', product.product_id);
    if (updateError) throw updateError;

    done++;
    if (done % 100 === 0) console.log(`  ${done}/${products.length}`);
  }

  console.log(`Done: ${done}/${products.length} products now have real photos.`);
}

if (require.main === module) {
  backfill().catch((err) => {
    process.exitCode = 1;
    console.error('Image backfill failed:', err);
  });
}

module.exports = { backfill };
