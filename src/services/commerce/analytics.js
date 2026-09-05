const { fetchProductsByMerchantId } = require('../../db/retrieval');
const { fetchOrdersByProductIds } = require('../../db/orders');

const LOW_STOCK_THRESHOLD = 10;

function round2(n) {
  return Math.round(n * 100) / 100;
}

function dayKey(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

async function getMerchantAnalytics(merchantId, { days = 30 } = {}) {
  const products = await fetchProductsByMerchantId(merchantId);
  const productIds = products.map((p) => p.product_id);
  const productById = new Map(products.map((p) => [p.product_id, p]));
  const allOrders = await fetchOrdersByProductIds(productIds);

  const paid = allOrders.filter((o) => o.status === 'COMPLETED');
  const failed = allOrders.filter((o) => o.status === 'PAYMENT_FAILED');
  const refunded = allOrders.filter((o) => o.status === 'REFUNDED');
  const cancelled = allOrders.filter((o) => o.status === 'CANCELLED');

  const revenue = paid.reduce((s, o) => s + Number(o.amount || 0), 0);
  const unitsSold = paid.reduce((s, o) => s + Number(o.quantity || 0), 0);

  const revenueByDay = new Map();
  for (const o of paid) {
    const k = dayKey(o.created_at);
    revenueByDay.set(k, (revenueByDay.get(k) || 0) + Number(o.amount || 0));
  }
  const ordersByDay = new Map();
  for (const o of paid) {
    const k = dayKey(o.created_at);
    ordersByDay.set(k, (ordersByDay.get(k) || 0) + 1);
  }
  const series = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const k = d.toISOString().slice(0, 10);
    series.push({ date: k, revenue: round2(revenueByDay.get(k) || 0), orders: ordersByDay.get(k) || 0 });
  }

  function rollUp(keyFn) {
    const map = new Map();
    for (const o of paid) {
      const key = keyFn(o);
      if (!key) continue;
      const cur = map.get(key) || { revenue: 0, orders: 0, units: 0 };
      cur.revenue += Number(o.amount || 0);
      cur.orders += 1;
      cur.units += Number(o.quantity || 0);
      map.set(key, cur);
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name, revenue: round2(v.revenue), orders: v.orders, units: v.units }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  const topProducts = rollUp((o) => o.product_name || o.product_id).slice(0, 8);
  const topCategories = rollUp((o) => productById.get(o.product_id)?.category).slice(0, 8);
  const topBrands = rollUp((o) => productById.get(o.product_id)?.brand).slice(0, 8);

  const byCustomer = new Map();
  for (const o of paid) {
    if (!o.customer_id) continue;
    const cur = byCustomer.get(o.customer_id) || { orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += Number(o.amount || 0);
    byCustomer.set(o.customer_id, cur);
  }
  const customers = [...byCustomer.values()];
  const repeatCustomers = customers.filter((c) => c.orders > 1).length;

  const unitsSoldByProduct = new Map();
  for (const o of paid) {
    unitsSoldByProduct.set(o.product_id, (unitsSoldByProduct.get(o.product_id) || 0) + Number(o.quantity || 0));
  }
  const outOfStock = products.filter((p) => Number(p.stock) === 0);
  const lowStock = products
    .filter((p) => Number(p.stock) > 0 && Number(p.stock) <= LOW_STOCK_THRESHOLD)
    .map((p) => ({ product_id: p.product_id, name: p.name, stock: Number(p.stock), units_sold: unitsSoldByProduct.get(p.product_id) || 0 }))
    .sort((a, b) => b.units_sold - a.units_sold || a.stock - b.stock)
    .slice(0, 10);

  const revenueLostToFailures = failed.reduce((s, o) => s + Number(o.amount || 0), 0);
  const refundedAmount = refunded.reduce((s, o) => s + Number(o.amount || 0), 0);

  const attempted = paid.length + failed.length;

  return {
    merchant_id: merchantId,
    currency: 'INR',
    window_days: days,

    totals: {
      revenue: round2(revenue),
      orders: paid.length,
      units_sold: unitsSold,
      average_order_value: paid.length ? round2(revenue / paid.length) : 0,
      catalog_size: products.length,
      unique_customers: byCustomer.size,
      repeat_customers: repeatCustomers,
      repeat_rate_pct: byCustomer.size ? round2((repeatCustomers / byCustomer.size) * 100) : 0,
      revenue_per_customer: byCustomer.size ? round2(revenue / byCustomer.size) : 0
    },

    payments: {
      completed: paid.length,
      failed: failed.length,
      refunded: refunded.length,
      cancelled: cancelled.length,
      success_rate_pct: attempted ? round2((paid.length / attempted) * 100) : 0,
      revenue_lost_to_failures: round2(revenueLostToFailures),
      refunded_amount: round2(refundedAmount)
    },

    fulfilment: {
      shipping_collected: round2(paid.reduce((s, o) => s + Number(o.shipping_cost || 0), 0)),
      discounts_given: round2(paid.reduce((s, o) => s + Number(o.discount_amount || 0), 0)),
      orders_with_coupon: paid.filter((o) => o.coupon_code).length
    },

    inventory: {
      out_of_stock: outOfStock.length,
      low_stock_count: lowStock.length,
      low_stock_products: lowStock,
      total_stock_units: products.reduce((s, p) => s + Number(p.stock || 0), 0)
    },

    series,
    top_products: topProducts,
    top_categories: topCategories,
    top_brands: topBrands
  };
}

async function getBusinessDiagnosis(merchantId) {
  const { getLowReadinessProducts } = require('./readiness');
  const [analytics, readinessResult] = await Promise.all([
    getMerchantAnalytics(merchantId),
    getLowReadinessProducts(merchantId).catch(() => ({ products: [], pending: false }))
  ]);
  const { products: readiness, pending: readinessPending } = readinessResult;

  const products = await fetchProductsByMerchantId(merchantId);
  const productIds = products.map((p) => p.product_id);
  const paid = (await fetchOrdersByProductIds(productIds)).filter((o) => o.status === 'COMPLETED');

  const soldIds = new Set(paid.map((o) => o.product_id));
  const neverSold = products.filter((p) => !soldIds.has(p.product_id));

  const readinessById = new Map(readiness.map((r) => [r.product_id, r]));

  const invisibleAndUnsoldAll = neverSold
    .map((p) => readinessById.get(p.product_id))
    .filter((r) => r && r.score !== null && r.score < 70)
    .sort((a, b) => a.score - b.score);

  const invisibleAndUnsold = {
    threshold: 'readiness score below 70 (critical or needs-work) and never sold',
    total_matching: invisibleAndUnsoldAll.length,
    counts_by_band: {
      critical: invisibleAndUnsoldAll.filter((r) => r.score < 40).length,
      needs_work: invisibleAndUnsoldAll.filter((r) => r.score >= 40 && r.score < 70).length
    },
    showing: Math.min(10, invisibleAndUnsoldAll.length),
    items: invisibleAndUnsoldAll.slice(0, 10).map((r) => ({
      product_id: r.product_id,
      name: r.name,
      score: r.score,
      band: r.score < 40 ? 'critical' : 'needs work',
      verdict: r.verdict
    }))
  };

  const unitsByProduct = new Map();
  for (const o of paid) unitsByProduct.set(o.product_id, (unitsByProduct.get(o.product_id) || 0) + Number(o.quantity || 0));
  const sellersAtRisk = products
    .filter((p) => unitsByProduct.get(p.product_id) && Number(p.stock) <= LOW_STOCK_THRESHOLD)
    .map((p) => ({ product_id: p.product_id, name: p.name, stock: Number(p.stock), units_sold: unitsByProduct.get(p.product_id) }))
    .sort((a, b) => b.units_sold - a.units_sold)
    .slice(0, 10);

  const topShare = analytics.totals.revenue
    ? round2((analytics.top_products[0]?.revenue || 0) / analytics.totals.revenue * 100)
    : 0;

  const revenueByCategory = new Map(analytics.top_categories.map((c) => [c.name, c.revenue]));
  const categoryStock = new Map();
  for (const p of products) {
    if (!p.category) continue;
    categoryStock.set(p.category, (categoryStock.get(p.category) || 0) + 1);
  }
  const slowCategories = [...categoryStock.entries()]
    .filter(([name]) => !revenueByCategory.get(name))
    .map(([name, productCount]) => ({ name, product_count: productCount }))
    .sort((a, b) => b.product_count - a.product_count)
    .slice(0, 5);

  const suggestedCampaigns = [];

  if (slowCategories.length) {
    const c = slowCategories[0];
    suggestedCampaigns.push({
      kind: 'coupon',
      reason: `"${c.name}" holds ${c.product_count} products but has produced no revenue.`,
      scope_type: 'category',
      scope_value: c.name,
      suggested_discount_type: 'percent',
      suggested_discount_value: 10,
      discount_range: { min: 5, max: 20 }
    });
  }

  if (invisibleAndUnsoldAll.length) {
    const worst = invisibleAndUnsoldAll[0];
    suggestedCampaigns.push({
      kind: 'coupon',
      reason: `"${worst.name}" has never sold and scores ${worst.score}/100 for AI findability.`,
      scope_type: 'product',
      scope_value: worst.product_id,
      suggested_discount_type: 'percent',
      suggested_discount_value: 15,
      discount_range: { min: 5, max: 25 }
    });
  }

  const topProductRow = products.find((p) => p.name === analytics.top_products[0]?.name);
  if (topShare >= 40 && topProductRow && invisibleAndUnsoldAll.length) {
    const pairWith = invisibleAndUnsoldAll[0];
    suggestedCampaigns.push({
      kind: 'bundle',
      reason: `${topShare}% of revenue comes from "${topProductRow.name}". Pairing it with a product that has never sold uses that demand to move stock.`,
      primary_product_id: topProductRow.product_id,
      primary_product_name: topProductRow.name,
      paired_product_id: pairWith.product_id,
      paired_product_name: pairWith.name,
      suggested_discount_type: 'percent',
      suggested_discount_value: 15,
      discount_range: { min: 5, max: 30 }
    });
  }

  return {
    merchant_id: merchantId,
    totals: analytics.totals,
    payments: analytics.payments,

    concentration: {
      top_product: analytics.top_products[0]?.name || null,
      top_product_revenue_share_pct: topShare,
      products_generating_revenue: soldIds.size,
      catalog_size: products.length,
      never_sold_count: neverSold.length,
      never_sold_share_pct: products.length ? round2((neverSold.length / products.length) * 100) : 0
    },

    catalog_quality: {
      graded: readiness.filter((r) => r.score !== null).length,
      critical: readiness.filter((r) => r.score !== null && r.score < 40).length,
      needs_work: readiness.filter((r) => r.score !== null && r.score >= 40 && r.score < 70).length,
      ready: readiness.filter((r) => r.score !== null && r.score >= 70).length,
      still_grading: readinessPending
    },

    unsold_and_hard_to_find: invisibleAndUnsold,
    best_sellers_low_on_stock: sellersAtRisk,
    slow_categories: slowCategories,
    revenue_lost_to_failed_payments: analytics.payments.revenue_lost_to_failures,

    suggested_campaigns: suggestedCampaigns
  };
}

module.exports = { getMerchantAnalytics, getBusinessDiagnosis };
