import { apiFetch } from './client';

export async function listMerchantIds() {
  const { merchant_ids } = await apiFetch('/merchant/merchants');
  return merchant_ids;
}

export async function getMerchantStats(merchantId) {
  return apiFetch(`/merchant/stats?merchant_id=${encodeURIComponent(merchantId)}`);
}

export async function getRecentOrders(merchantId) {
  const { orders } = await apiFetch(`/merchant/orders?merchant_id=${encodeURIComponent(merchantId)}`);
  return orders;
}

export async function getAnalytics(merchantId, days = 30) {
  return apiFetch(`/merchant/analytics?merchant_id=${encodeURIComponent(merchantId)}&days=${days}`);
}

export async function getDiagnosis(merchantId) {
  return apiFetch(`/merchant/diagnosis?merchant_id=${encodeURIComponent(merchantId)}`);
}

export async function listCampaigns(merchantId) {
  return apiFetch(`/merchant/campaigns?merchant_id=${encodeURIComponent(merchantId)}`);
}

export async function createCouponCampaign(payload) {
  return apiFetch('/merchant/campaigns/coupon', { method: 'POST', body: JSON.stringify(payload) });
}

export async function createBundleCampaign(payload) {
  return apiFetch('/merchant/campaigns/bundle', { method: 'POST', body: JSON.stringify(payload) });
}

export async function setCouponCampaignActive(code, merchantId, active) {
  return apiFetch(`/merchant/campaigns/coupon/${encodeURIComponent(code)}/active`, {
    method: 'POST',
    body: JSON.stringify({ merchant_id: merchantId, active })
  });
}

export async function setBundleCampaignActive(id, merchantId, active) {
  return apiFetch(`/merchant/campaigns/bundle/${encodeURIComponent(id)}/active`, {
    method: 'POST',
    body: JSON.stringify({ merchant_id: merchantId, active })
  });
}

export async function getFlaggedEvents(merchantId) {
  const { events } = await apiFetch(`/merchant/flagged-events?merchant_id=${encodeURIComponent(merchantId)}`);
  return events;
}

export async function getReadiness(merchantId) {
  return apiFetch(`/merchant/readiness?merchant_id=${encodeURIComponent(merchantId)}`);
}

export async function getUpsellPerformance(merchantId) {
  return apiFetch(`/merchant/upsell-performance?merchant_id=${encodeURIComponent(merchantId)}`);
}

export async function chatWithMerchantAgent({ merchantId, message, history, conversationId }) {
  return apiFetch('/merchant/chat', {
    method: 'POST',
    body: JSON.stringify({ merchant_id: merchantId, message, history, conversation_id: conversationId })
  });
}
