const SOURCE_PREFIX = { bigbasket: 'BB', amazon: 'AMZ', flipkart: 'FK' };

function synthesizeStock(cleaned) {
  if (cleaned.source === 'amazon') {
    const available = cleaned.specifications?.stock_availability?.toUpperCase() !== 'NO';
    return available ? 40 + Math.floor(Math.random() * 60) : 0;
  }
  return 15 + Math.floor(Math.random() * 85);
}

const SOURCES_WITH_STABLE_EXTERNAL_ID = new Set(['amazon', 'flipkart']);

function buildProductId(cleaned, fallbackIndex) {
  const prefix = SOURCE_PREFIX[cleaned.source];
  if (cleaned.sourceId && SOURCES_WITH_STABLE_EXTERNAL_ID.has(cleaned.source)) {
    const slug = String(cleaned.sourceId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32) || `row-${fallbackIndex}`;
    return `${prefix}-${slug}`;
  }
  const raw = String(cleaned.sourceId || `row-${fallbackIndex}`).replace(/[^a-zA-Z0-9]/g, '');
  const slug = raw.slice(0, 24) || 'row';
  return `${prefix}-${slug}-${fallbackIndex}`;
}

function toProductRow(cleaned, merchantId, fallbackIndex) {
  return {
    product_id: buildProductId(cleaned, fallbackIndex),
    name: cleaned.name,
    category: cleaned.category,
    brand: cleaned.brand,
    specifications: cleaned.specifications || {},
    description: cleaned.description,
    tags: cleaned.tags,
    price: cleaned.price,
    currency: 'INR',
    stock: synthesizeStock(cleaned),
    images: cleaned.images,
    product_relationships: [],
    compatibility: [],
    bundle_relationships: [],
    merchant_id: merchantId,
    updated_at: new Date().toISOString()
  };
}

module.exports = { toProductRow, buildProductId };
