const { fetchProductsByMerchantId } = require('../../db/retrieval');
const { fetchOrdersByProductIds, fetchOrderByIdUnscoped } = require('../../db/orders');
const { fetchAuditRecordsByProductIds, fetchAuditRecordsByApprovalId } = require('../../db/audit');
const { explainAuditRecord } = require('./explain');

const FLAGGED_ACTIONS = ['CREATE_ORDER', 'CANCEL_ORDER', 'REFUND_ORDER', 'WEBHOOK_REFUND_CREATED'];

async function getMerchantStats(merchantId) {
  const products = await fetchProductsByMerchantId(merchantId);
  const productIds = products.map((p) => p.product_id);
  const orders = (await fetchOrdersByProductIds(productIds)).filter((o) => o.status === 'COMPLETED');

  const revenue = orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  const orderCount = orders.length;

  return {
    merchant_id: merchantId,
    revenue: Math.round(revenue * 100) / 100,
    order_count: orderCount,
    average_order_value: orderCount ? Math.round((revenue / orderCount) * 100) / 100 : 0,
    catalog_size: products.length,
    currency: 'INR'
  };
}

async function getRecentOrders(merchantId, limit = 20) {
  const products = await fetchProductsByMerchantId(merchantId);
  const productIds = products.map((p) => p.product_id);
  const byId = new Map(products.map((p) => [p.product_id, p]));
  const orders = await fetchOrdersByProductIds(productIds);
  return orders.slice(0, limit).map((o) => {
    const product = byId.get(o.product_id);
    return {
      order_id: o.order_id,
      product_id: o.product_id,
      product_name: o.product_name || o.product_id,
      image: product?.images?.[0] || null,
      brand: product?.brand || null,
      category: product?.category || null,
      amount: o.amount,
      currency: o.currency,
      status: o.status,
      quantity: o.quantity,
      created_at: o.created_at
    };
  });
}

async function getFlaggedEvents(merchantId, limit = 5) {
  const products = await fetchProductsByMerchantId(merchantId);
  const productIds = products.map((p) => p.product_id);
  const records = await fetchAuditRecordsByProductIds(productIds, FLAGGED_ACTIONS, 50);
  return records
    .filter((r) => r.action !== 'CREATE_ORDER' || r.decision === 'DENIED')
    .slice(0, limit)
    .map((r) => ({
      action: r.action,
      product_id: r.product_id,
      decision: r.decision,
      reason: r.reason,
      timestamp: r.timestamp
    }));
}

async function getOrderDetails(merchantId, orderId) {
  const order = await fetchOrderByIdUnscoped(orderId);
  if (!order) return null;
  const products = await fetchProductsByMerchantId(merchantId);
  const product = products.find((p) => p.product_id === order.product_id);
  if (!product) return null;

  const activity = await fetchAuditRecordsByApprovalId(order.approval_id);

  return {
    order_id: order.order_id,
    product_id: order.product_id,
    product_name: order.product_name || product.name,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    quantity: order.quantity,
    shipping_option: order.shipping_option || null,
    shipping_cost: order.shipping_cost ?? null,
    coupon_code: order.coupon_code || null,
    discount_amount: order.discount_amount ?? null,
    created_at: order.created_at,
    activity: activity.map(explainAuditRecord)
  };
}

module.exports = { getMerchantStats, getRecentOrders, getFlaggedEvents, getOrderDetails };
