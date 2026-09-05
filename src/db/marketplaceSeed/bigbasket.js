const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const SOURCE_PATH = path.join(__dirname, '..', '..', '..', 'data', 'marketplace_seed', 'bigbasket.csv');

function loadBigBasket() {
  const raw = fs.readFileSync(SOURCE_PATH, 'utf8');
  const rows = parse(raw, { columns: true, skip_empty_lines: true });

  const seen = new Set();
  const cleaned = [];

  for (const row of rows) {
    const name = row.ProductName?.trim();
    const brand = row.Brand?.trim();
    if (!name || !brand) continue;

    const key = `${name}|${brand}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const price = Number(row.DiscountPrice) || Number(row.Price);
    if (!price || price <= 0) continue;

    const image = row.Image_Url?.trim();
    if (!image || !/^https?:\/\//.test(image)) continue;

    const category = row.Category?.trim();
    if (!category) continue;

    const subCategory = row.SubCategory?.trim();
    const quantity = row.Quantity?.trim();

    cleaned.push({
      source: 'bigbasket',
      sourceId: `${name}-${quantity || ''}`,
      category,
      name: quantity ? `${name} (${quantity})` : name,
      brand,
      price: Math.round(price),
      description: `${name} by ${brand}${subCategory ? `, ${subCategory}` : ''}.${quantity ? ` Pack size: ${quantity}.` : ''}`,
      tags: [category, subCategory, brand].filter(Boolean),
      images: [image],
      specifications: { pack_size: quantity || null, subcategory: subCategory || null, source_url: row.Absolute_Url || null }
    });
  }

  return cleaned;
}

module.exports = { loadBigBasket };
