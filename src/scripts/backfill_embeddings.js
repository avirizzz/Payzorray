require('dotenv').config();
const { supabase } = require('../db/index');
const { embedTexts } = require('../services/ai/embeddings');

const BATCH_SIZE = 100;

async function backfill() {
  const { data: rows, error } = await supabase
    .from('products')
    .select('product_id, name, description, tags')
    .is('embedding', null);

  if (error) throw error;

  if (!rows || rows.length === 0) {
    console.log('No products missing embeddings.');
    return;
  }

  console.log(`Backfilling embeddings for ${rows.length} products...`);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const texts = batch.map(p => `${p.name}. ${p.description} Tags: ${(p.tags || []).join(', ')}`);
    const embeddings = await embedTexts(texts);

    for (let j = 0; j < batch.length; j++) {
      const { error: updateError } = await supabase
        .from('products')
        .update({ embedding: embeddings[j] })
        .eq('product_id', batch[j].product_id);
      if (updateError) throw updateError;
    }

    console.log(`  ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} done`);
  }

  console.log('Backfill complete.');
}

if (require.main === module) {
  backfill().catch(err => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  });
}

module.exports = { backfill };
