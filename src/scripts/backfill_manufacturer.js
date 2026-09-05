require('dotenv').config();
const { supabase } = require('../db/index');

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

async function backfill() {
  const { data: rows, error } = await supabase.from('products').select('product_id, model, specifications');
  if (error) throw error;

  console.log(`Patching manufacturer onto ${rows.length} products (no embedding calls)...`);
  let done = 0;
  for (const row of rows) {
    const manufacturer = deriveManufacturer(row.model);
    if (row.specifications?.manufacturer === manufacturer) {
      done++;
      continue;
    }
    const { error: updateError } = await supabase
      .from('products')
      .update({ specifications: { ...row.specifications, manufacturer } })
      .eq('product_id', row.product_id);
    if (updateError) throw updateError;
    done++;
    if (done % 100 === 0) console.log(`  ${done}/${rows.length}`);
  }

  console.log(`Done: ${done}/${rows.length} products patched.`);
}

if (require.main === module) {
  backfill().catch((err) => {
    process.exitCode = 1;
    console.error('Manufacturer backfill failed:', err);
  });
}

module.exports = { backfill, deriveManufacturer };
