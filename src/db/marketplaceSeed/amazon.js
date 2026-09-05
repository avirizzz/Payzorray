const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const SOURCE_PATH = path.join(__dirname, '..', '..', '..', 'data', 'marketplace_seed', 'amazon.csv');

const TRACKING_PIXEL_RE = /transparent-pixel/i;

function loadAmazon() {
  const raw = fs.readFileSync(SOURCE_PATH, 'utf8');
  const rows = parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true });

  const seen = new Set();
  const cleaned = [];

  for (const row of rows) {
    const title = row['Product Title']?.trim().replace(/\s+/g, ' ');
    if (!title) continue;

    let brand = row.Brand?.trim();
    if (!brand || brand === 'NA') brand = title.split(' ').slice(0, 2).join(' ') || 'Generic';

    const key = `${title}|${brand}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const price = Number(row.Price) || Number(row.Mrp);
    if (!price || price <= 0) continue;

    const images = (row['Image Urls'] || '')
      .split('|')
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//.test(u) && !TRACKING_PIXEL_RE.test(u));
    if (images.length === 0) continue;

    const category = row.Category?.trim();
    if (!category) continue;

    const packSize = row['Pack Size Or Quantity']?.trim();
    const stockAvailability = row['Stock Availibility']?.trim();

    cleaned.push({
      source: 'amazon',
      sourceId: row['Product Asin']?.trim() || row['Uniq Id']?.trim(),
      category,
      name: title.slice(0, 200),
      brand,
      price: Math.round(price),
      description: (row['Product Description'] || title).replace(/\s+/g, ' ').trim().slice(0, 1000),
      tags: [category, brand].filter(Boolean),
      images: images.slice(0, 4),
      specifications: {
        pack_size: packSize && packSize !== 'NA' ? packSize : null,
        stock_availability: stockAvailability || null
      }
    });
  }

  return cleaned;
}

module.exports = { loadAmazon };
