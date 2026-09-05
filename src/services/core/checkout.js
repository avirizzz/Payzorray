const { isMandateValid } = require('./mandate');

const { generateIdempotencyKey } = require('./idempotency');

async function executeCheckoutSequence({
  productId,
  quantity,
  selectedPrice,
  mandate,
  conversationId = 'SYSTEM_DEFAULT',
  fetchProductFn,
  verifyDeliveryFn,
  validatePolicyFn,
  reserveOrderFn,
  executePaymentFn,
  resolveShippingFn,
  resolveCouponFn,
  resolveBundleFn,
  shippingOptionId,
  couponCode,
  bundlePrimaryProductId,
  currentTimeUnix
}) {
  const idempotencyKey = generateIdempotencyKey(mandate.issued_to.customer_id, conversationId, mandate.approval_id, `ORDER_${productId}`);

  const product = await fetchProductFn(productId);
  if (!product) return { status: 'NO_PRODUCT_FOUND', verified: false };

  if (selectedPrice !== undefined && product.price !== selectedPrice) {
    return { status: 'PRICE_CHANGED', verified: false };
  }
  const subtotal = product.price * quantity;

  let shipping = { option: null, label: null, cost: 0 };
  if (shippingOptionId) {
    const resolved = resolveShippingFn ? await resolveShippingFn(product, shippingOptionId) : null;
    if (!resolved) return { status: 'INVALID_SHIPPING_OPTION', verified: false };
    shipping = resolved;
  }

  let discount = { code: null, discount: 0 };
  if (couponCode) {
    const resolved = resolveCouponFn ? await resolveCouponFn(couponCode, subtotal + shipping.cost) : { valid: false, reason: 'Coupons not supported here' };
    if (!resolved.valid) return { status: 'COUPON_INVALID', verified: false, reason: resolved.reason };
    discount = { code: resolved.code, discount: resolved.discount };
  }

  let bundle = { campaignId: null, discount: 0 };
  if (bundlePrimaryProductId) {
    const resolved = resolveBundleFn
      ? await resolveBundleFn(bundlePrimaryProductId, product, subtotal)
      : { valid: false, reason: 'Bundle offers not supported here' };
    if (!resolved.valid) return { status: 'BUNDLE_INVALID', verified: false, reason: resolved.reason };
    bundle = { campaignId: resolved.campaignId, discount: resolved.discount };
  }

  const totalDiscount = Math.min(discount.discount + bundle.discount, subtotal + shipping.cost);
  const expectedAmount = subtotal + shipping.cost - totalDiscount;

  if (product.stock < quantity) {
    return { status: 'OUT_OF_STOCK', verified: false };
  }

  const deliveryValid = await verifyDeliveryFn(product);
  if (!deliveryValid) return { status: 'DELIVERY_UNAVAILABLE', verified: false };

  const policyValid = await validatePolicyFn(product, expectedAmount, mandate.issued_to.caller_type);
  if (!policyValid) return { status: 'POLICY_BLOCKED', verified: false };

  if (!isMandateValid(mandate, expectedAmount, currentTimeUnix)) {
    return { status: 'AUTHORIZATION_EXCEEDED', verified: false };
  }

  const orderId = await reserveOrderFn(product.product_id, quantity, expectedAmount, mandate.approval_id, {
    productName: product.name,
    shipping,
    discount: { ...discount, discount: totalDiscount, bundle_campaign_id: bundle.campaignId }
  });
  if (!orderId) return { status: 'ORDER_FAILED', verified: false };

  const paymentResult = await executePaymentFn(orderId, expectedAmount, mandate);

  if (paymentResult.status === 'SUCCESS' && paymentResult.amount === expectedAmount) {
    return {
      status: 'COMPLETED',
      verified: true,
      orderId,
      paymentId: paymentResult.paymentId,
      amount: expectedAmount,
      shipping,
      discount,
      simulated: !!paymentResult.simulated
    };
  } else {
    return { status: 'PAYMENT_FAILED', verified: false, orderId };
  }
}

module.exports = { executeCheckoutSequence };
