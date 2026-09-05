const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { parse } = require('csv-parse/sync');

const SOURCE_PATH = path.join(__dirname, '..', '..', '..', 'data', 'marketplace_seed', 'flipkart.csv.gz');

function parseCategoryTree(str) {
  try {
    const arr = JSON.parse(str);
    return arr[0]?.split('>>')[0]?.trim() || null;
  } catch {
    const m = str?.match(/\["([^"]+)/);
    return m ? m[1].split('>>')[0].trim() : null;
  }
}

function parseImages(str) {
  try {
    const arr = JSON.parse(str);
    return Array.isArray(arr) ? arr.filter((u) => /^https?:\/\//.test(u)) : [];
  } catch {
    return [];
  }
}

function loadFlipkart() {
  const gz = fs.readFileSync(SOURCE_PATH);
  const raw = zlib.gunzipSync(gz).toString('utf8');
  const rows = parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true });

  const seen = new Set();
  const cleaned = [];

  for (const row of rows) {
    const name = row.product_name?.trim();
    if (!name) continue;

    let brand = row.brand?.trim();
    if (!brand) brand = name.split(' ')[0] || 'Generic';

    const key = `${name}|${brand}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const price = Number(row.discounted_price) || Number(row.retail_price);
    if (!price || price <= 0) continue;

    const images = parseImages(row.image);
    if (images.length === 0) continue;

    const category = parseCategoryTree(row.product_category_tree);
    if (!category) continue;

    cleaned.push({
      source: 'flipkart',
      sourceId: row.pid?.trim() || row.uniq_id?.trim(),
      category,
      name: name.slice(0, 200),
      brand,
      price: Math.round(price),
      description: (row.description || name).replace(/\s+/g, ' ').trim().slice(0, 1000),
      tags: [category, brand].filter(Boolean),
      images: images.slice(0, 4),
      specifications: {}
    });
  }

  return cleaned;
}

module.exports = { loadFlipkart };
