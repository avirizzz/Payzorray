const crypto = require('crypto');
const { insertCoupon, listCouponsByMerchant, setCouponActive, fetchCouponByCode } = require('../../db/coupons');
const { insertBundleCampaign, listBundleCampaigns, setBundleActive } = require('../../db/campaigns');
const { getProductById, fetchProductsByMerchantId } = require('../../db/retrieval');
const { insertAuditRecord } = require('../../db/audit');

async function audit(fields) {
  try {
    await insertAuditRecord(fields);
  } catch (error) {
    console.warn(`[audit] failed to write campaign record (${fields.action}): ${error.message}`);
  }
}

const MAX_PERCENT = 60;

function validateDiscount(discountType, discountValue) {
  if (!['percent', 'flat'].includes(discountType)) return 'discount_type must be percent or flat';
  const v = Number(discountValue);
  if (!Number.isFinite(v) || v <= 0) return 'discount_value must be a positive number';
  if (discountType === 'percent' && v > MAX_PERCENT) return `percent discount cannot exceed ${MAX_PERCENT}%`;
  return null;
}

async function createCouponCampaign({
  merchantId,
  code,
  description,
  discountType,
  discountValue,
  minOrderAmount = 0,
  scopeType = 'all',
  scopeValue = null,
  startsAt = null,
  expiresAt = null,
  conversationId = 'SYSTEM_DEFAULT'
}) {
  if (!merchantId) throw new Error('merchant_id is required');
  if (!code || !/^[A-Z0-9_-]{3,32}$/.test(code)) throw new Error('code must be 3-32 chars, A-Z 0-9 _ -');

  const discountError = validateDiscount(discountType, discountValue);
  if (discountError) throw new Error(discountError);

  if (!['all', 'category', 'product'].includes(scopeType)) throw new Error('scope_type must be all, category or product');
  if (scopeType !== 'all' && !scopeValue) throw new Error(`scope_value is required for scope_type ${scopeType}`);

  if (scopeType === 'product') {
    const product = await getProductById(scopeValue);
    if (!product || product.merchant_id !== merchantId) throw new Error(`product ${scopeValue} does not belong to this merchant`);
  }
  if (scopeType === 'category') {
    const products = await fetchProductsByMerchantId(merchantId);
    const categories = new Set(products.map((p) => p.category).filter(Boolean));
    if (!categories.has(scopeValue)) throw new Error(`category "${scopeValue}" has no products for this merchant`);
  }

  if (await fetchCouponByCode(code)) throw new Error(`Coupon code ${code} already exists`);

  const row = await insertCoupon({
    code,
    description: description || `${discountType === 'percent' ? `${discountValue}%` : `₹${discountValue}`} off`,
    discount_type: discountType,
    discount_value: Number(discountValue),
    min_order_amount: Number(minOrderAmount) || 0,
    active: true,
    merchant_id: merchantId,
    scope_type: scopeType,
    scope_value: scopeType === 'all' ? null : scopeValue,
    starts_at: startsAt,
    expires_at: expiresAt
  });

  await audit({
    conversationId,
    actor: 'MERCHANT',
    action: 'CAMPAIGN_CREATED',
    productId: scopeType === 'product' ? scopeValue : undefined,
    amount: Number(discountValue),
    decision: 'ALLOWED',
    reason: `coupon campaign ${code}, scope ${scopeType}${scopeValue ? `:${scopeValue}` : ''}, merchant ${merchantId}`,
    result: 'COUPON_CAMPAIGN'
  });

  return row;
}

async function setCouponCampaignActive({ merchantId, code, active, conversationId = 'SYSTEM_DEFAULT' }) {
  const existing = await fetchCouponByCode(code);
  if (!existing) throw new Error(`Coupon ${code} not found`);
  if (existing.merchant_id !== merchantId) throw new Error('This campaign belongs to another merchant');

  const row = await setCouponActive(code, active);
  await audit({
    conversationId,
    actor: 'MERCHANT',
    action: active ? 'CAMPAIGN_ACTIVATED' : 'CAMPAIGN_DEACTIVATED',
    decision: 'ALLOWED',
    reason: `coupon campaign ${code}, merchant ${merchantId}`,
    result: 'COUPON_CAMPAIGN'
  });
  return row;
}

async function createBundleCampaign({
  merchantId,
  primaryProductId,
  pairedProductId,
  discountType,
  discountValue,
  expiresAt = null,
  conversationId = 'SYSTEM_DEFAULT'
}) {
  if (!merchantId) throw new Error('merchant_id is required');
  if (!primaryProductId || !pairedProductId) throw new Error('primary and paired product ids are required');
  if (primaryProductId === pairedProductId) throw new Error('a bundle needs two different products');

  const discountError = validateDiscount(discountType, discountValue);
  if (discountError) throw new Error(discountError);

  const [primary, paired] = await Promise.all([getProductById(primaryProductId), getProductById(pairedProductId)]);
  if (!primary || primary.merchant_id !== merchantId) throw new Error(`product ${primaryProductId} does not belong to this merchant`);
  if (!paired || paired.merchant_id !== merchantId) throw new Error(`product ${pairedProductId} does not belong to this merchant`);

  const row = await insertBundleCampaign({
    id: `BC_${crypto.randomUUID()}`,
    merchant_id: merchantId,
    primary_product_id: primaryProductId,
    paired_product_id: pairedProductId,
    discount_type: discountType,
    discount_value: Number(discountValue),
    active: true,
    expires_at: expiresAt
  });

  await audit({
    conversationId,
    actor: 'MERCHANT',
    action: 'CAMPAIGN_CREATED',
    productId: primaryProductId,
    amount: Number(discountValue),
    decision: 'ALLOWED',
    reason: `bundle campaign ${primaryProductId} + ${pairedProductId}, merchant ${merchantId}`,
    result: 'BUNDLE_CAMPAIGN'
  });

  return row;
}

async function setBundleCampaignActive({ merchantId, id, active, conversationId = 'SYSTEM_DEFAULT' }) {
  const bundles = await listBundleCampaigns(merchantId);
  if (!bundles.some((b) => b.id === id)) throw new Error('Bundle campaign not found for this merchant');

  const row = await setBundleActive(id, active);
  await audit({
    conversationId,
    actor: 'MERCHANT',
    action: active ? 'CAMPAIGN_ACTIVATED' : 'CAMPAIGN_DEACTIVATED',
    decision: 'ALLOWED',
    reason: `bundle campaign ${id}, merchant ${merchantId}`,
    result: 'BUNDLE_CAMPAIGN'
  });
  return row;
}

async function listCampaigns(merchantId) {
  const [coupons, bundles] = await Promise.all([listCouponsByMerchant(merchantId), listBundleCampaigns(merchantId)]);
  return { coupon_campaigns: coupons, bundle_campaigns: bundles };
}

module.exports = {
  createCouponCampaign,
  setCouponCampaignActive,
  createBundleCampaign,
  setBundleCampaignActive,
  listCampaigns,
  validateDiscount,
  MAX_PERCENT
};
