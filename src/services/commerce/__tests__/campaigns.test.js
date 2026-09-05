const test = require('node:test');
const assert = require('node:assert');

const { isCouponEligibleForProduct, isWithinWindow } = require('../coupons');
const { decideUpsellOffer, computeDiscount } = require('../upsell');
const { validateDiscount, MAX_PERCENT } = require('../campaigns');


const bbProduct = { product_id: 'BB-1', merchant_id: 'M-BB', category: 'Fruits & Vegetables' };
const bbOther = { product_id: 'BB-2', merchant_id: 'M-BB', category: 'Meat' };
const hwProduct = { product_id: 'HW-1', merchant_id: 'M-HW', category: 'Toys' };

test('Coupon: platform-wide coupon (no merchant) applies to any product', () => {
  const coupon = { code: 'WELCOME10', merchant_id: null, scope_type: 'all' };
  assert.strictEqual(isCouponEligibleForProduct(coupon, bbProduct), true);
  assert.strictEqual(isCouponEligibleForProduct(coupon, hwProduct), true);
});

test("Coupon: merchant-scoped coupon never applies to another merchant's product", () => {
  const coupon = { code: 'BBALL', merchant_id: 'M-BB', scope_type: 'all' };
  assert.strictEqual(isCouponEligibleForProduct(coupon, bbProduct), true);
  assert.strictEqual(isCouponEligibleForProduct(coupon, hwProduct), false);
});

test('Coupon: category scope applies only within that category', () => {
  const coupon = { code: 'VEG15', merchant_id: 'M-BB', scope_type: 'category', scope_value: 'Fruits & Vegetables' };
  assert.strictEqual(isCouponEligibleForProduct(coupon, bbProduct), true);
  assert.strictEqual(isCouponEligibleForProduct(coupon, bbOther), false);
});

test('Coupon: product scope applies only to that exact product', () => {
  const coupon = { code: 'ONE', merchant_id: 'M-BB', scope_type: 'product', scope_value: 'BB-1' };
  assert.strictEqual(isCouponEligibleForProduct(coupon, bbProduct), true);
  assert.strictEqual(isCouponEligibleForProduct(coupon, bbOther), false);
});

test('Coupon: merchant-scoped coupon is ineligible when there is no product context', () => {
  const coupon = { code: 'BBALL', merchant_id: 'M-BB', scope_type: 'all' };
  assert.strictEqual(isCouponEligibleForProduct(coupon, null), false);
});

test('Coupon window: not started yet, and expired, are both rejected', () => {
  const now = Date.now();
  const future = new Date(now + 86400000).toISOString();
  const past = new Date(now - 86400000).toISOString();
  assert.strictEqual(isWithinWindow({ starts_at: future }, now), false);
  assert.strictEqual(isWithinWindow({ expires_at: past }, now), false);
  assert.strictEqual(isWithinWindow({ starts_at: past, expires_at: future }, now), true);
});


const primary = { product_id: 'P1', name: 'Primary', price: 100, stock: 5, category: 'C', merchant_id: 'M' };
const paired = { product_id: 'P2', name: 'Paired', price: 80, stock: 3, category: 'C', merchant_id: 'M' };

test('Upsell: an active bundle campaign takes priority over the category fallback', () => {
  const fallback = { product_id: 'P3', name: 'Fallback', price: 50, stock: 9, category: 'C', merchant_id: 'M' };
  const offer = decideUpsellOffer({
    primaryProduct: primary,
    bundle: { id: 'BC_1', discount_type: 'percent', discount_value: 25, paired_product: paired },
    fallbackCandidate: fallback
  });
  assert.strictEqual(offer.source, 'bundle_campaign');
  assert.strictEqual(offer.product.product_id, 'P2');
  assert.strictEqual(offer.campaign_id, 'BC_1');
  assert.strictEqual(offer.discount, 20);
  assert.strictEqual(offer.final_price, 60);
});

test('Upsell: falls back to same-category candidate when no bundle exists', () => {
  const offer = decideUpsellOffer({ primaryProduct: primary, bundle: null, fallbackCandidate: paired });
  assert.strictEqual(offer.source, 'category_fallback');
  assert.strictEqual(offer.discount, 0);
  assert.strictEqual(offer.final_price, 80);
});

test('Upsell: no offer at all when there is neither a bundle nor a candidate', () => {
  assert.strictEqual(decideUpsellOffer({ primaryProduct: primary, bundle: null, fallbackCandidate: null }), null);
});

test('Upsell: out-of-stock paired product is never offered', () => {
  const offer = decideUpsellOffer({
    primaryProduct: primary,
    bundle: { id: 'BC_2', discount_type: 'flat', discount_value: 10, paired_product: { ...paired, stock: 0 } },
    fallbackCandidate: null
  });
  assert.strictEqual(offer, null);
});

test('Upsell: fallback never suggests something more expensive than the item being bought', () => {
  const pricier = { ...paired, price: 500 };
  assert.strictEqual(decideUpsellOffer({ primaryProduct: primary, bundle: null, fallbackCandidate: pricier }), null);
});

test('Upsell: a bundle pairing a product with itself is rejected', () => {
  const offer = decideUpsellOffer({
    primaryProduct: primary,
    bundle: { id: 'BC_3', discount_type: 'percent', discount_value: 10, paired_product: primary },
    fallbackCandidate: null
  });
  assert.strictEqual(offer, null);
});

test('Upsell: bundle discount above the percent cap is refused, not clamped', () => {
  const offer = decideUpsellOffer({
    primaryProduct: primary,
    bundle: { id: 'BC_4', discount_type: 'percent', discount_value: MAX_PERCENT + 1, paired_product: paired },
    fallbackCandidate: null
  });
  assert.strictEqual(offer, null);
});

test('Upsell: flat discount never exceeds the price (final price cannot go negative)', () => {
  assert.strictEqual(computeDiscount(80, 'flat', 999), 80);
  const offer = decideUpsellOffer({
    primaryProduct: primary,
    bundle: { id: 'BC_5', discount_type: 'flat', discount_value: 999, paired_product: paired },
    fallbackCandidate: null
  });
  assert.strictEqual(offer.final_price, 0);
});


test('Campaign: discount validation rejects bad types, non-positive values and over-cap percents', () => {
  assert.ok(validateDiscount('bogus', 10));
  assert.ok(validateDiscount('percent', 0));
  assert.ok(validateDiscount('percent', -5));
  assert.ok(validateDiscount('percent', MAX_PERCENT + 1));
  assert.strictEqual(validateDiscount('percent', 25), null);
  assert.strictEqual(validateDiscount('flat', 200), null);
});


const { executeCheckoutSequence } = require('../../core/checkout');

function baseArgs(overrides = {}) {
  const product = { product_id: 'P2', name: 'Paired', price: 80, stock: 10 };
  return {
    productId: 'P2',
    quantity: 1,
    selectedPrice: 80,
    mandate: {
      approval_id: 'APP_1',
      status: 'ACTIVE',
      razorpay_token: { remaining_balance: 10000, expire_at: Math.floor(Date.now() / 1000) + 3600 },
      issued_to: { customer_id: 'C1', caller_type: 'AI_AGENT' }
    },
    currentTimeUnix: Math.floor(Date.now() / 1000),
    fetchProductFn: async () => product,
    verifyDeliveryFn: async () => true,
    validatePolicyFn: async () => true,
    reserveOrderFn: async () => 'ORD_1',
    executePaymentFn: async (_o, amount) => ({ status: 'SUCCESS', amount }),
    ...overrides
  };
}

test('Checkout: bundle discount is resolved server-side, not taken from the client', async () => {
  const result = await executeCheckoutSequence(
    baseArgs({
      bundlePrimaryProductId: 'P1',
      resolveBundleFn: async () => ({ valid: true, campaignId: 'BC_1', discount: 20 })
    })
  );
  assert.strictEqual(result.status, 'COMPLETED');
  assert.strictEqual(result.amount, 60);
});

test('Checkout: an unverifiable bundle assertion blocks the order outright', async () => {
  const result = await executeCheckoutSequence(
    baseArgs({
      bundlePrimaryProductId: 'P1',
      resolveBundleFn: async () => ({ valid: false, reason: 'No active bundle offer for that product' })
    })
  );
  assert.strictEqual(result.status, 'BUNDLE_INVALID');
  assert.strictEqual(result.verified, false);
});

test('Checkout: bundle asserted but no resolver wired is refused, never silently free', async () => {
  const result = await executeCheckoutSequence(baseArgs({ bundlePrimaryProductId: 'P1' }));
  assert.strictEqual(result.status, 'BUNDLE_INVALID');
});

test('Checkout: stacked coupon + bundle discounts are clamped, never negative', async () => {
  const result = await executeCheckoutSequence(
    baseArgs({
      couponCode: 'BIG',
      resolveCouponFn: async () => ({ valid: true, code: 'BIG', discount: 70 }),
      bundlePrimaryProductId: 'P1',
      resolveBundleFn: async () => ({ valid: true, campaignId: 'BC_1', discount: 70 })
    })
  );
  assert.strictEqual(result.status, 'AUTHORIZATION_EXCEEDED');
});

test('Checkout: partial stacked discounts add up correctly', async () => {
  const result = await executeCheckoutSequence(
    baseArgs({
      couponCode: 'TEN',
      resolveCouponFn: async () => ({ valid: true, code: 'TEN', discount: 10 }),
      bundlePrimaryProductId: 'P1',
      resolveBundleFn: async () => ({ valid: true, campaignId: 'BC_1', discount: 20 })
    })
  );
  assert.strictEqual(result.status, 'COMPLETED');
  assert.strictEqual(result.amount, 50);
});

test('Checkout: no bundle asserted leaves the total untouched', async () => {
  const result = await executeCheckoutSequence(baseArgs());
  assert.strictEqual(result.status, 'COMPLETED');
  assert.strictEqual(result.amount, 80);
});
