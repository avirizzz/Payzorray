const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { verifyRazorpaySignature, resolveApprovalId, resolveRefundOrderId, decideOrderPromotion, processRazorpayWebhook } = require('../webhooks');

test('verifyRazorpaySignature: accepts a correctly signed body', () => {
  const secret = 'test_webhook_secret';
  const body = JSON.stringify({ event: 'payment.captured' });
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  assert.strictEqual(verifyRazorpaySignature(body, signature, secret), true);
});

test('verifyRazorpaySignature: rejects a tampered body', () => {
  const secret = 'test_webhook_secret';
  const body = JSON.stringify({ event: 'payment.captured' });
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const tamperedBody = JSON.stringify({ event: 'payment.captured', amount: 999999 });
  assert.strictEqual(verifyRazorpaySignature(tamperedBody, signature, secret), false);
});

test('verifyRazorpaySignature: rejects a signature signed with the wrong secret', () => {
  const body = JSON.stringify({ event: 'payment.captured' });
  const signature = crypto.createHmac('sha256', 'wrong_secret').update(body).digest('hex');
  assert.strictEqual(verifyRazorpaySignature(body, signature, 'test_webhook_secret'), false);
});

test('verifyRazorpaySignature: rejects when body, signature, or secret is missing', () => {
  assert.strictEqual(verifyRazorpaySignature(null, 'sig', 'secret'), false);
  assert.strictEqual(verifyRazorpaySignature('body', null, 'secret'), false);
  assert.strictEqual(verifyRazorpaySignature('body', 'sig', null), false);
});

test('resolveApprovalId: reads from order.entity.notes first', () => {
  const payload = { order: { entity: { notes: { approval_id: 'APP_1' } } }, payment: { entity: { notes: { approval_id: 'APP_2' } } } };
  assert.strictEqual(resolveApprovalId(payload), 'APP_1');
});

test('resolveApprovalId: falls back to payment.entity.notes', () => {
  const payload = { payment: { entity: { notes: { approval_id: 'APP_2' } } } };
  assert.strictEqual(resolveApprovalId(payload), 'APP_2');
});

test('resolveApprovalId: null when neither entity carries it', () => {
  assert.strictEqual(resolveApprovalId({ payment: { entity: { notes: {} } } }), null);
  assert.strictEqual(resolveApprovalId({}), null);
});

test('resolveRefundOrderId: reads refund.entity.notes.order_id', () => {
  assert.strictEqual(resolveRefundOrderId({ refund: { entity: { notes: { order_id: 'ORD_1' } } } }), 'ORD_1');
  assert.strictEqual(resolveRefundOrderId({}), null);
});

test('decideOrderPromotion: payment.captured/order.paid promote PENDING or FAILED to COMPLETED', () => {
  assert.strictEqual(decideOrderPromotion('PAYMENT_PENDING', 'payment.captured'), 'COMPLETED');
  assert.strictEqual(decideOrderPromotion('PAYMENT_FAILED', 'order.paid'), 'COMPLETED');
});

test('decideOrderPromotion: payment.captured never overwrites an already-terminal order', () => {
  assert.strictEqual(decideOrderPromotion('COMPLETED', 'payment.captured'), null);
  assert.strictEqual(decideOrderPromotion('CANCELLED', 'payment.captured'), null);
  assert.strictEqual(decideOrderPromotion('REFUNDED', 'payment.captured'), null);
});

test('decideOrderPromotion: payment.failed only touches a still-pending order', () => {
  assert.strictEqual(decideOrderPromotion('PAYMENT_PENDING', 'payment.failed'), 'PAYMENT_FAILED');
  assert.strictEqual(decideOrderPromotion('COMPLETED', 'payment.failed'), null);
});

test('decideOrderPromotion: refund.created is a safety net only for COMPLETED orders', () => {
  assert.strictEqual(decideOrderPromotion('COMPLETED', 'refund.created'), 'REFUNDED');
  assert.strictEqual(decideOrderPromotion('REFUNDED', 'refund.created'), null);
  assert.strictEqual(decideOrderPromotion('CANCELLED', 'refund.created'), null);
});

test('decideOrderPromotion: unknown event is always a no-op', () => {
  assert.strictEqual(decideOrderPromotion('PAYMENT_PENDING', 'subscription.activated'), null);
});

function fakeDeps(initialOrders) {
  const orders = new Map(initialOrders.map((o) => [o.order_id, { ...o }]));
  const updateCalls = [];
  const auditCalls = [];
  return {
    orders,
    updateCalls,
    auditCalls,
    deps: {
      fetchOrdersByApprovalId: async (approvalId) => [...orders.values()].filter((o) => o.approval_id === approvalId),
      fetchOrderById: async (orderId) => orders.get(orderId) || null,
      updateOrderStatus: async (orderId, status, extra = {}) => {
        const order = orders.get(orderId);
        if (order) Object.assign(order, { status }, extra);
        updateCalls.push({ orderId, status, extra });
        return order;
      },
      audit: async (fields) => {
        auditCalls.push(fields);
      }
    }
  };
}

test('processRazorpayWebhook: payment.captured promotes a pending order to COMPLETED', async () => {
  const { orders, updateCalls, deps } = fakeDeps([{ order_id: 'ORD_1', approval_id: 'APP_1', status: 'PAYMENT_PENDING', product_id: 'P1' }]);
  const payload = { order: { entity: { notes: { approval_id: 'APP_1' } } }, payment: { entity: { id: 'pay_123' } } };

  const result = await processRazorpayWebhook({ event: 'order.paid', payload, paymentId: 'pay_123', deps });

  assert.strictEqual(orders.get('ORD_1').status, 'COMPLETED');
  assert.strictEqual(orders.get('ORD_1').razorpay_payment_id, 'pay_123');
  assert.strictEqual(updateCalls.length, 1);
  assert.strictEqual(result.updated.length, 1);
});

test('processRazorpayWebhook: re-processing the SAME event against an already-completed order is a no-op (idempotent)', async () => {
  const { orders, updateCalls, deps } = fakeDeps([{ order_id: 'ORD_1', approval_id: 'APP_1', status: 'COMPLETED', product_id: 'P1' }]);
  const payload = { order: { entity: { notes: { approval_id: 'APP_1' } } }, payment: { entity: { id: 'pay_123' } } };

  await processRazorpayWebhook({ event: 'order.paid', payload, paymentId: 'pay_123', deps });
  await processRazorpayWebhook({ event: 'order.paid', payload, paymentId: 'pay_123', deps });

  assert.strictEqual(orders.get('ORD_1').status, 'COMPLETED');
  assert.strictEqual(updateCalls.length, 0);
});

test('processRazorpayWebhook: payment.failed marks a pending order failed', async () => {
  const { orders, deps } = fakeDeps([{ order_id: 'ORD_1', approval_id: 'APP_1', status: 'PAYMENT_PENDING', product_id: 'P1' }]);
  const payload = { payment: { entity: { id: 'pay_123', notes: { approval_id: 'APP_1' } } } };

  await processRazorpayWebhook({ event: 'payment.failed', payload, paymentId: 'pay_123', deps });

  assert.strictEqual(orders.get('ORD_1').status, 'PAYMENT_FAILED');
});

test('processRazorpayWebhook: refund.created promotes the specific order named in the refund note, not siblings sharing the same payment', async () => {
  const { orders, updateCalls, deps } = fakeDeps([
    { order_id: 'ORD_1', approval_id: 'APP_1', status: 'COMPLETED', product_id: 'P1' },
    { order_id: 'ORD_2', approval_id: 'APP_1', status: 'COMPLETED', product_id: 'P2' }
  ]);
  const payload = { refund: { entity: { id: 'rfnd_1', amount: 5000, notes: { order_id: 'ORD_1' } } } };

  await processRazorpayWebhook({ event: 'refund.created', payload, deps });

  assert.strictEqual(orders.get('ORD_1').status, 'REFUNDED');
  assert.strictEqual(orders.get('ORD_2').status, 'COMPLETED');
  assert.strictEqual(updateCalls.length, 1);
});

test('processRazorpayWebhook: no matching order just logs, never throws', async () => {
  const { auditCalls, deps } = fakeDeps([]);
  const payload = { order: { entity: { notes: { approval_id: 'APP_UNKNOWN' } } }, payment: { entity: { id: 'pay_1' } } };

  const result = await processRazorpayWebhook({ event: 'order.paid', payload, paymentId: 'pay_1', deps });

  assert.strictEqual(result.matchedOrders, 0);
  assert.strictEqual(auditCalls.length, 1);
});
