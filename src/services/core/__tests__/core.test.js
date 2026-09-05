const test = require('node:test');
const assert = require('node:assert');
const { isValidProduct } = require('../constraints');
const { getEffectiveAuthorization, isTransactionPermitted } = require('../authorization');
const { isMandateValid } = require('../mandate');
const { generateIdempotencyKey } = require('../idempotency');
const { executeCheckoutSequence } = require('../checkout');
const { checkTokenUsable } = require('../tokenValidity');

test('Constraints: Valid Product', () => {
  const p = { price: 1999, stock: 5 };
  assert.strictEqual(isValidProduct(p, { max_price: 2000, quantity: 2 }), true);
});

test('Constraints: Fails on price', () => {
  const p = { price: 2100, stock: 5 };
  assert.strictEqual(isValidProduct(p, { max_price: 2000 }), false);
});

test('Constraints: Fails on stock', () => {
  const p = { price: 1000, stock: 1 };
  assert.strictEqual(isValidProduct(p, { quantity: 2 }), false);
});

test('Constraints: Handles missing data gracefully', () => {
  assert.strictEqual(isValidProduct(null, { max_price: 2000 }), false);
  assert.strictEqual(isValidProduct({}, { max_price: 2000 }), false);
});

test('Authorization: Effective math', () => {
  assert.strictEqual(getEffectiveAuthorization(2000, 5000, 10000), 2000);
  assert.strictEqual(getEffectiveAuthorization(undefined, 5000, 3000), 3000);
});

test('Authorization: Transaction permitted', () => {
  assert.strictEqual(isTransactionPermitted(1999, 2000), true);
  assert.strictEqual(isTransactionPermitted(2001, 2000), false);
});

test('Authorization: Fails on adversarial inputs (negative amounts, NaN)', () => {
  assert.strictEqual(isTransactionPermitted(-500, 2000), false, 'Negative transaction amount should fail');
  assert.strictEqual(isTransactionPermitted(1999, -2000), false, 'Negative authorization should fail');
  assert.strictEqual(isTransactionPermitted(NaN, 2000), false, 'NaN transaction amount should fail');
  assert.strictEqual(isTransactionPermitted(1999, NaN), false, 'NaN authorization should fail');
});

test('Authorization: Fails on negative amounts (adversarial)', () => {
  assert.strictEqual(isTransactionPermitted(-500, 2000), false);
  assert.strictEqual(isTransactionPermitted(100, -2000), false);
});

test('Mandate: Valid when active and within limits', () => {
  const mandate = {
    status: 'ACTIVE',
    razorpay_token: { original_max_amount: 5000, remaining_balance: 5000, expire_at: 1000 }
  };
  assert.strictEqual(isMandateValid(mandate, 2000, 500), true);
});

test('Mandate: Fails when expired', () => {
  const mandate = {
    status: 'ACTIVE',
    razorpay_token: { original_max_amount: 5000, remaining_balance: 5000, expire_at: 1000 }
  };
  assert.strictEqual(isMandateValid(mandate, 2000, 1500), false);
});

test('Mandate: Fails when over amount', () => {
  const mandate = {
    status: 'ACTIVE',
    razorpay_token: { original_max_amount: 5000, remaining_balance: 5000, expire_at: 1000 }
  };
  assert.strictEqual(isMandateValid(mandate, 6000, 500), false);
});

test('Mandate: Fails on negative, zero, or malformed order amounts', () => {
  const mandate = {
    status: 'ACTIVE',
    razorpay_token: { original_max_amount: 5000, remaining_balance: 5000, expire_at: 1000 }
  };
  assert.strictEqual(isMandateValid(mandate, -100, 500), false, 'Negative order amount should fail');
  assert.strictEqual(isMandateValid(mandate, 0, 500), false, 'Zero order amount should fail');
  assert.strictEqual(isMandateValid(mandate, NaN, 500), false, 'NaN order amount should fail');
});

test('Mandate: Fails when CONSUMED (replay blocked)', () => {
  const mandate = {
    status: 'CONSUMED',
    razorpay_token: { original_max_amount: 5000, remaining_balance: 5000, expire_at: 1000 }
  };
  assert.strictEqual(isMandateValid(mandate, 2000, 500), false, 'CONSUMED mandate should be rejected');
});

test('Idempotency: Consistent hash', () => {
  const hash1 = generateIdempotencyKey('C1', 'Conv1', 'App1', 'ORDER');
  const hash2 = generateIdempotencyKey('C1', 'Conv1', 'App1', 'ORDER');
  assert.strictEqual(hash1, hash2);
});

test('Idempotency: Throws on missing fields (adversarial)', () => {
  assert.throws(() => generateIdempotencyKey(null, 'Conv1', 'App1', 'ORDER'));
  assert.throws(() => generateIdempotencyKey('C1', null, 'App1', 'ORDER'));
});

test('Checkout Sequence: Success Path', async () => {
  const mandate = {
    status: 'ACTIVE',
    razorpay_token: { original_max_amount: 2000, remaining_balance: 2000, expire_at: 2000 },
    issued_to: { caller_type: 'HUMAN_CHATBOT', customer_id: 'C101' },
    approval_id: 'APP1'
  };

  const res = await executeCheckoutSequence({
    productId: 'P1',
    quantity: 1,
    mandate,
    fetchProductFn: async () => ({ product_id: 'P1', price: 1999, stock: 5 }),
    verifyDeliveryFn: async () => true,
    validatePolicyFn: async () => true,
    reserveOrderFn: async () => 'ORD1',
    executePaymentFn: async () => ({ status: 'SUCCESS', amount: 1999, paymentId: 'PAY1' }),
    currentTimeUnix: 1000
  });

  assert.strictEqual(res.status, 'COMPLETED');
  assert.strictEqual(res.verified, true);
});

test('Checkout Sequence: Fails on OUT_OF_STOCK', async () => {
  const mandate = {
    status: 'ACTIVE',
    razorpay_token: { original_max_amount: 2000, remaining_balance: 2000, expire_at: 2000 },
    issued_to: { caller_type: 'HUMAN_CHATBOT', customer_id: 'C101' },
    approval_id: 'APP1'
  };

  const res = await executeCheckoutSequence({
    productId: 'P1',
    quantity: 2,
    mandate,
    fetchProductFn: async () => ({ product_id: 'P1', price: 1000, stock: 1 }),
    verifyDeliveryFn: async () => true,
    validatePolicyFn: async () => true,
    reserveOrderFn: async () => 'ORD1',
    executePaymentFn: async () => ({ status: 'SUCCESS', amount: 2000, paymentId: 'PAY1' }),
    currentTimeUnix: 1000
  });

  assert.strictEqual(res.status, 'OUT_OF_STOCK');
  assert.strictEqual(res.verified, false);
});

test('Checkout Sequence: Fails on PRICE_CHANGED explicitly', async () => {
  const mandate = {
    status: 'ACTIVE',
    razorpay_token: { original_max_amount: 5000, remaining_balance: 5000, expire_at: 2000 },
    issued_to: { caller_type: 'HUMAN_CHATBOT', customer_id: 'C101' },
    approval_id: 'APP1'
  };

  const res = await executeCheckoutSequence({
    productId: 'P1',
    quantity: 1,
    selectedPrice: 1999,
    mandate,
    fetchProductFn: async () => ({ product_id: 'P1', price: 2199, stock: 5 }),
    verifyDeliveryFn: async () => true,
    validatePolicyFn: async () => true,
    reserveOrderFn: async () => 'ORD1',
    executePaymentFn: async () => ({ status: 'SUCCESS', amount: 2199, paymentId: 'PAY1' }),
    currentTimeUnix: 1000
  });

  assert.strictEqual(res.status, 'PRICE_CHANGED', 'Price change between selection and order should trigger PRICE_CHANGED');
  assert.strictEqual(res.verified, false);
});

test('Idempotency: Replayed key returns original result', async () => {
  const idempotencyStore = new Map();

  async function mockIdempotentWrapper(customerId, conversationId, approvalId, action, executionFn) {
    const key = generateIdempotencyKey(customerId, conversationId, approvalId, action);
    if (idempotencyStore.has(key)) {
      return idempotencyStore.get(key);
    }
    const result = await executionFn();
    idempotencyStore.set(key, result);
    return result;
  }

  let executionCount = 0;
  const mockExecution = async () => {
    executionCount++;
    return { status: 'COMPLETED' };
  };

  const res1 = await mockIdempotentWrapper('C1', 'Conv1', 'App1', 'ORDER', mockExecution);
  const res2 = await mockIdempotentWrapper('C1', 'Conv1', 'App1', 'ORDER', mockExecution);

  assert.strictEqual(res1.status, 'COMPLETED');
  assert.strictEqual(res2.status, 'COMPLETED');
  assert.strictEqual(executionCount, 1, 'Execution logic should only run once for the same idempotency key');
});

test('Checkout Sequence: shipping cost and coupon discount both fold into the authorized/charged total', async () => {
  const mandate = {
    status: 'ACTIVE',
    razorpay_token: { original_max_amount: 5000, remaining_balance: 5000, expire_at: 2000 },
    issued_to: { caller_type: 'HUMAN_CHATBOT', customer_id: 'C101' },
    approval_id: 'APP1'
  };

  let chargedAmount = null;
  const res = await executeCheckoutSequence({
    productId: 'P1',
    quantity: 1,
    mandate,
    fetchProductFn: async () => ({ product_id: 'P1', price: 1000, stock: 5 }),
    verifyDeliveryFn: async () => true,
    validatePolicyFn: async () => true,
    resolveShippingFn: async (_product, shippingOptionId) => (shippingOptionId === 'express' ? { option: 'express', label: 'Express', cost: 150 } : null),
    resolveCouponFn: async (code, subtotal) => (code === 'JDM50' ? { valid: true, code, discount: 50 } : { valid: false, reason: 'not found' }),
    shippingOptionId: 'express',
    couponCode: 'JDM50',
    reserveOrderFn: async (_productId, _quantity, amount) => {
      chargedAmount = amount;
      return 'ORD1';
    },
    executePaymentFn: async (_orderId, amount) => ({ status: 'SUCCESS', amount, paymentId: 'PAY1' }),
    currentTimeUnix: 1000
  });

  assert.strictEqual(chargedAmount, 1100);
  assert.strictEqual(res.status, 'COMPLETED');
  assert.strictEqual(res.amount, 1100);
});

test('Checkout Sequence: unknown coupon code is rejected, order never proceeds to payment', async () => {
  const mandate = {
    status: 'ACTIVE',
    razorpay_token: { original_max_amount: 5000, remaining_balance: 5000, expire_at: 2000 },
    issued_to: { caller_type: 'HUMAN_CHATBOT', customer_id: 'C101' },
    approval_id: 'APP1'
  };

  let paymentAttempted = false;
  const res = await executeCheckoutSequence({
    productId: 'P1',
    quantity: 1,
    mandate,
    fetchProductFn: async () => ({ product_id: 'P1', price: 1000, stock: 5 }),
    verifyDeliveryFn: async () => true,
    validatePolicyFn: async () => true,
    resolveCouponFn: async () => ({ valid: false, reason: 'Coupon not found or inactive' }),
    couponCode: 'FAKECODE',
    reserveOrderFn: async () => 'ORD1',
    executePaymentFn: async () => {
      paymentAttempted = true;
      return { status: 'SUCCESS', amount: 1000, paymentId: 'PAY1' };
    },
    currentTimeUnix: 1000
  });

  assert.strictEqual(res.status, 'COUPON_INVALID');
  assert.strictEqual(paymentAttempted, false, 'An invalid coupon must never reach payment execution');
});

test('Checkout Sequence: mandate cap enforced against the FULL total (product + shipping), not just the product price', async () => {
  const mandate = {
    status: 'ACTIVE',
    razorpay_token: { original_max_amount: 1000, remaining_balance: 1000, expire_at: 2000 },
    issued_to: { caller_type: 'HUMAN_CHATBOT', customer_id: 'C101' },
    approval_id: 'APP1'
  };

  const res = await executeCheckoutSequence({
    productId: 'P1',
    quantity: 1,
    mandate,
    fetchProductFn: async () => ({ product_id: 'P1', price: 900, stock: 5 }),
    verifyDeliveryFn: async () => true,
    validatePolicyFn: async () => true,
    resolveShippingFn: async () => ({ option: 'standard', label: 'Standard', cost: 150 }),
    shippingOptionId: 'standard',
    reserveOrderFn: async () => 'ORD1',
    executePaymentFn: async (_orderId, amount) => ({ status: 'SUCCESS', amount, paymentId: 'PAY1' }),
    currentTimeUnix: 1000
  });

  assert.strictEqual(res.status, 'AUTHORIZATION_EXCEEDED');
});

test('Token: usable when active and mandate not expired', () => {
  const token = { status: 'active' };
  const mandate = { razorpay_token: { expire_at: 2000 } };
  assert.strictEqual(checkTokenUsable(token, mandate, 1000).usable, true);
});

test('Token: revoked token rejected before mandate/cap logic is ever reached', () => {
  const token = { status: 'revoked' };
  const mandate = { razorpay_token: { expire_at: 2000 } };
  const result = checkTokenUsable(token, mandate, 1000);
  assert.strictEqual(result.usable, false);
  assert.match(result.reason, /revoked/);
});

test('Token: missing token rejected', () => {
  assert.strictEqual(checkTokenUsable(null, null, 1000).usable, false);
});

test('Token: active token blocked once its underlying mandate has expired', () => {
  const token = { status: 'active' };
  const mandate = { razorpay_token: { expire_at: 500 } };
  const result = checkTokenUsable(token, mandate, 1000);
  assert.strictEqual(result.usable, false);
  assert.match(result.reason, /expired/);
});

test('Mandate: Partial spend decrements remaining_balance but preserves original_max_amount', () => {
  const mandate = { status: 'ACTIVE', razorpay_token: { original_max_amount: 5000, remaining_balance: 5000, expire_at: 2000 } };
  const spend = 2000;
  const dbUpdate = (m, s) => ({...m, razorpay_token: {...m.razorpay_token, remaining_balance: m.razorpay_token.remaining_balance - s}});
  const updated = dbUpdate(mandate, spend);
  assert.strictEqual(updated.razorpay_token.original_max_amount, 5000);
  assert.strictEqual(updated.razorpay_token.remaining_balance, 3000);
  assert.strictEqual(isMandateValid(updated, 3000, 1000), true);
  assert.strictEqual(isMandateValid(updated, 3500, 1000), false);
});
