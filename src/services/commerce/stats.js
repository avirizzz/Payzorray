const { listOrdersByCustomerId } = require('../../db/orders');
const { getProductById } = require('../../db/retrieval');

const DAY_MS = 24 * 60 * 60 * 1000;

function addBucket(map, key, amount) {
  if (!key) return;
  const existing = map.get(key) || { total: 0, count: 0 };
  existing.total += amount;
  existing.count += 1;
  map.set(key, existing);
}

function bucketsToSortedArray(map, keyName) {
  return [...map.entries()]
    .map(([key, v]) => ({ [keyName]: key, total: Math.round(v.total * 100) / 100, count: v.count }))
    .sort((a, b) => b.total - a.total);
}

async function getSpendingStats(customerId) {
  const orders = (await listOrdersByCustomerId(customerId)).filter((o) => o.status === 'COMPLETED');

  const now = Date.now();
  const since7 = now - 7 * DAY_MS;
  const since30 = now - 30 * DAY_MS;

  let totalSpend = 0;
  let last7Days = 0;
  let last30Days = 0;
  const byCategory = new Map();
  const byBrand = new Map();

  const productCache = new Map();
  async function lookupProduct(productId) {
    if (productCache.has(productId)) return productCache.get(productId);
    const product = await getProductById(productId).catch(() => null);
    productCache.set(productId, product);
    return product;
  }

  for (const order of orders) {
    const amount = Number(order.amount) || 0;
    totalSpend += amount;
    const createdAtMs = new Date(order.created_at).getTime();
    if (createdAtMs >= since7) last7Days += amount;
    if (createdAtMs >= since30) last30Days += amount;

    const product = await lookupProduct(order.product_id);
    addBucket(byCategory, product?.category, amount);
    addBucket(byBrand, product?.brand, amount);
  }

  return {
    order_count: orders.length,
    currency: 'INR',
    total_spend: Math.round(totalSpend * 100) / 100,
    last_7_days: Math.round(last7Days * 100) / 100,
    last_30_days: Math.round(last30Days * 100) / 100,
    by_category: bucketsToSortedArray(byCategory, 'category'),
    by_brand: bucketsToSortedArray(byBrand, 'brand')
  };
}

module.exports = { getSpendingStats };
