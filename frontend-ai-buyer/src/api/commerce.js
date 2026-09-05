import { apiFetch } from './client';

export async function getShippingOptions({ productId, addressId, customerId }) {
  const params = new URLSearchParams({ product_id: productId });
  if (addressId) params.set('address_id', addressId);
  if (customerId) params.set('customer_id', customerId);
  const { options } = await apiFetch(`/commerce/shipping-options?${params.toString()}`);
  return options;
}

export async function listCoupons(productId) {
  const params = new URLSearchParams();
  if (productId) params.set('product_id', productId);
  const { coupons } = await apiFetch(`/commerce/coupons?${params.toString()}`);
  return coupons;
}

export async function listCouponsForCart(merchantId, items) {
  const params = new URLSearchParams({ merchant_id: merchantId, items: JSON.stringify(items) });
  const { coupons } = await apiFetch(`/commerce/coupons?${params.toString()}`);
  return coupons;
}

export async function validateCoupon(code, orderAmount, productId) {
  return apiFetch('/commerce/coupons/validate', { method: 'POST', body: JSON.stringify({ code, order_amount: orderAmount, product_id: productId }) });
}

export async function validateCouponForCart(code, merchantId, items) {
  return apiFetch('/commerce/coupons/validate', { method: 'POST', body: JSON.stringify({ code, merchant_id: merchantId, items }) });
}

export async function listOrders(customerId) {
  const { orders } = await apiFetch(`/commerce/orders?customer_id=${encodeURIComponent(customerId)}`);
  return orders;
}

export async function getSpendingStats(customerId) {
  return apiFetch(`/commerce/stats?customer_id=${encodeURIComponent(customerId)}`);
}

// Also used by the no-token 'pay another way' checkout path.
export async function createOrder(payload) {
  return apiFetch('/commerce/orders', { method: 'POST', body: JSON.stringify(payload) });
}

export async function cancelOrder({ orderId, customerId, conversationId }) {
  return apiFetch(`/commerce/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ customer_id: customerId, conversation_id: conversationId })
  });
}

export async function getUpsellOffer(productId, conversationId) {
  const params = new URLSearchParams({ product_id: productId });
  if (conversationId) params.set('conversation_id', conversationId);
  const { offer } = await apiFetch(`/commerce/upsell?${params.toString()}`);
  return offer;
}

export async function recordUpsellResponse({ productId, primaryProductId, accepted, amount, conversationId, source, campaignId }) {
  return apiFetch('/commerce/upsell/respond', {
    method: 'POST',
    body: JSON.stringify({
      product_id: productId,
      primary_product_id: primaryProductId,
      accepted,
      amount,
      conversation_id: conversationId,
      // source/campaign_id needed for merchant dashboard's per-source attribution.
      source,
      campaign_id: campaignId
    })
  });
}
