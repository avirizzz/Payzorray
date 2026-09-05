const { listActiveCoupons: dbListActiveCoupons, fetchCouponByCode } = require('../../db/coupons');
const { getProductById } = require('../../db/retrieval');

function isCouponEligibleForProduct(coupon, product) {
  if (!coupon.merchant_id) return true;

  if (!product) return false;
  if (product.merchant_id !== coupon.merchant_id) return false;

  const scope = coupon.scope_type || 'all';
  if (scope === 'all') return true;
  if (scope === 'category') return product.category === coupon.scope_value;
  if (scope === 'product') return product.product_id === coupon.scope_value;
  return false;
}

function isWithinWindow(coupon, now = Date.now()) {
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) return false;
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) return false;
  return true;
}

async function listActiveCoupons(productId) {
  const coupons = (await dbListActiveCoupons()).filter((c) => isWithinWindow(c));
  if (!productId) {
    return coupons.filter((c) => !c.merchant_id);
  }
  const product = await getProductById(productId);
  return coupons.filter((c) => isCouponEligibleForProduct(c, product));
}

function computeDiscount(coupon, amount) {
  const discount = coupon.discount_type === 'percent' ? Math.round((amount * coupon.discount_value) / 100) : coupon.discount_value;
  return Math.min(discount, amount);
}

function checkWindowAndActive(coupon) {
  if (!coupon || !coupon.active) return { valid: false, reason: 'Coupon not found or inactive' };
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > Date.now()) return { valid: false, reason: "This coupon hasn't started yet" };
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) return { valid: false, reason: 'Coupon has expired' };
  return { valid: true };
}

async function validateCoupon(code, orderAmount, productId) {
  const coupon = await fetchCouponByCode(code);
  const windowCheck = checkWindowAndActive(coupon);
  if (!windowCheck.valid) return windowCheck;

  const product = productId ? await getProductById(productId) : null;
  if (!isCouponEligibleForProduct(coupon, product)) {
    return { valid: false, reason: "This coupon isn't valid for this product" };
  }
  if (orderAmount < coupon.min_order_amount) {
    return { valid: false, reason: `Minimum order amount for this coupon is ₹${coupon.min_order_amount}` };
  }

  return { valid: true, code: coupon.code, description: coupon.description, discount: computeDiscount(coupon, orderAmount) };
}

function isCouponEligibleForCart(coupon, merchantId, items) {
  if (!coupon.merchant_id) return true;
  if (coupon.merchant_id !== merchantId) return false;
  const scope = coupon.scope_type || 'all';
  if (scope === 'all') return true;
  if (scope === 'category') return items.some((it) => it.category === coupon.scope_value);
  if (scope === 'product') return items.some((it) => it.product_id === coupon.scope_value);
  return false;
}

async function listActiveCouponsForCart(merchantId, items) {
  const coupons = (await dbListActiveCoupons()).filter((c) => isWithinWindow(c));
  return coupons.filter((c) => isCouponEligibleForCart(c, merchantId, items));
}

// items: [{ product_id, category, subtotal }]. Discount is against the whole cart's merchandise subtotal.
async function validateCouponForCart(code, merchantId, items) {
  const coupon = await fetchCouponByCode(code);
  const windowCheck = checkWindowAndActive(coupon);
  if (!windowCheck.valid) return windowCheck;

  if (!isCouponEligibleForCart(coupon, merchantId, items)) {
    return { valid: false, reason: "This coupon isn't valid for this cart" };
  }
  const cartSubtotal = items.reduce((sum, it) => sum + it.subtotal, 0);
  if (cartSubtotal < coupon.min_order_amount) {
    return { valid: false, reason: `Minimum order amount for this coupon is ₹${coupon.min_order_amount}` };
  }

  return { valid: true, code: coupon.code, description: coupon.description, discount: computeDiscount(coupon, cartSubtotal), cartSubtotal };
}

// Re-validates the whole cart, then splits the total discount proportionally onto one item's order.
async function resolveCouponShareForItem(code, merchantId, items, productId) {
  const result = await validateCouponForCart(code, merchantId, items);
  if (!result.valid) return result;
  const item = items.find((it) => it.product_id === productId);
  if (!item) return { valid: false, reason: 'Item not part of this cart' };
  const share = result.cartSubtotal > 0 ? Math.round((result.discount * item.subtotal) / result.cartSubtotal) : 0;
  return { valid: true, code: result.code, description: result.description, discount: Math.min(share, item.subtotal) };
}

module.exports = {
  listActiveCoupons,
  validateCoupon,
  isCouponEligibleForProduct,
  isWithinWindow,
  listActiveCouponsForCart,
  validateCouponForCart,
  resolveCouponShareForItem
};
